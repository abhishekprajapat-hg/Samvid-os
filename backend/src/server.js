require("dotenv").config();
const http = require("http");
const { Server } = require("socket.io");
const app = require("./app");
const connectDB = require("./config/db");
const { registerChatSocketHandlers } = require("./socket/chat.socket");
const { runAutoCheckoutSweep } = require("./controllers/attendance.controller");
const { runExpiredBookingSweep } = require("./services/coworkingBooking.service");
const { runContractLifecycleSweep } = require("./services/coworkingContract.service");
const { runInvoiceOverdueSweep } = require("./services/coworkingInvoice.service");
const logger = require("./config/logger");

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

const isLoopbackOrigin = (origin) =>
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(String(origin || "").trim());

const isLanOrigin = (origin) =>
  /^https?:\/\/192\.168\.\d{1,3}\.\d{1,3}(:\d+)?$/i.test(String(origin || "").trim());

const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  if (configuredOrigins.includes("*")) return true;
  if (configuredOrigins.includes(origin)) return true;
  if (isLoopbackOrigin(origin) || isLanOrigin(origin)) return true;
  return false;
};

const io = new Server(httpServer, {
  pingInterval: toPositiveInt(process.env.SOCKET_PING_INTERVAL_MS, 25000),
  pingTimeout: toPositiveInt(process.env.SOCKET_PING_TIMEOUT_MS, 20000),
  maxHttpBufferSize: toPositiveInt(
    process.env.SOCKET_MAX_HTTP_BUFFER_BYTES,
    1_000_000,
  ),
  connectionStateRecovery: {
    maxDisconnectionDuration: toPositiveInt(
      process.env.SOCKET_RECOVERY_DURATION_MS,
      120000,
    ),
    skipMiddlewares: false,
  },
  cors: {
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        callback(null, origin || true);
        return;
      }
      callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST"],
    credentials: true,
  },
});

app.set("io", io);
registerChatSocketHandlers(io);

const startAttendanceAutoCheckoutSweep = () => {
  if (String(process.env.ATTENDANCE_AUTO_CHECKOUT_SWEEP_ENABLED || "true").toLowerCase() === "false") {
    return;
  }

  const intervalMs = Math.max(
    60 * 1000,
    toPositiveInt(process.env.ATTENDANCE_AUTO_CHECKOUT_SWEEP_INTERVAL_MS, 5 * 60 * 1000),
  );
  let isRunning = false;

  const runSweep = async () => {
    if (isRunning) return;
    isRunning = true;
    try {
      const updatedCount = await runAutoCheckoutSweep();
      if (updatedCount > 0) {
        logger.info({
          updatedCount,
          message: "Attendance auto checkout sweep completed",
        });
      }
    } catch (error) {
      logger.error({
        error: error.message,
        message: "Attendance auto checkout sweep failed",
      });
    } finally {
      isRunning = false;
    }
  };

  const timer = setInterval(runSweep, intervalMs);
  if (typeof timer.unref === "function") timer.unref();
  runSweep();
};

const startBookingExpirySweep = () => {
  if (String(process.env.BOOKING_EXPIRY_SWEEP_ENABLED || "true").toLowerCase() === "false") {
    return;
  }

  const intervalMs = Math.max(
    60 * 1000,
    toPositiveInt(process.env.BOOKING_EXPIRY_SWEEP_INTERVAL_MS, 5 * 60 * 1000),
  );
  let isRunning = false;

  const runSweep = async () => {
    if (isRunning) return;
    isRunning = true;
    try {
      const updatedCount = await runExpiredBookingSweep();
      if (updatedCount > 0) {
        logger.info({
          updatedCount,
          message: "Coworking booking expiry sweep completed",
        });
      }
    } catch (error) {
      logger.error({
        error: error.message,
        message: "Coworking booking expiry sweep failed",
      });
    } finally {
      isRunning = false;
    }
  };

  const timer = setInterval(runSweep, intervalMs);
  if (typeof timer.unref === "function") timer.unref();
  runSweep();
};

const startContractLifecycleSweep = () => {
  if (String(process.env.CONTRACT_LIFECYCLE_SWEEP_ENABLED || "true").toLowerCase() === "false") {
    return;
  }

  const intervalMs = Math.max(
    60 * 1000,
    toPositiveInt(process.env.CONTRACT_LIFECYCLE_SWEEP_INTERVAL_MS, 60 * 60 * 1000),
  );
  let isRunning = false;

  const runSweep = async () => {
    if (isRunning) return;
    isRunning = true;
    try {
      const { toExpiring, expired } = await runContractLifecycleSweep();
      if (toExpiring > 0 || expired > 0) {
        logger.info({ toExpiring, expired, message: "Coworking contract lifecycle sweep completed" });
      }
    } catch (error) {
      logger.error({ error: error.message, message: "Coworking contract lifecycle sweep failed" });
    } finally {
      isRunning = false;
    }
  };

  const timer = setInterval(runSweep, intervalMs);
  if (typeof timer.unref === "function") timer.unref();
  runSweep();
};

const startInvoiceOverdueSweep = () => {
  if (String(process.env.INVOICE_OVERDUE_SWEEP_ENABLED || "true").toLowerCase() === "false") {
    return;
  }

  const intervalMs = Math.max(
    60 * 1000,
    toPositiveInt(process.env.INVOICE_OVERDUE_SWEEP_INTERVAL_MS, 60 * 60 * 1000),
  );
  let isRunning = false;

  const runSweep = async () => {
    if (isRunning) return;
    isRunning = true;
    try {
      const updatedCount = await runInvoiceOverdueSweep();
      if (updatedCount > 0) {
        logger.info({ updatedCount, message: "Coworking invoice overdue sweep completed" });
      }
    } catch (error) {
      logger.error({ error: error.message, message: "Coworking invoice overdue sweep failed" });
    } finally {
      isRunning = false;
    }
  };

  const timer = setInterval(runSweep, intervalMs);
  if (typeof timer.unref === "function") timer.unref();
  runSweep();
};

const startAttendanceViolationSweep = () => {
 let running = false;
 const sweep = async () => { if (running) return; running = true; try { await require("./services/attendanceViolation.service").runViolationSweep(); } catch (error) { logger.error({ error: error.message, message: "Attendance violation sweep failed" }); } finally { running = false; } };
 const timer = setInterval(sweep, 60 * 60 * 1000); timer.unref(); sweep();
};
const bootstrap = async () => {
  await connectDB();
  startAttendanceAutoCheckoutSweep();
  startAttendanceViolationSweep();
  startBookingExpirySweep();
  startContractLifecycleSweep();
  startInvoiceOverdueSweep();
  httpServer.listen(PORT, () => {
    logger.info({ port: PORT, message: "Server started" });
  });
};

bootstrap().catch((error) => {
  logger.error({
    error: error.message,
    message: "Server bootstrap failed",
  });
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  logger.error({ error: String(reason), message: "Unhandled promise rejection" });
});

process.on("uncaughtException", (error) => {
  logger.error({ error: error.message, message: "Uncaught exception" });
});
