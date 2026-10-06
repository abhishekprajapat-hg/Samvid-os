const express = require("express");
const router = express.Router();

const reportController = require("../controllers/report.controller");
const authMiddleware = require("../middleware/auth.middleware");
const companyMiddleware = require("../middleware/company.middleware");
const { writeLimiter } = require("../middleware/rateLimit.middleware");
const { USER_ROLES } = require("../constants/role.constants");
const { checkRoleOrPageAccess, requirePageActionForMethod } = require("../middleware/pageAccess.middleware");
const Report = require("../models/Report");
const { requireAdminApprovalForDelete, describeByModel } = require("../services/deleteApproval.service");

/*
 * The report history and the saved templates.
 *
 * Only the question is stored, never the answer - see models/Report.js - so
 * these routes are small on purpose: list, record, forget.
 */
const REPORT_ROLES = [USER_ROLES.ADMIN, USER_ROLES.MANAGER];

router.use(authMiddleware.protect);
router.use(checkRoleOrPageAccess(REPORT_ROLES, "reports"));
router.use(requirePageActionForMethod("reports"));
router.use(companyMiddleware.requireCompanyContext);

router.get("/", reportController.listReports);
router.post("/", writeLimiter, reportController.createReport);
// A Manager's delete becomes a request an Admin approves.
router.delete(
  "/:reportId",
  writeLimiter,
  requireAdminApprovalForDelete("report", {
    label: "Report",
    pageKey: "reports",
    idParam: "reportId",
    handler: reportController.deleteReport,
    describe: describeByModel(Report, ["name"]),
  }),
  reportController.deleteReport,
);

module.exports = router;
