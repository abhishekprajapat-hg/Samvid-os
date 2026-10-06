import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMonthCalendarCells,
  canScheduleLeadFollowUp,
  isPendingCalendarFollowUp,
  isUnpaidCollectionLead,
  toCalendarDateKey,
} from "../src/modules/calendar/calendarFollowUps.js";

test("terminal leads leave the pending calendar except unpaid collection", () => {
  const regular = { status: "CONTACTED", nextFollowUp: "2026-09-29T10:00:00Z" };
  const lost = { ...regular, status: "LOST" };
  const invalid = { ...regular, status: "INVALID" };
  const closedPaid = { ...regular, status: "CLOSED", dealPayment: { paymentType: "FULL" } };
  const closedUnpaid = { ...regular, status: "CLOSED", dealPayment: { paymentType: "PARTIAL", remainingAmount: 500 } };
  assert.equal(isPendingCalendarFollowUp(regular), true);
  assert.equal(isPendingCalendarFollowUp(lost), false);
  assert.equal(isPendingCalendarFollowUp(invalid), false);
  assert.equal(isPendingCalendarFollowUp(closedPaid), false);
  assert.equal(isPendingCalendarFollowUp(closedUnpaid), true);
  assert.equal(isUnpaidCollectionLead(closedUnpaid), true);
  assert.equal(canScheduleLeadFollowUp(lost), false);
});

// R2 (30 Sep 2026): the calendar lead picker finds a lead by name or phone.
test("calendar lead search matches name or phone digits", async () => {
  const { matchesLeadQuery } = await import("../src/modules/calendar/calendarFollowUps.js");
  const lead = { name: "Rohit Sharma", phone: "+91 98765-43210" };
  assert.equal(matchesLeadQuery(lead, ""), true);
  assert.equal(matchesLeadQuery(lead, "rohit"), true);
  assert.equal(matchesLeadQuery(lead, "SHARMA"), true);
  assert.equal(matchesLeadQuery(lead, "98765 43210"), true);
  assert.equal(matchesLeadQuery(lead, "43210"), true);
  assert.equal(matchesLeadQuery(lead, "priya"), false);
  assert.equal(matchesLeadQuery(lead, "11111"), false);
});

test("calendar date keys follow the browser-local CRM date", () => {
  const date = new Date(2026, 8, 29, 16, 45);
  assert.equal(toCalendarDateKey(date), "2026-09-29");
  assert.equal(toCalendarDateKey("not-a-date"), "");
});

test("month grid uses five or six complete weeks as needed", () => {
  const september = buildMonthCalendarCells(new Date(2026, 8, 1));
  assert.equal(september.length, 35);
  assert.equal(toCalendarDateKey(september[0]), "2026-08-30");
  assert.equal(toCalendarDateKey(september.at(-1)), "2026-10-03");

  const august = buildMonthCalendarCells(new Date(2026, 7, 1));
  assert.equal(august.length, 42);
  assert.equal(toCalendarDateKey(august[0]), "2026-07-26");
  assert.equal(toCalendarDateKey(august.at(-1)), "2026-09-05");
});
