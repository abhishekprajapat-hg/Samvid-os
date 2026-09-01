const mongoose = require("mongoose");
const User = require("../models/User");
const Company = require("../models/Company");
const generateToken = require("../utils/generateToken");
const logger = require("../config/logger");
const { USER_ROLES, isPlatformAdminRole } = require("../constants/role.constants");
const {
  issueAuthTokens,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllUserRefreshTokens,
} = require("../services/authToken.service");

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);
const BROKERAGE_MODES = new Set(["FLAT", "PERCENTAGE"]);
const DEFAULT_BROKERAGE_VALUE = 50000;
const DEFAULT_BROKERAGE_PERCENTAGE = 2;
const toBrokerageConfigView = (config) => {
  const normalizedMode = String(config?.mode || "").trim().toUpperCase();
  const mode = BROKERAGE_MODES.has(normalizedMode) ? normalizedMode : "FLAT";
  const fallbackValue =
    mode === "PERCENTAGE" ? DEFAULT_BROKERAGE_PERCENTAGE : DEFAULT_BROKERAGE_VALUE;
  const parsedValue = Number(config?.value);
  const value = Number.isFinite(parsedValue) ? Math.max(0, parsedValue) : fallbackValue;

  return {
    mode,
    value: mode === "PERCENTAGE" ? Math.min(value, 100) : value,
    notes: String(config?.notes || "").trim(),
  };
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

const sanitizeSubdomain = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);

const buildFallbackCompanyName = (user) =>
  String(process.env.CLIENT_COMPANY_NAME || user?.name || "Client Company").trim();

const resolveUniqueSubdomain = async (user, companyId) => {
  const base =
    sanitizeSubdomain(process.env.CLIENT_COMPANY_SLUG)
    || sanitizeSubdomain(buildFallbackCompanyName(user))
    || sanitizeSubdomain(String(user?.email || "").split("@")[0])
    || `tenant-${String(companyId).slice(-8)}`;

  for (let attempt = 0; attempt < 100; attempt += 1) {
    const suffix = attempt === 0 ? "" : `-${attempt}`;
    const candidate = `${base.slice(0, 63 - suffix.length)}${suffix}`;
    const existing = await Company.findOne({ subdomain: candidate }).select("_id").lean();
    if (!existing) return candidate;
  }

  return `tenant-${String(companyId).slice(-12)}`;
};

const ensureCompanyContextForLogin = async (user, companyId) => {
  let company = await Company.findById(companyId)
    .select("_id status name subdomain customDomain")
    .lean();

  if (company || !isPlatformAdminRole(user.role)) {
    return company;
  }

  const subdomain = await resolveUniqueSubdomain(user, companyId);
  company = await Company.create({
    _id: companyId,
    name: buildFallbackCompanyName(user),
    subdomain,
    ownerUserId: user._id,
    status: "ACTIVE",
    metadata: {
      repairedAtLogin: new Date().toISOString(),
    },
  });

  return company.toObject();
};

const resolveCompanyContextForLogin = async (user) => {
  if (user.companyId) return user.companyId;

  if (isPlatformAdminRole(user.role)) {
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

    if (!parent.companyId && isPlatformAdminRole(parent.role)) {
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
    brokerageConfig: toBrokerageConfigView(user.brokerageConfig),
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
    const rawEmail = req.body?.email;
    const rawPassword = req.body?.password;
    const portal = typeof req.body?.portal === "string" ? req.body.portal : "";

    if (typeof rawEmail !== "string" || typeof rawPassword !== "string") {
      return res.status(400).json({
        message: "Email and password must be strings",
      });
    }

    const email = rawEmail.trim().toLowerCase();
    const password = rawPassword;

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

    if (portal === "SUPER_ADMIN" && user.role !== USER_ROLES.SUPER_ADMIN) {
      return res.status(403).json({
        message: "Access denied. Super admin only.",
      });
    }

    if (portal === "ADMIN" && user.role === USER_ROLES.SUPER_ADMIN) {
      return res.status(403).json({
        message: "Super admin must login via super admin portal.",
      });
    }

    if (portal === "ADMIN" && !isPlatformAdminRole(user.role)) {
      return res.status(403).json({
        message: "Access denied. Admin only.",
      });
    }

    if (portal !== "SUPER_ADMIN" && user.role === USER_ROLES.SUPER_ADMIN) {
      return res.status(403).json({
        message: "Super admin must login via super admin portal.",
      });
    }

    if (portal === "GENERAL" && isPlatformAdminRole(user.role)) {
      return res.status(403).json({
        message: "Admin must login via admin portal.",
      });
    }

    if (user.role === USER_ROLES.SUPER_ADMIN) {
      const tokenBundle = await issueAuthTokens({
        user,
        ip: resolveClientIp(req),
        userAgent: req.headers["user-agent"] || "",
      });

      return res.json(toAuthResponse({ user, tokenBundle, tenant: null }));
    }

    let resolvedTenant = req.tenant || null;

    const companyId = user.companyId || (await resolveCompanyContextForLogin(user));
    if (!companyId) {
      return res.status(403).json({
        message: "Company context is missing for this account",
      });
    }

    const company = await ensureCompanyContextForLogin(user, companyId);
    if (!company || company.status !== "ACTIVE") {
      return res.status(403).json({
        message: "Company is inactive. Please contact support.",
      });
    }
    resolvedTenant = company;

    const tokenBundle = await issueAuthTokens({
      user,
      ip: resolveClientIp(req),
      userAgent: req.headers["user-agent"] || "",
    });

    return res.json(toAuthResponse({ user, tokenBundle, tenant: resolvedTenant }));
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
      "_id name email role companyId parentId partnerCode canViewInventory brokerageConfig isActive",
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
        brokerageConfig: toBrokerageConfigView(user.brokerageConfig),
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
    let resolvedTenant = req.tenant || null;

    if (
      !resolvedTenant
      && req.user?.companyId
    ) {
      const company = await Company.findById(req.user.companyId)
        .select("_id name subdomain customDomain status")
        .lean();
      if (company && company.status === "ACTIVE") {
        resolvedTenant = company;
      }
    }

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
        brokerageConfig: toBrokerageConfigView(req.user.brokerageConfig),
      },
      tenant: resolvedTenant
        ? {
          id: resolvedTenant._id,
          name: resolvedTenant.name,
          subdomain: resolvedTenant.subdomain,
          customDomain: resolvedTenant.customDomain || "",
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
