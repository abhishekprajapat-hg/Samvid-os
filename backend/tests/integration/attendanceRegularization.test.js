const request = require("supertest");
const app = require("../../src/app");
const Attendance = require("../../src/models/Attendance");
const {
  authHeaderFor,
  createCompanyUsers,
} = require("../fixtures");

describe("attendance regularization routes", () => {
  it("creates, lists, and reviews regularization requests", async () => {
    const { admin, executive } = await createCompanyUsers();

    const created = await request(app)
      .post("/api/attendance/regularizations")
      .set(authHeaderFor(executive))
      .send({
        attendanceDate: "2026-07-23",
        requestedCheckInAt: "2026-07-23T04:30:00.000Z",
        requestedCheckOutAt: "2026-07-23T12:30:00.000Z",
        requestedTotalBreakMinutes: 30,
        reason: "Forgot to check in",
      })
      .expect(201);

    expect(created.body.regularization.status).toBe("PENDING");

    const mine = await request(app)
      .get("/api/attendance/regularizations/my")
      .set(authHeaderFor(executive))
      .expect(200);

    expect(mine.body.regularizations).toHaveLength(1);

    const adminList = await request(app)
      .get("/api/attendance/regularizations/admin")
      .set(authHeaderFor(admin))
      .expect(200);

    expect(adminList.body.regularizations).toHaveLength(1);

    const reviewed = await request(app)
      .patch(`/api/attendance/regularizations/${created.body.regularization._id}/review`)
      .set(authHeaderFor(admin))
      .send({ status: "APPROVED", reviewNote: "Approved" })
      .expect(200);

    expect(reviewed.body.regularization.status).toBe("APPROVED");

    const attendance = await Attendance.findOne({
      userId: executive._id,
      attendanceDate: "2026-07-23",
    }).lean();
    expect(attendance).toBeTruthy();
    expect(attendance.source).toBe("MANUAL");
  });

  it("rejects regularization admin list for non-management users", async () => {
    const { executive } = await createCompanyUsers();

    await request(app)
      .get("/api/attendance/regularizations/admin")
      .set(authHeaderFor(executive))
      .expect(403);
  });
});
