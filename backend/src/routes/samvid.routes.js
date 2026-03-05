const express = require("express");

const router = express.Router();
const samvidController = require("../controllers/samvid.controller");
const authMiddleware = require("../middleware/auth.middleware");
const { chatMessageLimiter } = require("../middleware/rateLimit.middleware");

router.use(authMiddleware.protect);

router.post("/ask", chatMessageLimiter, samvidController.askSamvid);

module.exports = router;
