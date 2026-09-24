const mongoose = require("mongoose");
const {
  EXPENSE_CATEGORIES,
  EXPENSE_STATUSES,
  PAYMENT_METHODS,
  RECEIPT_CATEGORIES,
} = require("../constants/expense.constants");

const receiptSchema = new mongoose.Schema({
  name: { type: String, trim: true, required: true, maxlength: 200 },
  category: { type: String, enum: RECEIPT_CATEGORIES, default: "RECEIPT" },
  fileUrl: { type: String, trim: true, required: true },
  fileType: { type: String, trim: true, default: "" },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  uploadedAt: { type: Date, default: Date.now },
});

const coworkingExpenseSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: "Company", index: true },
    expenseCode: { type: String, required: true, trim: true },
    propertyId: { type: mongoose.Schema.Types.ObjectId, ref: "CoworkingProperty", default: null },
    category: { type: String, enum: EXPENSE_CATEGORIES, required: true },
    description: { type: String, trim: true, required: true, maxlength: 500 },
    amount: { type: Number, required: true, min: 0.01 },
    expenseDate: { type: Date, required: true },
    paymentMethod: { type: String, enum: PAYMENT_METHODS, required: true },
    vendor: { type: String, trim: true, default: "", maxlength: 200 },
    notes: { type: String, trim: true, default: "", maxlength: 2000 },
    status: { type: String, enum: EXPENSE_STATUSES, default: "PENDING" },
    receipts: { type: [receiptSchema], default: [] },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    approvedAt: { type: Date, default: null },
    rejectedReason: { type: String, trim: true, default: "", maxlength: 500 },
    paidAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

coworkingExpenseSchema.index({ companyId: 1, expenseCode: 1 }, { unique: true });
coworkingExpenseSchema.index({ companyId: 1, status: 1, expenseDate: -1 });
coworkingExpenseSchema.index({ companyId: 1, propertyId: 1, expenseDate: -1 });
coworkingExpenseSchema.index({ companyId: 1, category: 1 });

module.exports = mongoose.model("CoworkingExpense", coworkingExpenseSchema);
