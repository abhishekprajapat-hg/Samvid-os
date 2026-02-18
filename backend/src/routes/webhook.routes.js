const express = require("express");
const router = express.Router();

const webhookController = require("../controllers/webhook.controller");

// 🔹 Verification
router.get("/meta", webhookController.verifyWebhook);

// 🔹 Lead Event
router.post("/meta", webhookController.handleWebhook);

module.exports = router;
