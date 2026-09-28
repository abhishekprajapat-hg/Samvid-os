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

/*
 * Widened beyond coworking.
 *
 * These three collections - invoice, payment, expense - were written for
 * coworking clients, contracts and properties, and they are the only complete
 * money ledger in the product. The mobile Finance comps need the same ledger
 * for CRM money too: rent invoiced to a lead, brokerage paid out, marketing
 * spend against an inventory asset. Rather than stand up a second invoicing
 * system beside this one, the coworking links became optional and the CRM ones
 * were added next to them.
 *
 * Nothing existing changes shape: a coworking row still sets clientId /
 * propertyId exactly as before, and every coworking query keeps working.
 */
const coworkingInvoiceSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: "Company", index: true },
    invoiceNumber: { type: String, required: true, trim: true },
    // Exactly one of clientId / leadId / contactId identifies who is billed.
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: "CoworkingClient", default: null, index: true },
    leadId: { type: mongoose.Schema.Types.ObjectId, ref: "Lead", default: null, index: true },
    contactId: { type: mongoose.Schema.Types.ObjectId, ref: "CrmContact", default: null, index: true },
    // The place it is for: a coworking property, or an inventory asset.
    inventoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Inventory", default: null, index: true },
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
