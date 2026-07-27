const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const { attachRequestId } = require("./middleware/requestId.middleware");
const { httpLogger } = require("./middleware/httpLogger.middleware");
const { apiLimiter } = require("./middleware/rateLimit.middleware");
const { httpMetricsMiddleware, metricsHandler } = require("./observability/metrics");
const { resolveTenantContext } = require("./middleware/tenant.middleware");

const app = express();
app.disable("x-powered-by");

const jsonBodyLimit = process.env.JSON_BODY_LIMIT || "768kb";
const urlencodedBodyLimit = process.env.URLENCODED_BODY_LIMIT || jsonBodyLimit;
const compressionThreshold =
  Number.parseInt(process.env.COMPRESSION_THRESHOLD_BYTES, 10) || 1024;

const trustProxyRaw = String(process.env.TRUST_PROXY || "").trim().toLowerCase();
if (trustProxyRaw) {
  if (trustProxyRaw === "true") {
    app.set("trust proxy", 1);
  } else if (trustProxyRaw === "false") {
    app.set("trust proxy", false);
  } else {
    const parsed = Number.parseInt(trustProxyRaw, 10);
    app.set("trust proxy", Number.isFinite(parsed) ? parsed : trustProxyRaw);
  }
} else if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

const configuredOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const isLoopbackOrigin = (origin) =>
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(String(origin || "").trim());

const isLanOrigin = (origin) =>
  /^https?:\/\/192\.168\.\d{1,3}\.\d{1,3}(:\d+)?$/i.test(String(origin || "").trim());

const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  if (process.env.NODE_ENV === "production") {
    return configuredOrigins.includes(origin);
  }
  if (configuredOrigins.includes("*")) return true;
  if (configuredOrigins.includes(origin)) return true;
  if (isLoopbackOrigin(origin) || isLanOrigin(origin)) return true;
  return false;
};

app.use(helmet());
app.use(compression({
  threshold: compressionThreshold,
  filter: (req, res) => {
    if (req.headers["x-no-compression"]) return false;
    return compression.filter(req, res);
  },
}));
app.use(attachRequestId);
app.use((req, res, next) => {
  const origin = String(req.headers.origin || "").trim();
  if (origin && !isAllowedOrigin(origin)) {
    return res.status(403).json({
      message: "CORS origin not allowed",
      requestId: req.requestId || null,
    });
  }
  return next();
});
app.use(
  cors({
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        callback(null, origin || true);
        return;
      }
      callback(null, false);
    },
    credentials: true,
  }),
);
app.use(httpLogger);
app.use(httpMetricsMiddleware);
app.use(express.json({
  limit: jsonBodyLimit,
  verify: (req, _res, buffer) => {
    if (String(req.originalUrl || req.url || "").startsWith("/api/webhook")) {
      req.rawBody = Buffer.from(buffer);
    }
  },
}));
app.use(express.urlencoded({ extended: false, limit: urlencodedBodyLimit }));
app.use(resolveTenantContext);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "samvid-os-backend", timestamp: new Date().toISOString() });
});

app.get("/api/metrics", async (req, res) => {
  const requiredToken = String(process.env.METRICS_BEARER_TOKEN || "").trim();
  const isProduction = process.env.NODE_ENV === "production";

  if (isProduction && !requiredToken) {
    return res.status(404).json({ message: "Route not found" });
  }

  if (!requiredToken) {
    return metricsHandler(req, res);
  }

  const authHeader = String(req.headers.authorization || "");
  const bearerToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : "";

  if (bearerToken !== requiredToken) {
    return res.status(403).json({ message: "Forbidden" });
  }

  return metricsHandler(req, res);
});

app.use("/api/public", require("./routes/publicInventory.routes"));
app.use("/api", apiLimiter);
app.use("/api/client", require("./routes/client.routes"));
app.use("/api/leads", require("./routes/lead.routes"));
app.use("/api/auth", require("./routes/auth.routes"));
app.use("/api/users", require("./routes/user.routes"));
app.use("/api/attendance", require("./routes/attendance.routes"));
app.use("/api/targets", require("./routes/target.routes"));
app.use("/api/inventory", require("./routes/inventory.routes"));
app.use("/api/inventory-request", require("./routes/inventoryRequest.routes"));
app.use("/api/webhook", require("./routes/webhook.routes"));
app.use("/api/chat", require("./routes/chat.routes"));
app.use("/api/assistant", require("./routes/officeAssistant.routes"));
app.use("/api/tasks", require("./routes/task.routes"));
app.use("/api/saas", require("./routes/saas.routes"));

app.use((req, res) => {
  res.status(404).json({
    message: "Route not found",
    requestId: req.requestId || null,
  });
});

app.use((error, req, res, _next) => {
  req.log?.error({
    requestId: req.requestId || null,
    error: error.message,
    stack: process.env.NODE_ENV === "production" ? undefined : error.stack,
    message: "Unhandled application error",
  });

  res.status(error.statusCode || 500).json({
    message: error.statusCode ? error.message : "Server error",
    requestId: req.requestId || null,
  });
});

module.exports = app;
