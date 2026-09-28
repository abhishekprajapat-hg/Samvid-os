const financeService = require("../services/finance.service");
const invoiceService = require("../services/coworkingInvoice.service");
const paymentService = require("../services/coworkingPayment.service");
const logger = require("../config/logger");
const { handleControllerError: handleError } = require("../utils/httpError");

const handleControllerError = (res, error, message) => handleError(res, error, logger, message);

exports.getOverview = async (req, res) => {
  try {
    const [summary, series] = await Promise.all([
      financeService.getSummary({ companyId: req.user.companyId, month: req.query.month }),
      financeService.getSeries({ companyId: req.user.companyId, months: Number(req.query.months) || 6 }),
    ]);
    return res.json({ summary, series });
  } catch (error) {
    return handleControllerError(res, error, "getOverview failed");
  }
};

exports.listTransactions = async (req, res) => {
  try {
    const result = await financeService.listTransactions({
      companyId: req.user.companyId,
      query: req.query,
    });
    return res.json(result);
  } catch (error) {
    return handleControllerError(res, error, "listTransactions failed");
  }
};

exports.createEntry = async (req, res) => {
  try {
    const result = await financeService.createEntry({
      companyId: req.user.companyId,
      actingUser: req.user,
      payload: req.body,
    });
    return res.status(201).json(result);
  } catch (error) {
    return handleControllerError(res, error, "createEntry failed");
  }
};

/*
 * Invoices are read through the billing service that owns them, so the totals
 * and the derived status the Finance screens show are the same ones the
 * coworking screens show.
 */
exports.listInvoices = async (req, res) => {
  try {
    const result = await invoiceService.listInvoices({
      companyId: req.user.companyId,
      query: req.query,
    });
    return res.json(result);
  } catch (error) {
    return handleControllerError(res, error, "listInvoices failed");
  }
};

exports.getInvoice = async (req, res) => {
  try {
    const [invoice, ledger] = await Promise.all([
      invoiceService.getInvoiceById({
        companyId: req.user.companyId,
        invoiceId: req.params.invoiceId,
      }),
      paymentService.listPayments({
        companyId: req.user.companyId,
        query: { invoiceId: req.params.invoiceId, limit: 100 },
      }),
    ]);
    return res.json({ invoice, payments: ledger?.payments || [] });
  } catch (error) {
    return handleControllerError(res, error, "getInvoice failed");
  }
};
