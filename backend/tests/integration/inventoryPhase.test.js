const fs = require("fs");
const path = require("path");
const request = require("supertest");

const app = require("../../src/app");
const Company = require("../../src/models/Company");
const Inventory = require("../../src/models/Inventory");
const InventoryActivity = require("../../src/models/InventoryActivity");
const InventoryRequest = require("../../src/models/InventoryRequest");
const InventoryShareLink = require("../../src/models/InventoryShareLink");
const Lead = require("../../src/models/Lead");
const {
  authHeaderFor,
  createInventory,
  createLead,
  createPhase2FixtureGraph,
} = require("../fixtures");

const validInventoryPayload = (overrides = {}) => ({
  projectName: `Inventory Project ${Date.now()}-${Math.random()}`,
  towerName: "Tower A",
  unitNumber: `Unit ${Date.now()}-${Math.random()}`,
  propertyId: `PROP-${Date.now()}`,
  inventoryType: "COMMERCIAL",
  price: 2500000,
  type: "Sale",
  category: "Office",
  furnishingStatus: "FULLY_FURNISHED",
  location: "Vijay Nagar, Indore",
  city: "Indore",
  area: "Vijay Nagar",
  pincode: "452010",
  totalArea: 1200,
  areaUnit: "SQ_FT",
  siteLocation: { lat: 22.7533, lng: 75.8937 },
  commercialDetails: {
    officeType: "OFFICE",
    officeLayout: { seats: 24, conferenceRooms: 1 },
    amenities: { pantry: true, washroomType: "ATTACHED" },
    buildingDetails: { parkingType: "COVERED", parkingSlots: 2 },
  },
  ...overrides,
});

const createSaleDetails = (lead, overrides = {}) => ({
  leadId: String(lead._id),
  paymentMode: "UPI",
  paymentType: "FULL",
  totalAmount: 2500000,
  paymentReference: "UPI-123",
  ...overrides,
});

describe("inventory CRUD, workflow, sharing, and service contracts", () => {
  it("validates required fields, subtypes, price boundaries, deposit rules, and duplicate tuples per company", async () => {
    const graph = await createPhase2FixtureGraph();

    await request(app)
      .post("/api/inventory")
      .set(authHeaderFor(graph.companyAUsers.admin))
      .send(validInventoryPayload({ projectName: "" }))
      .expect(400);

    await request(app)
      .post("/api/inventory")
      .set(authHeaderFor(graph.companyAUsers.admin))
      .send(validInventoryPayload({ price: -1 }))
      .expect(400);

    await request(app)
      .post("/api/inventory")
      .set(authHeaderFor(graph.companyAUsers.admin))
      .send(validInventoryPayload({ price: 0 }))
      .expect(400);

    await request(app)
      .post("/api/inventory")
      .set(authHeaderFor(graph.companyAUsers.admin))
      .send(validInventoryPayload({ inventoryType: "WAREHOUSE" }))
      .expect(400);

    await request(app)
      .post("/api/inventory")
      .set(authHeaderFor(graph.companyAUsers.admin))
      .send(validInventoryPayload({
        inventoryType: "RESIDENTIAL",
        category: "Flat",
        residentialDetails: {
          propertyType: "CASTLE",
          bhkType: "2BHK",
        },
      }))
      .expect(400);

    const rent = await request(app)
      .post("/api/inventory")
      .set(authHeaderFor(graph.companyAUsers.admin))
      .send(validInventoryPayload({
        type: "Rent",
        rent: 55000,
        deposit: 110000,
        inventoryType: "RESIDENTIAL",
        category: "Flat",
        residentialDetails: {
          propertyType: "FLAT",
          bhkType: "2BHK",
          bedrooms: 2,
          bathrooms: 2,
        },
      }))
      .expect(201);
    expect(rent.body.inventory.deposit).toBe(110000);

    const saleWithDeposit = await request(app)
      .post("/api/inventory")
      .set(authHeaderFor(graph.companyAUsers.admin))
      .send(validInventoryPayload({ deposit: 50000 }))
      .expect(201);
    expect(saleWithDeposit.body.inventory.deposit).toBeNull();

    const tuple = {
      projectName: "Tuple Project",
      towerName: "Tuple Tower",
      unitNumber: "Tuple Unit",
    };
    await request(app)
      .post("/api/inventory")
      .set(authHeaderFor(graph.companyAUsers.admin))
      .send(validInventoryPayload(tuple))
      .expect(201);
    await request(app)
      .post("/api/inventory")
      .set(authHeaderFor(graph.companyAUsers.admin))
      .send(validInventoryPayload(tuple))
      .expect(409);
    await request(app)
      .post("/api/inventory")
      .set(authHeaderFor(graph.companyBUsers.admin))
      .send(validInventoryPayload(tuple))
      .expect(201);
  });

  it("enforces status model rules and company-scopes reservation and sale leads", async () => {
    const graph = await createPhase2FixtureGraph();
    const leadA = await createLead({
      company: graph.companyA,
      createdBy: graph.companyAUsers.admin,
    });
    const leadB = await createLead({
      company: graph.companyB,
      createdBy: graph.companyBUsers.admin,
    });

    await request(app)
      .post("/api/inventory")
      .set(authHeaderFor(graph.companyAUsers.admin))
      .send(validInventoryPayload({
        status: "Blocked",
        reservationReason: "Client hold",
      }))
      .expect(400);

    await request(app)
      .post("/api/inventory")
      .set(authHeaderFor(graph.companyAUsers.admin))
      .send(validInventoryPayload({
        status: "Blocked",
        reservationReason: "Wrong company hold",
        reservationLeadId: String(leadB._id),
      }))
      .expect(404);

    const blocked = await request(app)
      .post("/api/inventory")
      .set(authHeaderFor(graph.companyAUsers.admin))
      .send(validInventoryPayload({
        status: "Blocked",
        reservationReason: "Client hold",
        reservationLeadId: String(leadA._id),
      }))
      .expect(201);
    expect(String(blocked.body.inventory.reservationLeadId._id)).toBe(String(leadA._id));

    const unblocked = await request(app)
      .patch(`/api/inventory/${blocked.body.inventory._id}`)
      .set(authHeaderFor(graph.companyAUsers.admin))
      .send({ status: "Available" })
      .expect(200);
    expect(unblocked.body.inventory.reservationReason).toBe("");
    expect(unblocked.body.inventory.reservationLeadId).toBeNull();

    await request(app)
      .post("/api/inventory")
      .set(authHeaderFor(graph.companyAUsers.admin))
      .send(validInventoryPayload({
        status: "Sold",
        saleDetails: createSaleDetails(leadA, { paymentMode: "CHECK", paymentReference: "" }),
      }))
      .expect(400);

    await request(app)
      .post("/api/inventory")
      .set(authHeaderFor(graph.companyAUsers.admin))
      .send(validInventoryPayload({
        status: "Sold",
        saleDetails: createSaleDetails(leadA, { paymentType: "PARTIAL", remainingAmount: 0 }),
      }))
      .expect(400);

    await request(app)
      .post("/api/inventory")
      .set(authHeaderFor(graph.companyAUsers.admin))
      .send(validInventoryPayload({
        status: "Sold",
        saleDetails: createSaleDetails(leadB),
      }))
      .expect(404);

    const sold = await request(app)
      .post("/api/inventory")
      .set(authHeaderFor(graph.companyAUsers.admin))
      .send(validInventoryPayload({
        status: "Sold",
        saleDetails: createSaleDetails(leadA),
      }))
      .expect(201);

    const available = await request(app)
      .patch(`/api/inventory/${sold.body.inventory._id}`)
      .set(authHeaderFor(graph.companyAUsers.admin))
      .send({ status: "Available" })
      .expect(200);
    expect(available.body.inventory.saleDetails).toBeNull();
  });

  it("enforces direct permissions, channel-partner inventory access, cross-company IDs, and activity visibility", async () => {
    const graph = await createPhase2FixtureGraph();
    const roleUsers = {
      ADMIN: graph.companyAUsers.admin,
      MANAGER: graph.companyAUsers.manager,
      INSIDE_EXECUTIVE: graph.companyAUsers.insideExecutive,
      EXECUTIVE: graph.companyAUsers.executive,
      FIELD_EXECUTIVE: graph.companyAUsers.fieldExecutive,
      PRODUCTION_EXECUTIVE: graph.companyAUsers.productionExecutive,
      CHANNEL_PARTNER_ALLOWED: graph.companyAUsers.channelPartnerWithInventory,
      CHANNEL_PARTNER_DENIED: graph.companyAUsers.channelPartnerNoInventory,
    };

    for (const [role, user] of Object.entries(roleUsers)) {
      const response = await request(app)
        .post("/api/inventory")
        .set(authHeaderFor(user))
        .send(validInventoryPayload({ unitNumber: `${role}-${Date.now()}` }));

      if (["PRODUCTION_EXECUTIVE", "CHANNEL_PARTNER_DENIED"].includes(role)) {
        expect(response.status, `${role} create should be forbidden`).toBe(403);
      } else {
        expect(response.status, `${role} create should be allowed`).toBe(201);
      }
    }

    const inventoryA = await createInventory({
      company: graph.companyA,
      createdBy: graph.companyAUsers.admin,
    });
    const inventoryB = await createInventory({
      company: graph.companyB,
      createdBy: graph.companyBUsers.admin,
    });

    await request(app)
      .get("/api/inventory")
      .set(authHeaderFor(graph.companyAUsers.channelPartnerNoInventory))
      .expect(403);

    await request(app)
      .get(`/api/inventory/${inventoryB._id}`)
      .set(authHeaderFor(graph.companyAUsers.admin))
      .expect(404);

    await request(app)
      .patch(`/api/inventory/${inventoryA._id}`)
      .set(authHeaderFor(graph.companyBUsers.admin))
      .send({ price: 2600000, companyId: String(graph.companyA._id) })
      .expect(404);

    await request(app)
      .patch(`/api/inventory/${inventoryA._id}`)
      .set(authHeaderFor(graph.companyAUsers.executive))
      .send({ price: 2600000 })
      .expect(403);

    await request(app)
      .delete(`/api/inventory/${inventoryA._id}`)
      .set(authHeaderFor(graph.companyAUsers.manager))
      .expect(403);

    await request(app)
      .get(`/api/inventory/${inventoryA._id}/activity`)
      .set(authHeaderFor(graph.companyAUsers.executive))
      .expect(403);
    await request(app)
      .get(`/api/inventory/${inventoryA._id}/activity`)
      .set(authHeaderFor(graph.companyAUsers.manager))
      .expect(200);
  });

  it("lists inventory with filters, pagination, invalid query rejection, and large-data limits", async () => {
    const graph = await createPhase2FixtureGraph();

    await createInventory({
      company: graph.companyA,
      createdBy: graph.companyAUsers.admin,
      projectName: "Searchable Alpha",
      city: "Indore",
      status: "Available",
      type: "Sale",
      inventoryType: "COMMERCIAL",
      furnishingStatus: "FULLY_FURNISHED",
      totalArea: 900,
      commercialDetails: {
        officeType: "OFFICE",
        officeLayout: { seats: 10 },
      },
    });
    await createInventory({
      company: graph.companyA,
      createdBy: graph.companyAUsers.admin,
      projectName: "Filtered Beta",
      city: "Bhopal",
      status: "Available",
      type: "Rent",
      inventoryType: "RESIDENTIAL",
      furnishingStatus: "SEMI_FURNISHED",
      residentialDetails: { propertyType: "FLAT", bhkType: "2BHK" },
    });

    const filtered = await request(app)
      .get("/api/inventory")
      .query({
        search: "alpha",
        city: "indore",
        status: "Available",
        type: "Sale",
        inventoryType: "COMMERCIAL",
        furnishing: "FULLY_FURNISHED",
        propertyType: "OFFICE",
        page: 1,
        limit: 1,
      })
      .set(authHeaderFor(graph.companyAUsers.admin))
      .expect(200);

    expect(filtered.body.inventory).toHaveLength(1);
    expect(filtered.body.inventory[0].projectName).toBe("Searchable Alpha");
    expect(filtered.body.pagination.totalCount).toBe(1);

    await request(app)
      .get("/api/inventory")
      .query({ page: "bad", limit: 10000 })
      .set(authHeaderFor(graph.companyAUsers.admin))
      .expect(400);

    const rows = Array.from({ length: 30 }, (_, index) => ({
      ...validInventoryPayload({
        projectName: `Large Page ${index}`,
        unitNumber: `LP-${index}`,
      }),
      companyId: graph.companyA._id,
      createdBy: graph.companyAUsers.admin._id,
    }));
    await Inventory.insertMany(rows);

    const page = await request(app)
      .get("/api/inventory")
      .query({ page: 1, limit: 25 })
      .set(authHeaderFor(graph.companyAUsers.admin))
      .expect(200);
    expect(page.body.inventory.length).toBeLessThanOrEqual(25);
    expect(page.body.pagination.totalCount).toBeGreaterThanOrEqual(32);
  });

  it("bulk uploads mixed rows with partial failures, duplicate detection, size limit, and activity generation", async () => {
    const graph = await createPhase2FixtureGraph();
    await createInventory({
      company: graph.companyA,
      createdBy: graph.companyAUsers.admin,
      projectName: "Existing Bulk",
      towerName: "Tower",
      unitNumber: "100",
    });

    await request(app)
      .post("/api/inventory/bulk")
      .set(authHeaderFor(graph.companyAUsers.admin))
      .send({ rows: [] })
      .expect(400);

    const response = await request(app)
      .post("/api/inventory/bulk")
      .set(authHeaderFor(graph.companyAUsers.admin))
      .send({
        rows: [
          null,
          validInventoryPayload({
            projectName: "Bulk Commercial",
            towerName: "Tower",
            unitNumber: "101",
          }),
          validInventoryPayload({
            projectName: "Bulk Residential",
            towerName: "Tower",
            unitNumber: "102",
            inventoryType: "RESIDENTIAL",
            category: "Flat",
            residentialDetails: { propertyType: "FLAT", bhkType: "3BHK" },
          }),
          validInventoryPayload({
            projectName: "Bulk Commercial",
            towerName: "Tower",
            unitNumber: "101",
          }),
          validInventoryPayload({
            projectName: "Existing Bulk",
            towerName: "Tower",
            unitNumber: "100",
          }),
          validInventoryPayload({ inventoryType: "BAD" }),
        ],
      })
      .expect(201);

    expect(response.body.createdCount).toBe(2);
    expect(response.body.failedCount).toBe(4);
    const activityCount = await InventoryActivity.countDocuments({
      companyId: graph.companyA._id,
      actionType: "BULK_CREATE",
    });
    expect(activityCount).toBe(2);

    await request(app)
      .post("/api/inventory/bulk")
      .set(authHeaderFor(graph.companyAUsers.manager))
      .send({ rows: Array.from({ length: 501 }, (_, index) => validInventoryPayload({ unitNumber: `MAX-${index}` })) })
      .expect(400);
  });

  it("handles approval workflow aliases, manager pre-approval, final decisions, repeated decisions, queues, and activities", async () => {
    const graph = await createPhase2FixtureGraph();
    const inventory = await createInventory({
      company: graph.companyA,
      createdBy: graph.companyAUsers.admin,
      teamId: graph.companyAUsers.manager._id,
    });

    const createdRequest = await request(app)
      .post(`/api/inventory-request/update/${inventory._id}`)
      .set(authHeaderFor(graph.companyAUsers.executive))
      .send({
        proposedData: { price: 3100000 },
        requestNote: "Price correction",
      })
      .expect(201);
    const requestId = createdRequest.body.request._id;

    const managerQueue = await request(app)
      .get("/api/inventory-request/pending")
      .set(authHeaderFor(graph.companyAUsers.manager))
      .expect(200);
    expect(managerQueue.body.requests.some((row) => String(row._id) === String(requestId))).toBe(true);

    await request(app)
      .patch(`/api/inventory-request/${requestId}/pre-approve`)
      .set(authHeaderFor(graph.companyAUsers.manager))
      .expect(200);

    await request(app)
      .patch(`/api/inventory-request/${requestId}/approve`)
      .set(authHeaderFor(graph.companyAUsers.admin))
      .expect(200);
    await request(app)
      .patch(`/api/inventory-request/${requestId}/approve`)
      .set(authHeaderFor(graph.companyAUsers.admin))
      .expect(404);

    const updatedInventory = await Inventory.findById(inventory._id).lean();
    expect(updatedInventory.price).toBe(3100000);

    const deleteRequest = await request(app)
      .post(`/api/inventory-request/delete/${inventory._id}`)
      .set(authHeaderFor(graph.companyAUsers.manager))
      .send({ requestNote: "Do not need this unit" })
      .expect(201);

    await request(app)
      .patch(`/api/inventory-request/${deleteRequest.body.request._id}/reject`)
      .set(authHeaderFor(graph.companyAUsers.admin))
      .send({ rejectionReason: "Keep it live" })
      .expect(200);
    await request(app)
      .patch(`/api/inventory-request/${deleteRequest.body.request._id}/reject`)
      .set(authHeaderFor(graph.companyAUsers.admin))
      .send({ rejectionReason: "Again" })
      .expect(404);

    const myRequests = await request(app)
      .get("/api/inventory-request/my")
      .set(authHeaderFor(graph.companyAUsers.manager))
      .expect(200);
    expect(myRequests.body.requests.some((row) => String(row._id) === String(deleteRequest.body.request._id))).toBe(true);

    const activityCount = await InventoryActivity.countDocuments({
      inventoryId: inventory._id,
      requestId: { $exists: true, $ne: null },
    });
    expect(activityCount).toBeGreaterThanOrEqual(2);
  });

  it("preserves lead-linked inventory consistency and blocks destructive or contradictory updates", async () => {
    const graph = await createPhase2FixtureGraph();
    const leadA = await createLead({
      company: graph.companyA,
      createdBy: graph.companyAUsers.admin,
    });
    const leadB = await createLead({
      company: graph.companyA,
      createdBy: graph.companyAUsers.admin,
    });
    const inventory = await createInventory({
      company: graph.companyA,
      createdBy: graph.companyAUsers.admin,
      siteLocation: { lat: 22.7, lng: 75.8 },
    });

    await Lead.findByIdAndUpdate(leadA._id, {
      inventoryId: inventory._id,
      relatedInventoryIds: [inventory._id],
    });

    await request(app)
      .delete(`/api/inventory/${inventory._id}`)
      .set(authHeaderFor(graph.companyAUsers.admin))
      .expect(409);

    await request(app)
      .patch(`/api/inventory/${inventory._id}`)
      .set(authHeaderFor(graph.companyAUsers.admin))
      .send({
        status: "Blocked",
        reservationReason: "Lead A reserve",
        reservationLeadId: String(leadA._id),
      })
      .expect(200);

    await request(app)
      .patch(`/api/inventory/${inventory._id}`)
      .set(authHeaderFor(graph.companyAUsers.admin))
      .send({
        status: "Sold",
        saleDetails: createSaleDetails(leadB),
      })
      .expect(409);

    const reserved = await Inventory.findById(inventory._id).lean();
    expect(reserved.status).toBe("Blocked");
    expect(String(reserved.reservationLeadId)).toBe(String(leadA._id));
  });

  it("creates reusable public share tokens and exposes only safe fields for active tenants", async () => {
    const graph = await createPhase2FixtureGraph();
    const inventory = await createInventory({
      company: graph.companyA,
      createdBy: graph.companyAUsers.admin,
      approvedBy: graph.companyAUsers.admin._id,
      updatedBy: graph.companyAUsers.manager._id,
      status: "Available",
      siteLocation: { lat: 22.7533, lng: 75.8937 },
    });

    const first = await request(app)
      .post(`/api/inventory/${inventory._id}/share`)
      .set(authHeaderFor(graph.companyAUsers.admin))
      .expect(201);
    expect(first.body.shareToken).toMatch(/^[a-f0-9]{32}$/);

    const second = await request(app)
      .post(`/api/inventory/${inventory._id}/share`)
      .set(authHeaderFor(graph.companyAUsers.admin))
      .expect(200);
    expect(second.body.shareToken).toBe(first.body.shareToken);

    const publicResponse = await request(app)
      .get(`/api/public/inventory/${first.body.shareToken}`)
      .expect(200);
    expect(publicResponse.body.inventory.projectName).toBe(inventory.projectName);
    expect(publicResponse.body.inventory.companyId).toBeUndefined();
    expect(publicResponse.body.inventory.createdBy).toBeUndefined();
    expect(publicResponse.body.inventory.approvedBy).toBeUndefined();
    expect(publicResponse.body.inventory.updatedBy).toBeUndefined();
    expect(publicResponse.body.inventory.saleDetails).toBeUndefined();
    expect(publicResponse.body.inventory.reservationLeadId).toBeUndefined();

    await request(app)
      .get("/api/public/inventory/not-a-token")
      .expect(404);

    await InventoryShareLink.findOneAndUpdate(
      { token: first.body.shareToken },
      { expiresAt: new Date(Date.now() - 60_000) },
    );
    await request(app)
      .get(`/api/public/inventory/${first.body.shareToken}`)
      .expect(410);

    const suspendedInventory = await createInventory({
      company: graph.suspendedCompanyC,
      createdBy: graph.companyCUsers.admin,
    });
    const suspendedLink = await InventoryShareLink.create({
      token: InventoryShareLink.generateToken(),
      inventoryId: suspendedInventory._id,
      companyId: graph.suspendedCompanyC._id,
      createdBy: graph.companyCUsers.admin._id,
      expiresAt: InventoryShareLink.defaultExpiresAt(),
    });
    await request(app)
      .get(`/api/public/inventory/${suspendedLink.token}`)
      .expect(403);

    const deletedInventory = await createInventory({
      company: graph.companyA,
      createdBy: graph.companyAUsers.admin,
    });
    const deletedLink = await InventoryShareLink.create({
      token: InventoryShareLink.generateToken(),
      inventoryId: deletedInventory._id,
      companyId: graph.companyA._id,
      createdBy: graph.companyAUsers.admin._id,
      expiresAt: InventoryShareLink.defaultExpiresAt(),
    });
    await Inventory.findByIdAndDelete(deletedInventory._id);
    await request(app)
      .get(`/api/public/inventory/${deletedLink.token}`)
      .expect(404);
  });

  it("keeps web and mobile inventory service calls aligned with mounted backend routes", () => {
    const webInventory = fs.readFileSync(
      path.join(__dirname, "../../../frontend/src/services/inventoryService.js"),
      "utf8",
    );
    const webPublicInventory = fs.readFileSync(
      path.join(__dirname, "../../../frontend/src/services/publicInventoryService.js"),
      "utf8",
    );
    const mobileInventory = fs.readFileSync(
      path.join(__dirname, "../../../mobile/src/services/inventoryService.ts"),
      "utf8",
    );

    [
      'api.get("/inventory"',
      "api.get(`/inventory/${assetId}`",
      "api.get(`/inventory/${assetId}/activity`",
      'api.post("/inventory"',
      "api.patch(`/inventory/${assetId}`",
      "api.delete(`/inventory/${assetId}`",
      "api.post(`/inventory-request/update/${assetId}`",
      'api.get("/inventory-request/pending"',
      "api.patch(`/inventory-request/${requestId}/approve`",
      "api.patch(`/inventory-request/${requestId}/reject`",
    ].forEach((needle) => {
      expect(webInventory).toContain(needle);
      expect(mobileInventory).toContain(needle);
    });

    expect(webInventory).toContain("api.post(`/inventory/${inventoryId}/share`");
    expect(webPublicInventory).toContain("publicApi.get(`/inventory/${shareToken}`");
  });
});
