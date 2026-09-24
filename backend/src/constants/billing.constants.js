// INVOICE_STATUSES are always derived server-side (see
// services/coworkingBilling.calc.js#deriveInvoiceStatus) from amountPaid vs
// totalAmount vs dueDate — CANCELLED is the one manual/terminal exception.
const INVOICE_STATUSES = Object.freeze(["PENDING", "PARTIALLY_PAID", "PAID", "OVERDUE", "CANCELLED"]);

const DISCOUNT_TYPES = Object.freeze(["NONE", "PERCENTAGE", "FLAT"]);

const DEFAULT_GST_RATE = 18;
const MAX_GST_RATE = 40;

const PAYMENT_METHODS = Object.freeze(["CASH", "UPI", "BANK_TRANSFER", "CARD", "CHEQUE", "OTHER"]);

// A payment ledger entry is either a PAYMENT (adds to amountPaid) or a
// REFUND (subtracts) — refunds are new entries, never mutations of the
// original payment, so the ledger stays a fully auditable history.
const PAYMENT_TRANSACTION_TYPES = Object.freeze(["PAYMENT", "REFUND"]);
const PAYMENT_STATUSES = Object.freeze(["COMPLETED", "CANCELLED"]);

module.exports = {
  INVOICE_STATUSES,
  DISCOUNT_TYPES,
  DEFAULT_GST_RATE,
  MAX_GST_RATE,
  PAYMENT_METHODS,
  PAYMENT_TRANSACTION_TYPES,
  PAYMENT_STATUSES,
};
