const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createRequire } = require("node:module");

const companyId = "aaaaaaaaaaaaaaaaaaaaaaaa";
const userId = "bbbbbbbbbbbbbbbbbbbbbbbb";

// Objects built inside the vm realm are never deepStrictEqual to plain ones,
// so compare the shape rather than the references.
const plain = (value) => JSON.parse(JSON.stringify(value));

const response = () => ({
  code: 200,
  body: null,
  status(code) { this.code = code; return this; },
  json(body) { this.body = body; return this; },
});

// Run the real controller against isolated stubs; never connect to a database.
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

const loadNormalizer = () => load(
  "controllers/lead.controller.js",
  {},
  "\nmodule.exports.normalizeCoworking = normalizeCoworkingRequirements;"
  + "\nmodule.exports.typeClause = buildLeadTypeClause;",
);

test("a coworking enquiry keeps one entry per cabin, in order", () => {
  const { normalizeCoworking } = loadNormalizer();
  const result = normalizeCoworking({ cabins: [{ seats: 4 }, { seats: 9 }, { seats: 6 }] });
  assert.deepEqual(plain(result.cabins), [{ seats: 4 }, { seats: 9 }, { seats: 6 }]);
});

test("cabin seat counts outside the allowed range are dropped, not clamped", () => {
  const { normalizeCoworking } = loadNormalizer();
  const result = normalizeCoworking({ cabins: [{ seats: 0 }, { seats: 6 }, { seats: 500 }, { seats: "x" }] });
  assert.deepEqual(plain(result.cabins), [{ seats: 6 }]);
});

test("a malformed payload cannot store an enquiry for thousands of cabins", () => {
  const { normalizeCoworking } = loadNormalizer();
  const result = normalizeCoworking({ cabins: Array.from({ length: 9000 }, () => ({ seats: 4 })) });
  assert.equal(result.cabins.length, 50);
});

test("terms accept their real ranges and reject values beyond them", () => {
  const { normalizeCoworking } = loadNormalizer();
  const accepted = normalizeCoworking({
    workstations: 40, depositMonths: 6, agreedRent: 125000, noticePeriodMonths: 3, lockInMonths: 24,
  });
  assert.equal(accepted.workstations, 40);
  assert.equal(accepted.depositMonths, 6);
  assert.equal(accepted.agreedRent, 125000);
  assert.equal(accepted.noticePeriodMonths, 3);
  assert.equal(accepted.lockInMonths, 24);

  const rejected = normalizeCoworking({
    depositMonths: 600, agreedRent: -1, noticePeriodMonths: 61, lockInMonths: 121,
  });
  assert.equal(rejected.depositMonths, null);
  assert.equal(rejected.agreedRent, null);
  assert.equal(rejected.noticePeriodMonths, null);
  assert.equal(rejected.lockInMonths, null);
});

test("a coworking user's lead scope is coworking only, never the commercial pipeline", () => {
  const { typeClause } = loadNormalizer();
  assert.deepEqual(plain(typeClause("COWORKING")), { "requirements.inventoryType": "COWORKING" });
  // The commercial fallback is what coworking must not inherit.
  assert.ok(typeClause("COMMERCIAL").$or, "commercial still matches blank inventory types");
  assert.equal(typeClause("COWORKING").$or, undefined);
});

const query = (value = null) => ({
  select() { return this; }, populate() { return this; }, sort() { return this; },
  lean() { return Promise.resolve(value); },
  then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); },
});

const createLeadStubs = (saved) => ({
  "../models/Lead": {
    create: async (doc) => { saved.push(doc); return { ...doc, _id: "cccccccccccccccccccccccc" }; },
    findOne: () => query(),
    findById: () => query(),
  },
  "../models/Inventory": { findById: () => query() },
  // Without this the real model buffers against a database that is not there,
  // and the request 500s ten seconds after the lead was already built.
  "../models/leadActivity.model": { create: async () => ({}) },
  "../services/crmContact.service": {
    findBrokerByPhone: async () => null,
    recordBlockedLead: async () => null,
  },
  "../services/leadAssignment.service": { buildCreatorLeadAssignment: async () => ({}) },
});

test("a coworking lead stores its cabins, company and lead source", async () => {
  const saved = [];
  const controller = load("controllers/lead.controller.js", createLeadStubs(saved));
  const res = response();
  await controller.createLead({
    user: { _id: userId, companyId, role: "EXECUTIVE", roleType: "COWORKING" },
    body: {
      name: "Nimbus Labs",
      phone: "9876543210",
      company: "Nimbus Labs Pvt Ltd",
      sourceChannel: "justdial",
      requirements: {
        inventoryType: "COWORKING",
        coworking: { cabins: [{ seats: 4 }, { seats: 8 }], workstations: 12, depositMonths: 3 },
      },
    },
  }, res);

  assert.equal(res.code, 201, `createLead answered ${res.code}: ${JSON.stringify(res.body)}`);
  assert.equal(saved.length, 1);
  const lead = saved[0];
  assert.equal(lead.company, "Nimbus Labs Pvt Ltd");
  // Lowercase in, enum value out - the form sends whatever the option carried.
  assert.equal(lead.sourceChannel, "JUSTDIAL");
  assert.equal(lead.requirements.inventoryType, "COWORKING");
  assert.deepEqual(plain(lead.requirements.coworking.cabins), [{ seats: 4 }, { seats: 8 }]);
  assert.equal(lead.requirements.coworking.workstations, 12);
  assert.equal(lead.requirements.coworking.depositMonths, 3);
});

test("an unrecognised lead source is stored blank rather than written through", async () => {
  const saved = [];
  const controller = load("controllers/lead.controller.js", createLeadStubs(saved));
  const res = response();
  await controller.createLead({
    user: { _id: userId, companyId, role: "ADMIN", roleType: "BOTH" },
    body: { name: "Walk in", phone: "9812345670", sourceChannel: "<script>alert(1)</script>" },
  }, res);
  assert.equal(res.code, 201, `createLead answered ${res.code}: ${JSON.stringify(res.body)}`);
  assert.equal(saved[0].sourceChannel, "");
});

test("a commercial user cannot file a coworking lead", async () => {
  const saved = [];
  const controller = load("controllers/lead.controller.js", createLeadStubs(saved));
  const res = response();
  await controller.createLead({
    user: { _id: userId, companyId, role: "EXECUTIVE", roleType: "COMMERCIAL" },
    body: { name: "Nimbus", phone: "9876500000", requirements: { inventoryType: "COWORKING" } },
  }, res);
  assert.equal(saved.length, 0);
  assert.equal(res.code, 403);
});

test("the Lead schema accepts the values the coworking form produces", () => {
  const Lead = require("../src/models/Lead");
  const paths = Lead.schema.paths;
  assert.ok(paths["requirements.inventoryType"].enumValues.includes("COWORKING"));
  assert.ok(paths.sourceChannel.enumValues.includes("MYBRICKS"));
  assert.ok(paths.company, "company is stored on the lead");
  assert.ok(paths["requirements.coworking.agreedRent"], "agreed rent is stored");
  assert.ok(Lead.schema.path("requirements.coworking.cabins"), "cabins are stored as a list");
});

/*
 * Editing a coworking lead has to round-trip the same fields the create path
 * accepts. It is a separate controller, so the two can drift apart - which is
 * exactly what happened before: the edit modal sent company and sourceChannel
 * and the server quietly dropped both.
 */
const editStubs = (lead) => ({
  "../models/Lead": {
    findOne: () => ({
      select() { return this; },
      populate() { return this; },
      lean: async () => ({ _id: "dddddddddddddddddddddddd", companyId }),
      then: (resolve) => Promise.resolve(lead).then(resolve),
    }),
    findById: () => query(),
  },
  "../models/Inventory": { findOne: () => query(), findById: () => query() },
  "../models/leadActivity.model": { create: async () => ({}) },
  "../services/crmContact.service": { findBrokerByPhone: async () => null, recordBlockedLead: async () => null },
});

const editableLead = () => ({
  _id: "dddddddddddddddddddddddd",
  companyId,
  name: "Nimbus Labs",
  phone: "9876543210",
  status: "NEW",
  company: "",
  sourceChannel: "",
  requirements: { inventoryType: "COWORKING" },
  save: async function save() { this.saved = true; return this; },
});

test("editing a coworking lead keeps its company and lead source", async () => {
  const lead = editableLead();
  const controller = load("controllers/lead.controller.js", editStubs(lead));
  const res = response();
  await controller.updateLeadStatus({
    params: { leadId: "dddddddddddddddddddddddd" },
    user: { _id: userId, companyId, role: "ADMIN", roleType: "BOTH" },
    body: {
      status: "NEW",
      company: "Nimbus Labs Pvt Ltd",
      sourceChannel: "mybricks",
      requirements: {
        inventoryType: "COWORKING",
        coworking: { cabins: [{ seats: 6 }], lockInMonths: 12 },
      },
    },
  }, res);

  assert.equal(lead.company, "Nimbus Labs Pvt Ltd");
  assert.equal(lead.sourceChannel, "MYBRICKS");
  assert.deepEqual(plain(lead.requirements.coworking.cabins), [{ seats: 6 }]);
  assert.equal(lead.requirements.coworking.lockInMonths, 12);
});

test("an edit cannot write an unrecognised lead source", async () => {
  const lead = editableLead();
  lead.sourceChannel = "OLX";
  const controller = load("controllers/lead.controller.js", editStubs(lead));
  const res = response();
  await controller.updateLeadStatus({
    params: { leadId: "dddddddddddddddddddddddd" },
    user: { _id: userId, companyId, role: "ADMIN", roleType: "BOTH" },
    body: { status: "NEW", sourceChannel: "MADE_UP" },
  }, res);
  assert.equal(lead.sourceChannel, "");
});

/*
 * A box nobody filled in is not a zero.
 *
 * The form sends null for an empty field, and Number(null) is 0 - so a blank
 * deposit was stored as a nought-month deposit and a blank rent as an agreed
 * ₹0. Those read back as terms that were negotiated, which is a different
 * claim from "not answered yet".
 */
test("an unanswered coworking term stays unanswered rather than becoming zero", () => {
  const { normalizeCoworking } = loadNormalizer();

  const blank = normalizeCoworking({
    cabins: [{ seats: 4 }],
    workstations: null, depositMonths: null, agreedRent: null,
    noticePeriodMonths: null, lockInMonths: null,
  });
  assert.equal(blank.workstations, null);
  assert.equal(blank.depositMonths, null);
  assert.equal(blank.agreedRent, null);
  assert.equal(blank.noticePeriodMonths, null);
  assert.equal(blank.lockInMonths, null);

  // An empty string is the same "not answered", and an absent key too.
  assert.equal(normalizeCoworking({ agreedRent: "" }).agreedRent, null);
  assert.equal(normalizeCoworking({}).depositMonths, null);
});

test("a deliberate zero is still stored as zero", () => {
  const { normalizeCoworking } = loadNormalizer();
  const zeroed = normalizeCoworking({
    workstations: 0, depositMonths: 0, agreedRent: 0, noticePeriodMonths: 0, lockInMonths: 0,
  });
  assert.equal(zeroed.workstations, 0);
  assert.equal(zeroed.depositMonths, 0);
  assert.equal(zeroed.agreedRent, 0);
  assert.equal(zeroed.noticePeriodMonths, 0);
  assert.equal(zeroed.lockInMonths, 0);
});
