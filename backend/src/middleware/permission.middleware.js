const { hasPermission } = require("../services/permission.service");

// Composes with authMiddleware.protect + companyMiddleware.requireCompanyContext,
// which must run first so req.user/req.user.companyId are populated.
exports.requirePermission = (permission) => async (req, res, next) => {
  try {
    const allowed = await hasPermission(req.user, permission);
    if (!allowed) {
      return res.status(403).json({
        message: "You do not have permission to perform this action",
        permission,
      });
    }
    return next();
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.statusCode ? error.message : "Server error",
    });
  }
};
