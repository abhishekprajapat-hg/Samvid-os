const express = require("express");
const router = express.Router();

const authController = require("../controllers/auth.controller");
const { protect } = require("../middleware/auth.middleware");
const { authLimiter } = require("../middleware/rateLimit.middleware");

// ================================
// 🔐 LOGIN
// ================================
router.post("/login", authLimiter, authController.login);
router.post("/refresh", authLimiter, authController.refresh);

// ================================
// 👤 GET CURRENT USER
// ================================
router.get("/me", protect, authController.getMe);

// ================================
// 🔓 LOGOUT (optional future ready)
// ================================
router.post("/logout", protect, authController.logout);

module.exports = router;
