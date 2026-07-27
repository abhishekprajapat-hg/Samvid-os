import http from "k6/http";
import { check, sleep } from "k6";
import { Trend, Rate } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://localhost:5000";
const PROFILE = __ENV.LOAD_PROFILE || "normal";
const TOKEN = __ENV.ACCESS_TOKEN || "";

export const errorRate = new Rate("samvid_errors");
export const apiLatency = new Trend("samvid_api_latency", true);

const profiles = {
  normal: { vus: 10, duration: "5m" },
  spike: { stages: [{ duration: "1m", target: 10 }, { duration: "30s", target: 100 }, { duration: "2m", target: 10 }] },
  stress: { stages: [{ duration: "2m", target: 25 }, { duration: "5m", target: 75 }, { duration: "2m", target: 0 }] },
  soak: { vus: 20, duration: "2h" },
};

export const options = {
  ...profiles[PROFILE],
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<750"],
    samvid_api_latency: ["p(95)<750"],
    samvid_errors: ["rate<0.01"],
  },
};

const authHeaders = () => ({
  headers: {
    "Content-Type": "application/json",
    ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
  },
});

const track = (res, label) => {
  apiLatency.add(res.timings.duration, { endpoint: label });
  const ok = check(res, {
    [`${label} status is not 5xx`]: (r) => r.status < 500,
    [`${label} p95 candidate completed`]: (r) => r.timings.duration < 3000,
  });
  errorRate.add(!ok);
};

export default function () {
  track(http.get(`${BASE_URL}/api/health`), "health");
  track(http.get(`${BASE_URL}/api/leads`, authHeaders()), "leads");
  track(http.get(`${BASE_URL}/api/inventory`, authHeaders()), "inventory");
  track(http.get(`${BASE_URL}/api/tasks`, authHeaders()), "tasks");
  track(http.get(`${BASE_URL}/api/attendance/my`, authHeaders()), "attendance");
  track(http.get(`${BASE_URL}/api/client/health`), "client_health");
  sleep(1);
}
