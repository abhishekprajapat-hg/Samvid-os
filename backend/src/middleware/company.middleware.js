const mongoose = require("mongoose");
const { USER_ROLES } = require("../constants/role.constants");

const toObjectIdString = (value) => String(value || "");
const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

exports.requireCompanyContext = (req, res, next) => {
  if (req.user?.role === USER_ROLES.SUPER_ADMIN) {
    req.companyId = null;
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
  if (req.user?.role === USER_ROLES.SUPER_ADMIN) {
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
