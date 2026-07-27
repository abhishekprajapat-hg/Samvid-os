import http from "k6/http";
import crypto from "k6/crypto";

const BASE_URL = __ENV.BASE_URL || "http://localhost:5000";
const APP_SECRET = __ENV.META_APP_SECRET || "test-secret";

export const options = {
  vus: Number(__ENV.VUS || 5),
  duration: __ENV.DURATION || "2m",
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<750"],
  },
};

export default function () {
  const body = JSON.stringify({
    object: "page",
    entry: [{ id: "perf-page", changes: [{ field: "leadgen", value: { leadgen_id: `perf-${__VU}-${__ITER}` } }] }],
  });
  const signature = crypto.hmac("sha256", APP_SECRET, body, "hex");
  http.post(`${BASE_URL}/api/webhook/meta`, body, {
    headers: {
      "Content-Type": "application/json",
      "X-Hub-Signature-256": `sha256=${signature}`,
    },
  });
}
