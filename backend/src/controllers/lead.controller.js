const Lead = require("../models/Lead");
const User = require("../models/User");
const Inventory = require("../models/Inventory");
const LeadActivity = require("../models/leadActivity.model");
const LeadDiary = require("../models/leadDiary.model");
const LeadStatusRequest = require("../models/LeadStatusRequest");
const logger = require("../config/logger");
const {
  autoAssignLead,
} = require("../services/leadAssignment.service");
const {
  USER_ROLES,
  EXECUTIVE_ROLES,
  MANAGEMENT_ROLES,
  isManagementRole,
} = require("../constants/role.constants");
const {
  getAncestorByRoles,
  getDescendantExecutiveIds,
} = require("../services/hierarchy.service");
const {
  parsePagination,
  buildPaginationMeta,
  parseFieldSelection,
} = require("../utils/queryOptions");

const LEAD_POPULATE_FIELDS = [
  { path: "assignedTo", select: "name role" },
  { path: "assignedManager", select: "name role" },
  { path: "assignedExecutive", select: "name role" },
  { path: "assignedFieldExecutive", select: "name role" },
  { path: "createdBy", select: "name role" },
  { path: "dealPayment.approvalRequestedBy", select: "name role" },
  { path: "dealPayment.approvalReviewedBy", select: "name role" },
  { path: "closureDocuments.uploadedBy", select: "name role" },
  {
    path: "inventoryId",
    select: "projectName towerName unitNumber location siteLocation status price type category images saleDetails",
  },
  {
    path: "relatedInventoryIds",
    select: "projectName towerName unitNumber location siteLocation status price type category images saleDetails",
  },
];

const LEAD_PAYMENT_REQUEST_POPULATE_FIELDS = [
  { path: "assignedTo", select: "name role phone email" },
  { path: "assignedManager", select: "name role phone email" },
  { path: "assignedExecutive", select: "name role phone email" },
  { path: "assignedFieldExecutive", select: "name role phone email" },
  { path: "createdBy", select: "name role phone email" },
  { path: "dealPayment.approvalRequestedBy", select: "name role phone email" },
  { path: "dealPayment.approvalReviewedBy", select: "name role phone email" },
  { path: "closureDocuments.uploadedBy", select: "name role phone email" },
  {
    path: "inventoryId",
    select: "projectName towerName unitNumber location siteLocation status price type category images documents saleDetails",
  },
  {
    path: "relatedInventoryIds",
    select: "projectName towerName unitNumber location siteLocation status price type category images documents saleDetails",
  },
];

const LEAD_SELECTABLE_FIELDS = [
  "_id",
  "name",
  "phone",
  "email",
  "city",
  "projectInterested",
  "inventoryId",
  "relatedInventoryIds",
  "siteLocation",
  "source",
  "status",
  "dealPayment",
  "closureDocuments",
  "assignedTo",
  "assignedManager",
  "assignedExecutive",
  "assignedFieldExecutive",
  "createdBy",
  "nextFollowUp",
  "lastContactedAt",
  "createdAt",
  "updatedAt",
];

const LEAD_ACTIVITY_SELECTABLE_FIELDS = [
  "_id",
  "lead",
  "action",
  "performedBy",
  "createdAt",
  "updatedAt",
];
const LEAD_DIARY_SELECTABLE_FIELDS = [
  "_id",
  "lead",
  "note",
  "createdBy",
  "createdAt",
  "updatedAt",
];

const FIELD_EXECUTIVE_ROLE = USER_ROLES.FIELD_EXECUTIVE;
const SITE_VISIT_STATUS = "SITE_VISIT";
const REQUESTED_STATUS = "REQUESTED";
const CLOSED_STATUS = "CLOSED";
const LEAD_STATUS_VALUES = Object.freeze([
  "NEW",
  "CONTACTED",
  "INTERESTED",
  "SITE_VISIT",
  "REQUESTED",
  "CLOSED",
  "LOST",
]);
const DEAL_PAYMENT_MODE_VALUES = Object.freeze([
  "UPI",
  "CASH",
  "CHECK",
  "NET_BANKING_NEFTRTGSIMPS",
]);
const DEAL_PAYMENT_TYPE_VALUES = Object.freeze(["FULL", "PARTIAL"]);
const DEAL_PAYMENT_APPROVAL_VALUES = Object.freeze([
  "PENDING",
  "APPROVED",
  "REJECTED",
]);
const ADMIN_PAYMENT_DECISION_VALUES = Object.freeze(["APPROVED", "REJECTED"]);
const EARTH_RADIUS_METERS = 6371000;
const DEFAULT_SITE_VISIT_RADIUS_METERS =
  Number.parseInt(process.env.SITE_VISIT_RADIUS_METERS, 10) || 200;
const SITE_VISIT_MAX_LOCATION_STALE_MINUTES =
  Number.parseInt(process.env.SITE_VISIT_MAX_LOCATION_STALE_MINUTES, 10) || 15;
const MAX_LEAD_DIARY_NOTE_LENGTH = 2000;
const MAX_PAYMENT_NOTE_LENGTH = 1000;
const MAX_PAYMENT_REFERENCE_LENGTH = 120;
const PERFORMANCE_WEEK_BUCKETS = 8;
const MAX_CLOSURE_DOCUMENTS = 20;
const MAX_CLOSURE_DOCUMENT_URL_LENGTH = 2048;
const MAX_CLOSURE_DOCUMENT_NAME_LENGTH = 180;
const MAX_CLOSURE_DOCUMENT_MIME_LENGTH = 120;
const MAX_CLOSURE_DOCUMENT_SIZE_BYTES = 25 * 1024 * 1024;
const MAX_LEAD_STATUS_REQUEST_NOTE_LENGTH = 500;

const isValidObjectId = (value) =>
  /^[a-fA-F0-9]{24}$/.test(String(value || "").trim());

const buildInventoryLeadProjectLabel = (inventory) =>
  [inventory?.projectName, inventory?.towerName, inventory?.unitNumber]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(" - ");

const toObjectIdString = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && value._id) return String(value._id);
  return String(value);
};

const buildLeadRelatedInventoryRefs = (lead = {}) => {
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
    lead.relatedInventoryIds.forEach((value) => pushUnique(value));
  }

  return merged;
};

const toLeadView = (lead) => {
  if (!lead) return null;

  return {
    ...lead,
    relatedInventoryIds: buildLeadRelatedInventoryRefs(lead),
  };
};

const buildCompanyInventoryQuery = ({ inventoryId, companyId }) => {
  const query = {
    _id: inventoryId,
  };
  if (companyId) {
    query.companyId = companyId;
  }
  return query;
};

const applyLeadSelectionFromInventory = ({ lead, inventory }) => {
  if (!lead || !inventory) return;

  const inventoryIdStr = String(inventory._id);
  const existingIds = buildLeadRelatedInventoryRefs(lead).map((value) =>
    toObjectIdString(value),
  );

  if (!existingIds.includes(inventoryIdStr)) {
    existingIds.push(inventoryIdStr);
  }

  lead.relatedInventoryIds = existingIds;
  lead.inventoryId = inventory._id;

  const projectLabel = buildInventoryLeadProjectLabel(inventory);
  if (projectLabel) {
    lead.projectInterested = projectLabel;
  }

  const inventoryLocation = String(inventory.location || "").trim();
  if (inventoryLocation) {
    lead.city = inventoryLocation;
  }

  const inventoryLat = normalizeLatitude(inventory?.siteLocation?.lat);
  const inventoryLng = normalizeLongitude(inventory?.siteLocation?.lng);
  if (inventoryLat !== null && inventoryLng !== null) {
    const existingRadius =
      normalizeRadiusMeters(lead?.siteLocation?.radiusMeters)
      || DEFAULT_SITE_VISIT_RADIUS_METERS;
    lead.siteLocation = {
      lat: inventoryLat,
      lng: inventoryLng,
      radiusMeters: existingRadius,
    };
  }
};

const toFiniteNumber = (value) => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string" && value.trim() === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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

const normalizeRadiusMeters = (value) => {
  if (value === undefined || value === null || value === "") {
    return DEFAULT_SITE_VISIT_RADIUS_METERS;
  }

  const parsed = toFiniteNumber(value);
  if (parsed === null || parsed < 50 || parsed > 2000) return null;
  return Math.round(parsed);
};

const parseSiteLocationPayload = (rawSiteLocation) => {
  if (rawSiteLocation === undefined) {
    return { provided: false };
  }

  if (rawSiteLocation === null) {
    return {
      provided: true,
      value: {
        lat: null,
        lng: null,
        radiusMeters: DEFAULT_SITE_VISIT_RADIUS_METERS,
      },
    };
  }

  if (typeof rawSiteLocation !== "object" || Array.isArray(rawSiteLocation)) {
    return { error: "siteLocation must be an object" };
  }

  const lat = normalizeLatitude(rawSiteLocation.lat);
  const lng = normalizeLongitude(rawSiteLocation.lng);
  const radiusMeters = normalizeRadiusMeters(rawSiteLocation.radiusMeters);

  if (lat === null || lng === null) {
    return { error: "Valid siteLocation.lat and siteLocation.lng are required" };
  }

  if (radiusMeters === null) {
    return { error: "siteLocation.radiusMeters must be between 50 and 2000" };
  }

  return {
    provided: true,
    value: {
      lat,
      lng,
      radiusMeters,
    },
  };
};

const normalizeEnumValue = (value) =>
  String(value || "").trim().toUpperCase();

const isValidHttpUrl = (value) => /^https?:\/\//i.test(String(value || "").trim());

const detectClosureDocumentKind = ({ kind, mimeType = "", url = "" } = {}) => {
  const normalizedKind = String(kind || "").trim().toLowerCase();
  if (["image", "pdf", "file"].includes(normalizedKind)) {
    return normalizedKind;
  }

  const normalizedMimeType = String(mimeType || "").trim().toLowerCase();
  if (normalizedMimeType.startsWith("image/")) return "image";
  if (normalizedMimeType === "application/pdf") return "pdf";

  const normalizedUrl = String(url || "").trim().toLowerCase();
  if (normalizedUrl.endsWith(".pdf")) return "pdf";
  return "file";
};

const sanitizeClosureDocument = (row = {}) => {
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    return null;
  }

  const url = String(row.url || row.secure_url || "").trim().slice(0, MAX_CLOSURE_DOCUMENT_URL_LENGTH);
  if (!url || !isValidHttpUrl(url)) {
    return null;
  }

  const mimeType = String(row.mimeType || row.type || "").trim().slice(0, MAX_CLOSURE_DOCUMENT_MIME_LENGTH);
  const name = String(row.name || row.original_filename || "").trim().slice(0, MAX_CLOSURE_DOCUMENT_NAME_LENGTH);
  const size = Math.max(0, Math.round(Number(row.size) || 0));
  const uploadedAt = row.uploadedAt ? new Date(row.uploadedAt) : null;

  return {
    url,
    kind: detectClosureDocumentKind({ kind: row.kind, mimeType, url }),
    mimeType,
    name,
    size,
    uploadedAt:
      uploadedAt && !Number.isNaN(uploadedAt.getTime())
        ? uploadedAt
        : new Date(),
    uploadedBy: isValidObjectId(row.uploadedBy) ? row.uploadedBy : null,
  };
};

const parseClosureDocumentsPayload = (rawClosureDocuments) => {
  if (rawClosureDocuments === undefined) {
    return { provided: false };
  }

  if (rawClosureDocuments === null) {
    return {
      provided: true,
      value: [],
    };
  }

  if (!Array.isArray(rawClosureDocuments)) {
    return { error: "closureDocuments must be an array" };
  }

  if (rawClosureDocuments.length > MAX_CLOSURE_DOCUMENTS) {
    return { error: `Maximum ${MAX_CLOSURE_DOCUMENTS} closure documents are allowed` };
  }

  const dedupe = new Set();
  const sanitized = [];

  for (let index = 0; index < rawClosureDocuments.length; index += 1) {
    const row = sanitizeClosureDocument(rawClosureDocuments[index]);
    if (!row) {
      return {
        error: `closureDocuments[${index}] must include a valid http/https url`,
      };
    }

    if (row.size > MAX_CLOSURE_DOCUMENT_SIZE_BYTES) {
      return {
        error: `closureDocuments[${index}] exceeds ${Math.round(MAX_CLOSURE_DOCUMENT_SIZE_BYTES / (1024 * 1024))}MB limit`,
      };
    }

    if (dedupe.has(row.url)) continue;
    dedupe.add(row.url);
    sanitized.push(row);
  }

  return {
    provided: true,
    value: sanitized,
  };
};

const isDealPaymentInputDefined = (rawDealPayment = {}) =>
  rawDealPayment.mode !== undefined
  || rawDealPayment.paymentType !== undefined
  || rawDealPayment.remainingAmount !== undefined
  || rawDealPayment.paymentReference !== undefined
  || rawDealPayment.note !== undefined;

const parseDealPaymentPayload = (rawDealPayment) => {
  if (rawDealPayment === undefined) {
    return { provided: false };
  }

  if (rawDealPayment === null) {
    return {
      provided: true,
      value: {
        mode: "",
        paymentType: "",
        remainingAmount: null,
        paymentReference: "",
        note: "",
        approvalStatus: "",
        approvalNote: "",
        hasRemainingAmount: false,
      },
    };
  }

  if (typeof rawDealPayment !== "object" || Array.isArray(rawDealPayment)) {
    return { error: "dealPayment must be an object" };
  }

  const mode = normalizeEnumValue(rawDealPayment.mode);
  const paymentType = normalizeEnumValue(rawDealPayment.paymentType);
  const approvalStatus = normalizeEnumValue(rawDealPayment.approvalStatus);
  const hasRemainingAmount = rawDealPayment.remainingAmount !== undefined;
  const remainingAmount = toFiniteNumber(rawDealPayment.remainingAmount);
  const paymentReference = String(rawDealPayment.paymentReference || "").trim();

  if (mode && !DEAL_PAYMENT_MODE_VALUES.includes(mode)) {
    return {
      error: `dealPayment.mode must be one of: ${DEAL_PAYMENT_MODE_VALUES.join(", ")}`,
    };
  }

  if (paymentType && !DEAL_PAYMENT_TYPE_VALUES.includes(paymentType)) {
    return {
      error: `dealPayment.paymentType must be one of: ${DEAL_PAYMENT_TYPE_VALUES.join(", ")}`,
    };
  }

  if (approvalStatus && !DEAL_PAYMENT_APPROVAL_VALUES.includes(approvalStatus)) {
    return {
      error: `dealPayment.approvalStatus must be one of: ${DEAL_PAYMENT_APPROVAL_VALUES.join(", ")}`,
    };
  }

  if (hasRemainingAmount && remainingAmount === null) {
    return { error: "dealPayment.remainingAmount must be a valid number" };
  }

  const note = String(rawDealPayment.note || "").trim();
  const approvalNote = String(rawDealPayment.approvalNote || "").trim();

  if (paymentReference.length > MAX_PAYMENT_REFERENCE_LENGTH) {
    return {
      error: `Payment reference cannot exceed ${MAX_PAYMENT_REFERENCE_LENGTH} characters`,
    };
  }

  if (note.length > MAX_PAYMENT_NOTE_LENGTH) {
    return {
      error: `Payment note cannot exceed ${MAX_PAYMENT_NOTE_LENGTH} characters`,
    };
  }

  if (approvalNote.length > MAX_PAYMENT_NOTE_LENGTH) {
    return {
      error: `Approval note cannot exceed ${MAX_PAYMENT_NOTE_LENGTH} characters`,
    };
  }

  return {
    provided: true,
    value: {
      mode,
      paymentType,
      remainingAmount,
      paymentReference,
      note,
      approvalStatus,
      approvalNote,
      hasRemainingAmount,
    },
  };
};

const getDealPaymentModeLabel = (mode) => {
  switch (mode) {
    case "NET_BANKING_NEFTRTGSIMPS":
      return "Net Banking (NEFT/RTGS/IMPS)";
    case "UPI":
      return "UPI";
    case "CASH":
      return "Cash";
    case "CHECK":
      return "Check";
    default:
      return String(mode || "").replaceAll("_", " ");
  }
};

const emitAdminPaymentRequestCreated = ({
  io,
  lead,
  requestedBy,
  companyId,
}) => {
  const resolvedCompanyId = String(companyId || "").trim();
  if (!io || !lead?._id || !resolvedCompanyId) return;

  const requestedAt = lead?.dealPayment?.approvalRequestedAt || new Date();
  const requestedAtIso = new Date(requestedAt).toISOString();
  const eventId = `lead-payment:${lead._id}:${new Date(requestedAtIso).getTime()}`;
  const payload = {
    eventId,
    source: "lead",
    requestType: "LEAD_PAYMENT_APPROVAL",
    leadId: lead._id,
    status: String(lead?.dealPayment?.approvalStatus || "PENDING").toUpperCase(),
    companyId: resolvedCompanyId,
    createdAt: requestedAtIso,
    message: "New lead payment approval request",
    lead: {
      _id: lead._id,
      name: lead.name || "",
      phone: lead.phone || "",
      projectInterested: lead.projectInterested || "",
      status: lead.status || "",
    },
    payment: {
      mode: lead?.dealPayment?.mode || "",
      paymentType: lead?.dealPayment?.paymentType || "",
      remainingAmount: lead?.dealPayment?.remainingAmount ?? null,
      paymentReference: lead?.dealPayment?.paymentReference || "",
      note: lead?.dealPayment?.note || "",
    },
    requestedBy: requestedBy
      ? {
        _id: requestedBy._id || null,
        name: requestedBy.name || "",
        role: requestedBy.role || "",
      }
      : null,
  };

  const adminRoom = `company:${resolvedCompanyId}:role:${USER_ROLES.ADMIN}`;
  io.to(adminRoom).emit("lead:payment:request:created", payload);
  io.to(adminRoom).emit("admin:request:new", payload);
};

const toRadians = (degrees) => (degrees * Math.PI) / 180;

const calculateDistanceMeters = (aLat, aLng, bLat, bLng) => {
  const dLat = toRadians(bLat - aLat);
  const dLng = toRadians(bLng - aLng);
  const lat1 = toRadians(aLat);
  const lat2 = toRadians(bLat);

  const haversine =
    Math.sin(dLat / 2) * Math.sin(dLat / 2)
    + Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);
  const arc = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));

  return EARTH_RADIUS_METERS * arc;
};

const isSiteLocationConfigured = (lead) =>
  normalizeLatitude(lead?.siteLocation?.lat) !== null
  && normalizeLongitude(lead?.siteLocation?.lng) !== null;

const resolveLiveLocationForVerification = (user) => {
  const lat = normalizeLatitude(user?.liveLocation?.lat);
  const lng = normalizeLongitude(user?.liveLocation?.lng);
  const updatedAtRaw = user?.liveLocation?.updatedAt;
  const updatedAt = updatedAtRaw ? new Date(updatedAtRaw) : null;
  const isFresh =
    updatedAt
    && !Number.isNaN(updatedAt.getTime())
    && Date.now() - updatedAt.getTime() <= SITE_VISIT_MAX_LOCATION_STALE_MINUTES * 60 * 1000;

  return {
    lat,
    lng,
    updatedAt,
    isFresh,
  };
};

const getLeadViewById = async (leadId, companyId = null) => {
  const query = { _id: leadId };
  if (companyId && isValidObjectId(companyId)) {
    query.companyId = companyId;
  }
  const row = await Lead.findOne(query).populate(LEAD_POPULATE_FIELDS).lean();
  return toLeadView(row);
};

const getExecutiveIdsForLeader = async (user) => getDescendantExecutiveIds({
  rootUserId: user?._id,
  companyId: user?.companyId || null,
});

const resolveLeadCompanyScope = (user) => {
  const companyId = toObjectIdString(user?.companyId);
  if (!isValidObjectId(companyId)) {
    return null;
  }

  return { companyId };
};

const buildLeadQueryForUser = async (user) => {
  const companyScope = resolveLeadCompanyScope(user);
  if (!companyScope) {
    return null;
  }

  if (user.role === USER_ROLES.ADMIN) {
    return companyScope;
  }

  if (isManagementRole(user.role)) {
    const execIds = await getExecutiveIdsForLeader(user);
    return {
      ...companyScope,
      $or: [
        { createdBy: user._id },
        { assignedTo: { $in: execIds } },
        { assignedTo: null },
      ],
    };
  }

  if (EXECUTIVE_ROLES.includes(user.role)) {
    return {
      ...companyScope,
      $or: [{ assignedTo: user._id }, { assignedTo: null }],
    };
  }

  if (user.role === USER_ROLES.CHANNEL_PARTNER) {
    return { ...companyScope, createdBy: user._id };
  }

  return null;
};

const normalizeDateBoundary = (rawValue, boundary = "start") => {
  if (!rawValue) return null;
  const parsed = new Date(String(rawValue));
  if (Number.isNaN(parsed.getTime())) return null;
  if (boundary === "end") {
    parsed.setHours(23, 59, 59, 999);
  } else {
    parsed.setHours(0, 0, 0, 0);
  }
  return parsed;
};

const parsePerformanceRange = (query = {}) => {
  const normalizedRange = String(query?.range || "ALL")
    .trim()
    .toUpperCase();

  if (normalizedRange === "ALL") {
    return {
      range: "ALL",
      startAt: null,
      endAt: null,
      periodLabel: "All data",
    };
  }

  if (normalizedRange === "THIS_MONTH") {
    const monthValue = String(query?.month || "").trim();
    let targetMonthDate = new Date();

    if (monthValue) {
      if (!/^\d{4}-\d{2}$/.test(monthValue)) {
        return { error: "month must be in YYYY-MM format" };
      }
      const [year, month] = monthValue.split("-").map((value) => Number.parseInt(value, 10));
      targetMonthDate = new Date(year, month - 1, 1);
    }

    if (Number.isNaN(targetMonthDate.getTime())) {
      return { error: "Invalid month value" };
    }

    const startAt = new Date(targetMonthDate.getFullYear(), targetMonthDate.getMonth(), 1, 0, 0, 0, 0);
    const endAt = new Date(targetMonthDate.getFullYear(), targetMonthDate.getMonth() + 1, 0, 23, 59, 59, 999);

    return {
      range: "THIS_MONTH",
      startAt,
      endAt,
      periodLabel: targetMonthDate.toLocaleString("en-IN", { month: "long", year: "numeric" }),
    };
  }

  if (normalizedRange === "CUSTOM") {
    const startAt = normalizeDateBoundary(query?.from, "start");
    const endAt = normalizeDateBoundary(query?.to, "end");

    if (!startAt || !endAt) {
      return { error: "from and to dates are required in YYYY-MM-DD format" };
    }

    if (endAt < startAt) {
      return { error: "to date cannot be before from date" };
    }

    return {
      range: "CUSTOM",
      startAt,
      endAt,
      periodLabel: `${startAt.toLocaleDateString("en-IN")} to ${endAt.toLocaleDateString("en-IN")}`,
    };
  }

  return { error: "Invalid range value" };
};

const getLeadTimelineDate = (lead) => {
  const raw = lead?.updatedAt || lead?.createdAt;
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const toWeekBuckets = (anchorDate, weeks = PERFORMANCE_WEEK_BUCKETS) => {
  const end = new Date(anchorDate);
  end.setHours(23, 59, 59, 999);
  const buckets = [];
  for (let i = weeks - 1; i >= 0; i -= 1) {
    const weekEnd = new Date(end);
    weekEnd.setDate(end.getDate() - i * 7);
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekEnd.getDate() - 6);
    weekStart.setHours(0, 0, 0, 0);
    buckets.push({
      label: `${weekStart.getDate()} ${weekStart.toLocaleString("en-IN", { month: "short" })}`,
      start: weekStart,
      end: weekEnd,
      created: 0,
      closed: 0,
      open: 0,
    });
  }
  return buckets;
};

const findWeekBucketIndex = (rawDate, buckets) => {
  if (!rawDate) return -1;
  const parsed = new Date(rawDate);
  if (Number.isNaN(parsed.getTime())) return -1;
  return buckets.findIndex((bucket) => parsed >= bucket.start && parsed <= bucket.end);
};

const buildCompanyPerformanceOverview = ({
  leads,
  users,
  periodEndDate,
}) => {
  const totalLeads = leads.length;
  const closed = leads.filter((lead) => String(lead.status || "").toUpperCase() === "CLOSED").length;
  const closeVelocity = totalLeads > 0 ? (closed / totalLeads) * 100 : 0;

  const anchorDate = periodEndDate
    || leads
      .map((lead) => getLeadTimelineDate(lead))
      .filter((value) => value instanceof Date)
      .sort((a, b) => b.getTime() - a.getTime())[0]
    || new Date();

  const weekBuckets = toWeekBuckets(anchorDate, PERFORMANCE_WEEK_BUCKETS);
  leads.forEach((lead) => {
    const createdIdx = findWeekBucketIndex(lead.createdAt, weekBuckets);
    if (createdIdx >= 0) {
      weekBuckets[createdIdx].created += 1;
    }

    if (String(lead.status || "").toUpperCase() === "CLOSED") {
      const closedIdx = findWeekBucketIndex(lead.updatedAt || lead.createdAt, weekBuckets);
      if (closedIdx >= 0) {
        weekBuckets[closedIdx].closed += 1;
      }
    }
  });
  weekBuckets.forEach((bucket) => {
    bucket.open = Math.max(0, bucket.created - bucket.closed);
  });

  const leaderboardRows = new Map();
  users.forEach((user) => {
    const role = String(user?.role || "").toUpperCase();
    if (role === USER_ROLES.ADMIN) return;
    const id = String(user?._id || "");
    if (!id) return;
    leaderboardRows.set(id, {
      id,
      name: String(user?.name || "User"),
      role,
      assigned: 0,
      closed: 0,
      visits: 0,
      scorePercent: 0,
    });
  });

  leads.forEach((lead) => {
    const assigned = lead?.assignedTo;
    if (!assigned || typeof assigned !== "object") return;
    const id = String(assigned?._id || "");
    if (!id) return;
    const row = leaderboardRows.get(id);
    if (!row) return;
    row.assigned += 1;
    const status = String(lead.status || "").toUpperCase();
    if (status === "CLOSED") row.closed += 1;
    if (status === "SITE_VISIT") row.visits += 1;
  });

  const leaderboard = Array.from(leaderboardRows.values())
    .map((row) => {
      const closeRate = row.assigned > 0 ? (row.closed / row.assigned) * 100 : 0;
      const visitRate = row.assigned > 0 ? (row.visits / row.assigned) * 100 : 0;
      return {
        ...row,
        scorePercent: Math.max(0, Math.min(100, Math.round(closeRate * 0.8 + visitRate * 0.2))),
      };
    })
    .sort((a, b) => b.scorePercent - a.scorePercent || b.closed - a.closed || b.assigned - a.assigned);

  return {
    summary: {
      totalLeads,
      closed,
      closeVelocity,
    },
    weekly: weekBuckets.map((row) => ({
      label: row.label,
      created: row.created,
      closed: row.closed,
      open: row.open,
    })),
    leaderboard,
  };
};

const findAccessibleLeadById = async ({ leadId, user }) => {
  if (!isValidObjectId(leadId)) {
    return null;
  }

  const scope = await buildLeadQueryForUser(user);
  if (!scope) {
    return null;
  }

  return Lead.findOne({
    _id: leadId,
    ...scope,
  })
    .select("_id companyId")
    .lean();
};

const applyLeadQueryOptions = ({
  queryBuilder,
  selectedFields,
  pagination,
}) => {
  if (selectedFields) {
    queryBuilder.select(selectedFields);
  }

  queryBuilder.populate(LEAD_POPULATE_FIELDS);
  queryBuilder.sort({ createdAt: -1 });

  if (pagination.enabled) {
    queryBuilder.skip(pagination.skip).limit(pagination.limit);
  }

  return queryBuilder.lean();
};

exports.createLead = async (req, res) => {
  try {
    const {
      name,
      phone,
      email,
      city,
      projectInterested,
      inventoryId: rawInventoryId,
      siteLocation: rawSiteLocation,
    } = req.body;

    const companyId = toObjectIdString(req.user?.companyId);
    if (!isValidObjectId(companyId)) {
      return res.status(403).json({ message: "Company context is required" });
    }

    const existing = await Lead.findOne({ phone, companyId }).select("_id").lean();
    if (existing) {
      return res.status(400).json({ message: "Lead already exists" });
    }

    const parsedSiteLocation = parseSiteLocationPayload(rawSiteLocation);
    if (parsedSiteLocation.error) {
      return res.status(400).json({ message: parsedSiteLocation.error });
    }

    const inventoryId = String(rawInventoryId || "").trim();
    let inventory = null;

    if (inventoryId) {
      if (!/^[a-fA-F0-9]{24}$/.test(inventoryId)) {
        return res.status(400).json({ message: "Invalid inventory id" });
      }

      const inventoryQuery = { _id: inventoryId };
      if (req.user?.companyId) {
        inventoryQuery.companyId = req.user.companyId;
      }

      inventory = await Inventory.findOne(inventoryQuery)
        .select("_id projectName towerName unitNumber location siteLocation")
        .lean();

      if (!inventory) {
        return res.status(404).json({ message: "Inventory not found" });
      }
    }

    const resolvedProjectInterested =
      String(projectInterested || "").trim()
      || buildInventoryLeadProjectLabel(inventory);

    const resolvedCity =
      String(city || "").trim()
      || String(inventory?.location || "").trim();

    const createPayload = {
      name,
      phone,
      email,
      city: resolvedCity,
      projectInterested: resolvedProjectInterested,
      companyId,
      source: "MANUAL",
      createdBy: req.user._id,
    };

    if (inventory) {
      createPayload.inventoryId = inventory._id;
      createPayload.relatedInventoryIds = [inventory._id];
    }

    if (parsedSiteLocation.provided) {
      createPayload.siteLocation = parsedSiteLocation.value;
    } else {
      const inventorySiteLat = normalizeLatitude(inventory?.siteLocation?.lat);
      const inventorySiteLng = normalizeLongitude(inventory?.siteLocation?.lng);

      if (inventorySiteLat !== null && inventorySiteLng !== null) {
        createPayload.siteLocation = {
          lat: inventorySiteLat,
          lng: inventorySiteLng,
          radiusMeters: DEFAULT_SITE_VISIT_RADIUS_METERS,
        };
      }
    }

    const lead = await Lead.create(createPayload);
    const shouldAutoAssignLead = req.user.role !== USER_ROLES.CHANNEL_PARTNER;

    if (shouldAutoAssignLead) {
      await autoAssignLead({
        lead,
        requester: req.user,
        performedBy: req.user._id,
      });
    } else {
      await LeadActivity.create({
        lead: lead._id,
        action: "Lead created by channel partner and pending admin assignment",
        performedBy: req.user._id,
      });
    }

    const populatedLead = await getLeadViewById(lead._id, companyId);

    return res.status(201).json({
      message: shouldAutoAssignLead
        ? "Lead created and assignment processed"
        : "Lead created successfully",
      lead: populatedLead,
    });
  } catch (error) {
    logger.error({
      requestId: req.requestId || null,
      error: error.message,
      message: "createLead failed",
    });
    return res.status(500).json({ message: "Server error" });
  }
};

exports.getAllLeads = async (req, res) => {
  try {
    const query = await buildLeadQueryForUser(req.user);
    if (!query) {
      return res.status(403).json({ message: "Access denied" });
    }

    const pagination = parsePagination(req.query, {
      defaultLimit: Number.parseInt(process.env.LEADS_PAGE_LIMIT, 10) || 50,
      maxLimit: Number.parseInt(process.env.LEADS_PAGE_MAX_LIMIT, 10) || 200,
    });
    const selectedFields = parseFieldSelection(
      req.query?.fields,
      LEAD_SELECTABLE_FIELDS,
    );

    const leadsQuery = applyLeadQueryOptions({
      queryBuilder: Lead.find(query),
      selectedFields,
      pagination,
    });

    if (!pagination.enabled) {
      const leads = (await leadsQuery).map((lead) => toLeadView(lead));
      return res.json({ leads });
    }

    const [leadRows, totalCount] = await Promise.all([
      leadsQuery,
      Lead.countDocuments(query),
    ]);
    const leads = leadRows.map((lead) => toLeadView(lead));

    return res.json({
      leads,
      pagination: buildPaginationMeta({
        page: pagination.page,
        limit: pagination.limit,
        totalCount,
      }),
    });
  } catch (error) {
    logger.error({
      requestId: req.requestId || null,
      error: error.message,
      message: "getAllLeads failed",
    });
    return res.status(500).json({ message: "Server error" });
  }
};

exports.getCompanyPerformanceOverview = async (req, res) => {
  try {
    if (!req.user?.companyId) {
      return res.status(403).json({ message: "Company context is required" });
    }

    const rangeMeta = parsePerformanceRange(req.query || {});
    if (rangeMeta?.error) {
      return res.status(400).json({ message: rangeMeta.error });
    }

    const companyUsers = await User.find({ companyId: req.user.companyId })
      .select("_id name role isActive")
      .lean();

    const companyUserIds = companyUsers
      .map((user) => user?._id)
      .filter(Boolean);

    const leadScopeQuery = companyUserIds.length
      ? {
        companyId: req.user.companyId,
        $or: [
          { assignedTo: { $in: companyUserIds } },
          { createdBy: { $in: companyUserIds } },
          { assignedManager: { $in: companyUserIds } },
          { assignedExecutive: { $in: companyUserIds } },
          { assignedFieldExecutive: { $in: companyUserIds } },
        ],
      }
      : { companyId: req.user.companyId, _id: null };

    const leadRows = await Lead.find(leadScopeQuery)
      .select("_id status createdAt updatedAt assignedTo")
      .populate({ path: "assignedTo", select: "name role" })
      .lean();

    const scopedLeads = leadRows.filter((lead) => {
      const leadDate = getLeadTimelineDate(lead);
      if (!leadDate) return false;
      if (rangeMeta.startAt && leadDate < rangeMeta.startAt) return false;
      if (rangeMeta.endAt && leadDate > rangeMeta.endAt) return false;
      return true;
    });

    const leaderboardUsers = companyUsers.filter((user) => user?.isActive !== false);
    const overview = buildCompanyPerformanceOverview({
      leads: scopedLeads,
      users: leaderboardUsers,
      periodEndDate: rangeMeta.endAt || null,
    });

    return res.json({
      overview: {
        ...overview,
        range: rangeMeta.range,
        periodLabel: rangeMeta.periodLabel,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error({
      requestId: req.requestId || null,
      error: error.message,
      message: "getCompanyPerformanceOverview failed",
    });
    return res.status(500).json({ message: "Server error" });
  }
};

exports.assignLead = async (req, res) => {
  try {
    const { leadId } = req.params;
    const { executiveId } = req.body;

    const lead = await Lead.findOne({
      _id: leadId,
      companyId: req.user.companyId,
    });
    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    const executive = await User.findOne({
      _id: executiveId,
      companyId: req.user.companyId,
      isActive: true,
    });
    if (!executive || !EXECUTIVE_ROLES.includes(executive.role)) {
      return res.status(400).json({ message: "Invalid executive" });
    }

    if (isManagementRole(req.user.role) && req.user.role !== USER_ROLES.ADMIN) {
      const teamExecutiveIds = new Set(
        (await getExecutiveIdsForLeader(req.user)).map((item) => String(item)),
      );

      const targetExecutiveId = String(executive._id);
      const leadAssigneeId = String(lead.assignedTo || "");
      const leadAssignedManagerId = String(lead.assignedManager || "");
      const leadCreatorId = String(lead.createdBy || "");
      const managerId = String(req.user._id);

      if (!teamExecutiveIds.has(targetExecutiveId)) {
        return res.status(403).json({
          message: "Leads can be assigned only to your team executives",
        });
      }

      const canManageLead =
        !leadAssigneeId
        || teamExecutiveIds.has(leadAssigneeId)
        || leadAssignedManagerId === managerId
        || leadCreatorId === managerId;

      if (!canManageLead) {
        return res.status(403).json({
          message: "You can assign only your own team leads",
        });
      }
    }

    const topManager = await getAncestorByRoles({
      user: executive,
      targetRoles: [USER_ROLES.MANAGER],
      companyId: executive.companyId || null,
      select: "_id role parentId companyId isActive",
    });

    lead.assignedTo = executive._id;
    lead.assignedManager = topManager?._id || executive.parentId || null;
    lead.assignedExecutive = executive.role === USER_ROLES.EXECUTIVE ? executive._id : null;
    lead.assignedFieldExecutive =
      executive.role === USER_ROLES.FIELD_EXECUTIVE ? executive._id : null;
    await lead.save();

    await User.updateOne(
      { _id: executive._id },
      { $set: { lastAssignedAt: new Date() } },
    );

    await LeadActivity.create({
      lead: lead._id,
      action: `Manually assigned to ${executive.name}`,
      performedBy: req.user._id,
    });

    const populatedLead = await getLeadViewById(lead._id, req.user.companyId);

    return res.json({
      message: "Lead assigned successfully",
      lead: populatedLead,
    });
  } catch (error) {
    logger.error({
      requestId: req.requestId || null,
      error: error.message,
      message: "assignLead failed",
    });
    return res.status(500).json({ message: "Server error" });
  }
};

exports.addRelatedPropertyToLead = async (req, res) => {
  try {
    if (req.user.role === USER_ROLES.CHANNEL_PARTNER) {
      return res.status(403).json({
        message: "Channel partners are not allowed to link properties",
      });
    }

    const { leadId } = req.params;
    const rawInventoryId = String(req.body?.inventoryId || "").trim();

    if (!isValidObjectId(leadId)) {
      return res.status(400).json({ message: "Invalid lead id" });
    }
    if (!isValidObjectId(rawInventoryId)) {
      return res.status(400).json({ message: "Valid inventoryId is required" });
    }

    const accessibleLead = await findAccessibleLeadById({
      leadId,
      user: req.user,
    });
    if (!accessibleLead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    const inventory = await Inventory.findOne(
      buildCompanyInventoryQuery({
        inventoryId: rawInventoryId,
        companyId: req.user.companyId,
      }),
    )
      .select("_id projectName towerName unitNumber location siteLocation status")
      .lean();
    if (!inventory) {
      return res.status(404).json({ message: "Inventory not found" });
    }
    if (String(inventory.status || "").trim().toLowerCase() !== "available") {
      return res.status(400).json({ message: "Only available properties can be linked" });
    }

    const lead = await Lead.findOne({
      _id: leadId,
      companyId: req.user.companyId,
    });
    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    const existingIds = buildLeadRelatedInventoryRefs(lead).map((value) =>
      toObjectIdString(value),
    );
    const inventoryIdStr = String(inventory._id);

    if (existingIds.includes(inventoryIdStr)) {
      const populatedLead = await getLeadViewById(lead._id, req.user.companyId);
      return res.json({
        message: "Property already linked to this lead",
        lead: populatedLead,
      });
    }

    applyLeadSelectionFromInventory({
      lead,
      inventory,
    });

    await lead.save();

    await LeadActivity.create({
      lead: lead._id,
      action: `Property linked: ${buildInventoryLeadProjectLabel(inventory) || inventoryIdStr}`,
      performedBy: req.user._id,
    });

    const populatedLead = await getLeadViewById(lead._id, req.user.companyId);

    return res.json({
      message: "Property linked to lead",
      lead: populatedLead,
    });
  } catch (error) {
    logger.error({
      requestId: req.requestId || null,
      error: error.message,
      message: "addRelatedPropertyToLead failed",
    });
    return res.status(500).json({ message: "Server error" });
  }
};

exports.selectRelatedPropertyForLead = async (req, res) => {
  try {
    if (req.user.role === USER_ROLES.CHANNEL_PARTNER) {
      return res.status(403).json({
        message: "Channel partners are not allowed to select lead properties",
      });
    }

    const { leadId, inventoryId } = req.params;
    if (!isValidObjectId(leadId) || !isValidObjectId(inventoryId)) {
      return res.status(400).json({ message: "Invalid lead or inventory id" });
    }

    const accessibleLead = await findAccessibleLeadById({
      leadId,
      user: req.user,
    });
    if (!accessibleLead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    const inventory = await Inventory.findOne(
      buildCompanyInventoryQuery({
        inventoryId,
        companyId: req.user.companyId,
      }),
    )
      .select("_id projectName towerName unitNumber location siteLocation")
      .lean();
    if (!inventory) {
      return res.status(404).json({ message: "Inventory not found" });
    }

    const lead = await Lead.findOne({
      _id: leadId,
      companyId: req.user.companyId,
    });
    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    applyLeadSelectionFromInventory({
      lead,
      inventory,
    });
    await lead.save();

    await LeadActivity.create({
      lead: lead._id,
      action: `Property selected for site location: ${buildInventoryLeadProjectLabel(inventory) || String(inventory._id)}`,
      performedBy: req.user._id,
    });

    const populatedLead = await getLeadViewById(lead._id, req.user.companyId);
    return res.json({
      message: "Property selected",
      lead: populatedLead,
    });
  } catch (error) {
    logger.error({
      requestId: req.requestId || null,
      error: error.message,
      message: "selectRelatedPropertyForLead failed",
    });
    return res.status(500).json({ message: "Server error" });
  }
};

exports.removeRelatedPropertyFromLead = async (req, res) => {
  try {
    if (req.user.role === USER_ROLES.CHANNEL_PARTNER) {
      return res.status(403).json({
        message: "Channel partners are not allowed to unlink lead properties",
      });
    }

    const { leadId, inventoryId } = req.params;
    if (!isValidObjectId(leadId) || !isValidObjectId(inventoryId)) {
      return res.status(400).json({ message: "Invalid lead or inventory id" });
    }

    const accessibleLead = await findAccessibleLeadById({
      leadId,
      user: req.user,
    });
    if (!accessibleLead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    const lead = await Lead.findOne({
      _id: leadId,
      companyId: req.user.companyId,
    });
    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    const existingIds = buildLeadRelatedInventoryRefs(lead).map((value) =>
      toObjectIdString(value),
    );
    const targetInventoryId = String(inventoryId);

    if (!existingIds.includes(targetInventoryId)) {
      const populatedLead = await getLeadViewById(lead._id, req.user.companyId);
      return res.json({
        message: "Property is already not linked",
        lead: populatedLead,
      });
    }

    const nextIds = existingIds.filter((id) => id !== targetInventoryId);
    lead.relatedInventoryIds = nextIds;

    if (!nextIds.length) {
      lead.inventoryId = null;
      lead.siteLocation = {
        lat: null,
        lng: null,
        radiusMeters:
          normalizeRadiusMeters(lead?.siteLocation?.radiusMeters)
          || DEFAULT_SITE_VISIT_RADIUS_METERS,
      };
    } else {
      const currentPrimary = toObjectIdString(lead.inventoryId);
      if (!currentPrimary || currentPrimary === targetInventoryId) {
        const fallbackInventoryId = nextIds[0];
        const fallbackInventory = await Inventory.findOne(
          buildCompanyInventoryQuery({
            inventoryId: fallbackInventoryId,
            companyId: req.user.companyId,
          }),
        )
          .select("_id projectName towerName unitNumber location siteLocation")
          .lean();

        if (fallbackInventory) {
          applyLeadSelectionFromInventory({
            lead,
            inventory: fallbackInventory,
          });
        } else {
          lead.inventoryId = null;
        }
      }
    }

    await lead.save();

    await LeadActivity.create({
      lead: lead._id,
      action: `Property removed from lead: ${targetInventoryId}`,
      performedBy: req.user._id,
    });

    const populatedLead = await getLeadViewById(lead._id, req.user.companyId);
    return res.json({
      message: "Property removed",
      lead: populatedLead,
    });
  } catch (error) {
    logger.error({
      requestId: req.requestId || null,
      error: error.message,
      message: "removeRelatedPropertyFromLead failed",
    });
    return res.status(500).json({ message: "Server error" });
  }
};

exports.getLeadPaymentRequests = async (req, res) => {
  try {
    if (req.user.role !== USER_ROLES.ADMIN) {
      return res.status(403).json({
        message: "Only admin can view payment requests",
      });
    }

    const approvalStatusFilter = normalizeEnumValue(req.query?.approvalStatus);
    const limitRaw = Number.parseInt(req.query?.limit, 10);
    const limit =
      Number.isFinite(limitRaw) && limitRaw > 0
        ? Math.min(limitRaw, 400)
        : 200;

    const query = {
      companyId: req.user.companyId,
      "dealPayment.approvalStatus": { $in: DEAL_PAYMENT_APPROVAL_VALUES },
    };

    if (approvalStatusFilter && approvalStatusFilter !== "ALL") {
      if (!DEAL_PAYMENT_APPROVAL_VALUES.includes(approvalStatusFilter)) {
        return res.status(400).json({
          message: `approvalStatus must be one of: ALL, ${DEAL_PAYMENT_APPROVAL_VALUES.join(", ")}`,
        });
      }
      query["dealPayment.approvalStatus"] = approvalStatusFilter;
    }

    const rows = await Lead.find(query)
      .sort({ updatedAt: -1 })
      .limit(limit)
      .populate(LEAD_PAYMENT_REQUEST_POPULATE_FIELDS)
      .lean();

    const requests = rows.map((lead) => toLeadView(lead));

    return res.json({
      count: requests.length,
      requests,
    });
  } catch (error) {
    logger.error({
      requestId: req.requestId || null,
      error: error.message,
      message: "getLeadPaymentRequests failed",
    });
    return res.status(500).json({ message: "Server error" });
  }
};

exports.updateLeadBasics = async (req, res) => {
  try {
    const { leadId } = req.params;
    if (!isValidObjectId(leadId)) {
      return res.status(400).json({ message: "Invalid lead id" });
    }

    const accessibleLead = await findAccessibleLeadById({
      leadId,
      user: req.user,
    });
    if (!accessibleLead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    const lead = await Lead.findOne({
      _id: leadId,
      companyId: req.user.companyId,
    });
    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    const nextName = String(req.body?.name || "").trim();
    const nextPhone = String(req.body?.phone || "").trim();
    const nextEmail = String(req.body?.email || "").trim();
    const nextCity = String(req.body?.city || "").trim();
    const nextProjectInterested = String(req.body?.projectInterested || "").trim();
    const nextSource = String(req.body?.source || "").trim();

    if (nextName && nextName.length < 2) {
      return res.status(400).json({ message: "Name must be at least 2 characters" });
    }

    if (nextPhone && !/^\d{8,15}$/.test(nextPhone)) {
      return res.status(400).json({ message: "Phone should be 8 to 15 digits" });
    }

    if (nextEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
      return res.status(400).json({ message: "Email is invalid" });
    }

    const updates = [];
    if (nextName && nextName !== String(lead.name || "")) {
      lead.name = nextName;
      updates.push("name");
    }
    if (nextPhone && nextPhone !== String(lead.phone || "")) {
      lead.phone = nextPhone;
      updates.push("phone");
    }
    if (req.body?.email !== undefined && nextEmail !== String(lead.email || "")) {
      lead.email = nextEmail;
      updates.push("email");
    }
    if (req.body?.city !== undefined && nextCity !== String(lead.city || "")) {
      lead.city = nextCity;
      updates.push("city");
    }
    if (req.body?.projectInterested !== undefined && nextProjectInterested !== String(lead.projectInterested || "")) {
      lead.projectInterested = nextProjectInterested;
      updates.push("projectInterested");
    }
    if (req.body?.source !== undefined && nextSource !== String(lead.source || "")) {
      lead.source = nextSource;
      updates.push("source");
    }

    if (!updates.length) {
      return res.json({
        message: "No profile changes",
        lead: await getLeadViewById(lead._id, req.user.companyId),
      });
    }

    await lead.save();
    await LeadActivity.create({
      lead: lead._id,
      action: `Lead profile updated (${updates.join(", ")})`,
      performedBy: req.user._id,
    });

    const populatedLead = await getLeadViewById(lead._id, req.user.companyId);
    return res.json({
      message: "Lead profile updated",
      lead: populatedLead,
    });
  } catch (error) {
    logger.error({
      requestId: req.requestId || null,
      error: error.message,
      message: "updateLeadBasics failed",
    });
    return res.status(500).json({ message: "Server error" });
  }
};

exports.updateLeadStatus = async (req, res) => {
  try {
    const { leadId } = req.params;
    const {
      name,
      phone,
      email,
      city,
      projectInterested,
      status: rawStatus,
      nextFollowUp,
      siteLocation: rawSiteLocation,
      dealPayment: rawDealPayment,
      closureDocuments: rawClosureDocuments,
    } = req.body;
    const requestedStatus = normalizeEnumValue(rawStatus);

    if (!requestedStatus) {
      return res.status(400).json({ message: "Status is required" });
    }

    const hasNameField = Object.prototype.hasOwnProperty.call(req.body || {}, "name");
    const hasPhoneField = Object.prototype.hasOwnProperty.call(req.body || {}, "phone");
    const hasEmailField = Object.prototype.hasOwnProperty.call(req.body || {}, "email");
    const hasCityField = Object.prototype.hasOwnProperty.call(req.body || {}, "city");
    const hasProjectInterestedField = Object.prototype.hasOwnProperty.call(req.body || {}, "projectInterested");
    const normalizedName = hasNameField ? String(name || "").trim() : "";
    const normalizedPhone = hasPhoneField ? String(phone || "").trim() : "";
    const normalizedEmail = hasEmailField ? String(email || "").trim() : "";
    const normalizedCity = hasCityField ? String(city || "").trim() : "";
    const normalizedProjectInterested = hasProjectInterestedField
      ? String(projectInterested || "").trim()
      : "";

    if (!LEAD_STATUS_VALUES.includes(requestedStatus)) {
      return res.status(400).json({
        message: `Status must be one of: ${LEAD_STATUS_VALUES.join(", ")}`,
      });
    }

    const hasNextFollowUpField =
      Object.prototype.hasOwnProperty.call(req.body || {}, "nextFollowUp");
    const normalizedNextFollowUp = hasNextFollowUpField
      ? String(nextFollowUp ?? "").trim()
      : "";
    const isClearNextFollowUpText =
      normalizedNextFollowUp.toLowerCase() === "null";
    const hasNextFollowUpInput =
      normalizedNextFollowUp.length > 0 && !isClearNextFollowUpText;
    const clearNextFollowUp =
      hasNextFollowUpField && !hasNextFollowUpInput;
    const parsedNextFollowUp = hasNextFollowUpInput
      ? new Date(normalizedNextFollowUp)
      : null;
    if (hasNextFollowUpInput && Number.isNaN(parsedNextFollowUp.getTime())) {
      return res.status(400).json({
        message: "nextFollowUp must be a valid date/time",
      });
    }

    const lead = await Lead.findOne({
      _id: leadId,
      companyId: req.user.companyId,
    });
    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    const updatedProfileFields = [];
    if (hasNameField) {
      if (!normalizedName) {
        return res.status(400).json({ message: "Name is required" });
      }

      const existingName = String(lead?.name || "").trim();
      if (normalizedName !== existingName) {
        lead.name = normalizedName;
        updatedProfileFields.push("name");
      }
    }

    if (hasPhoneField) {
      const existingPhone = String(lead?.phone || "").trim();
      if (normalizedPhone !== existingPhone) {
        if (!normalizedPhone || !/^\d{8,15}$/.test(normalizedPhone)) {
          return res.status(400).json({ message: "Phone must be 8 to 15 digits" });
        }

        const existingLeadWithPhone = await Lead.findOne({
          _id: { $ne: lead._id },
          companyId: req.user.companyId,
          phone: normalizedPhone,
        })
          .select("_id")
          .lean();
        if (existingLeadWithPhone) {
          return res.status(400).json({ message: "Lead already exists with this phone" });
        }

        lead.phone = normalizedPhone;
        updatedProfileFields.push("phone");
      }
    }

    if (hasEmailField) {
      const existingEmail = String(lead?.email || "").trim();
      if (normalizedEmail !== existingEmail) {
        lead.email = normalizedEmail;
        updatedProfileFields.push("email");
      }
    }

    if (hasCityField) {
      const existingCity = String(lead?.city || "").trim();
      if (normalizedCity !== existingCity) {
        lead.city = normalizedCity;
        updatedProfileFields.push("city");
      }
    }

    if (hasProjectInterestedField) {
      const existingProjectInterested = String(lead?.projectInterested || "").trim();
      if (normalizedProjectInterested !== existingProjectInterested) {
        lead.projectInterested = normalizedProjectInterested;
        updatedProfileFields.push("projectInterested");
      }
    }

    const parsedSiteLocation = parseSiteLocationPayload(rawSiteLocation);
    if (parsedSiteLocation.error) {
      return res.status(400).json({ message: parsedSiteLocation.error });
    }

    const parsedDealPayment = parseDealPaymentPayload(rawDealPayment);
    if (parsedDealPayment.error) {
      return res.status(400).json({ message: parsedDealPayment.error });
    }
    const parsedClosureDocuments = parseClosureDocumentsPayload(rawClosureDocuments);
    if (parsedClosureDocuments.error) {
      return res.status(400).json({ message: parsedClosureDocuments.error });
    }

    const dealPaymentPayload = parsedDealPayment.value || {};
    const isAdminUser = req.user.role === USER_ROLES.ADMIN;
    const isExecutiveUser = EXECUTIVE_ROLES.includes(req.user.role);
    const isExecutiveCloseRequest =
      isExecutiveUser && requestedStatus === CLOSED_STATUS;

    if (
      requestedStatus === REQUESTED_STATUS
      && !isAdminUser
      && normalizeEnumValue(lead.status) !== REQUESTED_STATUS
    ) {
      return res.status(403).json({
        message: "Only admin can set status to REQUESTED directly",
      });
    }

    let nextLeadStatus = isExecutiveCloseRequest
      ? REQUESTED_STATUS
      : requestedStatus;
    const isDealPaymentWorkflowStatus = [REQUESTED_STATUS, CLOSED_STATUS].includes(nextLeadStatus);
    const wasDealPaymentWorkflowStatus = [REQUESTED_STATUS, CLOSED_STATUS].includes(
      normalizeEnumValue(lead.status),
    );

    if (parsedDealPayment.provided && !isDealPaymentWorkflowStatus && !wasDealPaymentWorkflowStatus) {
      return res.status(400).json({
        message: "Payment details can be updated only when lead status is REQUESTED or CLOSED",
      });
    }

    const hasDealPaymentInput =
      parsedDealPayment.provided && isDealPaymentInputDefined(dealPaymentPayload);
    const hasApprovalInput =
      parsedDealPayment.provided
      && Boolean(dealPaymentPayload.approvalStatus || dealPaymentPayload.approvalNote);

    if (
      parsedSiteLocation.provided
      && ![USER_ROLES.ADMIN, ...MANAGEMENT_ROLES].includes(req.user.role)
    ) {
      return res.status(403).json({
        message: "Only admin or leadership roles can configure site coordinates",
      });
    }

    if (parsedSiteLocation.provided) {
      lead.siteLocation = parsedSiteLocation.value;
    }

    const isSiteVisitTransition =
      nextLeadStatus === SITE_VISIT_STATUS && lead.status !== SITE_VISIT_STATUS;
    let siteVisitDistanceMeters = null;
    let paymentRequestAction = "";
    let paymentDecisionAction = "";

    if (isSiteVisitTransition && req.user.role === FIELD_EXECUTIVE_ROLE) {
      if (!isSiteLocationConfigured(lead)) {
        return res.status(400).json({
          message:
            "Site coordinates are not configured for this lead. Ask admin/manager to set site location first.",
        });
      }

      const liveLocation = resolveLiveLocationForVerification(req.user);
      if (liveLocation.lat === null || liveLocation.lng === null) {
        return res.status(400).json({
          message:
            "Live location unavailable. Enable location on your device and try again.",
        });
      }

      if (!liveLocation.isFresh) {
        return res.status(400).json({
          message: `Live location is stale. Refresh location and retry within ${SITE_VISIT_MAX_LOCATION_STALE_MINUTES} minutes.`,
        });
      }

      const siteLat = normalizeLatitude(lead.siteLocation?.lat);
      const siteLng = normalizeLongitude(lead.siteLocation?.lng);
      const siteRadiusMeters =
        normalizeRadiusMeters(lead.siteLocation?.radiusMeters)
        || DEFAULT_SITE_VISIT_RADIUS_METERS;

      siteVisitDistanceMeters = calculateDistanceMeters(
        liveLocation.lat,
        liveLocation.lng,
        siteLat,
        siteLng,
      );

      if (siteVisitDistanceMeters > siteRadiusMeters) {
        return res.status(403).json({
          message: `Site visit can be marked only within ${siteRadiusMeters} meters. Current distance is ${Math.round(siteVisitDistanceMeters)} meters.`,
        });
      }
    }

    if (isExecutiveCloseRequest && lead.status !== CLOSED_STATUS) {
      if (!hasDealPaymentInput) {
        return res.status(400).json({
          message:
            "Payment mode and payment type are required when executive closes the deal",
        });
      }

      if (!dealPaymentPayload.mode || !dealPaymentPayload.paymentType) {
        return res.status(400).json({
          message:
            "Payment mode and payment type are required when executive closes the deal",
        });
      }
    }

    if (hasDealPaymentInput) {
      const existingDealPayment = lead?.dealPayment?.toObject
        ? lead.dealPayment.toObject()
        : (lead.dealPayment || {});
      const nextMode =
        dealPaymentPayload.mode || normalizeEnumValue(existingDealPayment.mode);
      const nextPaymentType =
        dealPaymentPayload.paymentType
        || normalizeEnumValue(existingDealPayment.paymentType);
      const nextPaymentReference =
        nextMode === "CASH"
          ? ""
          : String(dealPaymentPayload.paymentReference || existingDealPayment.paymentReference || "").trim();

      if (!nextMode || !nextPaymentType) {
        return res.status(400).json({
          message: "Both payment mode and payment type are required",
        });
      }

      if (isExecutiveUser && nextMode !== "CASH" && !nextPaymentReference) {
        return res.status(400).json({
          message:
            "Payment reference (UTR/transaction/check number) is required for non-cash payments",
        });
      }

      let nextRemainingAmount = null;
      if (nextPaymentType === "PARTIAL") {
        const remainingCandidate = dealPaymentPayload.hasRemainingAmount
          ? dealPaymentPayload.remainingAmount
          : toFiniteNumber(existingDealPayment.remainingAmount);

        if (remainingCandidate === null || remainingCandidate <= 0) {
          return res.status(400).json({
            message: "Remaining amount must be greater than 0 for partial payment",
          });
        }
        nextRemainingAmount = remainingCandidate;
      } else {
        nextRemainingAmount = 0;
      }

      lead.dealPayment = {
        ...existingDealPayment,
        mode: nextMode,
        paymentType: nextPaymentType,
        remainingAmount: nextRemainingAmount,
        paymentReference: nextPaymentReference,
        note: dealPaymentPayload.note || existingDealPayment.note || "",
        approvalStatus: existingDealPayment.approvalStatus || null,
        approvalNote: existingDealPayment.approvalNote || "",
        approvalRequestedBy: existingDealPayment.approvalRequestedBy || null,
        approvalRequestedAt: existingDealPayment.approvalRequestedAt || null,
        approvalReviewedBy: existingDealPayment.approvalReviewedBy || null,
        approvalReviewedAt: existingDealPayment.approvalReviewedAt || null,
        requestedFromStatus: existingDealPayment.requestedFromStatus || "",
        requestedTargetStatus: existingDealPayment.requestedTargetStatus || "",
      };
    }

    if (
      isExecutiveCloseRequest
      && hasDealPaymentInput
      && normalizeEnumValue(lead.status) !== CLOSED_STATUS
    ) {
      const existingRequestedFromStatus = normalizeEnumValue(
        lead?.dealPayment?.requestedFromStatus,
      );
      const resolvedRequestedFromStatus = LEAD_STATUS_VALUES.includes(existingRequestedFromStatus)
        && ![REQUESTED_STATUS, CLOSED_STATUS].includes(existingRequestedFromStatus)
        ? existingRequestedFromStatus
        : [REQUESTED_STATUS, CLOSED_STATUS].includes(normalizeEnumValue(lead.status))
          ? "INTERESTED"
          : normalizeEnumValue(lead.status) || "INTERESTED";
      const paymentTypeLabel =
        lead.dealPayment.paymentType === "PARTIAL" ? "Partial payment" : "Full payment";
      const remainingLabel =
        lead.dealPayment.paymentType === "PARTIAL"
          ? `, remaining Rs ${Number(lead.dealPayment.remainingAmount || 0).toLocaleString("en-IN")}`
          : "";

      lead.dealPayment.requestedFromStatus = resolvedRequestedFromStatus;
      lead.dealPayment.requestedTargetStatus = CLOSED_STATUS;
      lead.dealPayment.approvalStatus = "PENDING";
      lead.dealPayment.approvalRequestedBy = req.user._id;
      lead.dealPayment.approvalRequestedAt = new Date();
      lead.dealPayment.approvalReviewedBy = null;
      lead.dealPayment.approvalReviewedAt = null;
      lead.dealPayment.approvalNote = "";
      nextLeadStatus = REQUESTED_STATUS;

      paymentRequestAction =
        `Payment submitted for admin approval (${getDealPaymentModeLabel(lead.dealPayment.mode)}, `
        + `${paymentTypeLabel}${remainingLabel})`;
    }

    if (hasApprovalInput) {
      if (!isAdminUser) {
        return res.status(403).json({
          message: "Only admin can approve or reject deal payment",
        });
      }

      if (!lead?.dealPayment?.mode || !lead?.dealPayment?.paymentType) {
        return res.status(400).json({
          message: "Payment details are not available for approval decision",
        });
      }

      if (
        dealPaymentPayload.approvalStatus
        && !ADMIN_PAYMENT_DECISION_VALUES.includes(dealPaymentPayload.approvalStatus)
      ) {
        return res.status(400).json({
          message: `approvalStatus must be one of: ${ADMIN_PAYMENT_DECISION_VALUES.join(", ")}`,
        });
      }

      if (dealPaymentPayload.approvalStatus) {
        lead.dealPayment.approvalStatus = dealPaymentPayload.approvalStatus;
        lead.dealPayment.approvalReviewedBy = req.user._id;
        lead.dealPayment.approvalReviewedAt = new Date();

        if (dealPaymentPayload.approvalStatus === "APPROVED") {
          nextLeadStatus = CLOSED_STATUS;
        } else if (dealPaymentPayload.approvalStatus === "REJECTED") {
          const requestedFromStatus = normalizeEnumValue(
            lead?.dealPayment?.requestedFromStatus,
          );
          const fallbackStatus =
            LEAD_STATUS_VALUES.includes(requestedFromStatus)
            && ![REQUESTED_STATUS, CLOSED_STATUS].includes(requestedFromStatus)
              ? requestedFromStatus
              : "INTERESTED";
          nextLeadStatus = fallbackStatus;
        }
      }

      if (dealPaymentPayload.approvalNote) {
        lead.dealPayment.approvalNote = dealPaymentPayload.approvalNote;
      }

      if (dealPaymentPayload.approvalStatus) {
        paymentDecisionAction =
          `Payment ${dealPaymentPayload.approvalStatus.toLowerCase()} by admin`;
      } else if (dealPaymentPayload.approvalNote) {
        paymentDecisionAction = "Payment approval note updated by admin";
      }
    }

    if (parsedClosureDocuments.provided) {
      const canUpdateClosureDocuments =
        requestedStatus === CLOSED_STATUS
        || [REQUESTED_STATUS, CLOSED_STATUS].includes(nextLeadStatus);
      if (!canUpdateClosureDocuments) {
        return res.status(400).json({
          message: "Closure documents can be updated only for REQUESTED or CLOSED leads",
        });
      }

      lead.closureDocuments = parsedClosureDocuments.value.map((row) => ({
        ...row,
        uploadedBy: row.uploadedBy || req.user._id,
        uploadedAt: row.uploadedAt || new Date(),
      }));
    }

    const normalizedPaymentType = normalizeEnumValue(lead?.dealPayment?.paymentType);
    const normalizedRemainingAmount = toFiniteNumber(lead?.dealPayment?.remainingAmount);
    const existingFollowUpDate = lead?.nextFollowUp ? new Date(lead.nextFollowUp) : null;
    const hasExistingFollowUp =
      existingFollowUpDate && !Number.isNaN(existingFollowUpDate.getTime());
    const isRemainingCollectionFlow =
      [REQUESTED_STATUS, CLOSED_STATUS].includes(nextLeadStatus)
      && normalizedPaymentType === "PARTIAL"
      && normalizedRemainingAmount !== null
      && normalizedRemainingAmount > 0;
    const hasCollectionFollowUp =
      hasNextFollowUpInput
      || (!clearNextFollowUp && hasExistingFollowUp);

    if (isRemainingCollectionFlow && !hasCollectionFollowUp) {
      return res.status(400).json({
        message:
          "Set nextFollowUp for remaining payment collection when closing with partial payment",
      });
    }

    lead.status = nextLeadStatus;
    lead.lastContactedAt = new Date();

    if (hasNextFollowUpInput) {
      lead.nextFollowUp = parsedNextFollowUp;
    } else if (clearNextFollowUp) {
      lead.nextFollowUp = null;
    }

    await lead.save();

    if (paymentRequestAction) {
      emitAdminPaymentRequestCreated({
        io: req.app.get("io"),
        lead,
        requestedBy: req.user,
        companyId: req.user?.companyId || null,
      });
    }

    const activityActions = [
      siteVisitDistanceMeters !== null
        ? `Status changed to ${nextLeadStatus} (${Math.round(siteVisitDistanceMeters)}m from site)`
        : `Status changed to ${nextLeadStatus}`,
    ];

    if (paymentRequestAction) {
      activityActions.push(paymentRequestAction);
    }

    if (paymentDecisionAction) {
      activityActions.push(paymentDecisionAction);
    }

    if (parsedClosureDocuments.provided) {
      activityActions.push(
        `Closure documents updated (${lead.closureDocuments.length} file${lead.closureDocuments.length === 1 ? "" : "s"})`,
      );
    }

    if (updatedProfileFields.length > 0) {
      const labelMap = {
        name: "Name",
        phone: "Phone",
        email: "Email",
        city: "City",
        projectInterested: "Project",
      };
      const profileFieldLabels = updatedProfileFields
        .map((field) => labelMap[field] || field)
        .join(", ");
      activityActions.push(`Lead profile updated (${profileFieldLabels})`);
    }

    await Promise.all(
      activityActions.map((action) =>
        LeadActivity.create({
          lead: lead._id,
          action,
          performedBy: req.user._id,
        })),
    );

    const populatedLead = await getLeadViewById(lead._id, req.user.companyId);

    return res.json({
      message: "Lead status updated",
      lead: populatedLead,
    });
  } catch (error) {
    logger.error({
      requestId: req.requestId || null,
      error: error.message,
      message: "updateLeadStatus failed",
    });
    return res.status(500).json({ message: "Server error" });
  }
};

exports.requestLeadStatusChange = async (req, res) => {
  try {
    const { leadId } = req.params;
    if (!isValidObjectId(leadId)) {
      return res.status(400).json({ message: "Invalid lead id" });
    }

    const accessibleLead = await findAccessibleLeadById({ leadId, user: req.user });
    if (!accessibleLead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    const proposedStatus = String(req.body?.status || "").trim().toUpperCase();
    if (!LEAD_STATUS_VALUES.includes(proposedStatus)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const requestNote = String(req.body?.requestNote || "").trim();
    if (!requestNote) {
      return res.status(400).json({ message: "Request note is required" });
    }
    if (requestNote.length > MAX_LEAD_STATUS_REQUEST_NOTE_LENGTH) {
      return res.status(400).json({
        message: `Request note cannot exceed ${MAX_LEAD_STATUS_REQUEST_NOTE_LENGTH} characters`,
      });
    }

    let proposedNextFollowUp = null;
    if (req.body?.nextFollowUp) {
      const parsed = new Date(req.body.nextFollowUp);
      if (Number.isNaN(parsed.getTime())) {
        return res.status(400).json({ message: "Invalid nextFollowUp date" });
      }
      proposedNextFollowUp = parsed;
    }

    const payload = {
      companyId: accessibleLead.companyId || req.user.companyId,
      lead: accessibleLead._id,
      requestedBy: req.user._id,
      proposedStatus,
      proposedNextFollowUp,
      requestNote,
      status: "pending",
      proposedSaleMeta:
        req.body?.saleMeta && typeof req.body.saleMeta === "object"
          ? req.body.saleMeta
          : undefined,
      attachment:
        req.body?.attachment && typeof req.body.attachment === "object"
          ? req.body.attachment
          : undefined,
      closureDocuments: Array.isArray(req.body?.closureDocuments)
        ? req.body.closureDocuments
            .map((row) => ({
              url: String(row?.url || "").trim(),
              kind: String(row?.kind || "file").trim().toLowerCase(),
              mimeType: String(row?.mimeType || "").trim(),
              name: String(row?.name || "").trim(),
              size: Number(row?.size || 0),
            }))
            .filter((row) => Boolean(row.url))
        : undefined,
    };

    const created = await LeadStatusRequest.create(payload);

    await LeadActivity.create({
      lead: accessibleLead._id,
      action: `Status approval requested: ${proposedStatus}`,
      performedBy: req.user._id,
    });

    const request = await LeadStatusRequest.findById(created._id)
      .populate("requestedBy", "name role")
      .populate("lead", "name status nextFollowUp")
      .lean();

    return res.status(201).json({
      message: "Status change request submitted",
      request,
    });
  } catch (error) {
    logger.error({
      requestId: req.requestId || null,
      error: error.message,
      message: "requestLeadStatusChange failed",
    });
    return res.status(500).json({ message: "Server error" });
  }
};

exports.getLeadStatusRequests = async (req, res) => {
  try {
    const query = {
      companyId: req.user.companyId,
    };
    const leadId = String(req.query?.leadId || "").trim();
    if (leadId) {
      if (!isValidObjectId(leadId)) {
        return res.status(400).json({ message: "Invalid lead id" });
      }
      const accessibleLead = await findAccessibleLeadById({ leadId, user: req.user });
      if (!accessibleLead) {
        return res.status(404).json({ message: "Lead not found" });
      }
      query.lead = leadId;
    }

    const requestedStatus = String(req.query?.status || "").trim().toLowerCase();
    if (requestedStatus) {
      const allowedStatuses = ["pending", "approved", "rejected"];
      if (!allowedStatuses.includes(requestedStatus)) {
        return res.status(400).json({ message: "Invalid request status filter" });
      }
      query.status = requestedStatus;
    }

    const isAdmin = req.user.role === USER_ROLES.ADMIN;
    if (!isAdmin && !isManagementRole(req.user.role)) {
      query.requestedBy = req.user._id;
    }

    const requests = await LeadStatusRequest.find(query)
      .populate("requestedBy", "name role")
      .populate("reviewedBy", "name role")
      .populate("lead", "name status nextFollowUp")
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    return res.json({ requests });
  } catch (error) {
    logger.error({
      requestId: req.requestId || null,
      error: error.message,
      message: "getLeadStatusRequests failed",
    });
    return res.status(500).json({ message: "Server error" });
  }
};

exports.getPendingLeadStatusRequests = async (req, res) => {
  try {
    const query = {
      companyId: req.user.companyId,
      status: "pending",
    };
    const leadId = String(req.query?.leadId || "").trim();
    if (leadId) {
      if (!isValidObjectId(leadId)) {
        return res.status(400).json({ message: "Invalid lead id" });
      }
      query.lead = leadId;
    }

    const requests = await LeadStatusRequest.find(query)
      .populate("requestedBy", "name role")
      .populate("lead", "name status nextFollowUp")
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ requests });
  } catch (error) {
    logger.error({
      requestId: req.requestId || null,
      error: error.message,
      message: "getPendingLeadStatusRequests failed",
    });
    return res.status(500).json({ message: "Server error" });
  }
};

exports.approveLeadStatusRequest = async (req, res) => {
  try {
    const requestId = String(req.params?.requestId || "").trim();
    if (!isValidObjectId(requestId)) {
      return res.status(400).json({ message: "Invalid request id" });
    }

    const request = await LeadStatusRequest.findOne({
      _id: requestId,
      companyId: req.user.companyId,
      status: "pending",
    });
    if (!request) {
      return res.status(404).json({ message: "Pending request not found" });
    }

    const lead = await Lead.findOne({
      _id: request.lead,
      companyId: req.user.companyId,
    });
    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    lead.status = request.proposedStatus;
    if (request.proposedNextFollowUp) {
      lead.nextFollowUp = request.proposedNextFollowUp;
    }
    if (Array.isArray(request.closureDocuments) && request.closureDocuments.length) {
      lead.closureDocuments = request.closureDocuments.map((row) => ({
        url: String(row?.url || "").trim(),
        kind: String(row?.kind || "file").trim().toLowerCase(),
        mimeType: String(row?.mimeType || "").trim(),
        name: String(row?.name || "").trim(),
        size: Number(row?.size || 0),
        uploadedBy: request.requestedBy || null,
      }));
    }
    await lead.save();

    request.status = "approved";
    request.reviewedBy = req.user._id;
    request.reviewedAt = new Date();
    request.reviewNote = String(req.body?.reviewNote || "").trim().slice(0, 500);
    request.rejectionReason = "";
    await request.save();

    await LeadActivity.create({
      lead: lead._id,
      action: `Status request approved: ${request.proposedStatus}`,
      performedBy: req.user._id,
    });

    const populatedLead = await getLeadViewById(lead._id, req.user.companyId);
    const populatedRequest = await LeadStatusRequest.findById(request._id)
      .populate("requestedBy", "name role")
      .populate("reviewedBy", "name role")
      .populate("lead", "name status nextFollowUp")
      .lean();

    return res.json({
      message: "Lead status request approved",
      lead: populatedLead,
      request: populatedRequest,
    });
  } catch (error) {
    logger.error({
      requestId: req.requestId || null,
      error: error.message,
      message: "approveLeadStatusRequest failed",
    });
    return res.status(500).json({ message: "Server error" });
  }
};

exports.rejectLeadStatusRequest = async (req, res) => {
  try {
    const requestId = String(req.params?.requestId || "").trim();
    if (!isValidObjectId(requestId)) {
      return res.status(400).json({ message: "Invalid request id" });
    }

    const rejectionReason = String(req.body?.rejectionReason || "").trim();
    if (!rejectionReason) {
      return res.status(400).json({ message: "Rejection reason is required" });
    }
    if (rejectionReason.length > MAX_LEAD_STATUS_REQUEST_NOTE_LENGTH) {
      return res.status(400).json({
        message: `Rejection reason cannot exceed ${MAX_LEAD_STATUS_REQUEST_NOTE_LENGTH} characters`,
      });
    }

    const request = await LeadStatusRequest.findOne({
      _id: requestId,
      companyId: req.user.companyId,
      status: "pending",
    });
    if (!request) {
      return res.status(404).json({ message: "Pending request not found" });
    }

    request.status = "rejected";
    request.reviewedBy = req.user._id;
    request.reviewedAt = new Date();
    request.rejectionReason = rejectionReason;
    request.reviewNote = String(req.body?.reviewNote || "").trim().slice(0, 500);
    await request.save();

    await LeadActivity.create({
      lead: request.lead,
      action: `Status request rejected: ${request.proposedStatus}`,
      performedBy: req.user._id,
    });

    const populatedRequest = await LeadStatusRequest.findById(request._id)
      .populate("requestedBy", "name role")
      .populate("reviewedBy", "name role")
      .populate("lead", "name status nextFollowUp")
      .lean();

    return res.json({
      message: "Lead status request rejected",
      request: populatedRequest,
    });
  } catch (error) {
    logger.error({
      requestId: req.requestId || null,
      error: error.message,
      message: "rejectLeadStatusRequest failed",
    });
    return res.status(500).json({ message: "Server error" });
  }
};

exports.getLeadActivity = async (req, res) => {
  try {
    const { leadId } = req.params;
    if (!isValidObjectId(leadId)) {
      return res.status(400).json({ message: "Invalid lead id" });
    }

    const accessibleLead = await findAccessibleLeadById({ leadId, user: req.user });
    if (!accessibleLead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    const pagination = parsePagination(req.query, {
      defaultLimit: Number.parseInt(process.env.LEAD_ACTIVITY_PAGE_LIMIT, 10) || 40,
      maxLimit: Number.parseInt(process.env.LEAD_ACTIVITY_PAGE_MAX_LIMIT, 10) || 200,
    });
    const selectedFields = parseFieldSelection(
      req.query?.fields,
      LEAD_ACTIVITY_SELECTABLE_FIELDS,
    );

    const queryBuilder = LeadActivity.find({ lead: leadId })
      .populate("performedBy", "name role")
      .sort({ createdAt: -1 });

    if (selectedFields) {
      queryBuilder.select(selectedFields);
    }

    if (pagination.enabled) {
      queryBuilder.skip(pagination.skip).limit(pagination.limit);
    }

    const activitiesQuery = queryBuilder.lean();
    if (!pagination.enabled) {
      const activities = await activitiesQuery;
      return res.json({ activities });
    }

    const [activities, totalCount] = await Promise.all([
      activitiesQuery,
      LeadActivity.countDocuments({ lead: leadId }),
    ]);

    return res.json({
      activities,
      pagination: buildPaginationMeta({
        page: pagination.page,
        limit: pagination.limit,
        totalCount,
      }),
    });
  } catch (error) {
    logger.error({
      requestId: req.requestId || null,
      error: error.message,
      message: "getLeadActivity failed",
    });
    return res.status(500).json({ message: "Server error" });
  }
};

exports.getTodayFollowUps = async (req, res) => {
  try {
    const scope = await buildLeadQueryForUser(req.user);
    if (!scope) {
      return res.status(403).json({ message: "Access denied" });
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const query = {
      ...scope,
      nextFollowUp: { $gte: todayStart, $lte: todayEnd },
    };

    const pagination = parsePagination(req.query, {
      defaultLimit: Number.parseInt(process.env.FOLLOWUP_PAGE_LIMIT, 10) || 50,
      maxLimit: Number.parseInt(process.env.FOLLOWUP_PAGE_MAX_LIMIT, 10) || 200,
    });
    const selectedFields = parseFieldSelection(
      req.query?.fields,
      LEAD_SELECTABLE_FIELDS,
    );

    const queryBuilder = Lead.find(query)
      .populate("assignedTo", "name role")
      .sort({ nextFollowUp: 1 });

    if (selectedFields) {
      queryBuilder.select(selectedFields);
    }

    if (pagination.enabled) {
      queryBuilder.skip(pagination.skip).limit(pagination.limit);
    }

    const leadsQuery = queryBuilder.lean();
    if (!pagination.enabled) {
      const leads = (await leadsQuery).map((lead) => toLeadView(lead));
      return res.json({ leads });
    }

    const [leadRows, totalCount] = await Promise.all([
      leadsQuery,
      Lead.countDocuments(query),
    ]);
    const leads = leadRows.map((lead) => toLeadView(lead));

    return res.json({
      leads,
      pagination: buildPaginationMeta({
        page: pagination.page,
        limit: pagination.limit,
        totalCount,
      }),
    });
  } catch (error) {
    logger.error({
      requestId: req.requestId || null,
      error: error.message,
      message: "getTodayFollowUps failed",
    });
    return res.status(500).json({ message: "Server error" });
  }
};

exports.getLeadDiary = async (req, res) => {
  try {
    const { leadId } = req.params;
    if (!isValidObjectId(leadId)) {
      return res.status(400).json({ message: "Invalid lead id" });
    }

    const accessibleLead = await findAccessibleLeadById({
      leadId,
      user: req.user,
    });
    if (!accessibleLead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    const pagination = parsePagination(req.query, {
      defaultLimit: Number.parseInt(process.env.LEAD_DIARY_PAGE_LIMIT, 10) || 40,
      maxLimit: Number.parseInt(process.env.LEAD_DIARY_PAGE_MAX_LIMIT, 10) || 200,
    });
    const selectedFields = parseFieldSelection(
      req.query?.fields,
      LEAD_DIARY_SELECTABLE_FIELDS,
    );

    const queryBuilder = LeadDiary.find({ lead: leadId })
      .populate("createdBy", "name role")
      .sort({ createdAt: -1 });

    if (selectedFields) {
      queryBuilder.select(selectedFields);
    }

    if (pagination.enabled) {
      queryBuilder.skip(pagination.skip).limit(pagination.limit);
    }

    const entriesQuery = queryBuilder.lean();

    if (!pagination.enabled) {
      const entries = await entriesQuery;
      return res.json({ entries });
    }

    const [entries, totalCount] = await Promise.all([
      entriesQuery,
      LeadDiary.countDocuments({ lead: leadId }),
    ]);

    return res.json({
      entries,
      pagination: buildPaginationMeta({
        page: pagination.page,
        limit: pagination.limit,
        totalCount,
      }),
    });
  } catch (error) {
    logger.error({
      requestId: req.requestId || null,
      error: error.message,
      message: "getLeadDiary failed",
    });
    return res.status(500).json({ message: "Server error" });
  }
};

exports.addLeadDiaryEntry = async (req, res) => {
  try {
    const { leadId } = req.params;
    if (!isValidObjectId(leadId)) {
      return res.status(400).json({ message: "Invalid lead id" });
    }

    const note = String(req.body?.note || "").trim();
    if (!note) {
      return res.status(400).json({ message: "Diary note is required" });
    }

    if (note.length > MAX_LEAD_DIARY_NOTE_LENGTH) {
      return res.status(400).json({
        message: `Diary note cannot exceed ${MAX_LEAD_DIARY_NOTE_LENGTH} characters`,
      });
    }

    const accessibleLead = await findAccessibleLeadById({
      leadId,
      user: req.user,
    });
    if (!accessibleLead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    const entry = await LeadDiary.create({
      lead: leadId,
      note,
      createdBy: req.user._id,
    });

    await LeadActivity.create({
      lead: leadId,
      action: "Lead diary note added",
      performedBy: req.user._id,
    });

    const populatedEntry = await LeadDiary.findById(entry._id)
      .populate("createdBy", "name role")
      .lean();

    return res.status(201).json({
      message: "Lead diary entry added",
      entry: populatedEntry,
    });
  } catch (error) {
    logger.error({
      requestId: req.requestId || null,
      error: error.message,
      message: "addLeadDiaryEntry failed",
    });
    return res.status(500).json({ message: "Server error" });
  }
};
