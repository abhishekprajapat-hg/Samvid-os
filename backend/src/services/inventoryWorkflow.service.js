const mongoose = require("mongoose");
const Inventory = require("../models/Inventory");
const InventoryRequest = require("../models/InventoryRequest");
const InventoryActivity = require("../models/InventoryActivity");
const Lead = require("../models/Lead");
const LeadDiary = require("../models/leadDiary.model");
const LeadActivity = require("../models/leadActivity.model");
const User = require("../models/User");
const {
  USER_ROLES,
  EXECUTIVE_ROLES,
  MANAGEMENT_ROLES,
  isManagementRole,
} = require("../constants/role.constants");
const {
  INVENTORY_STATUSES,
  INVENTORY_TYPES,
  INVENTORY_SALE_PAYMENT_MODES,
  INVENTORY_SALE_PAYMENT_TYPES,
  INVENTORY_ALLOWED_FIELDS,
  INVENTORY_REQUIRED_CREATE_FIELDS,
  INVENTORY_ACTIVITY_ACTIONS,
} = require("../constants/inventory.constants");
const {
  notifyRequestCreated,
  notifyRequestReviewed,
} = require("./inventoryNotification.service");

const REQUEST_STATUS_PENDING = "pending";
const REQUEST_STATUS_APPROVED = "approved";
const REQUEST_STATUS_REJECTED = "rejected";
const MAX_SALE_PAYMENT_NOTE_LENGTH = 1000;
const MAX_SALE_PAYMENT_REFERENCE_LENGTH = 120;
const MAX_INVENTORY_REQUEST_NOTE_LENGTH = 500;
const DEFAULT_SITE_VISIT_RADIUS_METERS =
  Number.parseInt(process.env.SITE_VISIT_RADIUS_METERS, 10) || 200;
const INVENTORY_CREATE_REQUEST_ROLES = Object.freeze([
  USER_ROLES.ADMIN,
  ...MANAGEMENT_ROLES,
  USER_ROLES.EXECUTIVE,
  USER_ROLES.FIELD_EXECUTIVE,
  USER_ROLES.CHANNEL_PARTNER,
]);
const INVENTORY_UPDATE_REQUEST_ROLES = Object.freeze([
  USER_ROLES.ADMIN,
  ...MANAGEMENT_ROLES,
  USER_ROLES.EXECUTIVE,
  USER_ROLES.FIELD_EXECUTIVE,
]);
const INVENTORY_TYPE_OPTIONS = Object.freeze(["COMMERCIAL", "RESIDENTIAL"]);
const FURNISHING_STATUS_OPTIONS = Object.freeze([
  "",
  "UNFURNISHED",
  "SEMI_FURNISHED",
  "FULLY_FURNISHED",
  "BARE_SHELL",
  "WARM_SHELL",
  "MANAGED_OFFICE",
  "COWORKING",
]);
const AREA_UNIT_OPTIONS = Object.freeze(["SQ_FT", "SQ_M"]);
const COMMERCIAL_OFFICE_TYPES = Object.freeze([
  "",
  "BARE_SHELL",
  "WARM_SHELL",
  "SEMI_FURNISHED",
  "FULLY_FURNISHED",
  "MANAGED_OFFICE",
  "COWORKING",
]);
const COMMERCIAL_WASHROOM_TYPES = Object.freeze(["", "ATTACHED", "COMMON", "BOTH"]);
const COMMERCIAL_PARKING_TYPES = Object.freeze(["", "NONE", "COVERED", "OPEN", "BOTH"]);
const COMMERCIAL_SECURITY_TYPES = Object.freeze(["", "NONE", "SECURITY_24X7", "CCTV", "BOTH"]);
const RESIDENTIAL_PROPERTY_TYPES = Object.freeze([
  "",
  "FLAT",
  "VILLA",
  "BUILDER_FLOOR",
  "PLOT",
  "OTHER",
]);
const RESIDENTIAL_BHK_TYPES = Object.freeze([
  "",
  "1BHK",
  "2BHK",
  "3BHK",
  "4BHK",
  "5BHK",
  "STUDIO",
  "OTHER",
]);
const RESIDENTIAL_WATER_SUPPLY_TYPES = Object.freeze([
  "",
  "MUNICIPAL",
  "BOREWELL",
  "TANKER",
  "BOTH",
  "OTHER",
]);

const createHttpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const isSafeKey = (key) =>
  typeof key === "string"
  && key.length > 0
  && !key.startsWith("$")
  && !key.includes(".");

const sanitizeString = (value) => {
  if (typeof value !== "string") return "";
  return value.trim();
};

const sanitizeCappedString = (value, maxLength = 200) =>
  sanitizeString(value).slice(0, Math.max(1, maxLength));

const toBoolean = (value, fallback = false) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;

  const normalized = sanitizeString(value).toLowerCase();
  if (!normalized) return fallback;
  if (["true", "1", "yes", "y"].includes(normalized)) return true;
  if (["false", "0", "no", "n"].includes(normalized)) return false;
  return fallback;
};

const parseBooleanQuery = (value) => {
  const normalized = sanitizeString(value).toLowerCase();
  if (!normalized) return null;
  if (["true", "1", "yes", "y"].includes(normalized)) return true;
  if (["false", "0", "no", "n"].includes(normalized)) return false;
  return null;
};

const toUpperSnake = (value) =>
  sanitizeString(value)
    .replace(/[\s-]+/g, "_")
    .toUpperCase();

const sanitizeEnum = (value, allowed, label) => {
  const normalized = toUpperSnake(value);
  if (!allowed.includes(normalized)) {
    throw createHttpError(400, `${label} is invalid`);
  }
  return normalized;
};

const sanitizeReservationReason = (value) => sanitizeString(value).slice(0, 300);

const toObjectIdString = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "object" && value._id) return String(value._id).trim();
  return String(value).trim();
};

const normalizeSalePaymentMode = (value) => sanitizeString(value).toUpperCase();
const normalizeSalePaymentType = (value) => sanitizeString(value).toUpperCase();

const sanitizeSaleDetails = (value) => {
  if (value === null) return null;

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw createHttpError(400, "saleDetails must be an object");
  }

  const leadId = toObjectIdString(value.leadId);
  if (!leadId || !isValidObjectId(leadId)) {
    throw createHttpError(400, "saleDetails.leadId must be a valid lead id");
  }

  const paymentMode = normalizeSalePaymentMode(value.paymentMode);
  if (!INVENTORY_SALE_PAYMENT_MODES.includes(paymentMode)) {
    throw createHttpError(
      400,
      `saleDetails.paymentMode must be one of: ${INVENTORY_SALE_PAYMENT_MODES.join(", ")}`,
    );
  }

  const paymentType = normalizeSalePaymentType(value.paymentType);
  if (!INVENTORY_SALE_PAYMENT_TYPES.includes(paymentType)) {
    throw createHttpError(
      400,
      `saleDetails.paymentType must be one of: ${INVENTORY_SALE_PAYMENT_TYPES.join(", ")}`,
    );
  }

  const totalAmount = toFiniteNumber(value.totalAmount);
  if (totalAmount === null || totalAmount <= 0) {
    throw createHttpError(400, "saleDetails.totalAmount must be greater than 0");
  }

  let remainingAmount = 0;
  if (paymentType === "PARTIAL") {
    remainingAmount = toFiniteNumber(value.remainingAmount);
    if (remainingAmount === null || remainingAmount <= 0) {
      throw createHttpError(
        400,
        "saleDetails.remainingAmount must be greater than 0 for partial payment",
      );
    }
  }

  const paymentReference = sanitizeString(value.paymentReference).slice(0, MAX_SALE_PAYMENT_REFERENCE_LENGTH);
  if (paymentMode !== "CASH" && !paymentReference) {
    throw createHttpError(
      400,
      "saleDetails.paymentReference is required for non-cash payments",
    );
  }

  const note = sanitizeString(value.note).slice(0, MAX_SALE_PAYMENT_NOTE_LENGTH);
  const soldAtCandidate = value.soldAt ? new Date(value.soldAt) : new Date();
  const soldAt = Number.isNaN(soldAtCandidate.getTime()) ? new Date() : soldAtCandidate;

  return {
    leadId,
    paymentMode,
    paymentType,
    totalAmount,
    remainingAmount,
    paymentReference: paymentMode === "CASH" ? "" : paymentReference,
    note,
    soldAt,
  };
};

const sanitizeFileList = (value) => {
  if (!Array.isArray(value)) return [];

  return [...new Set(
    value
      .map((item) => sanitizeString(item))
      .filter((item) => item.length > 0),
  )];
};

const sanitizePrice = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
};

const toFiniteNumber = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim() === "") return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const sanitizeNonNegativeNumber = (value, label) => {
  const parsed = toFiniteNumber(value);
  if (parsed === null) return null;
  if (parsed < 0) {
    throw createHttpError(400, `${label} must be a non-negative number`);
  }
  return parsed;
};

const parseNumericRange = (value) => {
  const raw = sanitizeString(value);
  if (!raw) return null;

  const [minRaw, maxRaw] = raw.split("-").map((part) => part.trim());
  const min = toFiniteNumber(minRaw);
  const max = toFiniteNumber(maxRaw);

  if (min === null || max === null) return null;
  return { min, max };
};

const normalizeLatitude = (value) => {
  const parsed = toFiniteNumber(value);
  if (parsed === null || parsed < -90 || parsed > 90) return null;
  return parsed;
};

const normalizeLongitude = (value) => {
  const parsed = toFiniteNumber(value);
  if (parsed === null || parsed < -180 || parsed > 180) return null;
  return parsed;
};

const buildLeadProjectInterested = (inventory = {}) =>
  [inventory.projectName, inventory.towerName, inventory.unitNumber]
    .map((value) => sanitizeString(value))
    .filter(Boolean)
    .join(" - ");

const syncLinkedLeadsFromInventory = async (inventory = {}) => {
  const inventoryId = inventory?._id;
  if (!inventoryId || !isValidObjectId(inventoryId)) return;

  const lat = normalizeLatitude(inventory?.siteLocation?.lat);
  const lng = normalizeLongitude(inventory?.siteLocation?.lng);
  const leadProjectInterested = buildLeadProjectInterested(inventory);
  const leadCity = sanitizeString(inventory?.location);

  await Lead.updateMany(
    { inventoryId },
    {
      $set: {
        projectInterested: leadProjectInterested || "",
        city: leadCity || "",
        "siteLocation.lat": lat,
        "siteLocation.lng": lng,
      },
    },
  );

  await Lead.updateMany(
    {
      inventoryId,
      $or: [
        { "siteLocation.radiusMeters": { $exists: false } },
        { "siteLocation.radiusMeters": null },
      ],
    },
    {
      $set: {
        "siteLocation.radiusMeters": DEFAULT_SITE_VISIT_RADIUS_METERS,
      },
    },
  );
};

const areValuesEqual = (left, right) =>
  JSON.stringify(left) === JSON.stringify(right);

const normalizeLegacyStatus = (status) => {
  const cleanStatus = sanitizeString(status);
  if (!cleanStatus) return cleanStatus;

  if (cleanStatus === "Reserved" || cleanStatus === "Rented") {
    return "Blocked";
  }

  return cleanStatus;
};

const normalizeLegacyType = (type) => {
  const cleanType = sanitizeString(type);
  if (!cleanType) return cleanType;

  const normalized = cleanType.toLowerCase();
  if (["rent", "rental", "for rent", "lease", "leasing"].includes(normalized)) {
    return "Rent";
  }

  if (["sale", "sell", "for sale", "resale"].includes(normalized)) {
    return "Sale";
  }

  return cleanType;
};

const normalizeLegacyCategory = (category) => {
  const cleanCategory = sanitizeString(category);
  if (!cleanCategory) return cleanCategory;

  const normalized = cleanCategory.toLowerCase();
  if (["apartment", "apartments", "flat", "flats"].includes(normalized)) {
    return "Apartment";
  }

  if (["villa", "villas"].includes(normalized)) {
    return "Villa";
  }

  if (["office", "offices", "commercial"].includes(normalized)) {
    return "Office";
  }

  if (["plot", "plots", "land"].includes(normalized)) {
    return "Plot";
  }

  return cleanCategory;
};

const resolveInventoryTypeFromCategory = (category) => {
  const normalized = sanitizeString(category).toLowerCase();
  if (!normalized) return "COMMERCIAL";
  if (["office", "commercial", "coworking", "managed office", "managed_office"].includes(normalized)) {
    return "COMMERCIAL";
  }
  return "RESIDENTIAL";
};

const buildLocationFromParts = ({ city, area, pincode, fallbackLocation }) => {
  const parts = [sanitizeString(city), sanitizeString(area), sanitizeString(pincode)].filter(Boolean);
  if (parts.length) return parts.join(", ");
  return sanitizeString(fallbackLocation);
};

const sanitizeCommercialDetailsPayload = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw createHttpError(400, "commercialDetails must be an object");
  }

  const officeLayout = value.officeLayout || {};
  const amenities = value.amenities || {};
  const buildingDetails = value.buildingDetails || {};
  const availability = value.availability || {};

  const workstations = sanitizeNonNegativeNumber(
    officeLayout.workstations ?? officeLayout.seats,
    "commercialDetails.officeLayout.workstations",
  );
  const seats = sanitizeNonNegativeNumber(
    officeLayout.seats ?? officeLayout.workstations,
    "commercialDetails.officeLayout.seats",
  );
  const parkingSlots = sanitizeNonNegativeNumber(
    buildingDetails.parkingSlots ?? amenities.parkingSlots,
    "commercialDetails.buildingDetails.parkingSlots",
  );

  const availableFromRaw = availability.availableFrom;
  const availableFromDate = availableFromRaw ? new Date(availableFromRaw) : null;

  return {
    officeType: sanitizeEnum(
      value.officeType || "",
      COMMERCIAL_OFFICE_TYPES,
      "commercialDetails.officeType",
    ),
    officeLayout: {
      totalCabins: sanitizeNonNegativeNumber(
        officeLayout.totalCabins,
        "commercialDetails.officeLayout.totalCabins",
      ),
      workstations,
      seats,
      conferenceRooms: sanitizeNonNegativeNumber(
        officeLayout.conferenceRooms,
        "commercialDetails.officeLayout.conferenceRooms",
      ),
      meetingRooms: sanitizeNonNegativeNumber(
        officeLayout.meetingRooms,
        "commercialDetails.officeLayout.meetingRooms",
      ),
      receptionArea: toBoolean(officeLayout.receptionArea, false),
      waitingArea: toBoolean(officeLayout.waitingArea, false),
    },
    amenities: {
      pantry: toBoolean(amenities.pantry, false),
      cafeteria: toBoolean(amenities.cafeteria, false),
      washroomType: sanitizeEnum(
        amenities.washroomType || "",
        COMMERCIAL_WASHROOM_TYPES,
        "commercialDetails.amenities.washroomType",
      ),
      serverRoom: toBoolean(amenities.serverRoom, false),
      storageRoom: toBoolean(amenities.storageRoom, false),
      breakoutArea: toBoolean(amenities.breakoutArea, false),
      liftAvailable: toBoolean(amenities.liftAvailable ?? amenities.lift, false),
      powerBackup: toBoolean(amenities.powerBackup, false),
      centralAC: toBoolean(amenities.centralAC, false),
    },
    buildingDetails: {
      totalFloors: sanitizeNonNegativeNumber(
        buildingDetails.totalFloors,
        "commercialDetails.buildingDetails.totalFloors",
      ),
      parkingType: sanitizeEnum(
        buildingDetails.parkingType || "",
        COMMERCIAL_PARKING_TYPES,
        "commercialDetails.buildingDetails.parkingType",
      ),
      parkingSlots,
      securityType: sanitizeEnum(
        buildingDetails.securityType || "",
        COMMERCIAL_SECURITY_TYPES,
        "commercialDetails.buildingDetails.securityType",
      ),
      fireSafety: toBoolean(buildingDetails.fireSafety ?? amenities.fireSafety, false),
    },
    availability: {
      readyToMove: toBoolean(availability.readyToMove, false),
      underConstruction: toBoolean(availability.underConstruction, false),
      availableFrom:
        availableFromDate && !Number.isNaN(availableFromDate.getTime()) ? availableFromDate : null,
    },
  };
};

const sanitizeResidentialDetailsPayload = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw createHttpError(400, "residentialDetails must be an object");
  }

  const amenities = value.amenities || {};
  const utilities = value.utilities || {};

  return {
    propertyType: sanitizeEnum(
      value.propertyType || "",
      RESIDENTIAL_PROPERTY_TYPES,
      "residentialDetails.propertyType",
    ),
    bhkType: sanitizeEnum(value.bhkType || "", RESIDENTIAL_BHK_TYPES, "residentialDetails.bhkType"),
    bedrooms: sanitizeNonNegativeNumber(value.bedrooms, "residentialDetails.bedrooms"),
    bathrooms: sanitizeNonNegativeNumber(value.bathrooms, "residentialDetails.bathrooms"),
    balcony: sanitizeNonNegativeNumber(value.balcony ?? value.balconies, "residentialDetails.balcony"),
    studyRoom: toBoolean(value.studyRoom, false),
    servantRoom: toBoolean(value.servantRoom, false),
    parking: sanitizeNonNegativeNumber(value.parking, "residentialDetails.parking"),
    amenities: {
      modularKitchen: toBoolean(amenities.modularKitchen, false),
      lift: toBoolean(amenities.lift, false),
      security: toBoolean(amenities.security, false),
      powerBackup: toBoolean(amenities.powerBackup, false),
      gym: toBoolean(amenities.gym, false),
      swimmingPool: toBoolean(amenities.swimmingPool, false),
      clubhouse: toBoolean(amenities.clubhouse, false),
    },
    utilities: {
      waterSupply: sanitizeEnum(
        utilities.waterSupply || "",
        RESIDENTIAL_WATER_SUPPLY_TYPES,
        "residentialDetails.utilities.waterSupply",
      ),
      electricityBackup: toBoolean(utilities.electricityBackup, false),
      gasPipeline: toBoolean(utilities.gasPipeline ?? amenities.gasPipeline, false),
    },
  };
};

const deriveStructuredFieldsFromTitle = (title) => {
  const cleanTitle = sanitizeString(title);
  if (!cleanTitle) return {};

  const parts = cleanTitle
    .split("-")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 3) {
    return {
      projectName: parts.slice(0, parts.length - 2).join(" - "),
      towerName: parts[parts.length - 2],
      unitNumber: parts[parts.length - 1],
    };
  }

  if (parts.length === 2) {
    return {
      projectName: parts[0],
      towerName: parts[1],
      unitNumber: parts[1],
    };
  }

  return {
    projectName: parts[0],
    towerName: "Main",
    unitNumber: `UNIT-${Date.now()}`,
  };
};

const normalizeLegacyInventoryPayload = (payload = {}) => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return payload;
  }

  const normalized = { ...payload };

  if (!normalized.projectName || !normalized.towerName || !normalized.unitNumber) {
    const derived = deriveStructuredFieldsFromTitle(normalized.title);
    normalized.projectName = normalized.projectName || derived.projectName;
    normalized.towerName = normalized.towerName || derived.towerName;
    normalized.unitNumber = normalized.unitNumber || derived.unitNumber;
  }

  if (Object.prototype.hasOwnProperty.call(normalized, "status")) {
    normalized.status = normalizeLegacyStatus(normalized.status);
  }

  if (!Object.prototype.hasOwnProperty.call(normalized, "reservationReason")) {
    const fallbackReason =
      normalized.statusReason
      ?? normalized.reserveReason
      ?? normalized.blockedReason;

    if (fallbackReason !== undefined) {
      normalized.reservationReason = fallbackReason;
    }
  }

  if (!Object.prototype.hasOwnProperty.call(normalized, "reservationLeadId")) {
    const fallbackLeadId =
      normalized.leadId
      ?? normalized.relatedLeadId
      ?? normalized.reservedForLeadId
      ?? normalized.blockedForLeadId;

    if (fallbackLeadId !== undefined) {
      normalized.reservationLeadId = fallbackLeadId;
    }
  }

  if (Object.prototype.hasOwnProperty.call(normalized, "type")) {
    normalized.type = normalizeLegacyType(normalized.type);
  }

  if (Object.prototype.hasOwnProperty.call(normalized, "category")) {
    normalized.category = normalizeLegacyCategory(normalized.category);
  }

  if (!Object.prototype.hasOwnProperty.call(normalized, "inventoryType")) {
    normalized.inventoryType = resolveInventoryTypeFromCategory(normalized.category);
  } else {
    normalized.inventoryType = toUpperSnake(normalized.inventoryType);
  }

  if (!Object.prototype.hasOwnProperty.call(normalized, "propertyId")) {
    const fallbackPropertyId = normalized.unitNumber || normalized.code || normalized.id || "";
    normalized.propertyId = sanitizeString(fallbackPropertyId);
  }

  if (Object.prototype.hasOwnProperty.call(normalized, "furnishingStatus")) {
    normalized.furnishingStatus = toUpperSnake(normalized.furnishingStatus);
  }

  if (Object.prototype.hasOwnProperty.call(normalized, "areaUnit")) {
    normalized.areaUnit = toUpperSnake(normalized.areaUnit);
  }

  const normalizedCity = sanitizeString(normalized.city);
  const normalizedArea = sanitizeString(normalized.area);
  const normalizedPincode = sanitizeString(normalized.pincode);
  if (normalizedCity) normalized.city = normalizedCity;
  if (normalizedArea) normalized.area = normalizedArea;
  if (normalizedPincode) normalized.pincode = normalizedPincode;

  const derivedLocation = buildLocationFromParts({
    city: normalized.city,
    area: normalized.area,
    pincode: normalized.pincode,
    fallbackLocation: normalized.location,
  });
  if (derivedLocation) {
    normalized.location = derivedLocation;
  }

  return normalized;
};

const getCompanyIdForUser = (user) => {
  const companyId = user?.companyId;
  if (!companyId || !isValidObjectId(companyId)) {
    throw createHttpError(403, "Company context is missing for this account");
  }
  return companyId;
};

const ensureManagerExistsInCompany = async ({ managerId, companyId }) => {
  if (!managerId) return null;
  if (!isValidObjectId(managerId)) {
    throw createHttpError(400, "Invalid team id");
  }

  const manager = await User.findOne({
    _id: managerId,
    role: { $in: MANAGEMENT_ROLES },
    isActive: true,
    companyId,
  })
    .select("_id name role companyId")
    .lean();

  if (!manager) {
    throw createHttpError(403, "Team owner is inactive or does not belong to your company");
  }

  return manager;
};

const getTeamIdForUser = (user) => {
  if (!user) return null;
  if (isManagementRole(user.role)) return user._id;
  if (EXECUTIVE_ROLES.includes(user.role)) {
    return user.parentId || null;
  }
  return null;
};

const ensureSaleDetailsLeadExists = async (saleDetails) => {
  if (!saleDetails?.leadId) return null;

  const lead = await Lead.findById(saleDetails.leadId)
    .select("_id name phone status")
    .lean();

  if (!lead) {
    throw createHttpError(400, "Selected lead not found for sold property details");
  }

  return lead;
};

const ensureReservationLeadExists = async (leadId) => {
  const normalizedLeadId = toObjectIdString(leadId);
  if (!normalizedLeadId) return null;
  if (!isValidObjectId(normalizedLeadId)) {
    throw createHttpError(400, "Invalid lead id");
  }

  const lead = await Lead.findById(normalizedLeadId)
    .select("_id name phone status")
    .lean();
  if (!lead) {
    throw createHttpError(400, "Selected lead not found");
  }

  return lead;
};

const toInventoryLabel = (inventory = {}) => {
  const parts = [
    sanitizeString(inventory.projectName),
    sanitizeString(inventory.towerName),
    sanitizeString(inventory.unitNumber),
  ].filter(Boolean);
  return parts.join(" - ") || "Inventory";
};

const appendLeadDiaryForInventory = async ({
  leadId,
  note,
  actorId,
  inventory,
  eventTitle,
}) => {
  const normalizedLeadId = toObjectIdString(leadId);
  if (!normalizedLeadId || !isValidObjectId(normalizedLeadId)) return;
  const cleanNote = sanitizeString(note).slice(0, 1800);

  const inventoryLabel = toInventoryLabel(inventory);
  const finalNote = [
    `${eventTitle}: ${inventoryLabel}`,
    cleanNote,
  ].filter(Boolean).join("\n");

  if (!finalNote) return;

  await LeadDiary.create({
    lead: normalizedLeadId,
    note: finalNote,
    createdBy: actorId || null,
  });

  await LeadActivity.create({
    lead: normalizedLeadId,
    action: eventTitle,
    performedBy: actorId || null,
  });
};

const getInventoryRequestEventTitle = ({ status, stage }) => {
  const normalized = String(status || "").trim();
  const normalizedStage = String(stage || "sent").trim().toLowerCase();
  const stageLabel = normalizedStage === "approved" ? "approved" : normalizedStage === "rejected" ? "rejected" : "sent";

  if (normalized === "Blocked") {
    return `Inventory block request ${stageLabel}`;
  }
  if (normalized === "Sold") {
    return `Inventory sold request ${stageLabel}`;
  }
  if (normalized === "Available") {
    return `Inventory available request ${stageLabel}`;
  }
  return `Inventory update request ${stageLabel}`;
};

const resolveDirectCreateTeamId = async ({ user, payload, companyId }) => {
  const requestedTeamId = payload?.teamId || null;
  if (requestedTeamId) {
    await ensureManagerExistsInCompany({
      managerId: requestedTeamId,
      companyId,
    });
    return requestedTeamId;
  }

  if (user.role !== USER_ROLES.ADMIN) {
    throw createHttpError(400, "teamId is required");
  }

  const manager = await User.findOne({
    role: USER_ROLES.MANAGER,
    isActive: true,
    companyId,
  })
    .sort({ createdAt: 1 })
    .select("_id")
    .lean();

  return manager?._id || null;
};

const pickInventoryDiff = (inventoryDoc, patch) => {
  const oldValue = {};
  const newValue = {};

  Object.keys(patch).forEach((key) => {
    oldValue[key] = inventoryDoc[key];
    newValue[key] = patch[key];
  });

  return { oldValue, newValue };
};

const sanitizeInventoryPayload = ({
  payload,
  mode = "create",
  currentType = "",
  currentStatus = "",
  currentReservationReason = "",
  currentReservationLeadId = null,
  currentSaleDetails = null,
}) => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw createHttpError(400, "proposedData must be an object");
  }

  const safePayload = {};

  INVENTORY_ALLOWED_FIELDS.forEach((field) => {
    if (!Object.prototype.hasOwnProperty.call(payload, field)) return;
    if (!isSafeKey(field)) return;

    const value = payload[field];

    if (field === "siteLocation") {
      if (value === null) {
        safePayload[field] = { lat: null, lng: null };
        return;
      }

      if (typeof value !== "object" || Array.isArray(value)) {
        throw createHttpError(400, "siteLocation must be an object");
      }

      const lat = normalizeLatitude(value.lat);
      const lng = normalizeLongitude(value.lng);

      if (lat === null || lng === null) {
        throw createHttpError(400, "Valid siteLocation.lat and siteLocation.lng are required");
      }

      safePayload[field] = { lat, lng };
      return;
    }

    if (field === "deposit" && value === null) {
      safePayload[field] = null;
      return;
    }

    if (value === undefined || value === null) return;

    if (field === "projectName" || field === "towerName" || field === "unitNumber" || field === "location") {
      const cleanValue = sanitizeString(value);
      if (!cleanValue) {
        throw createHttpError(400, `${field} must be a non-empty string`);
      }
      safePayload[field] = cleanValue;
      return;
    }

    if (field === "propertyId") {
      safePayload[field] = sanitizeCappedString(value, 80);
      return;
    }

    if (field === "inventoryType") {
      safePayload[field] = sanitizeEnum(value, INVENTORY_TYPE_OPTIONS, "inventoryType");
      return;
    }

    if (field === "price") {
      const parsedPrice = sanitizePrice(value);
      if (parsedPrice === null) {
        throw createHttpError(400, "price must be a valid positive number");
      }
      safePayload[field] = parsedPrice;
      return;
    }

    if (field === "type") {
      const cleanType = normalizeLegacyType(value);
      if (!INVENTORY_TYPES.includes(cleanType)) {
        throw createHttpError(400, "Invalid inventory type");
      }
      safePayload[field] = cleanType;
      return;
    }

    if (field === "category") {
      const cleanCategory = normalizeLegacyCategory(value);
      if (!cleanCategory) {
        throw createHttpError(400, "category must be a non-empty string");
      }
      if (cleanCategory.length > 120) {
        throw createHttpError(400, "category must be at most 120 characters");
      }
      safePayload[field] = cleanCategory;
      return;
    }

    if (field === "furnishingStatus") {
      safePayload[field] = sanitizeEnum(value, FURNISHING_STATUS_OPTIONS, "furnishingStatus");
      return;
    }

    if (field === "status") {
      const cleanStatus = sanitizeString(value);
      if (!INVENTORY_STATUSES.includes(cleanStatus)) {
        throw createHttpError(400, "Invalid inventory status");
      }
      safePayload[field] = cleanStatus;
      return;
    }

    if (field === "reservationReason") {
      safePayload[field] = sanitizeReservationReason(value);
      return;
    }

    if (field === "reservationLeadId") {
      const leadId = toObjectIdString(value);
      if (!leadId) {
        safePayload[field] = null;
        return;
      }
      if (!isValidObjectId(leadId)) {
        throw createHttpError(400, "reservationLeadId must be a valid lead id");
      }
      safePayload[field] = leadId;
      return;
    }

    if (field === "saleDetails") {
      if (value === null) {
        safePayload[field] = null;
        return;
      }

      safePayload[field] = sanitizeSaleDetails(value);
      return;
    }

    if (field === "city" || field === "area" || field === "buildingName") {
      safePayload[field] = sanitizeCappedString(value, 120);
      return;
    }

    if (field === "pincode") {
      safePayload[field] = sanitizeCappedString(value, 20);
      return;
    }

    if (field === "floorNumber") {
      safePayload[field] = toFiniteNumber(value);
      return;
    }

    if (
      field === "totalFloors"
      || field === "totalArea"
      || field === "carpetArea"
      || field === "builtUpArea"
      || field === "maintenanceCharges"
      || field === "deposit"
    ) {
      safePayload[field] = sanitizeNonNegativeNumber(value, field);
      return;
    }

    if (field === "areaUnit") {
      safePayload[field] = sanitizeEnum(value, AREA_UNIT_OPTIONS, "areaUnit");
      return;
    }

    if (field === "commercialDetails") {
      safePayload[field] = sanitizeCommercialDetailsPayload(value);
      return;
    }

    if (field === "residentialDetails") {
      safePayload[field] = sanitizeResidentialDetailsPayload(value);
      return;
    }

    if (field === "images" || field === "documents" || field === "floorPlans" || field === "videoTours") {
      safePayload[field] = sanitizeFileList(value);
      return;
    }
  });

  if (!safePayload.location) {
    const computedLocation = buildLocationFromParts({
      city: safePayload.city || payload.city,
      area: safePayload.area || payload.area,
      pincode: safePayload.pincode || payload.pincode,
      fallbackLocation: payload.location,
    });
    if (computedLocation) {
      safePayload.location = computedLocation;
    }
  }

  const hasTypePatch = Object.prototype.hasOwnProperty.call(safePayload, "type");
  const hasDepositPatch = Object.prototype.hasOwnProperty.call(safePayload, "deposit");
  const effectiveTransactionType =
    mode === "create"
      ? (hasTypePatch ? safePayload.type : normalizeLegacyType(payload.type))
      : (hasTypePatch ? safePayload.type : normalizeLegacyType(currentType));

  if (hasDepositPatch && effectiveTransactionType !== "Rent") {
    safePayload.deposit = null;
  } else if (!hasDepositPatch && hasTypePatch && safePayload.type !== "Rent") {
    safePayload.deposit = null;
  }

  if (mode === "create") {
    INVENTORY_REQUIRED_CREATE_FIELDS.forEach((field) => {
      if (safePayload[field] === undefined) {
        throw createHttpError(400, `${field} is required`);
      }
    });

    if (!safePayload.status) {
      safePayload.status = "Available";
    }
  }

  const hasStatusPatch = Object.prototype.hasOwnProperty.call(safePayload, "status");
  const hasReservationReasonPatch = Object.prototype.hasOwnProperty.call(
    safePayload,
    "reservationReason",
  );
  const hasReservationLeadPatch = Object.prototype.hasOwnProperty.call(
    safePayload,
    "reservationLeadId",
  );
  const hasSaleDetailsPatch = Object.prototype.hasOwnProperty.call(
    safePayload,
    "saleDetails",
  );
  const effectiveStatus =
    mode === "create"
      ? safePayload.status
      : (hasStatusPatch ? safePayload.status : normalizeLegacyStatus(currentStatus));
  const effectiveReservationReason = hasReservationReasonPatch
    ? sanitizeReservationReason(safePayload.reservationReason)
    : sanitizeReservationReason(currentReservationReason);
  const effectiveReservationLeadId = hasReservationLeadPatch
    ? toObjectIdString(safePayload.reservationLeadId)
    : toObjectIdString(currentReservationLeadId);
  const effectiveSaleDetails = hasSaleDetailsPatch
    ? safePayload.saleDetails
    : (currentSaleDetails || null);
  const shouldValidateBlockedReason =
    mode === "create"
    || (mode === "update" && hasStatusPatch && safePayload.status === "Blocked")
    || (mode === "update" && hasReservationReasonPatch)
    || (mode === "update" && hasReservationLeadPatch);
  const shouldRequireSoldDetails =
    mode === "create"
    || (mode === "update" && hasStatusPatch && safePayload.status === "Sold")
    || (mode === "update" && hasSaleDetailsPatch);

  if (effectiveStatus === "Blocked" && shouldValidateBlockedReason) {
    if (!effectiveReservationReason) {
      throw createHttpError(400, "reservationReason is required when status is Reserved");
    }
    if (!effectiveReservationLeadId) {
      throw createHttpError(400, "reservationLeadId is required when status is Reserved");
    }
    if (!isValidObjectId(effectiveReservationLeadId)) {
      throw createHttpError(400, "reservationLeadId must be a valid lead id");
    }

    if (hasReservationReasonPatch) {
      safePayload.reservationReason = effectiveReservationReason;
    }
    if (hasReservationLeadPatch) {
      safePayload.reservationLeadId = effectiveReservationLeadId;
    }
  } else if (mode === "create" || hasStatusPatch) {
    safePayload.reservationReason = "";
    safePayload.reservationLeadId = null;
  } else if (hasReservationReasonPatch && effectiveReservationReason) {
    throw createHttpError(400, "reservationReason can only be set when status is Reserved");
  } else if (hasReservationLeadPatch && effectiveReservationLeadId) {
    throw createHttpError(400, "reservationLeadId can only be set when status is Reserved");
  }

  if (effectiveStatus === "Sold") {
    if (shouldRequireSoldDetails) {
      if (!effectiveSaleDetails) {
        throw createHttpError(400, "saleDetails are required when status is Sold");
      }

      const validatedSaleDetails = sanitizeSaleDetails(effectiveSaleDetails);
      safePayload.saleDetails = validatedSaleDetails;
    }
  } else {
    if (hasSaleDetailsPatch && effectiveSaleDetails) {
      throw createHttpError(400, "saleDetails can only be set when status is Sold");
    }

    if (mode === "create" || hasStatusPatch || hasSaleDetailsPatch) {
      safePayload.saleDetails = null;
    }
  }

  if (mode === "update" && Object.keys(safePayload).length === 0) {
    throw createHttpError(400, "At least one valid field is required for update");
  }

  return safePayload;
};

const getInventoryScopeQueryForUser = (user) => {
  if (
    [
      USER_ROLES.ADMIN,
      ...MANAGEMENT_ROLES,
      USER_ROLES.EXECUTIVE,
      USER_ROLES.FIELD_EXECUTIVE,
    ].includes(user.role)
  ) {
    return { companyId: getCompanyIdForUser(user) };
  }

  if (user.role === USER_ROLES.CHANNEL_PARTNER) {
    return { companyId: getCompanyIdForUser(user) };
  }

  throw createHttpError(403, "Access denied");
};

const logInventoryActivity = async ({
  companyId,
  inventoryId,
  changedBy,
  role,
  actionType,
  oldValue = null,
  newValue = null,
  requestId = null,
}) =>
  InventoryActivity.create({
    companyId,
    inventoryId,
    changedBy,
    role,
    actionType,
    oldValue,
    newValue,
    requestId,
    timestamp: new Date(),
  });

const applyInventoryPopulates = (query) =>
  query
    .populate("teamId", "name role companyId")
    .populate("createdBy", "name role companyId")
    .populate("approvedBy", "name role companyId")
    .populate("updatedBy", "name role companyId")
    .populate("reservationLeadId", "name phone status projectInterested")
    .populate("saleDetails.leadId", "name phone status projectInterested")
    .lean();

const applyRequestPopulates = (query) =>
  query
    .populate("requestedBy", "name role parentId companyId")
    .populate("reviewedBy", "name role companyId")
    .populate("teamId", "name role companyId")
    .populate("inventoryId")
    .populate("relatedLead", "name phone status projectInterested")
    .lean();

const getInventoryList = async ({
  user,
  filters = {},
  pagination = null,
  selectFields = "",
}) => {
  const scope = getInventoryScopeQueryForUser(user);
  const query = { ...scope };

  if (filters.status && INVENTORY_STATUSES.includes(filters.status)) {
    query.status = filters.status;
  }

  const normalizedInventoryType = toUpperSnake(filters.inventoryType);
  if (INVENTORY_TYPE_OPTIONS.includes(normalizedInventoryType)) {
    query.inventoryType = normalizedInventoryType;
  }

  const normalizedFurnishing = toUpperSnake(filters.furnishing || filters.furnishingStatus);
  if (FURNISHING_STATUS_OPTIONS.includes(normalizedFurnishing) && normalizedFurnishing) {
    query.furnishingStatus = normalizedFurnishing;
  }

  const normalizedBhk = toUpperSnake(filters.bhk);
  if (normalizedBhk) {
    query["residentialDetails.bhkType"] = normalizedBhk;
  }

  const normalizedCity = sanitizeString(filters.city);
  if (normalizedCity) {
    query.city = { $regex: normalizedCity, $options: "i" };
  }

  const normalizedArea = sanitizeString(filters.area);
  if (normalizedArea) {
    query.area = { $regex: normalizedArea, $options: "i" };
  }

  const normalizedPincode = sanitizeString(filters.pincode);
  if (normalizedPincode) {
    query.pincode = { $regex: normalizedPincode, $options: "i" };
  }

  const propertyType = sanitizeString(filters.propertyType);
  if (propertyType) {
    const normalizedPropertyType = toUpperSnake(propertyType);
    query.$or = [
      { "commercialDetails.officeType": normalizedPropertyType },
      { "residentialDetails.propertyType": normalizedPropertyType },
      { category: { $regex: propertyType, $options: "i" } },
    ];
  }

  const areaRange = parseNumericRange(filters.areaRange);
  if (areaRange) {
    query.totalArea = { $gte: areaRange.min, $lte: areaRange.max };
  }

  const budgetRange = parseNumericRange(filters.budgetRange);
  if (budgetRange) {
    query.price = { $gte: budgetRange.min, $lte: budgetRange.max };
  }

  const minCabins = toFiniteNumber(filters.cabins);
  if (minCabins !== null) {
    query["commercialDetails.officeLayout.totalCabins"] = { $gte: minCabins };
  }

  const minSeats = toFiniteNumber(filters.seats);
  if (minSeats !== null) {
    query.$and = [
      ...(Array.isArray(query.$and) ? query.$and : []),
      {
        $or: [
          { "commercialDetails.officeLayout.seats": { $gte: minSeats } },
          { "commercialDetails.officeLayout.workstations": { $gte: minSeats } },
        ],
      },
    ];
  }

  const minFloor = toFiniteNumber(filters.floor);
  if (minFloor !== null) {
    query.floorNumber = { $gte: minFloor };
  }

  const pantryFilter = parseBooleanQuery(filters.pantry);
  if (pantryFilter !== null) {
    query["commercialDetails.amenities.pantry"] = pantryFilter;
  }

  const parkingFilter = parseBooleanQuery(filters.parkingAvailable);
  if (parkingFilter !== null) {
    const parkingCondition = parkingFilter
      ? {
        $or: [
          { "commercialDetails.buildingDetails.parkingSlots": { $gte: 1 } },
          { "residentialDetails.parking": { $gte: 1 } },
        ],
      }
      : {
        $and: [
          {
            $or: [
              { "commercialDetails.buildingDetails.parkingSlots": { $in: [0, null] } },
              { "commercialDetails.buildingDetails.parkingSlots": { $exists: false } },
            ],
          },
          {
            $or: [
              { "residentialDetails.parking": { $in: [0, null] } },
              { "residentialDetails.parking": { $exists: false } },
            ],
          },
        ],
      };

    query.$and = [
      ...(Array.isArray(query.$and) ? query.$and : []),
      parkingCondition,
    ];
  }

  const amenityTokens = sanitizeString(filters.amenities)
    .split(",")
    .map((item) => toUpperSnake(item))
    .filter(Boolean);

  if (amenityTokens.length) {
    const amenityClauses = [];

    amenityTokens.forEach((token) => {
      if (token === "PANTRY") amenityClauses.push({ "commercialDetails.amenities.pantry": true });
      if (token === "LIFT") {
        amenityClauses.push({
          $or: [
            { "commercialDetails.amenities.liftAvailable": true },
            { "residentialDetails.amenities.lift": true },
          ],
        });
      }
      if (token === "SECURITY") {
        amenityClauses.push({
          $or: [
            { "commercialDetails.buildingDetails.securityType": { $in: ["SECURITY_24X7", "CCTV", "BOTH"] } },
            { "residentialDetails.amenities.security": true },
          ],
        });
      }
      if (token === "POWER_BACKUP" || token === "POWERBACKUP") {
        amenityClauses.push({
          $or: [
            { "commercialDetails.amenities.powerBackup": true },
            { "residentialDetails.amenities.powerBackup": true },
          ],
        });
      }
      if (token === "GYM") amenityClauses.push({ "residentialDetails.amenities.gym": true });
      if (token === "SWIMMING_POOL" || token === "SWIMMINGPOOL") {
        amenityClauses.push({ "residentialDetails.amenities.swimmingPool": true });
      }
      if (token === "CLUBHOUSE") amenityClauses.push({ "residentialDetails.amenities.clubhouse": true });
      if (token === "MODULAR_KITCHEN" || token === "MODULARKITCHEN") {
        amenityClauses.push({ "residentialDetails.amenities.modularKitchen": true });
      }
      if (token === "GAS_PIPELINE" || token === "GASPIPELINE") {
        amenityClauses.push({ "residentialDetails.utilities.gasPipeline": true });
      }
    });

    if (amenityClauses.length) {
      query.$and = [
        ...(Array.isArray(query.$and) ? query.$and : []),
        ...amenityClauses,
      ];
    }
  }

  if (filters.search) {
    const safeSearch = sanitizeString(filters.search);
    if (safeSearch) {
      const searchClauses = [
        { projectName: { $regex: safeSearch, $options: "i" } },
        { towerName: { $regex: safeSearch, $options: "i" } },
        { unitNumber: { $regex: safeSearch, $options: "i" } },
        { location: { $regex: safeSearch, $options: "i" } },
        { propertyId: { $regex: safeSearch, $options: "i" } },
        { city: { $regex: safeSearch, $options: "i" } },
        { area: { $regex: safeSearch, $options: "i" } },
        { pincode: { $regex: safeSearch, $options: "i" } },
      ];
      if (Array.isArray(query.$or) && query.$or.length) {
        query.$and = [
          ...(Array.isArray(query.$and) ? query.$and : []),
          { $or: query.$or },
          { $or: searchClauses },
        ];
        delete query.$or;
      } else {
        query.$or = searchClauses;
      }
    }
  }

  const inventoryQuery = applyInventoryPopulates(
    Inventory.find(query).sort({ updatedAt: -1, createdAt: -1 }),
  );

  if (selectFields) {
    inventoryQuery.select(selectFields);
  }

  if (pagination?.enabled) {
    inventoryQuery.skip(pagination.skip).limit(pagination.limit);
  }

  if (!pagination?.enabled) {
    return inventoryQuery;
  }

  const [rows, totalCount] = await Promise.all([
    inventoryQuery,
    Inventory.countDocuments(query),
  ]);

  return {
    rows,
    totalCount,
  };
};

const getInventoryById = async ({ user, inventoryId }) => {
  if (!isValidObjectId(inventoryId)) {
    throw createHttpError(400, "Invalid inventory id");
  }

  const scope = getInventoryScopeQueryForUser(user);
  const row = await applyInventoryPopulates(
    Inventory.findOne({
      _id: inventoryId,
      ...scope,
    }),
  );

  if (!row) {
    throw createHttpError(404, "Inventory not found");
  }

  return row;
};

const createInventoryDirect = async ({ user, payload }) => {
  if (user.role !== USER_ROLES.ADMIN) {
    throw createHttpError(403, "Only ADMIN can create inventory directly");
  }

  const companyId = getCompanyIdForUser(user);
  const normalizedPayload = normalizeLegacyInventoryPayload(payload);
  const proposed = sanitizeInventoryPayload({
    payload: normalizedPayload,
    mode: "create",
  });
  await ensureSaleDetailsLeadExists(proposed.saleDetails);
  await ensureReservationLeadExists(proposed.reservationLeadId);

  const teamId = await resolveDirectCreateTeamId({
    user,
    payload: normalizedPayload,
    companyId,
  });

  const created = await Inventory.create({
    ...proposed,
    companyId,
    teamId,
    createdBy: user._id,
    approvedBy: user._id,
    updatedBy: user._id,
  });

  await logInventoryActivity({
    companyId,
    inventoryId: created._id,
    changedBy: user._id,
    role: user.role,
    actionType: INVENTORY_ACTIVITY_ACTIONS.DIRECT_CREATE,
    oldValue: null,
    newValue: proposed,
  });

  return applyInventoryPopulates(Inventory.findById(created._id));
};

const updateInventoryDirect = async ({ user, inventoryId, payload }) => {
  if (user.role !== USER_ROLES.ADMIN) {
    throw createHttpError(403, "Only ADMIN can update inventory directly");
  }

  if (!isValidObjectId(inventoryId)) {
    throw createHttpError(400, "Invalid inventory id");
  }

  const companyId = getCompanyIdForUser(user);
  const inventory = await Inventory.findOne({
    _id: inventoryId,
    companyId,
  });

  if (!inventory) {
    throw createHttpError(404, "Inventory not found");
  }

  const normalizedPayload = normalizeLegacyInventoryPayload(payload);
  const patch = sanitizeInventoryPayload({
    payload: normalizedPayload,
    mode: "update",
    currentType: inventory.type,
    currentStatus: inventory.status,
    currentReservationReason: inventory.reservationReason,
    currentReservationLeadId: inventory.reservationLeadId,
    currentSaleDetails: inventory.saleDetails || null,
  });
  await ensureSaleDetailsLeadExists(patch.saleDetails);
  await ensureReservationLeadExists(patch.reservationLeadId);

  const diff = pickInventoryDiff(inventory, patch);

  Object.assign(inventory, patch);
  inventory.updatedBy = user._id;
  inventory.approvedBy = user._id;
  await inventory.save();
  await syncLinkedLeadsFromInventory(inventory);

  await logInventoryActivity({
    companyId,
    inventoryId: inventory._id,
    changedBy: user._id,
    role: user.role,
    actionType: INVENTORY_ACTIVITY_ACTIONS.DIRECT_UPDATE,
    oldValue: diff.oldValue,
    newValue: diff.newValue,
  });

  const nextStatus = Object.prototype.hasOwnProperty.call(patch, "status")
    ? String(patch.status || "").trim()
    : String(inventory.status || "").trim();
  if (nextStatus === "Blocked") {
    const reservationLeadId = toObjectIdString(
      patch.reservationLeadId || inventory.reservationLeadId,
    );
    const diaryNote = sanitizeString(
      patch.reservationReason || inventory.reservationReason,
    );
    if (!reservationLeadId) {
      throw createHttpError(400, "Lead selection is required when status is Blocked");
    }
    await ensureReservationLeadExists(reservationLeadId);
    await appendLeadDiaryForInventory({
      leadId: reservationLeadId,
      note: diaryNote,
      actorId: user._id,
      inventory,
      eventTitle: "Inventory blocked directly",
    });
  }

  return applyInventoryPopulates(Inventory.findById(inventory._id));
};

const deleteInventoryDirect = async ({ user, inventoryId }) => {
  if (user.role !== USER_ROLES.ADMIN) {
    throw createHttpError(403, "Only ADMIN can delete inventory directly");
  }

  if (!isValidObjectId(inventoryId)) {
    throw createHttpError(400, "Invalid inventory id");
  }

  const companyId = getCompanyIdForUser(user);
  const inventory = await Inventory.findOne({
    _id: inventoryId,
    companyId,
  });

  if (!inventory) {
    throw createHttpError(404, "Inventory not found");
  }

  const snapshot = inventory.toObject();
  await Inventory.deleteOne({ _id: inventory._id, companyId });

  await logInventoryActivity({
    companyId,
    inventoryId: inventory._id,
    changedBy: user._id,
    role: user.role,
    actionType: INVENTORY_ACTIVITY_ACTIONS.DIRECT_DELETE,
    oldValue: snapshot,
    newValue: null,
  });
};

const bulkCreateInventoryDirect = async ({ user, payload = [] }) => {
  if (user.role !== USER_ROLES.ADMIN) {
    throw createHttpError(403, "Only ADMIN can bulk upload inventory");
  }

  if (!Array.isArray(payload) || payload.length === 0) {
    throw createHttpError(400, "rows array is required");
  }

  if (payload.length > 500) {
    throw createHttpError(400, "Bulk upload limit exceeded (max 500 rows)");
  }

  const companyId = getCompanyIdForUser(user);
  const createdRows = [];
  const failedRows = [];
  const validatedTeamIds = new Set();

  for (let index = 0; index < payload.length; index += 1) {
    const row = payload[index];
    try {
      const normalizedRow = normalizeLegacyInventoryPayload(row);
      const proposed = sanitizeInventoryPayload({
        payload: normalizedRow,
        mode: "create",
      });
      await ensureSaleDetailsLeadExists(proposed.saleDetails);
      await ensureReservationLeadExists(proposed.reservationLeadId);

      const teamId = row?.teamId || null;
      const teamIdKey = teamId ? String(teamId) : "";
      if (teamId && !validatedTeamIds.has(teamIdKey)) {
        await ensureManagerExistsInCompany({
          managerId: teamId,
          companyId,
        });
        validatedTeamIds.add(teamIdKey);
      }

      const created = await Inventory.create({
        ...proposed,
        companyId,
        teamId: teamId || null,
        createdBy: user._id,
        approvedBy: user._id,
        updatedBy: user._id,
      });

      await logInventoryActivity({
        companyId,
        inventoryId: created._id,
        changedBy: user._id,
        role: user.role,
        actionType: INVENTORY_ACTIVITY_ACTIONS.BULK_CREATE,
        oldValue: null,
        newValue: proposed,
      });

      createdRows.push(created._id);
    } catch (error) {
      failedRows.push({
        row: index,
        message: error.message,
      });
    }
  }

  return {
    createdCount: createdRows.length,
    failedCount: failedRows.length,
    createdIds: createdRows,
    failures: failedRows,
  };
};

const createInventoryCreateRequest = async ({ user, payload, io }) => {
  if (!INVENTORY_CREATE_REQUEST_ROLES.includes(user.role)) {
    throw createHttpError(403, "This role cannot submit create requests");
  }

  const companyId = getCompanyIdForUser(user);
  const normalizedPayload = normalizeLegacyInventoryPayload(payload);
  const proposed = sanitizeInventoryPayload({
    payload: normalizedPayload,
    mode: "create",
  });
  await ensureSaleDetailsLeadExists(proposed.saleDetails);
  await ensureReservationLeadExists(proposed.reservationLeadId);

  const teamId = getTeamIdForUser(user);
  if (teamId) {
    await ensureManagerExistsInCompany({
      managerId: teamId,
      companyId,
    });
  }

  const request = await InventoryRequest.create({
    companyId,
    requestedBy: user._id,
    type: "create",
    proposedData: proposed,
    status: REQUEST_STATUS_PENDING,
    teamId: teamId || null,
  });

  notifyRequestCreated({
    io,
    request,
    companyId,
    teamId: teamId || null,
  });

  return applyRequestPopulates(InventoryRequest.findById(request._id));
};

const createInventoryUpdateRequest = async ({
  user, inventoryId, payload, requestNote, relatedLeadId, io,
}) => {
  if (!INVENTORY_UPDATE_REQUEST_ROLES.includes(user.role)) {
    throw createHttpError(
      403,
      "Channel partner cannot submit update/status-change requests",
    );
  }

  if (!isValidObjectId(inventoryId)) {
    throw createHttpError(400, "Invalid inventory id");
  }

  const companyId = getCompanyIdForUser(user);
  const inventory = await Inventory.findOne({
    _id: inventoryId,
    companyId,
  })
    .select(
      "_id projectName towerName unitNumber propertyId inventoryType price deposit type category furnishingStatus status reservationReason reservationLeadId saleDetails location city area pincode buildingName floorNumber totalFloors totalArea carpetArea builtUpArea areaUnit maintenanceCharges commercialDetails residentialDetails siteLocation images documents floorPlans videoTours",
    )
    .lean();

  if (!inventory) {
    throw createHttpError(404, "Inventory not found");
  }

  const normalizedPayload = normalizeLegacyInventoryPayload(payload);
  const proposed = sanitizeInventoryPayload({
    payload: normalizedPayload,
    mode: "update",
    currentType: inventory.type,
    currentStatus: inventory.status,
    currentReservationReason: inventory.reservationReason,
    currentReservationLeadId: inventory.reservationLeadId,
    currentSaleDetails: inventory.saleDetails || null,
  });
  await ensureSaleDetailsLeadExists(proposed.saleDetails);

  const nextStatus = Object.prototype.hasOwnProperty.call(proposed, "status")
    ? String(proposed.status || "").trim()
    : String(inventory.status || "").trim();
  const isBlockedRequest = nextStatus === "Blocked";
  const selectedLeadId = toObjectIdString(
    proposed.reservationLeadId
      || relatedLeadId
      || normalizedPayload.reservationLeadId
      || normalizedPayload.relatedLeadId
      || normalizedPayload.leadId,
  );
  const cleanRequestNote = sanitizeString(requestNote || payload?.requestNote)
    .slice(0, MAX_INVENTORY_REQUEST_NOTE_LENGTH);

  if (isBlockedRequest && !selectedLeadId) {
    throw createHttpError(400, "Lead selection is required when status is Blocked");
  }
  if (isBlockedRequest && !cleanRequestNote) {
    throw createHttpError(400, "Lead diary note is required when status is Blocked");
  }

  const selectedLead = selectedLeadId
    ? await ensureReservationLeadExists(selectedLeadId)
    : null;

  if (isBlockedRequest) {
    proposed.reservationLeadId = selectedLead?._id || selectedLeadId;
    proposed.reservationReason = cleanRequestNote;
  }

  const changedKeys = Object.keys(proposed).filter(
    (key) => !areValuesEqual(proposed[key], inventory[key]),
  );
  if (changedKeys.length === 0) {
    throw createHttpError(400, "No changes detected");
  }

  const oldValue = {};
  const newValue = {};
  changedKeys.forEach((key) => {
    oldValue[key] = inventory[key];
    newValue[key] = proposed[key];
  });

  const teamId = getTeamIdForUser(user);
  if (teamId) {
    await ensureManagerExistsInCompany({
      managerId: teamId,
      companyId,
    });
  }

  const request = await InventoryRequest.create({
    companyId,
    requestedBy: user._id,
    inventoryId: inventory._id,
    type: "update",
    proposedData: newValue,
    requestNote: cleanRequestNote,
    status: REQUEST_STATUS_PENDING,
    teamId: teamId || null,
    relatedLead: selectedLead?._id || null,
  });

  await logInventoryActivity({
    companyId,
    inventoryId: inventory._id,
    changedBy: user._id,
    role: user.role,
    actionType: INVENTORY_ACTIVITY_ACTIONS.REQUEST_CREATED,
    oldValue,
    newValue,
    requestId: request._id,
  });

  notifyRequestCreated({
    io,
    request,
    companyId,
    teamId: teamId || null,
  });

  if (selectedLead?._id && cleanRequestNote) {
    await appendLeadDiaryForInventory({
      leadId: selectedLead._id,
      note: cleanRequestNote,
      actorId: user._id,
      inventory,
      eventTitle: getInventoryRequestEventTitle({ status: nextStatus, stage: "sent" }),
    });
  }

  return applyRequestPopulates(InventoryRequest.findById(request._id));
};

const getPendingRequests = async ({ user }) => {
  if (![USER_ROLES.ADMIN, ...MANAGEMENT_ROLES].includes(user.role)) {
    throw createHttpError(403, "Access denied");
  }

  const companyId = getCompanyIdForUser(user);
  const query = {
    status: REQUEST_STATUS_PENDING,
    companyId,
  };

  if (isManagementRole(user.role)) {
    query.teamId = user._id;
  }

  return applyRequestPopulates(
    InventoryRequest.find(query).sort({ createdAt: -1 }),
  );
};

const preApproveRequestByManager = async ({ user, requestId }) => {
  if (!isManagementRole(user.role)) {
    throw createHttpError(403, "Only leadership roles can pre-approve requests");
  }

  if (!isValidObjectId(requestId)) {
    throw createHttpError(400, "Invalid request id");
  }

  const companyId = getCompanyIdForUser(user);
  const request = await InventoryRequest.findOne({
    _id: requestId,
    companyId,
    status: REQUEST_STATUS_PENDING,
    teamId: user._id,
  });

  if (!request) {
    throw createHttpError(404, "Pending request not found for this manager");
  }

  request.managerPreApprovedBy = user._id;
  request.managerPreApprovedAt = new Date();
  await request.save();

  return applyRequestPopulates(InventoryRequest.findById(request._id));
};

const approveRequest = async ({ user, requestId, io }) => {
  if (user.role !== USER_ROLES.ADMIN) {
    throw createHttpError(403, "Only ADMIN can approve requests");
  }

  if (!isValidObjectId(requestId)) {
    throw createHttpError(400, "Invalid request id");
  }

  const companyId = getCompanyIdForUser(user);
  const request = await InventoryRequest.findOne({
    _id: requestId,
    companyId,
    status: REQUEST_STATUS_PENDING,
  }).populate("requestedBy", "_id role parentId companyId");

  if (!request) {
    throw createHttpError(404, "Pending request not found");
  }

  let inventory = null;
  let approvedLeadId = null;
  let approvedLeadNote = "";
  let approvedEventStatus = "";

  if (request.type === "create") {
    const proposed = sanitizeInventoryPayload({
      payload: request.proposedData || request.proposedChanges || {},
      mode: "create",
    });
    await ensureSaleDetailsLeadExists(proposed.saleDetails);
    await ensureReservationLeadExists(proposed.reservationLeadId);

    inventory = await Inventory.create({
      ...proposed,
      companyId,
      teamId: request.teamId || null,
      createdBy: request.requestedBy?._id || request.requestedBy,
      approvedBy: user._id,
      updatedBy: user._id,
    });

    await logInventoryActivity({
      companyId,
      inventoryId: inventory._id,
      changedBy: user._id,
      role: user.role,
      actionType: INVENTORY_ACTIVITY_ACTIONS.REQUEST_APPROVED_CREATE,
      oldValue: null,
      newValue: proposed,
      requestId: request._id,
    });

    request.inventoryId = inventory._id;
  } else if (request.type === "update") {
    if (!request.inventoryId) {
      throw createHttpError(400, "Inventory reference is required for update request");
    }

    inventory = await Inventory.findOne({
      _id: request.inventoryId,
      companyId,
    });

    if (!inventory) {
      throw createHttpError(404, "Inventory not found for update request");
    }

    const proposed = sanitizeInventoryPayload({
      payload: request.proposedData || request.proposedChanges || {},
      mode: "update",
      currentType: inventory.type,
      currentStatus: inventory.status,
      currentReservationReason: inventory.reservationReason,
      currentReservationLeadId: inventory.reservationLeadId,
      currentSaleDetails: inventory.saleDetails || null,
    });
    await ensureSaleDetailsLeadExists(proposed.saleDetails);
    const nextStatus = Object.prototype.hasOwnProperty.call(proposed, "status")
      ? String(proposed.status || "").trim()
      : String(inventory.status || "").trim();
    approvedEventStatus = nextStatus;
    if (nextStatus === "Blocked") {
      approvedLeadId = toObjectIdString(
        proposed.reservationLeadId
          || request.relatedLead
          || inventory.reservationLeadId,
      );
      approvedLeadNote = sanitizeString(
        request.requestNote
          || proposed.reservationReason
          || inventory.reservationReason,
      );
      if (!approvedLeadId) {
        throw createHttpError(400, "Lead selection is required when approving blocked status");
      }
      await ensureReservationLeadExists(approvedLeadId);
      proposed.reservationLeadId = approvedLeadId;
      if (approvedLeadNote) {
        proposed.reservationReason = approvedLeadNote;
      }
    } else {
      approvedLeadId = toObjectIdString(request.relatedLead);
      approvedLeadNote = sanitizeString(request.requestNote || "");
      if (approvedLeadId) {
        await ensureReservationLeadExists(approvedLeadId);
      }
    }

    const diff = pickInventoryDiff(inventory, proposed);
    Object.assign(inventory, proposed);
    inventory.updatedBy = user._id;
    inventory.approvedBy = user._id;
    await inventory.save();
    await syncLinkedLeadsFromInventory(inventory);

    await logInventoryActivity({
      companyId,
      inventoryId: inventory._id,
      changedBy: user._id,
      role: user.role,
      actionType: INVENTORY_ACTIVITY_ACTIONS.REQUEST_APPROVED_UPDATE,
      oldValue: diff.oldValue,
      newValue: diff.newValue,
      requestId: request._id,
    });
  } else {
    throw createHttpError(400, "Unsupported request type");
  }

  request.status = REQUEST_STATUS_APPROVED;
  request.reviewedBy = user._id;
  request.reviewedAt = new Date();
  request.rejectionReason = "";
  await request.save();

  if (approvedLeadId && inventory && approvedLeadNote) {
    await appendLeadDiaryForInventory({
      leadId: approvedLeadId,
      note: approvedLeadNote,
      actorId: user._id,
      inventory,
      eventTitle: getInventoryRequestEventTitle({ status: approvedEventStatus, stage: "approved" }),
    });
  }

  notifyRequestReviewed({
    io,
    request,
    inventory,
  });

  return {
    request: await applyRequestPopulates(InventoryRequest.findById(request._id)),
    inventory: inventory
      ? await applyInventoryPopulates(Inventory.findById(inventory._id))
      : null,
  };
};

const rejectRequest = async ({ user, requestId, rejectionReason, io }) => {
  if (user.role !== USER_ROLES.ADMIN) {
    throw createHttpError(403, "Only ADMIN can reject requests");
  }

  if (!isValidObjectId(requestId)) {
    throw createHttpError(400, "Invalid request id");
  }

  const reason = sanitizeString(rejectionReason);
  if (!reason) {
    throw createHttpError(400, "rejectionReason is required");
  }

  const companyId = getCompanyIdForUser(user);
  const request = await InventoryRequest.findOne({
    _id: requestId,
    companyId,
    status: REQUEST_STATUS_PENDING,
  });

  if (!request) {
    throw createHttpError(404, "Pending request not found");
  }

  request.status = REQUEST_STATUS_REJECTED;
  request.reviewedBy = user._id;
  request.reviewedAt = new Date();
  request.rejectionReason = reason;
  await request.save();

  if (request.relatedLead) {
    await appendLeadDiaryForInventory({
      leadId: request.relatedLead,
      note: `${sanitizeString(request.requestNote)}\nReject reason: ${reason}`.trim(),
      actorId: user._id,
      inventory: request.inventoryId || {},
      eventTitle: "Inventory block request rejected",
    });
  }

  notifyRequestReviewed({
    io,
    request,
    inventory: null,
  });

  return applyRequestPopulates(InventoryRequest.findById(request._id));
};

const getMyRequests = async ({ user }) => {
  const companyId = getCompanyIdForUser(user);
  return applyRequestPopulates(
    InventoryRequest.find({
      requestedBy: user._id,
      companyId,
    }).sort({ createdAt: -1 }),
  );
};

const getInventoryActivities = async ({ user, inventoryId, limit = 100 }) => {
  if (![USER_ROLES.ADMIN, ...MANAGEMENT_ROLES].includes(user.role)) {
    throw createHttpError(403, "Only admin/leadership roles can view activity logs");
  }

  if (!isValidObjectId(inventoryId)) {
    throw createHttpError(400, "Invalid inventory id");
  }

  const companyId = getCompanyIdForUser(user);
  const inventory = await getInventoryById({ user, inventoryId });

  const parsedLimit = Number.parseInt(limit, 10);
  const resolvedLimit =
    Number.isFinite(parsedLimit) && parsedLimit > 0
      ? Math.min(parsedLimit, 500)
      : 100;

  return InventoryActivity.find({
    companyId,
    inventoryId: inventory._id,
  })
    .sort({ timestamp: -1 })
    .limit(resolvedLimit)
    .populate("changedBy", "name role")
    .lean();
};

module.exports = {
  createHttpError,
  getInventoryList,
  getInventoryById,
  createInventoryDirect,
  updateInventoryDirect,
  deleteInventoryDirect,
  bulkCreateInventoryDirect,
  createInventoryCreateRequest,
  createInventoryUpdateRequest,
  getPendingRequests,
  preApproveRequestByManager,
  approveRequest,
  rejectRequest,
  getMyRequests,
  getInventoryActivities,
};
