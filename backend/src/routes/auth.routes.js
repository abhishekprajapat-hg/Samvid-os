const express = require("express");
const router = express.Router();

const authController = require("../controllers/auth.controller");
const { protect } = require("../middleware/auth.middleware");

// ================================
// 🔐 LOGIN
// ================================
router.post("/login", authController.login);

// ================================
// 👤 GET CURRENT USER
// ================================
router.get("/me", protect, authController.getMe);

// ================================
// 🔓 LOGOUT (optional future ready)
// ================================
router.post("/logout", protect, (req, res) => {
  res.json({ message: "Logout successful" });
});

module.exports = router;
