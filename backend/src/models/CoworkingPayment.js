const mongoose = require("mongoose");
const { PAYMENT_METHODS, PAYMENT_TRANSACTION_TYPES, PAYMENT_STATUSES } = require("../constants/billing.constants");

// A ledger entry against an invoice — either a PAYMENT or a REFUND. Refunds
// are new entries (refundOf points at the original PAYMENT), never
// mutations of history — see coworkingBilling.calc.js and
// coworkingPayment.service.js for how the ledger rolls up into
// invoice.amountPaid.
const coworkingPaymentSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: "Company", index: true },
    paymentCode: { type: String, required: true, trim: true },
    invoiceId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: "CoworkingInvoice", index: true },
    clientId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: "CoworkingClient", index: true },
    type: { type: String, enum: PAYMENT_TRANSACTION_TYPES, default: "PAYMENT" },
    amount: { type: Number, required: true, min: 0.01 },
    method: { type: String, enum: PAYMENT_METHODS, required: true },
    transactionReference: { type: String, trim: true, default: "" },
    paymentDate: { type: Date, required: true, default: Date.now },
    status: { type: String, enum: PAYMENT_STATUSES, default: "COMPLETED" },
    refundOf: { type: mongoose.Schema.Types.ObjectId, ref: "CoworkingPayment", default: null },
    notes: { type: String, trim: true, default: "", maxlength: 500 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

coworkingPaymentSchema.index({ companyId: 1, paymentCode: 1 }, { unique: true });
coworkingPaymentSchema.index({ companyId: 1, invoiceId: 1, status: 1 });
coworkingPaymentSchema.index({ companyId: 1, clientId: 1, paymentDate: -1 });

coworkingPaymentSchema.pre("validate", function enforcePaymentInvariants() {
  const requiresReference = ["UPI", "BANK_TRANSFER", "CARD", "CHEQUE"];
  if (requiresReference.includes(this.method) && !String(this.transactionReference || "").trim()) {
    this.invalidate("transactionReference", `transactionReference is required for ${this.method} payments`);
  }
  if (this.type === "REFUND" && !this.refundOf) {
    this.invalidate("refundOf", "refundOf is required for a REFUND entry");
  }
});

module.exports = mongoose.model("CoworkingPayment", coworkingPaymentSchema);
