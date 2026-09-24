const test = require("node:test");
const assert = require("node:assert/strict");
const { applyLeadAdvancedFilters } = require("../src/utils/leadAdvancedFilters");

test("advanced filters retain tenant and assignment scope and escape text", () => {
  const query = { companyId: "tenant", assignedTo: "employee", $and: [{ "requirements.inventoryType": "COMMERCIAL" }] };
  applyLeadAdvancedFilters(query, { inventoryType: "RESIDENTIAL", city: "Indore.*", project: "A+B", transactionType: "RENT", subtype: "OFFICE" });
  assert.equal(query.companyId, "tenant");
  assert.equal(query.assignedTo, "employee");
  assert.deepEqual(query.$and[0], { "requirements.inventoryType": "COMMERCIAL" });
  assert.ok(query.$and.some((clause) => clause["requirements.inventoryType"] === "RESIDENTIAL"));
  assert.equal(query.$and.find((clause) => clause.city).city.$regex, "Indore\\.\\*");
  assert.equal(query.$and.find((clause) => clause.projectInterested).projectInterested.$regex, "A\\+B");
});

test("date ranges cover whole India calendar days, including the final day", () => {
  const query = {};
  applyLeadAdvancedFilters(query, { createdFrom: "2026-09-10", createdTo: "2026-09-10", followUpDateTo: "2026-09-11" });
  assert.equal(query.$and[0].createdAt.$gte.toISOString(), "2026-09-09T18:30:00.000Z");
  assert.equal(query.$and[0].createdAt.$lte.toISOString(), "2026-09-10T18:29:59.999Z");
  assert.equal(query.$and[1].nextFollowUp.$lte.toISOString(), "2026-09-11T18:29:59.999Z");
});

test("invalid and reversed ranges are rejected instead of silently ignored", () => {
  for (const values of [{ budgetMin: "-1" }, { budgetMin: "abc" }, { budgetMin: "20", budgetMax: "10" }, { createdFrom: "2026-02-30" }, { createdFrom: "2026-09-12", createdTo: "2026-09-10" }, { assignedTo: "unknown" }, { inventoryType: "BOTH" }]) {
    assert.throws(() => applyLeadAdvancedFilters({}, values), (error) => error.statusCode === 400);
  }
});

test("budget filters use overlapping known ranges and permit zero", () => {
  const query = {};
  applyLeadAdvancedFilters(query, { budgetMin: "0", budgetMax: "50000" });
  const expr = query.$and[0].$expr.$and;
  assert.equal(expr.length, 4);
  assert.deepEqual(expr[2], { $gte: [{ $ifNull: ["$requirements.budgetMax", "$requirements.budgetMin"] }, 0] });
  assert.deepEqual(expr[3], { $lte: [{ $ifNull: ["$requirements.budgetMin", "$requirements.budgetMax"] }, 50000] });
  assert.equal(expr[0].$ne[1], null);
});
