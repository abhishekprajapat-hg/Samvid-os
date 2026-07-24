const express = require("express");

const saasController = require("../controllers/saas.controller");
const authMiddleware = require("../middleware/auth.middleware");
const { USER_ROLES } = require("../constants/role.constants");
const { writeLimiter } = require("../middleware/rateLimit.middleware");

const router = express.Router();
const TENANT_ADMIN_ROLES = [USER_ROLES.ADMIN, USER_ROLES.MANAGER];
const PLATFORM_ADMIN_ROLES = [USER_ROLES.SUPER_ADMIN];

router.use(authMiddleware.protect);

// Super admin platform controls.
router.get(
  "/tenant/resolve",
  authMiddleware.checkRole(PLATFORM_ADMIN_ROLES),
  saasController.resolveTenantByHost,
);
router.get(
  "/companies",
  authMiddleware.checkRole(PLATFORM_ADMIN_ROLES),
  saasController.listCompanies,
);
router.post(
  "/companies",
  writeLimiter,
  authMiddleware.checkRole(PLATFORM_ADMIN_ROLES),
  saasController.createCompany,
);
router.patch(
  "/companies/:companyId",
  writeLimiter,
  authMiddleware.checkRole(PLATFORM_ADMIN_ROLES),
  saasController.updateCompany,
);
router.delete(
  "/companies/:companyId",
  writeLimiter,
  authMiddleware.checkRole(PLATFORM_ADMIN_ROLES),
  saasController.deleteCompany,
);
router.post(
  "/companies/:companyId/admin/reset-password",
  writeLimiter,
  authMiddleware.checkRole(PLATFORM_ADMIN_ROLES),
  saasController.resetCompanyAdminPassword,
);
router.get(
  "/plans",
  authMiddleware.checkRole(PLATFORM_ADMIN_ROLES),
  saasController.listPlans,
);
router.post(
  "/plans",
  writeLimiter,
  authMiddleware.checkRole(PLATFORM_ADMIN_ROLES),
  saasController.createPlan,
);
router.patch(
  "/plans/:planId",
  writeLimiter,
  authMiddleware.checkRole(PLATFORM_ADMIN_ROLES),
  saasController.updatePlan,
);
router.post(
  "/subscriptions/assign",
  writeLimiter,
  authMiddleware.checkRole(PLATFORM_ADMIN_ROLES),
  saasController.assignSubscription,
);
router.get(
  "/usage/:companyId",
  authMiddleware.checkRole(PLATFORM_ADMIN_ROLES),
  saasController.getCompanyUsage,
);
router.get(
  "/analytics/global",
  authMiddleware.checkRole(PLATFORM_ADMIN_ROLES),
  saasController.getGlobalAnalytics,
);

// Single-client admin self-service settings.
router.get(
  "/tenant/settings",
  authMiddleware.checkRole(TENANT_ADMIN_ROLES),
  saasController.getMyTenantSettings,
);
router.patch(
  "/tenant/settings",
  writeLimiter,
  authMiddleware.checkRole(TENANT_ADMIN_ROLES),
  saasController.updateMyTenantSettings,
);
router.get(
  "/tenant/meta",
  authMiddleware.checkRole(TENANT_ADMIN_ROLES),
  saasController.getMyTenantMetaIntegration,
);
router.patch(
  "/tenant/meta",
  writeLimiter,
  authMiddleware.checkRole(TENANT_ADMIN_ROLES),
  saasController.updateMyTenantMetaIntegration,
);

module.exports = router;
