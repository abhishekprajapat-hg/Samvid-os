const expenseService = require("../services/coworkingExpense.service");
const logger = require("../config/logger");
const { handleControllerError: handleError } = require("../utils/httpError");

const handleControllerError = (res, error, message) => handleError(res, error, logger, message);

exports.listExpenses = async (req, res) => {
  try {
    const { expenses, pagination } = await expenseService.listExpenses({
      companyId: req.user.companyId,
      query: req.query,
    });
    return res.json({ expenses, pagination });
  } catch (error) {
    return handleControllerError(res, error, "listExpenses failed");
  }
};

exports.getExpense = async (req, res) => {
  try {
    const expense = await expenseService.getExpenseById({
      companyId: req.user.companyId,
      expenseId: req.params.expenseId,
    });
    return res.json({ expense });
  } catch (error) {
    return handleControllerError(res, error, "getExpense failed");
  }
};

exports.createExpense = async (req, res) => {
  try {
    const expense = await expenseService.createExpense({
      companyId: req.user.companyId,
      actingUser: req.user,
      payload: req.body,
    });
    return res.status(201).json({ expense });
  } catch (error) {
    return handleControllerError(res, error, "createExpense failed");
  }
};

exports.updateExpense = async (req, res) => {
  try {
    const expense = await expenseService.updateExpense({
      companyId: req.user.companyId,
      expenseId: req.params.expenseId,
      payload: req.body,
      actingUser: req.user,
    });
    return res.json({ expense });
  } catch (error) {
    return handleControllerError(res, error, "updateExpense failed");
  }
};

exports.deleteExpense = async (req, res) => {
  try {
    await expenseService.deleteExpense({
      companyId: req.user.companyId,
      expenseId: req.params.expenseId,
      actingUser: req.user,
    });
    return res.json({ message: "Expense deleted" });
  } catch (error) {
    return handleControllerError(res, error, "deleteExpense failed");
  }
};

exports.approveExpense = async (req, res) => {
  try {
    const expense = await expenseService.approveExpense({
      companyId: req.user.companyId,
      expenseId: req.params.expenseId,
      actingUser: req.user,
    });
    return res.json({ expense });
  } catch (error) {
    return handleControllerError(res, error, "approveExpense failed");
  }
};

exports.rejectExpense = async (req, res) => {
  try {
    const expense = await expenseService.rejectExpense({
      companyId: req.user.companyId,
      expenseId: req.params.expenseId,
      actingUser: req.user,
      reason: req.body?.reason,
    });
    return res.json({ expense });
  } catch (error) {
    return handleControllerError(res, error, "rejectExpense failed");
  }
};

exports.markPaid = async (req, res) => {
  try {
    const expense = await expenseService.markExpensePaid({
      companyId: req.user.companyId,
      expenseId: req.params.expenseId,
      actingUser: req.user,
    });
    return res.json({ expense });
  } catch (error) {
    return handleControllerError(res, error, "markPaid failed");
  }
};

exports.addReceipt = async (req, res) => {
  try {
    const expense = await expenseService.addReceipt({
      companyId: req.user.companyId,
      expenseId: req.params.expenseId,
      payload: req.body,
      actingUser: req.user,
    });
    return res.status(201).json({ expense });
  } catch (error) {
    return handleControllerError(res, error, "addReceipt failed");
  }
};

exports.removeReceipt = async (req, res) => {
  try {
    const expense = await expenseService.removeReceipt({
      companyId: req.user.companyId,
      expenseId: req.params.expenseId,
      receiptId: req.params.receiptId,
      actingUser: req.user,
    });
    return res.json({ expense });
  } catch (error) {
    return handleControllerError(res, error, "removeReceipt failed");
  }
};
