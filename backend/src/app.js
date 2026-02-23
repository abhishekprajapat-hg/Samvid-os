const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const { attachRequestId } = require("./middleware/requestId.middleware");
const { httpLogger } = require("./middleware/httpLogger.middleware");
const { apiLimiter } = require("./middleware/rateLimit.middleware");
const { httpMetricsMiddleware, metricsHandler } = require("./observability/metrics");

const app = express();
app.disable("x-powered-by");

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
}

const configuredOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(helmet());
app.use(compression({ threshold: 1024 }));
app.use(
  cors({
    origin: configuredOrigins.length ? configuredOrigins : "*",
    credentials: configuredOrigins.length > 0,
  }),
);
app.use(attachRequestId);
app.use(httpLogger);
app.use(httpMetricsMiddleware);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "samvid-backend", timestamp: new Date().toISOString() });
});

app.get("/api/metrics", async (req, res) => {
  const requiredToken = String(process.env.METRICS_BEARER_TOKEN || "").trim();
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

app.use("/api", apiLimiter);
app.use("/api/leads", require("./routes/lead.routes"));
app.use("/api/auth", require("./routes/auth.routes"));
app.use("/api/users", require("./routes/user.routes"));
app.use("/api/targets", require("./routes/target.routes"));
app.use("/api/inventory", require("./routes/inventory.routes"));
app.use("/api/inventory-request", require("./routes/inventoryRequest.routes"));
app.use("/api/webhook", require("./routes/webhook.routes"));
app.use("/api/chat", require("./routes/chat.routes"));

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
    stack: error.stack,
    message: "Unhandled application error",
  });

  res.status(error.statusCode || 500).json({
    message: error.statusCode ? error.message : "Server error",
    requestId: req.requestId || null,
  });
});

module.exports = app;
