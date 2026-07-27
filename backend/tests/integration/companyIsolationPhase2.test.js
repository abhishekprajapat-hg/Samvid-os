const request = require("supertest");

const app = require("../../src/app");
const InventoryRequest = require("../../src/models/InventoryRequest");
const {
  authHeaderFor,
  createInventory,
  createLead,
  createPhase2FixtureGraph,
} = require("../fixtures");

describe("Phase 2 company isolation", () => {
  it("does not leak Company B leads to Company A users across read, update, and assignment APIs", async () => {
    const graph = await createPhase2FixtureGraph();
    const leadB = await createLead({
      company: graph.companyB,
      createdBy: graph.companyBUsers.admin,
      assignedTo: graph.companyBUsers.executive,
    });

    const read = await request(app)
      .get(`/api/leads/${leadB._id}`)
      .set(authHeaderFor(graph.companyAUsers.admin));
    expect(read.status).toBe(404);

    const update = await request(app)
      .patch(`/api/leads/${leadB._id}`)
      .set(authHeaderFor(graph.companyAUsers.admin))
      .send({ city: "No Leak City" });
    expect(update.status).toBe(404);

    const assign = await request(app)
      .patch(`/api/leads/${leadB._id}/assign`)
      .set(authHeaderFor(graph.companyAUsers.admin))
      .send({ assignedTo: String(graph.companyAUsers.executive._id) });
    expect(assign.status).toBe(404);
  });

  it("does not allow Company A users to update, approve, or delete Company B inventory resources", async () => {
    const graph = await createPhase2FixtureGraph();
    const inventoryB = await createInventory({
      company: graph.companyB,
      createdBy: graph.companyBUsers.admin,
    });
    const requestB = await InventoryRequest.create({
      companyId: graph.companyB._id,
      inventoryId: inventoryB._id,
      requestedBy: graph.companyBUsers.executive._id,
      type: "update",
      proposedData: { price: 2500000 },
      status: "pending",
    });

    const read = await request(app)
      .get(`/api/inventory/${inventoryB._id}`)
      .set(authHeaderFor(graph.companyAUsers.admin));
    expect(read.status).toBe(404);

    const update = await request(app)
      .patch(`/api/inventory/${inventoryB._id}`)
      .set(authHeaderFor(graph.companyAUsers.admin))
      .send({ price: 3000000 });
    expect(update.status).toBe(404);

    const approval = await request(app)
      .patch(`/api/inventory-request/${requestB._id}/approve`)
      .set(authHeaderFor(graph.companyAUsers.admin))
      .send({ decisionNote: "Cross-company attempt" });
    expect(approval.status).toBe(404);

    const deletion = await request(app)
      .delete(`/api/inventory/${inventoryB._id}`)
      .set(authHeaderFor(graph.companyAUsers.admin));
    expect(deletion.status).toBe(404);
  });

  it("rejects forged companyId values in tenant-scoped write bodies", async () => {
    const graph = await createPhase2FixtureGraph();

    const forged = await request(app)
      .post("/api/inventory-request")
      .set(authHeaderFor(graph.companyAUsers.executive))
      .send({
        companyId: String(graph.companyB._id),
        requestType: "CREATE",
        payload: {
          projectName: "Forged Tenant",
          towerName: "A",
          unitNumber: "101",
          price: 100000,
          type: "Sale",
          category: "Office",
          location: "Indore",
        },
      });

    expect(forged.status).toBe(403);
  });

  it("allows Super Admin platform visibility while tenant users remain isolated", async () => {
    const graph = await createPhase2FixtureGraph();
    const inventoryB = await createInventory({
      company: graph.companyB,
      createdBy: graph.companyBUsers.admin,
    });

    const tenantRead = await request(app)
      .get(`/api/inventory/${inventoryB._id}`)
      .set(authHeaderFor(graph.companyAUsers.manager));
    expect(tenantRead.status).toBe(404);

    const platformRead = await request(app)
      .get(`/api/inventory/${inventoryB._id}`)
      .set(authHeaderFor(graph.platformSuperAdmin));
    expect(platformRead.status).toBe(200);

    const usage = await request(app)
      .get(`/api/saas/usage/${graph.companyB._id}`)
      .set(authHeaderFor(graph.platformSuperAdmin));
    expect(usage.status).toBe(200);
    expect(String(usage.body.company.id)).toBe(String(graph.companyB._id));
  });
});
