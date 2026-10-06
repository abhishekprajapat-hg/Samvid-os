const assert = require("node:assert/strict");
const test = require("node:test");
const { buildProfileLeadScope } = require("../src/utils/profileLeadScope");

test("inside executive profile metrics use assignedTo", () => {
  assert.deepEqual(
    buildProfileLeadScope({ companyId: "company-1", userId: "user-1", role: "EXECUTIVE" }),
    { companyId: "company-1", assignedTo: "user-1" },
  );
});

test("field executive profile metrics include both assignment paths", () => {
  assert.deepEqual(
    buildProfileLeadScope({ companyId: "company-1", userId: "user-1", role: "FIELD_EXECUTIVE" }),
    {
      companyId: "company-1",
      $or: [
        { assignedTo: "user-1" },
        { assignedFieldExecutive: "user-1" },
      ],
    },
  );
});
