const EXPENSE_CATEGORIES = Object.freeze([
  "RENT",
  "UTILITIES",
  "MAINTENANCE",
  "SALARY",
  "MARKETING",
  "SUPPLIES",
  "REPAIRS",
  "OTHER",
]);

// PENDING -> APPROVED -> PAID, or PENDING -> REJECTED. Terminal states
// (PAID/REJECTED) cannot be edited or deleted — reissue instead.
const EXPENSE_STATUSES = Object.freeze(["PENDING", "APPROVED", "REJECTED", "PAID"]);

const PAYMENT_METHODS = Object.freeze(["CASH", "UPI", "BANK_TRANSFER", "CARD", "CHEQUE", "OTHER"]);

const RECEIPT_CATEGORIES = Object.freeze(["RECEIPT", "INVOICE", "OTHER"]);

const EXPENSE_ALLOWED_CREATE_FIELDS = Object.freeze([
  "propertyId",
  "category",
  "description",
  "amount",
  "expenseDate",
  "paymentMethod",
  "vendor",
  "notes",
]);

const EXPENSE_ALLOWED_UPDATE_FIELDS = Object.freeze([
  "category",
  "description",
  "amount",
  "expenseDate",
  "paymentMethod",
  "vendor",
  "notes",
]);

module.exports = {
  EXPENSE_CATEGORIES,
  EXPENSE_STATUSES,
  PAYMENT_METHODS,
  RECEIPT_CATEGORIES,
  EXPENSE_ALLOWED_CREATE_FIELDS,
  EXPENSE_ALLOWED_UPDATE_FIELDS,
};
