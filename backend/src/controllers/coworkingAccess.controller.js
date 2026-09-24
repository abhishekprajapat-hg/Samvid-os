const {
  resolveEffectivePermissions,
  listRolesWithPermissions,
  updateRolePermissions,
} = require("../services/permission.service");
const { listAuditLogs } = require("../services/auditLog.service");
const { listCompanyUsers, updateUserRole } = require("../services/coworkingUsers.service");
const { USER_ROLES, ROLE_LABELS } = require("../constants/role.constants");
const logger = require("../config/logger");
const { handleControllerError: handleError } = require("../utils/httpError");

const handleControllerError = (res, error, message) => handleError(res, error, logger, message);

exports.getMyPermissions = async (req, res) => {
  try {
    const permissions = await resolveEffectivePermissions({
      companyId: req.user.companyId,
      role: req.user.role,
      user: req.user,
    });

    return res.json({
      role: req.user.role,
      isAdmin: req.user.role === USER_ROLES.ADMIN,
      permissions,
    });
  } catch (error) {
    return handleControllerError(res, error, "getMyPermissions failed");
  }
};

exports.listRoles = async (req, res) => {
  try {
    const roles = await listRolesWithPermissions(req.user.companyId);
    return res.json({ roles });
  } catch (error) {
    return handleControllerError(res, error, "listRoles failed");
  }
};

exports.updateRolePermissionsHandler = async (req, res) => {
  try {
    const { role } = req.params;
    const permissions = Array.isArray(req.body?.permissions) ? req.body.permissions : null;

    if (!permissions) {
      return res.status(400).json({ message: "permissions must be an array" });
    }

    const updated = await updateRolePermissions({
      companyId: req.user.companyId,
      role,
      permissions,
      actingUser: req.user,
      req,
    });

    return res.json({ role, permissions: updated.permissions });
  } catch (error) {
    return handleControllerError(res, error, "updateRolePermissions failed");
  }
};

exports.listUsersHandler = async (req, res) => {
  try {
    const users = await listCompanyUsers(req.user.companyId);
    return res.json({
      users,
      roleLabels: ROLE_LABELS,
      assignableRoles: Object.values(USER_ROLES).filter((role) => role !== USER_ROLES.ADMIN),
    });
  } catch (error) {
    return handleControllerError(res, error, "listUsers failed");
  }
};

exports.updateUserRoleHandler = async (req, res) => {
  try {
    const { userId } = req.params;
    const nextRole = String(req.body?.role || "").trim();
    const reportingToId = req.body?.reportingToId ? String(req.body.reportingToId).trim() : "";

    const updated = await updateUserRole({
      companyId: req.user.companyId,
      userId,
      nextRole,
      reportingToId,
      actingUser: req.user,
      req,
    });

    return res.json({
      user: {
        _id: updated._id,
        name: updated.name,
        email: updated.email,
        role: updated.role,
        parentId: updated.parentId,
      },
    });
  } catch (error) {
    return handleControllerError(res, error, "updateUserRole failed");
  }
};

exports.listAuditLogsHandler = async (req, res) => {
  try {
    const { logs, pagination } = await listAuditLogs({
      companyId: req.user.companyId,
      query: req.query,
    });

    return res.json({ logs, pagination });
  } catch (error) {
    return handleControllerError(res, error, "listAuditLogs failed");
  }
};
