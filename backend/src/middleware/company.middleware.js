const mongoose = require("mongoose");
const toObjectIdString = (value) => String(value || "");
const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);
const isSuperAdmin = (user) => String(user?.role || "").trim().toUpperCase() === "SUPER_ADMIN";

exports.requireCompanyContext = (req, res, next) => {
  if (isSuperAdmin(req.user)) {
    req.companyId = "";
    return next();
  }

  if (!req.user?.companyId || !isValidObjectId(req.user.companyId)) {
    return res.status(403).json({
      message: "Company context is required",
    });
  }

  req.companyId = toObjectIdString(req.user.companyId);
  return next();
};

exports.enforceBodyCompanyMatch = (field = "companyId") => (req, res, next) => {
  if (isSuperAdmin(req.user)) {
    return next();
  }

  const payloadCompanyId = req.body?.[field];
  if (!payloadCompanyId) {
    return next();
  }

  if (toObjectIdString(payloadCompanyId) !== toObjectIdString(req.user?.companyId)) {
    return res.status(403).json({
      message: "Cross-company access denied",
    });
  }

  return next();
};
