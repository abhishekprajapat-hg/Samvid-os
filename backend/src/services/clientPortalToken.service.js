const crypto = require("crypto");
const ClientPortalRefreshToken = require("../models/ClientPortalRefreshToken");
const generateClientPortalToken = require("../utils/generateClientPortalToken");

// Mirrors services/authToken.service.js exactly, scoped to ClientPortalUser.
const REFRESH_TOKEN_TTL_DAYS = (() => {
  const parsed = Number.parseInt(process.env.PORTAL_REFRESH_TOKEN_TTL_DAYS || process.env.REFRESH_TOKEN_TTL_DAYS, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 30;
})();

const buildTokenHash = (rawToken) =>
  crypto.createHash("sha256").update(String(rawToken || "")).digest("hex");

const createRawRefreshToken = () => crypto.randomBytes(48).toString("hex");

const buildRefreshExpiryDate = () => new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

const issuePortalAuthTokens = async ({ portalUser, ip = "", userAgent = "" }) => {
  const familyId = crypto.randomUUID();
  const rawRefreshToken = createRawRefreshToken();
  const refreshTokenHash = buildTokenHash(rawRefreshToken);
  const accessToken = generateClientPortalToken(portalUser);

  await ClientPortalRefreshToken.create({
    portalUserId: portalUser._id,
    tokenHash: refreshTokenHash,
    familyId,
    expiresAt: buildRefreshExpiryDate(),
    createdByIp: String(ip || ""),
    userAgent: String(userAgent || "").slice(0, 300),
  });

  return { accessToken, refreshToken: rawRefreshToken };
};

const rotatePortalRefreshToken = async ({ rawRefreshToken, ip = "", userAgent = "" }) => {
  const tokenHash = buildTokenHash(rawRefreshToken);
  const existingToken = await ClientPortalRefreshToken.findOne({ tokenHash });
  if (!existingToken) return null;

  const now = new Date();
  if (existingToken.revokedAt || existingToken.expiresAt <= now) {
    if (existingToken.familyId) {
      await ClientPortalRefreshToken.updateMany(
        { familyId: existingToken.familyId, revokedAt: null },
        { $set: { revokedAt: now, revokedByIp: String(ip || "") } },
      );
    }
    return null;
  }

  const nextRawToken = createRawRefreshToken();
  const nextHash = buildTokenHash(nextRawToken);

  existingToken.revokedAt = now;
  existingToken.revokedByIp = String(ip || "");
  existingToken.replacedByTokenHash = nextHash;
  await existingToken.save();

  await ClientPortalRefreshToken.create({
    portalUserId: existingToken.portalUserId,
    tokenHash: nextHash,
    familyId: existingToken.familyId,
    expiresAt: buildRefreshExpiryDate(),
    createdByIp: String(ip || ""),
    userAgent: String(userAgent || "").slice(0, 300),
  });

  return { portalUserId: existingToken.portalUserId, refreshToken: nextRawToken };
};

const revokePortalRefreshToken = async ({ rawRefreshToken, ip = "" }) => {
  const tokenHash = buildTokenHash(rawRefreshToken);
  const existingToken = await ClientPortalRefreshToken.findOne({ tokenHash });
  if (!existingToken) return false;

  if (!existingToken.revokedAt) {
    existingToken.revokedAt = new Date();
    existingToken.revokedByIp = String(ip || "");
    await existingToken.save();
  }
  return true;
};

const revokeAllPortalUserRefreshTokens = async ({ portalUserId, ip = "" }) => {
  if (!portalUserId) return 0;
  const result = await ClientPortalRefreshToken.updateMany(
    { portalUserId, revokedAt: null, expiresAt: { $gt: new Date() } },
    { $set: { revokedAt: new Date(), revokedByIp: String(ip || "") } },
  );
  return Number(result?.modifiedCount || 0);
};

module.exports = {
  issuePortalAuthTokens,
  rotatePortalRefreshToken,
  revokePortalRefreshToken,
  revokeAllPortalUserRefreshTokens,
};
