const express = require("express");
const router = express.Router();

const paymentController = require("../controllers/coworkingPayment.controller");
const { requirePermission } = require("../middleware/permission.middleware");
const { writeLimiter } = require("../middleware/rateLimit.middleware");

router.get("/", requirePermission("payments.view"), paymentController.listPayments);
router.post("/", writeLimiter, requirePermission("payments.create"), paymentController.recordPayment);
router.post("/:paymentId/refund", writeLimiter, requirePermission("payments.refund"), paymentController.refundPayment);

module.exports = router;
