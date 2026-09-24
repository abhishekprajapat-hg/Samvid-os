// Mirrors backend/src/constants/contract.constants.js and billing.constants.js.
export const CONTRACT_STATUSES = ["DRAFT", "ACTIVE", "EXPIRING", "EXPIRED", "TERMINATED"];
export const CONTRACT_TYPES = ["CABIN", "SEAT"];
export const CONTRACT_DOCUMENT_CATEGORIES = ["AGREEMENT", "ADDENDUM", "ID_PROOF", "OTHER"];

export const INVOICE_STATUSES = ["PENDING", "PARTIALLY_PAID", "PAID", "OVERDUE", "CANCELLED"];
export const DISCOUNT_TYPES = ["NONE", "PERCENTAGE", "FLAT"];
export const DEFAULT_GST_RATE = 18;

export const PAYMENT_METHODS = ["CASH", "UPI", "BANK_TRANSFER", "CARD", "CHEQUE", "OTHER"];
