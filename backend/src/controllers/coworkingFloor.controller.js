const floorService = require("../services/coworkingFloor.service");
const logger = require("../config/logger");
const { handleControllerError: handleError } = require("../utils/httpError");

const handleControllerError = (res, error, message) => handleError(res, error, logger, message);

exports.listFloors = async (req, res) => {
  try {
    const { floors, pagination } = await floorService.listFloors({
      companyId: req.user.companyId,
      query: req.query,
    });
    return res.json({ floors, pagination });
  } catch (error) {
    return handleControllerError(res, error, "listFloors failed");
  }
};

exports.getFloor = async (req, res) => {
  try {
    const floor = await floorService.getFloorById({
      companyId: req.user.companyId,
      floorId: req.params.floorId,
    });
    return res.json({ floor });
  } catch (error) {
    return handleControllerError(res, error, "getFloor failed");
  }
};

exports.createFloor = async (req, res) => {
  try {
    const floor = await floorService.createFloor({
      companyId: req.user.companyId,
      actingUser: req.user,
      payload: req.body,
    });
    return res.status(201).json({ floor });
  } catch (error) {
    return handleControllerError(res, error, "createFloor failed");
  }
};

exports.updateFloor = async (req, res) => {
  try {
    const floor = await floorService.updateFloor({
      companyId: req.user.companyId,
      floorId: req.params.floorId,
      payload: req.body,
      actingUser: req.user,
    });
    return res.json({ floor });
  } catch (error) {
    return handleControllerError(res, error, "updateFloor failed");
  }
};

exports.deleteFloor = async (req, res) => {
  try {
    await floorService.deleteFloor({
      companyId: req.user.companyId,
      floorId: req.params.floorId,
      actingUser: req.user,
    });
    return res.json({ message: "Floor deleted" });
  } catch (error) {
    return handleControllerError(res, error, "deleteFloor failed");
  }
};
