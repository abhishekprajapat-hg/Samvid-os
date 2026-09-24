const express = require("express");
const router = express.Router();

const clientPortalAuthController = require("../controllers/clientPortalAuth.controller");
const { protectClientPortal } = require("../middleware/clientPortalAuth.middleware");
const { authLimiter } = require("../middleware/rateLimit.middleware");

router.post("/login", authLimiter, clientPortalAuthController.login);
router.post("/refresh", authLimiter, clientPortalAuthController.refresh);
router.get("/me", protectClientPortal, clientPortalAuthController.getMe);
router.post("/logout", protectClientPortal, clientPortalAuthController.logout);

module.exports = router;
