const mongoose = require("mongoose");
const User = require("../models/User");
const generateToken = require("../utils/generateToken");

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const resolveCompanyContextForLogin = async (user) => {
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

exports.login = async (req, res) => {
  try {
    const { email, password, portal } = req.body;

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

    if (portal === "ADMIN" && user.role !== "ADMIN") {
      return res.status(403).json({
        message: "Access denied. Admin only.",
      });
    }

    if (portal === "GENERAL" && user.role === "ADMIN") {
      return res.status(403).json({
        message: "Admin must login via admin portal.",
      });
    }

    const companyId = user.companyId || (await resolveCompanyContextForLogin(user));
    if (!companyId) {
      return res.status(403).json({
        message: "Company context is missing for this account",
      });
    }

    const token = generateToken(user);

    return res.json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        companyId: user.companyId,
        parentId: user.parentId || null,
        partnerCode: user.partnerCode || null,
      },
    });
  } catch (error) {
    console.error("LOGIN ERROR:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.getMe = async (req, res) => {
  try {
    return res.json({
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        companyId: req.user.companyId || null,
        parentId: req.user.parentId || null,
        partnerCode: req.user.partnerCode || null,
      },
    });
  } catch (error) {
    console.error("GETME ERROR:", error);
    return res.status(500).json({ message: "Server error" });
  }
};
