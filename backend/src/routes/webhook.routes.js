const express = require("express");

const router = express.Router();
const webhookController = require("../controllers/webhook.controller");
const { webhookLimiter } = require("../middleware/rateLimit.middleware");

router.get("/meta", webhookController.verifyWebhook);
router.post("/meta", webhookLimiter, webhookController.handleWebhook);

module.exports = router;
