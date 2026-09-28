const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const {
  buildSummary,
  buildStatRows,
  buildExecutiveRows,
  buildLostRows,
  buildSourceMix,
  buildMonthlyBars,
  buildIntelligenceCsv,
  countTransferred,
  getLeadRangeDate,
  getLeadRevenue,
  resolveRangeBounds,
  formatSignedDelta,
  formatCurrencyCompact,
  parseLocalDateInput,
} = require("../.test-build/modules/reports/intelligence.js");

/*
 * Web's Intelligence Reports arithmetic, ported to the phone. Each case below
 * is a rule web applies; if one moves, the two apps show different numbers
 * for the same period.
 */

const day = (iso) => new Date(iso).toISOString();

describe("range bounds", () => {
  const now = new Date(2026, 8, 28); // 28 Sep 2026

  test("this month runs from the 1st to the last millisecond of the month", () => {
    const { start, end } = resolveRangeBounds({ rangeKey: "THIS_MONTH", customRange: {}, now });
    assert.equal(start.getDate(), 1);
    assert.equal(start.getMonth(), 8);
    assert.equal(end.getDate(), 30);
    assert.equal(end.getHours(), 23);
  });

  test("previous quarter is the three months before this one", () => {
    const { start, end } = resolveRangeBounds({ rangeKey: "QUARTER", customRange: {}, offset: -1, now });
    assert.equal(start.getMonth(), 3);
    assert.equal(end.getMonth(), 5);
  });

  test("custom accepts only real YYYY-MM-DD dates", () => {
    assert.equal(parseLocalDateInput("2026-02-30"), null);
    const { start, end } = resolveRangeBounds({ rangeKey: "CUSTOM", customRange: { startDate: "2026-09-01", endDate: "bad" }, now });
    assert.equal(start.getDate(), 1);
    assert.equal(end, null);
  });
});

describe("which period a lead belongs to", () => {
  test("a closed lead counts when it closed, an open one when it arrived", () => {
    const closed = { status: "CLOSED", createdAt: day("2026-06-01"), updatedAt: day("2026-09-10") };
    const open = { status: "NEW", createdAt: day("2026-06-01"), updatedAt: day("2026-09-10") };
    assert.equal(getLeadRangeDate(closed).getMonth(), 8);
    assert.equal(getLeadRangeDate(open).getMonth(), 5);
  });
});

describe("summary", () => {
  const leads = [
    { status: "CLOSED", createdAt: day("2026-09-01"), updatedAt: day("2026-09-11"), brokerageReceived: 50000 },
    { status: "CLOSED", createdAt: day("2026-09-01"), updatedAt: day("2026-09-21"), inventoryId: { saleDetails: { totalAmount: 200000, remainingAmount: 50000 } } },
    { status: "SITE_VISIT_SCHEDULED", source: "META", adSpend: 300 },
    { status: "NEW", source: "META", campaignSpend: 100 },
  ];

  test("conversion, days to close, revenue and cost per lead follow web", () => {
    const summary = buildSummary(leads);
    assert.equal(summary.received, 4);
    assert.equal(summary.closed, 2);
    assert.equal(summary.visits, 1);
    assert.equal(summary.conversion, 50);
    assert.equal(Math.round(summary.avgDaysToClose), 15);
    assert.equal(summary.revenue, 50000 + 150000);
    assert.equal(summary.costPerLead, 200);
  });

  test("revenue prefers brokerage received over the sale's paid part", () => {
    assert.equal(getLeadRevenue({ brokerageReceived: 10, inventoryId: { price: 999 } }), 10);
    assert.equal(getLeadRevenue({ relatedInventoryIds: [{ price: 999 }] }), 999);
  });

  test("no Meta spend means no cost per lead, shown as a dash", () => {
    const rows = buildStatRows(buildSummary([{ status: "NEW" }]), buildSummary([]));
    assert.equal(rows.find((row) => row.key === "Cost per lead").value, "-");
    assert.equal(rows[0].delta.text, "No previous data");
  });

  test("fewer days to close reads as an improvement", () => {
    const delta = formatSignedDelta(5, 8, { suffix: " days", inverse: true });
    assert.equal(delta.tone, "up");
    assert.equal(delta.text, "▼ 3 days");
  });

  test("lakh formatting matches web, trailing zero included", () => {
    /* Web strips only an all-zero fraction, so 2.50 keeps its zero. */
    assert.equal(formatCurrencyCompact(250000), "₹2.50 L");
    assert.equal(formatCurrencyCompact(1500000), "₹15 L");
  });
});

describe("breakdowns", () => {
  const a = { _id: "a", name: "Asha" };
  const b = { _id: "b", name: "Bilal" };
  const leads = [
    { assignedTo: a, status: "CLOSED", source: "META" },
    { assignedTo: a, status: "SITE_VISIT" },
    { assignedTo: b, status: "LOST", source: "MANUAL" },
    { assignedTo: b, status: "NOT_PICKING_CALLS", assignmentHistory: [{ action: "MANUAL_TRANSFER" }] },
    { status: "INVALID" },
  ];

  test("executives rank by closures, then visits, then leads", () => {
    const rows = buildExecutiveRows(leads);
    assert.deepEqual(rows.map((row) => row.name), ["Asha", "Bilal", "Unassigned"]);
    assert.equal(rows[0].conversion, 50);
  });

  test("lost reasons use web's labels", () => {
    const labels = buildLostRows(leads).map((row) => row.label).sort();
    assert.deepEqual(labels, ["Invalid number", "Lost", "Not picking calls"]);
  });

  test("sources are named as web names them", () => {
    const mix = buildSourceMix(leads);
    assert.ok(mix.some((row) => row.label === "Meta ads"));
    assert.ok(mix.some((row) => row.label === "Manual entry"));
  });

  test("transfers are read from the assignment history", () => {
    assert.equal(countTransferred(leads), 1);
  });

  test("six months of bars, oldest first", () => {
    const bars = buildMonthlyBars([], new Date(2026, 8, 28));
    assert.equal(bars.length, 6);
    assert.ok(bars.every((row) => row.leadHeight === 8 && row.closedHeight === 6));
  });

  test("CSV carries web's rows with quoted cells", () => {
    const csv = buildIntelligenceCsv({
      summary: buildSummary(leads),
      transferred: 1,
      executives: buildExecutiveRows(leads),
      lost: buildLostRows(leads),
    });
    const lines = csv.split("\n");
    assert.equal(lines[0], '"Section","Metric","Value"');
    assert.equal(lines[2], '"Summary","Transferred leads","1"');
    assert.ok(lines.some((line) => line.startsWith('"Executive performance","Asha"')));
    assert.ok(lines.some((line) => line.startsWith('"Where leads are lost"')));
  });
});
