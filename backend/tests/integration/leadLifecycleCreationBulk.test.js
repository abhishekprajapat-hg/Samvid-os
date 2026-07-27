const request = require("supertest");

const app = require("../../src/app");
const Lead = require("../../src/models/Lead");
const {
  authHeaderFor,
  createCompany,
  createInventory,
  createLead,
  createPhase2FixtureGraph,
  createUser,
} = require("../fixtures");

describe("lead lifecycle creation, bulk upload, and listing", () => {
  it("validates required lead fields and normalizes phone/preferred locations", async () => {
    const graph = await createPhase2FixtureGraph();

    await request(app)
      .post("/api/leads")
      .set(authHeaderFor(graph.companyAUsers.admin))
      .send({ phone: "9876543210" })
      .expect(400);

    await request(app)
      .post("/api/leads")
      .set(authHeaderFor(graph.companyAUsers.admin))
      .send({ name: "Bad Phone", phone: "abcd" })
      .expect(400);

    const created = await request(app)
      .post("/api/leads")
      .set(authHeaderFor(graph.companyAUsers.admin))
      .send({
        name: "Normalized Phone",
        phone: "+91 98765-43210",
        preferredLocations: [" Vijay Nagar ", "vijay nagar", "Palasia"],
      })
      .expect(201);

    expect(created.body.lead.phone).toBe("9876543210");
    expect(created.body.lead.preferredLocations).toEqual(["Vijay Nagar", "Palasia"]);

    await request(app)
      .post("/api/leads")
      .set(authHeaderFor(graph.companyAUsers.admin))
      .send({ name: "Duplicate Normalized", phone: "98765 43210" })
      .expect(400);
  });

  it("rejects duplicate phones only inside the same company", async () => {
    const graph = await createPhase2FixtureGraph();
    await createLead({
      company: graph.companyA,
      createdBy: graph.companyAUsers.admin,
      phone: "9000011111",
    });

    await request(app)
      .post("/api/leads")
      .set(authHeaderFor(graph.companyAUsers.admin))
      .send({ name: "Same Company Duplicate", phone: "9000011111" })
      .expect(400);

    await request(app)
      .post("/api/leads")
      .set(authHeaderFor(graph.companyBUsers.admin))
      .send({ name: "Other Company Allowed", phone: "9000011111" })
      .expect(201);
  });

  it("creates manual and Meta leads with requirements and validates inventory/site coordinates", async () => {
    const graph = await createPhase2FixtureGraph();
    const inventory = await createInventory({
      company: graph.companyA,
      createdBy: graph.companyAUsers.admin,
      city: "Indore",
      siteLocation: { lat: 22.7196, lng: 75.8577 },
      inventoryType: "COMMERCIAL",
      commercialDetails: {
        officeType: "OFFICE",
        officeLayout: { seats: 20, conferenceRooms: 2 },
        amenities: { pantry: true },
      },
    });
    const otherInventory = await createInventory({
      company: graph.companyB,
      createdBy: graph.companyBUsers.admin,
    });

    const created = await request(app)
      .post("/api/leads")
      .set(authHeaderFor(graph.companyAUsers.admin))
      .send({
        name: "Requirement Lead",
        phone: "9000022222",
        inventoryId: String(inventory._id),
        source: "META",
        requirements: {
          inventoryType: "commercial",
          transactionType: "lease",
          commercial: { seats: "18", pantry: "yes" },
        },
      })
      .expect(201);

    expect(created.body.lead.source).toBe("META");
    expect(created.body.lead.city).toBe("Indore");
    expect(created.body.lead.siteLocation.lat).toBe(22.7196);
    expect(created.body.lead.requirements.inventoryType).toBe("COMMERCIAL");
    expect(created.body.lead.requirements.transactionType).toBe("LEASE");
    expect(created.body.lead.requirements.commercial.seats).toBe(18);

    await request(app)
      .post("/api/leads")
      .set(authHeaderFor(graph.companyAUsers.admin))
      .send({ name: "Bad Inventory", phone: "9000022223", inventoryId: "not-id" })
      .expect(400);

    await request(app)
      .post("/api/leads")
      .set(authHeaderFor(graph.companyAUsers.admin))
      .send({ name: "Other Inventory", phone: "9000022224", inventoryId: String(otherInventory._id) })
      .expect(404);

    await request(app)
      .post("/api/leads")
      .set(authHeaderFor(graph.companyAUsers.admin))
      .send({
        name: "Bad Site",
        phone: "9000022225",
        siteLocation: { lat: 120, lng: 75.8577 },
      })
      .expect(400);
  });

  it("keeps Channel Partner leads pending assignment while normal leads are auto assigned fairly", async () => {
    const graph = await createPhase2FixtureGraph();

    const partnerLead = await request(app)
      .post("/api/leads")
      .set(authHeaderFor(graph.companyAUsers.channelPartnerWithInventory))
      .send({ name: "Partner Lead", phone: "9000030001" })
      .expect(201);
    expect(partnerLead.body.lead.assignedTo).toBeFalsy();

    const created = [];
    for (let index = 0; index < 4; index += 1) {
      const response = await request(app)
        .post("/api/leads")
        .set(authHeaderFor(graph.companyAUsers.admin))
        .send({ name: `Auto Lead ${index}`, phone: `900003000${index + 2}` })
        .expect(201);
      created.push(response.body.lead);
    }

    const assignees = created.map((lead) => String(lead.assignedTo?._id || lead.assignedTo || ""));
    expect(new Set(assignees).size).toBeGreaterThan(1);
  });

  it("bulk upload handles empty, malformed, duplicates, inventory validation, boundaries, and formula-like values", async () => {
    const graph = await createPhase2FixtureGraph();
    const inventory = await createInventory({
      company: graph.companyA,
      createdBy: graph.companyAUsers.admin,
    });
    await createLead({
      company: graph.companyA,
      createdBy: graph.companyAUsers.admin,
      phone: "9000040001",
    });

    await request(app)
      .post("/api/leads/bulk")
      .set(authHeaderFor(graph.companyAUsers.admin))
      .send({ rows: [] })
      .expect(400);

    const response = await request(app)
      .post("/api/leads/bulk")
      .set(authHeaderFor(graph.companyAUsers.admin))
      .send({
        rows: [
          null,
          { name: "", phone: "" },
          { name: "Valid Bulk", phone: "9000040002", inventoryId: String(inventory._id) },
          { name: "Payload Duplicate", phone: "9000040002" },
          { name: "Db Duplicate", phone: "9000040001", city: "Updated City" },
          { name: "Bad Inventory", phone: "9000040003", inventoryId: "bad" },
          { name: "=cmd|' /C calc'!A0", phone: "9000040004" },
        ],
      })
      .expect(201);

    expect(response.body.createdCount).toBe(2);
    expect(response.body.updatedCount).toBe(1);
    expect(response.body.failedCount).toBe(4);

    const formulaLead = await Lead.findOne({ phone: "9000040004" }).lean();
    expect(formulaLead.name.startsWith("'")).toBe(true);

    const fiveThousandRows = Array.from({ length: 5000 }, (_, index) => ({
      name: `Boundary ${index}`,
      phone: `91${String(index).padStart(8, "0")}`,
    }));
    await request(app)
      .post("/api/leads/bulk")
      .set(authHeaderFor(graph.companyAUsers.admin))
      .send({ rows: fiveThousandRows })
      .expect(201);

    await request(app)
      .post("/api/leads/bulk")
      .set(authHeaderFor(graph.companyAUsers.admin))
      .send({ rows: [...fiveThousandRows, { name: "Too Many", phone: "919999999999" }] })
      .expect(400);
  }, 60000);

  it("lists leads with role visibility, filters, sorting and pagination", async () => {
    const graph = await createPhase2FixtureGraph();
    const outside = await createLead({
      company: graph.companyB,
      createdBy: graph.companyBUsers.admin,
      assignedTo: graph.companyBUsers.executive,
      name: "Outside Tenant",
      phone: "9000050000",
    });
    const owned = await createLead({
      company: graph.companyA,
      createdBy: graph.companyAUsers.admin,
      assignedTo: graph.companyAUsers.executive,
      name: "Searchable Alpha",
      phone: "9000050001",
      source: "META",
      status: "INTERESTED",
    });
    await createLead({
      company: graph.companyA,
      createdBy: graph.companyAUsers.admin,
      assignedTo: graph.companyAUsers.fieldExecutive,
      name: "Searchable Beta",
      phone: "9000050002",
      source: "MANUAL",
      status: "NEW",
    });

    const filtered = await request(app)
      .get(`/api/leads?search=Alpha&status=INTERESTED&source=META&assignedTo=${graph.companyAUsers.executive._id}&page=1&limit=1`)
      .set(authHeaderFor(graph.companyAUsers.admin))
      .expect(200);
    expect(filtered.body.leads).toHaveLength(1);
    expect(String(filtered.body.leads[0]._id)).toBe(String(owned._id));
    expect(filtered.body.pagination.totalCount).toBe(1);

    const executiveList = await request(app)
      .get("/api/leads")
      .set(authHeaderFor(graph.companyAUsers.executive))
      .expect(200);
    const serialized = JSON.stringify(executiveList.body);
    expect(serialized).toContain(String(owned._id));
    expect(serialized).not.toContain(String(outside._id));

    await request(app)
      .get("/api/leads?page=-1&limit=not-a-number")
      .set(authHeaderFor(graph.companyAUsers.admin))
      .expect(200);
  });
});
