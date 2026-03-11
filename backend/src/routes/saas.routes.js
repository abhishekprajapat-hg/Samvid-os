const express = require("express");

const saasController = require("../controllers/saas.controller");
const authMiddleware = require("../middleware/auth.middleware");
const { USER_ROLES } = require("../constants/role.constants");
const { writeLimiter } = require("../middleware/rateLimit.middleware");

const router = express.Router();

router.use(authMiddleware.protect);

// Tenant admin self-service settings
router.get(
  "/tenant/settings",
  authMiddleware.checkRole([USER_ROLES.ADMIN]),
  saasController.getMyTenantSettings,
);
router.patch(
  "/tenant/settings",
  writeLimiter,
  authMiddleware.checkRole([USER_ROLES.ADMIN]),
  saasController.updateMyTenantSettings,
);
router.get(
  "/tenant/meta",
  authMiddleware.checkRole([USER_ROLES.ADMIN]),
  saasController.getMyTenantMetaIntegration,
);
router.patch(
  "/tenant/meta",
  writeLimiter,
  authMiddleware.checkRole([USER_ROLES.ADMIN]),
  saasController.updateMyTenantMetaIntegration,
);

// Super admin platform controls
router.get(
  "/tenant/resolve",
  authMiddleware.checkRole([USER_ROLES.SUPER_ADMIN]),
  saasController.resolveTenantByHost,
);
router.get(
  "/companies",
  authMiddleware.checkRole([USER_ROLES.SUPER_ADMIN]),
  saasController.listCompanies,
);
router.post(
  "/companies",
  writeLimiter,
  authMiddleware.checkRole([USER_ROLES.SUPER_ADMIN]),
  saasController.createCompany,
);
router.patch(
  "/companies/:companyId",
  writeLimiter,
  authMiddleware.checkRole([USER_ROLES.SUPER_ADMIN]),
  saasController.updateCompany,
);

router.get(
  "/plans",
  authMiddleware.checkRole([USER_ROLES.SUPER_ADMIN]),
  saasController.listPlans,
);
router.post(
  "/plans",
  writeLimiter,
  authMiddleware.checkRole([USER_ROLES.SUPER_ADMIN]),
  saasController.createPlan,
);
router.patch(
  "/plans/:planId",
  writeLimiter,
  authMiddleware.checkRole([USER_ROLES.SUPER_ADMIN]),
  saasController.updatePlan,
);

router.post(
  "/subscriptions/assign",
  writeLimiter,
  authMiddleware.checkRole([USER_ROLES.SUPER_ADMIN]),
  saasController.assignSubscription,
);

router.get(
  "/usage/:companyId",
  authMiddleware.checkRole([USER_ROLES.SUPER_ADMIN]),
  saasController.getCompanyUsage,
);
router.get(
  "/analytics/global",
  authMiddleware.checkRole([USER_ROLES.SUPER_ADMIN]),
  saasController.getGlobalAnalytics,
);

module.exports = router;
