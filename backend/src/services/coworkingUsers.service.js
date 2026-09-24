const mongoose = require("mongoose");
const User = require("../models/User");
const { USER_ROLES, getAllowedParentRoles } = require("../constants/role.constants");
const { createHttpError } = require("../utils/httpError");
const { writeAuditLog } = require("./auditLog.service");

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const USER_LIST_FIELDS = "_id name email phone role parentId isActive createdAt";

const listCompanyUsers = async (companyId) =>
  User.find({ companyId })
    .select(USER_LIST_FIELDS)
    .populate("parentId", "name role")
    .sort({ createdAt: -1 })
    .lean();

const updateUserRole = async ({ companyId, userId, nextRole, reportingToId, actingUser, req }) => {
  if (!isValidObjectId(userId)) {
    throw createHttpError(400, "Invalid user id");
  }
  if (!Object.values(USER_ROLES).includes(nextRole)) {
    throw createHttpError(400, "Invalid role");
  }
  if (nextRole === USER_ROLES.ADMIN) {
    throw createHttpError(400, "Cannot assign ADMIN role");
  }

  const target = await User.findOne({ _id: userId, companyId });
  if (!target) {
    throw createHttpError(404, "User not found");
  }
  if (target.role === USER_ROLES.ADMIN) {
    throw createHttpError(403, "Admin account cannot be edited from this endpoint");
  }

  const previousRole = target.role;
  const allowedParentRoles = getAllowedParentRoles(nextRole);

  if (allowedParentRoles.length) {
    const candidateParentId = reportingToId || String(target.parentId || "");
    if (!isValidObjectId(candidateParentId)) {
      throw createHttpError(400, "reportingToId is required for this role");
    }

    const parent = await User.findOne({
      _id: candidateParentId,
      companyId,
      role: { $in: allowedParentRoles },
      isActive: true,
    })
      .select("_id")
      .lean();

    if (!parent) {
      throw createHttpError(400, "Invalid reportingToId for the selected role");
    }
    target.parentId = parent._id;
  }

  target.role = nextRole;
  await target.save();

  await writeAuditLog({
    companyId,
    actor: actingUser,
    action: "USER_ROLE_CHANGED",
    entityType: "User",
    entityId: target._id,
    metadata: { previousRole, nextRole },
    req,
  });

  return target;
};

module.exports = { listCompanyUsers, updateUserRole };
