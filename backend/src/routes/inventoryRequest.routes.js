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
  authMiddleware.checkRole(["FIELD_EXECUTIVE"]),
  companyMiddleware.enforceBodyCompanyMatch("companyId"),
  inventoryRequestController.createRequest,
);

// Legacy alias for older clients.
router.post(
  "/create",
  writeLimiter,
  authMiddleware.checkRole(["FIELD_EXECUTIVE"]),
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
  authMiddleware.checkRole(["ADMIN"]),
  inventoryApprovalController.approve,
);

router.patch(
  "/:id/reject",
  writeLimiter,
  authMiddleware.checkRole(["ADMIN"]),
  inventoryApprovalController.reject,
);

// Legacy aliases
router.get(
  "/my",
  authMiddleware.checkRole(["FIELD_EXECUTIVE", "EXECUTIVE", "MANAGER", "ADMIN"]),
  inventoryRequestController.getMyInventoryRequests,
);

router.post(
  "/update/:inventoryId",
  writeLimiter,
  authMiddleware.checkRole(["FIELD_EXECUTIVE"]),
  inventoryRequestController.updateRequest,
);

module.exports = router;
