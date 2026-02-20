const crypto = require("crypto");
const RefreshToken = require("../models/RefreshToken");
const generateToken = require("../utils/generateToken");

const REFRESH_TOKEN_TTL_DAYS = (() => {
  const parsed = Number.parseInt(process.env.REFRESH_TOKEN_TTL_DAYS, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 30;
})();

const buildTokenHash = (rawToken) =>
  crypto
    .createHash("sha256")
    .update(String(rawToken || ""))
    .digest("hex");

const createRawRefreshToken = () => crypto.randomBytes(48).toString("hex");

const buildRefreshExpiryDate = () =>
  new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

const issueAuthTokens = async ({ user, ip = "", userAgent = "" }) => {
  const familyId = crypto.randomUUID();
  const rawRefreshToken = createRawRefreshToken();
  const refreshTokenHash = buildTokenHash(rawRefreshToken);
  const accessToken = generateToken(user);

  await RefreshToken.create({
    userId: user._id,
    tokenHash: refreshTokenHash,
    familyId,
    expiresAt: buildRefreshExpiryDate(),
    createdByIp: String(ip || ""),
    userAgent: String(userAgent || "").slice(0, 300),
  });

  return {
    token: accessToken,
    accessToken,
    refreshToken: rawRefreshToken,
  };
};

const rotateRefreshToken = async ({ rawRefreshToken, ip = "", userAgent = "" }) => {
  const tokenHash = buildTokenHash(rawRefreshToken);

  const existingToken = await RefreshToken.findOne({ tokenHash });
  if (!existingToken) {
    return null;
  }

  const now = new Date();
  if (existingToken.revokedAt || existingToken.expiresAt <= now) {
    if (existingToken.familyId) {
      await RefreshToken.updateMany(
        { familyId: existingToken.familyId, revokedAt: null },
        {
          $set: {
            revokedAt: now,
            revokedByIp: String(ip || ""),
          },
        },
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

  await RefreshToken.create({
    userId: existingToken.userId,
    tokenHash: nextHash,
    familyId: existingToken.familyId,
    expiresAt: buildRefreshExpiryDate(),
    createdByIp: String(ip || ""),
    userAgent: String(userAgent || "").slice(0, 300),
  });

  return {
    userId: existingToken.userId,
    refreshToken: nextRawToken,
  };
};

const revokeRefreshToken = async ({ rawRefreshToken, ip = "" }) => {
  const tokenHash = buildTokenHash(rawRefreshToken);
  const existingToken = await RefreshToken.findOne({ tokenHash });
  if (!existingToken) return false;

  if (!existingToken.revokedAt) {
    existingToken.revokedAt = new Date();
    existingToken.revokedByIp = String(ip || "");
    await existingToken.save();
  }

  return true;
};

const revokeAllUserRefreshTokens = async ({ userId, ip = "" }) => {
  if (!userId) return 0;

  const result = await RefreshToken.updateMany(
    {
      userId,
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    },
    {
      $set: {
        revokedAt: new Date(),
        revokedByIp: String(ip || ""),
      },
    },
  );

  return Number(result?.modifiedCount || 0);
};

module.exports = {
  issueAuthTokens,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllUserRefreshTokens,
};
