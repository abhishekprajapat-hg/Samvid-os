const pino = require("pino");

const loggerOptions = {
  level: process.env.LOG_LEVEL || "info",
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      'req.headers["x-billstack-api-key"]',
      'headers["X-Billstack-Api-Key"]',
      'headers["x-billstack-api-key"]',
      'config.headers["X-Billstack-Api-Key"]',
      'handoffUrl',
      'apiKey',
      "req.headers.authorization",
      "headers.authorization",
      "password",
      "token",
      "refreshToken",
      "req.body.password",
      "req.body.refreshToken",
    ],
    censor: "[REDACTED]",
  },
};

const logger = pino(loggerOptions);

module.exports = logger;
module.exports.loggerOptions = loggerOptions;
