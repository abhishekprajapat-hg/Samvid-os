const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const {
  parseBulkLeadCsvRows,
  parseBulkLeadRowsFromMatrix,
  resolveLeadCsvHeaderKey,
  resolveBulkLeadStatus,
  normalizeBulkAmount,
  shouldSkipWorkbookSheet,
  buildLeadExportCsv,
} = require("../.test-build/modules/leads/bulkLeadUpload.js");

/*
 * Bulk lead parsing, ported verbatim from web's LeadsMatrix.jsx. The same file
 * uploaded from the phone must create the same leads as from the desk, so the
 * header aliases, the status guessing and the amount units are pinned here.
 */

describe("headers", () => {
  test("aliases resolve as web resolves them", () => {
    assert.equal(resolveLeadCsvHeaderKey("Mobile No"), "phone");
    assert.equal(resolveLeadCsvHeaderKey("Client Name"), "name");
    assert.equal(resolveLeadCsvHeaderKey("Follow Up Date"), "followUp");
    assert.equal(resolveLeadCsvHeaderKey("Lead Stutas"), "status");
    assert.equal(resolveLeadCsvHeaderKey("Unrelated"), "");
  });
});

describe("parseBulkLeadCsvRows", () => {
  test("a minimal CSV becomes one commercial rent lead", () => {
    const rows = parseBulkLeadCsvRows("name,phone,city\nRavi,+91 98765 43210,Indore");
    assert.equal(rows.length, 1);
    assert.equal(rows[0].phone, "9876543210");
    assert.equal(rows[0].requirements.inventoryType, "COMMERCIAL");
    assert.equal(rows[0].requirements.transactionType, "RENT");
    assert.equal(rows[0].source, "MANUAL");
  });

  test("a residential sheet reads BHK and amenities", () => {
    const rows = parseBulkLeadCsvRows("name,phone,bhk,amenities\nAsha,9876500000,2bhk,Gym and pool", "RESIDENTIAL");
    assert.equal(rows[0].requirements.inventoryType, "RESIDENTIAL");
    assert.equal(rows[0].requirements.residential.bhkType, "2BHK");
    assert.equal(rows[0].requirements.residential.amenities.gym, true);
    assert.equal(rows[0].requirements.residential.amenities.swimmingPool, true);
  });

  test("quoted commas survive", () => {
    const rows = parseBulkLeadCsvRows('name,phone,comment\n"Rao, K",9876500001,"call back, evening"');
    assert.equal(rows[0].name, "Rao, K");
    assert.equal(rows[0].status, "CONTACTED");
  });

  test("a CSV without name and phone columns is refused", () => {
    assert.throws(() => parseBulkLeadCsvRows("city,budget\nIndore,5L"), /name and phone/);
  });

  test("rows without a usable phone are dropped", () => {
    assert.throws(() => parseBulkLeadCsvRows("name,phone\nNo Phone,12345"), /No valid lead rows/);
  });
});

describe("rules", () => {
  test("amounts read lakh and k", () => {
    assert.equal(normalizeBulkAmount("5 lakh"), 500000);
    // Web's rule wants the unit as its own word: "40 k" is forty thousand, and
    // "40k" stays 40 - on web too, so it is kept rather than quietly fixed.
    assert.equal(normalizeBulkAmount("40 k"), 40000);
    assert.equal(normalizeBulkAmount("40k"), 40);
    assert.equal(normalizeBulkAmount("1,20,000"), 120000);
  });

  test("status is guessed from the sheet name and remarks", () => {
    assert.equal(resolveBulkLeadStatus({ sheetName: "Deal Closed", row: {} }), "CLOSED");
    assert.equal(resolveBulkLeadStatus({ sheetName: "", row: { comment: "not picking" } }), "NOT_PICKING_CALLS");
    assert.equal(resolveBulkLeadStatus({ sheetName: "", row: {} }), "NEW");
  });

  test("a workbook's header row can sit below a title", () => {
    const rows = parseBulkLeadRowsFromMatrix({
      matrix: [["March leads"], ["Name", "Phone"], ["Kiran", "9000000001"]],
      sheetName: "March",
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].name, "Kiran");
  });

  test("performance and broker sheets are skipped", () => {
    assert.equal(shouldSkipWorkbookSheet("Team Performance"), true);
    assert.equal(shouldSkipWorkbookSheet("Broker"), true);
    assert.equal(shouldSkipWorkbookSheet("Leads"), false);
  });
});

test("export CSV has web's columns", () => {
  const csv = buildLeadExportCsv(
    [{ name: "Ravi", phone: "9876543210", status: "SITE_VISIT", assignedTo: { name: "Neha" } }],
    (status) => (status === "SITE_VISIT" ? "Site Visit" : status),
    () => "",
  );
  const [header, row] = csv.split("\n");
  assert.equal(header, '"Name","Phone","Email","Status","City","Assigned to","Next follow-up"');
  assert.equal(row, '"Ravi","9876543210","","Site Visit","","Neha",""');
});
