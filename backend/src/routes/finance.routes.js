const express = require("express");
const router = express.Router();

const financeController = require("../controllers/finance.controller");
const authMiddleware = require("../middleware/auth.middleware");
const companyMiddleware = require("../middleware/company.middleware");
const { writeLimiter } = require("../middleware/rateLimit.middleware");
const { USER_ROLES } = require("../constants/role.constants");
const { checkRoleOrPageAccess, requirePageActionForMethod } = require("../middleware/pageAccess.middleware");

/*
 * The company-wide money screens.
 *
 * Mounted outside /api/coworking on purpose: the same invoices, payments and
 * expenses, but reached by anyone with the Finance page rather than only by
 * the coworking roles. The coworking routes keep their own gate and are
 * unchanged.
 */
const FINANCE_ROLES = [USER_ROLES.ADMIN, USER_ROLES.MANAGER];

router.use(authMiddleware.protect);
router.use(checkRoleOrPageAccess(FINANCE_ROLES, "finance"));
router.use(requirePageActionForMethod("finance"));
router.use(companyMiddleware.requireCompanyContext);

router.get("/overview", financeController.getOverview);
router.get("/transactions", financeController.listTransactions);
router.get("/invoices", financeController.listInvoices);
router.get("/invoices/:invoiceId", financeController.getInvoice);
router.post("/entries", writeLimiter, financeController.createEntry);

module.exports = router;
