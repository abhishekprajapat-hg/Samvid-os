import http from "k6/http";
import { check, fail, group, sleep } from "k6";
import exec from "k6/execution";
import { Counter, Gauge, Rate, Trend } from "k6/metrics";

const required = (name) => {
  const value = String(__ENV[name] || "").trim();
  if (!value) {
    throw new Error(`${name} is required. Run only against isolated performance/staging infrastructure.`);
  }
  return value;
};

const envNumber = (name, fallback) => {
  const value = Number(__ENV[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

const envJson = (name, fallback) => {
  const raw = String(__ENV[name] || "").trim();
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`${name} must be valid JSON: ${error.message}`);
  }
};

const BASE_URL = required("BASE_URL").replace(/\/+$/, "");
const ACCESS_TOKEN = required("ACCESS_TOKEN");
const LOAD_PROFILE = required("LOAD_PROFILE");
const PERF_ENVIRONMENT = required("PERF_ENVIRONMENT");
const PERF_RUN_ID = required("PERF_RUN_ID");
const CONFIRM_ISOLATED = String(__ENV.CONFIRM_ISOLATED_PERF_ENV || "").toLowerCase() === "true";
const ALLOW_WRITES = String(__ENV.ALLOW_PERF_WRITES || "").toLowerCase() === "true";
const WRITE_TIMEOUT = String(__ENV.WRITE_TIMEOUT || "180s");
const REFRESH_TOKENS = envJson("REFRESH_TOKENS_JSON", []);
const RESERVATION_PAIRS = envJson("PERF_RESERVATION_PAIRS_JSON", []);
const METRICS_BEARER_TOKEN = String(__ENV.METRICS_BEARER_TOKEN || "").trim();
const MAX_RSS_BYTES = envNumber("MAX_RSS_BYTES", 0);

if (!CONFIRM_ISOLATED) {
  throw new Error("CONFIRM_ISOLATED_PERF_ENV=true is required so this cannot run against production by accident.");
}

if (!["performance", "staging", "isolated", "local-isolated"].includes(PERF_ENVIRONMENT)) {
  throw new Error("PERF_ENVIRONMENT must be one of: performance, staging, isolated, local-isolated.");
}

export const apiLatency = new Trend("samvid_api_latency", true);
export const healthLatency = new Trend("samvid_health_latency", true);
export const apiErrorRate = new Rate("samvid_api_errors");
export const healthErrorRate = new Rate("samvid_health_errors");
export const importRows = new Counter("samvid_import_rows");
export const stateConflictRate = new Rate("samvid_state_conflicts");
export const processRssBytes = new Gauge("samvid_process_rss_bytes");

const readScenarios = {
  normal: {
    normal_load: {
      executor: "constant-vus",
      vus: envNumber("VUS", 20),
      duration: __ENV.DURATION || "10m",
      exec: "readScenario",
    },
  },
  spike: {
    spike_load: {
      executor: "ramping-vus",
      stages: [
        { duration: __ENV.SPIKE_RAMP_UP || "1m", target: envNumber("SPIKE_BASE_VUS", 20) },
        { duration: __ENV.SPIKE_HOLD || "30s", target: envNumber("SPIKE_PEAK_VUS", 120) },
        { duration: __ENV.SPIKE_RECOVERY || "2m", target: envNumber("SPIKE_RECOVERY_VUS", 20) },
        { duration: "30s", target: 0 },
      ],
      exec: "readScenario",
    },
  },
  stress: {
    stress_load: {
      executor: "ramping-vus",
      stages: [
        { duration: __ENV.STRESS_RAMP_1 || "2m", target: envNumber("STRESS_STEP_1_VUS", 50) },
        { duration: __ENV.STRESS_RAMP_2 || "5m", target: envNumber("STRESS_STEP_2_VUS", 150) },
        { duration: __ENV.STRESS_HOLD || "5m", target: envNumber("STRESS_STEP_2_VUS", 150) },
        { duration: "2m", target: 0 },
      ],
      exec: "readScenario",
    },
  },
  soak: {
    soak_load: {
      executor: "constant-vus",
      vus: envNumber("SOAK_VUS", 30),
      duration: __ENV.SOAK_DURATION || "2h",
      exec: "readScenario",
    },
    soak_memory_probe: {
      executor: "constant-vus",
      vus: 1,
      duration: __ENV.SOAK_DURATION || "2h",
      exec: "metricsProbeScenario",
      startTime: "0s",
    },
  },
  lead_import_5000: {
    lead_import_5000: {
      executor: "shared-iterations",
      vus: 1,
      iterations: 1,
      maxDuration: __ENV.IMPORT_MAX_DURATION || "30m",
      exec: "leadImport5000Scenario",
    },
  },
  inventory_import_5000: {
    inventory_import_5000: {
      executor: "shared-iterations",
      vus: 1,
      iterations: 1,
      maxDuration: __ENV.IMPORT_MAX_DURATION || "45m",
      exec: "inventoryImport5000Scenario",
    },
  },
  concurrent_read: {
    search_load: {
      executor: "constant-vus",
      vus: envNumber("SEARCH_VUS", 25),
      duration: __ENV.DURATION || "10m",
      exec: "searchScenario",
    },
    dashboard_load: {
      executor: "constant-vus",
      vus: envNumber("DASHBOARD_VUS", 25),
      duration: __ENV.DURATION || "10m",
      exec: "dashboardScenario",
    },
  },
  reservation_closure: {
    reservation_closure_race: {
      executor: "shared-iterations",
      vus: envNumber("RACE_VUS", 10),
      iterations: envNumber("RACE_ITERATIONS", 50),
      maxDuration: __ENV.RACE_MAX_DURATION || "10m",
      exec: "reservationClosureScenario",
    },
  },
  token_refresh: {
    simultaneous_token_refresh: {
      executor: "constant-vus",
      vus: envNumber("TOKEN_REFRESH_VUS", 10),
      duration: __ENV.TOKEN_REFRESH_DURATION || "2m",
      exec: "tokenRefreshScenario",
    },
  },
};

const writeProfiles = new Set(["lead_import_5000", "inventory_import_5000", "reservation_closure"]);

if (!readScenarios[LOAD_PROFILE]) {
  throw new Error(`Unsupported LOAD_PROFILE "${LOAD_PROFILE}". Use one of: ${Object.keys(readScenarios).join(", ")}.`);
}

if (writeProfiles.has(LOAD_PROFILE) && !ALLOW_WRITES) {
  throw new Error(`${LOAD_PROFILE} writes synthetic data. Set ALLOW_PERF_WRITES=true only for isolated staging/perf data.`);
}

if (LOAD_PROFILE === "reservation_closure" && !RESERVATION_PAIRS.length) {
  throw new Error("PERF_RESERVATION_PAIRS_JSON is required for reservation_closure.");
}

if (LOAD_PROFILE === "token_refresh") {
  const refreshVus = envNumber("TOKEN_REFRESH_VUS", 10);
  if (!Array.isArray(REFRESH_TOKENS) || REFRESH_TOKENS.length < refreshVus) {
    throw new Error("REFRESH_TOKENS_JSON must contain at least TOKEN_REFRESH_VUS distinct refresh tokens.");
  }
}

if (LOAD_PROFILE === "soak" && !METRICS_BEARER_TOKEN) {
  throw new Error("METRICS_BEARER_TOKEN is required for soak so memory growth can be measured from /api/metrics.");
}

const thresholds = {
  checks: ["rate>0.99"],
  samvid_api_errors: ["rate<0.01"],
  samvid_health_errors: ["rate<0.01"],
  samvid_api_latency: ["p(95)<750"],
  samvid_health_latency: ["p(95)<500"],
  samvid_state_conflicts: ["rate==0"],
};

if (LOAD_PROFILE === "lead_import_5000") {
  thresholds["samvid_import_rows{entity:lead}"] = ["count>=5000"];
}

if (LOAD_PROFILE === "inventory_import_5000") {
  thresholds["samvid_import_rows{entity:inventory}"] = ["count>=5000"];
}

if (LOAD_PROFILE === "soak" && MAX_RSS_BYTES > 0) {
  thresholds.samvid_process_rss_bytes = [`value<${MAX_RSS_BYTES}`];
}

export const options = {
  scenarios: readScenarios[LOAD_PROFILE],
  thresholds,
};

const url = (path) => `${BASE_URL}${path}`;

const authParams = (extra = {}) => ({
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${ACCESS_TOKEN}`,
    ...extra,
  },
});

const jsonParams = () => ({
  headers: {
    "Content-Type": "application/json",
  },
});

const jsonBody = (res) => {
  try {
    return res.json();
  } catch {
    return null;
  }
};

const isObject = (value) => value && typeof value === "object" && !Array.isArray(value);
const is2xx = (status) => status >= 200 && status <= 299;

const record = ({
  res,
  label,
  expectedStatus = 200,
  contract,
  health = false,
}) => {
  const metric = health ? healthLatency : apiLatency;
  const rate = health ? healthErrorRate : apiErrorRate;
  metric.add(res.timings.duration, { endpoint: label, status: String(res.status) });
  const body = jsonBody(res);
  const statuses = Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus];
  const statusOk = statuses.includes(res.status);
  const contractOk = typeof contract === "function" ? contract(body, res) : true;
  const ok = check(res, {
    [`${label} returns expected status`]: () => statusOk,
    [`${label} returns expected contract`]: () => statusOk && contractOk,
    [`${label} never treats 401/404 as success`]: () => res.status !== 401 && res.status !== 404,
  });
  rate.add(!ok, { endpoint: label });
  if (!ok && String(__ENV.FAIL_FAST || "").toLowerCase() === "true") {
    fail(`${label} failed status/contract check with HTTP ${res.status}`);
  }
  return { ok, body };
};

const recordApi = (res, label, expectedStatus, contract) =>
  record({ res, label, expectedStatus, contract });

const recordHealth = (res, label) =>
  record({
    res,
    label,
    expectedStatus: 200,
    health: true,
    contract: (body) => isObject(body) && body.ok === true && typeof body.service === "string",
  });

const uniqueNumber = (offset = 0) =>
  (exec.vu.idInTest * 10_000_000 + exec.scenario.iterationInTest * 10_000 + offset) % 1_000_000_000;

const buildPhone = (offset) => `8${String(uniqueNumber(offset)).padStart(9, "0")}`;

const leadRows = (count, prefix) =>
  Array.from({ length: count }, (_, index) => ({
    name: `Perf Lead ${PERF_RUN_ID}-${prefix}-${index}`,
    phone: buildPhone(index),
    email: `perf-lead-${PERF_RUN_ID}-${prefix}-${index}@example.invalid`,
    city: "Perf City",
    projectInterested: `Perf Project ${PERF_RUN_ID}`,
    source: "MANUAL",
    status: "NEW",
  }));

const inventoryRows = (count, prefix) =>
  Array.from({ length: count }, (_, index) => ({
    projectName: `Perf Project ${PERF_RUN_ID}`,
    towerName: `Perf Tower ${prefix}`,
    unitNumber: `PERF-${prefix}-${index}`,
    propertyId: `perf-${PERF_RUN_ID}-${prefix}-${index}`,
    inventoryType: "COMMERCIAL",
    type: "Sale",
    category: "Office",
    status: "Available",
    price: 1_000_000 + index,
    location: "Perf City",
    city: "Perf City",
    area: "Perf Area",
    totalArea: 750 + index,
    areaUnit: "SQ_FT",
    siteLocation: { lat: 22.72, lng: 75.86 },
  }));

export function readScenario() {
  group("health endpoints", () => {
    recordHealth(http.get(url("/api/health")), "health");
    recordHealth(http.get(url("/api/client/health")), "client_health");
  });

  group("authenticated core reads", () => {
    recordApi(
      http.get(url("/api/client/bootstrap"), authParams()),
      "client_bootstrap",
      200,
      (body) => isObject(body) && body.ok === true && isObject(body.user) && isObject(body.capabilities),
    );
    recordApi(
      http.get(url("/api/leads?page=1&limit=25"), authParams()),
      "leads_list",
      200,
      (body) => isObject(body) && Array.isArray(body.leads) && isObject(body.pagination),
    );
    recordApi(
      http.get(url("/api/inventory?page=1&limit=25"), authParams()),
      "inventory_list",
      200,
      (body) => isObject(body) && Array.isArray(body.assets) && Array.isArray(body.inventory),
    );
    recordApi(
      http.get(url("/api/tasks"), authParams()),
      "tasks_list",
      200,
      (body) => Array.isArray(body),
    );
    recordApi(
      http.get(url("/api/attendance/me"), authParams()),
      "attendance_me",
      200,
      (body) => isObject(body) && Object.prototype.hasOwnProperty.call(body, "attendance"),
    );
  });

  sleep(1);
}

export function searchScenario() {
  const query = encodeURIComponent(String(__ENV.SEARCH_TERM || "Perf"));
  const responses = http.batch([
    ["GET", url(`/api/leads?search=${query}&page=1&limit=25`), null, authParams()],
    ["GET", url(`/api/inventory?search=${query}&page=1&limit=25`), null, authParams()],
  ]);

  recordApi(responses[0], "leads_search", 200, (body) => isObject(body) && Array.isArray(body.leads));
  recordApi(responses[1], "inventory_search", 200, (body) => isObject(body) && Array.isArray(body.assets));
  sleep(1);
}

export function dashboardScenario() {
  const responses = http.batch([
    ["GET", url("/api/leads/performance/overview?range=MONTH"), null, authParams()],
    ["GET", url("/api/tasks/stats"), null, authParams()],
    ["GET", url("/api/client/bootstrap"), null, authParams()],
  ]);

  recordApi(responses[0], "lead_performance_overview", 200, (body) => isObject(body) && isObject(body.overview));
  recordApi(responses[1], "task_stats", 200, (body) => isObject(body) && typeof body.total === "number");
  recordApi(responses[2], "dashboard_bootstrap", 200, (body) => isObject(body) && body.ok === true);
  sleep(1);
}

export function leadImport5000Scenario() {
  const rows = leadRows(5000, "lead-import");
  const res = http.post(
    url("/api/leads/bulk"),
    JSON.stringify({ rows }),
    { ...authParams(), timeout: WRITE_TIMEOUT },
  );

  importRows.add(rows.length, { entity: "lead" });
  recordApi(
    res,
    "lead_import_5000",
    201,
    (body) =>
      isObject(body)
      && body.message === "Bulk lead upload processed"
      && body.failedCount === 0
      && body.createdCount + body.updatedCount === 5000,
  );
}

export function inventoryImport5000Scenario() {
  const batches = 10;
  const batchSize = 500;

  for (let batch = 0; batch < batches; batch += 1) {
    const rows = inventoryRows(batchSize, `inventory-import-${batch}`);
    const res = http.post(
      url("/api/inventory/bulk"),
      JSON.stringify({ rows }),
      { ...authParams(), timeout: WRITE_TIMEOUT },
    );

    importRows.add(rows.length, { entity: "inventory" });
    recordApi(
      res,
      `inventory_import_batch_${batch + 1}`,
      201,
      (body) =>
        isObject(body)
        && body.message === "Bulk inventory upload processed"
        && body.failedCount === 0
        && body.createdCount === batchSize,
    );
  }
}

export function reservationClosureScenario() {
  const pair = RESERVATION_PAIRS[exec.scenario.iterationInTest % RESERVATION_PAIRS.length];
  const inventoryId = String(pair.inventoryId || "");
  const leadId = String(pair.leadId || "");
  if (!inventoryId || !leadId) fail("Each reservation pair requires inventoryId and leadId.");

  const responses = http.batch([
    [
      "PATCH",
      url(`/api/inventory/${inventoryId}`),
      JSON.stringify({
        status: "Blocked",
        reservationLeadId: leadId,
        reservationReason: `Perf reservation race ${PERF_RUN_ID}`,
      }),
      authParams(),
    ],
    [
      "PATCH",
      url(`/api/leads/${leadId}/status`),
      JSON.stringify({
        status: "CLOSED",
        dealPayment: {
          mode: "CASH",
          paymentType: "FULL",
          totalAmount: 1_000_000,
          remainingAmount: 0,
        },
      }),
      authParams(),
    ],
  ]);

  recordApi(responses[0], "simultaneous_inventory_reservation", 200, (body) =>
    isObject(body) && isObject(body.inventory));
  recordApi(responses[1], "simultaneous_lead_closure", 200, (body) =>
    isObject(body) && isObject(body.lead));

  const finalInventory = http.get(url(`/api/inventory/${inventoryId}`), authParams());
  const finalLead = http.get(url(`/api/leads/${leadId}`), authParams());
  const inventoryBody = recordApi(finalInventory, "reservation_closure_final_inventory", 200, (body) =>
    isObject(body) && isObject(body.inventory)).body;
  const leadBody = recordApi(finalLead, "reservation_closure_final_lead", 200, (body) =>
    isObject(body) && isObject(body.lead)).body;

  const finalStatus = String(inventoryBody?.inventory?.status || inventoryBody?.asset?.status || "");
  const leadStatus = String(leadBody?.lead?.status || "");
  const contradictory = leadStatus === "CLOSED" && finalStatus === "Blocked";
  stateConflictRate.add(contradictory);
  check(null, {
    "no contradictory inventory/lead state after reservation/closure race": () => !contradictory,
  });
}

let vuRefreshToken = "";

export function tokenRefreshScenario() {
  if (!vuRefreshToken) {
    vuRefreshToken = REFRESH_TOKENS[exec.vu.idInTest - 1];
  }

  const res = http.post(
    url("/api/auth/refresh"),
    JSON.stringify({ refreshToken: vuRefreshToken }),
    jsonParams(),
  );

  const result = recordApi(
    res,
    "simultaneous_token_refresh",
    200,
    (body) => isObject(body) && typeof body.accessToken === "string" && typeof body.refreshToken === "string",
  );

  if (result.ok) {
    vuRefreshToken = result.body.refreshToken;
  }
  sleep(1);
}

export function metricsProbeScenario() {
  if (!METRICS_BEARER_TOKEN) {
    sleep(30);
    return;
  }

  const res = http.get(url("/api/metrics"), {
    headers: { Authorization: `Bearer ${METRICS_BEARER_TOKEN}` },
  });
  const text = res.body || "";
  const match = text.match(/^process_resident_memory_bytes\s+([0-9.]+)/m);
  const rss = match ? Number(match[1]) : 0;
  const ok = check(res, {
    "metrics endpoint returns process RSS": () => res.status === 200 && rss > 0,
  });
  healthErrorRate.add(!ok, { endpoint: "metrics" });
  if (rss > 0) {
    processRssBytes.add(rss);
  }
  sleep(envNumber("METRICS_POLL_SECONDS", 30));
}
