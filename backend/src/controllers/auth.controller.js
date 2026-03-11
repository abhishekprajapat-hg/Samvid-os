const mongoose = require("mongoose");
const User = require("../models/User");
const Company = require("../models/Company");
const generateToken = require("../utils/generateToken");
const logger = require("../config/logger");
const { USER_ROLES } = require("../constants/role.constants");
const {
  issueAuthTokens,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllUserRefreshTokens,
} = require("../services/authToken.service");

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);
const toBoolean = (value, fallback = false) => {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return fallback;
  if (raw === "true" || raw === "1" || raw === "yes") return true;
  if (raw === "false" || raw === "0" || raw === "no") return false;
  return fallback;
};

const resolveClientIp = (req) =>
  String(
    req.headers["x-forwarded-for"]
    || req.ip
    || req.connection?.remoteAddress
    || "",
  )
    .split(",")[0]
    .trim();

const resolveCompanyContextForLogin = async (user) => {
  if (user.role === USER_ROLES.SUPER_ADMIN) return null;

  if (user.companyId) return user.companyId;

  if (user.role === USER_ROLES.ADMIN) {
    user.companyId = user._id;
    await user.save();
    return user.companyId;
  }

  let cursor = user;
  let hops = 0;

  while (cursor?.parentId && hops < 6) {
    if (!isValidObjectId(cursor.parentId)) break;

    const parent = await User.findById(cursor.parentId).select(
      "_id role parentId companyId isActive",
    );
    if (!parent || !parent.isActive) break;

    if (!parent.companyId && parent.role === USER_ROLES.ADMIN) {
      parent.companyId = parent._id;
      await parent.save();
    }

    if (parent.companyId) {
      user.companyId = parent.companyId;
      await user.save();
      return user.companyId;
    }

    cursor = parent;
    hops += 1;
  }

  return null;
};

const toAuthResponse = ({ user, tokenBundle, tenant = null }) => ({
  message: "Login successful",
  token: tokenBundle.token,
  accessToken: tokenBundle.accessToken,
  refreshToken: tokenBundle.refreshToken,
  user: {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    companyId: user.companyId,
    parentId: user.parentId || null,
    partnerCode: user.partnerCode || null,
    canViewInventory: Boolean(user.canViewInventory),
  },
  tenant: tenant
    ? {
      id: tenant._id,
      name: tenant.name,
      subdomain: tenant.subdomain,
      customDomain: tenant.customDomain || "",
    }
    : null,
});

exports.login = async (req, res) => {
  try {
    const { email, password, portal } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password required",
      });
    }

    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: "Account is deactivated" });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    if (portal === "ADMIN" && ![USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN].includes(user.role)) {
      return res.status(403).json({
        message: "Access denied. Admin only.",
      });
    }

    if (portal === "GENERAL" && [USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN].includes(user.role)) {
      return res.status(403).json({
        message: "Admin must login via admin portal.",
      });
    }

    const isSuperAdmin = user.role === USER_ROLES.SUPER_ADMIN;
    const requireTenantContext = toBoolean(process.env.SAAS_REQUIRE_TENANT_HOST, false);

    if (!isSuperAdmin) {
      const companyId = user.companyId || (await resolveCompanyContextForLogin(user));
      if (!companyId) {
        return res.status(403).json({
          message: "Company context is missing for this account",
        });
      }

      if (req.tenant?._id && String(req.tenant._id) !== String(companyId)) {
        return res.status(403).json({
          message: "Tenant mismatch. Use your own company route /<company-slug>/login.",
        });
      }

      if (requireTenantContext && !req.tenant?._id) {
        return res.status(403).json({
          message: "Tenant context is required for this login. Use /<company-slug>/login",
        });
      }

      const company = req.tenant?._id && String(req.tenant._id) === String(companyId)
        ? req.tenant
        : await Company.findById(companyId).select("_id status name subdomain customDomain").lean();
      if (!company || company.status !== "ACTIVE") {
        return res.status(403).json({
          message: "Tenant is inactive. Please contact platform support.",
        });
      }
    }

    const tokenBundle = await issueAuthTokens({
      user,
      ip: resolveClientIp(req),
      userAgent: req.headers["user-agent"] || "",
    });

    return res.json(toAuthResponse({ user, tokenBundle, tenant: req.tenant || null }));
  } catch (error) {
    logger.error({
      requestId: req.requestId || null,
      error: error.message,
      message: "Login failed",
    });
    return res.status(500).json({ message: "Server error" });
  }
};

exports.refresh = async (req, res) => {
  try {
    const rawRefreshToken = String(req.body?.refreshToken || "").trim();
    if (!rawRefreshToken) {
      return res.status(400).json({ message: "refreshToken is required" });
    }

    const rotated = await rotateRefreshToken({
      rawRefreshToken,
      ip: resolveClientIp(req),
      userAgent: req.headers["user-agent"] || "",
    });

    if (!rotated?.userId) {
      return res.status(401).json({ message: "Invalid refresh token" });
    }

    const user = await User.findById(rotated.userId).select(
      "_id name email role companyId parentId partnerCode canViewInventory isActive",
    );

    if (!user || !user.isActive) {
      return res.status(401).json({ message: "User not found or inactive" });
    }

    const accessToken = generateToken(user);
    return res.json({
      token: accessToken,
      accessToken,
      refreshToken: rotated.refreshToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        companyId: user.companyId || null,
        parentId: user.parentId || null,
        partnerCode: user.partnerCode || null,
        canViewInventory: Boolean(user.canViewInventory),
      },
    });
  } catch (error) {
    logger.error({
      requestId: req.requestId || null,
      error: error.message,
      message: "Token refresh failed",
    });
    return res.status(500).json({ message: "Server error" });
  }
};

exports.logout = async (req, res) => {
  try {
    const rawRefreshToken = String(req.body?.refreshToken || "").trim();

    if (rawRefreshToken) {
      await revokeRefreshToken({
        rawRefreshToken,
        ip: resolveClientIp(req),
      });
    } else if (req.user?._id) {
      await revokeAllUserRefreshTokens({
        userId: req.user._id,
        ip: resolveClientIp(req),
      });
    }

    return res.json({ message: "Logout successful" });
  } catch (error) {
    logger.error({
      requestId: req.requestId || null,
      error: error.message,
      message: "Logout failed",
    });
    return res.status(500).json({ message: "Server error" });
  }
};

exports.getMe = async (req, res) => {
  try {
    return res.json({
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        companyId: req.user.companyId || null,
        parentId: req.user.parentId || null,
        partnerCode: req.user.partnerCode || null,
        canViewInventory: Boolean(req.user.canViewInventory),
      },
      tenant: req.tenant
        ? {
          id: req.tenant._id,
          name: req.tenant.name,
          subdomain: req.tenant.subdomain,
          customDomain: req.tenant.customDomain || "",
        }
        : null,
    });
  } catch (error) {
    logger.error({
      requestId: req.requestId || null,
      error: error.message,
      message: "GetMe failed",
    });
    return res.status(500).json({ message: "Server error" });
  }
};
