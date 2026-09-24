const jwt = require("jsonwebtoken");

// Deliberately carries scope: "client-portal" so this token can never be
// accepted by the staff-facing protect() middleware (auth.middleware.js
// explicitly rejects any token bearing this claim), and so
// protectClientPortal can reject a staff token that lacks it. Same
// JWT_SECRET as staff tokens (no new env var to manage) — the scope claim
// is what keeps the two audiences apart, not a different signing key.
const generateClientPortalToken = (portalUser) => {
  const expiresIn = process.env.PORTAL_ACCESS_TOKEN_TTL || process.env.ACCESS_TOKEN_TTL || "15m";

  return jwt.sign(
    {
      id: portalUser._id,
      clientId: portalUser.clientId,
      companyId: portalUser.companyId,
      scope: "client-portal",
    },
    process.env.JWT_SECRET,
    { expiresIn },
  );
};

module.exports = generateClientPortalToken;
