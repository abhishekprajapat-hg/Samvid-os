const bookingService = require("../services/coworkingBooking.service");
const availabilityService = require("../services/coworkingAvailability.service");
const logger = require("../config/logger");
const { handleControllerError: handleError, createHttpError } = require("../utils/httpError");

const handleControllerError = (res, error, message) => handleError(res, error, logger, message);

const parseDateParam = (value, fieldName) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw createHttpError(400, `${fieldName} is not a valid date`);
  return date;
};

exports.listBookings = async (req, res) => {
  try {
    const { bookings, pagination } = await bookingService.listBookings({
      companyId: req.user.companyId,
      query: req.query,
    });
    return res.json({ bookings, pagination });
  } catch (error) {
    return handleControllerError(res, error, "listBookings failed");
  }
};

exports.getBooking = async (req, res) => {
  try {
    const booking = await bookingService.getBookingById({
      companyId: req.user.companyId,
      bookingId: req.params.bookingId,
    });
    return res.json({ booking });
  } catch (error) {
    return handleControllerError(res, error, "getBooking failed");
  }
};

exports.createBooking = async (req, res) => {
  try {
    const result = await bookingService.createBooking({
      companyId: req.user.companyId,
      actingUser: req.user,
      payload: req.body,
    });
    return res.status(201).json(result);
  } catch (error) {
    return handleControllerError(res, error, "createBooking failed");
  }
};

exports.updateBooking = async (req, res) => {
  try {
    const booking = await bookingService.updateBooking({
      companyId: req.user.companyId,
      bookingId: req.params.bookingId,
      payload: req.body,
      actingUser: req.user,
    });
    return res.json({ booking });
  } catch (error) {
    return handleControllerError(res, error, "updateBooking failed");
  }
};

const transitionHandler = (serviceFn, actionLabel, extraArgs = () => ({})) => async (req, res) => {
  try {
    const booking = await serviceFn({
      companyId: req.user.companyId,
      bookingId: req.params.bookingId,
      actingUser: req.user,
      ...extraArgs(req),
    });
    return res.json({ booking });
  } catch (error) {
    return handleControllerError(res, error, `${actionLabel} failed`);
  }
};

exports.confirmBooking = transitionHandler(bookingService.confirmBooking, "confirmBooking");
exports.activateBooking = transitionHandler(bookingService.activateBooking, "activateBooking");
exports.completeBooking = transitionHandler(bookingService.completeBooking, "completeBooking", (req) => ({
  actualEndDate: req.body?.actualEndDate,
}));
exports.cancelBooking = transitionHandler(bookingService.cancelBooking, "cancelBooking", (req) => ({
  reason: req.body?.reason,
}));
exports.markNoShow = transitionHandler(bookingService.markNoShow, "markNoShow");

exports.extendBooking = async (req, res) => {
  try {
    const booking = await bookingService.extendBooking({
      companyId: req.user.companyId,
      bookingId: req.params.bookingId,
      newEndDate: req.body?.newEndDate,
      actingUser: req.user,
    });
    return res.json({ booking });
  } catch (error) {
    return handleControllerError(res, error, "extendBooking failed");
  }
};

exports.getCabinCalendar = async (req, res) => {
  try {
    const from = parseDateParam(req.query.from, "from");
    const to = parseDateParam(req.query.to, "to");
    const bookings = await availabilityService.getCabinBookingCalendar({
      companyId: req.user.companyId,
      cabinId: req.params.cabinId,
      from,
      to,
    });
    return res.json({ bookings });
  } catch (error) {
    return handleControllerError(res, error, "getCabinCalendar failed");
  }
};

exports.getAvailableCabins = async (req, res) => {
  try {
    if (!req.query.propertyId) throw createHttpError(400, "propertyId is required");
    const startDate = parseDateParam(req.query.startDate, "startDate");
    const endDate = parseDateParam(req.query.endDate, "endDate");
    const cabins = await availabilityService.listAvailableCabins({
      companyId: req.user.companyId,
      propertyId: req.query.propertyId,
      floorId: req.query.floorId,
      startDate,
      endDate,
    });
    return res.json({ cabins });
  } catch (error) {
    return handleControllerError(res, error, "getAvailableCabins failed");
  }
};

exports.getAvailableSeats = async (req, res) => {
  try {
    if (!req.query.propertyId) throw createHttpError(400, "propertyId is required");
    const startDate = parseDateParam(req.query.startDate, "startDate");
    const endDate = parseDateParam(req.query.endDate, "endDate");
    const seats = await availabilityService.listAvailableSeats({
      companyId: req.user.companyId,
      propertyId: req.query.propertyId,
      floorId: req.query.floorId,
      startDate,
      endDate,
      startTime: req.query.startTime,
      endTime: req.query.endTime,
    });
    return res.json({ seats });
  } catch (error) {
    return handleControllerError(res, error, "getAvailableSeats failed");
  }
};
