const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const User = require("../models/User");
const Company = require("../models/Company");
const { USER_ROLES, isPlatformAdminRole } = require("../constants/role.constants");
const { createTtlCache } = require("../utils/ttlCache");

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);
const companyStatusCache = createTtlCache({
  ttlMs: process.env.COMPANY_STATUS_CACHE_TTL_MS || 30000,
  maxEntries: process.env.COMPANY_STATUS_CACHE_MAX_ENTRIES || 1000,
});

const getCachedCompanyStatus = async (companyId) => {
  const cacheKey = String(companyId || "");
  const cachedStatus = companyStatusCache.get(cacheKey);
  if (cachedStatus !== undefined) return cachedStatus;

  const company = await Company.findById(companyId).select("_id status").lean();
  const status = company?.status || null;
  companyStatusCache.set(cacheKey, status);
  return status;
};

const resolveCompanyContext = async (user) => {
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

exports.protect = async (req, res, next) => {
  try {
    let token = "";

    if (
      req.headers.authorization
      && req.headers.authorization.startsWith("Bearer ")
    ) {
      token = req.headers.authorization.split(" ")[1].trim();
    }

    if (!token) {
      return res.status(401).json({ message: "Not authorized, no token" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password");

    if (!user || !user.isActive) {
      return res.status(401).json({
        message: "User not found or inactive",
      });
    }

    if (user.role === USER_ROLES.SUPER_ADMIN) {
      req.user = user;
      return next();
    }

    const companyId = user.companyId || (await resolveCompanyContext(user));
    if (!companyId) {
      return res.status(403).json({
        message: "Company context is missing for this account",
      });
    }

    const companyStatus = await getCachedCompanyStatus(companyId);
    if (companyStatus !== "ACTIVE") {
      return res.status(403).json({
        message: "Company is inactive. Access denied.",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      message: "Invalid or expired token",
    });
  }
};

exports.checkRole = (roles) => (req, res, next) => {
  const userRole = String(req.user?.role || "").trim().toUpperCase();
  const allowedRoles = roles.map((role) => String(role || "").trim().toUpperCase());

  if (userRole === USER_ROLES.SUPER_ADMIN) {
    return next();
  }

  if (!allowedRoles.includes(userRole)) {
    return res.status(403).json({ message: "Access denied" });
  }

  return next();
};
