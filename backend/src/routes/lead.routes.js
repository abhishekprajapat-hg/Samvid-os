const express = require("express");
const router = express.Router();

const leadController = require("../controllers/lead.controller");
const authMiddleware = require("../middleware/auth.middleware");
const { writeLimiter } = require("../middleware/rateLimit.middleware");
const {
  requirePageAccess,
  requirePageAction,
  requirePageActionForMethod,
  checkRoleOrPageAccess,
  checkRoleOrPageAction,
} = require("../middleware/pageAccess.middleware");
const { requireAdminApprovalForDelete, describeByModel } = require("../services/deleteApproval.service");
const Lead = require("../models/Lead");

/*
 * The built-in lead hierarchy. Anyone outside it (Production Executive,
 * Community Manager, Coworking admin, or a custom role built on them) reaches
 * leads only where an Admin has explicitly granted the Leads page.
 *
 * getAllLeads already enforced this through buildLeadScope, but its siblings -
 * the analytics and status-request endpoints - did not, so a role that got 403
 * from GET /leads could still read company-wide lead totals from
 * /leads/performance/overview. Gating at the router keeps every lead route
 * answering the same question the same way.
 */
const LEAD_MODULE_ROLES = [
  "ADMIN",
  "MANAGER",
  "EXECUTIVE",
  "INSIDE_EXECUTIVE",
  "FIELD_EXECUTIVE",
  "CHANNEL_PARTNER",
];

/*
 * Internal staff only. A Channel Partner is an outside broker who may work the
 * leads they introduced, but company-wide performance totals and the internal
 * status-change approval queue are not theirs to read.
 */
const INTERNAL_LEAD_ROLES = LEAD_MODULE_ROLES.filter((role) => role !== "CHANNEL_PARTNER");

// Router-level auth so the page guard can read req.user. The per-route
// authMiddleware.protect calls below stay as they are and short-circuit.
router.use(authMiddleware.protect);
router.use(checkRoleOrPageAccess(LEAD_MODULE_ROLES, "leads", "my_leads"));
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
// DASHBOARD SUMMARY (same scope + filters as GET /) ⚠️ above :leadId
// ======================================
router.get(
  "/summary",
  authMiddleware.protect,
  leadController.getLeadSummary
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
  authMiddleware.checkRole(INTERNAL_LEAD_ROLES),
  leadController.getLeadStatusRequests
);

router.get(
  "/performance/overview",
  authMiddleware.protect,
  authMiddleware.checkRole(INTERNAL_LEAD_ROLES),
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
// DELETE LEAD - Admin deletes; a Manager's delete waits for Admin approval.
// ======================================
router.delete(
  "/:leadId",
  writeLimiter,
  authMiddleware.protect,
  checkRoleOrPageAction(["ADMIN", "MANAGER"], "delete", "leads", "my_leads"),
  requireAdminApprovalForDelete("lead", {
    label: "Lead",
    pageKey: "leads",
    idParam: "leadId",
    handler: leadController.deleteLead,
    describe: describeByModel(Lead, ["name", "phone"]),
  }),
  leadController.deleteLead
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

router.patch(
  "/:leadId/follow-up/complete",
  writeLimiter,
  authMiddleware.protect,
  requirePageAction("follow_up", "leads", "my_leads"),
  leadController.completeLeadFollowUp
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

module.exports = router;
