const BOOKING_STATUSES = Object.freeze([
  "PENDING",
  "CONFIRMED",
  "ACTIVE",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
]);

// Statuses that occupy the calendar and must be checked for overlap /
// reflected in seat.status — the other statuses (COMPLETED/CANCELLED/
// NO_SHOW) are terminal and never block anything.
const ACTIVE_BLOCKING_STATUSES = Object.freeze(["PENDING", "CONFIRMED", "ACTIVE"]);
const TERMINAL_STATUSES = Object.freeze(["COMPLETED", "CANCELLED", "NO_SHOW"]);

const BOOKING_TYPES = Object.freeze(["CABIN", "SEAT"]);

const RECURRENCE_PATTERNS = Object.freeze(["NONE", "DAILY", "WEEKLY", "MONTHLY"]);
const MAX_RECURRING_OCCURRENCES = 52;

const BOOKING_ALLOWED_CREATE_FIELDS = Object.freeze([
  "clientId",
  "propertyId",
  "floorId",
  "cabinId",
  "seatId",
  "bookingType",
  "startDate",
  "endDate",
  "startTime",
  "endTime",
  "price",
  "deposit",
  "notes",
  "isRecurring",
  "recurrencePattern",
  "recurrenceEndDate",
]);

// Reassigning the resource or client after creation would bypass the
// availability check that ran at creation time — those fields are
// intentionally immutable; use cancel + recreate instead.
const BOOKING_ALLOWED_UPDATE_FIELDS = Object.freeze(["price", "deposit", "notes"]);

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

module.exports = {
  BOOKING_STATUSES,
  ACTIVE_BLOCKING_STATUSES,
  TERMINAL_STATUSES,
  BOOKING_TYPES,
  RECURRENCE_PATTERNS,
  MAX_RECURRING_OCCURRENCES,
  BOOKING_ALLOWED_CREATE_FIELDS,
  BOOKING_ALLOWED_UPDATE_FIELDS,
  TIME_PATTERN,
};
