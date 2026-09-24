const clientPortalAuthService = require("../services/clientPortalAuth.service");
const logger = require("../config/logger");
const { handleControllerError: handleError } = require("../utils/httpError");

const handleControllerError = (res, error, message) => handleError(res, error, logger, message);

const resolveClientIp = (req) =>
  String(req.headers["x-forwarded-for"] || req.ip || req.connection?.remoteAddress || "").split(",")[0].trim();

exports.login = async (req, res) => {
  try {
    const { tokens, portalUser, client } = await clientPortalAuthService.login({
      email: req.body?.email,
      password: req.body?.password,
      ip: resolveClientIp(req),
      userAgent: req.headers["user-agent"] || "",
    });

    return res.json({
      message: "Login successful",
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: portalUser,
      client,
    });
  } catch (error) {
    return handleControllerError(res, error, "portal login failed");
  }
};

exports.refresh = async (req, res) => {
  try {
    const result = await clientPortalAuthService.refresh({
      rawRefreshToken: String(req.body?.refreshToken || "").trim(),
      ip: resolveClientIp(req),
      userAgent: req.headers["user-agent"] || "",
    });
    return res.json({ accessToken: result.accessToken, refreshToken: result.refreshToken, user: result.portalUser });
  } catch (error) {
    return handleControllerError(res, error, "portal token refresh failed");
  }
};

exports.logout = async (req, res) => {
  try {
    await clientPortalAuthService.logout({
      rawRefreshToken: String(req.body?.refreshToken || "").trim(),
      portalUserId: req.portalUser?._id,
      ip: resolveClientIp(req),
    });
    return res.json({ message: "Logout successful" });
  } catch (error) {
    return handleControllerError(res, error, "portal logout failed");
  }
};

exports.getMe = async (req, res) => {
  return res.json({
    user: {
      _id: req.portalUser._id,
      name: req.portalUser.name,
      email: req.portalUser.email,
      clientId: req.portalUser.clientId,
    },
  });
};
