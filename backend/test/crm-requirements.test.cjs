const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createRequire } = require("node:module");
const { validateBreakTimeline } = require("../src/utils/attendanceBreaks");
const AttendanceModel = require("../src/models/Attendance");

const companyId = "aaaaaaaaaaaaaaaaaaaaaaaa";
const employeeId = "bbbbbbbbbbbbbbbbbbbbbbbb";
const managerId = "cccccccccccccccccccccccc";
const taskId = "dddddddddddddddddddddddd";
const otherId = "eeeeeeeeeeeeeeeeeeeeeeee";
const query = (value) => ({
  select() { return this; }, populate() { return this; }, sort() { return this; },
  lean() { return Promise.resolve(value); },
  then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); },
});
const response = () => ({ code: 200, body: null, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });
// Execute the real controllers with isolated repositories; never connect to a database.
const load = (relative, stubs, exposed = "") => {
  const filename = path.resolve(__dirname, "../src", relative);
  const localRequire = createRequire(filename);
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(filename, "utf8") + exposed, {
    module, exports: module.exports,
    require: (name) => stubs[name] || localRequire(name),
    process, console, Date, setTimeout, clearTimeout,
  }, { filename });
  return module.exports;
};

test("lead list assignment filter intersects existing employee and tenant restrictions", () => {
  const { applyFilters } = load("controllers/lead.controller.js", {}, "\nmodule.exports.applyFilters = applyLeadListFilters;");
  const scope = { companyId, assignedTo: employeeId };
  applyFilters(scope, { assignedTo: otherId, source: "META", city: "Indore" });
  assert.equal(scope.assignedTo, employeeId);
  assert.equal(scope.companyId, companyId);
  assert.ok(scope.$and.some((clause) => clause.assignedTo === otherId));
  assert.equal(scope.source, "META");
});

for (const owner of ["assignedTo", "createdBy"]) {
  test(`task details allow populated ${owner} references`, async () => {
    const task = { companyId, assignedTo: { _id: otherId }, createdBy: { _id: otherId }, [owner]: { _id: employeeId, name: "Employee" } };
    const controller = load("controllers/task.controller.js", { "../models/Task": { findById: () => query(task) } });
    const res = response();
    await controller.getTaskById({ params: { taskId }, user: { _id: employeeId, companyId, role: "EXECUTIVE" } }, res);
    assert.equal(res.code, 200);
    assert.equal(res.body, task);
  });
}
test("task details reject an unrelated employee and cross-company admin", async () => {
  const controller = load("controllers/task.controller.js", { "../models/Task": { findById: () => query({ companyId, assignedTo: { _id: otherId }, createdBy: otherId }) } });
  for (const user of [{ _id: employeeId, companyId, role: "EXECUTIVE" }, { _id: managerId, companyId: otherId, role: "ADMIN" }]) {
    const res = response();
    await controller.getTaskById({ params: { taskId }, user }, res);
    assert.equal(res.code, 403);
  }
});
test("assigned-to-me excludes personally created tasks and retains tenant access", async () => {
  let filter;
  const controller = load("controllers/task.controller.js", { "../models/Task": { find: (value) => { filter = value; return query([]); } } });
  const res = response();
  await controller.getTasks({ query: { scope: "assigned" }, user: { _id: employeeId, companyId, role: "EXECUTIVE" } }, res);
  assert.equal(res.code, 200);
  assert.equal(filter.companyId, companyId);
  assert.equal(filter.$and[0].assignedTo, employeeId);
  assert.equal(filter.$and[1].createdBy.$ne, employeeId);
  assert.equal(filter.$or.length, 2);
});
test("status-only updates notify the assignee of an update, not a reassignment", async () => {
  const task = { _id: taskId, companyId, assignedTo: employeeId, createdBy: managerId, title: "Follow up", status: "TODO", save: async function () { return this; } };
  const events = [];
  const io = { to: (room) => ({ emit: (event, payload) => events.push({ room, event, payload }) }) };
  const controller = load("controllers/task.controller.js", { "../models/Task": { findById: () => query(task) } });
  const res = response();
  await controller.updateTask({ params: { taskId }, body: { status: "COMPLETED" }, user: { _id: employeeId, companyId, role: "EXECUTIVE", name: "Employee" }, app: { get: () => io } }, res);
  assert.equal(res.code, 200);
  assert.equal(task.status, "COMPLETED");
  assert.equal(events.length, 1);
  assert.equal(events[0].room, `company:${companyId}:role:ADMIN`);
  assert.equal(events[0].payload.actorId, employeeId);
  assert.equal(events[0].payload.task, task);
  assert.doesNotMatch(events[0].payload.message, /reassigned/);
});
test("task deletion rejects cross-company admins", async () => {
  let deleted = false;
  const controller = load("controllers/task.controller.js", { "../models/Task": { findById: () => query({ companyId, createdBy: employeeId }), findByIdAndDelete: () => { deleted = true; } } });
  const res = response();
  await controller.deleteTask({ params: { taskId }, user: { _id: managerId, companyId: otherId, role: "ADMIN" } }, res);
  assert.equal(res.code, 403);
  assert.equal(deleted, false);
});

for (const [name, manager, roleType, expected] of [
  ["legacy commercial manager", { role: "MANAGER", isActive: true }, "COMMERCIAL", null],
  ["residential manager", { role: "MANAGER", isActive: true, roleType: "RESIDENTIAL" }, "RESIDENTIAL", null],
  ["inactive manager", { role: "MANAGER", isActive: false }, "COMMERCIAL", /inactive/],
  ["invalid role", { role: "EXECUTIVE", isActive: true }, "COMMERCIAL", /not a manager/],
  ["wrong property type", { role: "MANAGER", isActive: true, roleType: "COMMERCIAL" }, "RESIDENTIAL", /residential manager/],
  ["missing or cross-company manager", null, "COMMERCIAL", /not found in your company/],
]) {
  test(`inventory owner validation: ${name}`, async () => {
    let filter;
    const service = load("services/inventoryWorkflow.service.js", { "../models/User": { findOne: (value) => { filter = value; return query(manager && { _id: managerId, name: "Manager", ...manager }); } } }, "\nmodule.exports.testOwner = ensureManagerExistsInCompany;");
    const action = () => service.testOwner({ managerId, companyId, roleType });
    if (expected) await assert.rejects(action, expected);
    else assert.equal((await action())._id, managerId);
    assert.equal(filter.companyId, companyId);
    assert.equal(filter._id, managerId);
  });
}

const instant = (time) => new Date(`2026-09-01T${time}:00Z`);
const timeline = (sessions, checkOutAt = instant("17:00")) => ({ sessions, checkInAt: instant("09:00"), checkOutAt, now: instant("18:00") });
test("breaks accept adjacent, non-overlapping sessions", () => {
  assert.doesNotThrow(() => validateBreakTimeline(timeline([{ startAt: instant("12:00"), endAt: instant("12:30") }, { startAt: instant("12:30"), endAt: instant("13:00") }])));
});
for (const [name, sessions, checkout, expected] of [
  ["overlap", [{ startAt: instant("12:00"), endAt: instant("13:00") }, { startAt: instant("12:30"), endAt: instant("14:00") }], instant("17:00"), /overlap/],
  ["before check-in", [{ startAt: instant("08:00"), endAt: instant("09:30") }], instant("17:00"), /between check-in/],
  ["after check-out", [{ startAt: instant("16:00"), endAt: instant("17:30") }], instant("17:00"), /between check-in/],
  ["reversed times", [{ startAt: instant("13:00"), endAt: instant("12:00") }], instant("17:00"), /after its start/],
  ["open break after check-out", [{ startAt: instant("13:00") }], instant("17:00"), /requires a break end/],
  ["future time", [{ startAt: instant("19:00") }], null, /between check-in/],
  ["two open breaks", [{ startAt: instant("12:00") }, { startAt: instant("13:00") }], null, /overlap/],
]) test(`breaks reject ${name}`, () => assert.throws(() => validateBreakTimeline(timeline(sessions, checkout)), expected));

const correctionHarness = ({ role = "ADMIN", descendants = [], concurrent = false, stale = false } = {}) => {
  const doc = new AttendanceModel({ _id: taskId, companyId, userId: employeeId, attendanceDate: "2026-09-01", checkInAt: instant("09:00"), checkOutAt: instant("17:00"), updatedAt: instant("17:00"), breakSessions: [] });
  let mutation = null;
  const model = {
    ATTENDANCE_STATUS: AttendanceModel.ATTENDANCE_STATUS,
    ATTENDANCE_SOURCE: AttendanceModel.ATTENDANCE_SOURCE,
    findOne: () => query(doc),
    findOneAndUpdate: async (filter, update) => {
      mutation = { filter, update };
      if (concurrent) return null;
      doc.set(update.$set);
      doc.breakAudit.push(update.$push.breakAudit);
      assert.equal(doc.validateSync(), undefined);
      return doc;
    },
  };
  const controller = load("controllers/attendance.controller.js", {
    "../models/Attendance": model,
    "../models/User": { findOne: () => query({ _id: employeeId, role: "EXECUTIVE" }) },
    "../models/AttendancePolicy": { findOne: () => query(null) },
    "../services/hierarchy.service": { getDescendantUsers: async () => descendants },
  });
  const req = {
    user: { _id: managerId, name: "Manager", companyId, role },
    params: { userId: employeeId, date: "2026-09-01" },
    body: { startAt: instant("12:00").toISOString(), endAt: instant("12:30").toISOString(), reason: "Employee forgot to record lunch", expectedUpdatedAt: (stale ? instant("16:00") : doc.updatedAt).toISOString() },
  };
  return { controller, req, doc, mutation: () => mutation };
};
test("admin break override persists audit attribution and recalculates working hours", async () => {
  const h = correctionHarness(); const res = response();
  await h.controller.correctUserBreak(h.req, res);
  assert.equal(res.code, 200, JSON.stringify(res.body));
  assert.equal(res.body.attendance.totalBreakMinutes, 30);
  assert.equal(res.body.attendance.workedMinutes, 450);
  assert.equal(res.body.attendance.breakSessions[0].correctedByName, "Manager");
  assert.equal(res.body.attendance.breakAudit.length, 1);
  assert.equal(String(res.body.attendance.breakAudit[0].actorId), managerId);
  assert.equal(res.body.attendance.breakAudit[0].before, null);
  assert.equal(h.mutation().filter.companyId, companyId);
});
test("editing a break preserves the previous values in audit history", async () => {
  const h = correctionHarness();
  h.doc.breakSessions = [{ startAt: instant("12:00"), endAt: instant("12:15") }];
  h.req.body.sessionIndex = 0;
  const res = response(); await h.controller.correctUserBreak(h.req, res);
  assert.equal(res.code, 200);
  assert.equal(res.body.attendance.breakAudit[0].before.endAt.toISOString(), instant("12:15").toISOString());
  assert.equal(res.body.attendance.breakAudit[0].after.endAt.toISOString(), instant("12:30").toISOString());
});
for (const [name, config, expected] of [
  ["employee override", { role: "EXECUTIVE" }, 403],
  ["manager outside hierarchy", { role: "MANAGER" }, 403],
  ["manager inside hierarchy", { role: "MANAGER", descendants: [{ _id: employeeId }] }, 200],
  ["stale form", { stale: true }, 409],
  ["concurrent attendance write", { concurrent: true }, 409],
]) test(`break correction: ${name}`, async () => {
  const h = correctionHarness(config); const res = response();
  await h.controller.correctUserBreak(h.req, res);
  assert.equal(res.code, expected, JSON.stringify(res.body));
  if (expected === 403 || config.stale) assert.equal(h.mutation(), null);
});

for (const role of ["EXECUTIVE", "MANAGER", "ADMIN"]) {
  for (const field of ["title", "description", "priority", "dueDate", "assignedTo", "leadId", "subtasks", "tags", "createdBy"]) {
    test(`receiver ${role} cannot modify ${field}, even alongside a valid status`, async () => {
      let saved = false;
      const task = { _id: taskId, companyId, assignedTo: employeeId, createdBy: managerId, status: "TODO", save: async function () { saved = true; return this; } };
      const controller = load("controllers/task.controller.js", { "../models/Task": { findById: () => query(task) } });
      const res = response();
      await controller.updateTask({ params: { taskId }, body: { status: "COMPLETED", [field]: null }, user: { _id: employeeId, companyId, role } }, res);
      assert.equal(res.code, 403);
      assert.equal(task.status, "TODO");
      assert.equal(saved, false);
    });
  }
  test(`receiver ${role} can change status`, async () => {
    const task = { _id: taskId, companyId, assignedTo: employeeId, createdBy: managerId, status: "TODO", save: async function () { return this; } };
    const controller = load("controllers/task.controller.js", { "../models/Task": { findById: () => query(task) } });
    const res = response();
    await controller.updateTask({ params: { taskId }, body: { status: "IN_PROGRESS" }, user: { _id: employeeId, companyId, role }, app: { get: () => null } }, res);
    assert.equal(res.code, 200);
    assert.equal(task.status, "IN_PROGRESS");
  });
  test(`receiver ${role} cannot delete assigned task`, async () => {
    const controller = load("controllers/task.controller.js", { "../models/Task": { findById: () => query({ companyId, assignedTo: employeeId, createdBy: managerId }) } });
    const res = response();
    await controller.deleteTask({ params: { taskId }, user: { _id: employeeId, companyId, role } }, res);
    assert.equal(res.code, 403);
  });
}
test("task creator retains editing access", async () => {
  const task = { _id: taskId, companyId, assignedTo: employeeId, createdBy: managerId, title: "Before", save: async function () { return this; } };
  const controller = load("controllers/task.controller.js", { "../models/Task": { findById: () => query(task) } });
  const res = response();
  await controller.updateTask({ params: { taskId }, body: { title: "After", subtasks: [{ title: "Checklist", isCompleted: false }] }, user: { _id: managerId, companyId, role: "EXECUTIVE" }, app: { get: () => null } }, res);
  assert.equal(res.code, 200);
  assert.equal(task.title, "After");
  assert.equal(task.subtasks.length, 1);
});

test("admin status changes notify only the employee", async () => {
  const task = { _id: taskId, companyId, assignedTo: employeeId, createdBy: managerId, title: "Task", status: "TODO", save: async function () { return this; } };
  const events = [];
  const io = { to: room => ({ emit: (name, payload) => events.push({ room, name, payload }) }) };
  const controller = load("controllers/task.controller.js", { "../models/Task": { findById: () => query(task) } });
  const req = { params: { taskId }, body: { status: "IN_PROGRESS" }, user: { _id: managerId, companyId, role: "ADMIN", name: "Admin" }, app: { get: () => io } };
  const res = response(); await controller.updateTask(req, res);
  assert.equal(res.code, 200);
  assert.equal(events.length, 1);
  assert.equal(events[0].room, `user:${employeeId}`);
  assert.equal(events[0].payload.actorId, managerId);
  events.length = 0;
  await controller.updateTask(req, response());
  assert.equal(events.length, 0, "unchanged status must not generate another notification");
});

for (const inventoryType of ["COMMERCIAL", "RESIDENTIAL"]) {
  test(`Both user can access ${inventoryType} leads and inventory`, () => {
    const user = { _id: employeeId, companyId, role: "EXECUTIVE", roleType: "BOTH" };
    const leadController = load("controllers/lead.controller.js", {}, "\nmodule.exports.testType = assertLeadTypeMatchesUser; module.exports.testScope = addLeadRoleTypeScope; module.exports.testInventory = buildCompanyInventoryQuery;");
    assert.equal(leadController.testType({ inventoryType }, user), null);
    const scope = { companyId, assignedTo: employeeId };
    assert.equal(leadController.testScope(scope, user), scope);
    assert.equal(scope.assignedTo, employeeId);
    assert.equal(scope.$and, undefined);
    const inventoryQuery = leadController.testInventory({ inventoryId: taskId, companyId, user });
    assert.equal(inventoryQuery.companyId, companyId);
    assert.equal(inventoryQuery.inventoryType, undefined);
    const inventory = load("services/inventoryWorkflow.service.js", {}, "\nmodule.exports.testType = ensureInventoryTypeAllowedForUser;");
    assert.doesNotThrow(() => inventory.testType({ user, inventoryType }));
    assert.throws(() => inventory.testType({ user: { ...user, roleType: inventoryType === "COMMERCIAL" ? "RESIDENTIAL" : "COMMERCIAL" }, inventoryType }), /only/);
  });
  test(`Both manager accepts ${inventoryType} inventory ownership`, async () => {
    const service = load("services/inventoryWorkflow.service.js", { "../models/User": { findOne: () => query({ _id: managerId, role: "MANAGER", roleType: "BOTH", isActive: true }) } }, "\nmodule.exports.testOwner = ensureManagerExistsInCompany;");
    assert.equal((await service.testOwner({ managerId, companyId, roleType: inventoryType }))._id, managerId);
  });
}
test("User schema and authentication retain Both role type", () => {
  const UserModel = require("../src/models/User");
  assert.ok(UserModel.schema.path("roleType").enumValues.includes("BOTH"));
  const auth = load("controllers/auth.controller.js", {}, "\nmodule.exports.testNormalize = normalizeRoleType;");
  assert.equal(auth.testNormalize("both"), "BOTH");
});

// ---- Break types (requirement 17): a break is always classified, and the
// standard types carry the durations the policy hands out.
const recently = (hoursAgo) => new Date(Date.now() - hoursAgo * 3600 * 1000);
const todayKey = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const breakHarness = () => {
  const doc = new AttendanceModel({ companyId, userId: employeeId, attendanceDate: todayKey(), checkInAt: recently(2), breakSessions: [] });
  doc.save = async function save() { return this; };
  const controller = load("controllers/attendance.controller.js", {
    "../models/Attendance": { ATTENDANCE_STATUS: AttendanceModel.ATTENDANCE_STATUS, ATTENDANCE_SOURCE: AttendanceModel.ATTENDANCE_SOURCE, findOne: () => query(doc) },
    "../models/AttendancePolicy": { findOne: () => query(null) },
  });
  return { controller, doc, user: { _id: employeeId, companyId, role: "EXECUTIVE" } };
};
for (const [breakType, expectedMinutes] of [["LUNCH", 30], ["TEA", 15], ["COFFEE", 15]]) {
  test(`${breakType} break records its expected duration`, async () => {
    const h = breakHarness(); const res = response();
    await h.controller.startBreak({ user: h.user, body: { breakType }, headers: {} }, res);
    assert.equal(res.code, 201, JSON.stringify(res.body));
    const session = h.doc.breakSessions.at(-1);
    assert.equal(session.breakType, breakType);
    assert.equal(session.expectedMinutes, expectedMinutes);
  });
}
test("a utility break is open-ended but must carry a reason", async () => {
  const missing = breakHarness(); const rejected = response();
  await missing.controller.startBreak({ user: missing.user, body: { breakType: "UTILITY" }, headers: {} }, rejected);
  assert.equal(rejected.code, 400);
  assert.equal(missing.doc.breakSessions.length, 0);

  const given = breakHarness(); const accepted = response();
  await given.controller.startBreak({ user: given.user, body: { breakType: "UTILITY", note: "Stepped out to meet a client" }, headers: {} }, accepted);
  assert.equal(accepted.code, 201, JSON.stringify(accepted.body));
  const session = given.doc.breakSessions.at(-1);
  assert.equal(session.expectedMinutes, null);
  assert.equal(session.startNote, "Stepped out to meet a client");
});
for (const breakType of ["", "SMOKE", "lunch break"]) {
  test(`an unclassified break (${breakType || "empty"}) is refused`, async () => {
    const h = breakHarness(); const res = response();
    await h.controller.startBreak({ user: h.user, body: { breakType }, headers: {} }, res);
    assert.equal(res.code, 400);
    assert.equal(h.doc.breakSessions.length, 0);
  });
}

// ---- Geofencing (requirement 21): removed from check-out only.
test("check-out succeeds away from the office while check-in still refuses", async () => {
  const policy = { companyId, geofenceEnabled: true, officeLatitude: 22.72, officeLongitude: 75.86, geofenceRadiusMeters: 200, timezone: "Asia/Kolkata" };
  const faraway = { latitude: 19.07, longitude: 72.87, accuracy: 10 };
  const build = (attendance) => load("controllers/attendance.controller.js", {
    "../models/Attendance": { ATTENDANCE_STATUS: AttendanceModel.ATTENDANCE_STATUS, ATTENDANCE_SOURCE: AttendanceModel.ATTENDANCE_SOURCE, findOne: () => query(attendance), findOneAndUpdate: () => query(attendance) },
    "../models/AttendancePolicy": { findOne: () => query(policy) },
  });

  const open = new AttendanceModel({ companyId, userId: employeeId, attendanceDate: todayKey(), checkInAt: recently(2), breakSessions: [] });
  open.save = async function save() { return this; };
  const out = response();
  await build(open).checkOut({ user: { _id: employeeId, companyId, role: "EXECUTIVE" }, body: { location: faraway }, headers: {} }, out);
  assert.equal(out.code, 200, JSON.stringify(out.body));
  assert.ok(open.checkOutAt, "check-out must be recorded regardless of location");

  const fresh = new AttendanceModel({ companyId, userId: employeeId, attendanceDate: todayKey(), breakSessions: [] });
  fresh.save = async function save() { return this; };
  const inRes = response();
  await build(fresh).checkIn({ user: { _id: employeeId, companyId, role: "EXECUTIVE" }, body: { location: faraway }, headers: {} }, inRes);
  assert.equal(inRes.code, 403, "check-in keeps its geofence");
  assert.equal(fresh.checkInAt, null);
});

// ---- Owner/Broker database (requirements 1-3): one phone is one contact.
test("phone normalisation collapses the formats one person is stored under", () => {
  const { normalizePhone } = require("../src/services/crmContact.service");
  const canonical = normalizePhone("9876543210");
  assert.equal(canonical, "9876543210");
  for (const variant of ["+91 98765 43210", "+919876543210", "09876543210", "0091-9876543210", "(98765) 43210"]) {
    assert.equal(normalizePhone(variant), canonical, `${variant} must key to the same contact`);
  }
  for (const rejected of ["", "12345", "abcdef", "1".repeat(16)]) assert.equal(normalizePhone(rejected), "");
});
test("a contact is keyed by tenant, kind and phone so repeat leads update one record", () => {
  const Contact = require("../src/models/CrmContact");
  const unique = Contact.schema.indexes().find(([, options]) => options.unique);
  assert.deepEqual(unique[0], { companyId: 1, kind: 1, phone: 1 });
  assert.deepEqual(Contact.schema.path("kind").enumValues, ["OWNER", "BROKER"]);
});
test("classifying a lead as Owner or Broker is what files the contact", () => {
  const source = fs.readFileSync(path.resolve(__dirname, "../src/models/Lead.js"), "utf8");
  assert.match(source, /\["OWNER", "BROKER"\]\.includes\(this\.status\)/);
  const statuses = require("../src/models/Lead").schema.path("status").enumValues;
  for (const stage of ["FOLLOW_UP_1", "FOLLOW_UP_2", "FOLLOW_UP_3", "OWNER", "BROKER"]) assert.ok(statuses.includes(stage), `${stage} must be a pipeline stage`);
});

// ---- Transfer filter (requirement 12): transfers stay visible after the
// lead has moved on to another stage.
test("the transfer filter reads assignment history, not the current stage", () => {
  const { applyFilters } = load("controllers/lead.controller.js", {}, "\nmodule.exports.applyFilters = applyLeadListFilters;");
  const transfers = { companyId };
  applyFilters(transfers, { status: "TRANSFER" });
  assert.equal(transfers.status, undefined, "TRANSFER is a filter, never a stored stage");
  assert.ok(transfers.$and.some((clause) => clause["assignmentHistory.action"] === "MANUAL_TRANSFER"));

  const stage = { companyId };
  applyFilters(stage, { status: "FOLLOW_UP_2" });
  assert.equal(stage.status, "FOLLOW_UP_2");
  assert.equal(stage.$and, undefined);
});

// ---- Leave violations (requirements 19-20): the counts escalate monthly.
test("rejected-leave and uninformed absences escalate on their own thresholds", () => {
  const { escalationLevel } = require("../src/services/attendanceViolation.service");
  assert.deepEqual([1, 2, 3, 4, 5, 6].map((n) => escalationLevel("REJECTED_LEAVE", n)),
    ["RECORDED", "RECORDED", "WARNING", "WARNING", "MANAGEMENT_REVIEW", "MANAGEMENT_REVIEW"]);
  assert.deepEqual([1, 2, 3, 4].map((n) => escalationLevel("UNINFORMED", n)),
    ["RECORDED", "RECORDED", "MANAGEMENT_REVIEW", "MANAGEMENT_REVIEW"]);
});
for (const [name, leaves, expected] of [
  ["absent after a rejection", [{ fromDate: "2026-09-01", toDate: "2026-09-01", status: "REJECTED", reviewedAt: "2026-08-30T00:00:00Z" }], "REJECTED_LEAVE"],
  ["absent with no request at all", [], "UNINFORMED"],
  ["absent on approved leave", [{ fromDate: "2026-09-01", toDate: "2026-09-01", status: "APPROVED" }], null],
  ["absent while a request is pending", [{ fromDate: "2026-09-01", toDate: "2026-09-01", status: "PENDING" }], null],
  ["rejected only after the day passed", [{ fromDate: "2026-09-01", toDate: "2026-09-01", status: "REJECTED", reviewedAt: "2026-09-05T00:00:00Z" }], null],
]) test(`absence classification: ${name}`, () => {
  const { classifyAbsence } = require("../src/services/attendanceViolation.service");
  assert.equal(classifyAbsence({
    day: "2026-09-01", today: "2026-09-10", joined: "2026-01-01", weekday: 2,
    weeklyOffDays: [0], attendance: null, leaves, timezone: "Asia/Kolkata",
  }), expected);
});
test("a completed working day, a weekly off and a future date never count as violations", () => {
  const { classifyAbsence } = require("../src/services/attendanceViolation.service");
  const base = { day: "2026-09-01", today: "2026-09-10", joined: "2026-01-01", weekday: 2, weeklyOffDays: [0], attendance: null, leaves: [], timezone: "Asia/Kolkata" };
  assert.equal(classifyAbsence({ ...base, attendance: { checkInAt: instant("09:00") } }), null);
  assert.equal(classifyAbsence({ ...base, weekday: 0 }), null);
  assert.equal(classifyAbsence({ ...base, day: "2026-09-20" }), null);
  assert.equal(classifyAbsence({ ...base, joined: "2026-09-05" }), null, "days before joining are not the employee's absences");
});

// ---- Detailed subtasks (requirement 6): a subtask carries its own note and
// due date, on the way in and on every later edit.
test("creating a task keeps each subtask's detail and date", async () => {
  let created = null;
  const controller = load("controllers/task.controller.js", {
    "../models/User": { findOne: () => query({ _id: employeeId, companyId }) },
    "../models/Task": function Task(doc) {
      created = doc;
      this.save = async () => ({ ...doc, _id: taskId });
      Object.assign(this, doc);
    },
  });
  const res = response();
  await controller.createTask({
    user: { _id: managerId, companyId, role: "MANAGER" },
    app: { get: () => ({ to: () => ({ emit: () => {} }) }) },
    body: {
      title: "Onboard the new client",
      subtasks: [
        { title: "Collect police verification", description: "  Chase the signed copy  ", dueDate: "2026-10-01" },
        { title: "Countersign agreement" },
        { title: "   ", description: "dropped because it has no title" },
      ],
    },
  }, res);

  assert.equal(created.subtasks.length, 2, "a subtask with no title is not a subtask");
  assert.equal(created.subtasks[0].description, "Chase the signed copy");
  assert.equal(created.subtasks[0].dueDate, "2026-10-01");
  assert.equal(created.subtasks[1].description, "");
  assert.equal(created.subtasks[1].dueDate, null);
});

test("editing a subtask's note leaves its siblings and completion intact", async () => {
  const task = {
    _id: taskId, companyId, createdBy: managerId, assignedTo: employeeId, status: "TODO",
    subtasks: [
      { title: "Collect police verification", isCompleted: true, description: "old note", dueDate: null },
      { title: "Countersign agreement", isCompleted: false, description: "", dueDate: null },
    ],
    save: async function () { return this; },
  };
  const controller = load("controllers/task.controller.js", {
    "../models/Task": { findById: () => query(task) },
    "../models/User": { findOne: () => query({ _id: employeeId, companyId }) },
  });
  const res = response();
  const io = { to: () => ({ emit: () => {} }) };
  await controller.updateTask({
    user: { _id: managerId, companyId, role: "MANAGER" },
    app: { get: () => io },
    params: { taskId },
    body: {
      subtasks: [
        { title: "Collect police verification", isCompleted: true, description: "Received, filed under KYC", dueDate: "2026-10-05" },
        { title: "Countersign agreement", isCompleted: false },
      ],
    },
  }, res);

  assert.equal(res.code, 200, JSON.stringify(res.body));
  assert.equal(task.subtasks[0].description, "Received, filed under KYC");
  assert.equal(task.subtasks[0].dueDate, "2026-10-05");
  assert.equal(task.subtasks[0].isCompleted, true, "editing the note must not reopen a finished subtask");
  assert.equal(task.subtasks[1].title, "Countersign agreement");
  assert.equal(task.subtasks[1].description, "");
});

// ---- The broker gate: a number in the Broker Database never becomes a lead.
const brokerId = "ffffffffffffffffffffffff";

const leadControllerWithBroker = (broker, sink = {}) => load("controllers/lead.controller.js", {
  "../services/crmContact.service": {
    findBrokerByPhone: async () => broker,
    recordBlockedLead: async (id, details) => { sink.recorded = { id, details }; },
    normalizePhone: (value) => String(value || "").replace(/\D/g, ""),
  },
  "../models/Lead": { findOne: () => query(null) },
});

test("a manual lead on a broker's number is refused and recorded", async () => {
  const sink = {};
  const controller = leadControllerWithBroker({ _id: brokerId, name: "Ravi Sharma", phone: "9876543210" }, sink);
  const res = response();
  await controller.createLead({
    user: { _id: employeeId, companyId, role: "EXECUTIVE" },
    body: { name: "Walk-in enquiry", phone: "+91 98765 43210" },
  }, res);

  assert.equal(res.code, 409);
  assert.equal(res.body.brokerBlocked, true);
  assert.match(res.body.message, /Ravi Sharma/);
  assert.equal(sink.recorded.id, brokerId, "the refusal is recorded against the broker");
  assert.equal(sink.recorded.details.origin, "MANUAL");
  assert.equal(String(sink.recorded.details.attemptedBy), employeeId);
});

test("a number absent from the Broker Database is not gated", async () => {
  const sink = {};
  const controller = leadControllerWithBroker(null, sink);
  const res = response();
  await controller.createLead({
    user: { _id: employeeId, companyId, role: "EXECUTIVE" },
    body: { name: "Genuine client", phone: "9000000000" },
  }, res);

  assert.notEqual(res.code, 409, JSON.stringify(res.body));
  assert.equal(sink.recorded, undefined);
});

// ---- Bulk contact intake (single or bulk upload on the two pages).
test("bulk contact upload reports bad rows instead of failing the file", async () => {
  const saved = [];
  const service = load("services/crmContact.service.js", {
    "../models/CrmContact": {
      exists: async () => false,
      findOneAndUpdate: async (filter, update) => { saved.push({ phone: filter.phone, name: update.$set.name }); return { _id: brokerId, ...filter }; },
    },
  });

  const result = await service.bulkUpsertContacts({
    companyId,
    kind: "BROKER",
    rows: [
      { name: "Ravi Sharma", phone: "+91 98765 43210", city: "Indore" },
      { name: "No Phone" },
      { phone: "9000000001" },
      { name: "Bad Number", phone: "123" },
      { name: "Ravi Again", phone: "09876543210" },
      { name: "Second Good", phone: "9000000002" },
    ],
    actor: employeeId,
  });

  assert.equal(result.createdCount, 2, "only the two valid, distinct numbers are written");
  assert.equal(result.failedCount, 4);
  assert.deepEqual([...result.failures.map((row) => row.row)], [3, 4, 5, 6]);
  assert.match(result.failures[0].message, /not a valid number/, "row 3 has a name but no phone");
  assert.match(result.failures[1].message, /Name is required/, "row 4 has a phone but no name");
  assert.match(result.failures[2].message, /not a valid number/, "row 5 phone is too short");
  assert.match(result.failures[3].message, /Duplicate of row 2/, "row 6 is the same number in another format");
  assert.deepEqual([...saved.map((row) => row.phone)], ["9876543210", "9000000002"]);
});

test("bulk upload counts a known number as an update, not a new contact", async () => {
  const service = load("services/crmContact.service.js", {
    "../models/CrmContact": {
      exists: async () => true,
      findOneAndUpdate: async (filter) => ({ _id: brokerId, ...filter }),
    },
  });
  const result = await service.bulkUpsertContacts({
    companyId, kind: "OWNER", rows: [{ name: "Existing Owner", phone: "9876543210" }], actor: employeeId,
  });
  assert.equal(result.createdCount, 0);
  assert.equal(result.updatedCount, 1);
  assert.equal(result.failedCount, 0);
});

// ---- A manager starting or ending somebody else's break from the team list.
const teamBreakHarness = ({ role = "MANAGER", descendants = [{ _id: employeeId }], sessions = [], checkOutAt = null, targetRole = "EXECUTIVE" } = {}) => {
  const doc = new AttendanceModel({
    _id: taskId, companyId, userId: employeeId, attendanceDate: todayKey(),
    checkInAt: recently(3), checkOutAt, breakSessions: sessions, updatedAt: recently(1),
  });
  let written = null;
  const controller = load("controllers/attendance.controller.js", {
    "../models/Attendance": {
      ATTENDANCE_STATUS: AttendanceModel.ATTENDANCE_STATUS,
      ATTENDANCE_SOURCE: AttendanceModel.ATTENDANCE_SOURCE,
      findOne: () => query(doc),
      findOneAndUpdate: async (filter, update) => {
        written = { filter, update };
        doc.set(update.$set);
        return doc;
      },
    },
    "../models/User": { findOne: () => query({ _id: employeeId, name: "Anish", role: targetRole }) },
    "../models/AttendancePolicy": { findOne: () => query(null) },
    "../services/hierarchy.service": { getDescendantUsers: async () => descendants },
  });
  return {
    controller, doc, written: () => written,
    req: (body) => ({ user: { _id: managerId, name: "Manager", companyId, role }, params: { userId: employeeId }, body, headers: {} }),
  };
};

test("a manager can put a teammate on a break as of now", async () => {
  const h = teamBreakHarness(); const res = response();
  await h.controller.manageUserBreak(h.req({ action: "START", breakType: "LUNCH" }), res);
  assert.equal(res.code, 200, JSON.stringify(res.body));
  const session = h.doc.breakSessions.at(-1);
  assert.equal(session.breakType, "LUNCH");
  assert.equal(session.expectedMinutes, 30);
  assert.equal(session.endAt, null, "a break started now is still open");
  assert.equal(String(session.correctedBy), managerId, "the record says who added it");
  const audit = h.written().update.$push.breakAudit;
  assert.equal(audit.actorName, "Manager");
  assert.equal(audit.before, null);
  assert.match(audit.reason, /Manager/);
});

test("an admin-added break defaults to Utility rather than refusing", async () => {
  const h = teamBreakHarness({ role: "ADMIN" }); const res = response();
  await h.controller.manageUserBreak(h.req({ action: "START" }), res);
  assert.equal(res.code, 200, JSON.stringify(res.body));
  assert.equal(h.doc.breakSessions.at(-1).breakType, "UTILITY");
});

test("ending a teammate's break closes the open session and counts the minutes", async () => {
  const h = teamBreakHarness({ sessions: [{ startAt: recently(0.5), endAt: null, durationMinutes: 0, breakType: "TEA" }] });
  const res = response();
  await h.controller.manageUserBreak(h.req({ action: "END" }), res);
  assert.equal(res.code, 200, JSON.stringify(res.body));
  const session = h.doc.breakSessions.at(-1);
  assert.ok(session.endAt, "the open break is closed");
  assert.ok(session.durationMinutes >= 29 && session.durationMinutes <= 31, `expected ~30 minutes, got ${session.durationMinutes}`);
  assert.equal(h.written().update.$push.breakAudit.before.breakType, "TEA", "the audit keeps what it looked like before");
});

for (const [name, body, sessions, expected] of [
  ["starting a second break while one is open", { action: "START" }, [{ startAt: recently(0.5), endAt: null, durationMinutes: 0 }], 409],
  ["ending a break when none is open", { action: "END" }, [], 409],
  ["an unknown action", { action: "PAUSE" }, [], 400],
  ["an unknown break type", { action: "START", breakType: "SMOKE" }, [], 400],
]) test(`team break refuses ${name}`, async () => {
  const h = teamBreakHarness({ sessions }); const res = response();
  await h.controller.manageUserBreak(h.req(body), res);
  assert.equal(res.code, expected, JSON.stringify(res.body));
});

for (const [name, config, expected] of [
  ["an employee acting on a teammate", { role: "EXECUTIVE" }, 403],
  ["a manager outside their hierarchy", { descendants: [] }, 403],
  ["a target who is an admin", { targetRole: "ADMIN" }, 403],
]) test(`team break rejects ${name}`, async () => {
  const h = teamBreakHarness(config); const res = response();
  await h.controller.manageUserBreak(h.req({ action: "START" }), res);
  assert.equal(res.code, expected, JSON.stringify(res.body));
  assert.equal(h.written(), null, "nothing is written when the actor is refused");
});

test("a break cannot be started for somebody who has checked out", async () => {
  const h = teamBreakHarness({ checkOutAt: new Date() }); const res = response();
  await h.controller.manageUserBreak(h.req({ action: "START" }), res);
  assert.equal(res.code, 400);
  assert.match(res.body.message, /checked out/);
});
