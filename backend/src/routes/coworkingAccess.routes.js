const express = require("express");
const router = express.Router();

const coworkingAccessController = require("../controllers/coworkingAccess.controller");
const cabinController = require("../controllers/coworkingCabin.controller");
const authMiddleware = require("../middleware/auth.middleware");
const companyMiddleware = require("../middleware/company.middleware");
const { requirePermission } = require("../middleware/permission.middleware");
const { writeLimiter } = require("../middleware/rateLimit.middleware");
const { USER_ROLES, COWORKING_ROLES } = require("../constants/role.constants");
const { checkRoleOrPageAccess, requirePageActionForMethod } = require("../middleware/pageAccess.middleware");

const COWORKING_ACCESS_ROLES = [
  USER_ROLES.ADMIN,
  USER_ROLES.MANAGER,
  ...COWORKING_ROLES,
];

router.use(authMiddleware.protect);
router.use(checkRoleOrPageAccess(COWORKING_ACCESS_ROLES, "coworking_booking", "coworking_clients"));
router.use(requirePageActionForMethod("coworking_booking", "coworking_clients"));
router.use(companyMiddleware.requireCompanyContext);

router.use("/properties", require("./coworkingProperty.routes"));
router.use("/floors", require("./coworkingFloor.routes"));
router.use("/board", require("./coworkingBoard.routes"));
router.use("/cabins", require("./coworkingCabin.routes"));
router.use("/clients", require("./coworkingClient.routes"));
router.use("/bookings", require("./coworkingBooking.routes"));
router.use("/contracts", require("./coworkingContract.routes"));
router.use("/invoices", require("./coworkingInvoice.routes"));
router.use("/payments", require("./coworkingPayment.routes"));
router.use("/expenses", require("./coworkingExpense.routes"));

router.get("/seats", requirePermission("seats.view"), cabinController.listSeats);

router.get("/permissions/me", coworkingAccessController.getMyPermissions);

router.get(
  "/roles",
  requirePermission("roles.view"),
  coworkingAccessController.listRoles,
);

router.patch(
  "/roles/:role",
  writeLimiter,
  requirePermission("roles.manage"),
  coworkingAccessController.updateRolePermissionsHandler,
);

router.get(
  "/users",
  requirePermission("users.view"),
  coworkingAccessController.listUsersHandler,
);

router.patch(
  "/users/:userId/role",
  writeLimiter,
  requirePermission("users.update"),
  coworkingAccessController.updateUserRoleHandler,
);

router.get(
  "/audit-logs",
  requirePermission("audit_logs.view"),
  coworkingAccessController.listAuditLogsHandler,
);

module.exports = router;
