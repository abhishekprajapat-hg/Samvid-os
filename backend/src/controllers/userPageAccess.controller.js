const mongoose = require("mongoose");
const User = require("../models/User");
const {
  CRM_PAGES,
  isValidPageKey,
  isValidPageAction,
  toPagePermissions,
} = require("../constants/page.constants");
const { USER_ROLES } = require("../constants/role.constants");
const {
  resolveAccessProfile,
  invalidateAccessCache,
  assertGrantablePermissions,
} = require("../services/access.service");
const { writeAuditLog } = require("../services/auditLog.service");

const isAdmin = (user) => user?.role === USER_ROLES.ADMIN;

/*
 * What the signed-in person may do with this employee's page access.
 *
 * An Admin sets anybody's but another Admin's (Admins always reach every
 * page). A Manager sets the page access of the staff below Admin and Manager
 * level: not their own, not another Manager's - only an Admin decides what a
 * Manager reaches - and never with a delete grant (see the PATCH checks).
 */
const editPolicyFor = (actor, target) => {
  if (target.role === USER_ROLES.ADMIN) {
    return { canEdit: false, canGrantDelete: false, reason: "Admins always have access to all pages" };
  }
  if (isAdmin(actor)) return { canEdit: true, canGrantDelete: true, reason: "" };
  if (String(actor._id) === String(target._id)) {
    return { canEdit: false, canGrantDelete: false, reason: "You cannot change your own page access" };
  }
  if (target.role === USER_ROLES.MANAGER) {
    return { canEdit: false, canGrantDelete: false, reason: "Only an Admin can set a Manager's page access" };
  }
  return { canEdit: true, canGrantDelete: false, reason: "" };
};

const deleteGrantsOf = (pages = []) => toPagePermissions(pages)
  .filter((permission) => permission.endsWith(".delete"));

exports.handle = (update = false) => async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.userId)) return res.status(400).json({ message: "Invalid employee" });
    const user = await User.findOne({ _id: req.params.userId, companyId: req.user.companyId });
    if (!user) return res.status(404).json({ message: "Employee not found" });
    const policy = editPolicyFor(req.user, user);
    if (update) {
      if (user.role === "ADMIN") return res.status(400).json({ message: "Admins always have access to all pages" });
      if (!policy.canEdit) return res.status(403).json({ message: policy.reason });
      const hasActionPayload = Object.prototype.hasOwnProperty.call(req.body || {}, "pageAccess");
      const rawAccess = hasActionPayload ? req.body.pageAccess : req.body.pageKeys;
      if (rawAccess !== null && !Array.isArray(rawAccess)) {
        return res.status(400).json({ message: "Choose valid pages or use role defaults" });
      }
      const entries = rawAccess === null ? null : rawAccess.map((entry) => {
        if (!hasActionPayload && typeof entry === "string") return isValidPageKey(entry) ? entry : null;
        const pageKey = String(entry?.pageKey || "").trim();
        const actions = Array.isArray(entry?.actions) ? [...new Set(entry.actions)] : [];
        if (!isValidPageKey(pageKey) || actions.some((action) => !isValidPageAction(pageKey, action))) {
          return null;
        }
        return { pageKey, actions };
      });
      if (entries?.some((entry) => !entry)) {
        return res.status(400).json({ message: "Choose valid pages and actions or use role defaults" });
      }
      const nextOverride = entries === null
        ? null
        : (hasActionPayload
          ? [...new Map(entries.map((entry) => [entry.pageKey, entry])).values()]
          : [...new Set(entries)]);

      if (!isAdmin(req.user)) {
        // Compare what the employee would reach with what they reach today:
        // only the additions are grants, and those must pass the same checks
        // as a role edit - held by the Manager, not protected, not a delete.
        const [current, next] = await Promise.all([
          resolveAccessProfile(user),
          resolveAccessProfile({ ...user.toObject(), pageAccessOverride: nextOverride }),
        ]);
        await assertGrantablePermissions({
          actor: req.user,
          permissions: toPagePermissions(next.pages),
          existing: toPagePermissions(current.pages),
        });
      }

      const before = user.pageAccessOverride;
      user.pageAccessOverride = nextOverride;
      await user.save();
      invalidateAccessCache();
      await writeAuditLog({ companyId: req.user.companyId, actor: req.user, action: "USER_PAGE_ACCESS_UPDATED", entityType: "User", entityId: user._id, metadata: { before, after: user.pageAccessOverride }, req });
    }
    const access = await resolveAccessProfile(user);
    return res.json({
      pages: CRM_PAGES,
      pageKeys: access.pages.map((page) => page.pageKey),
      pageAccess: access.pages,
      usesRoleDefaults: user.pageAccessOverride === null,
      role: user.role,
      canEdit: policy.canEdit,
      canGrantDelete: policy.canGrantDelete,
      editBlockedReason: policy.reason,
      // Delete grants this employee holds today; a Manager may keep or remove
      // them but not add new ones.
      currentDeleteGrants: deleteGrantsOf(access.pages),
      // A Manager's "Delete" is a request an Admin approves.
      deleteNeedsApproval: user.role === USER_ROLES.MANAGER,
    });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
    req.log?.error({ error: error.message }, "Employee page access failed");
    return res.status(500).json({ message: "Unable to update employee page access" });
  }
};
