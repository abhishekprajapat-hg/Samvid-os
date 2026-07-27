const express = require("express");

const router = express.Router();
const authMiddleware = require("../middleware/auth.middleware");
const companyMiddleware = require("../middleware/company.middleware");
const inventoryRequestController = require("../controllers/inventoryRequest.controller");
const inventoryApprovalController = require("../controllers/inventoryApproval.controller");
const { writeLimiter } = require("../middleware/rateLimit.middleware");

router.use(authMiddleware.protect);
router.use(companyMiddleware.requireCompanyContext);

router.post(
  "/",
  writeLimiter,
  authMiddleware.checkRole([
    "ADMIN",
    "MANAGER",
    "INSIDE_EXECUTIVE",
    "EXECUTIVE",
    "FIELD_EXECUTIVE",
    "CHANNEL_PARTNER",
  ]),
  companyMiddleware.enforceBodyCompanyMatch("companyId"),
  inventoryRequestController.createRequest,
);

// Legacy alias for older clients.
router.post(
  "/create",
  writeLimiter,
  authMiddleware.checkRole([
    "ADMIN",
    "MANAGER",
    "INSIDE_EXECUTIVE",
    "EXECUTIVE",
    "FIELD_EXECUTIVE",
    "CHANNEL_PARTNER",
  ]),
  companyMiddleware.enforceBodyCompanyMatch("companyId"),
  inventoryRequestController.createRequest,
);

router.get(
  "/pending",
  authMiddleware.checkRole(["ADMIN", "MANAGER"]),
  inventoryApprovalController.getPending,
);

router.patch(
  "/:id/pre-approve",
  writeLimiter,
  authMiddleware.checkRole(["MANAGER"]),
  inventoryApprovalController.preApprove,
);

router.patch(
  "/:id/approve",
  writeLimiter,
  authMiddleware.checkRole(["ADMIN", "MANAGER"]),
  inventoryApprovalController.approve,
);

router.patch(
  "/:id/reject",
  writeLimiter,
  authMiddleware.checkRole(["ADMIN", "MANAGER"]),
  inventoryApprovalController.reject,
);

// Legacy aliases
router.get(
  "/my",
  authMiddleware.checkRole([
    "FIELD_EXECUTIVE",
    "INSIDE_EXECUTIVE",
    "EXECUTIVE",
    "MANAGER",
    "ADMIN",
    "CHANNEL_PARTNER",
  ]),
  inventoryRequestController.getMyInventoryRequests,
);

router.post(
  "/update/:inventoryId",
  writeLimiter,
  authMiddleware.checkRole([
    "FIELD_EXECUTIVE",
    "INSIDE_EXECUTIVE",
    "EXECUTIVE",
    "MANAGER",
    "ADMIN",
  ]),
  inventoryRequestController.updateRequest,
);

router.post(
  "/delete/:inventoryId",
  writeLimiter,
  authMiddleware.checkRole([
    "FIELD_EXECUTIVE",
    "INSIDE_EXECUTIVE",
    "EXECUTIVE",
    "MANAGER",
    "ADMIN",
    "CHANNEL_PARTNER",
  ]),
  inventoryRequestController.deleteRequest,
);

module.exports = router;

