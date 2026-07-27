const express = require("express");

const attendanceController = require("../controllers/attendance.controller");
const { protect } = require("../middleware/auth.middleware");
const { writeLimiter } = require("../middleware/rateLimit.middleware");

const router = express.Router();

router.use(protect);

router.get("/me", attendanceController.getMyAttendance);
router.post("/check-in", writeLimiter, attendanceController.checkIn);
router.post("/break/start", writeLimiter, attendanceController.startBreak);
router.post("/break/end", writeLimiter, attendanceController.endBreak);
router.post("/check-out", writeLimiter, attendanceController.checkOut);
router.patch(
  "/users/:userId/:date/status",
  writeLimiter,
  attendanceController.updateUserAttendanceStatus,
);
router.get("/users/:userId", attendanceController.getUserAttendanceForAdmin);
router.get("/daily", attendanceController.getDailyAttendanceForAdmin);
router.get("/policy", attendanceController.getAttendancePolicy);
router.patch("/policy", writeLimiter, attendanceController.upsertAttendancePolicy);

router.get("/leave-balance/my", attendanceController.getMyLeaveBalance);
router.post("/leave-requests", writeLimiter, attendanceController.createLeaveRequest);
router.get("/leave-requests/my", attendanceController.getMyLeaveRequests);
router.get("/leave-requests/admin", attendanceController.getAdminLeaveRequests);
router.patch(
  "/leave-requests/:requestId/review",
  writeLimiter,
  attendanceController.reviewLeaveRequest,
);

router.post(
  "/regularizations",
  writeLimiter,
  attendanceController.createRegularizationRequest,
);
router.get("/regularizations/my", attendanceController.getMyRegularizations);
router.get("/regularizations/admin", attendanceController.getAdminRegularizations);
router.patch(
  "/regularizations/:regularizationId/review",
  writeLimiter,
  attendanceController.reviewRegularization,
);

module.exports = router;
