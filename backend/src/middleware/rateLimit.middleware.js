const rateLimit = require("express-rate-limit");

const toPositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const buildRateLimitMessage = (message) => ({
  message,
});

const createLimiter = ({
  windowMs,
  max,
  message,
  skipSuccessfulRequests = false,
}) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    skipSuccessfulRequests,
    message: buildRateLimitMessage(message),
  });

const apiLimiter = createLimiter({
  windowMs: toPositiveInt(process.env.API_RATE_LIMIT_WINDOW_MS, 60_000),
  max: toPositiveInt(process.env.API_RATE_LIMIT_MAX, 300),
  message: "Too many requests. Please retry in a moment.",
});

const authLimiter = createLimiter({
  windowMs: toPositiveInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS, 15 * 60_000),
  max: toPositiveInt(process.env.AUTH_RATE_LIMIT_MAX, 8),
  message: "Too many failed auth attempts. Please retry later.",
  skipSuccessfulRequests: true,
});

const webhookLimiter = createLimiter({
  windowMs: toPositiveInt(process.env.WEBHOOK_RATE_LIMIT_WINDOW_MS, 60_000),
  max: toPositiveInt(process.env.WEBHOOK_RATE_LIMIT_MAX, 120),
  message: "Webhook rate limit exceeded.",
});

const writeLimiter = createLimiter({
  windowMs: toPositiveInt(process.env.WRITE_RATE_LIMIT_WINDOW_MS, 60_000),
  max: toPositiveInt(process.env.WRITE_RATE_LIMIT_MAX, 80),
  message: "Too many write operations. Please retry shortly.",
});

const chatMessageLimiter = createLimiter({
  windowMs: toPositiveInt(process.env.CHAT_RATE_LIMIT_WINDOW_MS, 60_000),
  max: toPositiveInt(process.env.CHAT_RATE_LIMIT_MAX, 45),
  message: "Too many chat messages. Please slow down.",
});

module.exports = {
  apiLimiter,
  authLimiter,
  webhookLimiter,
  writeLimiter,
  chatMessageLimiter,
};
