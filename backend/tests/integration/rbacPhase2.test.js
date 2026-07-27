const request = require("supertest");
const app = require("../../src/app");
const { authHeaderFor, createPhase2FixtureGraph } = require("../fixtures");

const roleEntries = (graph) => ({
  SUPER_ADMIN: graph.platformSuperAdmin,
  ADMIN: graph.companyAUsers.admin,
  MANAGER: graph.companyAUsers.manager,
  INSIDE_EXECUTIVE: graph.companyAUsers.insideExecutive,
  EXECUTIVE: graph.companyAUsers.executive,
  FIELD_EXECUTIVE: graph.companyAUsers.fieldExecutive,
  PRODUCTION_EXECUTIVE: graph.companyAUsers.productionExecutive,
  CHANNEL_PARTNER: graph.companyAUsers.channelPartnerWithInventory,
});

const cases = [
  { method: "get", path: "/api/users", allow: ["SUPER_ADMIN", "ADMIN", "MANAGER"] },
  { method: "post", path: "/api/users/create", allow: ["ADMIN", "MANAGER"], body: { name: "Temp User", email: "temp.unique@example.com", phone: "1", password: "password123", role: "EXECUTIVE" } },
  { method: "get", path: "/api/inventory", allow: ["SUPER_ADMIN", "ADMIN", "MANAGER", "INSIDE_EXECUTIVE", "EXECUTIVE", "FIELD_EXECUTIVE", "CHANNEL_PARTNER"] },
  { method: "get", path: "/api/attendance/daily", allow: ["ADMIN", "MANAGER"] },
  { method: "get", path: "/api/saas/companies", allow: ["SUPER_ADMIN"] },
  { method: "get", path: "/api/saas/tenant/settings", allow: ["ADMIN", "MANAGER"] },
  { method: "get", path: "/api/tasks", allow: ["SUPER_ADMIN", "ADMIN", "MANAGER", "INSIDE_EXECUTIVE", "EXECUTIVE", "FIELD_EXECUTIVE", "PRODUCTION_EXECUTIVE", "CHANNEL_PARTNER"] },
];

describe("RBAC endpoint matrix", () => {
  it.each(cases)("$method $path enforces allowed and forbidden roles", async (row) => {
    const graph = await createPhase2FixtureGraph();
    const usersByRole = roleEntries(graph);

    await request(app)[row.method](row.path).expect(401);
    await request(app)[row.method](row.path)
      .set("Authorization", "Bearer invalid-token")
      .send(row.body || {})
      .expect(401);

    for (const [role, user] of Object.entries(usersByRole)) {
      const response = await request(app)[row.method](row.path)
        .set(authHeaderFor(user))
        .send(row.body ? { ...row.body, email: `${role.toLowerCase()}.${Date.now()}@example.com` } : {});

      if (row.allow.includes(role)) {
        expect(response.status, `${role} should access ${row.path}`).not.toBe(401);
        expect(response.status, `${role} should access ${row.path}`).not.toBe(403);
      } else {
        expect(response.status, `${role} should be forbidden from ${row.path}`).toBe(403);
      }
    }
  });
});
