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
 * Roles and per-person page access, company-wide.
 *
 * A Manager can do everything an Admin can except delete (business rule,
 * 29 Sep 2026), so both screens are open to Managers too. What a Manager may
 * change is narrower, and enforced where the change is made:
 *   - never an Admin, never a Manager (themselves included), never the
 *     Manager role - only an Admin sets what Managers reach;
 *   - never a grant they do not hold themselves, an admin-protected
 *     permission, or a delete (see assertGrantablePermissions).
 */
const ACCESS_EDITOR_ROLES = ["ADMIN", "MANAGER"];
router.get("/roles", checkRole(ACCESS_EDITOR_ROLES), rolePermission.listRoles);
router.patch("/roles/:role", writeLimiter, checkRole(ACCESS_EDITOR_ROLES), rolePermission.updateRole);
router.get("/users/:userId/pages", checkRole(ACCESS_EDITOR_ROLES), userPageAccess.handle());
router.patch("/users/:userId/pages", writeLimiter, checkRole(ACCESS_EDITOR_ROLES), userPageAccess.handle(true));
module.exports = router;
