const CoworkingBooking = require("../models/CoworkingBooking");
const CoworkingCabin = require("../models/CoworkingCabin");
const { ACTIVE_BLOCKING_STATUSES } = require("../constants/booking.constants");
const { createHttpError } = require("../utils/httpError");

// ============================================================================
// Centralized availability engine. Every path that can create/move/extend a
// booking — createBooking, updateBooking's date changes, extendBooking, the
// availability-calendar/list endpoints — MUST route through this module.
// Nothing else is allowed to hand-roll an overlap check.
// ============================================================================

const toDateOnly = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
};

// Two bookings conflict if their date ranges overlap. If BOTH are single-day
// bookings with explicit start/end times, we narrow to a time-of-day overlap
// check instead — a full-day/multi-day booking on either side always blocks
// the whole day (partial-day carve-outs across a multi-day range are out of
// scope; documented simplification).
const rangesOverlap = (aStart, aEnd, bStart, bEnd) => aStart <= bEnd && aEnd >= bStart;

const isSameDayTimedBooking = (booking) =>
  toDateOnly(booking.startDate).getTime() === toDateOnly(booking.endDate).getTime() &&
  Boolean(booking.startTime) &&
  Boolean(booking.endTime);

const bookingsConflict = (existing, proposed) => {
  const existingStart = toDateOnly(existing.startDate);
  const existingEnd = toDateOnly(existing.endDate);
  const proposedStart = toDateOnly(proposed.startDate);
  const proposedEnd = toDateOnly(proposed.endDate);

  if (!rangesOverlap(existingStart, existingEnd, proposedStart, proposedEnd)) {
    return false;
  }

  if (isSameDayTimedBooking(existing) && isSameDayTimedBooking(proposed) && existingStart.getTime() === proposedStart.getTime()) {
    return existing.startTime < proposed.endTime && existing.endTime > proposed.startTime;
  }

  // At least one side spans a full day (or the whole range) — the date
  // overlap alone is enough to conflict.
  return true;
};

// Bookings that could conflict with a proposed SEAT/CABIN booking on this
// cabin: a CABIN booking touches every seat, so it conflicts with anything;
// a SEAT booking only conflicts with the same seatCode or a CABIN booking.
const findConflictingBookings = async ({
  companyId,
  cabinId,
  seatCode,
  bookingType,
  startDate,
  endDate,
  startTime,
  endTime,
  excludeBookingId,
}) => {
  const filter = {
    companyId,
    cabinId,
    status: { $in: ACTIVE_BLOCKING_STATUSES },
    startDate: { $lte: endDate },
    endDate: { $gte: startDate },
  };
  if (excludeBookingId) filter._id = { $ne: excludeBookingId };

  if (bookingType === "SEAT") {
    filter.$or = [{ bookingType: "CABIN" }, { bookingType: "SEAT", seatCode }];
  }
  // bookingType === "CABIN" conflicts with anything touching this cabin —
  // no extra filter needed beyond cabinId + status + date overlap.

  const candidates = await CoworkingBooking.find(filter).lean();
  const proposed = { startDate, endDate, startTime, endTime };

  return candidates.filter((existing) => bookingsConflict(existing, proposed));
};

// Phase 3's occupancy layer is still the source of truth for "is this seat
// occupied / blocked / under maintenance right now" — a booking can never
// override that regardless of dates. This must refuse OCCUPIED
// unconditionally: the occupant could be a walk-in assignment, an ACTIVE
// contract, or a checked-in booking — none of those have a Booking record
// this module's date-overlap query would otherwise catch (contracts
// especially: activateContract never creates a Booking row), so the seat's
// live status is the only signal available for those cases.
const assertSeatNotManuallyUnavailable = (cabin, seatCode) => {
  const seat = cabin.seats.find((row) => row.seatCode === seatCode);
  if (!seat) throw createHttpError(404, `Seat ${seatCode} not found on this cabin`);
  if (["BLOCKED", "MAINTENANCE"].includes(seat.status)) {
    throw createHttpError(409, `Seat ${seatCode} is ${seat.status.toLowerCase()} and cannot be booked`);
  }
  if (seat.status === "OCCUPIED") {
    throw createHttpError(409, `Seat ${seatCode} is currently occupied and cannot be booked`);
  }
};

const assertCabinBookable = (cabin) => {
  if (cabin.manualOverride === "BLOCKED") {
    throw createHttpError(409, "This cabin is blocked and cannot be booked");
  }
  if (cabin.manualOverride === "MAINTENANCE") {
    throw createHttpError(409, "This cabin is under maintenance and cannot be booked");
  }
};

const assertAvailable = async ({
  companyId,
  cabinId,
  seatCode,
  bookingType,
  startDate,
  endDate,
  startTime,
  endTime,
  excludeBookingId,
}) => {
  const cabin = await CoworkingCabin.findOne({ _id: cabinId, companyId }).lean();
  if (!cabin) throw createHttpError(404, "Cabin not found");

  assertCabinBookable(cabin);
  if (bookingType === "SEAT") {
    assertSeatNotManuallyUnavailable(cabin, seatCode);
  } else {
    cabin.seats.forEach((seat) => assertSeatNotManuallyUnavailable(cabin, seat.seatCode));
  }

  const conflicts = await findConflictingBookings({
    companyId,
    cabinId,
    seatCode,
    bookingType,
    startDate,
    endDate,
    startTime,
    endTime,
    excludeBookingId,
  });

  if (conflicts.length > 0) {
    throw createHttpError(
      409,
      bookingType === "CABIN"
        ? "This cabin has one or more conflicting bookings for the selected dates"
        : `Seat ${seatCode} is already booked for one or more of the selected dates`,
    );
  }

  return cabin;
};

// For the "cabin availability" / "seat availability" list features — which
// seats/cabins in a property (optionally scoped to a floor) are free for a
// given date range, right now, factoring in both manual status and existing
// bookings.
const listAvailableSeats = async ({ companyId, propertyId, floorId, startDate, endDate, startTime, endTime }) => {
  const filter = { companyId, propertyId };
  if (floorId) filter.floorId = floorId;

  const cabins = await CoworkingCabin.find(filter)
    .populate("floorId", "floorNumber name")
    .lean();

  const results = [];
  for (const cabin of cabins) {
    if (cabin.manualOverride !== "NONE") continue;

    for (const seat of cabin.seats) {
      if (["BLOCKED", "MAINTENANCE"].includes(seat.status)) continue;
      if (seat.status === "OCCUPIED") continue;

      // eslint-disable-next-line no-await-in-loop
      const conflicts = await findConflictingBookings({
        companyId,
        cabinId: cabin._id,
        seatCode: seat.seatCode,
        bookingType: "SEAT",
        startDate,
        endDate,
        startTime,
        endTime,
      });
      if (conflicts.length === 0) {
        results.push({
          cabinId: cabin._id,
          cabinCode: cabin.cabinCode,
          floor: cabin.floorId,
          seatCode: seat.seatCode,
        });
      }
    }
  }

  return results;
};

const listAvailableCabins = async ({ companyId, propertyId, floorId, startDate, endDate }) => {
  const filter = { companyId, propertyId };
  if (floorId) filter.floorId = floorId;

  const cabins = await CoworkingCabin.find(filter)
    .populate("floorId", "floorNumber name")
    .lean();

  const results = [];
  for (const cabin of cabins) {
    if (cabin.manualOverride !== "NONE") continue;
    if (cabin.seats.some((seat) => ["OCCUPIED", "BLOCKED", "MAINTENANCE"].includes(seat.status))) continue;

    // eslint-disable-next-line no-await-in-loop
    const conflicts = await findConflictingBookings({
      companyId,
      cabinId: cabin._id,
      bookingType: "CABIN",
      startDate,
      endDate,
    });
    if (conflicts.length === 0) {
      results.push({ cabinId: cabin._id, cabinCode: cabin.cabinCode, floor: cabin.floorId, capacity: cabin.capacity });
    }
  }

  return results;
};

const getCabinBookingCalendar = async ({ companyId, cabinId, from, to }) =>
  CoworkingBooking.find({
    companyId,
    cabinId,
    status: { $in: ACTIVE_BLOCKING_STATUSES },
    startDate: { $lte: to },
    endDate: { $gte: from },
  })
    .select("bookingCode clientId seatCode bookingType startDate endDate startTime endTime status")
    .populate("clientId", "companyName")
    .sort({ startDate: 1 })
    .lean();

module.exports = {
  bookingsConflict,
  findConflictingBookings,
  assertAvailable,
  listAvailableSeats,
  listAvailableCabins,
  getCabinBookingCalendar,
};
