const mongoose = require("mongoose");
const ClientPortalUser = require("../models/ClientPortalUser");
const CoworkingClient = require("../models/CoworkingClient");
const generateClientPortalToken = require("../utils/generateClientPortalToken");
const { createHttpError } = require("../utils/httpError");
const { writeAuditLog } = require("./auditLog.service");
const {
  issuePortalAuthTokens,
  rotatePortalRefreshToken,
  revokePortalRefreshToken,
  revokeAllPortalUserRefreshTokens,
} = require("./clientPortalToken.service");

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ============================================================================
// Login (public — used by the client-portal frontend)
// ============================================================================
const login = async ({ email, password, ip, userAgent }) => {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail || !password) {
    throw createHttpError(400, "Email and password are required");
  }

  const portalUser = await ClientPortalUser.findOne({ email: normalizedEmail }).select("+password");
  if (!portalUser) throw createHttpError(400, "Invalid credentials");
  if (!portalUser.isActive) throw createHttpError(403, "This account has been deactivated");

  const isMatch = await portalUser.matchPassword(password);
  if (!isMatch) throw createHttpError(400, "Invalid credentials");

  const client = await CoworkingClient.findOne({ _id: portalUser.clientId, companyId: portalUser.companyId })
    .select("companyName status")
    .lean();
  if (!client) throw createHttpError(403, "Your client account could not be found");

  const tokens = await issuePortalAuthTokens({ portalUser, ip, userAgent });
  portalUser.lastLoginAt = new Date();
  await portalUser.save({ validateBeforeSave: false });

  return {
    tokens,
    portalUser: { _id: portalUser._id, name: portalUser.name, email: portalUser.email, clientId: portalUser.clientId },
    client,
  };
};

const refresh = async ({ rawRefreshToken, ip, userAgent }) => {
  if (!rawRefreshToken) throw createHttpError(400, "refreshToken is required");

  const rotated = await rotatePortalRefreshToken({ rawRefreshToken, ip, userAgent });
  if (!rotated?.portalUserId) throw createHttpError(401, "Invalid refresh token");

  const portalUser = await ClientPortalUser.findById(rotated.portalUserId);
  if (!portalUser || !portalUser.isActive) throw createHttpError(401, "Account not found or inactive");

  return {
    accessToken: generateClientPortalToken(portalUser),
    refreshToken: rotated.refreshToken,
    portalUser: { _id: portalUser._id, name: portalUser.name, email: portalUser.email, clientId: portalUser.clientId },
  };
};

const logout = async ({ rawRefreshToken, portalUserId, ip }) => {
  if (rawRefreshToken) {
    await revokePortalRefreshToken({ rawRefreshToken, ip });
  } else if (portalUserId) {
    await revokeAllPortalUserRefreshTokens({ portalUserId, ip });
  }
};

// ============================================================================
// Staff-side management (creating/managing portal logins for a client)
// ============================================================================
const createPortalUser = async ({ companyId, clientId, payload, actingUser }) => {
  if (!isValidObjectId(clientId)) throw createHttpError(400, "Invalid client id");
  const client = await CoworkingClient.findOne({ _id: clientId, companyId }).select("_id").lean();
  if (!client) throw createHttpError(404, "Client not found");

  const name = String(payload?.name || "").trim();
  const email = String(payload?.email || "").trim().toLowerCase();
  const password = String(payload?.password || "");
  if (!name) throw createHttpError(400, "name is required");
  if (!EMAIL_PATTERN.test(email)) throw createHttpError(400, "A valid email is required");
  if (password.length < 6) throw createHttpError(400, "password must be at least 6 characters");

  const existing = await ClientPortalUser.findOne({ companyId, email }).select("_id").lean();
  if (existing) throw createHttpError(409, "A portal user with this email already exists");

  const portalUser = await ClientPortalUser.create({
    companyId,
    clientId,
    name: name.slice(0, 120),
    email,
    password,
    createdBy: actingUser._id,
  });

  await writeAuditLog({
    companyId,
    actor: actingUser,
    action: "CLIENT_PORTAL_USER_CREATED",
    entityType: "ClientPortalUser",
    entityId: portalUser._id,
    metadata: { clientId, email },
  });

  return { _id: portalUser._id, name: portalUser.name, email: portalUser.email, isActive: portalUser.isActive, createdAt: portalUser.createdAt };
};

const listPortalUsers = async ({ companyId, clientId }) => {
  if (!isValidObjectId(clientId)) throw createHttpError(400, "Invalid client id");
  return ClientPortalUser.find({ companyId, clientId })
    .select("name email isActive lastLoginAt createdAt")
    .sort({ createdAt: -1 })
    .lean();
};

const setPortalUserActive = async ({ companyId, clientId, portalUserId, isActive, actingUser }) => {
  const portalUser = await ClientPortalUser.findOne({ _id: portalUserId, companyId, clientId });
  if (!portalUser) throw createHttpError(404, "Portal user not found");

  portalUser.isActive = Boolean(isActive);
  await portalUser.save();
  if (!portalUser.isActive) {
    await revokeAllPortalUserRefreshTokens({ portalUserId: portalUser._id });
  }

  await writeAuditLog({
    companyId,
    actor: actingUser,
    action: isActive ? "CLIENT_PORTAL_USER_REACTIVATED" : "CLIENT_PORTAL_USER_DEACTIVATED",
    entityType: "ClientPortalUser",
    entityId: portalUser._id,
  });

  return { _id: portalUser._id, isActive: portalUser.isActive };
};

const resetPortalUserPassword = async ({ companyId, clientId, portalUserId, newPassword, actingUser }) => {
  const portalUser = await ClientPortalUser.findOne({ _id: portalUserId, companyId, clientId });
  if (!portalUser) throw createHttpError(404, "Portal user not found");
  if (String(newPassword || "").length < 6) throw createHttpError(400, "password must be at least 6 characters");

  portalUser.password = newPassword;
  await portalUser.save();
  await revokeAllPortalUserRefreshTokens({ portalUserId: portalUser._id });

  await writeAuditLog({
    companyId,
    actor: actingUser,
    action: "CLIENT_PORTAL_USER_PASSWORD_RESET",
    entityType: "ClientPortalUser",
    entityId: portalUser._id,
  });

  return { _id: portalUser._id };
};

module.exports = {
  login,
  refresh,
  logout,
  createPortalUser,
  listPortalUsers,
  setPortalUserActive,
  resetPortalUserPassword,
};
