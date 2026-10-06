const mongoose = require("mongoose");
const RolePermission = require("../models/RolePermission");
const { USER_ROLES, ROLE_LABELS } = require("../constants/role.constants");
const {
  PERMISSIONS,
  getDefaultPermissionsForRole,
  isValidPermission,
} = require("../constants/permission.constants");
const { createHttpError } = require("../utils/httpError");
const { writeAuditLog } = require("./auditLog.service");
const {
  resolveEffectivePermissions,
  hasPermission,
  assertGrantablePermissions,
  invalidateAccessCache,
  pageEntriesFromPermissions,
  normalizePageEntries,
} = require("./access.service");
const { toPagePermissions } = require("../constants/page.constants");
const { getDefaultPageAccessForRole } = require("../constants/rolePageAccess.constants");

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const getCompanyIdForUser = (user) => {
  const companyId = user?.companyId;
  if (!companyId || !isValidObjectId(companyId)) {
    throw createHttpError(403, "Company context is required");
  }
  return companyId;
};

// ADMIN always has every permission — mirrors the ADMIN auto-grant
// convention used by canAccess() on the frontend and by resolveCompanyContext
// on the backend (ADMIN is the tenant root).
//
// Permission resolution itself now lives in access.service.js, which unions the
// legacy role defaults / overrides read here with the dynamic Role document a
// user may be assigned to.
const isAdminRole = (role) => role === USER_ROLES.ADMIN;

const listRolesWithPermissions = async (companyId) => {
  const overrides = await RolePermission.find({ companyId }).select("role permissions updatedAt").lean();
  const overrideByRole = new Map(overrides.map((row) => [row.role, row]));

  return Object.values(USER_ROLES).map((role) => {
    const override = overrideByRole.get(role);
    return {
      role,
      label: ROLE_LABELS[role] || role,
      permissions: isAdminRole(role)
        ? [...PERMISSIONS]
        : override?.permissions || getDefaultPermissionsForRole(role),
      isOverridden: Boolean(override),
      isFixed: isAdminRole(role),
      updatedAt: override?.updatedAt || null,
    };
  });
};

const updateRolePermissions = async ({ companyId, role, permissions, actingUser, req }) => {
  if (!Object.values(USER_ROLES).includes(role)) {
    throw createHttpError(400, "Unknown role");
  }
  if (isAdminRole(role)) {
    throw createHttpError(400, "ADMIN permissions cannot be modified");
  }
  if (!Array.isArray(permissions) || !permissions.every((value) => isValidPermission(value))) {
    throw createHttpError(400, "One or more permissions are not recognized");
  }

  const uniquePermissions = [...new Set(permissions)];

  // A Manager edits every role below them, but not their own role or the
  // Admin's: that would let a Manager widen what Managers can do.
  if (!isAdminRole(actingUser?.role) && role === USER_ROLES.MANAGER) {
    throw createHttpError(403, "Only an Admin can change the Manager role");
  }

  const previous = await RolePermission.findOne({ companyId, role }).lean();

  // What the role holds today, pages included, whether they come from its own
  // list or from the built-in defaults.
  const previousPermissions = previous?.permissions || getDefaultPermissionsForRole(role);
  const previousPageEntries = pageEntriesFromPermissions(previousPermissions);
  const previousPages = normalizePageEntries(
    previousPageEntries.length ? previousPageEntries : getDefaultPageAccessForRole(role),
  );

  // A non-admin editor may only hand out what they hold themselves, never an
  // admin-protected permission and never a delete. What the role already
  // holds may stay.
  await assertGrantablePermissions({
    actor: actingUser,
    permissions: uniquePermissions,
    existing: [...previousPermissions, ...toPagePermissions(previousPages)],
  });

  const updated = await RolePermission.findOneAndUpdate(
    { companyId, role },
    { $set: { permissions: uniquePermissions, updatedBy: actingUser._id } },
    { returnDocument: "after", upsert: true, setDefaultsOnInsert: true },
  ).lean();

  invalidateAccessCache();

  await writeAuditLog({
    companyId,
    actor: actingUser,
    action: "ROLE_PERMISSIONS_UPDATED",
    entityType: "RolePermission",
    entityId: role,
    metadata: {
      role,
      previousPermissions: previous?.permissions || getDefaultPermissionsForRole(role),
      nextPermissions: uniquePermissions,
    },
    req,
  });

  return updated;
};

module.exports = {
  resolveEffectivePermissions,
  hasPermission,
  listRolesWithPermissions,
  updateRolePermissions,
  getCompanyIdForUser,
};
