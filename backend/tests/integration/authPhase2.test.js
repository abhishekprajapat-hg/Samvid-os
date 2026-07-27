const jwt = require("jsonwebtoken");
const request = require("supertest");
const app = require("../../src/app");
const RefreshToken = require("../../src/models/RefreshToken");
const { createPhase2FixtureGraph } = require("../fixtures");

const login = (payload) => request(app).post("/api/auth/login").send(payload);

describe("authentication contracts", () => {
  it("authenticates with a correct password and normalizes email case", async () => {
    await createPhase2FixtureGraph();

    const res = await login({
      email: "EXECUTIVE.A@EXAMPLE.COM",
      password: "password123",
      portal: "GENERAL",
    }).expect(200);

    expect(res.body.user.email).toBe("executive.a@example.com");
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.refreshToken).toEqual(expect.any(String));
  });

  it("rejects incorrect password, missing fields, inactive users, and inactive companies", async () => {
    await createPhase2FixtureGraph();

    await login({ email: "executive.a@example.com", password: "wrong", portal: "GENERAL" })
      .expect(400);
    await login({ email: "executive.a@example.com", portal: "GENERAL" })
      .expect(400);
    await login({ password: "password123", portal: "GENERAL" })
      .expect(400);
    await login({ email: "inactive.a@example.com", password: "password123", portal: "GENERAL" })
      .expect(403);
    await login({ email: "executive.c@example.com", password: "password123", portal: "GENERAL" })
      .expect(403);
    await login({ email: "executive.archived@example.com", password: "password123", portal: "GENERAL" })
      .expect(403);
  });

  it("enforces GENERAL, ADMIN, and SUPER_ADMIN portal restrictions", async () => {
    await createPhase2FixtureGraph();

    await login({ email: "platform.super@example.com", password: "password123", portal: "SUPER_ADMIN" })
      .expect(200);
    await login({ email: "platform.super@example.com", password: "password123", portal: "ADMIN" })
      .expect(403);
    await login({ email: "platform.super@example.com", password: "password123", portal: "GENERAL" })
      .expect(403);
    await login({ email: "admin.a@example.com", password: "password123", portal: "ADMIN" })
      .expect(200);
    await login({ email: "admin.a@example.com", password: "password123", portal: "GENERAL" })
      .expect(403);
    await login({ email: "executive.a@example.com", password: "password123", portal: "ADMIN" })
      .expect(403);
    await login({ email: "executive.a@example.com", password: "password123", portal: "SUPER_ADMIN" })
      .expect(403);
  });

  it("protects /auth/me from missing, tampered, and expired access tokens", async () => {
    await createPhase2FixtureGraph();
    const auth = await login({
      email: "executive.a@example.com",
      password: "password123",
      portal: "GENERAL",
    }).expect(200);

    await request(app).get("/api/auth/me").expect(401);
    await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${auth.body.accessToken.slice(0, -3)}bad`)
      .expect(401);

    const expired = jwt.sign(
      { id: auth.body.user.id },
      process.env.JWT_SECRET,
      { expiresIn: "-1s" },
    );
    await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${expired}`)
      .expect(401);

    const me = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${auth.body.accessToken}`)
      .expect(200);
    expect(me.body.user.email).toBe("executive.a@example.com");
    expect(me.body.tenant.subdomain).toBe("company-a");
  });

  it("rotates refresh tokens, revokes token family on old-token reuse, and handles repeated logout", async () => {
    await createPhase2FixtureGraph();
    const auth = await login({
      email: "executive.a@example.com",
      password: "password123",
      portal: "GENERAL",
    }).expect(200);

    const firstRefresh = auth.body.refreshToken;
    const rotated = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken: firstRefresh })
      .expect(200);

    expect(rotated.body.refreshToken).not.toBe(firstRefresh);

    await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken: firstRefresh })
      .expect(401);

    await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken: rotated.body.refreshToken })
      .expect(401);

    const activeAfterReuse = await RefreshToken.countDocuments({ revokedAt: null });
    expect(activeAfterReuse).toBe(0);

    const fresh = await login({
      email: "executive.a@example.com",
      password: "password123",
      portal: "GENERAL",
    }).expect(200);

    await request(app)
      .post("/api/auth/logout")
      .set("Authorization", `Bearer ${fresh.body.accessToken}`)
      .send({ refreshToken: fresh.body.refreshToken })
      .expect(200);
    await request(app)
      .post("/api/auth/logout")
      .set("Authorization", `Bearer ${fresh.body.accessToken}`)
      .send({ refreshToken: fresh.body.refreshToken })
      .expect(200);
  });

  it("handles simultaneous refresh requests with one success and one authentication failure", async () => {
    await createPhase2FixtureGraph();
    const auth = await login({
      email: "executive.a@example.com",
      password: "password123",
      portal: "GENERAL",
    }).expect(200);

    const responses = await Promise.all([
      request(app).post("/api/auth/refresh").send({ refreshToken: auth.body.refreshToken }),
      request(app).post("/api/auth/refresh").send({ refreshToken: auth.body.refreshToken }),
    ]);
    const statuses = responses.map((res) => res.status).sort();

    expect(statuses).toEqual([200, 401]);
    expect(responses.every((res) => res.status !== 500)).toBe(true);
  });

  it("keeps successful auth available after repeated successful requests", async () => {
    await createPhase2FixtureGraph();

    for (let i = 0; i < 12; i += 1) {
      await login({
        email: "executive.a@example.com",
        password: "password123",
        portal: "GENERAL",
      }).expect(200);
    }
  });
});
