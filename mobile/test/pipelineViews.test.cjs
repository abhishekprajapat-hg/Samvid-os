const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const {
  PIPELINE_VIEWS,
  isNeedsAction,
  isUnassigned,
  matchesView,
  countNeedsAction,
  describeFollowUp,
  formatBudgetShort,
  formatBudgetRange,
} = require("../.test-build/modules/leads/pipelineViews.js");

/*
 * The pipeline view rules, ported from
 * frontend/src/modules/leads/components/pipelineViews.js.
 *
 * "Needs action" decides what a salesperson opens to every morning, so the
 * boundaries - a follow-up later today, one earlier today, none at all, a lead
 * already closed - are pinned here rather than left to drift.
 */

// A fixed "now" so the day-boundary cases cannot go flaky at midnight.
const NOW = new Date("2026-09-21T14:30:00").getTime();
const at = (iso) => new Date(iso).getTime();

const lead = (over = {}) => ({ status: "NEW", nextFollowUp: null, assignedTo: null, ...over });

describe("isNeedsAction", () => {
  test("an overdue follow-up needs action", () => {
    assert.equal(isNeedsAction(lead({ nextFollowUp: "2026-09-20T10:00:00" }), NOW), true);
  });

  test("a follow-up earlier today needs action", () => {
    assert.equal(isNeedsAction(lead({ nextFollowUp: "2026-09-21T09:00:00" }), NOW), true);
  });

  test("a follow-up later today still needs action", () => {
    // The rule is end-of-day, not now: work due today is today's work.
    assert.equal(isNeedsAction(lead({ nextFollowUp: "2026-09-21T23:00:00" }), NOW), true);
  });

  test("a follow-up tomorrow does not", () => {
    assert.equal(isNeedsAction(lead({ nextFollowUp: "2026-09-22T09:00:00" }), NOW), false);
  });

  test("no follow-up is not needs-action", () => {
    // Unscheduled work belongs to the All view, not this one.
    assert.equal(isNeedsAction(lead({ nextFollowUp: null }), NOW), false);
  });

  for (const status of ["CLOSED", "LOST", "INVALID"]) {
    test(`${status} is never needs-action, even when overdue`, () => {
      assert.equal(
        isNeedsAction(lead({ status, nextFollowUp: "2026-09-01T09:00:00" }), NOW),
        false,
      );
    });
  }

  test("a null lead does not throw", () => {
    assert.equal(isNeedsAction(null, NOW), false);
  });
});

describe("isUnassigned", () => {
  test("no assignedTo at all", () => {
    assert.equal(isUnassigned(lead()), true);
  });

  test("an assignedTo with neither id nor name still counts as unassigned", () => {
    assert.equal(isUnassigned(lead({ assignedTo: {} })), true);
  });

  test("an id is enough to be assigned", () => {
    assert.equal(isUnassigned(lead({ assignedTo: { _id: "u1" } })), false);
  });

  test("a name alone is enough to be assigned", () => {
    assert.equal(isUnassigned(lead({ assignedTo: { name: "Asha" } })), false);
  });
});

describe("matchesView", () => {
  const overdue = lead({ nextFollowUp: "2026-09-19T09:00:00" });
  const closed = lead({ status: "CLOSED", assignedTo: { _id: "u1" } });
  const assigned = lead({ assignedTo: { _id: "u1" } });

  test("NEEDS_ACTION follows the needs-action rule", () => {
    assert.equal(matchesView(overdue, PIPELINE_VIEWS.NEEDS_ACTION, NOW), true);
    assert.equal(matchesView(assigned, PIPELINE_VIEWS.NEEDS_ACTION, NOW), false);
  });

  test("UNASSIGNED follows the unassigned rule", () => {
    assert.equal(matchesView(lead(), PIPELINE_VIEWS.UNASSIGNED, NOW), true);
    assert.equal(matchesView(assigned, PIPELINE_VIEWS.UNASSIGNED, NOW), false);
  });

  test("CLOSED matches only CLOSED, not other terminal statuses", () => {
    assert.equal(matchesView(closed, PIPELINE_VIEWS.CLOSED, NOW), true);
    assert.equal(matchesView(lead({ status: "LOST" }), PIPELINE_VIEWS.CLOSED, NOW), false);
  });

  test("ALL and TEAM admit everything", () => {
    for (const view of [PIPELINE_VIEWS.ALL, PIPELINE_VIEWS.TEAM]) {
      assert.equal(matchesView(closed, view, NOW), true);
      assert.equal(matchesView(overdue, view, NOW), true);
    }
  });
});

describe("countNeedsAction", () => {
  test("counts only the leads that qualify", () => {
    const leads = [
      lead({ nextFollowUp: "2026-09-19T09:00:00" }), // overdue
      lead({ nextFollowUp: "2026-09-21T20:00:00" }), // later today
      lead({ nextFollowUp: "2026-09-25T09:00:00" }), // future
      lead({ status: "CLOSED", nextFollowUp: "2026-09-01T09:00:00" }), // terminal
      lead(), // no follow-up
    ];
    assert.equal(countNeedsAction(leads, NOW), 2);
  });

  test("an empty pipeline counts zero", () => {
    assert.equal(countNeedsAction([], NOW), 0);
  });
});

describe("describeFollowUp", () => {
  test("no date reads as an em dash", () => {
    assert.deepEqual(describeFollowUp(null, NOW), { text: "—", tone: "none" });
  });

  test("a past date reports how late it is", () => {
    const result = describeFollowUp("2026-09-19T09:00:00", NOW);
    assert.equal(result.tone, "overdue");
    assert.equal(result.text, "2d late");
  });

  test("earlier today is overdue, later today is not", () => {
    assert.equal(describeFollowUp("2026-09-21T09:00:00", NOW).tone, "overdue");
    assert.equal(describeFollowUp("2026-09-21T20:00:00", NOW).tone, "today");
  });

  test("a future date reads as a day and month", () => {
    const result = describeFollowUp("2026-09-25T09:00:00", NOW);
    assert.equal(result.tone, "future");
    assert.match(result.text, /25/);
  });
});

describe("budget formatting", () => {
  test("scales to crore, lakh and thousand", () => {
    assert.equal(formatBudgetShort(25000000), "₹2.50 Cr");
    assert.equal(formatBudgetShort(500000), "₹5.00 L");
    assert.equal(formatBudgetShort(45000), "₹45 K");
    assert.equal(formatBudgetShort(700), "₹700");
  });

  test("zero, negative and junk produce nothing", () => {
    for (const value of [0, -5, null, undefined, "abc"]) {
      assert.equal(formatBudgetShort(value), "");
    }
  });

  test("a range prefers the maximum, then the minimum", () => {
    assert.equal(formatBudgetRange({ budgetMin: 100000, budgetMax: 500000 }), "₹5.00 L");
    assert.equal(formatBudgetRange({ budgetMin: 100000 }), "₹1.00 L");
    assert.equal(formatBudgetRange({}), "—");
  });
});
