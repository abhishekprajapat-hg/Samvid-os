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

// ======================================
// ASSIGN LEAD (Admin / Manager only)
// ======================================
router.patch(
  "/:leadId/assign",
  writeLimiter,
  authMiddleware.protect,
  authMiddleware.checkRole(["ADMIN", "MANAGER"]),
  leadController.assignLead
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

// ======================================
// LEAD ACTIVITY
// ======================================
router.get(
  "/:leadId/activity",
  authMiddleware.protect,
  leadController.getLeadActivity
);

module.exports = router;
