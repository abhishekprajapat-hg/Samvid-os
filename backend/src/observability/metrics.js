const promClient = require("prom-client");
const logger = require("../config/logger");

const register = new promClient.Registry();

promClient.collectDefaultMetrics({
  register,
  prefix: "samvid_",
});

const httpRequestsInFlight = new promClient.Gauge({
  name: "samvid_http_requests_in_flight",
  help: "Current number of in-flight HTTP requests",
  labelNames: ["method"],
  registers: [register],
});

const httpRequestsTotal = new promClient.Counter({
  name: "samvid_http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status_code"],
  registers: [register],
});

const httpRequestDurationMs = new promClient.Histogram({
  name: "samvid_http_request_duration_ms",
  help: "HTTP request duration in milliseconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [25, 50, 100, 200, 400, 800, 1200, 2000, 5000],
  registers: [register],
});

const SLOW_REQUEST_THRESHOLD_MS = (() => {
  const parsed = Number.parseInt(process.env.SLOW_REQUEST_THRESHOLD_MS, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1200;
})();

const resolveRouteLabel = (req) => {
  const routePath = req.route?.path;
  if (routePath) {
    return `${req.baseUrl || ""}${routePath}`;
  }

  if (req.baseUrl && req.path) {
    return `${req.baseUrl}${req.path}`;
  }

  return req.path || req.originalUrl || "unknown";
};

const httpMetricsMiddleware = (req, res, next) => {
  const start = process.hrtime.bigint();
  const method = String(req.method || "GET").toUpperCase();
  let completed = false;

  httpRequestsInFlight.inc({ method });

  const finalize = () => {
    if (completed) return;
    completed = true;

    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    const route = resolveRouteLabel(req);
    const statusCode = String(res.statusCode || 200);

    httpRequestsInFlight.dec({ method });
    httpRequestsTotal.inc({ method, route, status_code: statusCode });
    httpRequestDurationMs.observe(
      { method, route, status_code: statusCode },
      durationMs,
    );

    if (durationMs >= SLOW_REQUEST_THRESHOLD_MS) {
      logger.warn({
        requestId: req.requestId || null,
        method,
        route,
        statusCode: res.statusCode,
        durationMs: Number(durationMs.toFixed(2)),
        message: "Slow request detected",
      });
    }
  };

  res.on("finish", finalize);
  res.on("close", finalize);

  next();
};

const metricsHandler = async (_req, res) => {
  res.setHeader("Content-Type", register.contentType);
  res.end(await register.metrics());
};

module.exports = {
  register,
  metricsHandler,
  httpMetricsMiddleware,
};
