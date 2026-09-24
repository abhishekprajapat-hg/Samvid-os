const express = require("express");

const router = express.Router();
const authMiddleware = require("../middleware/auth.middleware");
const companyMiddleware = require("../middleware/company.middleware");
const inventoryRequestController = require("../controllers/inventoryRequest.controller");
const inventoryApprovalController = require("../controllers/inventoryApproval.controller");
const { writeLimiter } = require("../middleware/rateLimit.middleware");
const {
  requirePageAccess,
  requirePageActionForMethod,
  checkRoleOrPageAction,
} = require("../middleware/pageAccess.middleware");

router.use(authMiddleware.protect);
router.use(companyMiddleware.requireCompanyContext);
router.use(requirePageAccess("inventory"));
router.use(requirePageActionForMethod("inventory"));

router.post(
  "/",
  writeLimiter,
  checkRoleOrPageAction([
    "ADMIN",
    "MANAGER",
    "INSIDE_EXECUTIVE",
    "EXECUTIVE",
    "FIELD_EXECUTIVE",
    "CHANNEL_PARTNER",
  ], "create", "inventory"),
  companyMiddleware.enforceBodyCompanyMatch("companyId"),
  inventoryRequestController.createRequest,
);

// Legacy alias for older clients.
router.post(
  "/create",
  writeLimiter,
  checkRoleOrPageAction([
    "ADMIN",
    "MANAGER",
    "INSIDE_EXECUTIVE",
    "EXECUTIVE",
    "FIELD_EXECUTIVE",
    "CHANNEL_PARTNER",
  ], "create", "inventory"),
  companyMiddleware.enforceBodyCompanyMatch("companyId"),
  inventoryRequestController.createRequest,
);

router.get(
  "/pending",
  checkRoleOrPageAction(["ADMIN", "MANAGER"], "approve", "inventory"),
  inventoryApprovalController.getPending,
);

router.patch(
  "/:id/pre-approve",
  writeLimiter,
  checkRoleOrPageAction(["MANAGER"], "approve", "inventory"),
  inventoryApprovalController.preApprove,
);

router.patch(
  "/:id/approve",
  writeLimiter,
  checkRoleOrPageAction(["ADMIN", "MANAGER"], "approve", "inventory"),
  inventoryApprovalController.approve,
);

router.patch(
  "/:id/reject",
  writeLimiter,
  checkRoleOrPageAction(["ADMIN", "MANAGER"], "approve", "inventory"),
  inventoryApprovalController.reject,
);

// Legacy aliases
router.get(
  "/my",
  checkRoleOrPageAction([
    "FIELD_EXECUTIVE",
    "INSIDE_EXECUTIVE",
    "EXECUTIVE",
    "MANAGER",
    "ADMIN",
    "CHANNEL_PARTNER",
  ], "view", "inventory"),
  inventoryRequestController.getMyInventoryRequests,
);

router.post(
  "/update/:inventoryId",
  writeLimiter,
  checkRoleOrPageAction([
    "FIELD_EXECUTIVE",
    "INSIDE_EXECUTIVE",
    "EXECUTIVE",
    "MANAGER",
    "ADMIN",
  ], "edit", "inventory"),
  inventoryRequestController.updateRequest,
);

router.post(
  "/delete/:inventoryId",
  writeLimiter,
  checkRoleOrPageAction([
    "FIELD_EXECUTIVE",
    "INSIDE_EXECUTIVE",
    "EXECUTIVE",
    "MANAGER",
    "ADMIN",
    "CHANNEL_PARTNER",
  ], "delete", "inventory"),
  inventoryRequestController.deleteRequest,
);

module.exports = router;
