const express = require("express");
const router = express.Router();

const expenseController = require("../controllers/coworkingExpense.controller");
const { requirePermission } = require("../middleware/permission.middleware");
const { writeLimiter } = require("../middleware/rateLimit.middleware");

router.get("/", requirePermission("expenses.view"), expenseController.listExpenses);
router.get("/:expenseId", requirePermission("expenses.view"), expenseController.getExpense);

router.post("/", writeLimiter, requirePermission("expenses.create"), expenseController.createExpense);
router.patch("/:expenseId", writeLimiter, requirePermission("expenses.update"), expenseController.updateExpense);
router.delete("/:expenseId", writeLimiter, requirePermission("expenses.delete"), expenseController.deleteExpense);

router.post("/:expenseId/approve", writeLimiter, requirePermission("expenses.approve"), expenseController.approveExpense);
router.post("/:expenseId/reject", writeLimiter, requirePermission("expenses.approve"), expenseController.rejectExpense);
router.post("/:expenseId/mark-paid", writeLimiter, requirePermission("expenses.approve"), expenseController.markPaid);

router.post("/:expenseId/receipts", writeLimiter, requirePermission("expenses.update"), expenseController.addReceipt);
router.delete("/:expenseId/receipts/:receiptId", writeLimiter, requirePermission("expenses.update"), expenseController.removeReceipt);

module.exports = router;
