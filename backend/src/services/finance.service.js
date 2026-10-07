const mongoose = require("mongoose");
const CoworkingInvoice = require("../models/CoworkingInvoice");
const CoworkingPayment = require("../models/CoworkingPayment");
const CoworkingExpense = require("../models/CoworkingExpense");
const CoworkingIdCounter = require("../models/CoworkingIdCounter");
const { PAYMENT_METHODS } = require("../constants/billing.constants");
const { EXPENSE_CATEGORIES } = require("../constants/expense.constants");
const { createHttpError } = require("../utils/httpError");

/*
 * The company's money in one place.
 *
 * There is no separate ledger: this reads the same three collections the
 * coworking billing screens write - invoices, the payment ledger and expenses -
 * and merges the two that are cash movements into a single feed. Nothing here
 * mutates an invoice's totals; `amountPaid` stays the business of
 * coworkingInvoice.service#recalculateAmountPaid, which sums the ledger.
 */

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const OPEN_INVOICE_STATUSES = ["PENDING", "PARTIALLY_PAID", "OVERDUE"];
const UNPAID_EXPENSE_STATUSES = ["PENDING", "APPROVED"];

/** "2026-09" -> the month it names; anything unparseable -> this month. */
const monthRange = (month) => {
  const match = /^(\d{4})-(\d{2})$/.exec(String(month || "").trim());
  const now = new Date();
  const year = match ? Number(match[1]) : now.getFullYear();
  const index = match ? Number(match[2]) - 1 : now.getMonth();
  return {
    from: new Date(year, index, 1, 0, 0, 0, 0),
    to: new Date(year, index + 1, 0, 23, 59, 59, 999),
    year,
    index,
  };
};

const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100;

const sumOf = (rows, pick) => round2(rows.reduce((total, row) => total + (Number(pick(row)) || 0), 0));

/* ------------------------------------------------------------- summary -- */

const getSummary = async ({ companyId, month }) => {
  const { from, to, year, index } = monthRange(month);

  const [invoicesInMonth, openInvoices, paymentsInMonth, expensesInMonth, unpaidExpenses] =
    await Promise.all([
      CoworkingInvoice.find({
        companyId,
        status: { $ne: "CANCELLED" },
        createdAt: { $gte: from, $lte: to },
      })
        .select("totalAmount amountPaid status dueDate")
        .lean(),
      CoworkingInvoice.find({ companyId, status: { $in: OPEN_INVOICE_STATUSES } })
        .select("totalAmount amountPaid status dueDate")
        .lean(),
      CoworkingPayment.find({
        companyId,
        status: "COMPLETED",
        paymentDate: { $gte: from, $lte: to },
      })
        .select("amount type invoiceId")
        .lean(),
      CoworkingExpense.find({
        companyId,
        status: { $ne: "REJECTED" },
        expenseDate: { $gte: from, $lte: to },
      })
        .select("amount status")
        .lean(),
      CoworkingExpense.find({ companyId, status: { $in: UNPAID_EXPENSE_STATUSES } })
        .select("amount")
        .lean(),
    ]);

  /*
   * Income is what was billed this month plus anything taken in without an
   * invoice behind it - a deposit at a site visit, a one-off collection - so
   * the two never double-count the same rupee.
   */
  const invoiced = sumOf(invoicesInMonth, (row) => row.totalAmount);
  const uninvoiced = sumOf(
    paymentsInMonth.filter((row) => !row.invoiceId && row.type !== "REFUND"),
    (row) => row.amount,
  );
  const income = round2(invoiced + uninvoiced);

  const collected = round2(
    sumOf(paymentsInMonth.filter((row) => row.type !== "REFUND"), (row) => row.amount)
      - sumOf(paymentsInMonth.filter((row) => row.type === "REFUND"), (row) => row.amount),
  );

  const expenses = sumOf(expensesInMonth, (row) => row.amount);
  const balanceOf = (row) => Math.max(0, (Number(row.totalAmount) || 0) - (Number(row.amountPaid) || 0));

  const overdueRows = openInvoices.filter(
    (row) => row.status === "OVERDUE" || (row.dueDate && new Date(row.dueDate) < new Date()),
  );

  return {
    month: `${year}-${String(index + 1).padStart(2, "0")}`,
    income,
    expenses,
    net: round2(income - expenses),
    collected,
    receivables: sumOf(openInvoices, balanceOf),
    receivablesCount: openInvoices.length,
    payables: sumOf(unpaidExpenses, (row) => row.amount),
    payablesCount: unpaidExpenses.length,
    overdue: sumOf(overdueRows, balanceOf),
    overdueCount: overdueRows.length,
  };
};

/** The six-month income/expense series the dashboard chart draws. */
const getSeries = async ({ companyId, months = 6 }) => {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const [invoices, payments, expenses] = await Promise.all([
    CoworkingInvoice.find({
      companyId,
      status: { $ne: "CANCELLED" },
      createdAt: { $gte: first, $lte: last },
    })
      .select("totalAmount createdAt")
      .lean(),
    CoworkingPayment.find({
      companyId,
      status: "COMPLETED",
      type: { $ne: "REFUND" },
      invoiceId: null,
      paymentDate: { $gte: first, $lte: last },
    })
      .select("amount paymentDate")
      .lean(),
    CoworkingExpense.find({
      companyId,
      status: { $ne: "REJECTED" },
      expenseDate: { $gte: first, $lte: last },
    })
      .select("amount expenseDate")
      .lean(),
  ]);

  const buckets = Array.from({ length: months }, (_, offset) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (months - 1) + offset, 1);
    return {
      month: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
      income: 0,
      expenses: 0,
    };
  });

  const indexOf = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return -1;
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    return buckets.findIndex((bucket) => bucket.month === key);
  };

  for (const row of invoices) {
    const at = indexOf(row.createdAt);
    if (at >= 0) buckets[at].income += Number(row.totalAmount) || 0;
  }
  for (const row of payments) {
    const at = indexOf(row.paymentDate);
    if (at >= 0) buckets[at].income += Number(row.amount) || 0;
  }
  for (const row of expenses) {
    const at = indexOf(row.expenseDate);
    if (at >= 0) buckets[at].expenses += Number(row.amount) || 0;
  }

  return buckets.map((bucket) => ({
    ...bucket,
    income: round2(bucket.income),
    expenses: round2(bucket.expenses),
  }));
};

/* -------------------------------------------------------- transactions -- */

const nameOf = (row) => row?.name || row?.title || row?.projectName || "";

const paymentToRow = (row) => ({
  id: String(row._id),
  kind: "INCOME",
  source: "PAYMENT",
  code: row.paymentCode || "",
  title: row.title || (row.invoiceId ? "Invoice payment" : "Payment received"),
  party:
    row.payerName
    || nameOf(row.clientId)
    || nameOf(row.leadId)
    || nameOf(row.contactId)
    || nameOf(row.inventoryId),
  category: row.category || (row.type === "REFUND" ? "REFUND" : "PAYMENT"),
  amount: row.type === "REFUND" ? -round2(row.amount) : round2(row.amount),
  method: row.method || "",
  status: row.status === "CANCELLED" ? "CANCELLED" : "PAID",
  date: row.paymentDate,
  reference: row.transactionReference || "",
  invoiceId: row.invoiceId ? String(row.invoiceId?._id || row.invoiceId) : "",
  invoiceNumber: row.invoiceId?.invoiceNumber || "",
  notes: row.notes || "",
});

const expenseToRow = (row) => ({
  id: String(row._id),
  kind: "EXPENSE",
  source: "EXPENSE",
  code: row.expenseCode || "",
  title: row.description || "Expense",
  party:
    row.vendor
    || nameOf(row.propertyId)
    || nameOf(row.inventoryId)
    || nameOf(row.leadId)
    || nameOf(row.contactId),
  category: row.category || "OTHER",
  amount: -round2(row.amount),
  method: row.paymentMethod || "",
  status: row.status === "PAID" ? "PAID" : row.status === "REJECTED" ? "CANCELLED" : "PENDING",
  date: row.expenseDate,
  reference: row.referenceNumber || "",
  invoiceId: "",
  invoiceNumber: "",
  notes: row.notes || "",
});

/*
 * One feed out of two collections. They are merged in memory rather than with
 * an aggregation $unionWith so the populated party names come along; a month
 * of a company's cash is small enough that this is the cheaper trade.
 */
const listTransactions = async ({ companyId, query = {} }) => {
  const type = String(query.type || "ALL").toUpperCase();
  const status = String(query.status || "").toUpperCase();
  const category = String(query.category || "").toUpperCase();
  const method = String(query.method || "").toUpperCase();
  const search = String(query.q || "").trim().toLowerCase();
  const limit = Math.min(Math.max(Number(query.limit) || 100, 1), 300);

  const range = query.month ? monthRange(query.month) : null;
  const inRange = (field) => (range ? { [field]: { $gte: range.from, $lte: range.to } } : {});

  const wantIncome = type === "ALL" || type === "INCOME";
  const wantExpense = type === "ALL" || type === "EXPENSE";

  const [payments, expenses] = await Promise.all([
    wantIncome
      ? CoworkingPayment.find({ companyId, ...inRange("paymentDate") })
        .populate("clientId", "name")
        .populate("leadId", "name")
        .populate("contactId", "name")
        .populate("inventoryId", "title projectName")
        .populate("invoiceId", "invoiceNumber")
        .sort({ paymentDate: -1 })
        .limit(limit)
        .lean()
      : [],
    wantExpense
      ? CoworkingExpense.find({ companyId, ...inRange("expenseDate") })
        .populate("propertyId", "name")
        .populate("inventoryId", "title projectName")
        .populate("leadId", "name")
        .populate("contactId", "name")
        .sort({ expenseDate: -1 })
        .limit(limit)
        .lean()
      : [],
  ]);

  let rows = [...payments.map(paymentToRow), ...expenses.map(expenseToRow)];

  if (status) rows = rows.filter((row) => row.status === status);
  if (category) rows = rows.filter((row) => String(row.category).toUpperCase() === category);
  if (method) rows = rows.filter((row) => String(row.method).toUpperCase() === method);
  if (search) {
    rows = rows.filter((row) =>
      [row.title, row.party, row.code, row.reference, row.invoiceNumber]
        .map((value) => String(value || "").toLowerCase())
        .some((value) => value.includes(search)),
    );
  }

  rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const totals = {
    in: sumOf(rows.filter((row) => row.amount > 0), (row) => row.amount),
    out: Math.abs(sumOf(rows.filter((row) => row.amount < 0), (row) => row.amount)),
  };
  totals.net = round2(totals.in - totals.out);

  return { transactions: rows.slice(0, limit), totals, count: rows.length };
};

/* --------------------------------------------------------- create entry -- */

const generateCode = async (companyId, category, prefix) => {
  const counter = await CoworkingIdCounter.findOneAndUpdate(
    { companyId, category },
    { $inc: { seq: 1 } },
    { returnDocument: "after", upsert: true },
  );
  return `${prefix}-${String(counter.seq).padStart(5, "0")}`;
};

const asObjectId = (value) => (isValidObjectId(value) ? value : null);

/*
 * The Add Entry screen's single save. Income becomes a ledger entry, expense
 * becomes an expense - the two collections that already exist - rather than a
 * third shape that would have to be reconciled with them later.
 */
const createEntry = async ({ companyId, actingUser, payload = {} }) => {
  const kind = String(payload.kind || "INCOME").toUpperCase();
  const amount = Number(payload.amount);
  if (!Number.isFinite(amount) || amount <= 0) throw createHttpError(400, "Amount is required");

  const method = String(payload.method || "").trim().toUpperCase();
  if (!PAYMENT_METHODS.includes(method)) throw createHttpError(400, "Invalid payment mode");

  const when = payload.date ? new Date(payload.date) : new Date();
  if (Number.isNaN(when.getTime())) throw createHttpError(400, "Invalid date");

  if (kind === "EXPENSE") {
    const category = String(payload.category || "OTHER").trim().toUpperCase();
    if (!EXPENSE_CATEGORIES.includes(category)) throw createHttpError(400, "Invalid category");

    const expense = await CoworkingExpense.create({
      companyId,
      expenseCode: await generateCode(companyId, "EXPENSE", "EXP"),
      propertyId: asObjectId(payload.propertyId),
      inventoryId: asObjectId(payload.inventoryId),
      leadId: asObjectId(payload.leadId),
      contactId: asObjectId(payload.contactId),
      category,
      description: String(payload.title || payload.description || "Expense").trim().slice(0, 500),
      amount,
      expenseDate: when,
      paymentMethod: method,
      vendor: String(payload.party || "").trim().slice(0, 200),
      referenceNumber: String(payload.reference || "").trim().slice(0, 120),
      notes: String(payload.notes || "").trim().slice(0, 2000),
      status: String(payload.status || "PENDING").toUpperCase() === "PAID" ? "PAID" : "PENDING",
      paidAt: String(payload.status || "").toUpperCase() === "PAID" ? when : null,
      receipts: Array.isArray(payload.receipts)
        ? payload.receipts
          .filter((row) => row && row.fileUrl)
          .map((row) => ({
            name: String(row.name || "Receipt").slice(0, 200),
            category: "RECEIPT",
            fileUrl: String(row.fileUrl),
            fileType: String(row.fileType || ""),
            uploadedBy: actingUser._id,
          }))
        : [],
      createdBy: actingUser._id,
    });

    return { kind: "EXPENSE", entry: expense.toObject() };
  }

  const payment = await CoworkingPayment.create({
    companyId,
    paymentCode: await generateCode(companyId, "PAYMENT", "RCPT"),
    invoiceId: asObjectId(payload.invoiceId),
    clientId: asObjectId(payload.clientId),
    leadId: asObjectId(payload.leadId),
    contactId: asObjectId(payload.contactId),
    inventoryId: asObjectId(payload.inventoryId),
    category: String(payload.category || "").trim().toUpperCase().slice(0, 40),
    title: String(payload.title || "Payment received").trim().slice(0, 200),
    payerName: String(payload.party || "").trim().slice(0, 200),
    amount,
    method,
    transactionReference: String(payload.reference || "").trim(),
    paymentDate: when,
    notes: String(payload.notes || "").trim().slice(0, 500),
    receipts: Array.isArray(payload.receipts)
      ? payload.receipts
        .filter((row) => row && row.fileUrl)
        .map((row) => ({
          name: String(row.name || "Receipt").slice(0, 200),
          fileUrl: String(row.fileUrl),
          fileType: String(row.fileType || ""),
        }))
      : [],
    createdBy: actingUser._id,
  });

  /*
   * An entry against an invoice has to move that invoice's paid total, and
   * only the billing service is allowed to compute it.
   */
  if (payment.invoiceId) {
    const { recalculateAmountPaid } = require("./coworkingInvoice.service");
    await recalculateAmountPaid(companyId, payment.invoiceId);
  }

  return { kind: "INCOME", entry: payment.toObject() };
};

module.exports = {
  monthRange,
  getSummary,
  getSeries,
  listTransactions,
  createEntry,
};
