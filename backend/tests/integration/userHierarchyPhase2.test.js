const request = require("supertest");

const app = require("../../src/app");
const UserDeleteRequest = require("../../src/models/UserDeleteRequest");
const { USER_ROLES } = require("../../src/constants/role.constants");
const {
  authHeaderFor,
  createPhase2FixtureGraph,
  createUser,
} = require("../fixtures");

describe("Phase 2 user hierarchy and management", () => {
  it("creates users only with valid parent roles and rejects duplicate or inactive parents", async () => {
    const graph = await createPhase2FixtureGraph();

    const valid = await request(app)
      .post("/api/users/create")
      .set(authHeaderFor(graph.companyAUsers.admin))
      .send({
        name: "Created Executive",
        email: "created.executive@example.com",
        phone: "9999911111",
        password: "password123",
        role: USER_ROLES.EXECUTIVE,
        reportingToId: String(graph.companyAUsers.manager._id),
      });
    expect(valid.status).toBe(201);
    expect(valid.body.user.parentId).toBe(String(graph.companyAUsers.manager._id));

    const invalidParent = await request(app)
      .post("/api/users/create")
      .set(authHeaderFor(graph.companyAUsers.admin))
      .send({
        name: "Bad Parent",
        email: "bad.parent@example.com",
        phone: "9999911112",
        password: "password123",
        role: USER_ROLES.EXECUTIVE,
        reportingToId: String(graph.companyAUsers.admin._id),
      });
    expect(invalidParent.status).toBe(400);

    const inactiveParent = await request(app)
      .post("/api/users/create")
      .set(authHeaderFor(graph.companyAUsers.admin))
      .send({
        name: "Inactive Parent",
        email: "inactive.parent.child@example.com",
        phone: "9999911113",
        password: "password123",
        role: USER_ROLES.EXECUTIVE,
        reportingToId: String(graph.companyAUsers.inactiveExecutive._id),
      });
    expect(inactiveParent.status).toBe(400);

    const duplicate = await request(app)
      .post("/api/users/create")
      .set(authHeaderFor(graph.companyAUsers.admin))
      .send({
        name: "Duplicate Email",
        email: "created.executive@example.com",
        phone: "9999911114",
        password: "password123",
        role: USER_ROLES.EXECUTIVE,
        reportingToId: String(graph.companyAUsers.manager._id),
      });
    expect(duplicate.status).toBe(400);
  });

  it("keeps team visibility and user updates inside the requesting company", async () => {
    const graph = await createPhase2FixtureGraph();

    const team = await request(app)
      .get("/api/users")
      .set(authHeaderFor(graph.companyAUsers.manager));
    expect(team.status).toBe(200);
    const serialized = JSON.stringify(team.body);
    expect(serialized).toContain(String(graph.companyAUsers.executive._id));
    expect(serialized).not.toContain(String(graph.companyBUsers.executive._id));

    const crossCompanyUpdate = await request(app)
      .patch(`/api/users/${graph.companyBUsers.executive._id}`)
      .set(authHeaderFor(graph.companyAUsers.admin))
      .send({ name: "Should Not Update" });
    expect(crossCompanyUpdate.status).toBe(404);
  });

  it("updates designations and Channel Partner inventory access through admin tools", async () => {
    const graph = await createPhase2FixtureGraph();

    const designation = await request(app)
      .patch(`/api/users/${graph.companyAUsers.executive._id}/designation`)
      .set(authHeaderFor(graph.companyAUsers.admin))
      .send({
        role: USER_ROLES.FIELD_EXECUTIVE,
        reportingToId: String(graph.companyAUsers.manager._id),
      });
    expect(designation.status).toBe(200);
    expect(designation.body.user.role).toBe(USER_ROLES.FIELD_EXECUTIVE);

    const inventoryAccess = await request(app)
      .patch(`/api/users/${graph.companyAUsers.channelPartnerNoInventory._id}/channel-partner/inventory-access`)
      .set(authHeaderFor(graph.companyAUsers.admin))
      .send({ canViewInventory: true });
    expect(inventoryAccess.status).toBe(200);
    expect(inventoryAccess.body.user.canViewInventory).toBe(true);
  });

  it("enforces live-location role permissions and coordinate validation", async () => {
    const graph = await createPhase2FixtureGraph();

    const valid = await request(app)
      .patch("/api/users/location")
      .set(authHeaderFor(graph.companyAUsers.fieldExecutive))
      .send({ lat: 22.7196, lng: 75.8577, accuracy: 12 });
    expect(valid.status).toBe(200);
    expect(valid.body.user.liveLocation.lat).toBe(22.7196);

    const forbidden = await request(app)
      .patch("/api/users/location")
      .set(authHeaderFor(graph.companyAUsers.manager))
      .send({ lat: 22.7196, lng: 75.8577 });
    expect(forbidden.status).toBe(403);

    const invalid = await request(app)
      .patch("/api/users/location")
      .set(authHeaderFor(graph.companyAUsers.fieldExecutive))
      .send({ lat: 100, lng: 75.8577 });
    expect(invalid.status).toBe(400);
  });

  it("rebalances executives across active managers", async () => {
    const graph = await createPhase2FixtureGraph();
    const secondManager = await createUser({
      company: graph.companyA,
      role: USER_ROLES.MANAGER,
      parentId: graph.companyAUsers.admin._id,
      email: "second.manager.a@example.com",
    });
    await createUser({
      company: graph.companyA,
      role: USER_ROLES.EXECUTIVE,
      parentId: secondManager._id,
      email: "extra.executive.a@example.com",
    });

    const response = await request(app)
      .post("/api/users/rebalance-executives")
      .set(authHeaderFor(graph.companyAUsers.admin))
      .send({});

    expect(response.status).toBe(200);
    expect(response.body.distribution.length).toBeGreaterThanOrEqual(2);
    const counts = response.body.distribution.map((row) => row.executives);
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
  });

  it("supports user delete request approval, rejection, and repeated decision protection", async () => {
    const graph = await createPhase2FixtureGraph();

    const rejectTarget = await createUser({
      company: graph.companyA,
      role: USER_ROLES.EXECUTIVE,
      parentId: graph.companyAUsers.manager._id,
      email: "delete.reject.target@example.com",
    });
    const rejectRequest = await request(app)
      .post(`/api/users/${rejectTarget._id}/delete-request`)
      .set(authHeaderFor(graph.companyAUsers.manager))
      .send({ reason: "No longer needed" });
    expect(rejectRequest.status).toBe(201);

    const rejected = await request(app)
      .patch(`/api/users/delete-requests/${rejectRequest.body.request._id}/review`)
      .set(authHeaderFor(graph.companyAUsers.admin))
      .send({ action: "REJECTED", reviewNote: "Keep user" });
    expect(rejected.status).toBe(200);
    expect(rejected.body.request.status).toBe("REJECTED");

    const repeated = await request(app)
      .patch(`/api/users/delete-requests/${rejectRequest.body.request._id}/review`)
      .set(authHeaderFor(graph.companyAUsers.admin))
      .send({ action: "APPROVED" });
    expect(repeated.status).toBe(400);

    const approveTarget = await createUser({
      company: graph.companyA,
      role: USER_ROLES.EXECUTIVE,
      parentId: graph.companyAUsers.manager._id,
      email: "delete.approve.target@example.com",
    });
    const pending = await UserDeleteRequest.create({
      companyId: graph.companyA._id,
      requestedBy: graph.companyAUsers.manager._id,
      targetUser: approveTarget._id,
      reason: "Approved path",
      snapshot: { name: approveTarget.name, email: approveTarget.email, role: approveTarget.role },
    });

    const approved = await request(app)
      .patch(`/api/users/delete-requests/${pending._id}/review`)
      .set(authHeaderFor(graph.companyAUsers.admin))
      .send({ action: "APPROVED" });
    expect(approved.status).toBe(200);
    expect(approved.body.request.status).toBe("APPROVED");
  });
});
