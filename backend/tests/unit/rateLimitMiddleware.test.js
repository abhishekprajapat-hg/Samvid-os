const express = require("express");
const request = require("supertest");

const originalAuthRateLimitMax = process.env.AUTH_RATE_LIMIT_MAX;
const originalAuthRateLimitWindowMs = process.env.AUTH_RATE_LIMIT_WINDOW_MS;

const buildAuthLimiterApp = () => {
  vi.resetModules();
  const { authLimiter } = require("../../src/middleware/rateLimit.middleware");

  const app = express();
  app.use(express.json());
  app.post("/login", authLimiter, (req, res) => {
    if (req.body?.success) {
      return res.status(200).json({ ok: true });
    }
    return res.status(400).json({ message: "Invalid credentials" });
  });
  return app;
};

describe("auth rate limiter", () => {
  beforeEach(() => {
    process.env.AUTH_RATE_LIMIT_MAX = "2";
    process.env.AUTH_RATE_LIMIT_WINDOW_MS = "60000";
  });

  afterEach(() => {
    if (originalAuthRateLimitMax === undefined) {
      delete process.env.AUTH_RATE_LIMIT_MAX;
    } else {
      process.env.AUTH_RATE_LIMIT_MAX = originalAuthRateLimitMax;
    }

    if (originalAuthRateLimitWindowMs === undefined) {
      delete process.env.AUTH_RATE_LIMIT_WINDOW_MS;
    } else {
      process.env.AUTH_RATE_LIMIT_WINDOW_MS = originalAuthRateLimitWindowMs;
    }
    vi.resetModules();
  });

  it("returns a controlled 429 after repeated failed auth attempts", async () => {
    const app = buildAuthLimiterApp();

    await request(app).post("/login").send({}).expect(400);
    await request(app).post("/login").send({}).expect(400);
    const res = await request(app).post("/login").send({}).expect(429);

    expect(res.body).toEqual({
      message: "Too many failed auth attempts. Please retry later.",
    });
  });
});
