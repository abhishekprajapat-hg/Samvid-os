const express = require("express");

const attendanceController = require("../controllers/attendance.controller");
const { protect } = require("../middleware/auth.middleware");
const { writeLimiter } = require("../middleware/rateLimit.middleware");
const { requirePageAccess, requirePageActionForMethod } = require("../middleware/pageAccess.middleware");

const router = express.Router();

router.use(protect);
router.use(requirePageAccess("attendance"));
router.use(requirePageActionForMethod("attendance"));

router.get("/violations", attendanceController.getViolations);
router.patch("/violations/:violationId", writeLimiter, attendanceController.reviewViolation);
router.get("/me", attendanceController.getMyAttendance);
router.post("/check-in", writeLimiter, attendanceController.checkIn);
router.post("/break/start", writeLimiter, attendanceController.startBreak);
router.post("/break/end", writeLimiter, attendanceController.endBreak);
router.post("/users/:userId/break", writeLimiter, attendanceController.manageUserBreak);
router.patch("/users/:userId/:date/breaks", writeLimiter, attendanceController.correctUserBreak);
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
router.get("/leave-balance/:userId", attendanceController.getLeaveBalanceForAdmin);
router.post("/leave-requests", writeLimiter, attendanceController.createLeaveRequest);
router.get("/leave-requests/my", attendanceController.getMyLeaveRequests);
router.get("/leave-requests/admin", attendanceController.getAdminLeaveRequests);
router.patch(
  "/leave-requests/:requestId/review",
  writeLimiter,
  attendanceController.reviewLeaveRequest,
);

module.exports = router;
