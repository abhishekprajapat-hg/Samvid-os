const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const app = express();

const configuredOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(helmet());
app.use(
  cors({
    origin: configuredOrigins.length ? configuredOrigins : "*",
    credentials: configuredOrigins.length > 0,
  }),
);
app.use(express.json({ limit: "1mb" }));

if (process.env.NODE_ENV !== "test") {
  app.use(morgan("dev"));
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "samvid-backend", timestamp: new Date().toISOString() });
});

app.use("/api/leads", require("./routes/lead.routes"));
app.use("/api/auth", require("./routes/auth.routes"));
app.use("/api/users", require("./routes/user.routes"));
app.use("/api/inventory", require("./routes/inventory.routes"));
app.use("/api/inventory-request", require("./routes/inventoryRequest.routes"));
app.use("/api/webhook", require("./routes/webhook.routes"));
app.use("/api/chat", require("./routes/chat.routes"));

module.exports = app;
