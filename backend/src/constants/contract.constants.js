const CONTRACT_STATUSES = Object.freeze(["DRAFT", "ACTIVE", "EXPIRING", "EXPIRED", "TERMINATED"]);

const CONTRACT_TYPES = Object.freeze(["CABIN", "SEAT"]);

const DOCUMENT_CATEGORIES = Object.freeze(["AGREEMENT", "ADDENDUM", "ID_PROOF", "POLICE_VERIFICATION", "OTHER"]);

// A contract enters EXPIRING once its endDate is within this many days —
// computed by the same sweep pattern as attendance/booking, never stored as
// a manually-set value.
const EXPIRING_WINDOW_DAYS = 30;

const CONTRACT_ALLOWED_CREATE_FIELDS = Object.freeze([
  "clientId",
  "propertyId",
  "floorId",
  "cabinId",
  "seatCode",
  "contractType",
  "startDate",
  "endDate",
  "rent",
  "deposit",
  "tokenAmount",
  "securityCheque",
  "lockInPeriodMonths",
  "noticePeriodDays",
  "notes",
]);

const CONTRACT_ALLOWED_UPDATE_FIELDS = Object.freeze(["rent", "deposit", "tokenAmount", "securityCheque", "lockInPeriodMonths", "noticePeriodDays", "notes"]);

module.exports = {
  CONTRACT_STATUSES,
  CONTRACT_TYPES,
  DOCUMENT_CATEGORIES,
  EXPIRING_WINDOW_DAYS,
  CONTRACT_ALLOWED_CREATE_FIELDS,
  CONTRACT_ALLOWED_UPDATE_FIELDS,
};
