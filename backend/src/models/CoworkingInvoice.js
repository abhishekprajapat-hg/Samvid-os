const mongoose = require("mongoose");
const { INVOICE_STATUSES, DISCOUNT_TYPES } = require("../constants/billing.constants");

const lineItemSchema = new mongoose.Schema(
  {
    description: { type: String, trim: true, required: true, maxlength: 200 },
    quantity: { type: Number, required: true, min: 0.01 },
    unitPrice: { type: Number, required: true, min: 0 },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const additionalChargeSchema = new mongoose.Schema(
  {
    label: { type: String, trim: true, required: true, maxlength: 120 },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

// Every money field below (subtotal..totalAmount) is written exclusively by
// services/coworkingBilling.calc.js#computeInvoiceTotals — never accepted
// directly from a request body. amountPaid is written exclusively by
// services/coworkingInvoice.service.js#recalculateAmountPaid, which sums the
// CoworkingPayment ledger; it is never incremented ad hoc.
const coworkingInvoiceSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: "Company", index: true },
    invoiceNumber: { type: String, required: true, trim: true },
    clientId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: "CoworkingClient", index: true },
    contractId: { type: mongoose.Schema.Types.ObjectId, ref: "CoworkingContract", default: null, index: true },
    billingPeriodStart: { type: Date, default: null },
    billingPeriodEnd: { type: Date, default: null },
    lineItems: { type: [lineItemSchema], default: [] },
    additionalCharges: { type: [additionalChargeSchema], default: [] },
    discountType: { type: String, enum: DISCOUNT_TYPES, default: "NONE" },
    discountValue: { type: Number, default: 0, min: 0 },
    discountAmount: { type: Number, default: 0, min: 0 },
    subtotal: { type: Number, required: true, min: 0 },
    additionalChargesTotal: { type: Number, default: 0, min: 0 },
    gstRate: { type: Number, required: true, min: 0, max: 40 },
    gstAmount: { type: Number, required: true, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    amountPaid: { type: Number, default: 0, min: 0 },
    dueDate: { type: Date, required: true },
    status: { type: String, enum: INVOICE_STATUSES, default: "PENDING" },
    notes: { type: String, trim: true, default: "", maxlength: 2000 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

coworkingInvoiceSchema.index({ companyId: 1, invoiceNumber: 1 }, { unique: true });
coworkingInvoiceSchema.index({ companyId: 1, status: 1, dueDate: 1 });
coworkingInvoiceSchema.index({ companyId: 1, clientId: 1, status: 1 });
coworkingInvoiceSchema.index({ companyId: 1, contractId: 1 });

module.exports = mongoose.model("CoworkingInvoice", coworkingInvoiceSchema);
