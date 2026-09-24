const mongoose = require("mongoose");
const CoworkingBooking = require("../models/CoworkingBooking");
const CoworkingCabin = require("../models/CoworkingCabin");
const CoworkingClient = require("../models/CoworkingClient");
const CoworkingFloor = require("../models/CoworkingFloor");
const CoworkingIdCounter = require("../models/CoworkingIdCounter");
const {
  BOOKING_STATUSES,
  BOOKING_TYPES,
  RECURRENCE_PATTERNS,
  MAX_RECURRING_OCCURRENCES,
  BOOKING_ALLOWED_UPDATE_FIELDS,
  TIME_PATTERN,
} = require("../constants/booking.constants");
const {
  assertAvailable,
  findConflictingBookings,
} = require("./coworkingAvailability.service");
const { reserveSeat, assignSeat, releaseSeat } = require("./coworkingOccupancy.service");
const { createHttpError } = require("../utils/httpError");
const { parsePagination, buildPaginationMeta } = require("../utils/queryOptions");
const { writeAuditLog } = require("./auditLog.service");

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const generateBookingCode = async (companyId) => {
  const counter = await CoworkingIdCounter.findOneAndUpdate(
    { companyId, category: "BOOKING" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  );
  return `BKG-${String(counter.seq).padStart(5, "0")}`;
};

const parseDateOnly = (value, fieldName) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw createHttpError(400, `${fieldName} is not a valid date`);
  return date;
};

const sanitizeCreatePayload = async (companyId, payload = {}) => {
  const clientId = String(payload.clientId || "").trim();
  const propertyId = String(payload.propertyId || "").trim();
  const floorId = String(payload.floorId || "").trim();
  const cabinId = String(payload.cabinId || "").trim();
  const bookingType = String(payload.bookingType || "").trim().toUpperCase();
  const seatCode = String(payload.seatCode || "").trim();

  for (const [label, value] of Object.entries({ clientId, propertyId, floorId, cabinId })) {
    if (!isValidObjectId(value)) throw createHttpError(400, `Invalid ${label}`);
  }
  if (!BOOKING_TYPES.includes(bookingType)) throw createHttpError(400, "Invalid bookingType");
  if (bookingType === "SEAT" && !seatCode) throw createHttpError(400, "seatCode is required for a SEAT booking");

  const [client, floor, cabin] = await Promise.all([
    CoworkingClient.findOne({ _id: clientId, companyId }).select("_id companyName").lean(),
    CoworkingFloor.findOne({ _id: floorId, companyId }).select("propertyId").lean(),
    CoworkingCabin.findOne({ _id: cabinId, companyId }).select("propertyId floorId seats cabinCode").lean(),
  ]);
  if (!client) throw createHttpError(400, "Client not found for this company");
  if (!floor) throw createHttpError(400, "Floor not found for this company");
  if (!cabin) throw createHttpError(400, "Cabin not found for this company");
  if (String(floor.propertyId) !== propertyId) throw createHttpError(400, "floorId does not belong to propertyId");
  if (String(cabin.propertyId) !== propertyId || String(cabin.floorId) !== floorId) {
    throw createHttpError(400, "cabinId does not belong to the given property/floor");
  }
  if (bookingType === "SEAT" && !cabin.seats.some((seat) => seat.seatCode === seatCode)) {
    throw createHttpError(400, `Seat ${seatCode} does not exist on cabin ${cabin.cabinCode}`);
  }

  const startDate = parseDateOnly(payload.startDate, "startDate");
  const endDate = parseDateOnly(payload.endDate, "endDate");
  if (endDate < startDate) throw createHttpError(400, "endDate cannot be before startDate");

  const startTime = String(payload.startTime || "").trim();
  const endTime = String(payload.endTime || "").trim();
  if (startTime && !TIME_PATTERN.test(startTime)) throw createHttpError(400, "startTime must be HH:MM");
  if (endTime && !TIME_PATTERN.test(endTime)) throw createHttpError(400, "endTime must be HH:MM");

  const price = Number(payload.price) || 0;
  const deposit = Number(payload.deposit) || 0;
  if (price < 0 || deposit < 0) throw createHttpError(400, "price/deposit cannot be negative");

  const isRecurring = Boolean(payload.isRecurring);
  const recurrencePattern = isRecurring ? String(payload.recurrencePattern || "").trim().toUpperCase() : "NONE";
  let recurrenceEndDate = null;
  if (isRecurring) {
    if (!RECURRENCE_PATTERNS.includes(recurrencePattern) || recurrencePattern === "NONE") {
      throw createHttpError(400, "A valid recurrencePattern is required for recurring bookings");
    }
    recurrenceEndDate = parseDateOnly(payload.recurrenceEndDate, "recurrenceEndDate");
    if (recurrenceEndDate < startDate) throw createHttpError(400, "recurrenceEndDate cannot be before startDate");
  }

  return {
    clientId,
    propertyId,
    floorId,
    cabinId,
    seatCode: bookingType === "SEAT" ? seatCode : "",
    bookingType,
    startDate,
    endDate,
    startTime,
    endTime,
    price,
    deposit,
    notes: String(payload.notes || "").trim().slice(0, 2000),
    isRecurring,
    recurrencePattern,
    recurrenceEndDate,
    clientLabel: client.companyName,
  };
};

const addInterval = (date, pattern) => {
  const next = new Date(date);
  if (pattern === "DAILY") next.setUTCDate(next.getUTCDate() + 1);
  else if (pattern === "WEEKLY") next.setUTCDate(next.getUTCDate() + 7);
  else if (pattern === "MONTHLY") next.setUTCMonth(next.getUTCMonth() + 1);
  return next;
};

// Reserves the resource for one booking occurrence: validates availability,
// persists the Booking doc, then drives Phase 3's occupancy layer so
// cabin/seat status immediately reflects the new hold. Single-occurrence and
// recurring bookings both funnel through this — no parallel code path.
const createSingleOccurrence = async ({ companyId, actingUser, base, startDate, endDate, recurrenceGroupId }) => {
  await assertAvailable({
    companyId,
    cabinId: base.cabinId,
    seatCode: base.seatCode,
    bookingType: base.bookingType,
    startDate,
    endDate,
    startTime: base.startTime,
    endTime: base.endTime,
  });

  const bookingCode = await generateBookingCode(companyId);
  const booking = await CoworkingBooking.create({
    ...base,
    companyId,
    bookingCode,
    startDate,
    endDate,
    recurrenceGroupId: recurrenceGroupId || null,
    createdBy: actingUser._id,
  });

  // seat.status is a single "right now" field — it cannot represent two
  // different future holds on the same seat at once, and it doesn't need
  // to: future availability is governed entirely by the date-overlap query
  // in coworkingAvailability.service.js. Only touch seat.status when this
  // occurrence actually covers today, i.e. it's the *current* hold, not a
  // booking for next month. Future-dated occurrences are picked up by
  // runExpiredBookingSweep once their startDate arrives.
  if (startDate <= new Date()) {
    const cabin = await CoworkingCabin.findOne({ _id: base.cabinId, companyId });
    const seatCodesToReserve = base.bookingType === "CABIN" ? cabin.seats.map((s) => s.seatCode) : [base.seatCode];
    for (const seatCode of seatCodesToReserve) {
      reserveSeat(cabin, seatCode, { clientId: base.clientId, label: base.clientLabel, assignedBy: actingUser._id });
    }
    await cabin.save();
  }

  await writeAuditLog({
    companyId,
    actor: actingUser,
    action: "BOOKING_CREATED",
    entityType: "CoworkingBooking",
    entityId: booking._id,
    metadata: { bookingCode, cabinId: String(base.cabinId), seatCode: base.seatCode, startDate, endDate },
  });

  return booking;
};

const createBooking = async ({ companyId, actingUser, payload }) => {
  const safe = await sanitizeCreatePayload(companyId, payload);
  const { clientLabel, isRecurring, recurrencePattern, recurrenceEndDate, ...base } = safe;
  base.clientLabel = clientLabel;

  if (!isRecurring) {
    const booking = await createSingleOccurrence({
      companyId,
      actingUser,
      base,
      startDate: safe.startDate,
      endDate: safe.endDate,
    });
    return { created: [booking], skipped: [] };
  }

  const spanMs = safe.endDate.getTime() - safe.startDate.getTime();
  const recurrenceGroupId = new mongoose.Types.ObjectId();
  const created = [];
  const skipped = [];

  let occurrenceStart = safe.startDate;
  let iterations = 0;
  while (occurrenceStart <= recurrenceEndDate && iterations < MAX_RECURRING_OCCURRENCES) {
    const occurrenceEnd = new Date(occurrenceStart.getTime() + spanMs);
    try {
      // eslint-disable-next-line no-await-in-loop
      const booking = await createSingleOccurrence({
        companyId,
        actingUser,
        base: { ...base, isRecurring: true, recurrencePattern },
        startDate: occurrenceStart,
        endDate: occurrenceEnd,
        recurrenceGroupId,
      });
      created.push(booking);
    } catch (error) {
      skipped.push({ startDate: occurrenceStart, endDate: occurrenceEnd, reason: error.message });
    }
    occurrenceStart = addInterval(occurrenceStart, recurrencePattern);
    iterations += 1;
  }

  if (created.length === 0) {
    throw createHttpError(409, "No occurrences could be booked — every date in the series conflicts");
  }

  return { created, skipped };
};

const listBookings = async ({ companyId, query = {} }) => {
  const { page, limit, skip } = parsePagination(query, { defaultLimit: 20, maxLimit: 100 });
  const filter = { companyId };

  if (query.status) {
    const status = String(query.status).trim().toUpperCase();
    if (!BOOKING_STATUSES.includes(status)) throw createHttpError(400, "Invalid status filter");
    filter.status = status;
  }
  if (query.clientId) filter.clientId = query.clientId;
  if (query.propertyId) filter.propertyId = query.propertyId;
  if (query.cabinId) filter.cabinId = query.cabinId;
  if (query.from || query.to) {
    filter.startDate = {};
    if (query.from) filter.startDate.$gte = parseDateOnly(query.from, "from");
    if (query.to) filter.startDate.$lte = parseDateOnly(query.to, "to");
  }

  const [rows, totalCount] = await Promise.all([
    CoworkingBooking.find(filter)
      .populate("clientId", "companyName")
      .populate("propertyId", "name")
      .populate("cabinId", "cabinCode")
      .sort({ startDate: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    CoworkingBooking.countDocuments(filter),
  ]);

  return { bookings: rows, pagination: buildPaginationMeta({ page, limit, totalCount }) };
};

const getBookingDoc = async (companyId, bookingId) => {
  if (!isValidObjectId(bookingId)) throw createHttpError(400, "Invalid booking id");
  const booking = await CoworkingBooking.findOne({ _id: bookingId, companyId });
  if (!booking) throw createHttpError(404, "Booking not found");
  return booking;
};

const getBookingById = async ({ companyId, bookingId }) => {
  if (!isValidObjectId(bookingId)) throw createHttpError(400, "Invalid booking id");
  const booking = await CoworkingBooking.findOne({ _id: bookingId, companyId })
    .populate("clientId", "companyName contactPerson phone email")
    .populate("propertyId", "name")
    .populate("floorId", "floorNumber name")
    .populate("cabinId", "cabinCode")
    .lean();
  if (!booking) throw createHttpError(404, "Booking not found");
  return booking;
};

const updateBooking = async ({ companyId, bookingId, payload, actingUser }) => {
  const booking = await getBookingDoc(companyId, bookingId);
  const safe = {};

  for (const field of BOOKING_ALLOWED_UPDATE_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(payload, field)) continue;
    if (field === "notes") {
      safe.notes = String(payload.notes || "").trim().slice(0, 2000);
    } else {
      const value = Number(payload[field]);
      if (!Number.isFinite(value) || value < 0) throw createHttpError(400, `${field} must be a non-negative number`);
      safe[field] = value;
    }
  }
  if (Object.keys(safe).length === 0) throw createHttpError(400, "No valid fields to update");

  Object.assign(booking, safe, { updatedBy: actingUser._id });
  await booking.save();

  await writeAuditLog({
    companyId,
    actor: actingUser,
    action: "BOOKING_UPDATED",
    entityType: "CoworkingBooking",
    entityId: booking._id,
    metadata: { changes: safe },
  });

  return booking;
};

// Releases the seat(s) this booking is holding, if it's still the one
// holding them (a cancelled/expired/completed booking should never release
// a seat that a *later* booking or walk-in has since claimed).
const releaseBookingSeats = async (companyId, booking) => {
  const cabin = await CoworkingCabin.findOne({ _id: booking.cabinId, companyId });
  if (!cabin) return;

  const seatCodes = booking.bookingType === "CABIN" ? cabin.seats.map((s) => s.seatCode) : [booking.seatCode];
  let changed = false;
  for (const seatCode of seatCodes) {
    const seat = cabin.seats.find((row) => row.seatCode === seatCode);
    if (seat && ["RESERVED", "OCCUPIED"].includes(seat.status) && String(seat.assignedTo?.clientId || "") === String(booking.clientId)) {
      releaseSeat(cabin, seatCode);
      changed = true;
    }
  }
  if (changed) await cabin.save();
};

const transitionBooking = (fromStatuses, toStatus, auditAction, seatEffect) => async ({
  companyId,
  bookingId,
  actingUser,
  ...rest
}) => {
  const booking = await getBookingDoc(companyId, bookingId);
  if (!fromStatuses.includes(booking.status)) {
    throw createHttpError(409, `Booking is ${booking.status}, expected one of ${fromStatuses.join(", ")}`);
  }

  if (seatEffect) {
    await seatEffect({ companyId, booking, actingUser, ...rest });
  }

  booking.status = toStatus;
  booking.updatedBy = actingUser._id;
  if (toStatus === "CANCELLED") {
    booking.cancelledAt = new Date();
    booking.cancelledReason = String(rest.reason || "").trim().slice(0, 500);
  }
  await booking.save();

  await writeAuditLog({
    companyId,
    actor: actingUser,
    action: auditAction,
    entityType: "CoworkingBooking",
    entityId: booking._id,
    metadata: { bookingCode: booking.bookingCode, from: fromStatuses, to: toStatus },
  });

  return booking;
};

const confirmBooking = transitionBooking(["PENDING"], "CONFIRMED", "BOOKING_CONFIRMED");

const activateBooking = transitionBooking(["CONFIRMED", "PENDING"], "ACTIVE", "BOOKING_ACTIVATED", async ({ companyId, booking, actingUser }) => {
  const cabin = await CoworkingCabin.findOne({ _id: booking.cabinId, companyId });
  if (!cabin) throw createHttpError(404, "Cabin not found");
  const seatCodes = booking.bookingType === "CABIN" ? cabin.seats.map((s) => s.seatCode) : [booking.seatCode];
  for (const seatCode of seatCodes) {
    // allowReservedTransition: true — this booking is checking in the exact
    // reservation it holds; nothing else could have set the seat to
    // RESERVED in the meantime (reserveSeat only accepts from AVAILABLE).
    assignSeat(cabin, seatCode, {
      clientId: booking.clientId,
      label: "",
      assignedBy: actingUser._id,
      allowReservedTransition: true,
    });
  }
  await cabin.save();
});

const completeBooking = transitionBooking(["ACTIVE"], "COMPLETED", "BOOKING_COMPLETED", async ({ companyId, booking, actualEndDate }) => {
  if (actualEndDate) {
    const parsed = parseDateOnly(actualEndDate, "actualEndDate");
    if (parsed < booking.startDate) throw createHttpError(400, "actualEndDate cannot be before startDate");
    booking.endDate = parsed;
  }
  await releaseBookingSeats(companyId, booking);
});

const cancelBooking = transitionBooking(["PENDING", "CONFIRMED", "ACTIVE"], "CANCELLED", "BOOKING_CANCELLED", async ({ companyId, booking }) => {
  await releaseBookingSeats(companyId, booking);
});

const markNoShow = transitionBooking(["PENDING", "CONFIRMED"], "NO_SHOW", "BOOKING_NO_SHOW", async ({ companyId, booking }) => {
  await releaseBookingSeats(companyId, booking);
});

const extendBooking = async ({ companyId, bookingId, newEndDate, actingUser }) => {
  const booking = await getBookingDoc(companyId, bookingId);
  if (!["CONFIRMED", "ACTIVE"].includes(booking.status)) {
    throw createHttpError(409, "Only a CONFIRMED or ACTIVE booking can be extended");
  }

  const parsedEndDate = parseDateOnly(newEndDate, "newEndDate");
  if (parsedEndDate <= booking.endDate) {
    throw createHttpError(400, "newEndDate must be after the current endDate");
  }

  const conflicts = await findConflictingBookings({
    companyId,
    cabinId: booking.cabinId,
    seatCode: booking.seatCode,
    bookingType: booking.bookingType,
    startDate: booking.startDate,
    endDate: parsedEndDate,
    startTime: booking.startTime,
    endTime: booking.endTime,
    excludeBookingId: booking._id,
  });
  if (conflicts.length > 0) {
    throw createHttpError(409, "The extended range conflicts with another booking");
  }

  booking.endDate = parsedEndDate;
  booking.updatedBy = actingUser._id;
  await booking.save();

  await writeAuditLog({
    companyId,
    actor: actingUser,
    action: "BOOKING_EXTENDED",
    entityType: "CoworkingBooking",
    entityId: booking._id,
    metadata: { bookingCode: booking.bookingCode, newEndDate: parsedEndDate },
  });

  return booking;
};

// Two jobs in one sweep, mirroring attendance.controller.js's
// runAutoCheckoutSweep pattern (wired into server.js the same way):
//  1. Reserve the seat for PENDING/CONFIRMED bookings whose startDate has
//     now arrived — createSingleOccurrence deliberately skips this at
//     creation time for future-dated bookings (see the comment there), so
//     this is where "future" becomes "current".
//  2. Auto-complete + release ACTIVE bookings whose endDate has passed.
const runExpiredBookingSweep = async () => {
  const now = new Date();

  const due = await CoworkingBooking.find({
    status: { $in: ["PENDING", "CONFIRMED"] },
    startDate: { $lte: now },
    endDate: { $gte: now },
  });

  let reservedCount = 0;
  for (const booking of due) {
    // eslint-disable-next-line no-await-in-loop
    const cabin = await CoworkingCabin.findOne({ _id: booking.cabinId, companyId: booking.companyId });
    if (!cabin) continue;
    const seatCodes = booking.bookingType === "CABIN" ? cabin.seats.map((s) => s.seatCode) : [booking.seatCode];
    let changed = false;
    for (const seatCode of seatCodes) {
      const seat = cabin.seats.find((row) => row.seatCode === seatCode);
      if (seat && seat.status === "AVAILABLE") {
        reserveSeat(cabin, seatCode, { clientId: booking.clientId, label: "", assignedBy: booking.createdBy });
        changed = true;
      }
    }
    if (changed) {
      // eslint-disable-next-line no-await-in-loop
      await cabin.save();
      reservedCount += 1;
    }
  }

  const expired = await CoworkingBooking.find({
    status: "ACTIVE",
    endDate: { $lt: now },
  });

  let completedCount = 0;
  for (const booking of expired) {
    // eslint-disable-next-line no-await-in-loop
    await releaseBookingSeats(booking.companyId, booking);
    booking.status = "COMPLETED";
    // eslint-disable-next-line no-await-in-loop
    await booking.save();
    completedCount += 1;
  }

  return reservedCount + completedCount;
};

module.exports = {
  generateBookingCode,
  createBooking,
  listBookings,
  getBookingById,
  updateBooking,
  confirmBooking,
  activateBooking,
  completeBooking,
  cancelBooking,
  markNoShow,
  extendBooking,
  runExpiredBookingSweep,
};
