const pinoHttp = require("pino-http");
const logger = require("../config/logger");

const httpLogger = pinoHttp({
  logger,
  genReqId: (req) => req.requestId,
  autoLogging: {
    ignore: (req) =>
      req.url === "/api/health" || req.url === "/api/metrics",
  },
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return "error";
    return "silent";
  },
});

module.exports = {
  httpLogger,
};
