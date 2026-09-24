const PROPERTY_STATUSES = Object.freeze(["ACTIVE", "INACTIVE"]);

const FLOOR_STATUSES = Object.freeze(["ACTIVE", "INACTIVE"]);

// BLOCKED/MAINTENANCE are manual overrides; AVAILABLE/PARTIALLY_OCCUPIED/
// FULLY_OCCUPIED are always derived from seat state — see
// services/coworkingOccupancy.service.js, the single source of truth for
// this derivation (never computed ad hoc elsewhere).
const CABIN_STATUSES = Object.freeze([
  "AVAILABLE",
  "PARTIALLY_OCCUPIED",
  "FULLY_OCCUPIED",
  "BLOCKED",
  "MAINTENANCE",
]);

// Internal override flag stored on the cabin; CABIN_STATUSES above is the
// user-facing computed status derived from this + seat state.
const CABIN_MANUAL_OVERRIDES = Object.freeze(["NONE", "BLOCKED", "MAINTENANCE"]);

const SEAT_STATUSES = Object.freeze([
  "AVAILABLE",
  "RESERVED",
  "OCCUPIED",
  "BLOCKED",
  "MAINTENANCE",
]);

const CABIN_CAPACITY_PRESETS = Object.freeze([4, 6, 8, 10, 12, "CUSTOM"]);
const MIN_CABIN_CAPACITY = 1;
const MAX_CABIN_CAPACITY = 100;

const CABIN_TYPES = Object.freeze([
  "PRIVATE",
  "SHARED",
  "MANAGER_CABIN",
  "MEETING_POD",
  "OTHER",
]);

const CABIN_AMENITIES = Object.freeze([
  "AC",
  "WHITEBOARD",
  "TV_SCREEN",
  "STORAGE_CABINET",
  "POWER_BACKUP",
  "WINDOW_VIEW",
  "PHONE_BOOTH",
  "ERGONOMIC_CHAIRS",
]);

const PROPERTY_ALLOWED_FIELDS = Object.freeze([
  "name",
  "status",
  "managerId",
  "address",
  "contact",
  "description",
]);

const FLOOR_ALLOWED_FIELDS = Object.freeze([
  "propertyId",
  "floorNumber",
  "name",
  "status",
]);

const CABIN_CREATE_ALLOWED_FIELDS = Object.freeze([
  "propertyId",
  "floorId",
  "name",
  "cabinType",
  "capacityPreset",
  "customCapacity",
  "monthlyRent",
  "securityDeposit",
  "description",
  "amenities",
]);

// Capacity is intentionally excluded from the update whitelist — changing
// seat count after seats exist/are assigned means either destroying
// occupancy state or reconciling it, which is out of scope for this phase.
const CABIN_UPDATE_ALLOWED_FIELDS = Object.freeze([
  "name",
  "cabinType",
  "monthlyRent",
  "securityDeposit",
  "description",
  "amenities",
]);

const resolveCabinCapacity = (capacityPreset, customCapacity) => {
  if (capacityPreset === "CUSTOM") {
    return Number(customCapacity);
  }
  return Number(capacityPreset);
};

module.exports = {
  PROPERTY_STATUSES,
  FLOOR_STATUSES,
  CABIN_STATUSES,
  CABIN_MANUAL_OVERRIDES,
  SEAT_STATUSES,
  CABIN_CAPACITY_PRESETS,
  MIN_CABIN_CAPACITY,
  MAX_CABIN_CAPACITY,
  CABIN_TYPES,
  CABIN_AMENITIES,
  PROPERTY_ALLOWED_FIELDS,
  FLOOR_ALLOWED_FIELDS,
  CABIN_CREATE_ALLOWED_FIELDS,
  CABIN_UPDATE_ALLOWED_FIELDS,
  resolveCabinCapacity,
};
