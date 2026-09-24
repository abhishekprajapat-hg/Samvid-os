const cabinService = require("../services/coworkingCabin.service");
const logger = require("../config/logger");
const { handleControllerError: handleError } = require("../utils/httpError");

const handleControllerError = (res, error, message) => handleError(res, error, logger, message);

exports.getFloorView = async (req, res) => {
  try {
    const { hasPermission } = require("../services/permission.service");
    const { getFloorView } = require("../services/coworkingFloorView.service");
    const [clients, contracts, bookings, billing] = await Promise.all(
      ["clients.view", "contracts.view", "bookings.view", "billing.view"].map((p) => hasPermission(req.user, p)),
    );
    return res.json(await getFloorView({ companyId: req.user.companyId, floorId: req.query.floorId, access: { clients, contracts, bookings, billing } }));
  } catch (error) {
    return handleControllerError(res, error, "getFloorView failed");
  }
};

exports.listCabins = async (req, res) => {
  try {
    const { cabins, pagination } = await cabinService.listCabins({
      companyId: req.user.companyId,
      query: req.query,
    });
    return res.json({ cabins, pagination });
  } catch (error) {
    return handleControllerError(res, error, "listCabins failed");
  }
};

exports.listSeats = async (req, res) => {
  try {
    const { seats, pagination } = await cabinService.listSeatsAcrossCabins({
      companyId: req.user.companyId,
      query: req.query,
    });
    return res.json({ seats, pagination });
  } catch (error) {
    return handleControllerError(res, error, "listSeats failed");
  }
};

exports.getCabin = async (req, res) => {
  try {
    const cabin = await cabinService.getCabinById({
      companyId: req.user.companyId,
      cabinId: req.params.cabinId,
    });
    return res.json({ cabin });
  } catch (error) {
    return handleControllerError(res, error, "getCabin failed");
  }
};

exports.createCabin = async (req, res) => {
  try {
    const cabin = await cabinService.createCabin({
      companyId: req.user.companyId,
      actingUser: req.user,
      payload: req.body,
    });
    return res.status(201).json({ cabin });
  } catch (error) {
    return handleControllerError(res, error, "createCabin failed");
  }
};

exports.updateCabin = async (req, res) => {
  try {
    const cabin = await cabinService.updateCabin({
      companyId: req.user.companyId,
      cabinId: req.params.cabinId,
      payload: req.body,
      actingUser: req.user,
    });
    return res.json({ cabin });
  } catch (error) {
    return handleControllerError(res, error, "updateCabin failed");
  }
};

exports.deleteCabin = async (req, res) => {
  try {
    await cabinService.deleteCabin({
      companyId: req.user.companyId,
      cabinId: req.params.cabinId,
      actingUser: req.user,
    });
    return res.json({ message: "Cabin deleted" });
  } catch (error) {
    return handleControllerError(res, error, "deleteCabin failed");
  }
};

const cabinMutationHandler = (serviceFn, actionLabel) => async (req, res) => {
  try {
    const { cabin } = await serviceFn({
      companyId: req.user.companyId,
      cabinId: req.params.cabinId,
      actingUser: req.user,
      reason: req.body?.reason,
    });
    return res.json({ cabin });
  } catch (error) {
    return handleControllerError(res, error, `${actionLabel} failed`);
  }
};

exports.blockCabin = cabinMutationHandler(cabinService.blockCabin, "blockCabin");
exports.unblockCabin = cabinMutationHandler(cabinService.unblockCabin, "unblockCabin");
exports.setCabinMaintenance = cabinMutationHandler(cabinService.setCabinMaintenance, "setCabinMaintenance");
exports.clearCabinMaintenance = cabinMutationHandler(cabinService.clearCabinMaintenance, "clearCabinMaintenance");

const seatMutationHandler = (serviceFn, actionLabel) => async (req, res) => {
  try {
    const { cabin } = await serviceFn({
      companyId: req.user.companyId,
      cabinId: req.params.cabinId,
      seatCode: req.params.seatCode,
      label: req.body?.label,
      clientId: req.body?.clientId,
      actingUser: req.user,
    });
    return res.json({ cabin });
  } catch (error) {
    return handleControllerError(res, error, `${actionLabel} failed`);
  }
};

exports.assignSeat = seatMutationHandler(cabinService.assignCabinSeat, "assignSeat");
exports.releaseSeat = seatMutationHandler(cabinService.releaseCabinSeat, "releaseSeat");
exports.blockSeat = seatMutationHandler(cabinService.blockCabinSeat, "blockSeat");
exports.unblockSeat = seatMutationHandler(cabinService.unblockCabinSeat, "unblockSeat");
exports.setSeatMaintenance = seatMutationHandler(cabinService.setCabinSeatMaintenance, "setSeatMaintenance");
exports.clearSeatMaintenance = seatMutationHandler(cabinService.clearCabinSeatMaintenance, "clearSeatMaintenance");
