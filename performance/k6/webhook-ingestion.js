import http from "k6/http";
import crypto from "k6/crypto";
import { check, fail, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

const required = (name) => {
  const value = String(__ENV[name] || "").trim();
  if (!value) {
    throw new Error(`${name} is required for isolated Meta webhook performance tests.`);
  }
  return value;
};

const envNumber = (name, fallback) => {
  const value = Number(__ENV[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

const BASE_URL = required("BASE_URL").replace(/\/+$/, "");
const META_APP_SECRET = required("META_APP_SECRET");
const META_PAGE_ID = required("META_PAGE_ID");
const PERF_RUN_ID = required("PERF_RUN_ID");
const PERF_ENVIRONMENT = required("PERF_ENVIRONMENT");
const CONFIRM_ISOLATED = String(__ENV.CONFIRM_ISOLATED_PERF_ENV || "").toLowerCase() === "true";
const DEDUPE_POOL_SIZE = envNumber("DEDUPE_POOL_SIZE", 25);
const EVENTS_PER_REQUEST = envNumber("EVENTS_PER_REQUEST", 3);

if (!CONFIRM_ISOLATED) {
  throw new Error("CONFIRM_ISOLATED_PERF_ENV=true is required so webhook bursts cannot hit production by accident.");
}

if (!["performance", "staging", "isolated", "local-isolated"].includes(PERF_ENVIRONMENT)) {
  throw new Error("PERF_ENVIRONMENT must be one of: performance, staging, isolated, local-isolated.");
}

export const webhookLatency = new Trend("samvid_webhook_latency", true);
export const webhookErrors = new Rate("samvid_webhook_errors");
export const webhookDuplicates = new Counter("samvid_webhook_duplicates");
export const webhookProcessed = new Counter("samvid_webhook_processed");

export const options = {
  scenarios: {
    webhook_burst: {
      executor: "ramping-vus",
      stages: [
        { duration: __ENV.WEBHOOK_RAMP_UP || "30s", target: envNumber("WEBHOOK_BASE_VUS", 10) },
        { duration: __ENV.WEBHOOK_SPIKE || "1m", target: envNumber("WEBHOOK_SPIKE_VUS", 75) },
        { duration: __ENV.WEBHOOK_RECOVERY || "1m", target: envNumber("WEBHOOK_BASE_VUS", 10) },
        { duration: "30s", target: 0 },
      ],
    },
  },
  thresholds: {
    checks: ["rate>0.99"],
    samvid_webhook_errors: ["rate<0.01"],
    samvid_webhook_latency: ["p(95)<750"],
    samvid_webhook_processed: ["count>0"],
    samvid_webhook_duplicates: ["count>0"],
  },
};

const endpoint = () =>
  String(__ENV.WEBHOOK_NAMESPACE || "server") === "client"
    ? `${BASE_URL}/api/client/webhook/meta`
    : `${BASE_URL}/api/webhook/meta`;

const buildLeadEvent = (index) => {
  const dedupeKey = (index + __ITER + __VU) % DEDUPE_POOL_SIZE;
  return {
    field: "leadgen",
    value: {
      leadgen_id: `perf-webhook-${PERF_RUN_ID}-${dedupeKey}`,
      form_id: `perf-form-${PERF_RUN_ID}`,
      page_id: META_PAGE_ID,
      created_time: Math.floor(Date.now() / 1000),
    },
  };
};

const parseJson = (res) => {
  try {
    return res.json();
  } catch {
    return null;
  }
};

export default function () {
  const body = JSON.stringify({
    object: "page",
    entry: [
      {
        id: META_PAGE_ID,
        changes: Array.from({ length: EVENTS_PER_REQUEST }, (_, index) => buildLeadEvent(index)),
      },
    ],
  });
  const signature = crypto.hmac("sha256", META_APP_SECRET, body, "hex");
  const res = http.post(endpoint(), body, {
    headers: {
      "Content-Type": "application/json",
      "X-Hub-Signature-256": `sha256=${signature}`,
    },
  });

  webhookLatency.add(res.timings.duration, { status: String(res.status) });
  const payload = parseJson(res);
  const ok = check(res, {
    "webhook returns 200": () => res.status === 200,
    "webhook response has processing counters": () =>
      payload
      && typeof payload.received === "number"
      && typeof payload.processed === "number"
      && typeof payload.failed === "number"
      && typeof payload.duplicate === "number",
    "webhook mapped at least one configured page event": () => payload && payload.processed > 0,
    "webhook did not fail event processing": () => payload && payload.failed === 0,
  });

  webhookErrors.add(!ok);
  webhookProcessed.add(Number(payload?.processed || 0));
  webhookDuplicates.add(Number(payload?.duplicate || 0));

  if (!ok && String(__ENV.FAIL_FAST || "").toLowerCase() === "true") {
    fail(`webhook burst failed status/contract check with HTTP ${res.status}`);
  }

  sleep(1);
}
