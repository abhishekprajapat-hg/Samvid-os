const request = require("supertest");

const app = require("../../src/app");
const Inventory = require("../../src/models/Inventory");
const Lead = require("../../src/models/Lead");
const LeadActivity = require("../../src/models/leadActivity.model");
const LeadDiary = require("../../src/models/leadDiary.model");
const LeadStatusRequest = require("../../src/models/LeadStatusRequest");
const {
  authHeaderFor,
  createInventory,
  createLead,
  createLeadDiaryEntry,
  createPhase2FixtureGraph,
} = require("../fixtures");

const validClosePayload = () => ({
  status: "CLOSED",
  dealPayment: {
    mode: "UPI",
    paymentType: "FULL",
    paymentReference: "UPI123",
  },
  brokerage: {
    brokerageReceived: 100000,
    brokerageDistributed: 100000,
    brokerageDistributionBreakdown: [
      { recipientName: "Broker", recipientType: "BROKER", amount: 100000 },
    ],
  },
  closureDocuments: [
    {
      url: "https://example.com/closure.pdf",
      mimeType: "application/pdf",
      name: "closure.pdf",
      size: 1200,
    },
  ],
});

describe("lead lifecycle properties, statuses, site visits, closure and diary", () => {
  it("adds, selects, removes properties and rejects duplicates/cross-company/unavailable inventory", async () => {
    const graph = await createPhase2FixtureGraph();
    const lead = await createLead({
      company: graph.companyA,
      createdBy: graph.companyAUsers.admin,
      assignedTo: graph.companyAUsers.executive,
    });
    const inventory = await createInventory({
      company: graph.companyA,
      createdBy: graph.companyAUsers.admin,
      projectName: "Selected Project",
      city: "Ujjain",
      siteLocation: { lat: 23.1765, lng: 75.7885 },
    });
    const otherCompanyInventory = await createInventory({
      company: graph.companyB,
      createdBy: graph.companyBUsers.admin,
    });
    const blocked = await createInventory({
      company: graph.companyA,
      createdBy: graph.companyAUsers.admin,
      status: "Blocked",
      reservationLeadId: lead._id,
      reservationReason: "Reserved",
    });

    const linked = await request(app)
      .patch(`/api/leads/${lead._id}/properties`)
      .set(authHeaderFor(graph.companyAUsers.admin))
      .send({ inventoryId: String(inventory._id) })
      .expect(200);
    expect(
      linked.body.lead.relatedInventoryIds.map((row) => String(row?._id || row)),
    ).toContain(String(inventory._id));

    const duplicate = await request(app)
      .patch(`/api/leads/${lead._id}/properties`)
      .set(authHeaderFor(graph.companyAUsers.admin))
      .send({ inventoryId: String(inventory._id) })
      .expect(200);
    expect(duplicate.body.message).toMatch(/already linked/i);

    const selected = await request(app)
      .patch(`/api/leads/${lead._id}/properties/${inventory._id}/select`)
      .set(authHeaderFor(graph.companyAUsers.admin))
      .send({})
      .expect(200);
    expect(selected.body.lead.city).toBe("Ujjain");
    expect(selected.body.lead.siteLocation.lat).toBe(23.1765);

    await request(app)
      .patch(`/api/leads/${lead._id}/properties`)
      .set(authHeaderFor(graph.companyAUsers.admin))
      .send({ inventoryId: String(otherCompanyInventory._id) })
      .expect(404);

    await request(app)
      .patch(`/api/leads/${lead._id}/properties`)
      .set(authHeaderFor(graph.companyAUsers.admin))
      .send({ inventoryId: String(blocked._id) })
      .expect(400);

    await request(app)
      .delete(`/api/leads/${lead._id}/properties/${inventory._id}`)
      .set(authHeaderFor(graph.companyAUsers.admin))
      .expect(200);
  });

  it("covers every status, follow-up validation/clearing, and today follow-up exclusion", async () => {
    const graph = await createPhase2FixtureGraph();
    const lead = await createLead({
      company: graph.companyA,
      createdBy: graph.companyAUsers.admin,
      assignedTo: graph.companyAUsers.executive,
    });
    const statuses = [
      "NEW",
      "CONTACTED",
      "INTERESTED",
      "SITE_VISIT_SCHEDULED",
      "SITE_VISIT_OVERDUE",
      "MISSING_IN_ACTION",
      "NOT_PICKING_CALLS",
      "INVALID",
      "OWNER",
      "BROKER",
      "LOST",
    ];

    for (const status of statuses) {
      const response = await request(app)
        .patch(`/api/leads/${lead._id}/status`)
        .set(authHeaderFor(graph.companyAUsers.admin))
        .send({ status })
        .expect(200);
      expect(response.body.lead.status).toBe(status);
    }

    await request(app)
      .patch(`/api/leads/${lead._id}/status`)
      .set(authHeaderFor(graph.companyAUsers.admin))
      .send({ status: "NOT_A_STATUS" })
      .expect(400);

    await request(app)
      .patch(`/api/leads/${lead._id}/status`)
      .set(authHeaderFor(graph.companyAUsers.admin))
      .send({ status: "INTERESTED", nextFollowUp: "not-date" })
      .expect(400);

    const today = new Date();
    today.setHours(12, 0, 0, 0);
    await request(app)
      .patch(`/api/leads/${lead._id}/status`)
      .set(authHeaderFor(graph.companyAUsers.admin))
      .send({ status: "INTERESTED", nextFollowUp: today.toISOString() })
      .expect(200);

    const followups = await request(app)
      .get("/api/leads/followups/today")
      .set(authHeaderFor(graph.companyAUsers.admin))
      .expect(200);
    expect(followups.body.leads.map((row) => String(row._id))).toContain(String(lead._id));

    await request(app)
      .patch(`/api/leads/${lead._id}/status`)
      .set(authHeaderFor(graph.companyAUsers.admin))
      .send({ status: "INTERESTED", nextFollowUp: "" })
      .expect(200);
    const cleared = await Lead.findById(lead._id).lean();
    expect(cleared.nextFollowUp).toBeNull();

    await request(app)
      .patch(`/api/leads/${lead._id}/status`)
      .set(authHeaderFor(graph.companyAUsers.admin))
      .send(validClosePayload())
      .expect(400);
  });

  it("enforces geofenced site visit prerequisites, radius boundary, and coordinate permissions", async () => {
    const graph = await createPhase2FixtureGraph();
    const lead = await createLead({
      company: graph.companyA,
      createdBy: graph.companyAUsers.admin,
      assignedTo: graph.companyAUsers.fieldExecutive,
      siteLocation: { lat: 22.7196, lng: 75.8577, radiusMeters: 200 },
    });
    const noSiteLead = await createLead({
      company: graph.companyA,
      createdBy: graph.companyAUsers.admin,
      assignedTo: graph.companyAUsers.fieldExecutive,
    });
    await Lead.updateOne(
      { _id: noSiteLead._id },
      { $set: { siteLocation: { lat: null, lng: null, radiusMeters: 200 } } },
    );

    await request(app)
      .patch(`/api/leads/${lead._id}/status`)
      .set(authHeaderFor(graph.companyAUsers.fieldExecutive))
      .send({ status: "INTERESTED", siteLocation: { lat: 22.7, lng: 75.8 } })
      .expect(403);

    await request(app)
      .patch(`/api/leads/${noSiteLead._id}/status`)
      .set(authHeaderFor(graph.companyAUsers.fieldExecutive))
      .send({ status: "SITE_VISIT" })
      .expect(400);

    await request(app)
      .patch(`/api/leads/${lead._id}/status`)
      .set(authHeaderFor(graph.companyAUsers.fieldExecutive))
      .send({ status: "SITE_VISIT" })
      .expect(400);

    await Lead.updateOne(
      { _id: graph.companyAUsers.fieldExecutive._id },
      {
        $set: {
          liveLocation: {
            lat: 22.7196,
            lng: 75.8577,
            updatedAt: new Date(Date.now() - 60 * 60 * 1000),
          },
        },
      },
    );
    await request(app)
      .patch(`/api/leads/${lead._id}/status`)
      .set(authHeaderFor(graph.companyAUsers.fieldExecutive))
      .send({ status: "SITE_VISIT" })
      .expect(400);

    await Lead.updateOne({ _id: lead._id }, { $set: { status: "INTERESTED" } });
    await request(app)
      .patch("/api/users/location")
      .set(authHeaderFor(graph.companyAUsers.fieldExecutive))
      .send({ lat: 22.7196, lng: 75.8577 })
      .expect(200);
    await request(app)
      .patch(`/api/leads/${lead._id}/status`)
      .set(authHeaderFor(graph.companyAUsers.fieldExecutive))
      .send({ status: "SITE_VISIT" })
      .expect(200);

    await Lead.updateOne({ _id: lead._id }, { $set: { status: "INTERESTED" } });
    await request(app)
      .patch("/api/users/location")
      .set(authHeaderFor(graph.companyAUsers.fieldExecutive))
      .send({ lat: 22.725, lng: 75.8577 })
      .expect(200);
    await request(app)
      .patch(`/api/leads/${lead._id}/status`)
      .set(authHeaderFor(graph.companyAUsers.fieldExecutive))
      .send({ status: "SITE_VISIT" })
      .expect(403);
  });

  it("handles direct close, non-admin close request approval/rejection, and inventory reservation transitions", async () => {
    const graph = await createPhase2FixtureGraph();
    const directInventory = await createInventory({
      company: graph.companyA,
      createdBy: graph.companyAUsers.admin,
      price: 2000000,
    });
    const directLead = await createLead({
      company: graph.companyA,
      createdBy: graph.companyAUsers.admin,
      assignedTo: graph.companyAUsers.executive,
      inventoryId: directInventory._id,
      relatedInventoryIds: [directInventory._id],
    });

    await request(app)
      .patch(`/api/leads/${directLead._id}/status`)
      .set(authHeaderFor(graph.companyAUsers.admin))
      .send(validClosePayload())
      .expect(200);
    const sold = await Inventory.findById(directInventory._id).lean();
    expect(sold.status).toBe("Sold");
    expect(String(sold.saleDetails.leadId)).toBe(String(directLead._id));

    const requestedInventory = await createInventory({
      company: graph.companyA,
      createdBy: graph.companyAUsers.admin,
      price: 1500000,
    });
    const requestedLead = await createLead({
      company: graph.companyA,
      createdBy: graph.companyAUsers.admin,
      assignedTo: graph.companyAUsers.executive,
      inventoryId: requestedInventory._id,
      relatedInventoryIds: [requestedInventory._id],
      status: "INTERESTED",
    });

    await request(app)
      .patch(`/api/leads/${requestedLead._id}/status`)
      .set(authHeaderFor(graph.companyAUsers.executive))
      .send({
        ...validClosePayload(),
        dealPayment: { mode: "CASH", paymentType: "FULL" },
      })
      .expect(200);
    const reserved = await Inventory.findById(requestedInventory._id).lean();
    expect(reserved.status).toBe("Blocked");
    expect(String(reserved.reservationLeadId)).toBe(String(requestedLead._id));

    await request(app)
      .patch(`/api/leads/${requestedLead._id}/status`)
      .set(authHeaderFor(graph.companyAUsers.admin))
      .send({
        status: "REQUESTED",
        dealPayment: { approvalStatus: "REJECTED", approvalNote: "Missing docs" },
      })
      .expect(200);
    const released = await Inventory.findById(requestedInventory._id).lean();
    expect(released.status).toBe("Available");
    expect(released.reservationLeadId).toBeNull();

    const approvalInventory = await createInventory({
      company: graph.companyA,
      createdBy: graph.companyAUsers.admin,
      price: 1800000,
    });
    const approvalLead = await createLead({
      company: graph.companyA,
      createdBy: graph.companyAUsers.admin,
      assignedTo: graph.companyAUsers.executive,
      inventoryId: approvalInventory._id,
      relatedInventoryIds: [approvalInventory._id],
      status: "INTERESTED",
    });
    await request(app)
      .patch(`/api/leads/${approvalLead._id}/status`)
      .set(authHeaderFor(graph.companyAUsers.executive))
      .send({
        ...validClosePayload(),
        dealPayment: { mode: "CASH", paymentType: "FULL" },
      })
      .expect(200);
    await request(app)
      .patch(`/api/leads/${approvalLead._id}/status`)
      .set(authHeaderFor(graph.companyAUsers.admin))
      .send({
        status: "REQUESTED",
        dealPayment: { approvalStatus: "APPROVED", approvalNote: "Ok" },
      })
      .expect(200);
    const approvedSold = await Inventory.findById(approvalInventory._id).lean();
    expect(approvedSold.status).toBe("Sold");
  });

  it("rejects invalid payment, brokerage and document payloads without contradictory inventory state", async () => {
    const graph = await createPhase2FixtureGraph();
    const inventory = await createInventory({
      company: graph.companyA,
      createdBy: graph.companyAUsers.admin,
      price: 2000000,
    });
    const lead = await createLead({
      company: graph.companyA,
      createdBy: graph.companyAUsers.admin,
      assignedTo: graph.companyAUsers.executive,
      inventoryId: inventory._id,
      relatedInventoryIds: [inventory._id],
      status: "INTERESTED",
    });

    await request(app)
      .patch(`/api/leads/${lead._id}/status`)
      .set(authHeaderFor(graph.companyAUsers.executive))
      .send({
        ...validClosePayload(),
        dealPayment: { mode: "UPI", paymentType: "FULL" },
      })
      .expect(400);

    await request(app)
      .patch(`/api/leads/${lead._id}/status`)
      .set(authHeaderFor(graph.companyAUsers.executive))
      .send({
        ...validClosePayload(),
        dealPayment: { mode: "CASH", paymentType: "PARTIAL", remainingAmount: 0 },
      })
      .expect(400);

    await request(app)
      .patch(`/api/leads/${lead._id}/status`)
      .set(authHeaderFor(graph.companyAUsers.admin))
      .send({ ...validClosePayload(), brokerage: { brokerageReceived: -1 } })
      .expect(400);

    await request(app)
      .patch(`/api/leads/${lead._id}/status`)
      .set(authHeaderFor(graph.companyAUsers.admin))
      .send({
        ...validClosePayload(),
        brokerage: {
          brokerageReceived: 100,
          brokerageDistributed: 50,
          brokerageDistributionBreakdown: [{ recipientName: "A", amount: 40 }],
        },
      })
      .expect(400);

    await request(app)
      .patch(`/api/leads/${lead._id}/status`)
      .set(authHeaderFor(graph.companyAUsers.admin))
      .send({
        ...validClosePayload(),
        brokerage: {
          brokerageReceived: 260,
          brokerageDistributed: 260,
          brokerageDistributionBreakdown: Array.from({ length: 26 }, (_, index) => ({
            recipientName: `Row ${index}`,
            amount: 10,
          })),
        },
      })
      .expect(400);

    await request(app)
      .patch(`/api/leads/${lead._id}/status`)
      .set(authHeaderFor(graph.companyAUsers.admin))
      .send({
        ...validClosePayload(),
        closureDocuments: [{ url: "ftp://example.com/file.pdf" }],
      })
      .expect(400);

    await request(app)
      .patch(`/api/leads/${lead._id}/status`)
      .set(authHeaderFor(graph.companyAUsers.admin))
      .send({
        ...validClosePayload(),
        closureDocuments: [{ url: "https://example.com/too-large.pdf", size: 26 * 1024 * 1024 }],
      })
      .expect(400);

    const unchangedInventory = await Inventory.findById(inventory._id).lean();
    const unchangedLead = await Lead.findById(lead._id).lean();
    expect(unchangedInventory.status).toBe("Available");
    expect(unchangedLead.status).toBe("INTERESTED");
  });

  it("prevents another lead from closing an already reserved or sold property", async () => {
    const graph = await createPhase2FixtureGraph();
    const inventory = await createInventory({
      company: graph.companyA,
      createdBy: graph.companyAUsers.admin,
      price: 2000000,
    });
    const firstLead = await createLead({
      company: graph.companyA,
      createdBy: graph.companyAUsers.admin,
      assignedTo: graph.companyAUsers.executive,
      inventoryId: inventory._id,
      relatedInventoryIds: [inventory._id],
      status: "INTERESTED",
    });
    const secondLead = await createLead({
      company: graph.companyA,
      createdBy: graph.companyAUsers.admin,
      assignedTo: graph.companyAUsers.executive,
      inventoryId: inventory._id,
      relatedInventoryIds: [inventory._id],
      status: "INTERESTED",
    });

    await request(app)
      .patch(`/api/leads/${firstLead._id}/status`)
      .set(authHeaderFor(graph.companyAUsers.executive))
      .send({
        ...validClosePayload(),
        dealPayment: { mode: "CASH", paymentType: "FULL" },
      })
      .expect(200);

    await request(app)
      .patch(`/api/leads/${secondLead._id}/status`)
      .set(authHeaderFor(graph.companyAUsers.executive))
      .send({
        ...validClosePayload(),
        dealPayment: { mode: "CASH", paymentType: "FULL" },
      })
      .expect(400);

    await request(app)
      .patch(`/api/leads/${firstLead._id}/status`)
      .set(authHeaderFor(graph.companyAUsers.admin))
      .send({
        status: "REQUESTED",
        dealPayment: { approvalStatus: "APPROVED" },
      })
      .expect(200);

    await request(app)
      .patch(`/api/leads/${secondLead._id}/status`)
      .set(authHeaderFor(graph.companyAUsers.admin))
      .send(validClosePayload())
      .expect(400);
  });

  it("allows only one concurrent close attempt to sell a property", async () => {
    const graph = await createPhase2FixtureGraph();
    const inventory = await createInventory({
      company: graph.companyA,
      createdBy: graph.companyAUsers.admin,
      price: 2000000,
    });
    const firstLead = await createLead({
      company: graph.companyA,
      createdBy: graph.companyAUsers.admin,
      assignedTo: graph.companyAUsers.executive,
      inventoryId: inventory._id,
      relatedInventoryIds: [inventory._id],
      status: "INTERESTED",
    });
    const secondLead = await createLead({
      company: graph.companyA,
      createdBy: graph.companyAUsers.admin,
      assignedTo: graph.companyAUsers.executive,
      inventoryId: inventory._id,
      relatedInventoryIds: [inventory._id],
      status: "INTERESTED",
    });

    const responses = await Promise.all([
      request(app)
        .patch(`/api/leads/${firstLead._id}/status`)
        .set(authHeaderFor(graph.companyAUsers.admin))
        .send(validClosePayload()),
      request(app)
        .patch(`/api/leads/${secondLead._id}/status`)
        .set(authHeaderFor(graph.companyAUsers.admin))
        .send(validClosePayload()),
    ]);

    const statuses = responses.map((response) => response.status).sort();
    expect(statuses).toEqual([200, 400]);

    const soldInventory = await Inventory.findById(inventory._id).lean();
    const closedLeads = await Lead.countDocuments({
      _id: { $in: [firstLead._id, secondLead._id] },
      status: "CLOSED",
    });
    expect(soldInventory.status).toBe("Sold");
    expect(closedLeads).toBe(1);
    expect([String(firstLead._id), String(secondLead._id)]).toContain(
      String(soldInventory.saleDetails.leadId),
    );
  });

  it("supports status requests, activities, diary access, filters and once-only decisions", async () => {
    const graph = await createPhase2FixtureGraph();
    const lead = await createLead({
      company: graph.companyA,
      createdBy: graph.companyAUsers.admin,
      assignedTo: graph.companyAUsers.executive,
    });

    const submitted = await request(app)
      .post(`/api/leads/${lead._id}/status-request`)
      .set(authHeaderFor(graph.companyAUsers.executive))
      .send({
        status: "INTERESTED",
        requestNote: "Please mark interested",
      })
      .expect(201);

    const mine = await request(app)
      .get(`/api/leads/status-requests?leadId=${lead._id}&status=pending`)
      .set(authHeaderFor(graph.companyAUsers.executive))
      .expect(200);
    expect(mine.body.requests).toHaveLength(1);

    await request(app)
      .patch(`/api/leads/status-requests/${submitted.body.request._id}/approve`)
      .set(authHeaderFor(graph.companyAUsers.admin))
      .send({ reviewNote: "Ok" })
      .expect(200);

    await request(app)
      .patch(`/api/leads/status-requests/${submitted.body.request._id}/reject`)
      .set(authHeaderFor(graph.companyAUsers.admin))
      .send({ rejectionReason: "Too late" })
      .expect(404);

    const second = await LeadStatusRequest.create({
      companyId: graph.companyA._id,
      lead: lead._id,
      requestedBy: graph.companyAUsers.executive._id,
      proposedStatus: "LOST",
      requestNote: "Lost",
    });
    await request(app)
      .patch(`/api/leads/status-requests/${second._id}/reject`)
      .set(authHeaderFor(graph.companyBUsers.admin))
      .send({ rejectionReason: "Cross-company" })
      .expect(404);
    await request(app)
      .patch(`/api/leads/status-requests/${second._id}/reject`)
      .set(authHeaderFor(graph.companyAUsers.admin))
      .send({ rejectionReason: "Not lost" })
      .expect(200);

    const diary = await request(app)
      .post(`/api/leads/${lead._id}/diary`)
      .set(authHeaderFor(graph.companyAUsers.executive))
      .send({ note: "Diary note" })
      .expect(201);
    await request(app)
      .patch(`/api/leads/${lead._id}/diary/${diary.body.entry._id}`)
      .set(authHeaderFor(graph.companyAUsers.executive))
      .send({ note: "x".repeat(2001) })
      .expect(400);
    await request(app)
      .get(`/api/leads/${lead._id}/diary`)
      .set(authHeaderFor(graph.companyBUsers.admin))
      .expect(404);

    const activities = await LeadActivity.find({ lead: lead._id }).lean();
    expect(activities.length).toBeGreaterThan(0);
    const diaries = await LeadDiary.find({ lead: lead._id }).lean();
    expect(diaries.length).toBeGreaterThan(0);
  });
});
