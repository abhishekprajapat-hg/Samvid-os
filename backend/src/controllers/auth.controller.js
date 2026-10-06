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
const {
  FILE_COOKIE_NAME,
  signFileSessionToken,
} = require("../utils/fileAccessToken");

/*
 * Uploaded files are rendered by <img>/<a>, which cannot send an Authorization
 * header, so the browser needs a credential it will attach by itself. This
 * cookie is scoped to the uploads path, is httpOnly so script cannot read it,
 * and carries a "files" scope that authMiddleware.protect refuses as a session.
 */
const setFileAccessCookie = (res, user) => {
  const isProduction = process.env.NODE_ENV === "production";
  const maxAgeSeconds = Number.parseInt(process.env.FILE_ACCESS_COOKIE_MAX_AGE_SECONDS, 10) || 12 * 60 * 60;
  const parts = [
    `${FILE_COOKIE_NAME}=${signFileSessionToken(user)}`,
    "Path=/api/uploads",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (isProduction) parts.push("Secure");
  res.append("Set-Cookie", parts.join("; "));
};

const clearFileAccessCookie = (res) => {
  const parts = [`${FILE_COOKIE_NAME}=`, "Path=/api/uploads", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (process.env.NODE_ENV === "production") parts.push("Secure");
  res.append("Set-Cookie", parts.join("; "));
};

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);
const BROKERAGE_MODES = new Set(["FLAT", "PERCENTAGE"]);
const DEFAULT_BROKERAGE_VALUE = 50000;
const DEFAULT_BROKERAGE_PERCENTAGE = 2;
const ROLE_TYPE_VALUES = new Set(["COMMERCIAL", "RESIDENTIAL", "BOTH", "COWORKING"]);
const normalizeRoleType = (value) => {
  const normalized = String(value || "").trim().toUpperCase();
  return ROLE_TYPE_VALUES.has(normalized) ? normalized : "COMMERCIAL";
};
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

  if (company || user.role !== USER_ROLES.ADMIN) {
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
    profileImageUrl: user.profileImageUrl || "",
    roleType: normalizeRoleType(user.roleType),
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
    const { email, password, portal } = req.body;

    /*
     * Both credentials have to be strings before they reach Mongo. Passing
     * { "email": { "$ne": null } } used to put the operator straight into the
     * query, match a real user, and only fail later because bcrypt threw on a
     * non-string - a 500, and an authentication that held by accident rather
     * than by design.
     */
    if (typeof email !== "string" || typeof password !== "string") {
      return res.status(400).json({ message: "Email and password required" });
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      return res.status(400).json({
        message: "Email and password required",
      });
    }

    const user = await User.findOne({ email: normalizedEmail }).select("+password");

    /*
     * 401, not 400: this is a failed authentication, not a malformed request.
     * The password is verified before the isActive check so that a deactivated
     * account answers exactly like an unknown one to anybody who does not hold
     * the password - otherwise any address could be probed for "deactivated".
     */
    const isMatch = user ? await user.matchPassword(password) : false;
    if (!user || !isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: "Account is deactivated" });
    }

    if (portal === "ADMIN" && user.role !== USER_ROLES.ADMIN) {
      return res.status(403).json({
        message: "Access denied. Admin only.",
      });
    }

    if (portal === "GENERAL" && user.role === USER_ROLES.ADMIN) {
      return res.status(403).json({
        message: "Admin must login via admin portal.",
      });
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

    user.lastLoginAt = new Date();
    /*
     * An invitation is accepted by using it. Stamping that here rather than on
     * a separate accept route means the team list's "Invited" chip clears
     * itself the first time the person signs in, whichever client they use.
     */
    if (user.invitedAt && !user.inviteAcceptedAt) {
      user.inviteAcceptedAt = user.lastLoginAt;
    }
    await user.save({ validateBeforeSave: false });

    setFileAccessCookie(res, user);
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
      "_id name email role roleType companyId parentId partnerCode canViewInventory brokerageConfig isActive profileImageUrl",
    );

    if (!user || !user.isActive) {
      return res.status(401).json({ message: "User not found or inactive" });
    }

    const accessToken = generateToken(user);
    setFileAccessCookie(res, user);
    return res.json({
      token: accessToken,
      accessToken,
      refreshToken: rotated.refreshToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        profileImageUrl: user.profileImageUrl || "",
        roleType: normalizeRoleType(user.roleType),
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

    clearFileAccessCookie(res);
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
        roleType: normalizeRoleType(req.user.roleType),
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
