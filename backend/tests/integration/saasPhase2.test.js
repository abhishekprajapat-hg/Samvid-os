const request = require("supertest");

const app = require("../../src/app");
const RefreshToken = require("../../src/models/RefreshToken");
const TenantSubscription = require("../../src/models/TenantSubscription");
const {
  authHeaderFor,
  createPhase2FixtureGraph,
} = require("../fixtures");

const login = (email, password = "password123", portal = "ADMIN") =>
  request(app)
    .post("/api/auth/login")
    .send({ email, password, portal });

describe("Phase 2 SaaS platform controls", () => {
  it("creates companies and rejects duplicate or invalid subdomains", async () => {
    const graph = await createPhase2FixtureGraph();

    const created = await request(app)
      .post("/api/saas/companies")
      .set(authHeaderFor(graph.platformSuperAdmin))
      .send({
        name: "Phase 2 Tenant",
        subdomain: "phase-2-tenant",
        adminName: "Phase Admin",
        adminEmail: "phase.admin@example.com",
        adminPassword: "password123",
      });
    expect(created.status).toBe(201);
    expect(created.body.company.subdomain).toBe("phase-2-tenant");
    expect(JSON.stringify(created.body)).not.toContain("password123");

    const duplicate = await request(app)
      .post("/api/saas/companies")
      .set(authHeaderFor(graph.platformSuperAdmin))
      .send({
        name: "Duplicate Tenant",
        subdomain: "phase-2-tenant",
        adminName: "Duplicate Admin",
        adminEmail: "duplicate.phase.admin@example.com",
        adminPassword: "password123",
      });
    expect(duplicate.status).toBe(400);

    const invalid = await request(app)
      .post("/api/saas/companies")
      .set(authHeaderFor(graph.platformSuperAdmin))
      .send({
        name: "Invalid Tenant",
        subdomain: "!!!",
        adminName: "Invalid Admin",
        adminEmail: "invalid.phase.admin@example.com",
        adminPassword: "password123",
      });
    expect(invalid.status).toBe(400);
  });

  it("suspends, reactivates, archives, and deletes tenants through Super Admin only", async () => {
    const graph = await createPhase2FixtureGraph();

    for (const status of ["SUSPENDED", "ACTIVE", "ARCHIVED"]) {
      const response = await request(app)
        .patch(`/api/saas/companies/${graph.companyA._id}`)
        .set(authHeaderFor(graph.platformSuperAdmin))
        .send({ status });
      expect(response.status).toBe(200);
      expect(response.body.company.status).toBe(status);
    }

    const forbidden = await request(app)
      .patch(`/api/saas/companies/${graph.companyB._id}`)
      .set(authHeaderFor(graph.companyAUsers.admin))
      .send({ status: "SUSPENDED" });
    expect(forbidden.status).toBe(403);

    const deleted = await request(app)
      .delete(`/api/saas/companies/${graph.companyB._id}`)
      .set(authHeaderFor(graph.platformSuperAdmin));
    expect(deleted.status).toBe(200);
    expect(deleted.body.summary.users).toBeGreaterThan(0);
  });

  it("resets tenant admin password and revokes active refresh tokens", async () => {
    const graph = await createPhase2FixtureGraph();
    const beforeLogin = await login(graph.companyAUsers.admin.email, "password123", "ADMIN");
    expect(beforeLogin.status).toBe(200);
    const refreshToken = beforeLogin.body.refreshToken;

    const activeBefore = await RefreshToken.countDocuments({
      userId: graph.companyAUsers.admin._id,
      revokedAt: null,
    });
    expect(activeBefore).toBeGreaterThan(0);

    const reset = await request(app)
      .post(`/api/saas/companies/${graph.companyA._id}/admin/reset-password`)
      .set(authHeaderFor(graph.platformSuperAdmin))
      .send({ newPassword: "newPassword123" });
    expect(reset.status).toBe(200);
    expect(JSON.stringify(reset.body)).not.toContain("newPassword123");

    const oldRefresh = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken });
    expect(oldRefresh.status).toBe(401);

    const afterLogin = await login(graph.companyAUsers.admin.email, "newPassword123", "ADMIN");
    expect(afterLogin.status).toBe(200);
  });

  it("creates, lists, updates plans and assigns exactly one current subscription across supported states", async () => {
    const graph = await createPhase2FixtureGraph();

    const plan = await request(app)
      .post("/api/saas/plans")
      .set(authHeaderFor(graph.platformSuperAdmin))
      .send({
        code: "PHASE2",
        name: "Phase 2 Plan",
        pricing: { monthly: 999 },
        limits: { users: 25 },
        features: ["tests"],
      });
    expect(plan.status).toBe(201);

    const list = await request(app)
      .get("/api/saas/plans")
      .set(authHeaderFor(graph.platformSuperAdmin));
    expect(list.status).toBe(200);
    expect(list.body.plans.some((row) => row.code === "PHASE2")).toBe(true);

    const updated = await request(app)
      .patch(`/api/saas/plans/${plan.body.plan.id}`)
      .set(authHeaderFor(graph.platformSuperAdmin))
      .send({ pricing: { monthly: 1299 }, isActive: true });
    expect(updated.status).toBe(200);
    expect(updated.body.plan.pricing.monthly).toBe(1299);

    for (const status of ["TRIAL", "ACTIVE", "PAST_DUE", "CANCELED", "EXPIRED"]) {
      const assigned = await request(app)
        .post("/api/saas/subscriptions/assign")
        .set(authHeaderFor(graph.platformSuperAdmin))
        .send({
          companyId: String(graph.companyA._id),
          planId: String(plan.body.plan.id),
          status,
          seats: 20,
        });
      expect(assigned.status).toBe(201);
      expect(assigned.body.subscription.status).toBe(status);

      const currentCount = await TenantSubscription.countDocuments({
        companyId: graph.companyA._id,
        isCurrent: true,
      });
      expect(currentCount).toBe(1);
    }
  });

  it("reports usage and analytics without tenant secret leakage", async () => {
    const graph = await createPhase2FixtureGraph();

    const settings = await request(app)
      .patch("/api/saas/tenant/settings")
      .set(authHeaderFor(graph.companyAUsers.admin))
      .send({ settings: { timezone: "Asia/Kolkata" } });
    expect(settings.status).toBe(200);
    expect(settings.body.company.settings.timezone).toBe("Asia/Kolkata");

    const rawSecret = "meta-secret-phase-2";
    const meta = await request(app)
      .patch("/api/saas/tenant/meta")
      .set(authHeaderFor(graph.companyAUsers.admin))
      .send({ accessToken: rawSecret });
    expect(meta.status).toBe(200);
    expect(meta.body.integration.accessTokenConfigured).toBe(true);
    expect(JSON.stringify(meta.body)).not.toContain(rawSecret);

    const getMeta = await request(app)
      .get("/api/saas/tenant/meta")
      .set(authHeaderFor(graph.companyAUsers.admin));
    expect(getMeta.status).toBe(200);
    expect(JSON.stringify(getMeta.body)).not.toContain(rawSecret);

    const usage = await request(app)
      .get(`/api/saas/usage/${graph.companyA._id}`)
      .set(authHeaderFor(graph.platformSuperAdmin));
    expect(usage.status).toBe(200);
    expect(usage.body.usage.totalUsers).toBeGreaterThan(0);

    const analytics = await request(app)
      .get("/api/saas/analytics/global")
      .set(authHeaderFor(graph.platformSuperAdmin));
    expect(analytics.status).toBe(200);
    expect(analytics.body.overview.totalCompanies).toBeGreaterThan(0);
    expect(JSON.stringify(analytics.body)).not.toContain(rawSecret);
  });
});
