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

const io = new Server(httpServer, {
  cors: {
    origin: configuredOrigins.length ? configuredOrigins : "*",
    methods: ["GET", "POST"],
    credentials: configuredOrigins.length > 0,
  },
});

app.set("io", io);
registerChatSocketHandlers(io);

httpServer.listen(PORT, () => {
  logger.info({ port: PORT, message: "Server started" });
});

process.on("unhandledRejection", (reason) => {
  logger.error({ error: String(reason), message: "Unhandled promise rejection" });
});

process.on("uncaughtException", (error) => {
  logger.error({ error: error.message, message: "Uncaught exception" });
});
