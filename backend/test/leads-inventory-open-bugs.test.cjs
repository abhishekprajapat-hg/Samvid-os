const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createRequire } = require("node:module");

/*
 * Regression tests for the lead / inventory bugs fixed on 30 Sep 2026:
 * LEAD-34 (rental deals), LEAD-46 (lead delete), INV-03 (pincode),
 * INV-14 / INV-19 / INV-25 (channel partner inventory rules).
 */

const companyId = "aaaaaaaaaaaaaaaaaaaaaaaa";
const leadId = "cccccccccccccccccccccccc";

const response = () => ({
  code: 200,
  body: null,
  status(code) { this.code = code; return this; },
  json(body) { this.body = body; return this; },
});

const load = (relative, stubs, exposed = "") => {
  const filename = path.resolve(__dirname, "../src", relative);
  const localRequire = createRequire(filename);
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(filename, "utf8") + exposed, {
    module, exports: module.exports,
    require: (name) => stubs[name] || localRequire(name),
    process, console, Date, setTimeout, clearTimeout,
  }, { filename });
  return module.exports;
};

const query = (value = null) => ({
  select() { return this; }, populate() { return this; }, sort() { return this; },
  lean() { return Promise.resolve(value); },
  then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); },
});

test("LEAD-34: a rental deal closes at the monthly rent, a sale at the price", () => {
  const { dealAmount } = load("controllers/lead.controller.js", {}, "\nmodule.exports.dealAmount = resolveDealAmountForInventory;");
  const rental = dealAmount({ lead: {}, inventory: { type: "Rent", price: 0, rent: 95000 } });
  assert.equal(rental.isRentalDeal, true);
  assert.equal(rental.amount, 95000);
  assert.equal(rental.error, undefined);

  const sale = dealAmount({ lead: {}, inventory: { type: "Sale", price: 5500000, rent: null } });
  assert.equal(sale.isRentalDeal, false);
  assert.equal(sale.amount, 5500000);

  const both = dealAmount({ lead: { requirements: { transactionType: "LEASE" } }, inventory: { type: "Both", price: 18000000, rent: 120000 } });
  assert.equal(both.amount, 120000);

  const missing = dealAmount({ lead: {}, inventory: { type: "Rent", price: 0, rent: 0 } });
  assert.match(missing.error, /no rent/);
});

test("LEAD-46: a lead with a closed deal is refused, a plain lead is deleted and cleaned up", async () => {
  const calls = [];
  const stubs = (leadDoc) => ({
    "../models/Lead": {
      findOne: () => query(leadDoc),
      deleteOne: async (filter) => { calls.push(["Lead.deleteOne", String(filter._id)]); },
    },
    "../models/Inventory": {
      findOne: () => query(null),
      updateMany: async (filter, update) => { calls.push(["Inventory.release", update.$set.status]); },
    },
    "../models/CoworkingInvoice": { countDocuments: async () => 0 },
    "../models/CoworkingPayment": { countDocuments: async () => 0 },
    "../models/Task": { updateMany: async () => { calls.push(["Task.unlink"]); } },
    "../models/leadActivity.model": { deleteMany: async () => { calls.push(["Activity.delete"]); } },
    "../models/leadDiary.model": { deleteMany: async () => { calls.push(["Diary.delete"]); } },
    "../models/LeadStatusRequest": { deleteMany: async () => { calls.push(["StatusRequest.delete"]); } },
    "../models/CrmContact": { updateMany: async () => { calls.push(["Contact.pull"]); } },
    "../services/auditLog.service": { writeAuditLog: async ({ action }) => { calls.push(["audit", action]); } },
  });
  const user = { _id: "bbbbbbbbbbbbbbbbbbbbbbbb", companyId, role: "ADMIN" };

  const closed = load("controllers/lead.controller.js", stubs({ _id: leadId, companyId, name: "Won", status: "CLOSED" }));
  const closedRes = response();
  await closed.deleteLead({ params: { leadId }, user }, closedRes);
  assert.equal(closedRes.code, 409);
  assert.equal(calls.some(([name]) => name === "Lead.deleteOne"), false);

  const plainLead = load("controllers/lead.controller.js", stubs({ _id: leadId, companyId, name: "Junk", status: "NEW" }));
  const res = response();
  await plainLead.deleteLead({ params: { leadId }, user }, res);
  assert.equal(res.code, 200, JSON.stringify(res.body));
  const names = calls.map(([name]) => name);
  for (const expected of ["Inventory.release", "StatusRequest.delete", "Activity.delete", "Diary.delete", "Task.unlink", "Contact.pull", "Lead.deleteOne", "audit"]) {
    assert.ok(names.includes(expected), `missing ${expected}`);
  }
});

test("LEAD-46: the lead delete route is gated and routed through Admin approval", () => {
  const source = fs.readFileSync(path.resolve(__dirname, "../src/routes/lead.routes.js"), "utf8");
  assert.match(source, /router\.delete\(\s*"\/:leadId",[\s\S]*?checkRoleOrPageAction\(\["ADMIN", "MANAGER"\], "delete"[\s\S]*?requireAdminApprovalForDelete\("lead"/);
});

test("INV-03: inventory pincode must be a 6-digit Indian PIN code", () => {
  const { sanitize } = load("services/inventoryWorkflow.service.js", {}, "\nmodule.exports.sanitize = sanitizeInventoryPayload;");
  const base = { projectName: "QA", towerName: "Main", location: "Indore", type: "Sale", price: 100 };
  assert.throws(() => sanitize({ payload: { ...base, pincode: "4520" }, mode: "create" }), /6-digit/);
  assert.throws(() => sanitize({ payload: { ...base, pincode: "052001" }, mode: "create" }), /6-digit/);
  assert.equal(sanitize({ payload: { ...base, pincode: "452 001" }, mode: "create" }).pincode, "452001");
  assert.equal(sanitize({ payload: { ...base, pincode: "" }, mode: "create" }).pincode, "");
});

test("INV-19: a channel partner with inventory access off is refused by the API", () => {
  const { requirePartnerInventoryAccess } = require("../src/middleware/partnerInventoryAccess.middleware");
  const run = (user) => {
    const res = response();
    let passed = false;
    requirePartnerInventoryAccess({ user }, res, () => { passed = true; });
    return { passed, code: res.code };
  };
  assert.deepEqual(run({ role: "CHANNEL_PARTNER", canViewInventory: false }), { passed: false, code: 403 });
  assert.deepEqual(run({ role: "CHANNEL_PARTNER", canViewInventory: true }), { passed: true, code: 200 });
  assert.deepEqual(run({ role: "EXECUTIVE", canViewInventory: false }), { passed: true, code: 200 });
});

test("INV-14 / INV-25: partners never get owner contacts and their new property becomes a request", async () => {
  let requested = null;
  const controller = load("controllers/inventory.controller.js", {
    "../services/inventoryWorkflow.service": {
      getInventoryList: async () => ({
        rows: [{ _id: "1", projectName: "QA", ownerName: "Owner", ownerNumber: "9876500001", ownerWhatsappNumber: "9876500001", keyManagerNumber: "9876500002" }],
        totalCount: 1,
      }),
      getInventoryById: async () => ({ _id: "1", projectName: "QA", ownerName: "Owner", ownerNumber: "9876500001" }),
      createInventoryDirect: async () => { throw new Error("partner must not create directly"); },
      createInventoryCreateRequest: async ({ payload }) => { requested = payload; return { _id: "r1", type: "create", status: "pending" }; },
      updateInventoryDirect: async () => ({}),
      deleteInventoryDirect: async () => ({}),
      bulkCreateInventoryDirect: async () => ({}),
      getInventoryActivities: async () => [],
    },
  });
  const partner = { _id: "p1", companyId, role: "CHANNEL_PARTNER", canViewInventory: true };

  const listRes = response();
  await controller.getInventory({ query: {}, user: partner }, listRes);
  const listed = listRes.body.assets[0];
  assert.equal(listed.ownerNumber, "");
  assert.equal(listed.ownerName, "");
  assert.equal(listed.keyManagerNumber, "");
  assert.equal(listRes.body.inventory[0].ownerNumber, undefined);

  const detailRes = response();
  await controller.getInventoryById({ params: { id: "1" }, user: partner }, detailRes);
  assert.equal(detailRes.body.asset.ownerNumber, "");
  assert.equal(detailRes.body.inventory.ownerNumber, undefined);

  const createRes = response();
  await controller.createInventory({ body: { projectName: "Partner flat" }, user: partner, app: { get: () => null } }, createRes);
  assert.equal(createRes.code, 202);
  assert.equal(createRes.body.approvalRequired, true);
  assert.equal(requested.projectName, "Partner flat");

  const staffRes = response();
  await controller.getInventory({ query: {}, user: { ...partner, role: "EXECUTIVE" } }, staffRes);
  assert.equal(staffRes.body.assets[0].ownerNumber, "9876500001");
});

test("INV-14: a partner's own requests never carry the owner's contact details", async () => {
  const request = () => ({
    _id: "r1",
    type: "delete",
    proposedData: { projectName: "Partner office" },
    inventoryId: {
      _id: "i1",
      projectName: "Tower",
      ownerName: "Owner",
      ownerNumber: "9876500001",
      ownerWhatsappNumber: "9876500001",
      keyManagerName: "Key",
      keyManagerNumber: "9876500002",
    },
  });
  const controller = load("controllers/inventoryRequest.controller.js", {
    "../services/inventoryWorkflow.service": {
      createInventoryCreateRequest: async () => request(),
      createInventoryUpdateRequest: async () => request(),
      createInventoryDeleteRequest: async () => request(),
      getMyRequests: async () => [request()],
    },
  });

  const partnerRes = response();
  await controller.getMyInventoryRequests({ user: { role: "CHANNEL_PARTNER" } }, partnerRes);
  const partnerView = partnerRes.body.requests[0].inventoryId;
  assert.equal(partnerView.projectName, "Tower");
  assert.equal(partnerView.ownerNumber, undefined);
  assert.equal(partnerView.keyManagerNumber, undefined);

  const deleteRes = response();
  await controller.deleteRequest({ params: { inventoryId: "i1" }, body: {}, user: { role: "CHANNEL_PARTNER" }, app: { get: () => null } }, deleteRes);
  assert.equal(deleteRes.body.request.inventoryId.ownerName, undefined);

  const staffRes = response();
  await controller.getMyInventoryRequests({ user: { role: "EXECUTIVE" } }, staffRes);
  assert.equal(staffRes.body.requests[0].inventoryId.ownerNumber, "9876500001");
});
