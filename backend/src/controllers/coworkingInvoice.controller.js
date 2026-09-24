const invoiceService = require("../services/coworkingInvoice.service");
const logger = require("../config/logger");
const { handleControllerError: handleError } = require("../utils/httpError");

const handleControllerError = (res, error, message) => handleError(res, error, logger, message);

exports.listInvoices = async (req, res) => {
  try {
    const { invoices, pagination } = await invoiceService.listInvoices({
      companyId: req.user.companyId,
      query: req.query,
    });
    return res.json({ invoices, pagination });
  } catch (error) {
    return handleControllerError(res, error, "listInvoices failed");
  }
};

exports.getInvoice = async (req, res) => {
  try {
    const invoice = await invoiceService.getInvoiceById({
      companyId: req.user.companyId,
      invoiceId: req.params.invoiceId,
    });
    return res.json({ invoice });
  } catch (error) {
    return handleControllerError(res, error, "getInvoice failed");
  }
};

exports.createInvoice = async (req, res) => {
  try {
    const invoice = await invoiceService.createInvoice({
      companyId: req.user.companyId,
      actingUser: req.user,
      payload: req.body,
    });
    return res.status(201).json({ invoice });
  } catch (error) {
    return handleControllerError(res, error, "createInvoice failed");
  }
};

exports.generateForContract = async (req, res) => {
  try {
    const invoice = await invoiceService.generateInvoiceForContract({
      companyId: req.user.companyId,
      actingUser: req.user,
      contractId: req.body?.contractId,
      billingPeriodStart: req.body?.billingPeriodStart,
      billingPeriodEnd: req.body?.billingPeriodEnd,
      dueDate: req.body?.dueDate,
      gstRate: req.body?.gstRate,
    });
    return res.status(201).json({ invoice });
  } catch (error) {
    return handleControllerError(res, error, "generateForContract failed");
  }
};

exports.updateInvoice = async (req, res) => {
  try {
    const invoice = await invoiceService.updateInvoice({
      companyId: req.user.companyId,
      invoiceId: req.params.invoiceId,
      payload: req.body,
      actingUser: req.user,
    });
    return res.json({ invoice });
  } catch (error) {
    return handleControllerError(res, error, "updateInvoice failed");
  }
};

exports.cancelInvoice = async (req, res) => {
  try {
    const invoice = await invoiceService.cancelInvoice({
      companyId: req.user.companyId,
      invoiceId: req.params.invoiceId,
      actingUser: req.user,
    });
    return res.json({ invoice });
  } catch (error) {
    return handleControllerError(res, error, "cancelInvoice failed");
  }
};
