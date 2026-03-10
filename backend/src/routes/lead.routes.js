const express = require("express");
const router = express.Router();

const leadController = require("../controllers/lead.controller");
const authMiddleware = require("../middleware/auth.middleware");
const { writeLimiter } = require("../middleware/rateLimit.middleware");

// ======================================
// CREATE LEAD (All logged in users)
// ======================================
router.post(
  "/",
  writeLimiter,
  authMiddleware.protect,
  leadController.createLead
);

// ======================================
// GET ALL LEADS (ROLE BASED inside controller)
// ======================================
router.get(
  "/",
  authMiddleware.protect,
  leadController.getAllLeads
);

// ======================================
// TODAY FOLLOW UPS  ⚠️ MUST BE ABOVE :leadId routes
// ======================================
router.get(
  "/followups/today",
  authMiddleware.protect,
  leadController.getTodayFollowUps
);

router.get(
  "/payment-requests",
  authMiddleware.protect,
  authMiddleware.checkRole(["ADMIN"]),
  leadController.getLeadPaymentRequests
);

router.get(
  "/status-requests/pending",
  authMiddleware.protect,
  authMiddleware.checkRole(["ADMIN", "MANAGER", "ASSISTANT_MANAGER", "TEAM_LEADER"]),
  leadController.getPendingLeadStatusRequests
);

router.get(
  "/status-requests",
  authMiddleware.protect,
  leadController.getLeadStatusRequests
);

router.get(
  "/performance/overview",
  authMiddleware.protect,
  leadController.getCompanyPerformanceOverview
);

router.patch(
  "/status-requests/:requestId/approve",
  writeLimiter,
  authMiddleware.protect,
  authMiddleware.checkRole(["ADMIN"]),
  leadController.approveLeadStatusRequest
);

router.patch(
  "/status-requests/:requestId/reject",
  writeLimiter,
  authMiddleware.protect,
  authMiddleware.checkRole(["ADMIN"]),
  leadController.rejectLeadStatusRequest
);

// ======================================
// ASSIGN LEAD (Admin + Leadership roles)
// ======================================
router.patch(
  "/:leadId/assign",
  writeLimiter,
  authMiddleware.protect,
  authMiddleware.checkRole(["ADMIN", "MANAGER", "ASSISTANT_MANAGER", "TEAM_LEADER"]),
  leadController.assignLead
);

router.patch(
  "/:leadId/properties",
  writeLimiter,
  authMiddleware.protect,
  leadController.addRelatedPropertyToLead
);

router.patch(
  "/:leadId/properties/:inventoryId/select",
  writeLimiter,
  authMiddleware.protect,
  leadController.selectRelatedPropertyForLead
);

router.delete(
  "/:leadId/properties/:inventoryId",
  writeLimiter,
  authMiddleware.protect,
  leadController.removeRelatedPropertyFromLead
);

router.patch(
  "/:leadId",
  writeLimiter,
  authMiddleware.protect,
  leadController.updateLeadBasics
);

// ======================================
// UPDATE STATUS
// ======================================
router.patch(
  "/:leadId/status",
  writeLimiter,
  authMiddleware.protect,
  leadController.updateLeadStatus
);

router.post(
  "/:leadId/status-request",
  writeLimiter,
  authMiddleware.protect,
  leadController.requestLeadStatusChange
);

// ======================================
// LEAD ACTIVITY
// ======================================
router.get(
  "/:leadId/activity",
  authMiddleware.protect,
  leadController.getLeadActivity
);

router.get(
  "/:leadId/diary",
  authMiddleware.protect,
  leadController.getLeadDiary
);

router.post(
  "/:leadId/diary",
  writeLimiter,
  authMiddleware.protect,
  leadController.addLeadDiaryEntry
);

module.exports = router;
