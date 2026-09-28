const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth.middleware");
const companyMiddleware = require("../middleware/company.middleware");
const checkRole = require("../middleware/role.middleware");
const { writeLimiter } = require("../middleware/rateLimit.middleware");
const userPageAccess = require("../controllers/userPageAccess.controller");
const rolePermission = require("../controllers/rolePermission.controller");
const { resolveAccessProfile } = require("../services/access.service");

router.use(authMiddleware.protect);
router.use(companyMiddleware.requireCompanyContext);
router.use(companyMiddleware.enforceBodyCompanyMatch());

router.get("/me", async (req, res) => {
  try {
    return res.json({ access: await resolveAccessProfile(req.user) });
  } catch (error) {
    req.log?.error({ error: error.message }, "Access profile failed");
    return res.status(500).json({ message: "Unable to load page access" });
  }
});
/*
 * Roles, company-wide. Admin only, like the per-user screen below it: what a
 * role may reach decides it for everybody holding it, which is a wider change
 * than editing one person's access.
 */
router.get("/roles", checkRole(["ADMIN"]), rolePermission.listRoles);
router.patch("/roles/:role", writeLimiter, checkRole(["ADMIN"]), rolePermission.updateRole);
router.get("/users/:userId/pages", checkRole(["ADMIN"]), userPageAccess.handle());
router.patch("/users/:userId/pages", writeLimiter, checkRole(["ADMIN"]), userPageAccess.handle(true));
module.exports = router;
