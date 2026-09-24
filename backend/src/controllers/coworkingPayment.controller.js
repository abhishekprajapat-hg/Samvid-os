const paymentService = require("../services/coworkingPayment.service");
const logger = require("../config/logger");
const { handleControllerError: handleError } = require("../utils/httpError");

const handleControllerError = (res, error, message) => handleError(res, error, logger, message);

exports.listPayments = async (req, res) => {
  try {
    const { payments, pagination } = await paymentService.listPayments({
      companyId: req.user.companyId,
      query: req.query,
    });
    return res.json({ payments, pagination });
  } catch (error) {
    return handleControllerError(res, error, "listPayments failed");
  }
};

exports.recordPayment = async (req, res) => {
  try {
    const payment = await paymentService.recordPayment({
      companyId: req.user.companyId,
      actingUser: req.user,
      payload: req.body,
    });
    return res.status(201).json({ payment });
  } catch (error) {
    return handleControllerError(res, error, "recordPayment failed");
  }
};

exports.refundPayment = async (req, res) => {
  try {
    const refund = await paymentService.refundPayment({
      companyId: req.user.companyId,
      actingUser: req.user,
      paymentId: req.params.paymentId,
      payload: req.body,
    });
    return res.status(201).json({ refund });
  } catch (error) {
    return handleControllerError(res, error, "refundPayment failed");
  }
};
