const request = require("supertest");
const app = require("../../src/app");

describe("baseline app behavior", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalMetricsToken = process.env.METRICS_BEARER_TOKEN;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalMetricsToken === undefined) {
      delete process.env.METRICS_BEARER_TOKEN;
    } else {
      process.env.METRICS_BEARER_TOKEN = originalMetricsToken;
    }
  });

  it("serves /api/health", async () => {
    const res = await request(app).get("/api/health").expect(200);

    expect(res.body).toMatchObject({
      ok: true,
      service: "samvid-os-backend",
    });
    expect(res.body.timestamp).toEqual(expect.any(String));
  });

  it("serves /api/client/health", async () => {
    const res = await request(app).get("/api/client/health").expect(200);

    expect(res.body).toMatchObject({ ok: true });
  });

  it("returns request IDs on responses and unknown routes", async () => {
    const res = await request(app)
      .get("/api/does-not-exist")
      .set("x-request-id", "req-test-123")
      .expect(404);

    expect(res.headers["x-request-id"]).toBe("req-test-123");
    expect(res.body).toMatchObject({
      message: "Route not found",
      requestId: "req-test-123",
    });
  });

  it("sets security headers", async () => {
    const res = await request(app).get("/api/health").expect(200);

    expect(res.headers["x-powered-by"]).toBeUndefined();
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["content-security-policy"]).toContain("default-src 'self'");
  });

  it("allows metrics without token outside production", async () => {
    process.env.NODE_ENV = "test";
    delete process.env.METRICS_BEARER_TOKEN;

    const res = await request(app).get("/api/metrics").expect(200);

    expect(res.headers["content-type"]).toContain("text/plain");
    expect(res.text).toContain("process_cpu_user_seconds_total");
  });

  it("hides metrics in production when no token is configured", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.METRICS_BEARER_TOKEN;

    const res = await request(app).get("/api/metrics").expect(404);

    expect(res.body).toMatchObject({ message: "Route not found" });
  });

  it("requires the configured metrics token in production", async () => {
    process.env.NODE_ENV = "production";
    process.env.METRICS_BEARER_TOKEN = "metrics-secret";

    await request(app).get("/api/metrics").expect(403);

    const res = await request(app)
      .get("/api/metrics")
      .set("Authorization", "Bearer metrics-secret")
      .expect(200);

    expect(res.text).toContain("process_cpu_user_seconds_total");
  });

  it("rejects unconfigured CORS origins in production with a controlled response", async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    try {
      const denied = await request(app)
        .get("/api/health")
        .set("Origin", "https://evil.example.com")
        .expect(403);

      expect(denied.body.message).toBe("CORS origin not allowed");
      expect(denied.headers["access-control-allow-origin"]).toBeUndefined();

      const allowed = await request(app)
        .get("/api/health")
        .set("Origin", "http://localhost:5173")
        .expect(200);

      expect(allowed.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });
});
