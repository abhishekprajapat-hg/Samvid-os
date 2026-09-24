const jwt = require("jsonwebtoken");
const ClientPortalUser = require("../models/ClientPortalUser");
const Company = require("../models/Company");

// Mirrors auth.middleware.js#protect, but for the client portal's own JWT
// audience. Explicitly requires scope === "client-portal" so a staff access
// token can never be replayed against portal routes, and vice versa (see
// auth.middleware.js's matching rejection of portal-scoped tokens).
exports.protectClientPortal = async (req, res, next) => {
  try {
    let token = "";
    if (req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1].trim();
    }
    if (!token) {
      return res.status(401).json({ message: "Not authorized, no token" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.scope !== "client-portal") {
      return res.status(401).json({ message: "Invalid token for this portal" });
    }

    const portalUser = await ClientPortalUser.findById(decoded.id);
    if (!portalUser || !portalUser.isActive) {
      return res.status(401).json({ message: "Account not found or inactive" });
    }

    const company = await Company.findById(portalUser.companyId).select("_id status").lean();
    if (!company || company.status !== "ACTIVE") {
      return res.status(403).json({ message: "This workspace is currently inactive" });
    }

    req.portalUser = portalUser;
    req.companyId = String(portalUser.companyId);
    req.clientId = String(portalUser.clientId);
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};
