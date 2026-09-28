const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  parseContactCsv,
  rowsFromMatrix,
  normalizeContactPhone,
  validateContact,
  CONTACT_TEMPLATE_CSV,
} = require("../.test-build/modules/inventory/contactBulkImport.js");

/* Contact import and validation, ported from web's contactBulkImport.js and ContactFormDialog. */

test("headers are matched by meaning", () => {
  const rows = parseContactCsv('Owner Name,Mobile No.,Firm,Remarks\n"Rao, K",09876543210,Rao Realty,call after 6\n');
  assert.equal(rows[0].name, "Rao, K");
  assert.equal(rows[0].phone, "09876543210");
  assert.equal(rows[0].company, "Rao Realty");
  assert.equal(rows[0].notes, "call after 6");
});

test("a sheet without a phone column is refused", () => {
  assert.throws(() => rowsFromMatrix([["Name", "City"], ["Ravi", "Indore"]]), /name column and a phone column/);
});

test("the template parses as its own import", () => {
  const rows = parseContactCsv(CONTACT_TEMPLATE_CSV);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].propertyDetails, "2 shops on MG Road");
});

test("phones normalise as the server does", () => {
  assert.equal(normalizeContactPhone("+91 98765 43210"), "9876543210");
  assert.equal(normalizeContactPhone("09876543210"), "9876543210");
  assert.equal(normalizeContactPhone("123"), "");
});

test("validation names each bad field", () => {
  assert.deepEqual(validateContact({ name: "", phone: "12", email: "x@" }), {
    name: "Name is required",
    phone: "Enter a valid phone number",
    email: "Enter a valid email address",
  });
});
