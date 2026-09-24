const express = require("express");
const router = express.Router();

const invoiceController = require("../controllers/coworkingInvoice.controller");
const { requirePermission } = require("../middleware/permission.middleware");
const { writeLimiter } = require("../middleware/rateLimit.middleware");

router.get("/", requirePermission("billing.view"), invoiceController.listInvoices);
router.get("/:invoiceId", requirePermission("billing.view"), invoiceController.getInvoice);

router.post("/", writeLimiter, requirePermission("billing.create"), invoiceController.createInvoice);
router.post("/generate-for-contract", writeLimiter, requirePermission("billing.create"), invoiceController.generateForContract);
router.patch("/:invoiceId", writeLimiter, requirePermission("billing.update"), invoiceController.updateInvoice);
router.post("/:invoiceId/cancel", writeLimiter, requirePermission("billing.update"), invoiceController.cancelInvoice);

module.exports = router;
