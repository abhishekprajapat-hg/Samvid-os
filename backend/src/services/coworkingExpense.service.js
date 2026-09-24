const mongoose = require("mongoose");
const CoworkingExpense = require("../models/CoworkingExpense");
const CoworkingProperty = require("../models/CoworkingProperty");
const CoworkingIdCounter = require("../models/CoworkingIdCounter");
const {
  EXPENSE_CATEGORIES,
  EXPENSE_STATUSES,
  PAYMENT_METHODS,
  RECEIPT_CATEGORIES,
  EXPENSE_ALLOWED_CREATE_FIELDS,
  EXPENSE_ALLOWED_UPDATE_FIELDS,
} = require("../constants/expense.constants");
const { createHttpError } = require("../utils/httpError");
const { parsePagination, buildPaginationMeta } = require("../utils/queryOptions");
const { writeAuditLog } = require("./auditLog.service");

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const generateExpenseCode = async (companyId) => {
  const counter = await CoworkingIdCounter.findOneAndUpdate(
    { companyId, category: "EXPENSE" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  );
  return `EXP-${String(counter.seq).padStart(5, "0")}`;
};

const sanitizePayload = async (companyId, payload = {}, { mode }) => {
  const safe = {};
  const fields = mode === "create" ? EXPENSE_ALLOWED_CREATE_FIELDS : EXPENSE_ALLOWED_UPDATE_FIELDS;

  for (const field of fields) {
    if (!Object.prototype.hasOwnProperty.call(payload, field)) continue;

    if (field === "propertyId") {
      const propertyId = payload.propertyId ? String(payload.propertyId).trim() : "";
      if (propertyId) {
        if (!isValidObjectId(propertyId)) throw createHttpError(400, "Invalid propertyId");
        const exists = await CoworkingProperty.exists({ _id: propertyId, companyId });
        if (!exists) throw createHttpError(400, "Property not found for this company");
      }
      safe.propertyId = propertyId || null;
    } else if (field === "category") {
      const category = String(payload.category || "").trim().toUpperCase();
      if (!EXPENSE_CATEGORIES.includes(category)) throw createHttpError(400, "Invalid category");
      safe.category = category;
    } else if (field === "description") {
      const description = String(payload.description || "").trim();
      if (!description) throw createHttpError(400, "description is required");
      safe.description = description.slice(0, 500);
    } else if (field === "amount") {
      const amount = Number(payload.amount);
      if (!Number.isFinite(amount) || amount <= 0) throw createHttpError(400, "amount must be greater than 0");
      safe.amount = amount;
    } else if (field === "expenseDate") {
      const date = new Date(payload.expenseDate);
      if (Number.isNaN(date.getTime())) throw createHttpError(400, "expenseDate is not a valid date");
      safe.expenseDate = date;
    } else if (field === "paymentMethod") {
      const method = String(payload.paymentMethod || "").trim().toUpperCase();
      if (!PAYMENT_METHODS.includes(method)) throw createHttpError(400, "Invalid paymentMethod");
      safe.paymentMethod = method;
    } else if (field === "vendor") {
      safe.vendor = String(payload.vendor || "").trim().slice(0, 200);
    } else if (field === "notes") {
      safe.notes = String(payload.notes || "").trim().slice(0, 2000);
    }
  }

  if (mode === "create") {
    for (const required of ["category", "description", "amount", "expenseDate", "paymentMethod"]) {
      if (safe[required] === undefined) throw createHttpError(400, `${required} is required`);
    }
  }

  return safe;
};

const createExpense = async ({ companyId, actingUser, payload }) => {
  const safe = await sanitizePayload(companyId, payload, { mode: "create" });
  const expenseCode = await generateExpenseCode(companyId);

  const expense = await CoworkingExpense.create({
    ...safe,
    companyId,
    expenseCode,
    status: "PENDING",
    createdBy: actingUser._id,
  });

  await writeAuditLog({
    companyId,
    actor: actingUser,
    action: "EXPENSE_CREATED",
    entityType: "CoworkingExpense",
    entityId: expense._id,
    metadata: { expenseCode, amount: safe.amount, category: safe.category },
  });

  return expense;
};

const listExpenses = async ({ companyId, query = {} }) => {
  const { page, limit, skip } = parsePagination(query, { defaultLimit: 20, maxLimit: 100 });
  const filter = { companyId };

  if (query.status) {
    const status = String(query.status).trim().toUpperCase();
    if (!EXPENSE_STATUSES.includes(status)) throw createHttpError(400, "Invalid status filter");
    filter.status = status;
  }
  if (query.category) {
    const category = String(query.category).trim().toUpperCase();
    if (!EXPENSE_CATEGORIES.includes(category)) throw createHttpError(400, "Invalid category filter");
    filter.category = category;
  }
  if (query.propertyId) filter.propertyId = query.propertyId;

  const [rows, totalCount] = await Promise.all([
    CoworkingExpense.find(filter)
      .populate("propertyId", "name")
      .sort({ expenseDate: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    CoworkingExpense.countDocuments(filter),
  ]);

  return { expenses: rows, pagination: buildPaginationMeta({ page, limit, totalCount }) };
};

const getExpenseDoc = async (companyId, expenseId) => {
  if (!isValidObjectId(expenseId)) throw createHttpError(400, "Invalid expense id");
  const expense = await CoworkingExpense.findOne({ _id: expenseId, companyId });
  if (!expense) throw createHttpError(404, "Expense not found");
  return expense;
};

const getExpenseById = async ({ companyId, expenseId }) => {
  if (!isValidObjectId(expenseId)) throw createHttpError(400, "Invalid expense id");
  const expense = await CoworkingExpense.findOne({ _id: expenseId, companyId })
    .populate("propertyId", "name")
    .populate("approvedBy", "name")
    .lean();
  if (!expense) throw createHttpError(404, "Expense not found");
  return expense;
};

const updateExpense = async ({ companyId, expenseId, payload, actingUser }) => {
  const expense = await getExpenseDoc(companyId, expenseId);
  if (expense.status !== "PENDING") {
    throw createHttpError(409, `Cannot edit an expense in ${expense.status} status`);
  }

  const safe = await sanitizePayload(companyId, payload, { mode: "update" });
  if (Object.keys(safe).length === 0) throw createHttpError(400, "No valid fields to update");

  Object.assign(expense, safe, { updatedBy: actingUser._id });
  await expense.save();

  await writeAuditLog({
    companyId,
    actor: actingUser,
    action: "EXPENSE_UPDATED",
    entityType: "CoworkingExpense",
    entityId: expense._id,
    metadata: { changes: safe },
  });

  return expense;
};

const deleteExpense = async ({ companyId, expenseId, actingUser }) => {
  const expense = await getExpenseDoc(companyId, expenseId);
  if (expense.status !== "PENDING") {
    throw createHttpError(409, `Cannot delete an expense in ${expense.status} status`);
  }
  await expense.deleteOne();

  await writeAuditLog({
    companyId,
    actor: actingUser,
    action: "EXPENSE_DELETED",
    entityType: "CoworkingExpense",
    entityId: expenseId,
    metadata: { expenseCode: expense.expenseCode },
  });
};

const approveExpense = async ({ companyId, expenseId, actingUser }) => {
  const expense = await getExpenseDoc(companyId, expenseId);
  if (expense.status !== "PENDING") throw createHttpError(409, `Expense is ${expense.status}, expected PENDING`);

  expense.status = "APPROVED";
  expense.approvedBy = actingUser._id;
  expense.approvedAt = new Date();
  expense.updatedBy = actingUser._id;
  await expense.save();

  await writeAuditLog({
    companyId,
    actor: actingUser,
    action: "EXPENSE_APPROVED",
    entityType: "CoworkingExpense",
    entityId: expense._id,
  });

  return expense;
};

const rejectExpense = async ({ companyId, expenseId, actingUser, reason }) => {
  const expense = await getExpenseDoc(companyId, expenseId);
  if (expense.status !== "PENDING") throw createHttpError(409, `Expense is ${expense.status}, expected PENDING`);

  expense.status = "REJECTED";
  expense.rejectedReason = String(reason || "").trim().slice(0, 500);
  expense.updatedBy = actingUser._id;
  await expense.save();

  await writeAuditLog({
    companyId,
    actor: actingUser,
    action: "EXPENSE_REJECTED",
    entityType: "CoworkingExpense",
    entityId: expense._id,
    metadata: { reason },
  });

  return expense;
};

const markExpensePaid = async ({ companyId, expenseId, actingUser }) => {
  const expense = await getExpenseDoc(companyId, expenseId);
  if (expense.status !== "APPROVED") throw createHttpError(409, `Expense is ${expense.status}, expected APPROVED`);

  expense.status = "PAID";
  expense.paidAt = new Date();
  expense.updatedBy = actingUser._id;
  await expense.save();

  await writeAuditLog({
    companyId,
    actor: actingUser,
    action: "EXPENSE_PAID",
    entityType: "CoworkingExpense",
    entityId: expense._id,
  });

  return expense;
};

const addReceipt = async ({ companyId, expenseId, payload, actingUser }) => {
  const expense = await getExpenseDoc(companyId, expenseId);
  const name = String(payload?.name || "").trim();
  const fileUrl = String(payload?.fileUrl || "").trim();
  if (!name || !fileUrl) throw createHttpError(400, "Receipt name and fileUrl are required");

  const category = String(payload?.category || "RECEIPT").trim().toUpperCase();
  if (!RECEIPT_CATEGORIES.includes(category)) throw createHttpError(400, "Invalid receipt category");

  expense.receipts.push({
    name: name.slice(0, 200),
    category,
    fileUrl,
    fileType: String(payload?.fileType || "").trim(),
    uploadedBy: actingUser._id,
    uploadedAt: new Date(),
  });
  await expense.save();

  await writeAuditLog({
    companyId,
    actor: actingUser,
    action: "EXPENSE_RECEIPT_ADDED",
    entityType: "CoworkingExpense",
    entityId: expense._id,
    metadata: { name },
  });

  return expense;
};

const removeReceipt = async ({ companyId, expenseId, receiptId, actingUser }) => {
  const expense = await getExpenseDoc(companyId, expenseId);
  const before = expense.receipts.length;
  expense.receipts = expense.receipts.filter((receipt) => String(receipt._id) !== String(receiptId));
  if (expense.receipts.length === before) throw createHttpError(404, "Receipt not found");
  await expense.save();

  await writeAuditLog({
    companyId,
    actor: actingUser,
    action: "EXPENSE_RECEIPT_REMOVED",
    entityType: "CoworkingExpense",
    entityId: expense._id,
    metadata: { receiptId },
  });

  return expense;
};

module.exports = {
  generateExpenseCode,
  createExpense,
  listExpenses,
  getExpenseById,
  updateExpense,
  deleteExpense,
  approveExpense,
  rejectExpense,
  markExpensePaid,
  addReceipt,
  removeReceipt,
};
