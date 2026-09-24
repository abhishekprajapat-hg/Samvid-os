const { createHttpError } = require("../utils/httpError");

// Single source of truth for seat-naming, cabin/seat status derivation, and
// seat lifecycle transitions. Every write path (direct cabin creation, seat
// assignment, seat release, blocking, maintenance) goes through these pure
// functions so occupancy logic is never duplicated or reimplemented
// per-endpoint. Functions here take/return plain data (or mutate a passed-in
// Mongoose subdocument) and never touch the database themselves — callers
// (services/cabin.service.js, services/seat.service.js) own persistence.

const pad2 = (value) => String(value).padStart(2, "0");

const buildSeatCode = (cabinCode, seatNumber) => `${cabinCode}-S${pad2(seatNumber)}`;

// Generates the seats for a brand-new cabin. This is the only place seat
// codes/numbers are minted — never derive them ad hoc elsewhere.
const generateSeatsForCabin = (cabinCode, capacity) => {
  const seats = [];
  for (let seatNumber = 1; seatNumber <= capacity; seatNumber += 1) {
    seats.push({
      seatCode: buildSeatCode(cabinCode, seatNumber),
      seatNumber,
      status: "AVAILABLE",
      assignedTo: null,
    });
  }
  return seats;
};

// Cabin status is always derived — BLOCKED/MAINTENANCE are manual overrides
// that take precedence over seat state; otherwise it's computed from how
// many seats are unavailable to a new occupant.
const deriveCabinStatus = (manualOverride, seats) => {
  if (manualOverride === "BLOCKED") return "BLOCKED";
  if (manualOverride === "MAINTENANCE") return "MAINTENANCE";

  const total = seats.length;
  if (total === 0) return "AVAILABLE";

  const unavailable = seats.filter((seat) =>
    ["OCCUPIED", "RESERVED", "BLOCKED", "MAINTENANCE"].includes(seat.status),
  ).length;

  if (unavailable === 0) return "AVAILABLE";
  if (unavailable >= total) return "FULLY_OCCUPIED";
  return "PARTIALLY_OCCUPIED";
};

const findSeat = (cabin, seatCode) => {
  const seat = cabin.seats.find((row) => row.seatCode === seatCode);
  if (!seat) {
    throw createHttpError(404, `Seat ${seatCode} not found on this cabin`);
  }
  return seat;
};

const assertCabinBookable = (cabin) => {
  if (cabin.manualOverride === "BLOCKED") {
    throw createHttpError(409, "This cabin is blocked and cannot be booked");
  }
  if (cabin.manualOverride === "MAINTENANCE") {
    throw createHttpError(409, "This cabin is under maintenance and cannot be booked");
  }
};

// A seat can always move from AVAILABLE to OCCUPIED. The RESERVED ->
// OCCUPIED transition is narrower: RESERVED means some *booking* is holding
// the seat, and only that booking checking itself in is allowed to convert
// its own hold into occupancy (coworkingBooking.service.js#activateBooking
// passes allowReservedTransition: true). Phase 3's direct walk-in assign and
// Contract activation must NOT be able to walk in and silently steal a seat
// someone else's booking has reserved — they default to AVAILABLE-only.
const assignSeat = (cabin, seatCode, { clientId, label, assignedBy, allowReservedTransition = false }) => {
  assertCabinBookable(cabin);
  const seat = findSeat(cabin, seatCode);
  const assignableFromStatuses = allowReservedTransition ? ["AVAILABLE", "RESERVED"] : ["AVAILABLE"];

  if (!assignableFromStatuses.includes(seat.status)) {
    throw createHttpError(
      409,
      `Seat ${seatCode} is ${seat.status.toLowerCase()} and cannot be assigned`,
    );
  }

  seat.status = "OCCUPIED";
  seat.assignedTo = {
    clientId: clientId || null,
    label: String(label || "").trim().slice(0, 120),
    assignedAt: new Date(),
    assignedBy,
  };

  cabin.status = deriveCabinStatus(cabin.manualOverride, cabin.seats);
  return seat;
};

// Booking-driven hold on a seat (PENDING/CONFIRMED booking) — distinct from
// assignSeat's OCCUPIED (an active, checked-in occupant). Only a currently
// AVAILABLE seat can be reserved.
const reserveSeat = (cabin, seatCode, { clientId, label, assignedBy }) => {
  assertCabinBookable(cabin);
  const seat = findSeat(cabin, seatCode);

  if (seat.status !== "AVAILABLE") {
    throw createHttpError(
      409,
      `Seat ${seatCode} is ${seat.status.toLowerCase()} and cannot be reserved`,
    );
  }

  seat.status = "RESERVED";
  seat.assignedTo = {
    clientId: clientId || null,
    label: String(label || "").trim().slice(0, 120),
    assignedAt: new Date(),
    assignedBy,
  };

  cabin.status = deriveCabinStatus(cabin.manualOverride, cabin.seats);
  return seat;
};

const releaseSeat = (cabin, seatCode) => {
  const seat = findSeat(cabin, seatCode);

  if (seat.status !== "OCCUPIED" && seat.status !== "RESERVED") {
    throw createHttpError(409, `Seat ${seatCode} is not currently assigned`);
  }

  seat.status = "AVAILABLE";
  seat.assignedTo = null;

  cabin.status = deriveCabinStatus(cabin.manualOverride, cabin.seats);
  return seat;
};

const setSeatStatus = (cabin, seatCode, nextStatus) => {
  const seat = findSeat(cabin, seatCode);

  if (["OCCUPIED", "RESERVED"].includes(seat.status) && ["BLOCKED", "MAINTENANCE"].includes(nextStatus)) {
    throw createHttpError(409, `Seat ${seatCode} is currently assigned — release it first`);
  }

  seat.status = nextStatus;
  if (nextStatus === "AVAILABLE") {
    seat.assignedTo = null;
  }

  cabin.status = deriveCabinStatus(cabin.manualOverride, cabin.seats);
  return seat;
};

const setCabinManualOverride = (cabin, override) => {
  const hasActiveSeats = cabin.seats.some((seat) => ["OCCUPIED", "RESERVED"].includes(seat.status));
  if (override !== "NONE" && hasActiveSeats) {
    throw createHttpError(
      409,
      "Cannot block/maintenance a cabin with occupied or reserved seats — release them first",
    );
  }

  cabin.manualOverride = override;
  cabin.status = deriveCabinStatus(cabin.manualOverride, cabin.seats);
};

module.exports = {
  buildSeatCode,
  generateSeatsForCabin,
  deriveCabinStatus,
  assertCabinBookable,
  assignSeat,
  reserveSeat,
  releaseSeat,
  setSeatStatus,
  setCabinManualOverride,
};
