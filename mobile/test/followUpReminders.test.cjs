const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const {
  getReminderBucket,
  getTimeLeftText,
  pickActiveReminder,
  upcomingNotificationKeys,
} = require("../.test-build/modules/leads/followUpReminders.js");

/*
 * Follow-up reminder rules, ported from web's FollowUpReminderToast. The
 * buckets decide when a reminder comes back after being dismissed, so their
 * edges are pinned.
 */

const NOW = new Date("2026-09-25T10:00:00Z").getTime();
const MIN = 60 * 1000;
const lead = (offsetMin, over = {}) => ({
  _id: `l${offsetMin}`,
  name: "Ravi",
  status: "CONTACTED",
  nextFollowUp: new Date(NOW + offsetMin * MIN).toISOString(),
  ...over,
});

describe("buckets", () => {
  test("edges", () => {
    assert.equal(getReminderBucket(-2 * MIN), "overdue");
    assert.equal(getReminderBucket(0), "due");
    assert.equal(getReminderBucket(10 * MIN), "15m");
    assert.equal(getReminderBucket(25 * MIN), "30m");
    assert.equal(getReminderBucket(50 * MIN), "60m");
    assert.equal(getReminderBucket(90 * MIN), "");
  });

  test("time-left text reads as web's does", () => {
    assert.equal(getTimeLeftText(0), "Due now");
    assert.equal(getTimeLeftText(25 * MIN), "25 min left");
    assert.equal(getTimeLeftText(-90 * MIN), "1h 30m overdue");
  });
});

describe("pickActiveReminder", () => {
  test("overdue beats upcoming", () => {
    const pick = pickActiveReminder([lead(20), lead(-5)], NOW, []);
    assert.equal(pick._id, "l-5");
  });

  test("closed leads never remind", () => {
    assert.equal(pickActiveReminder([lead(5, { status: "CLOSED" })], NOW, []), null);
  });

  test("dismissing one bucket lets the next one through", () => {
    const first = pickActiveReminder([lead(25)], NOW, []);
    assert.equal(first._reminderBucket, "30m");
    const later = pickActiveReminder([lead(25)], NOW + 15 * MIN, [first._reminderKey]);
    assert.equal(later._reminderBucket, "15m");
  });

  test("a follow-up over a day old has aged out", () => {
    assert.equal(pickActiveReminder([lead(-25 * 60)], NOW, []), null);
  });
});

test("device notifications cover only future follow-ups in the next hour", () => {
  const keys = upcomingNotificationKeys([lead(-5), lead(30), lead(120), lead(10, { status: "LOST" })], NOW);
  assert.deepEqual(keys.map((item) => item.lead._id), ["l30"]);
});
