const jwt = require("jsonwebtoken");

const generateToken = (user) => {
  const expiresIn = process.env.ACCESS_TOKEN_TTL || "15m";

  return jwt.sign(
    {
      id: user._id,
      role: user.role,
      companyId: user.companyId || null,
    },
    process.env.JWT_SECRET,
    {
      expiresIn,
    },
  );
};

module.exports = generateToken;
