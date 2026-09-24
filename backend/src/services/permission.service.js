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
} = require("./access.service");

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

  // A non-admin editor may only hand out what they hold themselves, and never
  // an admin-protected permission.
  await assertGrantablePermissions({ actor: actingUser, permissions: uniquePermissions });

  const previous = await RolePermission.findOne({ companyId, role }).lean();

  const updated = await RolePermission.findOneAndUpdate(
    { companyId, role },
    { $set: { permissions: uniquePermissions, updatedBy: actingUser._id } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
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
