const contractService = require("../services/coworkingContract.service");
const logger = require("../config/logger");
const { handleControllerError: handleError } = require("../utils/httpError");

const handleControllerError = (res, error, message) => handleError(res, error, logger, message);

exports.listContracts = async (req, res) => {
  try {
    const { contracts, pagination } = await contractService.listContracts({
      companyId: req.user.companyId,
      query: req.query,
    });
    return res.json({ contracts, pagination });
  } catch (error) {
    return handleControllerError(res, error, "listContracts failed");
  }
};

exports.getContract = async (req, res) => {
  try {
    const contract = await contractService.getContractById({
      companyId: req.user.companyId,
      contractId: req.params.contractId,
    });
    return res.json({ contract });
  } catch (error) {
    return handleControllerError(res, error, "getContract failed");
  }
};

exports.createContract = async (req, res) => {
  try {
    const contract = await contractService.createContract({
      companyId: req.user.companyId,
      actingUser: req.user,
      payload: req.body,
    });
    return res.status(201).json({ contract });
  } catch (error) {
    return handleControllerError(res, error, "createContract failed");
  }
};

exports.updateContract = async (req, res) => {
  try {
    const contract = await contractService.updateContract({
      companyId: req.user.companyId,
      contractId: req.params.contractId,
      payload: req.body,
      actingUser: req.user,
    });
    return res.json({ contract });
  } catch (error) {
    return handleControllerError(res, error, "updateContract failed");
  }
};

exports.activateContract = async (req, res) => {
  try {
    const contract = await contractService.activateContract({
      companyId: req.user.companyId,
      contractId: req.params.contractId,
      actingUser: req.user,
    });
    return res.json({ contract });
  } catch (error) {
    return handleControllerError(res, error, "activateContract failed");
  }
};

exports.terminateContract = async (req, res) => {
  try {
    const contract = await contractService.terminateContract({
      companyId: req.user.companyId,
      contractId: req.params.contractId,
      actingUser: req.user,
      reason: req.body?.reason,
    });
    return res.json({ contract });
  } catch (error) {
    return handleControllerError(res, error, "terminateContract failed");
  }
};

exports.renewContract = async (req, res) => {
  try {
    const contract = await contractService.renewContract({
      companyId: req.user.companyId,
      contractId: req.params.contractId,
      actingUser: req.user,
      newEndDate: req.body?.newEndDate,
      newRent: req.body?.newRent,
    });
    return res.status(201).json({ contract });
  } catch (error) {
    return handleControllerError(res, error, "renewContract failed");
  }
};

exports.addDocument = async (req, res) => {
  try {
    const contract = await contractService.addDocument({
      companyId: req.user.companyId,
      contractId: req.params.contractId,
      payload: req.body,
      actingUser: req.user,
    });
    return res.status(201).json({ contract });
  } catch (error) {
    return handleControllerError(res, error, "addDocument failed");
  }
};

exports.removeDocument = async (req, res) => {
  try {
    const contract = await contractService.removeDocument({
      companyId: req.user.companyId,
      contractId: req.params.contractId,
      documentId: req.params.documentId,
      actingUser: req.user,
    });
    return res.json({ contract });
  } catch (error) {
    return handleControllerError(res, error, "removeDocument failed");
  }
};
