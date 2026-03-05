require("dotenv").config();
const http = require("http");
const { Server } = require("socket.io");
const app = require("./app");
const connectDB = require("./config/db");
const { registerChatSocketHandlers } = require("./socket/chat.socket");
const logger = require("./config/logger");

connectDB();

const PORT = process.env.PORT || 5000;
const toPositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};
const isLocalDevOrigin = (origin = "") =>
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(String(origin).trim());

const httpServer = http.createServer(app);
httpServer.keepAliveTimeout = toPositiveInt(process.env.HTTP_KEEP_ALIVE_TIMEOUT_MS, 65000);
httpServer.headersTimeout = toPositiveInt(
  process.env.HTTP_HEADERS_TIMEOUT_MS,
  66000,
);
httpServer.requestTimeout = toPositiveInt(process.env.HTTP_REQUEST_TIMEOUT_MS, 60000);
httpServer.maxRequestsPerSocket = toPositiveInt(
  process.env.HTTP_MAX_REQUESTS_PER_SOCKET,
  1000,
);

const configuredOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const configuredOriginSet = new Set(configuredOrigins);

const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (!configuredOrigins.length) {
        callback(null, true);
        return;
      }

      if (configuredOriginSet.has(origin) || isLocalDevOrigin(origin)) {
        callback(null, true);
        return;
      }

      callback(null, false);
    },
    methods: ["GET", "POST"],
    credentials: true,
  },
});

app.set("io", io);
registerChatSocketHandlers(io);

httpServer.on("error", (error) => {
  if (error?.code === "EADDRINUSE") {
    logger.error({ port: PORT, error: `Port ${PORT} is already in use`, message: "Server failed to start" });
    process.exit(1);
    return;
  }
  logger.error({ error: error?.message || String(error), message: "HTTP server error" });
  process.exit(1);
});

httpServer.listen(PORT, () => {
  logger.info({ port: PORT, message: "Server started" });
});

process.on("unhandledRejection", (reason) => {
  logger.error({ error: String(reason), message: "Unhandled promise rejection" });
});

process.on("uncaughtException", (error) => {
  logger.error({ error: error.message, message: "Uncaught exception" });
  process.exit(1);
});
