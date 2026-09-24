const { createHttpError } = require("../utils/httpError");

// ============================================================================
// Pure financial calculation engine. Nothing in this file touches the
// database. Every invoice-money-related field (subtotal, discountAmount,
// gstAmount, totalAmount, status) is ALWAYS derived here from raw inputs —
// controllers/services must never accept a client-supplied total and persist
// it directly. This module is the one place those formulas live.
// ============================================================================

// Avoids floating-point drift on money (e.g. 0.1 + 0.2 !== 0.3) by rounding
// through integer cents.
const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const sanitizeLineItems = (lineItems) => {
  if (!Array.isArray(lineItems) || lineItems.length === 0) {
    throw createHttpError(400, "At least one line item is required");
  }

  return lineItems.map((item, index) => {
    const description = String(item?.description || "").trim();
    const quantity = Number(item?.quantity);
    const unitPrice = Number(item?.unitPrice);

    if (!description) throw createHttpError(400, `Line item ${index + 1}: description is required`);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw createHttpError(400, `Line item ${index + 1}: quantity must be greater than 0`);
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      throw createHttpError(400, `Line item ${index + 1}: unitPrice cannot be negative`);
    }

    return {
      description: description.slice(0, 200),
      quantity: round2(quantity),
      unitPrice: round2(unitPrice),
      amount: round2(quantity * unitPrice),
    };
  });
};

const sanitizeAdditionalCharges = (additionalCharges) => {
  if (!Array.isArray(additionalCharges)) return [];

  return additionalCharges.map((charge, index) => {
    const label = String(charge?.label || "").trim();
    const amount = Number(charge?.amount);
    if (!label) throw createHttpError(400, `Additional charge ${index + 1}: label is required`);
    if (!Number.isFinite(amount) || amount < 0) {
      throw createHttpError(400, `Additional charge ${index + 1}: amount cannot be negative`);
    }
    return { label: label.slice(0, 120), amount: round2(amount) };
  });
};

// Computes every derived money field for an invoice from raw, client-editable
// inputs (line items, discount, additional charges, GST rate). Returns a
// fully self-consistent set of numbers — callers persist exactly this
// output, never anything the client sent directly for subtotal/total.
const computeInvoiceTotals = ({ lineItems, discountType = "NONE", discountValue = 0, additionalCharges = [], gstRate }) => {
  const safeLineItems = sanitizeLineItems(lineItems);
  const safeAdditionalCharges = sanitizeAdditionalCharges(additionalCharges);

  const subtotal = round2(safeLineItems.reduce((sum, item) => sum + item.amount, 0));

  const normalizedDiscountType = ["NONE", "PERCENTAGE", "FLAT"].includes(discountType) ? discountType : "NONE";
  const rawDiscountValue = Number(discountValue) || 0;
  if (rawDiscountValue < 0) throw createHttpError(400, "discountValue cannot be negative");
  if (normalizedDiscountType === "PERCENTAGE" && rawDiscountValue > 100) {
    throw createHttpError(400, "Percentage discount cannot exceed 100");
  }

  let discountAmount = 0;
  if (normalizedDiscountType === "PERCENTAGE") {
    discountAmount = round2(subtotal * (rawDiscountValue / 100));
  } else if (normalizedDiscountType === "FLAT") {
    // A flat discount can never exceed the subtotal it's discounting.
    discountAmount = round2(Math.min(rawDiscountValue, subtotal));
  }

  const additionalChargesTotal = round2(safeAdditionalCharges.reduce((sum, charge) => sum + charge.amount, 0));

  const taxableAmount = round2(Math.max(0, subtotal - discountAmount + additionalChargesTotal));

  const safeGstRate = Number(gstRate);
  if (!Number.isFinite(safeGstRate) || safeGstRate < 0 || safeGstRate > 40) {
    throw createHttpError(400, "gstRate must be between 0 and 40");
  }
  const gstAmount = round2(taxableAmount * (safeGstRate / 100));

  const totalAmount = round2(taxableAmount + gstAmount);

  return {
    lineItems: safeLineItems,
    additionalCharges: safeAdditionalCharges,
    subtotal,
    discountType: normalizedDiscountType,
    discountValue: round2(rawDiscountValue),
    discountAmount,
    additionalChargesTotal,
    gstRate: safeGstRate,
    gstAmount,
    totalAmount,
  };
};

// The one place invoice.status is decided. CANCELLED is the sole
// manually-set terminal status; everything else is always recomputed from
// amountPaid vs totalAmount vs dueDate — never toggled directly.
const deriveInvoiceStatus = ({ totalAmount, amountPaid, dueDate, currentStatus, now = new Date() }) => {
  if (currentStatus === "CANCELLED") return "CANCELLED";

  const balanceDue = round2(totalAmount - amountPaid);
  if (balanceDue <= 0) return "PAID";
  if (dueDate && new Date(dueDate) < now) return "OVERDUE";
  if (amountPaid > 0) return "PARTIALLY_PAID";
  return "PENDING";
};

module.exports = { round2, sanitizeLineItems, sanitizeAdditionalCharges, computeInvoiceTotals, deriveInvoiceStatus };
