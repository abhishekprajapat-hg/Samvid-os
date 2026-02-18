const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const User = require("../models/User");

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const resolveCompanyContext = async (user) => {
  if (user.companyId) return user.companyId;

  if (user.role === "ADMIN") {
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

    if (!parent.companyId && parent.role === "ADMIN") {
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

    const companyId = user.companyId || (await resolveCompanyContext(user));
    if (!companyId) {
      return res.status(403).json({
        message: "Company context is missing for this account",
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
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ message: "Access denied" });
  }
  return next();
};
