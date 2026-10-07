const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const {
  QUICK_FILTER_KEYS,
  EMPTY_LEAD_FILTERS,
  dateKeyOffset,
  toLeadQueryParams,
  countActiveFilters,
  hasActiveFilters,
} = require("../.test-build/modules/leads/leadFilters.js");

/*
 * Filters go to the server, so what matters is the query these produce. The
 * quick-filter date arithmetic is the part most likely to drift from
 * LeadsMatrix.jsx, so each shortcut is pinned to an exact parameter set.
 */

// Fixed reference so the day maths cannot go flaky around midnight.
const NOW = new Date("2026-09-21T14:30:00").getTime();
const filters = (over = {}) => ({ ...EMPTY_LEAD_FILTERS, ...over });

describe("dateKeyOffset", () => {
  test("formats YYYY-MM-DD", () => {
    assert.equal(dateKeyOffset(0, NOW), "2026-09-21");
  });

  test("goes backwards and forwards", () => {
    assert.equal(dateKeyOffset(-1, NOW), "2026-09-20");
    assert.equal(dateKeyOffset(-7, NOW), "2026-09-14");
    assert.equal(dateKeyOffset(1, NOW), "2026-09-22");
  });

  test("crosses a month boundary", () => {
    const firstOfMonth = new Date("2026-09-01T12:00:00").getTime();
    assert.equal(dateKeyOffset(-1, firstOfMonth), "2026-08-31");
  });

  test("pads single-digit months and days", () => {
    const early = new Date("2026-01-05T12:00:00").getTime();
    assert.equal(dateKeyOffset(0, early), "2026-01-05");
  });
});

describe("toLeadQueryParams", () => {
  test("no filters produce no params", () => {
    assert.deepEqual(toLeadQueryParams(filters(), NOW), {});
  });

  test("ALL status is treated as no filter", () => {
    // "ALL" is the screen's word for unfiltered; the server would reject it.
    assert.deepEqual(toLeadQueryParams(filters({ status: "ALL" }), NOW), {});
  });

  test("ordinary filters pass straight through", () => {
    const params = toLeadQueryParams(
      filters({ status: "NEW", source: "META", assignedTo: "64b7f1a2c3d4e5f600000001" }),
      NOW,
    );
    assert.deepEqual(params, {
      status: "NEW",
      source: "META",
      assignedTo: "64b7f1a2c3d4e5f600000001",
    });
  });

  test("date ranges pass through", () => {
    const params = toLeadQueryParams(
      filters({ dateFrom: "2026-09-01", dateTo: "2026-09-30" }),
      NOW,
    );
    assert.deepEqual(params, { dateFrom: "2026-09-01", dateTo: "2026-09-30" });
  });
});

describe("quick filters expand into ordinary parameters", () => {
  test("UNASSIGNED_LEADS sets the sentinel the backend understands", () => {
    const params = toLeadQueryParams(
      filters({ quickFilter: QUICK_FILTER_KEYS.UNASSIGNED_LEADS }),
      NOW,
    );
    assert.deepEqual(params, { assignedTo: "UNASSIGNED" });
  });

  test("NEW_THIS_WEEK covers the trailing seven days", () => {
    const params = toLeadQueryParams(
      filters({ quickFilter: QUICK_FILTER_KEYS.NEW_THIS_WEEK }),
      NOW,
    );
    assert.deepEqual(params, { dateFrom: "2026-09-14", dateTo: "2026-09-21" });
  });

  test("NEEDS_FOLLOW_UP_TODAY pins both ends to today", () => {
    const params = toLeadQueryParams(
      filters({ quickFilter: QUICK_FILTER_KEYS.NEEDS_FOLLOW_UP_TODAY }),
      NOW,
    );
    assert.deepEqual(params, { followUpFrom: "2026-09-21", followUpTo: "2026-09-21" });
  });

  test("OVERDUE_FOLLOW_UPS is everything up to yesterday, with no lower bound", () => {
    const params = toLeadQueryParams(
      filters({ quickFilter: QUICK_FILTER_KEYS.OVERDUE_FOLLOW_UPS }),
      NOW,
    );
    assert.deepEqual(params, { followUpTo: "2026-09-20" });
  });

  test("a quick filter overrides a conflicting manual value", () => {
    const params = toLeadQueryParams(
      filters({
        assignedTo: "64b7f1a2c3d4e5f600000001",
        quickFilter: QUICK_FILTER_KEYS.UNASSIGNED_LEADS,
      }),
      NOW,
    );
    assert.equal(params.assignedTo, "UNASSIGNED");
  });

  test("a quick filter leaves unrelated filters alone", () => {
    const params = toLeadQueryParams(
      filters({ status: "NEW", quickFilter: QUICK_FILTER_KEYS.OVERDUE_FOLLOW_UPS }),
      NOW,
    );
    assert.equal(params.status, "NEW");
    assert.equal(params.followUpTo, "2026-09-20");
  });
});

describe("active filter count", () => {
  test("empty state counts zero", () => {
    assert.equal(countActiveFilters(filters()), 0);
    assert.equal(hasActiveFilters(filters()), false);
  });

  test("ALL status does not count", () => {
    assert.equal(countActiveFilters(filters({ status: "ALL" })), 0);
  });

  test("each set filter counts once", () => {
    const state = filters({ status: "NEW", source: "META", assignedTo: "x" });
    assert.equal(countActiveFilters(state), 3);
    assert.equal(hasActiveFilters(state), true);
  });

  test("a quick filter counts as one", () => {
    assert.equal(
      countActiveFilters(filters({ quickFilter: QUICK_FILTER_KEYS.NEW_THIS_WEEK })),
      1,
    );
  });
});
