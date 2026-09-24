const mongoose = require("mongoose");
const CoworkingPayment = require("../models/CoworkingPayment");
const CoworkingInvoice = require("../models/CoworkingInvoice");
const CoworkingIdCounter = require("../models/CoworkingIdCounter");
const { PAYMENT_METHODS } = require("../constants/billing.constants");
const { round2 } = require("./coworkingBilling.calc");
const { recalculateAmountPaid } = require("./coworkingInvoice.service");
const { createHttpError } = require("../utils/httpError");
const { parsePagination, buildPaginationMeta } = require("../utils/queryOptions");
const { writeAuditLog } = require("./auditLog.service");

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const generatePaymentCode = async (companyId) => {
  const counter = await CoworkingIdCounter.findOneAndUpdate(
    { companyId, category: "PAYMENT" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  );
  return `PAY-${String(counter.seq).padStart(5, "0")}`;
};

const sanitizeMethodAndReference = (method, transactionReference) => {
  const safeMethod = String(method || "").trim().toUpperCase();
  if (!PAYMENT_METHODS.includes(safeMethod)) throw createHttpError(400, "Invalid payment method");

  const reference = String(transactionReference || "").trim();
  if (safeMethod !== "CASH" && !reference) {
    throw createHttpError(400, `transactionReference is required for ${safeMethod} payments`);
  }
  return { method: safeMethod, transactionReference: reference };
};

// The core "do not trust client-side totals" guard for payments: the amount
// recorded can never exceed what the invoice actually owes right now,
// computed server-side from the invoice's own authoritative totals.
const recordPayment = async ({ companyId, actingUser, payload }) => {
  const invoiceId = String(payload.invoiceId || "").trim();
  if (!isValidObjectId(invoiceId)) throw createHttpError(400, "Invalid invoiceId");

  const invoice = await CoworkingInvoice.findOne({ _id: invoiceId, companyId }).lean();
  if (!invoice) throw createHttpError(404, "Invoice not found");
  if (["CANCELLED", "PAID"].includes(invoice.status)) {
    throw createHttpError(409, `Cannot record a payment against a ${invoice.status} invoice`);
  }

  const amount = round2(Number(payload.amount));
  if (!Number.isFinite(amount) || amount <= 0) throw createHttpError(400, "amount must be greater than 0");

  const balanceDue = round2(invoice.totalAmount - invoice.amountPaid);
  if (amount > balanceDue) {
    throw createHttpError(400, `amount (${amount}) exceeds the outstanding balance (${balanceDue})`);
  }

  const { method, transactionReference } = sanitizeMethodAndReference(payload.method, payload.transactionReference);
  const paymentDate = payload.paymentDate ? new Date(payload.paymentDate) : new Date();
  if (Number.isNaN(paymentDate.getTime())) throw createHttpError(400, "paymentDate is not a valid date");

  const paymentCode = await generatePaymentCode(companyId);
  const payment = await CoworkingPayment.create({
    companyId,
    paymentCode,
    invoiceId,
    clientId: invoice.clientId,
    type: "PAYMENT",
    amount,
    method,
    transactionReference,
    paymentDate,
    notes: String(payload.notes || "").trim().slice(0, 500),
    createdBy: actingUser._id,
  });

  await recalculateAmountPaid(companyId, invoiceId);

  await writeAuditLog({
    companyId,
    actor: actingUser,
    action: "PAYMENT_RECORDED",
    entityType: "CoworkingPayment",
    entityId: payment._id,
    metadata: { paymentCode, invoiceId, amount, method },
  });

  return payment;
};

// A payment can be refunded multiple times (partial refunds) as long as the
// running total of refunds never exceeds the original payment amount —
// computed fresh from the ledger each time, never trusted from a stored
// "amount remaining" field.
const refundPayment = async ({ companyId, actingUser, paymentId, payload }) => {
  if (!isValidObjectId(paymentId)) throw createHttpError(400, "Invalid payment id");

  const original = await CoworkingPayment.findOne({ companyId, _id: paymentId, type: "PAYMENT", status: "COMPLETED" }).lean();
  if (!original) throw createHttpError(404, "Payment not found or not refundable");

  const priorRefunds = await CoworkingPayment.find({ companyId, refundOf: paymentId, type: "REFUND", status: "COMPLETED" }).lean();
  const alreadyRefunded = round2(priorRefunds.reduce((sum, entry) => sum + entry.amount, 0));
  const refundableAmount = round2(original.amount - alreadyRefunded);

  const amount = round2(Number(payload.amount));
  if (!Number.isFinite(amount) || amount <= 0) throw createHttpError(400, "amount must be greater than 0");
  if (amount > refundableAmount) {
    throw createHttpError(400, `amount (${amount}) exceeds the refundable balance (${refundableAmount})`);
  }

  const { method, transactionReference } = sanitizeMethodAndReference(
    payload.method || original.method,
    payload.transactionReference,
  );

  const paymentCode = await generatePaymentCode(companyId);
  const refund = await CoworkingPayment.create({
    companyId,
    paymentCode,
    invoiceId: original.invoiceId,
    clientId: original.clientId,
    type: "REFUND",
    amount,
    method,
    transactionReference,
    paymentDate: new Date(),
    refundOf: original._id,
    notes: String(payload.reason || payload.notes || "").trim().slice(0, 500),
    createdBy: actingUser._id,
  });

  await recalculateAmountPaid(companyId, original.invoiceId);

  await writeAuditLog({
    companyId,
    actor: actingUser,
    action: "PAYMENT_REFUNDED",
    entityType: "CoworkingPayment",
    entityId: refund._id,
    metadata: { paymentCode, refundOf: String(paymentId), amount },
  });

  return refund;
};

const listPayments = async ({ companyId, query = {} }) => {
  const { page, limit, skip } = parsePagination(query, { defaultLimit: 25, maxLimit: 100 });
  const filter = { companyId };

  if (query.invoiceId) filter.invoiceId = query.invoiceId;
  if (query.clientId) filter.clientId = query.clientId;
  if (query.type) filter.type = String(query.type).trim().toUpperCase();

  const [rows, totalCount] = await Promise.all([
    CoworkingPayment.find(filter)
      .populate("clientId", "companyName")
      .populate("invoiceId", "invoiceNumber totalAmount")
      .sort({ paymentDate: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    CoworkingPayment.countDocuments(filter),
  ]);

  return { payments: rows, pagination: buildPaginationMeta({ page, limit, totalCount }) };
};

module.exports = { recordPayment, refundPayment, listPayments };
