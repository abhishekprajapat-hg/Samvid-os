const express = require("express");
const router = express.Router();

const leadController = require("../controllers/lead.controller");
const authMiddleware = require("../middleware/auth.middleware");
const { writeLimiter } = require("../middleware/rateLimit.middleware");
const {
  requirePageAccess,
  requirePageAction,
  requirePageActionForMethod,
} = require("../middleware/pageAccess.middleware");

// Router-level auth so the page guard can read req.user. The per-route
// authMiddleware.protect calls below stay as they are and short-circuit.
router.use(authMiddleware.protect);
router.use(requirePageAccess("leads", "my_leads"));
router.use(requirePageActionForMethod("leads", "my_leads"));

// ======================================
// CREATE LEAD (All logged in users)
// ======================================
router.post(
  "/",
  writeLimiter,
  authMiddleware.protect,
  requirePageAction("create", "leads", "my_leads"),
  leadController.createLead
);
router.post(
  "/bulk",
  writeLimiter,
  authMiddleware.protect,
  requirePageAction("create", "leads", "my_leads"),
  leadController.bulkUploadLeads,
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
  authMiddleware.checkRole(["ADMIN", "MANAGER"]),
  leadController.getLeadPaymentRequests
);

router.get(
  "/status-requests/pending",
  authMiddleware.protect,
  authMiddleware.checkRole(["ADMIN", "MANAGER"]),
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

router.get(
  "/:leadId",
  authMiddleware.protect,
  leadController.getLeadById
);

router.patch(
  "/status-requests/:requestId/approve",
  writeLimiter,
  authMiddleware.protect,
  authMiddleware.checkRole(["ADMIN", "MANAGER"]),
  requirePageAction("edit", "leads", "my_leads"),
  leadController.approveLeadStatusRequest
);

router.patch(
  "/status-requests/:requestId/reject",
  writeLimiter,
  authMiddleware.protect,
  authMiddleware.checkRole(["ADMIN", "MANAGER"]),
  requirePageAction("edit", "leads", "my_leads"),
  leadController.rejectLeadStatusRequest
);

// ======================================
// ASSIGN / TRANSFER LEAD (validated by controller)
// ======================================
router.patch(
  "/:leadId/assign",
  writeLimiter,
  authMiddleware.protect,
  requirePageAction("assign", "leads", "my_leads"),
  leadController.assignLead
);

router.patch(
  "/:leadId/properties",
  writeLimiter,
  authMiddleware.protect,
  requirePageAction("edit", "leads", "my_leads"),
  leadController.addRelatedPropertyToLead
);

router.patch(
  "/:leadId/properties/:inventoryId/select",
  writeLimiter,
  authMiddleware.protect,
  requirePageAction("edit", "leads", "my_leads"),
  leadController.selectRelatedPropertyForLead
);

router.delete(
  "/:leadId/properties/:inventoryId",
  writeLimiter,
  authMiddleware.protect,
  requirePageAction("edit", "leads", "my_leads"),
  leadController.removeRelatedPropertyFromLead
);

router.patch(
  "/:leadId",
  writeLimiter,
  authMiddleware.protect,
  requirePageAction("edit", "leads", "my_leads"),
  leadController.updateLeadBasics
);

// ======================================
// UPDATE STATUS
// ======================================
router.patch(
  "/:leadId/status",
  writeLimiter,
  authMiddleware.protect,
  requirePageAction("edit", "leads", "my_leads"),
  leadController.updateLeadStatus
);

router.post(
  "/:leadId/status-request",
  writeLimiter,
  authMiddleware.protect,
  requirePageAction("edit", "leads", "my_leads"),
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
  requirePageAction("follow_up", "leads", "my_leads"),
  leadController.addLeadDiaryEntry
);

router.patch(
  "/:leadId/diary/:entryId",
  writeLimiter,
  authMiddleware.protect,
  leadController.updateLeadDiaryEntry
);

module.exports = router;
