const request = require("supertest");
const app = require("../../src/app");
const LeadDiary = require("../../src/models/leadDiary.model");
const {
  authHeaderFor,
  createCompany,
  createCompanyUsers,
  createLead,
  createLeadDiaryEntry,
  createLeadStatusRequest,
  createUser,
} = require("../fixtures");

describe("lead route contracts", () => {
  it("returns lead status requests for admins without crashing", async () => {
    const { admin, executive, company } = await createCompanyUsers();
    const lead = await createLead({ company, createdBy: executive, assignedTo: executive });
    const statusRequest = await createLeadStatusRequest({
      company,
      lead,
      requestedBy: executive,
    });

    const res = await request(app)
      .get("/api/leads/status-requests")
      .set(authHeaderFor(admin))
      .expect(200);

    expect(res.body.requests).toHaveLength(1);
    expect(String(res.body.requests[0]._id)).toBe(String(statusRequest._id));
  });

  it("edits a lead diary entry by its owner", async () => {
    const { executive, company } = await createCompanyUsers();
    const lead = await createLead({ company, createdBy: executive, assignedTo: executive });
    const entry = await createLeadDiaryEntry({
      lead,
      createdBy: executive,
      note: "Original diary note",
    });

    const res = await request(app)
      .patch(`/api/leads/${lead._id}/diary/${entry._id}`)
      .set(authHeaderFor(executive))
      .send({ note: "Updated diary note" })
      .expect(200);

    expect(res.body.entry.note).toBe("Updated diary note");
    expect(res.body.entry.isEdited).toBe(true);

    const updated = await LeadDiary.findById(entry._id).lean();
    expect(updated.editHistory).toHaveLength(1);
    expect(updated.editHistory[0].previousNote).toBe("Original diary note");
  });

  it("allows an admin to edit a same-company diary entry", async () => {
    const { admin, executive, company } = await createCompanyUsers();
    const lead = await createLead({ company, createdBy: executive, assignedTo: executive });
    const entry = await createLeadDiaryEntry({
      lead,
      createdBy: executive,
      note: "Needs admin correction",
    });

    const res = await request(app)
      .patch(`/api/leads/${lead._id}/diary/${entry._id}`)
      .set(authHeaderFor(admin))
      .send({ note: "Admin corrected note" })
      .expect(200);

    expect(res.body.entry.note).toBe("Admin corrected note");
    expect(String(res.body.entry.lastEditedBy._id || res.body.entry.lastEditedBy)).toBe(String(admin._id));
  });

  it("rejects diary edits from a different company", async () => {
    const { executive, company } = await createCompanyUsers();
    const otherCompany = await createCompany();
    const otherUser = await createUser({ company: otherCompany, role: "EXECUTIVE" });
    const lead = await createLead({ company, createdBy: executive, assignedTo: executive });
    const entry = await createLeadDiaryEntry({ lead, createdBy: executive });

    await request(app)
      .patch(`/api/leads/${lead._id}/diary/${entry._id}`)
      .set(authHeaderFor(otherUser))
      .send({ note: "Cross-company edit" })
      .expect(404);
  });
});
