const express = require("express");
const router = express.Router();

const projectController = require("../controllers/project.controller");
const authMiddleware = require("../middleware/auth.middleware");
const companyMiddleware = require("../middleware/company.middleware");
const { writeLimiter } = require("../middleware/rateLimit.middleware");
const {
  requirePageAccess,
  checkRoleOrPageAccess,
  requirePageActionForMethod,
  checkRoleOrPageAction,
} = require("../middleware/pageAccess.middleware");

const PROJECT_VIEW_ROLES = [
  "ADMIN",
  "MANAGER",
  "EXECUTIVE",
  "FIELD_EXECUTIVE",
  "CHANNEL_PARTNER",
];
const PROJECT_MANAGE_ROLES = ["ADMIN", "MANAGER"];

router.use(authMiddleware.protect);
router.use(checkRoleOrPageAccess(PROJECT_VIEW_ROLES, "projects"));
router.use(companyMiddleware.requireCompanyContext);
router.use(requirePageAccess("projects"));
router.use(requirePageActionForMethod("projects"));

router.get("/", projectController.getProjects);
router.get("/:id", projectController.getProject);

router.post(
  "/",
  writeLimiter,
  checkRoleOrPageAction(PROJECT_MANAGE_ROLES, "create", "projects"),
  projectController.createProject,
);

router.patch(
  "/:id",
  writeLimiter,
  checkRoleOrPageAction(PROJECT_MANAGE_ROLES, "edit", "projects"),
  projectController.updateProject,
);

router.delete(
  "/:id",
  writeLimiter,
  checkRoleOrPageAction(["ADMIN"], "delete", "projects"),
  projectController.deleteProject,
);

module.exports = router;
