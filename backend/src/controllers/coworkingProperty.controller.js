const propertyService = require("../services/coworkingProperty.service");
const logger = require("../config/logger");
const { handleControllerError: handleError } = require("../utils/httpError");

const handleControllerError = (res, error, message) => handleError(res, error, logger, message);

exports.listProperties = async (req, res) => {
  try {
    const { properties, pagination } = await propertyService.listProperties({
      companyId: req.user.companyId,
      query: req.query,
    });
    return res.json({ properties, pagination });
  } catch (error) {
    return handleControllerError(res, error, "listProperties failed");
  }
};

exports.getProperty = async (req, res) => {
  try {
    const property = await propertyService.getPropertyById({
      companyId: req.user.companyId,
      propertyId: req.params.propertyId,
    });
    return res.json({ property });
  } catch (error) {
    return handleControllerError(res, error, "getProperty failed");
  }
};

exports.createProperty = async (req, res) => {
  try {
    const property = await propertyService.createProperty({
      companyId: req.user.companyId,
      actingUser: req.user,
      payload: req.body,
    });
    return res.status(201).json({ property });
  } catch (error) {
    return handleControllerError(res, error, "createProperty failed");
  }
};

exports.updateProperty = async (req, res) => {
  try {
    const property = await propertyService.updateProperty({
      companyId: req.user.companyId,
      propertyId: req.params.propertyId,
      payload: req.body,
      actingUser: req.user,
    });
    return res.json({ property });
  } catch (error) {
    return handleControllerError(res, error, "updateProperty failed");
  }
};

exports.deleteProperty = async (req, res) => {
  try {
    await propertyService.deleteProperty({
      companyId: req.user.companyId,
      propertyId: req.params.propertyId,
      actingUser: req.user,
    });
    return res.json({ message: "Property deleted" });
  } catch (error) {
    return handleControllerError(res, error, "deleteProperty failed");
  }
};
