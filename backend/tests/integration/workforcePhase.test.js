const request = require("supertest");

const app = require("../../src/app");
const Attendance = require("../../src/models/Attendance");
const AttendancePolicy = require("../../src/models/AttendancePolicy");
const AttendanceRegularization = require("../../src/models/AttendanceRegularization");
const LeaveRequest = require("../../src/models/LeaveRequest");
const Task = require("../../src/models/Task");
const TargetAssignment = require("../../src/models/TargetAssignment");
const {
  authHeaderFor,
  createLead,
  createPhase2FixtureGraph,
} = require("../fixtures");

const setNow = (isoString) => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(isoString));
};

const restoreNow = () => {
  vi.useRealTimers();
};

const upsertPolicy = (companyId, overrides = {}) =>
  AttendancePolicy.findOneAndUpdate(
    { companyId },
    {
      $set: {
        timezone: "Asia/Kolkata",
        shiftStartMinutes: 10 * 60,
        shiftEndMinutes: 19 * 60,
        graceMinutes: 15,
        halfDayMinutes: 240,
        fullDayMinutes: 450,
        weeklyOffDays: [0],
        allowCheckoutDuringBreak: true,
        geofenceEnabled: false,
        ...overrides,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

describe("workforce attendance, leave, task, target, and report contracts", () => {
  afterEach(() => {
    restoreNow();
  });

  it("handles deterministic attendance transitions, breaks, sources, timezone date keys, and missed checkout", async () => {
    const graph = await createPhase2FixtureGraph();
    await upsertPolicy(graph.companyA._id, {
      timezone: "Asia/Kolkata",
      allowCheckoutDuringBreak: false,
    });

    setNow("2026-07-31T05:00:00.000Z"); // 10:30 Asia/Kolkata
    const checkIn = await request(app)
      .post("/api/attendance/check-in")
      .set(authHeaderFor(graph.companyAUsers.executive))
      .send({ source: "MOBILE", note: "Reached office" })
      .expect(201);
    expect(checkIn.body.attendance.attendanceDate).toBe("2026-07-31");
    expect(checkIn.body.attendance.source).toBe("MOBILE");

    await request(app)
      .post("/api/attendance/check-in")
      .set(authHeaderFor(graph.companyAUsers.executive))
      .send({ source: "WEB" })
      .expect(409);

    setNow("2026-07-31T06:00:00.000Z");
    await request(app)
      .post("/api/attendance/break/start")
      .set(authHeaderFor(graph.companyAUsers.executive))
      .send({ note: "Tea" })
      .expect(201);
    await request(app)
      .post("/api/attendance/break/start")
      .set(authHeaderFor(graph.companyAUsers.executive))
      .send({})
      .expect(409);

    await request(app)
      .post("/api/attendance/check-out")
      .set(authHeaderFor(graph.companyAUsers.executive))
      .send({})
      .expect(400);

    setNow("2026-07-31T06:15:00.000Z");
    await request(app)
      .post("/api/attendance/break/end")
      .set(authHeaderFor(graph.companyAUsers.executive))
      .send({ note: "Back" })
      .expect(200);
    await request(app)
      .post("/api/attendance/break/end")
      .set(authHeaderFor(graph.companyAUsers.executive))
      .send({})
      .expect(400);

    setNow("2026-07-31T13:15:00.000Z");
    const checkOut = await request(app)
      .post("/api/attendance/check-out")
      .set(authHeaderFor(graph.companyAUsers.executive))
      .send({ source: "WEB" })
      .expect(200);
    expect(checkOut.body.attendance.totalBreakMinutes).toBe(15);
    expect(checkOut.body.attendance.workedMinutes).toBe(480);
    expect(checkOut.body.attendance.status).toBe("LATE");
    expect(checkOut.body.attendance.isLateCheckIn).toBe(true);

    await request(app)
      .post("/api/attendance/check-out")
      .set(authHeaderFor(graph.companyAUsers.executive))
      .send({})
      .expect(409);

    setNow("2026-08-01T00:15:00.000Z");
    await upsertPolicy(graph.companyA._id, { timezone: "UTC" });
    await request(app)
      .post("/api/attendance/check-in")
      .set(authHeaderFor(graph.companyAUsers.fieldExecutive))
      .send({ source: "KIOSK" })
      .expect(201);
    const utcAttendance = await Attendance.findOne({
      userId: graph.companyAUsers.fieldExecutive._id,
    }).lean();
    expect(utcAttendance.attendanceDate).toBe("2026-08-01");
    expect(utcAttendance.source).toBe("KIOSK");

    setNow("2026-08-02T08:00:00.000Z");
    const mine = await request(app)
      .get("/api/attendance/me")
      .query({ from: "2026-08-01", to: "2026-08-01" })
      .set(authHeaderFor(graph.companyAUsers.fieldExecutive))
      .expect(200);
    expect(mine.body.attendance[0].status).toBe("MISSED_CHECK_OUT");
  });

  it("enforces geofence, accuracy buffer, daily hierarchy views, and policy boundaries", async () => {
    const graph = await createPhase2FixtureGraph();
    await upsertPolicy(graph.companyA._id, {
      timezone: "Asia/Kolkata",
      geofenceEnabled: true,
      officeLatitude: 22.7533,
      officeLongitude: 75.8937,
      officeRadiusMeters: 100,
    });

    setNow("2026-07-30T04:30:00.000Z");
    await request(app)
      .post("/api/attendance/check-in")
      .set(authHeaderFor(graph.companyAUsers.executive))
      .send({})
      .expect(400);
    await request(app)
      .post("/api/attendance/check-in")
      .set(authHeaderFor(graph.companyAUsers.executive))
      .send({ location: { latitude: 91, longitude: 75.8937 } })
      .expect(400);
    await request(app)
      .post("/api/attendance/check-in")
      .set(authHeaderFor(graph.companyAUsers.executive))
      .send({ location: { latitude: 22.77, longitude: 75.91, accuracy: 5 } })
      .expect(403);

    const buffered = await request(app)
      .post("/api/attendance/check-in")
      .set(authHeaderFor(graph.companyAUsers.executive))
      .send({ location: { latitude: 22.7545, longitude: 75.8937, accuracy: 150 } })
      .expect(201);
    expect(buffered.body.attendance.checkInLocation.effectiveDistanceMeters).toBeLessThanOrEqual(100);

    await request(app)
      .get("/api/attendance/daily")
      .query({ date: "2026-07-30" })
      .set(authHeaderFor(graph.companyAUsers.executive))
      .expect(403);

    const managerDaily = await request(app)
      .get("/api/attendance/daily")
      .query({ date: "2026-07-30" })
      .set(authHeaderFor(graph.companyAUsers.manager))
      .expect(200);
    expect(managerDaily.body.attendance.some((row) =>
      String(row.user._id) === String(graph.companyAUsers.executive._id))).toBe(true);

    await request(app)
      .patch("/api/attendance/policy")
      .set(authHeaderFor(graph.companyAUsers.admin))
      .send({ weeklyOffDays: [0, 7] })
      .expect(400);
  });

  it("validates leave and regularization ranges, overlaps, review authority, repeated review, and manual attendance updates", async () => {
    const graph = await createPhase2FixtureGraph();

    await request(app)
      .post("/api/attendance/leave-requests")
      .set(authHeaderFor(graph.companyAUsers.executive))
      .send({ fromDate: "2026-08-10", toDate: "2026-08-09", reason: "Bad range" })
      .expect(400);
    await request(app)
      .post("/api/attendance/leave-requests")
      .set(authHeaderFor(graph.companyAUsers.executive))
      .send({ fromDate: "2026-08-10", toDate: "2026-08-10", leaveType: "SICK", reason: "Fever" })
      .expect(201);
    await request(app)
      .post("/api/attendance/leave-requests")
      .set(authHeaderFor(graph.companyAUsers.executive))
      .send({ fromDate: "2026-08-10", toDate: "2026-08-11", leaveType: "CASUAL", reason: "Overlap" })
      .expect(409);

    const leave = await LeaveRequest.findOne({ userId: graph.companyAUsers.executive._id }).lean();
    await request(app)
      .patch(`/api/attendance/leave-requests/${leave._id}/review`)
      .set(authHeaderFor(graph.companyBUsers.admin))
      .send({ status: "APPROVED" })
      .expect(404);
    await request(app)
      .patch(`/api/attendance/leave-requests/${leave._id}/review`)
      .set(authHeaderFor(graph.companyAUsers.fieldExecutive))
      .send({ status: "APPROVED" })
      .expect(403);
    await request(app)
      .patch(`/api/attendance/leave-requests/${leave._id}/review`)
      .set(authHeaderFor(graph.companyAUsers.manager))
      .send({ status: "APPROVED", reviewNote: "Ok" })
      .expect(200);
    await request(app)
      .patch(`/api/attendance/leave-requests/${leave._id}/review`)
      .set(authHeaderFor(graph.companyAUsers.manager))
      .send({ status: "REJECTED" })
      .expect(400);

    await request(app)
      .post("/api/attendance/regularizations")
      .set(authHeaderFor(graph.companyAUsers.executive))
      .send({
        attendanceDate: "2026-08-12",
        requestedCheckInAt: "2026-08-12T12:00:00.000Z",
        requestedCheckOutAt: "2026-08-12T04:00:00.000Z",
        reason: "Bad order",
      })
      .expect(400);

    const regularization = await request(app)
      .post("/api/attendance/regularizations")
      .set(authHeaderFor(graph.companyAUsers.executive))
      .send({
        attendanceDate: "2026-08-12",
        requestedCheckInAt: "2026-08-12T04:30:00.000Z",
        requestedCheckOutAt: "2026-08-12T13:00:00.000Z",
        requestedTotalBreakMinutes: 30,
        reason: "Forgot",
      })
      .expect(201);
    await request(app)
      .post("/api/attendance/regularizations")
      .set(authHeaderFor(graph.companyAUsers.executive))
      .send({
        attendanceDate: "2026-08-12",
        requestedCheckInAt: "2026-08-12T04:30:00.000Z",
        reason: "Duplicate",
      })
      .expect(409);

    await request(app)
      .patch(`/api/attendance/regularizations/${regularization.body.regularization._id}/review`)
      .set(authHeaderFor(graph.companyAUsers.manager))
      .send({ status: "APPROVED" })
      .expect(200);
    const attendance = await Attendance.findOne({
      userId: graph.companyAUsers.executive._id,
      attendanceDate: "2026-08-12",
    }).lean();
    expect(attendance.source).toBe("MANUAL");
    expect(attendance.workedMinutes).toBe(480);

    await request(app)
      .patch(`/api/attendance/regularizations/${regularization.body.regularization._id}/review`)
      .set(authHeaderFor(graph.companyAUsers.manager))
      .send({ status: "REJECTED" })
      .expect(400);
  });

  it("hardens task validation, visibility, reassignment, stats, deletion and realtime notification delivery", async () => {
    const graph = await createPhase2FixtureGraph();
    const leadA = await createLead({
      company: graph.companyA,
      createdBy: graph.companyAUsers.admin,
      assignedTo: graph.companyAUsers.executive,
    });
    const leadB = await createLead({
      company: graph.companyB,
      createdBy: graph.companyBUsers.admin,
    });
    const emitted = [];
    app.set("io", {
      to(room) {
        return {
          emit(event, payload) {
            emitted.push({ room, event, payload });
          },
        };
      },
    });

    await request(app)
      .post("/api/tasks")
      .set(authHeaderFor(graph.companyAUsers.admin))
      .send({ title: "" })
      .expect(400);
    await request(app)
      .post("/api/tasks")
      .set(authHeaderFor(graph.companyAUsers.admin))
      .send({ title: "Bad status", status: "DONE" })
      .expect(400);
    await request(app)
      .post("/api/tasks")
      .set(authHeaderFor(graph.companyAUsers.admin))
      .send({ title: "Bad assignee", assignedTo: "not-id" })
      .expect(400);
    await request(app)
      .post("/api/tasks")
      .set(authHeaderFor(graph.companyAUsers.admin))
      .send({ title: "Cross lead", leadId: String(leadB._id) })
      .expect(404);
    await request(app)
      .post("/api/tasks")
      .set(authHeaderFor(graph.companyAUsers.productionExecutive))
      .send({ title: "Production lead", leadId: String(leadA._id) })
      .expect(403);

    const created = await request(app)
      .post("/api/tasks")
      .set(authHeaderFor(graph.companyAUsers.admin))
      .send({
        title: "Call client",
        priority: "HIGH",
        status: "TODO",
        assignedTo: String(graph.companyAUsers.executive._id),
        leadId: String(leadA._id),
        dueDate: "2026-08-20T00:00:00.000Z",
        subtasks: [{ title: "Dial", isCompleted: false }],
        tags: ["sales", "urgent"],
      })
      .expect(201);
    expect(emitted.some((row) => row.room === `user:${graph.companyAUsers.executive._id}` && row.event === "task:created")).toBe(true);

    const filtered = await request(app)
      .get("/api/tasks")
      .query({ search: "call", tag: "sales", status: "TODO", dueDateStart: "2026-08-01", dueDateEnd: "2026-08-31" })
      .set(authHeaderFor(graph.companyAUsers.manager))
      .expect(200);
    expect(filtered.body).toHaveLength(1);

    await request(app)
      .get(`/api/tasks/${created.body._id}`)
      .set(authHeaderFor(graph.companyBUsers.admin))
      .expect(403);

    const reassigned = await request(app)
      .patch(`/api/tasks/${created.body._id}`)
      .set(authHeaderFor(graph.companyAUsers.admin))
      .send({
        status: "IN_PROGRESS",
        assignedTo: String(graph.companyAUsers.fieldExecutive._id),
        tags: ["field"],
      })
      .expect(200);
    expect(String(reassigned.body.assignedTo._id)).toBe(String(graph.companyAUsers.fieldExecutive._id));

    const stats = await request(app)
      .get("/api/tasks/stats")
      .set(authHeaderFor(graph.companyAUsers.admin))
      .expect(200);
    expect(stats.body.total).toBe(1);
    expect(stats.body.IN_PROGRESS).toBe(1);

    await request(app)
      .delete(`/api/tasks/${created.body._id}`)
      .set(authHeaderFor(graph.companyBUsers.admin))
      .expect(404);
    await request(app)
      .delete(`/api/tasks/${created.body._id}`)
      .set(authHeaderFor(graph.companyAUsers.admin))
      .expect(200);
  });

  it("reconciles target achievement and leaderboard calculations with known lead fixtures", async () => {
    const graph = await createPhase2FixtureGraph();
    const month = "2026-08";

    await request(app)
      .post("/api/targets/assign")
      .set(authHeaderFor(graph.companyAUsers.executive))
      .send({ assignedToId: String(graph.companyAUsers.fieldExecutive._id), month, leadsTarget: 1 })
      .expect(403);
    await request(app)
      .post("/api/targets/assign")
      .set(authHeaderFor(graph.companyAUsers.manager))
      .send({ assignedToId: String(graph.companyBUsers.executive._id), month, leadsTarget: 1 })
      .expect(404);
    await request(app)
      .post("/api/targets/assign")
      .set(authHeaderFor(graph.companyAUsers.manager))
      .send({ assignedToId: String(graph.companyAUsers.executive._id), month: "2026-13", leadsTarget: 1 })
      .expect(400);

    await createLead({
      company: graph.companyA,
      createdBy: graph.companyAUsers.admin,
      assignedTo: graph.companyAUsers.executive,
      status: "CLOSED",
      createdAt: new Date("2026-08-05T00:00:00.000Z"),
      updatedAt: new Date("2026-08-05T00:00:00.000Z"),
    });
    await createLead({
      company: graph.companyA,
      createdBy: graph.companyAUsers.admin,
      assignedTo: graph.companyAUsers.executive,
      status: "SITE_VISIT",
      createdAt: new Date("2026-08-06T00:00:00.000Z"),
      updatedAt: new Date("2026-08-06T00:00:00.000Z"),
    });
    await createLead({
      company: graph.companyA,
      createdBy: graph.companyAUsers.admin,
      assignedTo: graph.companyAUsers.fieldExecutive,
      status: "NEW",
      createdAt: new Date("2026-08-07T00:00:00.000Z"),
      updatedAt: new Date("2026-08-07T00:00:00.000Z"),
    });
    await createLead({
      company: graph.companyB,
      createdBy: graph.companyBUsers.admin,
      assignedTo: graph.companyBUsers.executive,
      status: "CLOSED",
      createdAt: new Date("2026-08-05T00:00:00.000Z"),
      updatedAt: new Date("2026-08-05T00:00:00.000Z"),
    });

    const assigned = await request(app)
      .post("/api/targets/assign")
      .set(authHeaderFor(graph.companyAUsers.manager))
      .send({
        assignedToId: String(graph.companyAUsers.executive._id),
        month,
        leadsTarget: 4,
        revenueTarget: 100000,
        siteVisitTarget: 2,
      })
      .expect(201);
    expect(assigned.body.target.achievements.leadsAchieved).toBe(2);
    expect(assigned.body.target.achievements.closedDealsAchieved).toBe(1);
    expect(assigned.body.target.achievements.siteVisitsAchieved).toBe(1);
    expect(assigned.body.target.achievements.revenueAchieved).toBe(50000);
    expect(assigned.body.target.progress.leadsPercent).toBe(50);
    expect(assigned.body.target.progress.revenuePercent).toBe(50);

    await request(app)
      .post("/api/targets/assign")
      .set(authHeaderFor(graph.companyAUsers.manager))
      .send({
        assignedToId: String(graph.companyAUsers.executive._id),
        month,
        leadsTarget: 2,
        revenueTarget: 50000,
        siteVisitTarget: 1,
      })
      .expect(201);
    expect(await TargetAssignment.countDocuments({
      companyId: graph.companyA._id,
      assignedTo: graph.companyAUsers.executive._id,
      month,
    })).toBe(1);

    setNow("2026-08-31T12:00:00.000Z");
    const leaderboard = await request(app)
      .get("/api/users/leaderboard")
      .query({ role: "EXECUTIVE", windowDays: 31 })
      .set(authHeaderFor(graph.companyAUsers.manager))
      .expect(200);
    const executiveRow = leaderboard.body.leaderboard.find((row) =>
      String(row.userId) === String(graph.companyAUsers.executive._id));
    expect(executiveRow.totalLeads).toBe(2);
    expect(executiveRow.closedLeads).toBe(1);
    expect(executiveRow.siteVisits).toBe(1);
    expect(executiveRow.conversionRate).toBe(50);

    const mine = await request(app)
      .get("/api/targets/my")
      .query({ month })
      .set(authHeaderFor(graph.companyAUsers.executive))
      .expect(200);
    expect(mine.body.myTarget.progress.leadsPercent).toBe(100);
  });
});
