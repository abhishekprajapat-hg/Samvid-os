// Requirements update of 30 Sep 2026 (see project doc crm-requirements-2026-09-30-todo.md).
const test = require("node:test");
const assert = require("node:assert/strict");

// R15: a shared inventory page must not reveal which building, office or floor
// it is, nor anything about the owner.
test("R15 shared inventory hides building, office number, floor and owner details", () => {
  const { toClientSafeView } = require("../src/controllers/publicInventory.controller");
  const inventory = {
    _id: "aaaaaaaaaaaaaaaaaaaaaaaa",
    projectName: "Premium Office Space",
    towerName: "DLF One Horizon",
    buildingName: "DLF One Horizon",
    unitNumber: "302-A",
    officeNumber: "302-A",
    floorNumber: 3,
    totalFloors: 20,
    propertyId: "TOOR-C-0012",
    ownerName: "Owner Person",
    ownerNumber: "9876543210",
    ownerWhatsappNumber: "9876543210",
    keyManagerName: "Key Person",
    keyManagerNumber: "9123456789",
    type: "Rent",
    rent: 85000,
    inventoryType: "COMMERCIAL",
    city: "Indore",
    commercialDetails: { officeType: "OFFICE", subtypeData: { plotNumber: "P-17" }, officeLayout: { totalCabins: 4 } },
    images: [],
  };

  const safe = toClientSafeView(inventory);
  const json = JSON.stringify(safe);

  for (const field of ["buildingName", "towerName", "unitNumber", "officeNumber", "floorNumber",
    "ownerName", "ownerNumber", "ownerWhatsappNumber", "keyManagerName", "keyManagerNumber"]) {
    assert.equal(field in safe, false, `${field} must not be sent to the client`);
  }
  for (const secret of ["DLF One Horizon", "302-A", "9876543210", "9123456789", "Owner Person", "P-17"]) {
    assert.equal(json.includes(secret), false, `"${secret}" leaked into the shared payload`);
  }

  assert.equal(safe.title, "Premium Office Space");
  assert.equal(safe.propertyId, "TOOR-C-0012");
  assert.equal(safe.totalFloors, 20);
  assert.equal(safe.rent, 85000);
  assert.equal(safe.commercialDetails.officeLayout.totalCabins, 4);
});

test("R15 shared inventory title falls back to a generic name", () => {
  const { toClientSafeView } = require("../src/controllers/publicInventory.controller");
  assert.equal(toClientSafeView({ buildingName: "Secret Tower", towerName: "Secret Tower", unitNumber: "9" }).title, "Property");
});

// R12: attendance figures come from the records; a working day with no record is absent.
test("R12 attendance summary counts unrecorded working days as absent", () => {
  const { buildAttendanceSummary } = require("../src/controllers/attendance.controller");
  const row = (attendanceDate, extra) => [attendanceDate, { _id: attendanceDate, attendanceDate, workedMinutes: 0, totalBreakMinutes: 0, ...extra }];
  const attendanceMap = new Map([
    row("2026-09-10", { status: "PRESENT", checkInAt: new Date("2026-09-10T04:00:00Z"), isLateCheckIn: false, workedMinutes: 480 }),
    row("2026-09-11", { status: "HALF_DAY", checkInAt: new Date("2026-09-11T04:00:00Z"), isLateCheckIn: false, workedMinutes: 240 }),
    row("2026-09-12", { status: "LEAVE" }),
    row("2026-09-14", { status: "PRESENT", checkInAt: new Date("2026-09-14T06:00:00Z"), isLateCheckIn: true, workedMinutes: 420 }),
  ]);
  const { attendance, summary } = buildAttendanceSummary({
    attendanceMap,
    range: { from: "2026-09-01", to: "2026-09-30" },
    policy: { timezone: "Asia/Kolkata", weeklyOffDays: [0] },
    joinedOn: new Date("2026-09-10T00:00:00+05:30"),
    now: new Date("2026-09-30T10:00:00Z"),
  });

  // 10-29 Sep minus three Sundays = 17 working days; today (30th) is not over yet.
  assert.equal(summary.workingDays, 17);
  assert.equal(summary.presentDays, 2);
  assert.equal(summary.halfDays, 1);
  assert.equal(summary.leaveDays, 1);
  assert.equal(summary.absentDays, 13);
  assert.equal(summary.unrecordedAbsentDays, 13);
  assert.equal(summary.lateDays, 1);
  assert.equal(summary.onTimeDays, 2);
  assert.equal(summary.punctualityPercent, 67);
  assert.equal(summary.attendancePercent, 15);
  assert.ok(!attendance.some((r) => ["2026-09-13", "2026-09-20", "2026-09-27"].includes(r.attendanceDate)), "Sundays are not absent");
  assert.ok(!attendance.some((r) => r.attendanceDate < "2026-09-10"), "days before joining are not absent");
  assert.ok(!attendance.some((r) => r.attendanceDate === "2026-09-30"), "today is not marked absent");
});

// R12: dashboard lead summary shape and month buckets.
test("R12 lead summary fills every status and the last 12 months", () => {
  const { buildSummaryClock, shapeLeadSummary } = require("../src/controllers/lead.controller");
  const clock = buildSummaryClock(-330, new Date("2026-09-30T10:00:00Z"));
  assert.equal(clock.todayStart.toISOString(), "2026-09-29T18:30:00.000Z");
  assert.equal(clock.months.length, 12);
  assert.equal(clock.months[11].key, "2026-09");
  const summary = shapeLeadSummary({
    byStatus: [{ _id: "NEW", count: 300 }, { _id: "CLOSED", count: 50 }, { _id: "LOST", count: 30 }],
    totals: [{ total: 380, pendingFirstCalls: 120, followUpsDue: 7, followUpsToday: 3, overdueFollowUps: 4, closedRevenue: 250000 }],
    createdByMonth: [{ _id: "2026-09", count: 40 }],
    closedByMonth: [{ _id: "2026-09", count: 5, revenue: 90000 }],
  }, clock, 2);
  assert.equal(summary.total, 380);
  assert.equal(summary.open, 300);
  assert.equal(summary.byStatus.INTERESTED, 0);
  assert.equal(summary.transferredOut, 2);
  assert.deepEqual(summary.monthly.at(-1), { month: "2026-09", label: "Sep", year: 2026, newLeads: 40, closed: 5, revenue: 90000 });
});

// R3: one overdue rule for the filter, the counts and the roster.
test("R3 a task is overdue only after its due date has passed (office timezone)", () => {
  const { getOverdueCutoff } = require("../src/controllers/task.controller");
  // 30 Sep, 15:30 IST: tasks due 30 Sep (stored 2026-09-30T00:00Z) are not overdue yet.
  const cutoff = getOverdueCutoff(new Date("2026-09-30T10:00:00Z"));
  assert.equal(cutoff.toISOString(), "2026-09-30T00:00:00.000Z");
  assert.equal(new Date("2026-09-30T00:00:00Z") < cutoff, false);
  assert.equal(new Date("2026-09-29T00:00:00Z") < cutoff, true);
  // 1 Oct, 01:30 IST (still 30 Sep in UTC): the 30 Sep task is now overdue.
  assert.equal(getOverdueCutoff(new Date("2026-09-30T20:00:00Z")).toISOString(), "2026-10-01T00:00:00.000Z");
});

test("R12 attendance counts from the first record when the account was created later", () => {
  const { buildAttendanceSummary } = require("../src/controllers/attendance.controller");
  const attendanceMap = new Map([["2026-09-01", { attendanceDate: "2026-09-01", status: "PRESENT", checkInAt: new Date("2026-09-01T04:00:00Z"), workedMinutes: 480, totalBreakMinutes: 0 }]]);
  const { summary } = buildAttendanceSummary({
    attendanceMap,
    range: { from: "2026-09-01", to: "2026-09-30" },
    policy: { timezone: "Asia/Kolkata", weeklyOffDays: [0] },
    joinedOn: new Date("2026-09-28T00:00:00+05:30"),
    now: new Date("2026-09-30T10:00:00Z"),
  });
  // 1-29 Sep minus four Sundays = 25 working days, not just 28-29 Sep.
  assert.equal(summary.workingDays, 25);
  assert.equal(summary.presentDays, 1);
  assert.equal(summary.absentDays, 24);
});

// Functional changes PDF #3: bulk-uploaded Owner/Broker leads reach the contact database.
test("bulk upload files Owner and Broker leads into the contact database by phone", async () => {
  const Lead = require("../src/models/Lead");
  const Contact = require("../src/models/CrmContact");
  const { syncContactsForLeads } = require("../src/services/crmContact.service");
  const origFind = Lead.find, origUpdate = Lead.updateOne, origUpsert = Contact.findOneAndUpdate;
  const leads = [
    { _id: "a1", phone: "+91 98765 77703", name: "Bulk Broker", status: "BROKER" },
    { _id: "a2", phone: "9876577704", name: "Bulk Owner", status: "OWNER" },
  ];
  let query = null; const upserts = []; const brokerLinks = [];
  Lead.find = (q) => { query = q; return { select: () => ({ lean: async () => leads }) }; };
  Lead.updateOne = async (filter, update) => { brokerLinks.push([filter._id, update.$set.brokerContactId]); };
  Contact.findOneAndUpdate = async (filter) => { upserts.push(filter); return { _id: `c-${filter.kind}` }; };
  try {
    const synced = await syncContactsForLeads({ companyId: "co1", leadIds: ["a1"], phones: ["9876577704"] });
    assert.equal(synced, 2);
    assert.deepEqual(query.status, { $in: ["OWNER", "BROKER"] });
    assert.deepEqual(upserts.map((f) => [f.kind, f.phone]), [["BROKER", "9876577703"], ["OWNER", "9876577704"]]);
    assert.deepEqual(brokerLinks, [["a1", "c-BROKER"]]);
    assert.equal(await syncContactsForLeads({ companyId: "co1" }), 0);
  } finally {
    Lead.find = origFind; Lead.updateOne = origUpdate; Contact.findOneAndUpdate = origUpsert;
  }
});
