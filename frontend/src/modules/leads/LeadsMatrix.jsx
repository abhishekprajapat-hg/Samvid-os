import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  getLeadPool,
  getLeadById,
  createLead,
  bulkUploadLeads,
  updateLeadStatus,
  assignLead,
  addLeadRelatedProperty,
  selectLeadRelatedProperty,
  removeLeadRelatedProperty,
  getLeadActivity,
  getLeadDiary,
  addLeadDiaryEntry,
} from "../../services/leadService";
import {
  getInventoryAssets,
} from "../../services/inventoryService";
import { getUsers } from "../../services/userService";
import { toErrorMessage } from "../../utils/errorMessage";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import {
  AddLeadModal,
  BulkLeadUploadModal,
  LeadsMatrixAlerts,
  LeadsMatrixFilters,
  LeadsMatrixTable,
  LeadsMatrixToolbar,
} from "./components/LeadsMatrixSections";
import { LeadDetailsRebuilt } from "./components/LeadDetailsRebuilt";
import {
  assertSupportedBulkLeadUploadFileName,
  BULK_LEAD_CSV_ONLY_MESSAGE,
} from "./bulkLeadFilePolicy";
import {
  getPropertySubtypeConfig,
  getPropertySubtypeOptions,
} from "../../config/propertyRequirementConfig";

const LEAD_STATUSES = [
  "NEW",
  "CONTACTED",
  "INTERESTED",
  "SITE_VISIT_SCHEDULED",
  "SITE_VISIT",
  "SITE_VISIT_OVERDUE",
  "MISSING_IN_ACTION",
  "NOT_PICKING_CALLS",
  "INVALID",
  "OWNER",
  "BROKER",
  "REQUESTED",
  "CLOSED",
  "LOST",
];
const LEAD_STATUS_SET = new Set(["ALL", ...LEAD_STATUSES]);

const LEAD_SORT_OPTIONS = {
  RECENT: "RECENT",
  FOLLOW_UP: "FOLLOW_UP",
  NAME: "NAME",
};

const ALL_PROPERTY_SUBTYPE_OPTIONS = Array.from(
  new Map(
    ["COMMERCIAL", "RESIDENTIAL"]
      .flatMap((inventoryType) => getPropertySubtypeOptions(inventoryType))
      .map((option) => [option.value, option]),
  ).values(),
);
const LEAD_LIST_PAGE_LIMIT = 100;
const LEAD_LIST_FIELDS = [
  "_id",
  "name",
  "phone",
  "email",
  "city",
  "preferredLocations",
  "projectInterested",
  "requirements",
  "source",
  "status",
  "assignedTo",
  "createdBy",
  "nextFollowUp",
  "lastContactedAt",
  "createdAt",
  "updatedAt",
].join(",");

const EXECUTIVE_ROLES = ["INSIDE_EXECUTIVE", "EXECUTIVE", "FIELD_EXECUTIVE"];
const LEAD_OWNER_ROLES = ["INSIDE_EXECUTIVE", "EXECUTIVE"];
const MANUAL_LEAD_TRANSFER_TARGET_ROLES = [...LEAD_OWNER_ROLES, "FIELD_EXECUTIVE"];
const MANAGEMENT_ROLES = ["MANAGER"];
const MANUAL_LEAD_TRANSFER_ACTOR_ROLES = ["ADMIN", ...MANAGEMENT_ROLES, ...LEAD_OWNER_ROLES];
const SITE_VISIT_RADIUS_METERS = 200;
const CUSTOM_NUMBER_OPTION_VALUE = "__CUSTOM_NUMBER__";
const DEAL_PAYMENT_MODES = [
  { value: "UPI", label: "UPI" },
  { value: "CASH", label: "Cash" },
  { value: "CHECK", label: "Check / Cheque" },
  { value: "NET_BANKING_NEFTRTGSIMPS", label: "Net Banking (NEFT/RTGS/IMPS)" },
];
const DEAL_PAYMENT_TYPES = [
  { value: "FULL", label: "Full Payment" },
  { value: "PARTIAL", label: "Partial Payment" },
];
const DEAL_PAYMENT_ADMIN_DECISIONS = [
  { value: "APPROVED", label: "Approve Payment" },
  { value: "REJECTED", label: "Reject Payment" },
];
const MAX_PAYMENT_NOTE_LENGTH = 1000;
const MAX_CLOSURE_DOCUMENTS = 20;

const defaultFormData = {
  inventoryId: "",
  name: "",
  phone: "",
  email: "",
  city: "",
  preferredLocations: "",
  projectInterested: "",
  siteLat: "",
  siteLng: "",
  requirementsInventoryType: "",
  requirementsPropertySubtype: "",
  requirementsSubtypeData: {},
  requirementsTransactionType: "",
  requirementsFurnishingStatus: "",
  requirementsBudgetMin: "",
  requirementsBudgetMax: "",
  requirementsAreaMin: "",
  requirementsAreaMax: "",
  requirementsAreaUnit: "SQ_FT",
  requirementsCommercialSeats: "",
  requirementsCommercialCabins: "",
  requirementsCommercialConferenceRooms: "",
  requirementsCommercialConferenceSeats: "",
  requirementsCommercialParkingAvailable: false,
  requirementsCommercialPantry: false,
  requirementsCommercialReceptionArea: false,
  requirementsCommercialWaitingArea: false,
  requirementsCommercialCafeteria: false,
  requirementsCommercialServerRoom: false,
  requirementsCommercialStorageRoom: false,
  requirementsCommercialBreakoutArea: false,
  requirementsCommercialLiftAvailable: false,
  requirementsCommercialPowerBackup: false,
  requirementsCommercialCentralAC: false,
  requirementsCommercialFireSafety: false,
  requirementsCommercialReadyToMove: false,
  requirementsCommercialUnderConstruction: false,
  requirementsResidentialBhkType: "",
  requirementsResidentialFloor: "",
  requirementsResidentialAmenityLift: false,
  requirementsResidentialAmenitySecurity: false,
  requirementsResidentialAmenityGym: false,
  requirementsResidentialAmenitySwimmingPool: false,
  requirementsResidentialAmenityClubhouse: false,
  requirementsResidentialAmenityPowerBackup: false,
  requirementsResidentialAmenityParking: false,
  requirementsResidentialAmenityStudyRoom: false,
  requirementsResidentialAmenityServantRoom: false,
  requirementsResidentialAmenityModularKitchen: false,
  requirementsResidentialAmenityElectricityBackup: false,
  requirementsResidentialAmenityGasPipeline: false,
};

const createDefaultLeadRequirementsDraft = () => ({
  inventoryType: "",
  propertySubtype: "",
  subtypeData: {},
  transactionType: "",
  furnishingStatus: "",
  budgetMin: "",
  budgetMax: "",
  areaMin: "",
  areaMax: "",
  areaUnit: "SQ_FT",
  commercial: {
    seats: "",
    cabins: "",
    conferenceRooms: "",
    conferenceSeats: "",
    parkingAvailable: false,
    pantry: false,
    receptionArea: false,
    waitingArea: false,
    cafeteria: false,
    serverRoom: false,
    storageRoom: false,
    breakoutArea: false,
    liftAvailable: false,
    powerBackup: false,
    centralAC: false,
    fireSafety: false,
    readyToMove: false,
    underConstruction: false,
  },
  residential: {
    bhkType: "",
    floor: "",
    amenities: {
      lift: false,
      security: false,
      gym: false,
      swimmingPool: false,
      clubhouse: false,
      powerBackup: false,
      parking: false,
      studyRoom: false,
      servantRoom: false,
      modularKitchen: false,
      electricityBackup: false,
      gasPipeline: false,
    },
  },
});

const toRequirementDraftText = (value) => {
  if (value === null || value === undefined) return "";
  return String(value).trim();
};

const toPreferredLocationsList = (value) => {
  const source = Array.isArray(value)
    ? value
    : String(value || "").split(/[\n,]+/);

  const seen = new Set();
  return source
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .map((item) => item.slice(0, 120))
    .filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 20);
};

const mapLeadRequirementsToDraft = (requirements = {}) => {
  const base = createDefaultLeadRequirementsDraft();
  const commercial = requirements?.commercial || {};
  const residential = requirements?.residential || {};
  const amenities = residential?.amenities || {};

  return {
    inventoryType: toRequirementDraftText(requirements?.inventoryType).toUpperCase(),
    propertySubtype: toRequirementDraftText(requirements?.propertySubtype).toUpperCase(),
    subtypeData: requirements?.subtypeData && typeof requirements.subtypeData === "object"
      ? { ...requirements.subtypeData }
      : {},
    transactionType: toRequirementDraftText(requirements?.transactionType).toUpperCase(),
    furnishingStatus: toRequirementDraftText(requirements?.furnishingStatus).toUpperCase(),
    budgetMin: toRequirementDraftText(requirements?.budgetMin),
    budgetMax: toRequirementDraftText(requirements?.budgetMax),
    areaMin: "",
    areaMax: "",
    areaUnit: base.areaUnit,
    commercial: {
      seats: toRequirementDraftText(commercial?.seats),
      cabins: toRequirementDraftText(commercial?.cabins),
      conferenceRooms: toRequirementDraftText(commercial?.conferenceRooms),
      conferenceSeats: toRequirementDraftText(commercial?.conferenceSeats),
      parkingAvailable: Boolean(commercial?.parkingAvailable),
      pantry: Boolean(commercial?.pantry),
      receptionArea: Boolean(commercial?.receptionArea),
      waitingArea: Boolean(commercial?.waitingArea),
      cafeteria: Boolean(commercial?.cafeteria),
      serverRoom: Boolean(commercial?.serverRoom),
      storageRoom: Boolean(commercial?.storageRoom),
      breakoutArea: Boolean(commercial?.breakoutArea),
      liftAvailable: Boolean(commercial?.liftAvailable),
      powerBackup: Boolean(commercial?.powerBackup),
      centralAC: Boolean(commercial?.centralAC),
      fireSafety: Boolean(commercial?.fireSafety),
      readyToMove: Boolean(commercial?.readyToMove),
      underConstruction: Boolean(commercial?.underConstruction),
    },
    residential: {
      bhkType: toRequirementDraftText(residential?.bhkType).toUpperCase(),
      floor: toRequirementDraftText(residential?.floor),
      amenities: {
        lift: Boolean(amenities?.lift),
        security: Boolean(amenities?.security),
        gym: Boolean(amenities?.gym),
        swimmingPool: Boolean(amenities?.swimmingPool),
        clubhouse: Boolean(amenities?.clubhouse),
        powerBackup: Boolean(amenities?.powerBackup),
        parking: Boolean(amenities?.parking),
        studyRoom: Boolean(amenities?.studyRoom),
        servantRoom: Boolean(amenities?.servantRoom),
        modularKitchen: Boolean(amenities?.modularKitchen),
        electricityBackup: Boolean(amenities?.electricityBackup),
        gasPipeline: Boolean(amenities?.gasPipeline),
      },
    },
  };
};

const sanitizeRequirementSubtypeData = (subtypeData = {}) => {
  if (!subtypeData || typeof subtypeData !== "object") return {};
  return Object.fromEntries(
    Object.entries(subtypeData).filter(([, value]) => value !== CUSTOM_NUMBER_OPTION_VALUE),
  );
};

const buildLeadRequirementsPayloadFromDraft = (draft = {}) => {
  const propertySubtype = String(draft?.propertySubtype || "").trim().toUpperCase();
  const payload = {
    inventoryType: String(draft?.inventoryType || "").trim().toUpperCase(),
    propertySubtype,
    subtypeData: sanitizeRequirementSubtypeData(draft?.subtypeData),
    transactionType: toRequirementTransactionType(draft?.transactionType),
    furnishingStatus: String(draft?.furnishingStatus || "").trim().toUpperCase(),
    budgetMin: toAmountNumber(draft?.budgetMin),
    budgetMax: toAmountNumber(draft?.budgetMax),
    areaMin: null,
    areaMax: null,
    areaUnit: null,
  };

  if (propertySubtype) return payload;

  payload.commercial = {
    seats: toAmountNumber(draft?.commercial?.seats),
    cabins: toAmountNumber(draft?.commercial?.cabins),
    conferenceRooms: toAmountNumber(draft?.commercial?.conferenceRooms),
    conferenceSeats: toAmountNumber(draft?.commercial?.conferenceSeats),
    parkingAvailable: Boolean(draft?.commercial?.parkingAvailable),
    pantry: Boolean(draft?.commercial?.pantry),
    receptionArea: Boolean(draft?.commercial?.receptionArea),
    waitingArea: Boolean(draft?.commercial?.waitingArea),
    cafeteria: Boolean(draft?.commercial?.cafeteria),
    serverRoom: Boolean(draft?.commercial?.serverRoom),
    storageRoom: Boolean(draft?.commercial?.storageRoom),
    breakoutArea: Boolean(draft?.commercial?.breakoutArea),
    liftAvailable: Boolean(draft?.commercial?.liftAvailable),
    powerBackup: Boolean(draft?.commercial?.powerBackup),
    centralAC: Boolean(draft?.commercial?.centralAC),
    fireSafety: Boolean(draft?.commercial?.fireSafety),
    readyToMove: Boolean(draft?.commercial?.readyToMove),
    underConstruction: Boolean(draft?.commercial?.underConstruction),
  };
  payload.residential = {
    bhkType: String(draft?.residential?.bhkType || "").trim().toUpperCase(),
    floor: toAmountNumber(draft?.residential?.floor),
    amenities: {
      lift: Boolean(draft?.residential?.amenities?.lift),
      security: Boolean(draft?.residential?.amenities?.security),
      gym: Boolean(draft?.residential?.amenities?.gym),
      swimmingPool: Boolean(draft?.residential?.amenities?.swimmingPool),
      clubhouse: Boolean(draft?.residential?.amenities?.clubhouse),
      powerBackup: Boolean(draft?.residential?.amenities?.powerBackup),
      parking: Boolean(draft?.residential?.amenities?.parking),
      studyRoom: Boolean(draft?.residential?.amenities?.studyRoom),
      servantRoom: Boolean(draft?.residential?.amenities?.servantRoom),
      modularKitchen: Boolean(draft?.residential?.amenities?.modularKitchen),
      electricityBackup: Boolean(draft?.residential?.amenities?.electricityBackup),
      gasPipeline: Boolean(draft?.residential?.amenities?.gasPipeline),
    },
  };
  return payload;
};

const getInventoryLeadLabel = (inventoryLike = {}) => {
  const propertyId = String(inventoryLike?.propertyId || "").trim();
  const title = [inventoryLike?.projectName, inventoryLike?.towerName, inventoryLike?.unitNumber]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(" - ");

  if (propertyId && title) return `${propertyId} - ${title}`;
  if (propertyId) return propertyId;
  return title;
};

const getInventoryLeadCity = (inventoryLike = {}) =>
  String(inventoryLike?.city || inventoryLike?.location || "").trim();

const getStoredUserId = () => {
  try {
    const parsedUser = JSON.parse(localStorage.getItem("user") || "{}");
    return String(parsedUser?._id || parsedUser?.id || "").trim();
  } catch {
    return "";
  }
};

const getInventoryLeadSearchText = (inventoryLike = {}) => {
  const commercialLayout = inventoryLike?.commercialDetails?.officeLayout || {};
  const residentialDetails = inventoryLike?.residentialDetails || {};
  return [
    getInventoryLeadLabel(inventoryLike),
    inventoryLike?.location,
    inventoryLike?.city,
    inventoryLike?.area,
    inventoryLike?.pincode,
    inventoryLike?.inventoryType,
    inventoryLike?.furnishingStatus,
    inventoryLike?.type,
    inventoryLike?.category,
    residentialDetails?.propertyType,
    residentialDetails?.bhkType,
    inventoryLike?.commercialDetails?.officeType,
    commercialLayout?.totalCabins,
    commercialLayout?.workstations,
    commercialLayout?.seats,
    inventoryLike?.totalArea,
    inventoryLike?.carpetArea,
    inventoryLike?.builtUpArea,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(" ");
};

const toRequirementTransactionType = (value) => {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized === "RENT") return "RENT";
  if (normalized === "LEASE") return "LEASE";
  if (normalized === "SALE") return "SALE";
  return "";
};

const validateLeadRequirementDraft = ({
  inventoryType,
  propertySubtype,
  budgetMin,
  budgetMax,
  subtypeData,
} = {}) => {
  const parsedBudgetMin = toAmountNumber(budgetMin);
  const parsedBudgetMax = toAmountNumber(budgetMax);

  const numericChecks = [
    ["Budget Min", parsedBudgetMin],
    ["Budget Max", parsedBudgetMax],
  ];

  for (const [label, value] of numericChecks) {
    if (value !== null && value < 0) return `${label} cannot be negative`;
  }
  if (parsedBudgetMin !== null && parsedBudgetMax !== null && parsedBudgetMin > parsedBudgetMax) {
    return "Budget Min cannot be greater than Budget Max";
  }

  const subtypeConfig = getPropertySubtypeConfig(inventoryType, propertySubtype);
  if (!subtypeConfig) return "";

  for (const field of subtypeConfig.fields || []) {
    const value = subtypeData?.[field.key];
    if (field.type === "number") {
      const numericValue = toAmountNumber(value);
      if (numericValue !== null && numericValue < 0) {
        return `${field.label} cannot be negative`;
      }
    }
    if (field.required && String(value || "").trim() === "") {
      return `${field.label} is required`;
    }
  }

  return "";
};

const hasLeadRequirements = (formData = {}) => {
  const textFields = [
    formData.requirementsInventoryType,
    formData.requirementsPropertySubtype,
    formData.requirementsTransactionType,
    formData.requirementsFurnishingStatus,
    formData.requirementsBudgetMin,
    formData.requirementsBudgetMax,
    formData.requirementsCommercialSeats,
    formData.requirementsCommercialCabins,
    formData.requirementsCommercialConferenceRooms,
    formData.requirementsCommercialConferenceSeats,
    formData.requirementsResidentialBhkType,
    formData.requirementsResidentialFloor,
    ...Object.values(formData.requirementsSubtypeData || {}),
  ];

  if (textFields.some((value) => String(value || "").trim() !== "")) {
    return true;
  }

  return [
    formData.requirementsCommercialParkingAvailable,
    formData.requirementsCommercialPantry,
    formData.requirementsCommercialReceptionArea,
    formData.requirementsCommercialWaitingArea,
    formData.requirementsCommercialCafeteria,
    formData.requirementsCommercialServerRoom,
    formData.requirementsCommercialStorageRoom,
    formData.requirementsCommercialBreakoutArea,
    formData.requirementsCommercialLiftAvailable,
    formData.requirementsCommercialPowerBackup,
    formData.requirementsCommercialCentralAC,
    formData.requirementsCommercialFireSafety,
    formData.requirementsCommercialReadyToMove,
    formData.requirementsCommercialUnderConstruction,
    formData.requirementsResidentialAmenityLift,
    formData.requirementsResidentialAmenitySecurity,
    formData.requirementsResidentialAmenityGym,
    formData.requirementsResidentialAmenitySwimmingPool,
    formData.requirementsResidentialAmenityClubhouse,
    formData.requirementsResidentialAmenityPowerBackup,
    formData.requirementsResidentialAmenityParking,
    formData.requirementsResidentialAmenityStudyRoom,
    formData.requirementsResidentialAmenityServantRoom,
    formData.requirementsResidentialAmenityModularKitchen,
    formData.requirementsResidentialAmenityElectricityBackup,
    formData.requirementsResidentialAmenityGasPipeline,
  ].some(Boolean);
};

const toObjectIdString = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && value._id) return String(value._id);
  return String(value);
};

const sanitizeClosureDocument = (value = {}) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const url = String(value.url || value.secure_url || "").trim();
  if (!url) return null;

  const mimeType = String(value.mimeType || value.type || "").trim();
  const normalizedKind = String(value.kind || "").trim().toLowerCase();
  const derivedKind = mimeType.startsWith("image/")
    ? "image"
    : mimeType === "application/pdf"
      ? "pdf"
      : "file";

  return {
    url: url.slice(0, 2048),
    kind: ["image", "pdf", "file"].includes(normalizedKind) ? normalizedKind : derivedKind,
    mimeType: mimeType.slice(0, 120),
    name: String(value.name || value.original_filename || "").trim().slice(0, 180),
    size: Math.max(0, Math.round(Number(value.size) || 0)),
    uploadedAt: value.uploadedAt || new Date().toISOString(),
    uploadedBy: value.uploadedBy || null,
  };
};

const sanitizeClosureDocumentList = (value) => {
  if (!Array.isArray(value)) return [];

  const dedupe = new Set();
  const rows = [];

  value.forEach((item) => {
    const doc = sanitizeClosureDocument(item);
    if (!doc || dedupe.has(doc.url)) return;
    dedupe.add(doc.url);
    rows.push(doc);
  });

  return rows.slice(0, MAX_CLOSURE_DOCUMENTS);
};

const getLeadRelatedInventories = (lead = {}) => {
  const merged = [];
  const seen = new Set();
  const pushUnique = (value) => {
    const id = toObjectIdString(value);
    if (!id || seen.has(id)) return;
    seen.add(id);
    merged.push(value);
  };

  pushUnique(lead?.inventoryId);
  if (Array.isArray(lead?.relatedInventoryIds)) {
    lead.relatedInventoryIds.forEach((row) => pushUnique(row));
  }

  return merged;
};

const getStatusColor = (status) => {
  switch (status) {
    case "NEW":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "CONTACTED":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "INTERESTED":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "SITE_VISIT_SCHEDULED":
      return "bg-cyan-50 text-cyan-700 border-cyan-200";
    case "SITE_VISIT":
      return "bg-violet-50 text-violet-700 border-violet-200";
    case "SITE_VISIT_OVERDUE":
      return "bg-red-50 text-red-700 border-red-200";
    case "MISSING_IN_ACTION":
    case "NOT_PICKING_CALLS":
      return "bg-yellow-50 text-yellow-800 border-yellow-200";
    case "INVALID":
      return "bg-zinc-100 text-zinc-700 border-zinc-300";
    case "OWNER":
      return "bg-sky-50 text-sky-700 border-sky-200";
    case "BROKER":
      return "bg-purple-50 text-purple-700 border-purple-200";
    case "REQUESTED":
      return "bg-orange-50 text-orange-700 border-orange-200";
    case "CLOSED":
      return "bg-slate-900 text-white border-slate-900";
    case "LOST":
      return "bg-rose-50 text-rose-700 border-rose-200";
    default:
      return "bg-slate-50 text-slate-600 border-slate-200";
  }
};

const getStatusLabel = (status) =>
  String(status || "")
    .toLowerCase()
    .split("_")
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");

const getDateMs = (value) => {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

const toDateTimeInput = (dateValue) => {
  if (!dateValue) return "";
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return "";

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString([], {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const toCoordinateNumber = (value) => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string" && value.trim() === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toAmountNumber = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toInventoryApiStatus = (value) => {
  const normalized = String(value || "").trim();
  if (!normalized) return "Available";
  if (normalized === "Reserved") return "Blocked";
  return normalized;
};

const toInventoryStatusLabel = (value) => {
  const normalized = toInventoryApiStatus(value);
  if (normalized === "Blocked") return "Reserved";
  return normalized;
};

const normalizePhoneDigits = (value) =>
  String(value || "").replace(/\D/g, "");

const getDialerHref = (phone) => {
  const digits = normalizePhoneDigits(phone);
  return digits ? `tel:${digits}` : "";
};

const getWhatsAppHref = (phone) => {
  const digits = normalizePhoneDigits(phone);
  if (!digits) return "";

  const waNumber = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${waNumber}`;
};

const getMailHref = (email) => {
  const trimmed = String(email || "").trim();
  return trimmed ? `mailto:${trimmed}` : "";
};

const getMapsHref = (city) => {
  const trimmed = String(city || "").trim();
  return trimmed
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trimmed)}`
    : "";
};

const normalizeCsvHeader = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_/-]+/g, "");

const normalizeBulkCellText = (value) => {
  if (value === null || value === undefined) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  return String(value).trim();
};

const normalizeBulkPhone = (value) => {
  const raw = normalizeBulkCellText(value);
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10) return "";
  return digits.slice(-10);
};

const normalizeBulkAmount = (value) => {
  const raw = normalizeBulkCellText(value);
  if (!raw) return null;
  const lower = raw.toLowerCase();
  const numeric = Number.parseFloat(raw.replace(/,/g, "").replace(/[^\d.]/g, ""));
  if (!Number.isFinite(numeric)) return null;
  if (/\blac\b|\blakh\b|\bl\b/.test(lower)) return Math.round(numeric * 100000);
  if (/\bk\b/.test(lower)) return Math.round(numeric * 1000);
  return Math.round(numeric);
};

const normalizeBulkDate = (value) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }

  const raw = normalizeBulkCellText(value);
  if (!raw) return "";

  const dateMatch = raw.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (dateMatch) {
    const day = Number.parseInt(dateMatch[1], 10);
    const month = Number.parseInt(dateMatch[2], 10) - 1;
    const rawYear = Number.parseInt(dateMatch[3], 10);
    const year = rawYear < 100 ? 2000 + rawYear : rawYear;
    const parsed = new Date(year, month, day, 12);
    if (
      parsed.getFullYear() === year
      && parsed.getMonth() === month
      && parsed.getDate() === day
    ) {
      return parsed.toISOString();
    }
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
};

const normalizeBulkTransactionType = (value) => {
  const normalized = normalizeBulkCellText(value).toLowerCase();
  if (!normalized) return "";
  if (/\blease\b/.test(normalized)) return "LEASE";
  if (/\brent\b/.test(normalized)) return "RENT";
  if (/\b(purchase|sale|buy|sell)\b/.test(normalized)) return "SALE";
  return "";
};

const resolveLeadCsvHeaderKey = (rawHeader) => {
  const normalized = normalizeCsvHeader(rawHeader);
  if (!normalized) return "";

  if (["name", "leadname", "fullname", "clientname"].includes(normalized)) return "name";
  if (["phone", "mobile", "mobileno", "phonenumber", "number", "contact"].includes(normalized)) return "phone";
  if (["email", "emailid"].includes(normalized)) return "email";
  if (["city", "location"].includes(normalized)) return "city";
  if (["project", "projectinterested", "interestedproject"].includes(normalized)) {
    return "projectInterested";
  }
  if (["requirement", "requirment", "requiremnt", "requiremewnt"].includes(normalized)) return "requirement";
  if (["projectname"].includes(normalized)) return "projectName";
  if (["comment", "comments", "remark", "remarks", "feedback"].includes(normalized)) return "comment";
  if (["company", "companyname", "working", "business", "workprofile"].includes(normalized)) return "company";
  if (["status", "leadstatus", "leadstutas", "leadstutus"].includes(normalized)) return "status";
  if (["date", "leaddate"].includes(normalized)) return "date";
  if (["followup", "followup2", "followupdate", "followupdate2"].includes(normalized)) return "followUp";
  if (["callupdate", "callstatus"].includes(normalized)) return "callUpdate";
  if (["propertytype", "type"].includes(normalized)) return "propertyType";
  if (["budget"].includes(normalized)) return "budget";
  if (["visit", "visitupdate"].includes(normalized)) return "visit";
  if (["handle", "handledby", "owner"].includes(normalized)) return "handle";
  if (["optionshare", "optionsshared", "optionsshare"].includes(normalized)) return "optionShare";
  if (["timeline", "timeLine"].includes(normalized)) return "timeline";
  if (["leadsource", "source"].includes(normalized)) return "source";
  if (["inventoryid", "propertyid", "unitid", "assetid"].includes(normalized)) {
    return "inventoryId";
  }
  if (["sitelat", "latitude", "lat"].includes(normalized)) return "siteLat";
  if (["sitelng", "longitude", "long", "lng"].includes(normalized)) return "siteLng";
  if (["siteradiusmeters", "radiusmeters", "radius", "siteradius"].includes(normalized)) {
    return "siteRadiusMeters";
  }

  return "";
};

const resolveBulkLeadStatus = ({ sheetName = "", row = {} }) => {
  const haystack = [
    sheetName,
    row.status,
    row.visit,
    row.comment,
    row.callUpdate,
    row.followUp,
    row.projectInterested,
  ]
    .map((value) => normalizeBulkCellText(value).toLowerCase())
    .join(" ");

  if (/\b(close|closed|token)\b/.test(haystack)) return "CLOSED";
  if (/\b(site\s*visit\s*(scheduled|schedule)|visit\s*(scheduled|schedule))\b/.test(haystack)) return "SITE_VISIT_SCHEDULED";
  if (/\b(site\s*visit\s*(overdue|over\s*due|over\s*deu)|visit\s*(overdue|over\s*due|over\s*deu))\b/.test(haystack)) return "SITE_VISIT_OVERDUE";
  if (/\b(missing\s*in\s*action|mia)\b/.test(haystack)) return "MISSING_IN_ACTION";
  if (/\b(not\s*picking|not\s*pick|call\s*not\s*picked|no\s*answer)\b/.test(haystack)) return "NOT_PICKING_CALLS";
  if (/\b(invalid|invaild|wrong\s*number)\b/.test(haystack)) return "INVALID";
  if (/\b(owner)\b/.test(haystack)) return "OWNER";
  if (/\b(broker)\b/.test(haystack)) return "BROKER";
  if (/\bvisit|visited|revisit\b/.test(haystack)) return "SITE_VISIT";
  if (/\binterested|interest\b/.test(haystack)) return "INTERESTED";
  if (/\btransfer|contacted|follow\s*up|callback|call back\b/.test(haystack)) return "CONTACTED";
  if (/\blost|not\s*interested|notint|cna\b/.test(haystack)) return "LOST";
  return "NEW";
};

const buildBulkLeadProjectSummary = (row) => {
  const transactionType = normalizeBulkTransactionType(row.projectName);
  const projectName = normalizeBulkCellText(row.projectName);
  const parts = [
    row.projectInterested,
    row.requirement ? `Requirement: ${row.requirement}` : "",
    row.propertyType ? `Property Type: ${row.propertyType}` : "",
    projectName && !transactionType ? `Project: ${projectName}` : "",
    transactionType ? `Transaction: ${transactionType}` : "",
    row.city ? `Location: ${row.city}` : "",
    row.budget ? `Budget: ${row.budget}` : "",
    row.company ? `Work Profile: ${row.company}` : "",
    row.callUpdate ? `Call Update: ${row.callUpdate}` : "",
    row.comment ? `Comment: ${row.comment}` : "",
    row.visit ? `Visit: ${row.visit}` : "",
    row.handle ? `Handle: ${row.handle}` : "",
    row.optionShare ? `Option Share: ${row.optionShare}` : "",
    row.timeline ? `Timeline: ${row.timeline}` : "",
  ]
    .map(normalizeBulkCellText)
    .filter(Boolean);

  return parts.join(" | ").slice(0, 500);
};

const buildBulkLeadRequirements = (row) => {
  const budget = normalizeBulkAmount(row.budget);
  const requirementText = [
    row.projectInterested,
    row.requirement,
  ].map(normalizeBulkCellText).filter(Boolean).join(" ");
  const propertyType = normalizeBulkCellText(row.propertyType).toUpperCase();
  const transactionType = normalizeBulkTransactionType(row.projectName || row.projectInterested);
  const requirements = {};

  if (budget !== null) {
    requirements.budgetMin = budget;
    requirements.budgetMax = budget;
  }

  if (["COMMERCIAL", "RESIDENTIAL"].includes(propertyType)) {
    requirements.inventoryType = propertyType;
  }
  if (transactionType) {
    requirements.transactionType = transactionType;
  }

  const seatsMatch = requirementText.match(/(\d+)\s*(?:seat|seater|seats)\b/i);
  const cabinMatch = requirementText.match(/(\d+)\s*(?:cabin|cabins)\b/i);
  const conferenceSeatsMatch = requirementText.match(/(\d+)\s*(?:conference\s*seat|conference\s*seater|conference\s*seats)\b/i);
  const areaMatch = requirementText.match(/(\d+(?:\.\d+)?)\s*(?:sq\s*ft|sqft|sqfit|sft)\b/i);
  if (seatsMatch || cabinMatch || conferenceSeatsMatch) {
    requirements.inventoryType = "COMMERCIAL";
    requirements.transactionType = transactionType || "RENT";
    requirements.commercial = {};
    if (seatsMatch) requirements.commercial.seats = Number.parseInt(seatsMatch[1], 10);
    if (cabinMatch) requirements.commercial.cabins = Number.parseInt(cabinMatch[1], 10);
    if (conferenceSeatsMatch) {
      requirements.commercial.conferenceSeats = Number.parseInt(conferenceSeatsMatch[1], 10);
    }
  }
  if (areaMatch) {
    const area = Number.parseFloat(areaMatch[1]);
    if (Number.isFinite(area)) {
      requirements.areaMin = area;
      requirements.areaMax = area;
      requirements.areaUnit = "SQ_FT";
    }
  }

  return Object.keys(requirements).length ? requirements : undefined;
};

const normalizeBulkLeadRow = ({ rawRow, mappedHeaders, sheetName = "" }) => {
  const row = {};
  const allCellValues = [];

  mappedHeaders.forEach((key, cellIndex) => {
    const value = normalizeBulkCellText(rawRow[cellIndex]);
    if (value) allCellValues.push(value);
    if (!key || !value) return;
    if (!row[key]) row[key] = value;
  });

  const phone = normalizeBulkPhone(row.phone)
    || allCellValues.map(normalizeBulkPhone).find(Boolean)
    || "";
  if (!phone) return null;

  const name = normalizeBulkCellText(row.name);
  const safeName = name && !normalizeBulkPhone(name) ? name : `Lead ${phone}`;
  const sourceText = normalizeBulkCellText(row.source).toUpperCase();
  const projectInterested = buildBulkLeadProjectSummary(row);
  const requirements = buildBulkLeadRequirements(row);
  const nextFollowUp = normalizeBulkDate(row.followUp);
  const lastContactedAt = normalizeBulkDate(row.date);

  return {
    name: safeName,
    phone,
    email: row.email || "",
    city: row.city || "",
    projectInterested,
    requirements,
    source: sourceText.includes("META") ? "META" : "MANUAL",
    status: resolveBulkLeadStatus({ sheetName, row }),
    nextFollowUp,
    lastContactedAt,
  };
};

const parseBulkLeadRowsFromMatrix = ({ matrix, sheetName = "" }) => {
  const headerIndex = matrix.findIndex((rawRow) => {
    const mappedHeaders = rawRow.map((cell) => resolveLeadCsvHeaderKey(cell));
    const mappedCount = mappedHeaders.filter(Boolean).length;
    return mappedCount >= 2 && (mappedHeaders.includes("phone") || mappedHeaders.includes("name"));
  });

  if (headerIndex < 0) return [];

  const mappedHeaders = matrix[headerIndex].map((header) => resolveLeadCsvHeaderKey(header));
  const hasName = mappedHeaders.includes("name");
  const rows = [];

  for (let rowIndex = headerIndex + 1; rowIndex < matrix.length; rowIndex += 1) {
    const row = normalizeBulkLeadRow({
      rawRow: matrix[rowIndex],
      mappedHeaders,
      sheetName,
    });
    if (!row) continue;
    if (!hasName && !row.name) continue;
    rows.push(row);
  }

  return rows;
};

const parseCsvLine = (line) => {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === "\"") {
      if (inQuotes && line[index + 1] === "\"") {
        current += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
};

const parseBulkLeadCsvRows = (csvText) => {
  const normalizedText = String(csvText || "")
    .replace(/^\uFEFF/, "")
    .trim();

  if (!normalizedText) {
    throw new Error("CSV data is required");
  }

  const rawLines = normalizedText.split(/\r?\n/);
  const lines = rawLines.map((line) => String(line || "").trim()).filter(Boolean);

  if (lines.length < 2) {
    throw new Error("CSV must include header and at least one data row");
  }

  const headerCells = parseCsvLine(lines[0]);
  const mappedHeaders = headerCells.map((header) => resolveLeadCsvHeaderKey(header));

  if (!mappedHeaders.includes("name") || !mappedHeaders.includes("phone")) {
    throw new Error("CSV header must include at least name and phone columns");
  }

  const rows = parseBulkLeadRowsFromMatrix({
    matrix: lines.map(parseCsvLine),
    sheetName: "CSV",
  });

  if (!rows.length) {
    throw new Error("No valid lead rows found in CSV");
  }

  return rows;
};

const WhatsAppIcon = ({ size = 13, className = "" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <path d="M13.601 2.326A7.854 7.854 0 0 0 8.005 0C3.58 0 0 3.577 0 8a7.9 7.9 0 0 0 1.153 4.095L0 16l4.01-1.127A7.9 7.9 0 0 0 8.005 16C12.425 16 16 12.423 16 8a7.85 7.85 0 0 0-2.399-5.674m-5.595 12.34a6.57 6.57 0 0 1-3.335-.908l-.24-.144-2.38.668.672-2.32-.157-.245a6.57 6.57 0 0 1-1.007-3.508c0-3.626 2.957-6.585 6.59-6.585a6.59 6.59 0 0 1 4.659 1.931A6.6 6.6 0 0 1 14.466 8c0 3.626-2.958 6.666-6.46 6.666m3.615-4.955c-.197-.1-1.17-.578-1.353-.645-.182-.065-.315-.1-.448.1-.132.197-.513.645-.627.776-.115.132-.23.149-.428.05-.197-.1-.833-.306-1.587-.977-.586-.52-.982-1.164-1.097-1.361-.115-.198-.012-.305.087-.404.09-.089.197-.23.296-.347.1-.115.132-.197.198-.33.065-.132.033-.248-.017-.347-.05-.1-.448-1.08-.613-1.48-.161-.387-.325-.334-.448-.34q-.182-.007-.396-.007a.76.76 0 0 0-.545.258c-.182.198-.694.678-.694 1.653s.71 1.92.81 2.052c.098.132 1.393 2.124 3.376 2.977.472.203.84.325 1.128.416.474.15.904.129 1.246.078.38-.057 1.17-.48 1.336-.944.164-.463.164-.86.115-.944-.05-.084-.182-.132-.38-.231" />
  </svg>
);

const LeadsMatrix = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { leadId: routeLeadId = "" } = useParams();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMoreLeads, setLoadingMoreLeads] = useState(false);
  const [leadPagination, setLeadPagination] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains("theme-dark"),
  );

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [savingLead, setSavingLead] = useState(false);
  const [formData, setFormData] = useState(defaultFormData);
  const [inventoryOptions, setInventoryOptions] = useState([]);
  const [isBulkUploadModalOpen, setIsBulkUploadModalOpen] = useState(false);
  const [bulkUploadText, setBulkUploadText] = useState("");
  const [bulkUploadParsedRows, setBulkUploadParsedRows] = useState(null);
  const [bulkUploadFileName, setBulkUploadFileName] = useState("");
  const [bulkUploading, setBulkUploading] = useState(false);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [propertySubtypeFilter, setPropertySubtypeFilter] = useState("");
  const [sortBy, setSortBy] = useState(LEAD_SORT_OPTIONS.RECENT);
  const [nowMs, setNowMs] = useState(0);
  const debouncedQuery = useDebouncedValue(query, 180);

  const [selectedLead, setSelectedLead] = useState(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const [activityLoading, setActivityLoading] = useState(false);
  const [activities, setActivities] = useState([]);
  const [diaryLoading, setDiaryLoading] = useState(false);
  const [diaryEntries, setDiaryEntries] = useState([]);
  const [diaryDraft, setDiaryDraft] = useState("");
  const [savingDiary, setSavingDiary] = useState(false);
  const [isDiaryMicSupported, setIsDiaryMicSupported] = useState(false);
  const [isDiaryListening, setIsDiaryListening] = useState(false);
  const [savingUpdates, setSavingUpdates] = useState(false);
  const [updatingInlineStatusId, setUpdatingInlineStatusId] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [linkingProperty, setLinkingProperty] = useState(false);
  const [propertyActionInventoryId, setPropertyActionInventoryId] = useState("");
  const [propertyActionType, setPropertyActionType] = useState("");

  const [nameDraft, setNameDraft] = useState("");
  const [phoneDraft, setPhoneDraft] = useState("");
  const [emailDraft, setEmailDraft] = useState("");
  const [cityDraft, setCityDraft] = useState("");
  const [projectInterestedDraft, setProjectInterestedDraft] = useState("");
  const [statusDraft, setStatusDraft] = useState("NEW");
  const [followUpDraft, setFollowUpDraft] = useState("");
  const [executiveDraft, setExecutiveDraft] = useState("");
  const [siteLatDraft, setSiteLatDraft] = useState("");
  const [siteLngDraft, setSiteLngDraft] = useState("");
  const [relatedInventoryDraft, setRelatedInventoryDraft] = useState("");
  const [paymentModeDraft, setPaymentModeDraft] = useState("");
  const [paymentTypeDraft, setPaymentTypeDraft] = useState("");
  const [paymentRemainingDraft, setPaymentRemainingDraft] = useState("");
  const [paymentReferenceDraft, setPaymentReferenceDraft] = useState("");
  const [paymentNoteDraft, setPaymentNoteDraft] = useState("");
  const [paymentApprovalStatusDraft, setPaymentApprovalStatusDraft] = useState("");
  const [paymentApprovalNoteDraft, setPaymentApprovalNoteDraft] = useState("");
  const [brokerageReceivedDraft, setBrokerageReceivedDraft] = useState("");
  const [brokerageDistributedDraft, setBrokerageDistributedDraft] = useState("0");
  const [closureDocumentsDraft, setClosureDocumentsDraft] = useState([]);
  const [requirementsDraft, setRequirementsDraft] = useState(
    createDefaultLeadRequirementsDraft(),
  );

  const [executives, setExecutives] = useState([]);
  const [transferReasonDraft, setTransferReasonDraft] = useState("");
  const [assigneeSearchDraft, setAssigneeSearchDraft] = useState("");
  const diaryRecognitionRef = useRef(null);

  const normalizedRouteLeadId = String(routeLeadId || "").trim();
  const isRouteDetailsView = Boolean(normalizedRouteLeadId);
  const currentLeadRouteBase = location.pathname.startsWith("/my-leads")
    ? "/my-leads"
    : "/leads";

  const userRole = localStorage.getItem("role") || "";
  const isExecutiveUser = EXECUTIVE_ROLES.includes(userRole);
  const currentUserId = getStoredUserId();
  const canAddLead =
    userRole === "ADMIN"
    || MANAGEMENT_ROLES.includes(userRole)
    || isExecutiveUser
    || userRole === "CHANNEL_PARTNER";
  const canBulkUploadLeads =
    userRole === "ADMIN" || MANAGEMENT_ROLES.includes(userRole) || isExecutiveUser;
  const canAssignLead = MANUAL_LEAD_TRANSFER_ACTOR_ROLES.includes(userRole);
  const canManageLeadProperties = userRole !== "CHANNEL_PARTNER";
  const canConfigureSiteLocation =
    userRole === "ADMIN" || MANAGEMENT_ROLES.includes(userRole);
  const canReviewDealPayment = userRole === "ADMIN";

  const fetchLeads = useCallback(async (asRefresh = false, options = {}) => {
    const page = Number(options.page || 1);
    const append = Boolean(options.append);
    try {
      if (append) {
        setLoadingMoreLeads(true);
      } else if (asRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError("");

      const response = await getLeadPool({
        page,
        limit: LEAD_LIST_PAGE_LIMIT,
        fields: LEAD_LIST_FIELDS,
        ...(isExecutiveUser && currentUserId ? { assignedTo: currentUserId } : {}),
      });
      const list = Array.isArray(response?.leads) ? response.leads : [];
      setLeadPagination(response?.pagination || null);
      setLeads((prev) => {
        if (!append) return list;
        const rowsById = new Map(prev.map((lead) => [String(lead?._id || ""), lead]));
        list.forEach((lead) => {
          const id = String(lead?._id || "");
          if (id) rowsById.set(id, lead);
        });
        return [...rowsById.values()];
      });
    } catch (fetchError) {
      const message = toErrorMessage(fetchError, "Failed to load leads");
      console.error(`Load leads failed: ${message}`);
      setError(message);
      if (!append) {
        setLeads([]);
        setLeadPagination(null);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMoreLeads(false);
    }
  }, [currentUserId, isExecutiveUser]);

  const fetchExecutives = useCallback(async () => {
    if (!canAssignLead) return;

    try {
      const response = await getUsers({
        crmAssignable: true,
        limit: 200,
        fields: "_id,name,role,isActive,lastAssignedAt",
      });
      const users = response?.users || [];
      const list = users.filter(
        (user) =>
          user.isActive !== false
          && MANUAL_LEAD_TRANSFER_TARGET_ROLES.includes(user.role),
      );
      setExecutives(list);
    } catch (fetchError) {
      const message = toErrorMessage(fetchError, "Failed to load transfer users");
      console.error(`Load transfer users failed: ${message}`);
      setExecutives([]);
    }
  }, [canAssignLead]);

  const fetchInventoryOptions = useCallback(async () => {
    if (!canManageLeadProperties) return;

    try {
      const rows = await getInventoryAssets({
        page: 1,
        limit: 200,
        fields: [
          "_id",
          "projectName",
          "towerName",
          "unitNumber",
          "propertyId",
          "inventoryType",
          "price",
          "type",
          "category",
          "furnishingStatus",
          "status",
          "location",
          "city",
          "area",
          "pincode",
          "totalArea",
          "commercialDetails",
          "residentialDetails",
          "siteLocation",
        ].join(","),
      });
      setInventoryOptions(Array.isArray(rows) ? rows : []);
    } catch (fetchError) {
      const message = toErrorMessage(fetchError, "Failed to load inventory");
      console.error(`Load inventory for leads failed: ${message}`);
      setInventoryOptions([]);
    }
  }, [canManageLeadProperties]);

  useEffect(() => {
    fetchLeads();
    fetchExecutives();
    fetchInventoryOptions();
  }, [fetchLeads, fetchExecutives, fetchInventoryOptions]);

  useEffect(() => {
    setNowMs(Date.now());
    const intervalId = window.setInterval(() => setNowMs(Date.now()), 60000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(""), 1600);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      setIsDark(root.classList.contains("theme-dark"));
    });
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!selectedLead) {
      if (relatedInventoryDraft !== "") {
        setRelatedInventoryDraft("");
      }
      return;
    }

    const linkedIds = new Set(
      getLeadRelatedInventories(selectedLead).map((row) => toObjectIdString(row)),
    );
    const available = inventoryOptions.filter(
      (inventory) =>
        toInventoryApiStatus(inventory?.status) === "Available"
        && !linkedIds.has(String(inventory?._id || "")),
    );

    const draftExists = available.some(
      (inventory) => String(inventory?._id || "") === String(relatedInventoryDraft || ""),
    );

    if (!draftExists && relatedInventoryDraft !== "") {
      setRelatedInventoryDraft("");
    }
  }, [selectedLead, inventoryOptions, relatedInventoryDraft]);

  useEffect(() => {
    if (isRouteDetailsView) return;

    const search = new URLSearchParams(location.search || "");
    const statusParam = String(search.get("status") || "").trim().toUpperCase();
    const queryParam = search.get("q");
    if (statusParam && LEAD_STATUS_SET.has(statusParam)) {
      setStatusFilter(statusParam);
    } else {
      setStatusFilter("ALL");
    }

    if (queryParam !== null) {
      setQuery(String(queryParam || ""));
    } else {
      setQuery("");
    }

  }, [isRouteDetailsView, location.search]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsDiaryMicSupported(false);
      return undefined;
    }

    setIsDiaryMicSupported(true);

    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsDiaryListening(true);
    };

    recognition.onend = () => {
      setIsDiaryListening(false);
    };

    recognition.onerror = (event) => {
      const speechError = String(event?.error || "");
      setIsDiaryListening(false);

      if (speechError === "not-allowed" || speechError === "service-not-allowed") {
        setError("Microphone permission denied. Please allow mic access in browser.");
        return;
      }

      if (speechError === "no-speech") {
        setError("No speech detected. Try speaking again.");
        return;
      }

      setError("Voice-to-text failed. Please try again.");
    };

    recognition.onresult = (event) => {
      const chunks = [];
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const transcript = String(event.results[index]?.[0]?.transcript || "").trim();
        if (transcript) {
          chunks.push(transcript);
        }
      }

      if (!chunks.length) return;

      const incomingText = chunks.join(" ");
      setDiaryDraft((prev) => {
        const normalizedPrev = String(prev || "").trimEnd();
        return normalizedPrev ? `${normalizedPrev} ${incomingText}` : incomingText;
      });
    };

    diaryRecognitionRef.current = recognition;

    return () => {
      try {
        recognition.stop();
      } catch {
        // no-op
      }
      diaryRecognitionRef.current = null;
    };
  }, []);

  const statusBreakdown = useMemo(
    () =>
      LEAD_STATUSES.reduce(
        (acc, status) => ({ ...acc, [status]: leads.filter((lead) => lead.status === status).length }),
        {},
      ),
    [leads],
  );

  const filteredLeads = useMemo(() => {
    const normalized = debouncedQuery.trim().toLowerCase();

    const filtered = leads.filter((lead) => {
      const statusMatch = statusFilter === "ALL" || lead.status === statusFilter;
      const leadPropertySubtype = String(lead?.requirements?.propertySubtype || "").trim().toUpperCase();
      const propertySubtypeMatch = !propertySubtypeFilter || leadPropertySubtype === propertySubtypeFilter;
      const relatedInventorySearchValue = getLeadRelatedInventories(lead)
        .map((inventory) => getInventoryLeadSearchText(inventory))
        .join(" ");

      const searchMatch =
        !normalized ||
        [
          lead.name,
          lead.phone,
          lead.email,
          lead.city,
          lead.projectInterested,
          lead.requirements?.inventoryType,
          lead.requirements?.propertySubtype,
          lead.assignedTo?.name,
          lead.createdBy?.name,
          lead.createdBy?.partnerCode,
          relatedInventorySearchValue,
        ]
          .map((value) => String(value || "").toLowerCase())
          .some((value) => value.includes(normalized));

      return statusMatch && propertySubtypeMatch && searchMatch;
    });

    const sorted = [...filtered];
    if (sortBy === LEAD_SORT_OPTIONS.NAME) {
      sorted.sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || "")));
      return sorted;
    }

    if (sortBy === LEAD_SORT_OPTIONS.FOLLOW_UP) {
      sorted.sort((a, b) => {
        const aMs = getDateMs(a?.nextFollowUp);
        const bMs = getDateMs(b?.nextFollowUp);
        if (!aMs && !bMs) return 0;
        if (!aMs) return 1;
        if (!bMs) return -1;
        return aMs - bMs;
      });
      return sorted;
    }

    sorted.sort((a, b) => {
      const aMs = getDateMs(a?.updatedAt || a?.createdAt);
      const bMs = getDateMs(b?.updatedAt || b?.createdAt);
      return bMs - aMs;
    });
    return sorted;
  }, [debouncedQuery, leads, propertySubtypeFilter, sortBy, statusFilter]);

  const metrics = useMemo(() => {
    const closed = statusBreakdown.CLOSED || 0;
    const contacted = statusBreakdown.CONTACTED || 0;
    const interested = statusBreakdown.INTERESTED || 0;
    const fresh = statusBreakdown.NEW || 0;
    const dueFollowUps = leads.filter((lead) => {
      const followUpMs = getDateMs(lead.nextFollowUp);
      return followUpMs > 0 && followUpMs <= nowMs && !["REQUESTED", "CLOSED", "LOST"].includes(String(lead.status || ""));
    }).length;

    const total = leads.length;
    const conversionRate = total > 0 ? Math.round((closed / total) * 100) : 0;

    return {
      total,
      new: fresh,
      contacted,
      interested,
      closed,
      dueFollowUps,
      conversionRate,
    };
  }, [leads, nowMs, statusBreakdown]);

  const openLeadDetails = useCallback(async (lead) => {
    const resolvedLeadId = String(lead?._id || "").trim();
    if (!resolvedLeadId) return;

    setSelectedLead(lead);
    setIsDetailsOpen(true);
    setActivityLoading(true);
    setDiaryLoading(true);

    let detailLead = lead;
    try {
      const fullLead = await getLeadById(resolvedLeadId);
      if (fullLead?._id) {
        detailLead = fullLead;
        setLeads((prev) =>
          prev.map((row) => (row._id === fullLead._id ? { ...row, ...fullLead } : row)),
        );
      }
    } catch (detailError) {
      const statusCode = Number(detailError?.response?.status || 0);
      if (statusCode === 404) {
        console.warn("Lead detail not available; returning to lead list");
        setIsDetailsOpen(false);
        setSelectedLead(null);
        setActivities([]);
        setDiaryEntries([]);
        setActivityLoading(false);
        setDiaryLoading(false);
        navigate(currentLeadRouteBase, { replace: true });
        return;
      }
      const message = toErrorMessage(detailError, "Failed to load lead details");
      console.error(`Load lead details failed: ${message}`);
      setError(message);
    }

    const leadSiteLat = toCoordinateNumber(detailLead?.siteLocation?.lat);
    const leadSiteLng = toCoordinateNumber(detailLead?.siteLocation?.lng);

    setSelectedLead(detailLead);
    setNameDraft(String(detailLead?.name || ""));
    setPhoneDraft(String(detailLead?.phone || ""));
    setEmailDraft(String(detailLead?.email || ""));
    setCityDraft(String(detailLead?.city || ""));
    setProjectInterestedDraft(String(detailLead?.projectInterested || ""));
    setStatusDraft(detailLead.status || "NEW");
    setFollowUpDraft(toDateTimeInput(detailLead.nextFollowUp));
    setSiteLatDraft(leadSiteLat === null ? "" : String(leadSiteLat));
    setSiteLngDraft(leadSiteLng === null ? "" : String(leadSiteLng));
    setExecutiveDraft(
      typeof detailLead.assignedTo === "string"
        ? detailLead.assignedTo
        : detailLead.assignedTo?._id || "",
    );
    setTransferReasonDraft("");
    setAssigneeSearchDraft("");
    setRelatedInventoryDraft("");
    setPaymentModeDraft(String(detailLead?.dealPayment?.mode || ""));
    setPaymentTypeDraft(String(detailLead?.dealPayment?.paymentType || ""));
    setPaymentRemainingDraft(
      detailLead?.dealPayment?.remainingAmount === null || detailLead?.dealPayment?.remainingAmount === undefined
        ? ""
        : String(detailLead.dealPayment.remainingAmount),
    );
    setPaymentReferenceDraft(String(detailLead?.dealPayment?.paymentReference || ""));
    setPaymentNoteDraft(String(detailLead?.dealPayment?.note || ""));
    setPaymentApprovalStatusDraft("");
    setPaymentApprovalNoteDraft(String(detailLead?.dealPayment?.approvalNote || ""));
    setBrokerageReceivedDraft(
      detailLead?.brokerageReceived === null || detailLead?.brokerageReceived === undefined
        ? ""
        : String(detailLead.brokerageReceived),
    );
    setBrokerageDistributedDraft(
      detailLead?.brokerageDistributed === null || detailLead?.brokerageDistributed === undefined
        ? "0"
        : String(detailLead.brokerageDistributed),
    );
    setClosureDocumentsDraft(sanitizeClosureDocumentList(detailLead?.closureDocuments));
    setRequirementsDraft(mapLeadRequirementsToDraft(detailLead?.requirements));
    setDiaryDraft("");

    const [timelineResult, diaryResult] = await Promise.allSettled([
      getLeadActivity(resolvedLeadId),
      getLeadDiary(resolvedLeadId),
    ]);

    if (timelineResult.status === "fulfilled") {
      setActivities(Array.isArray(timelineResult.value) ? timelineResult.value : []);
    } else {
      const message = toErrorMessage(timelineResult.reason, "Failed to load activity");
      console.error(`Load lead activity failed: ${message}`);
      setActivities([]);
    }

    if (diaryResult.status === "fulfilled") {
      setDiaryEntries(Array.isArray(diaryResult.value) ? diaryResult.value : []);
    } else {
      const message = toErrorMessage(diaryResult.reason, "Failed to load lead diary");
      console.error(`Load lead diary failed: ${message}`);
      setDiaryEntries([]);
    }

    setActivityLoading(false);
    setDiaryLoading(false);
  }, [currentLeadRouteBase, navigate]);

  const closeDetails = useCallback(() => {
    if (diaryRecognitionRef.current && isDiaryListening) {
      try {
        diaryRecognitionRef.current.stop();
      } catch {
        // no-op
      }
    }
    setIsDetailsOpen(false);
    setSelectedLead(null);
    setActivities([]);
    setDiaryEntries([]);
    setDiaryDraft("");
    setNameDraft("");
    setPhoneDraft("");
    setEmailDraft("");
    setCityDraft("");
    setProjectInterestedDraft("");
    setSiteLatDraft("");
    setSiteLngDraft("");
    setRelatedInventoryDraft("");
    setPaymentModeDraft("");
    setPaymentTypeDraft("");
    setPaymentRemainingDraft("");
    setPaymentReferenceDraft("");
    setPaymentNoteDraft("");
    setPaymentApprovalStatusDraft("");
    setPaymentApprovalNoteDraft("");
    setTransferReasonDraft("");
    setAssigneeSearchDraft("");
    setBrokerageReceivedDraft("");
    setBrokerageDistributedDraft("0");
    setClosureDocumentsDraft([]);
    setRequirementsDraft(createDefaultLeadRequirementsDraft());
    if (normalizedRouteLeadId) {
      navigate(currentLeadRouteBase);
    }
  }, [currentLeadRouteBase, isDiaryListening, navigate, normalizedRouteLeadId]);

  const handleOpenLeadDetailsPage = useCallback((lead) => {
    const resolvedLeadId = String(lead?._id || "").trim();
    if (!resolvedLeadId) return;
    navigate(`${currentLeadRouteBase}/${resolvedLeadId}`);
  }, [currentLeadRouteBase, navigate]);

  useEffect(() => {
    if (!isRouteDetailsView) {
      return;
    }

    if (loading) return;

    const selectedId = String(selectedLead?._id || "").trim();
    if (selectedId && selectedId === normalizedRouteLeadId && isDetailsOpen) {
      return;
    }

    const targetLead = leads.find(
      (lead) => String(lead?._id || "").trim() === normalizedRouteLeadId,
    );

    if (!targetLead) {
      openLeadDetails({ _id: normalizedRouteLeadId });
      return;
    }

    openLeadDetails(targetLead);
  }, [
    closeDetails,
    isDetailsOpen,
    isRouteDetailsView,
    leads,
    loading,
    normalizedRouteLeadId,
    openLeadDetails,
    selectedLead?._id,
  ]);

  const applyUpdatedLeadState = (updatedLead) => {
    if (!updatedLead) return;

    setLeads((prev) =>
      prev.map((lead) => (lead._id === updatedLead._id ? updatedLead : lead)),
    );
    setSelectedLead(updatedLead);
    setNameDraft(String(updatedLead?.name || ""));
    setPhoneDraft(String(updatedLead?.phone || ""));
    setEmailDraft(String(updatedLead?.email || ""));
    setCityDraft(String(updatedLead?.city || ""));
    setProjectInterestedDraft(String(updatedLead?.projectInterested || ""));
    setStatusDraft(String(updatedLead.status || "NEW"));
    setFollowUpDraft(toDateTimeInput(updatedLead?.nextFollowUp));

    const nextSiteLat = toCoordinateNumber(updatedLead?.siteLocation?.lat);
    const nextSiteLng = toCoordinateNumber(updatedLead?.siteLocation?.lng);
    setSiteLatDraft(nextSiteLat === null ? "" : String(nextSiteLat));
    setSiteLngDraft(nextSiteLng === null ? "" : String(nextSiteLng));
    setPaymentModeDraft(String(updatedLead?.dealPayment?.mode || ""));
    setPaymentTypeDraft(String(updatedLead?.dealPayment?.paymentType || ""));
    setPaymentRemainingDraft(
      updatedLead?.dealPayment?.remainingAmount === null
      || updatedLead?.dealPayment?.remainingAmount === undefined
        ? ""
        : String(updatedLead.dealPayment.remainingAmount),
    );
    setPaymentReferenceDraft(String(updatedLead?.dealPayment?.paymentReference || ""));
    setPaymentNoteDraft(String(updatedLead?.dealPayment?.note || ""));
    setPaymentApprovalStatusDraft("");
    setPaymentApprovalNoteDraft(String(updatedLead?.dealPayment?.approvalNote || ""));
    setBrokerageReceivedDraft(
      updatedLead?.brokerageReceived === null || updatedLead?.brokerageReceived === undefined
        ? ""
        : String(updatedLead.brokerageReceived),
    );
    setBrokerageDistributedDraft(
      updatedLead?.brokerageDistributed === null || updatedLead?.brokerageDistributed === undefined
        ? "0"
        : String(updatedLead.brokerageDistributed),
    );
    setClosureDocumentsDraft(sanitizeClosureDocumentList(updatedLead?.closureDocuments));
    setRequirementsDraft(mapLeadRequirementsToDraft(updatedLead?.requirements));
  };

  const applyInlineUpdatedLeadState = (updatedLead) => {
    if (!updatedLead?._id) return;

    setLeads((prev) =>
      prev.map((lead) => (lead._id === updatedLead._id ? updatedLead : lead)),
    );

    if (String(selectedLead?._id || "") === String(updatedLead._id)) {
      setSelectedLead(updatedLead);
      setStatusDraft(String(updatedLead.status || "NEW"));
    }
  };

  const handleInlineStatusChange = async (lead, nextStatus) => {
    const leadId = String(lead?._id || "").trim();
    const normalizedStatus = String(nextStatus || "").trim().toUpperCase();
    if (!leadId || !normalizedStatus || normalizedStatus === String(lead?.status || "").toUpperCase()) {
      return;
    }

    if (normalizedStatus === "CLOSED") {
      setError("Open lead details to enter Brokerage Received before closing the deal");
      handleOpenLeadDetailsPage(lead);
      return;
    }

    try {
      setUpdatingInlineStatusId(leadId);
      setError("");
      setLeads((prev) =>
        prev.map((row) =>
          String(row?._id || "") === leadId
            ? { ...row, status: normalizedStatus, updatedAt: new Date().toISOString() }
            : row),
      );
      if (String(selectedLead?._id || "") === leadId) {
        setSelectedLead((prev) =>
          prev ? { ...prev, status: normalizedStatus, updatedAt: new Date().toISOString() } : prev,
        );
      }

      const updatedLead = await updateLeadStatus(leadId, { status: normalizedStatus });

      if (!updatedLead) {
        await fetchLeads(true);
      } else {
        applyInlineUpdatedLeadState(updatedLead);
      }

      setSuccess(`Lead status updated to ${getStatusLabel(normalizedStatus)}`);
    } catch (statusError) {
      const message = toErrorMessage(statusError, "Failed to update lead status");
      console.error(`Inline lead status update failed: ${message}`);
      setLeads((prev) =>
        prev.map((row) =>
          String(row?._id || "") === leadId ? { ...row, status: lead.status } : row),
      );
      if (String(selectedLead?._id || "") === leadId) {
        setSelectedLead((prev) => (prev ? { ...prev, status: lead.status } : prev));
      }
      setError(message);
    } finally {
      setUpdatingInlineStatusId("");
    }
  };

  const handleInventorySelection = (inventoryId) => {
    setFormData((prev) => {
      const selectedInventory = inventoryOptions.find((item) => item._id === inventoryId);
      if (!selectedInventory) {
        return {
          ...prev,
          inventoryId,
        };
      }

      const inventoryProjectLabel = getInventoryLeadLabel(selectedInventory);
      const inventorySiteLat = toCoordinateNumber(selectedInventory?.siteLocation?.lat);
      const inventorySiteLng = toCoordinateNumber(selectedInventory?.siteLocation?.lng);
      const inventoryType = String(selectedInventory?.inventoryType || "").trim().toUpperCase();
      const transactionType = toRequirementTransactionType(selectedInventory?.type);
      const price = toAmountNumber(selectedInventory?.price);
      const commercialLayout = selectedInventory?.commercialDetails?.officeLayout || {};
      const commercialAmenities = selectedInventory?.commercialDetails?.amenities || {};
      const commercialBuilding = selectedInventory?.commercialDetails?.buildingDetails || {};
      const residentialDetails = selectedInventory?.residentialDetails || {};
      const residentialAmenities = residentialDetails?.amenities || {};
      const propertySubtype =
        inventoryType === "COMMERCIAL"
          ? String(selectedInventory?.commercialDetails?.officeType || "").trim().toUpperCase()
          : String(residentialDetails?.propertyType || "").trim().toUpperCase();
      const commercialSeats = toAmountNumber(commercialLayout?.seats);
      const commercialCabins = toAmountNumber(commercialLayout?.totalCabins);
      const commercialConferenceRooms = toAmountNumber(commercialLayout?.conferenceRooms);
      const commercialParkingSlots = toAmountNumber(commercialBuilding?.parkingSlots);
      const commercialParkingType = String(commercialBuilding?.parkingType || "").trim().toUpperCase();
      const residentialFloor = toAmountNumber(selectedInventory?.floorNumber);
      const residentialParking = toAmountNumber(residentialDetails?.parking);

      return {
        ...prev,
        inventoryId,
        projectInterested: inventoryProjectLabel || prev.projectInterested,
        city: getInventoryLeadCity(selectedInventory) || prev.city,
        siteLat: inventorySiteLat === null ? "" : String(inventorySiteLat),
        siteLng: inventorySiteLng === null ? "" : String(inventorySiteLng),
        requirementsInventoryType:
          inventoryType === "COMMERCIAL" || inventoryType === "RESIDENTIAL"
            ? inventoryType
            : prev.requirementsInventoryType,
        requirementsPropertySubtype:
          getPropertySubtypeConfig(inventoryType, propertySubtype)
            ? propertySubtype
            : prev.requirementsPropertySubtype,
        requirementsSubtypeData: {},
        requirementsTransactionType: transactionType,
        requirementsFurnishingStatus:
          String(selectedInventory?.furnishingStatus || "").trim().toUpperCase()
          || prev.requirementsFurnishingStatus,
        requirementsBudgetMin:
          price === null ? prev.requirementsBudgetMin : String(price),
        requirementsBudgetMax:
          price === null ? prev.requirementsBudgetMax : String(price),
        requirementsAreaMin: "",
        requirementsAreaMax: "",
        requirementsAreaUnit: "SQ_FT",
        requirementsCommercialSeats:
          commercialSeats === null
            ? prev.requirementsCommercialSeats
            : String(commercialSeats),
        requirementsCommercialCabins:
          commercialCabins === null
            ? prev.requirementsCommercialCabins
            : String(commercialCabins),
        requirementsCommercialConferenceRooms:
          commercialConferenceRooms === null
            ? prev.requirementsCommercialConferenceRooms
            : String(commercialConferenceRooms),
        requirementsCommercialParkingAvailable:
          (commercialParkingSlots !== null && commercialParkingSlots > 0)
          || (Boolean(commercialParkingType) && commercialParkingType !== "NONE"),
        requirementsCommercialPantry: Boolean(commercialAmenities?.pantry),
        requirementsCommercialReceptionArea: Boolean(commercialAmenities?.receptionArea),
        requirementsCommercialWaitingArea: Boolean(commercialAmenities?.waitingArea),
        requirementsCommercialCafeteria: Boolean(commercialAmenities?.cafeteria),
        requirementsCommercialServerRoom: Boolean(commercialAmenities?.serverRoom),
        requirementsCommercialStorageRoom: Boolean(commercialAmenities?.storageRoom),
        requirementsCommercialBreakoutArea: Boolean(commercialAmenities?.breakoutArea),
        requirementsCommercialLiftAvailable: Boolean(commercialAmenities?.liftAvailable),
        requirementsCommercialPowerBackup: Boolean(commercialAmenities?.powerBackup),
        requirementsCommercialCentralAC: Boolean(commercialAmenities?.centralAC),
        requirementsCommercialFireSafety: Boolean(commercialAmenities?.fireSafety),
        requirementsCommercialReadyToMove: Boolean(commercialAmenities?.readyToMove),
        requirementsCommercialUnderConstruction: Boolean(commercialAmenities?.underConstruction),
        requirementsResidentialBhkType:
          String(residentialDetails?.bhkType || "").trim().toUpperCase()
          || prev.requirementsResidentialBhkType,
        requirementsResidentialFloor:
          residentialFloor === null
            ? prev.requirementsResidentialFloor
            : String(residentialFloor),
        requirementsResidentialAmenityLift: Boolean(residentialAmenities?.lift),
        requirementsResidentialAmenitySecurity: Boolean(residentialAmenities?.security),
        requirementsResidentialAmenityGym: Boolean(residentialAmenities?.gym),
        requirementsResidentialAmenitySwimmingPool: Boolean(residentialAmenities?.swimmingPool),
        requirementsResidentialAmenityClubhouse: Boolean(residentialAmenities?.clubhouse),
        requirementsResidentialAmenityPowerBackup: Boolean(residentialAmenities?.powerBackup),
        requirementsResidentialAmenityParking:
          residentialParking !== null && residentialParking > 0,
        requirementsResidentialAmenityStudyRoom: Boolean(residentialAmenities?.studyRoom),
        requirementsResidentialAmenityServantRoom: Boolean(residentialAmenities?.servantRoom),
        requirementsResidentialAmenityModularKitchen: Boolean(residentialAmenities?.modularKitchen),
        requirementsResidentialAmenityElectricityBackup: Boolean(residentialAmenities?.electricityBackup),
        requirementsResidentialAmenityGasPipeline: Boolean(residentialAmenities?.gasPipeline),
      };
    });
  };

  const handleSaveLead = async () => {
    if (!canAddLead) return;

    if (!formData.name.trim() || !formData.phone.trim()) {
      setError("Name and phone are required");
      return;
    }

    const parsedSiteLat = toCoordinateNumber(formData.siteLat);
    const parsedSiteLng = toCoordinateNumber(formData.siteLng);
    const hasAnySiteCoordinate =
      parsedSiteLat !== null || parsedSiteLng !== null;

    if (
      hasAnySiteCoordinate
      && (parsedSiteLat === null || parsedSiteLng === null)
    ) {
      setError("Enter valid site latitude and longitude");
      return;
    }

    const requirementValidationError = validateLeadRequirementDraft({
      inventoryType: formData.requirementsInventoryType,
      propertySubtype: formData.requirementsPropertySubtype,
      budgetMin: formData.requirementsBudgetMin,
      budgetMax: formData.requirementsBudgetMax,
      subtypeData: formData.requirementsSubtypeData,
    });
    if (requirementValidationError) {
      setError(requirementValidationError);
      return;
    }

    try {
      setSavingLead(true);
      setError("");

      const payload = {
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim(),
        city: formData.city.trim(),
        preferredLocations: toPreferredLocationsList(formData.preferredLocations),
        projectInterested: formData.projectInterested.trim(),
      };

      if (formData.inventoryId) {
        payload.inventoryId = formData.inventoryId;
      }

      if (hasAnySiteCoordinate) {
        payload.siteLocation = {
          lat: parsedSiteLat,
          lng: parsedSiteLng,
          radiusMeters: SITE_VISIT_RADIUS_METERS,
        };
      }

      if (hasLeadRequirements(formData)) {
        const propertySubtype = String(formData.requirementsPropertySubtype || "").trim().toUpperCase();
        payload.requirements = {
          inventoryType: String(formData.requirementsInventoryType || "").trim().toUpperCase(),
          propertySubtype,
          subtypeData: sanitizeRequirementSubtypeData(formData.requirementsSubtypeData),
          transactionType: toRequirementTransactionType(formData.requirementsTransactionType),
          furnishingStatus: String(formData.requirementsFurnishingStatus || "").trim().toUpperCase(),
          budgetMin: toAmountNumber(formData.requirementsBudgetMin),
          budgetMax: toAmountNumber(formData.requirementsBudgetMax),
          areaMin: null,
          areaMax: null,
          areaUnit: null,
        };

        if (!propertySubtype) {
          payload.requirements.commercial = {
            seats: toAmountNumber(formData.requirementsCommercialSeats),
            cabins: toAmountNumber(formData.requirementsCommercialCabins),
            conferenceRooms: toAmountNumber(formData.requirementsCommercialConferenceRooms),
            conferenceSeats: toAmountNumber(formData.requirementsCommercialConferenceSeats),
            parkingAvailable: Boolean(formData.requirementsCommercialParkingAvailable),
            pantry: Boolean(formData.requirementsCommercialPantry),
            receptionArea: Boolean(formData.requirementsCommercialReceptionArea),
            waitingArea: Boolean(formData.requirementsCommercialWaitingArea),
            cafeteria: Boolean(formData.requirementsCommercialCafeteria),
            serverRoom: Boolean(formData.requirementsCommercialServerRoom),
            storageRoom: Boolean(formData.requirementsCommercialStorageRoom),
            breakoutArea: Boolean(formData.requirementsCommercialBreakoutArea),
            liftAvailable: Boolean(formData.requirementsCommercialLiftAvailable),
            powerBackup: Boolean(formData.requirementsCommercialPowerBackup),
            centralAC: Boolean(formData.requirementsCommercialCentralAC),
            fireSafety: Boolean(formData.requirementsCommercialFireSafety),
            readyToMove: Boolean(formData.requirementsCommercialReadyToMove),
            underConstruction: Boolean(formData.requirementsCommercialUnderConstruction),
          };
          payload.requirements.residential = {
            bhkType: String(formData.requirementsResidentialBhkType || "").trim().toUpperCase(),
            floor: toAmountNumber(formData.requirementsResidentialFloor),
            amenities: {
              lift: Boolean(formData.requirementsResidentialAmenityLift),
              security: Boolean(formData.requirementsResidentialAmenitySecurity),
              gym: Boolean(formData.requirementsResidentialAmenityGym),
              swimmingPool: Boolean(formData.requirementsResidentialAmenitySwimmingPool),
              clubhouse: Boolean(formData.requirementsResidentialAmenityClubhouse),
              powerBackup: Boolean(formData.requirementsResidentialAmenityPowerBackup),
              parking: Boolean(formData.requirementsResidentialAmenityParking),
              studyRoom: Boolean(formData.requirementsResidentialAmenityStudyRoom),
              servantRoom: Boolean(formData.requirementsResidentialAmenityServantRoom),
              modularKitchen: Boolean(formData.requirementsResidentialAmenityModularKitchen),
              electricityBackup: Boolean(formData.requirementsResidentialAmenityElectricityBackup),
              gasPipeline: Boolean(formData.requirementsResidentialAmenityGasPipeline),
            },
          };
        }
      }

      const created = await createLead(payload);

      if (created) {
        setLeads((prev) => [created, ...prev]);
      } else {
        await fetchLeads(true);
      }

      setIsAddModalOpen(false);
      setFormData(defaultFormData);
      setSuccess("Lead created successfully");
    } catch (saveError) {
      const message = toErrorMessage(saveError, "Failed to save lead");
      console.error(`Create lead failed: ${message}`);
      setError(message);
    } finally {
      setSavingLead(false);
    }
  };

  const handleBulkUploadFileSelect = async (file) => {
    if (!file) return;

    try {
      assertSupportedBulkLeadUploadFileName(file.name);
      const csvText = await file.text();
      setBulkUploadParsedRows(null);
      setBulkUploadText(String(csvText || ""));
      setBulkUploadFileName(String(file.name || ""));
      setError("");
    } catch (readError) {
      setBulkUploadParsedRows(null);
      setBulkUploadText("");
      setBulkUploadFileName("");
      setError(readError?.message === BULK_LEAD_CSV_ONLY_MESSAGE
        ? BULK_LEAD_CSV_ONLY_MESSAGE
        : "Unable to read selected bulk lead file");
    }
  };

  const handleBulkUploadLeads = async () => {
    if (!canBulkUploadLeads) return;

    try {
      setBulkUploading(true);
      setError("");

      const rows = Array.isArray(bulkUploadParsedRows)
        ? bulkUploadParsedRows
        : parseBulkLeadCsvRows(bulkUploadText);
      const result = await bulkUploadLeads(rows);
      await fetchLeads(true);

      const createdCount = Number(result?.createdCount || 0);
      const updatedCount = Number(result?.updatedCount || 0);
      const failedCount = Number(result?.failedCount || 0);
      setSuccess(
        `Bulk upload complete: ${createdCount} created, ${updatedCount} updated, ${failedCount} failed`,
      );

      const failures = Array.isArray(result?.failures) ? result.failures : [];
      if (failedCount > 0 && failures.length) {
        const preview = failures
          .slice(0, 5)
          .map((failure) => `Row ${failure.row}: ${failure.message}`)
          .join(" | ");
        setError(
          failures.length > 5
            ? `Some rows failed. ${preview} | ...`
            : `Some rows failed. ${preview}`,
        );
      } else {
        setIsBulkUploadModalOpen(false);
        setBulkUploadText("");
        setBulkUploadParsedRows(null);
        setBulkUploadFileName("");
      }
    } catch (uploadError) {
      const message = toErrorMessage(uploadError, "Failed to bulk upload leads");
      console.error(`Bulk upload leads failed: ${message}`);
      setError(message);
    } finally {
      setBulkUploading(false);
    }
  };

  const handleUpdateLead = async () => {
    if (!selectedLead) return;

    try {
      setSavingUpdates(true);
      setError("");

      const parsedSiteLat = toCoordinateNumber(siteLatDraft);
      const parsedSiteLng = toCoordinateNumber(siteLngDraft);
      const hasAnySiteCoordinate =
        parsedSiteLat !== null || parsedSiteLng !== null;
      const normalizedStatusDraft = String(statusDraft || "").trim().toUpperCase();
      const normalizedLeadStatus = String(selectedLead?.status || "").trim().toUpperCase();
      const normalizedNameDraft = String(nameDraft || "").trim();
      const normalizedPhoneDraft = String(phoneDraft || "").trim();
      const normalizedExistingPhone = String(selectedLead?.phone || "").trim();
      const normalizedEmailDraft = String(emailDraft || "").trim();
      const normalizedCityDraft = String(cityDraft || "").trim();
      const normalizedProjectInterestedDraft = String(projectInterestedDraft || "").trim();
      const normalizedFollowUpDraft = String(followUpDraft || "").trim();
      const hasFollowUpDraft = normalizedFollowUpDraft.length > 0;
      const parsedFollowUpDate = hasFollowUpDraft ? new Date(normalizedFollowUpDraft) : null;
      const parsedPaymentRemaining = toAmountNumber(paymentRemainingDraft);
      const existingPaymentRemaining = toAmountNumber(selectedLead?.dealPayment?.remainingAmount);
      const normalizedPaymentMode = String(paymentModeDraft || "").trim().toUpperCase();
      const normalizedPaymentType = String(paymentTypeDraft || "").trim().toUpperCase();
      const existingPaymentType = String(selectedLead?.dealPayment?.paymentType || "").trim().toUpperCase();
      const effectivePaymentType = normalizedPaymentType || existingPaymentType;
      const effectiveRemainingAmount =
        effectivePaymentType === "PARTIAL"
          ? (paymentRemainingDraft !== "" ? parsedPaymentRemaining : existingPaymentRemaining)
          : 0;
      const parsedBrokerageReceived = toAmountNumber(brokerageReceivedDraft);
      const parsedBrokerageDistributed = brokerageDistributedDraft === ""
        ? 0
        : toAmountNumber(brokerageDistributedDraft);
      const existingBrokerageReceived = toAmountNumber(selectedLead?.brokerageReceived);
      const effectiveBrokerageReceived =
        brokerageReceivedDraft !== "" ? parsedBrokerageReceived : existingBrokerageReceived;
      const normalizedApprovalStatus = String(paymentApprovalStatusDraft || "")
        .trim()
        .toUpperCase();
      const trimmedPaymentReference = String(paymentReferenceDraft || "").trim();
      const trimmedPaymentNote = String(paymentNoteDraft || "").trim();
      const trimmedApprovalNote = String(paymentApprovalNoteDraft || "").trim();
      const isClosedFlow =
        ["CLOSED", "REQUESTED"].includes(normalizedStatusDraft)
        || ["CLOSED", "REQUESTED"].includes(normalizedLeadStatus);
      const isClosingDealIntent =
        (
          normalizedStatusDraft === "CLOSED"
          && normalizedLeadStatus !== "CLOSED"
        )
        || (
          canReviewDealPayment
          && normalizedApprovalStatus === "APPROVED"
          && normalizedLeadStatus !== "CLOSED"
        );
      const isExecutiveClosingDeal =
        isExecutiveUser
        && normalizedStatusDraft === "CLOSED"
        && normalizedLeadStatus !== "CLOSED";
      const requiresRemainingPaymentFollowUp =
        isClosedFlow
        && effectivePaymentType === "PARTIAL"
        && Number.isFinite(effectiveRemainingAmount)
        && effectiveRemainingAmount > 0;

      if (
        canConfigureSiteLocation
        && hasAnySiteCoordinate
        && (parsedSiteLat === null || parsedSiteLng === null)
      ) {
        setError("Enter valid site latitude and longitude");
        setSavingUpdates(false);
        return;
      }

      if (!normalizedNameDraft) {
        setError("Name is required");
        setSavingUpdates(false);
        return;
      }

      if (
        normalizedPhoneDraft !== normalizedExistingPhone
        && (!normalizedPhoneDraft || !/^\d{8,15}$/.test(normalizedPhoneDraft))
      ) {
        setError("Phone should be 8 to 15 digits");
        setSavingUpdates(false);
        return;
      }

      if (hasFollowUpDraft && Number.isNaN(parsedFollowUpDate?.getTime())) {
        setError("Enter a valid follow-up date and time");
        setSavingUpdates(false);
        return;
      }

      if (trimmedPaymentNote.length > MAX_PAYMENT_NOTE_LENGTH) {
        setError(`Payment note can be up to ${MAX_PAYMENT_NOTE_LENGTH} characters only`);
        setSavingUpdates(false);
        return;
      }

      if (trimmedApprovalNote.length > MAX_PAYMENT_NOTE_LENGTH) {
        setError(`Approval note can be up to ${MAX_PAYMENT_NOTE_LENGTH} characters only`);
        setSavingUpdates(false);
        return;
      }

      if (isExecutiveClosingDeal) {
        if (!normalizedPaymentMode) {
          setError("Payment mode is required when closing the deal");
          setSavingUpdates(false);
          return;
        }
        if (!normalizedPaymentType) {
          setError("Payment type is required when closing the deal");
          setSavingUpdates(false);
          return;
        }
      }

      if (
        isClosedFlow
        && effectivePaymentType === "PARTIAL"
        && (effectiveRemainingAmount === null || effectiveRemainingAmount <= 0)
      ) {
        setError("Enter remaining amount greater than 0 for partial payment");
        setSavingUpdates(false);
        return;
      }

      if (isClosingDealIntent && (effectiveBrokerageReceived === null || effectiveBrokerageReceived < 0)) {
        setError("Brokerage Received is required and cannot be negative when closing the deal");
        setSavingUpdates(false);
        return;
      }

      if (isClosedFlow && (parsedBrokerageDistributed === null || parsedBrokerageDistributed < 0)) {
        setError("Brokerage Distributed cannot be negative");
        setSavingUpdates(false);
        return;
      }

      if (requiresRemainingPaymentFollowUp && !hasFollowUpDraft) {
        setError("Set follow-up date/time for remaining payment collection");
        setSavingUpdates(false);
        return;
      }

      if (
        isExecutiveUser
        && isClosedFlow
        && normalizedPaymentMode
        && normalizedPaymentMode !== "CASH"
        && !trimmedPaymentReference
      ) {
        setError("UTR / transaction / cheque number is required for non-cash payment");
        setSavingUpdates(false);
        return;
      }

      if (
        canReviewDealPayment
        && normalizedApprovalStatus
        && !["APPROVED", "REJECTED"].includes(normalizedApprovalStatus)
      ) {
        setError("Admin decision must be Approve or Reject");
        setSavingUpdates(false);
        return;
      }

      const requirementValidationError = validateLeadRequirementDraft(requirementsDraft);
      if (requirementValidationError) {
        setError(requirementValidationError);
        setSavingUpdates(false);
        return;
      }

      const payload = {
        name: normalizedNameDraft,
        phone: normalizedPhoneDraft,
        email: normalizedEmailDraft,
        city: normalizedCityDraft,
        projectInterested: normalizedProjectInterestedDraft,
        status: statusDraft,
        requirements: buildLeadRequirementsPayloadFromDraft(requirementsDraft),
      };

      if (hasFollowUpDraft) {
        payload.nextFollowUp = normalizedFollowUpDraft;
      }

      if (canConfigureSiteLocation && hasAnySiteCoordinate) {
        payload.siteLocation = {
          lat: parsedSiteLat,
          lng: parsedSiteLng,
          radiusMeters: SITE_VISIT_RADIUS_METERS,
        };
      }

      if (isClosedFlow) {
        const dealPaymentPayload = {};

        if (normalizedPaymentMode) {
          dealPaymentPayload.mode = normalizedPaymentMode;
        }

        if (normalizedPaymentType) {
          dealPaymentPayload.paymentType = normalizedPaymentType;
        }

        if (effectivePaymentType === "FULL") {
          dealPaymentPayload.remainingAmount = 0;
        } else if (effectivePaymentType === "PARTIAL" && effectiveRemainingAmount !== null) {
          dealPaymentPayload.remainingAmount = effectiveRemainingAmount;
        }

        if (normalizedPaymentMode === "CASH") {
          dealPaymentPayload.paymentReference = "";
        } else if (trimmedPaymentReference) {
          dealPaymentPayload.paymentReference = trimmedPaymentReference;
        }

        if (trimmedPaymentNote) {
          dealPaymentPayload.note = trimmedPaymentNote;
        }

        if (canReviewDealPayment) {
          if (normalizedApprovalStatus) {
            dealPaymentPayload.approvalStatus = normalizedApprovalStatus;
          }
          if (trimmedApprovalNote) {
            dealPaymentPayload.approvalNote = trimmedApprovalNote;
          }
        }

        if (Object.keys(dealPaymentPayload).length > 0) {
          payload.dealPayment = dealPaymentPayload;
        }

        if (isClosingDealIntent || brokerageReceivedDraft !== "" || brokerageDistributedDraft !== "") {
          if (effectiveBrokerageReceived !== null) {
            payload.brokerageReceived = effectiveBrokerageReceived;
          }
          payload.brokerageDistributed = parsedBrokerageDistributed || 0;
        }
      }

      if (String(statusDraft || "").toUpperCase() === "CLOSED") {
        payload.closureDocuments = sanitizeClosureDocumentList(closureDocumentsDraft);
      }

      const updatedLead = await updateLeadStatus(selectedLead._id, payload);

      if (!updatedLead) {
        await fetchLeads(true);
        setSuccess("Lead updated");
        return;
      }

      applyUpdatedLeadState(updatedLead);
      setSuccess("Lead updated");
    } catch (updateError) {
      const message = toErrorMessage(updateError, "Failed to update lead");
      console.error(`Update lead failed: ${message}`);
      setError(message);
    } finally {
      setSavingUpdates(false);
    }
  };

  const handleAssignLead = async () => {
    if (!canAssignLead || !selectedLead) return;
    if (!executiveDraft) {
      setError("Select a user to transfer this lead");
      return;
    }

    try {
      setAssigning(true);
      setError("");

      const updatedLead = await assignLead(selectedLead._id, {
        assignedTo: executiveDraft,
        reason: transferReasonDraft,
      });

      if (!updatedLead) {
        await fetchLeads(true);
        setIsDetailsOpen(false);
        setSelectedLead(null);
        setTransferReasonDraft("");
        setAssigneeSearchDraft("");
        setSuccess("Lead is transferred");
        navigate(currentLeadRouteBase);
        return;
      }

      setLeads((prev) =>
        prev.map((lead) => (lead._id === updatedLead._id ? updatedLead : lead)),
      );
      setSelectedLead(updatedLead);
      setExecutiveDraft(
        typeof updatedLead.assignedTo === "string"
          ? updatedLead.assignedTo
          : updatedLead.assignedTo?._id || "",
      );
      setTransferReasonDraft("");
      setAssigneeSearchDraft("");
      setIsDetailsOpen(false);
      setSelectedLead(null);
      setSuccess("Lead is transferred");
      navigate(currentLeadRouteBase);
      await fetchLeads(true);
    } catch (assignError) {
      const message = toErrorMessage(assignError, "Failed to transfer lead");
      console.error(`Transfer lead failed: ${message}`);
      setError(message);
    } finally {
      setAssigning(false);
    }
  };

  const handleLinkPropertyToLead = async (inventoryIdOverride = "") => {
    const inventoryId = String(inventoryIdOverride || relatedInventoryDraft || "").trim();
    if (!selectedLead || !inventoryId) return;

    const selectedInventory = inventoryOptions.find(
      (inventory) => String(inventory?._id || "") === inventoryId,
    );
    if (!selectedInventory || toInventoryApiStatus(selectedInventory?.status) !== "Available") {
      setError("Only available properties can be linked");
      return;
    }

    try {
      setLinkingProperty(true);
      setError("");

      const updatedLead = await addLeadRelatedProperty(
        selectedLead._id,
        inventoryId,
      );

      if (!updatedLead) {
        await fetchLeads(true);
        setSuccess("Property linked");
        return;
      }

      applyUpdatedLeadState(updatedLead);
      setRelatedInventoryDraft("");
      setSuccess("Property linked");
    } catch (linkError) {
      const message = toErrorMessage(linkError, "Failed to link property");
      console.error(`Link property failed: ${message}`);
      setError(message);
    } finally {
      setLinkingProperty(false);
    }
  };

  const handleSelectRelatedProperty = async (
    inventoryId,
    options = {},
  ) => {
    const resolvedInventoryId = String(inventoryId || "").trim();
    if (!selectedLead || !resolvedInventoryId) return false;
    const { showSuccess = true } = options;

    try {
      setPropertyActionType("select");
      setPropertyActionInventoryId(resolvedInventoryId);
      setError("");

      const updatedLead = await selectLeadRelatedProperty(
        selectedLead._id,
        resolvedInventoryId,
      );

      if (!updatedLead) {
        await fetchLeads(true);
        if (showSuccess) {
          setSuccess("Property selected");
        }
        return false;
      }

      applyUpdatedLeadState(updatedLead);
      if (showSuccess) {
        setSuccess("Property selected");
      }
      return true;
    } catch (selectError) {
      const message = toErrorMessage(selectError, "Failed to select property");
      console.error(`Select related property failed: ${message}`);
      setError(message);
      return false;
    } finally {
      setPropertyActionType("");
      setPropertyActionInventoryId("");
    }
  };

  const handleOpenRelatedProperty = async (inventoryId) => {
    const resolvedInventoryId = String(inventoryId || "").trim();
    if (!resolvedInventoryId) return;

    await handleSelectRelatedProperty(resolvedInventoryId, {
      showSuccess: false,
    });

    navigate(`/inventory/${resolvedInventoryId}`);
  };

  const handleRemoveRelatedProperty = async (inventoryId) => {
    const resolvedInventoryId = String(inventoryId || "").trim();
    if (!selectedLead || !resolvedInventoryId) return;

    const confirmed = window.confirm("Remove this property from lead?");
    if (!confirmed) return;

    try {
      setPropertyActionType("remove");
      setPropertyActionInventoryId(resolvedInventoryId);
      setError("");

      const updatedLead = await removeLeadRelatedProperty(
        selectedLead._id,
        resolvedInventoryId,
      );

      if (!updatedLead) {
        await fetchLeads(true);
        setSuccess("Property removed");
        return;
      }

      applyUpdatedLeadState(updatedLead);
      setRelatedInventoryDraft("");
      setSuccess("Property removed");
    } catch (removeError) {
      const message = toErrorMessage(removeError, "Failed to remove property");
      console.error(`Remove related property failed: ${message}`);
      setError(message);
    } finally {
      setPropertyActionType("");
      setPropertyActionInventoryId("");
    }
  };

  const handleAddDiary = async () => {
    if (!selectedLead) return;

    const note = diaryDraft.trim();
    if (!note) {
      setError("Diary note cannot be empty");
      return;
    }

    try {
      setSavingDiary(true);
      setError("");

      const createdEntry = await addLeadDiaryEntry(selectedLead._id, note);
      if (createdEntry) {
        setDiaryEntries((prev) => [createdEntry, ...prev]);
      } else {
        const diary = await getLeadDiary(selectedLead._id);
        setDiaryEntries(Array.isArray(diary) ? diary : []);
      }

      const timeline = await getLeadActivity(selectedLead._id);
      setActivities(Array.isArray(timeline) ? timeline : []);
      setDiaryDraft("");
      setSuccess("Diary note added");
    } catch (saveError) {
      const message = toErrorMessage(saveError, "Failed to save diary note");
      console.error(`Save lead diary failed: ${message}`);
      setError(message);
    } finally {
      setSavingDiary(false);
    }
  };

  const handleDiaryVoiceToggle = () => {
    if (!isDiaryMicSupported || !diaryRecognitionRef.current) {
      setError("Voice-to-text is not supported in this browser.");
      return;
    }

    setError("");

    try {
      if (isDiaryListening) {
        diaryRecognitionRef.current.stop();
        return;
      }
      diaryRecognitionRef.current.start();
    } catch {
      setError("Unable to start microphone. Try again.");
    }
  };

  const selectedLeadDialerHref = getDialerHref(selectedLead?.phone);
  const selectedLeadWhatsAppHref = getWhatsAppHref(selectedLead?.phone);
  const selectedLeadMailHref = getMailHref(selectedLead?.email);
  const selectedLeadMapsHref = getMapsHref(selectedLead?.city);
  const selectedLeadSiteLat = toCoordinateNumber(selectedLead?.siteLocation?.lat);
  const selectedLeadSiteLng = toCoordinateNumber(selectedLead?.siteLocation?.lng);
  const selectedLeadRelatedInventories = getLeadRelatedInventories(selectedLead);
  const selectedLeadActiveInventoryId = toObjectIdString(selectedLead?.inventoryId);
  const selectedLeadRequirementInventoryType = String(selectedLead?.requirements?.inventoryType || "").trim().toUpperCase();
  const selectedLeadRequirementSubtype = String(selectedLead?.requirements?.propertySubtype || "").trim().toUpperCase();
  const availableRelatedInventoryOptions = inventoryOptions.filter(
    (inventory) => {
      if (toInventoryApiStatus(inventory?.status) !== "Available") return false;
      const inventoryType = String(inventory?.inventoryType || "").trim().toUpperCase();
      if (selectedLeadRequirementInventoryType && inventoryType !== selectedLeadRequirementInventoryType) {
        return false;
      }
      if (selectedLeadRequirementSubtype) {
        const inventorySubtype = inventoryType === "COMMERCIAL"
          ? String(inventory?.commercialDetails?.officeType || "").trim().toUpperCase()
          : String(inventory?.residentialDetails?.propertyType || "").trim().toUpperCase();
        if (inventorySubtype && inventorySubtype !== selectedLeadRequirementSubtype) return false;
      }
      return true;
    },
  );

  return (
    <div
      className={`ui-page-shell relative h-full w-full overflow-x-hidden overflow-y-auto custom-scrollbar ${
        isDark ? "bg-slate-950" : ""
      }`}
    >
      <div className={`pointer-events-none absolute inset-0 ${
        isDark
          ? "bg-[radial-gradient(circle_at_9%_10%,rgba(56,189,248,0.18),transparent_35%),radial-gradient(circle_at_93%_16%,rgba(16,185,129,0.16),transparent_30%),radial-gradient(circle_at_50%_105%,rgba(30,41,59,0.65),transparent_50%)]"
          : "bg-[radial-gradient(circle_at_10%_9%,rgba(14,165,233,0.16),transparent_35%),radial-gradient(circle_at_90%_14%,rgba(16,185,129,0.14),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.45),rgba(241,245,249,0.82))]"
      }`} />
      <div className={`relative z-10 flex flex-col ${isRouteDetailsView ? "" : "flex-1"}`}>
        {isRouteDetailsView ? (
          <>
            <LeadsMatrixAlerts isDark={isDark} error={error} success={success} />

            {loading && !selectedLead ? (
              <div className={`ui-soft-panel flex min-h-[220px] items-center justify-center rounded-2xl text-sm ${
                isDark
                  ? "border-slate-700 bg-slate-900/75 text-slate-400"
                  : "border-slate-200 bg-white text-slate-500"
              }`}>
                Loading lead details...
              </div>
            ) : null}

            {!loading && !selectedLead ? (
              <div className={`ui-soft-panel rounded-2xl p-4 text-sm ${
                isDark
                  ? "border-rose-500/35 bg-rose-500/10 text-rose-100"
                  : "border-rose-200 bg-rose-50 text-rose-700"
              }`}>
                Lead details unavailable. The lead may be deleted or not accessible in your scope.
              </div>
            ) : null}
          </>
        ) : (
          <>
            <LeadsMatrixToolbar
              isDark={isDark}
              refreshing={refreshing}
              canAddLead={canAddLead}
              canBulkUploadLeads={canBulkUploadLeads}
              onRefresh={() => fetchLeads(true)}
              onOpenAddModal={() => setIsAddModalOpen(true)}
              onOpenBulkUploadModal={() => setIsBulkUploadModalOpen(true)}
              totalLeads={leadPagination?.totalCount ?? metrics.total}
              filteredLeads={filteredLeads.length}
              dueFollowUps={metrics.dueFollowUps}
            />

            <LeadsMatrixAlerts isDark={isDark} error={error} success={success} />

            <div className="z-30 -mx-2.5 px-2.5 pb-1 pt-0.5 md:sticky md:top-0 md:pb-2 md:pt-1 md:backdrop-blur-xl sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
              <LeadsMatrixFilters
                isDark={isDark}
                query={query}
                onQueryChange={setQuery}
                statusFilter={statusFilter}
                onStatusFilterChange={setStatusFilter}
                leadStatuses={LEAD_STATUSES}
                propertySubtypeFilter={propertySubtypeFilter}
                onPropertySubtypeFilterChange={setPropertySubtypeFilter}
                propertySubtypeOptions={ALL_PROPERTY_SUBTYPE_OPTIONS}
                sortBy={sortBy}
                onSortByChange={setSortBy}
                getStatusLabel={getStatusLabel}
              />
            </div>

            <LeadsMatrixTable
              isDark={isDark}
              loading={loading}
              filteredLeads={filteredLeads}
              statusBreakdown={statusBreakdown}
              onOpenLeadDetails={handleOpenLeadDetailsPage}
              canAssignLead={canAssignLead}
              onInlineStatusChange={handleInlineStatusChange}
              updatingInlineStatusId={updatingInlineStatusId}
              leadStatuses={LEAD_STATUSES}
              getStatusColor={getStatusColor}
              getStatusLabel={getStatusLabel}
              formatDate={formatDate}
              nowMs={nowMs}
            />

            {leadPagination?.hasNextPage ? (
              <div className="flex justify-center px-4 py-5">
                <button
                  type="button"
                  onClick={() =>
                    fetchLeads(true, {
                      page: Number(leadPagination.page || 1) + 1,
                      append: true,
                    })
                  }
                  disabled={loadingMoreLeads}
                  className={`rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-widest transition ${
                    isDark
                      ? "border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
                      : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  } disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  {loadingMoreLeads ? "Loading..." : "Load more leads"}
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>

      <AnimatePresence>
        {isAddModalOpen && canAddLead && (
          <AddLeadModal
            isDark={isDark}
            formData={formData}
            setFormData={setFormData}
            inventoryOptions={inventoryOptions}
            getInventoryLeadLabel={getInventoryLeadLabel}
            onInventorySelection={handleInventorySelection}
            onClose={() => setIsAddModalOpen(false)}
            onSave={handleSaveLead}
            savingLead={savingLead}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isBulkUploadModalOpen && canBulkUploadLeads && (
          <BulkLeadUploadModal
            isDark={isDark}
            csvText={bulkUploadText}
            onCsvTextChange={(value) => {
              setBulkUploadParsedRows(null);
              setBulkUploadText(value);
            }}
            selectedFileName={bulkUploadFileName}
            onFileSelect={handleBulkUploadFileSelect}
            onClose={() => setIsBulkUploadModalOpen(false)}
            onUpload={handleBulkUploadLeads}
            uploading={bulkUploading}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isRouteDetailsView && isDetailsOpen && selectedLead && (
          <div
            className="w-full"
          >
            <div
              className="w-full"
            >
              <LeadDetailsRebuilt
                isDark={isDark}
                selectedLead={selectedLead}
                onClose={closeDetails}
            selectedLeadDialerHref={selectedLeadDialerHref}
            selectedLeadWhatsAppHref={selectedLeadWhatsAppHref}
            selectedLeadMailHref={selectedLeadMailHref}
            selectedLeadMapsHref={selectedLeadMapsHref}
            selectedLeadRelatedInventories={selectedLeadRelatedInventories}
            selectedLeadActiveInventoryId={selectedLeadActiveInventoryId}
            propertyActionType={propertyActionType}
            propertyActionInventoryId={propertyActionInventoryId}
            canManageLeadProperties={canManageLeadProperties}
            toInventoryApiStatus={toInventoryApiStatus}
            toInventoryStatusLabel={toInventoryStatusLabel}
            onSelectRelatedProperty={handleSelectRelatedProperty}
            onOpenRelatedProperty={handleOpenRelatedProperty}
            onRemoveRelatedProperty={handleRemoveRelatedProperty}
            availableRelatedInventoryOptions={availableRelatedInventoryOptions}
            relatedInventoryDraft={relatedInventoryDraft}
            setRelatedInventoryDraft={setRelatedInventoryDraft}
            linkingProperty={linkingProperty}
            onLinkPropertyToLead={handleLinkPropertyToLead}
            leadStatuses={LEAD_STATUSES}
            nameDraft={nameDraft}
            setNameDraft={setNameDraft}
            phoneDraft={phoneDraft}
            setPhoneDraft={setPhoneDraft}
            emailDraft={emailDraft}
            setEmailDraft={setEmailDraft}
            cityDraft={cityDraft}
            setCityDraft={setCityDraft}
            projectInterestedDraft={projectInterestedDraft}
            setProjectInterestedDraft={setProjectInterestedDraft}
            statusDraft={statusDraft}
            setStatusDraft={setStatusDraft}
            requirementsDraft={requirementsDraft}
            setRequirementsDraft={setRequirementsDraft}
            followUpDraft={followUpDraft}
            setFollowUpDraft={setFollowUpDraft}
            dealPaymentModes={DEAL_PAYMENT_MODES}
            dealPaymentTypes={DEAL_PAYMENT_TYPES}
            dealPaymentAdminDecisions={DEAL_PAYMENT_ADMIN_DECISIONS}
            paymentModeDraft={paymentModeDraft}
            setPaymentModeDraft={setPaymentModeDraft}
            paymentTypeDraft={paymentTypeDraft}
            setPaymentTypeDraft={setPaymentTypeDraft}
            paymentRemainingDraft={paymentRemainingDraft}
            setPaymentRemainingDraft={setPaymentRemainingDraft}
            paymentReferenceDraft={paymentReferenceDraft}
            setPaymentReferenceDraft={setPaymentReferenceDraft}
            paymentNoteDraft={paymentNoteDraft}
            setPaymentNoteDraft={setPaymentNoteDraft}
            paymentApprovalStatusDraft={paymentApprovalStatusDraft}
            setPaymentApprovalStatusDraft={setPaymentApprovalStatusDraft}
            paymentApprovalNoteDraft={paymentApprovalNoteDraft}
            setPaymentApprovalNoteDraft={setPaymentApprovalNoteDraft}
            brokerageReceivedDraft={brokerageReceivedDraft}
            setBrokerageReceivedDraft={setBrokerageReceivedDraft}
            brokerageDistributedDraft={brokerageDistributedDraft}
            setBrokerageDistributedDraft={setBrokerageDistributedDraft}
            closureDocumentsDraft={closureDocumentsDraft}
            setClosureDocumentsDraft={setClosureDocumentsDraft}
            canReviewDealPayment={canReviewDealPayment}
            siteLatDraft={siteLatDraft}
            setSiteLatDraft={setSiteLatDraft}
            siteLngDraft={siteLngDraft}
            setSiteLngDraft={setSiteLngDraft}
            canConfigureSiteLocation={canConfigureSiteLocation}
            selectedLeadSiteLat={selectedLeadSiteLat}
            selectedLeadSiteLng={selectedLeadSiteLng}
            siteVisitRadiusMeters={SITE_VISIT_RADIUS_METERS}
            userRole={userRole}
            onUpdateLead={handleUpdateLead}
            savingUpdates={savingUpdates}
            canAssignLead={canAssignLead}
            executiveDraft={executiveDraft}
            setExecutiveDraft={setExecutiveDraft}
            executives={executives}
            transferReasonDraft={transferReasonDraft}
            setTransferReasonDraft={setTransferReasonDraft}
            assigneeSearchDraft={assigneeSearchDraft}
            setAssigneeSearchDraft={setAssigneeSearchDraft}
            onAssignLead={handleAssignLead}
            assigning={assigning}
            diaryDraft={diaryDraft}
            setDiaryDraft={setDiaryDraft}
            onDiaryVoiceToggle={handleDiaryVoiceToggle}
            savingDiary={savingDiary}
            isDiaryMicSupported={isDiaryMicSupported}
            isDiaryListening={isDiaryListening}
            onAddDiary={handleAddDiary}
            diaryLoading={diaryLoading}
            diaryEntries={diaryEntries}
            activityLoading={activityLoading}
            activities={activities}
            formatDate={formatDate}
            getInventoryLeadLabel={getInventoryLeadLabel}
            toObjectIdString={toObjectIdString}
            WhatsAppIcon={WhatsAppIcon}
              />
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LeadsMatrix;

