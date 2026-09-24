const mongoose = require("mongoose");
const CoworkingInvoice = require("../models/CoworkingInvoice");
const CoworkingPayment = require("../models/CoworkingPayment");
const CoworkingClient = require("../models/CoworkingClient");
const CoworkingContract = require("../models/CoworkingContract");
const CoworkingIdCounter = require("../models/CoworkingIdCounter");
const { INVOICE_STATUSES, DEFAULT_GST_RATE } = require("../constants/billing.constants");
const { computeInvoiceTotals, deriveInvoiceStatus, round2 } = require("./coworkingBilling.calc");
const { createHttpError } = require("../utils/httpError");
const { parsePagination, buildPaginationMeta } = require("../utils/queryOptions");
const { writeAuditLog } = require("./auditLog.service");

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const generateInvoiceNumber = async (companyId) => {
  const counter = await CoworkingIdCounter.findOneAndUpdate(
    { companyId, category: "INVOICE" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  );
  const year = new Date().getFullYear();
  return `INV-${year}-${String(counter.seq).padStart(5, "0")}`;
};

const parseDate = (value, fieldName) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw createHttpError(400, `${fieldName} is not a valid date`);
  return date;
};

const buildInvoiceFromPayload = async (companyId, payload = {}) => {
  const clientId = String(payload.clientId || "").trim();
  if (!isValidObjectId(clientId)) throw createHttpError(400, "Invalid clientId");
  const client = await CoworkingClient.findOne({ _id: clientId, companyId }).select("_id").lean();
  if (!client) throw createHttpError(400, "Client not found for this company");

  let contractId = null;
  if (payload.contractId) {
    if (!isValidObjectId(payload.contractId)) throw createHttpError(400, "Invalid contractId");
    const contract = await CoworkingContract.findOne({ _id: payload.contractId, companyId }).select("_id").lean();
    if (!contract) throw createHttpError(400, "Contract not found for this company");
    contractId = payload.contractId;
  }

  // computeInvoiceTotals is the single authority for every money field —
  // whatever the client sent for subtotal/gstAmount/totalAmount (if
  // anything) is discarded here in favor of the recomputed values.
  const totals = computeInvoiceTotals({
    lineItems: payload.lineItems,
    discountType: payload.discountType,
    discountValue: payload.discountValue,
    additionalCharges: payload.additionalCharges,
    gstRate: payload.gstRate === undefined ? DEFAULT_GST_RATE : payload.gstRate,
  });

  const dueDate = parseDate(payload.dueDate, "dueDate");

  return {
    clientId,
    contractId,
    billingPeriodStart: payload.billingPeriodStart ? parseDate(payload.billingPeriodStart, "billingPeriodStart") : null,
    billingPeriodEnd: payload.billingPeriodEnd ? parseDate(payload.billingPeriodEnd, "billingPeriodEnd") : null,
    dueDate,
    notes: String(payload.notes || "").trim().slice(0, 2000),
    ...totals,
  };
};

const createInvoice = async ({ companyId, actingUser, payload }) => {
  const built = await buildInvoiceFromPayload(companyId, payload);
  const invoiceNumber = await generateInvoiceNumber(companyId);

  const invoice = await CoworkingInvoice.create({
    ...built,
    companyId,
    invoiceNumber,
    amountPaid: 0,
    status: deriveInvoiceStatus({ totalAmount: built.totalAmount, amountPaid: 0, dueDate: built.dueDate, currentStatus: null }),
    createdBy: actingUser._id,
  });

  await writeAuditLog({
    companyId,
    actor: actingUser,
    action: "INVOICE_CREATED",
    entityType: "CoworkingInvoice",
    entityId: invoice._id,
    metadata: { invoiceNumber, totalAmount: built.totalAmount },
  });

  return invoice;
};

// The recurring-rent entry point: one line item for the contract's rent
// over the given billing period. Call this once per billing cycle (e.g.
// monthly) — see docs/TESTING_FLOW.md for the manual cadence this phase
// ships with; true cron-driven auto-generation is a follow-up.
const generateInvoiceForContract = async ({ companyId, actingUser, contractId, billingPeriodStart, billingPeriodEnd, dueDate, gstRate }) => {
  if (!isValidObjectId(contractId)) throw createHttpError(400, "Invalid contractId");
  const contract = await CoworkingContract.findOne({ _id: contractId, companyId }).lean();
  if (!contract) throw createHttpError(404, "Contract not found");
  if (!["ACTIVE", "EXPIRING"].includes(contract.status)) {
    throw createHttpError(409, "Invoices can only be generated for an ACTIVE or EXPIRING contract");
  }

  const periodStart = parseDate(billingPeriodStart, "billingPeriodStart");
  const periodEnd = parseDate(billingPeriodEnd, "billingPeriodEnd");
  if (periodEnd <= periodStart) throw createHttpError(400, "billingPeriodEnd must be after billingPeriodStart");

  return createInvoice({
    companyId,
    actingUser,
    payload: {
      clientId: contract.clientId,
      contractId: contract._id,
      billingPeriodStart: periodStart,
      billingPeriodEnd: periodEnd,
      dueDate,
      gstRate,
      lineItems: [
        {
          description: `Rent — ${contract.contractCode} (${periodStart.toDateString()} to ${periodEnd.toDateString()})`,
          quantity: 1,
          unitPrice: contract.rent,
        },
      ],
    },
  });
};

const listInvoices = async ({ companyId, query = {} }) => {
  const { page, limit, skip } = parsePagination(query, { defaultLimit: 20, maxLimit: 100 });
  const filter = { companyId };

  if (query.status) {
    const status = String(query.status).trim().toUpperCase();
    if (!INVOICE_STATUSES.includes(status)) throw createHttpError(400, "Invalid status filter");
    filter.status = status;
  }
  if (query.clientId) filter.clientId = query.clientId;
  if (query.contractId) filter.contractId = query.contractId;

  const [rows, totalCount] = await Promise.all([
    CoworkingInvoice.find(filter)
      .populate("clientId", "companyName")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    CoworkingInvoice.countDocuments(filter),
  ]);

  return { invoices: rows, pagination: buildPaginationMeta({ page, limit, totalCount }) };
};

const getInvoiceDoc = async (companyId, invoiceId) => {
  if (!isValidObjectId(invoiceId)) throw createHttpError(400, "Invalid invoice id");
  const invoice = await CoworkingInvoice.findOne({ _id: invoiceId, companyId });
  if (!invoice) throw createHttpError(404, "Invoice not found");
  return invoice;
};

const getInvoiceById = async ({ companyId, invoiceId }) => {
  if (!isValidObjectId(invoiceId)) throw createHttpError(400, "Invalid invoice id");
  const invoice = await CoworkingInvoice.findOne({ _id: invoiceId, companyId })
    .populate("clientId", "companyName contactPerson email phone")
    .populate("contractId", "contractCode")
    .lean();
  if (!invoice) throw createHttpError(404, "Invoice not found");

  const payments = await CoworkingPayment.find({ companyId, invoiceId }).sort({ paymentDate: -1 }).lean();
  return { ...invoice, payments };
};

// Editing a bill after money has moved against it would make the ledger
// lie — only PENDING/OVERDUE invoices with zero payments recorded can be
// edited; everything else must be cancelled and reissued.
const updateInvoice = async ({ companyId, invoiceId, payload, actingUser }) => {
  const invoice = await getInvoiceDoc(companyId, invoiceId);
  if (invoice.amountPaid > 0) {
    throw createHttpError(409, "Cannot edit an invoice that already has payments recorded");
  }
  if (!["PENDING", "OVERDUE"].includes(invoice.status)) {
    throw createHttpError(409, `Cannot edit an invoice in ${invoice.status} status`);
  }

  const totals = computeInvoiceTotals({
    lineItems: payload.lineItems !== undefined ? payload.lineItems : invoice.lineItems,
    discountType: payload.discountType !== undefined ? payload.discountType : invoice.discountType,
    discountValue: payload.discountValue !== undefined ? payload.discountValue : invoice.discountValue,
    additionalCharges: payload.additionalCharges !== undefined ? payload.additionalCharges : invoice.additionalCharges,
    gstRate: payload.gstRate !== undefined ? payload.gstRate : invoice.gstRate,
  });

  Object.assign(invoice, totals);
  if (payload.dueDate !== undefined) invoice.dueDate = parseDate(payload.dueDate, "dueDate");
  if (payload.notes !== undefined) invoice.notes = String(payload.notes).trim().slice(0, 2000);
  invoice.status = deriveInvoiceStatus({
    totalAmount: invoice.totalAmount,
    amountPaid: invoice.amountPaid,
    dueDate: invoice.dueDate,
    currentStatus: invoice.status,
  });
  invoice.updatedBy = actingUser._id;
  await invoice.save();

  await writeAuditLog({
    companyId,
    actor: actingUser,
    action: "INVOICE_UPDATED",
    entityType: "CoworkingInvoice",
    entityId: invoice._id,
    metadata: { totalAmount: invoice.totalAmount },
  });

  return invoice;
};

const cancelInvoice = async ({ companyId, invoiceId, actingUser }) => {
  const invoice = await getInvoiceDoc(companyId, invoiceId);
  if (invoice.amountPaid > 0) {
    throw createHttpError(409, "Cannot cancel an invoice that already has payments recorded — refund the payments first");
  }
  invoice.status = "CANCELLED";
  invoice.updatedBy = actingUser._id;
  await invoice.save();

  await writeAuditLog({
    companyId,
    actor: actingUser,
    action: "INVOICE_CANCELLED",
    entityType: "CoworkingInvoice",
    entityId: invoice._id,
  });

  return invoice;
};

// The single place amountPaid is ever written — always recomputed from the
// full CoworkingPayment ledger (PAYMENT entries minus REFUND entries) for
// this invoice, never incremented/decremented in place. This is the same
// "recompute from source of truth" philosophy as Phase 3's cabin status.
const recalculateAmountPaid = async (companyId, invoiceId) => {
  const invoice = await CoworkingInvoice.findOne({ _id: invoiceId, companyId });
  if (!invoice) throw createHttpError(404, "Invoice not found");

  const ledger = await CoworkingPayment.find({ companyId, invoiceId, status: "COMPLETED" }).lean();
  const amountPaid = round2(
    ledger.reduce((sum, entry) => sum + (entry.type === "REFUND" ? -entry.amount : entry.amount), 0),
  );

  invoice.amountPaid = Math.max(0, amountPaid);
  invoice.status = deriveInvoiceStatus({
    totalAmount: invoice.totalAmount,
    amountPaid: invoice.amountPaid,
    dueDate: invoice.dueDate,
    currentStatus: invoice.status,
  });
  await invoice.save();
  return invoice;
};

// Mirrors the other lifecycle sweeps: flips PENDING/PARTIALLY_PAID invoices
// past their dueDate to OVERDUE.
const runInvoiceOverdueSweep = async () => {
  const now = new Date();
  const result = await CoworkingInvoice.updateMany(
    { status: { $in: ["PENDING", "PARTIALLY_PAID"] }, dueDate: { $lt: now } },
    { $set: { status: "OVERDUE" } },
  );
  return result.modifiedCount || 0;
};

module.exports = {
  generateInvoiceNumber,
  createInvoice,
  generateInvoiceForContract,
  listInvoices,
  getInvoiceById,
  updateInvoice,
  cancelInvoice,
  recalculateAmountPaid,
  runInvoiceOverdueSweep,
};
