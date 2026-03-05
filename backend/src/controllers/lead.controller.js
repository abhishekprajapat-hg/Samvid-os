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
  {
    path: "assignedTo",
    select: "name role parentId",
    populate: {
      path: "parentId",
      select: "name role parentId",
      populate: { path: "parentId", select: "name role" },
    },
  },
  {
    path: "assignedManager",
    select: "name role parentId",
    populate: { path: "parentId", select: "name role" },
  },
  { path: "assignedExecutive", select: "name role" },
  { path: "assignedFieldExecutive", select: "name role" },
  { path: "createdBy", select: "name role" },
  {
    path: "inventoryId",
    select: "projectName towerName unitNumber location siteLocation status price saleMeta.remainingAmount saleMeta.remainingDueDate saleMeta.paymentDate",
  },
  {
    path: "relatedInventoryIds",
    select: "projectName towerName unitNumber location siteLocation status price saleMeta.remainingAmount saleMeta.remainingDueDate saleMeta.paymentDate",
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
  "conversation",
  "visitDetails",
  "nextStep",
  "conversionDetails",
  "voiceNoteUrl",
  "voiceNoteName",
  "createdBy",
  "isEdited",
  "lastEditedAt",
  "lastEditedBy",
  "editHistory",
  "createdAt",
  "updatedAt",
];

const FIELD_EXECUTIVE_ROLE = USER_ROLES.FIELD_EXECUTIVE;
const SITE_VISIT_STATUS = "SITE_VISIT";
const CLOSED_STATUS = "CLOSED";
const CLOSED_PAYMENT_MODES = ["Cash", "Cheque", "Bank Transfer", "UPI", "Net Banking"];
const CLOSED_TRANSFER_TYPES = ["RTGS", "IMPS", "NEFT"];
const EARTH_RADIUS_METERS = 6371000;
const DEFAULT_SITE_VISIT_RADIUS_METERS =
  Number.parseInt(process.env.SITE_VISIT_RADIUS_METERS, 10) || 200;
const SITE_VISIT_MAX_LOCATION_STALE_MINUTES =
  Number.parseInt(process.env.SITE_VISIT_MAX_LOCATION_STALE_MINUTES, 10) || 15;
const MAX_LEAD_DIARY_NOTE_LENGTH = 2000;
const MAX_LEAD_DIARY_NEXT_STEP_LENGTH = 1000;
const MAX_LEAD_STATUS_REQUEST_NOTE_LENGTH = 500;
const applyLeadDiaryPopulation = (queryBuilder) =>
  queryBuilder
    .populate("createdBy", "name role")
    .populate("lastEditedBy", "name role")
    .populate("editHistory.editedBy", "name role");

const sanitizeDiaryEntriesForRole = ({ entries, role }) => {
  if (role === USER_ROLES.ADMIN) {
    return entries;
  }

  return entries.map((entry) => ({
    ...entry,
    editHistory: [],
  }));
};

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

const parseFollowUpDate = (rawValue) => {
  if (rawValue === undefined || rawValue === null || rawValue === "") {
    return { provided: false, value: null };
  }

  const parsed = new Date(rawValue);
  if (Number.isNaN(parsed.getTime())) {
    return { error: "Invalid nextFollowUp date" };
  }

  return { provided: true, value: parsed };
};

const parseClosedSaleMeta = (rawValue) => {
  if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) {
    return { error: "saleMeta is required for CLOSED approval request" };
  }

  const rawPaymentMode = String(rawValue.paymentMode || "").trim();
  const paymentMode = rawPaymentMode === "Net Banking" ? "Bank Transfer" : rawPaymentMode;
  if (!CLOSED_PAYMENT_MODES.includes(paymentMode)) {
    return { error: "Valid saleMeta.paymentMode is required" };
  }

  const totalAmount = Number(rawValue.totalAmount);
  if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
    return { error: "saleMeta.totalAmount must be greater than 0" };
  }

  const saleLeadId = String(rawValue.leadId || "").trim();
  if (!isValidObjectId(saleLeadId)) {
    return { error: "Valid saleMeta.leadId is required" };
  }
  const saleLeadName = String(rawValue.leadName || "").trim();

  const partialAmount = Number(rawValue.partialAmount);
  if (!Number.isFinite(partialAmount) || partialAmount < 0 || partialAmount > totalAmount) {
    return { error: "saleMeta.partialAmount must be between 0 and totalAmount" };
  }

  const rawRemainingAmount = Number(rawValue.remainingAmount);
  const remainingAmount = Number.isFinite(rawRemainingAmount)
    ? Number(rawRemainingAmount.toFixed(2))
    : Number((totalAmount - partialAmount).toFixed(2));
  if (!Number.isFinite(remainingAmount) || remainingAmount < 0) {
    return { error: "saleMeta.remainingAmount must be a valid non-negative number" };
  }
  const paymentDate = String(rawValue.paymentDate || "").trim();
  const remainingDueDate = String(rawValue.remainingDueDate || "").trim();
  const safeSaleMeta = {
    leadId: saleLeadId,
    leadName: saleLeadName,
    paymentMode,
    totalAmount,
    partialAmount,
    remainingAmount,
    remainingDueDate,
    paymentDate,
  };

  if (remainingAmount > 0 && !remainingDueDate) {
    return { error: "saleMeta.remainingDueDate is required when remaining amount is pending" };
  }

  if (paymentMode === "Cash" && !paymentDate) {
    return { error: "saleMeta.paymentDate is required for cash payments" };
  }

  if (paymentMode === "Cheque") {
    const cheque = rawValue.cheque || {};
    const safeCheque = {
      bankName: String(cheque.bankName || "").trim(),
      chequeNumber: String(cheque.chequeNumber || "").trim(),
      chequeDate: String(cheque.chequeDate || "").trim(),
    };
    if (!safeCheque.bankName || !safeCheque.chequeNumber || !safeCheque.chequeDate) {
      return { error: "Complete cheque details are required in saleMeta.cheque" };
    }
    safeSaleMeta.cheque = safeCheque;
  }

  if (paymentMode === "UPI") {
    const upi = rawValue.upi || {};
    const safeUpi = {
      transactionId: String(upi.transactionId || "").trim(),
    };
    if (!safeUpi.transactionId || !paymentDate) {
      return { error: "UPI transaction id and payment date are required" };
    }
    safeSaleMeta.upi = safeUpi;
  }

  if (paymentMode === "Bank Transfer") {
    const bankTransfer = rawValue.bankTransfer || rawValue.netBanking || {};
    const safeBankTransfer = {
      transferType: String(bankTransfer.transferType || "").trim().toUpperCase(),
      utrNumber: String(bankTransfer.utrNumber || bankTransfer.transactionId || "").trim(),
    };
    if (!safeBankTransfer.transferType || !CLOSED_TRANSFER_TYPES.includes(safeBankTransfer.transferType)) {
      return { error: "Valid transfer type (RTGS/IMPS/NEFT) is required" };
    }
    if (!safeBankTransfer.utrNumber || !paymentDate) {
      return { error: "Bank transfer UTR number and payment date are required" };
    }
    safeSaleMeta.bankTransfer = safeBankTransfer;
  }

  return { value: safeSaleMeta };
};

const sanitizeStatusRequestAttachment = (rawValue) => {
  if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) {
    return null;
  }

  const fileUrl = String(rawValue.fileUrl || "").trim();
  if (!fileUrl) {
    return null;
  }

  return {
    fileName: String(rawValue.fileName || "attachment").trim().slice(0, 200),
    fileUrl,
    mimeType: String(rawValue.mimeType || "").trim().slice(0, 120),
    size: Number.isFinite(Number(rawValue.size)) ? Number(rawValue.size) : 0,
    storagePath: String(rawValue.storagePath || "").trim().slice(0, 300),
  };
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

const getLeadViewById = async (leadId) => {
  const row = await Lead.findById(leadId).populate(LEAD_POPULATE_FIELDS).lean();
  return toLeadView(row);
};

const getExecutiveIdsForLeader = async (user) => getDescendantExecutiveIds({
  rootUserId: user?._id,
  companyId: user?.companyId || null,
});

const buildLeadQueryForUser = async (user) => {
  if (user.role === USER_ROLES.ADMIN) {
    return {};
  }

  if (isManagementRole(user.role)) {
    const execIds = await getExecutiveIdsForLeader(user);
    return {
      $or: [
        { createdBy: user._id },
        { assignedTo: { $in: execIds } },
        { assignedTo: null },
      ],
    };
  }

  if (EXECUTIVE_ROLES.includes(user.role)) {
    return {
      $or: [{ assignedTo: user._id }, { assignedTo: null }],
    };
  }

  if (user.role === USER_ROLES.CHANNEL_PARTNER) {
    return { createdBy: user._id };
  }

  return null;
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
    .select("_id")
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

    const existing = await Lead.findOne({ phone }).select("_id").lean();
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

    await autoAssignLead({
      lead,
      requester: req.user,
      performedBy: req.user._id,
    });

    const populatedLead = await getLeadViewById(lead._id);

    return res.status(201).json({
      message: "Lead created and assignment processed",
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

    const leadQuery = applyLeadQueryOptions({
      queryBuilder: Lead.find(query),
      selectedFields,
      pagination,
    });

    if (!pagination.enabled) {
      const leads = (await leadQuery).map((lead) => toLeadView(lead));
      return res.json({ leads });
    }

    const [leadRows, totalCount] = await Promise.all([
      leadQuery,
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

exports.assignLead = async (req, res) => {
  try {
    const { leadId } = req.params;
    const { executiveId } = req.body;

    const lead = await Lead.findById(leadId);
    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    const executive = await User.findById(executiveId);
    if (!executive || !EXECUTIVE_ROLES.includes(executive.role)) {
      return res.status(400).json({ message: "Invalid executive" });
    }

    if (isManagementRole(req.user.role) && req.user.role !== USER_ROLES.ADMIN) {
      const teamExecutiveIds = new Set(
        (await getExecutiveIdsForLeader(req.user)).map((item) => String(item)),
      );

      const targetExecutiveId = String(executive._id);
      const leadAssigneeId = String(lead.assignedTo || "");
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

    const populatedLead = await getLeadViewById(lead._id);

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
      .select("_id projectName towerName unitNumber location siteLocation")
      .lean();
    if (!inventory) {
      return res.status(404).json({ message: "Inventory not found" });
    }

    const lead = await Lead.findById(leadId);
    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    const existingIds = buildLeadRelatedInventoryRefs(lead).map((value) =>
      toObjectIdString(value),
    );
    const inventoryIdStr = String(inventory._id);

    if (existingIds.includes(inventoryIdStr)) {
      const populatedLead = await getLeadViewById(lead._id);
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

    const populatedLead = await getLeadViewById(lead._id);

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

    const lead = await Lead.findById(leadId);
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

    const populatedLead = await getLeadViewById(lead._id);
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

    const lead = await Lead.findById(leadId);
    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    const existingIds = buildLeadRelatedInventoryRefs(lead).map((value) =>
      toObjectIdString(value),
    );
    const targetInventoryId = String(inventoryId);

    if (!existingIds.includes(targetInventoryId)) {
      const populatedLead = await getLeadViewById(lead._id);
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

    const populatedLead = await getLeadViewById(lead._id);
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

exports.updateLeadStatus = async (req, res) => {
  try {
    const { leadId } = req.params;
    const { status, nextFollowUp, siteLocation: rawSiteLocation } = req.body;

    if (!status) {
      return res.status(400).json({ message: "Status is required" });
    }

    const lead = await Lead.findById(leadId);
    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    const parsedFollowUp = parseFollowUpDate(nextFollowUp);
    if (parsedFollowUp.error) {
      return res.status(400).json({ message: parsedFollowUp.error });
    }

    const normalizedCurrentStatus = String(lead.status || "").toUpperCase();
    const normalizedRequestedStatus = String(status || "").toUpperCase();
    const isStatusChange = normalizedRequestedStatus !== normalizedCurrentStatus;

    const isClosedTransition = isStatusChange && normalizedRequestedStatus === CLOSED_STATUS;

    if (!isManagementRole(req.user.role) && req.user.role !== USER_ROLES.ADMIN && isClosedTransition) {
      return res.status(403).json({
        message: "Direct CLOSED status update is restricted. Please send request for admin approval.",
      });
    }

    const parsedSiteLocation = parseSiteLocationPayload(rawSiteLocation);
    if (parsedSiteLocation.error) {
      return res.status(400).json({ message: parsedSiteLocation.error });
    }

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
      normalizedRequestedStatus === SITE_VISIT_STATUS && normalizedCurrentStatus !== SITE_VISIT_STATUS;
    let siteVisitDistanceMeters = null;

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

    if (isStatusChange) {
      lead.status = normalizedRequestedStatus;
      lead.lastContactedAt = new Date();
    }

    if (parsedFollowUp.provided) {
      lead.nextFollowUp = parsedFollowUp.value;
    }

    await lead.save();

    const activityAction = isStatusChange
      ? (siteVisitDistanceMeters !== null
        ? `Status changed to ${normalizedRequestedStatus} (${Math.round(siteVisitDistanceMeters)}m from site)`
        : `Status changed to ${normalizedRequestedStatus}`)
      : (parsedFollowUp.provided ? `Follow-up scheduled for ${parsedFollowUp.value.toISOString()}` : "Lead updated");

    await LeadActivity.create({
      lead: lead._id,
      action: activityAction,
      performedBy: req.user._id,
    });

    const populatedLead = await getLeadViewById(lead._id);

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

exports.createLeadStatusRequest = async (req, res) => {
  try {
    const { leadId } = req.params;
    const { status, nextFollowUp, requestNote, saleMeta, attachment } = req.body;

    if (!status) {
      return res.status(400).json({ message: "Status is required" });
    }

    if (isManagementRole(req.user.role) || req.user.role === USER_ROLES.ADMIN) {
      return res.status(400).json({
        message: "Management can directly update lead status",
      });
    }

    const normalizedRequestedStatus = String(status || "").toUpperCase();
    if (normalizedRequestedStatus !== CLOSED_STATUS) {
      return res.status(400).json({
        message: "Approval request is required only for CLOSED status",
      });
    }

    const parsedSaleMeta = parseClosedSaleMeta(saleMeta);
    if (parsedSaleMeta.error) {
      return res.status(400).json({ message: parsedSaleMeta.error });
    }

    const note = String(requestNote || "").trim() || "Lead closed with payment details";
    if (note.length > MAX_LEAD_STATUS_REQUEST_NOTE_LENGTH) {
      return res.status(400).json({
        message: `Request note cannot exceed ${MAX_LEAD_STATUS_REQUEST_NOTE_LENGTH} characters`,
      });
    }

    const parsedFollowUp = parseFollowUpDate(nextFollowUp);
    if (parsedFollowUp.error) {
      return res.status(400).json({ message: parsedFollowUp.error });
    }
    const safeAttachment = sanitizeStatusRequestAttachment(attachment);

    const accessibleLead = await findAccessibleLeadById({
      leadId,
      user: req.user,
    });
    if (!accessibleLead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    const pendingExists = await LeadStatusRequest.findOne({
      lead: leadId,
      status: "pending",
      requestedBy: req.user._id,
      companyId: req.user.companyId,
    })
      .select("_id")
      .lean();

    if (pendingExists) {
      return res.status(400).json({
        message: "A pending request already exists for this lead",
      });
    }

    const request = await LeadStatusRequest.create({
      companyId: req.user.companyId,
      lead: leadId,
      requestedBy: req.user._id,
      proposedStatus: normalizedRequestedStatus,
      proposedNextFollowUp: parsedFollowUp.provided ? parsedFollowUp.value : null,
      proposedSaleMeta: parsedSaleMeta.value,
      attachment: safeAttachment,
      requestNote: note,
    });

    const populated = await LeadStatusRequest.findById(request._id)
      .populate("lead", "name status")
      .populate("requestedBy", "name role")
      .lean();

    return res.status(201).json({
      message: "Lead status change request sent for admin approval",
      request: populated,
    });
  } catch (error) {
    logger.error({
      requestId: req.requestId || null,
      error: error.message,
      message: "createLeadStatusRequest failed",
    });
    return res.status(500).json({ message: "Server error" });
  }
};

exports.getPendingLeadStatusRequests = async (req, res) => {
  try {
    if (!isManagementRole(req.user.role) && req.user.role !== USER_ROLES.ADMIN) {
      return res.status(403).json({ message: "Access denied" });
    }

    const leadId = String(req.query?.leadId || "").trim();
    const query = {
      companyId: req.user.companyId,
      status: "pending",
    };
    if (leadId) {
      if (!isValidObjectId(leadId)) {
        return res.status(400).json({ message: "Invalid lead id" });
      }
      query.lead = leadId;
    }

    const requests = await LeadStatusRequest.find(query)
      .populate("lead", "name status nextFollowUp")
      .populate("requestedBy", "name role")
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      count: requests.length,
      requests,
    });
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
    if (!isManagementRole(req.user.role) && req.user.role !== USER_ROLES.ADMIN) {
      return res.status(403).json({ message: "Access denied" });
    }

    const { requestId } = req.params;
    const reviewNote = String(req.body?.reviewNote || "").trim();

    const request = await LeadStatusRequest.findOne({
      _id: requestId,
      companyId: req.user.companyId,
      status: "pending",
    });
    if (!request) {
      return res.status(404).json({ message: "Pending request not found" });
    }

    const lead = await Lead.findById(request.lead);
    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    lead.status = request.proposedStatus;
    lead.lastContactedAt = new Date();
    if (request.proposedNextFollowUp) {
      lead.nextFollowUp = request.proposedNextFollowUp;
    }
    await lead.save();

    request.status = "approved";
    request.reviewedBy = req.user._id;
    request.reviewedAt = new Date();
    request.reviewNote = reviewNote;
    request.rejectionReason = "";
    await request.save();

    await LeadActivity.create({
      lead: lead._id,
      action: `Status request approved (${request.proposedStatus})`,
      performedBy: req.user._id,
    });

    const populatedLead = await getLeadViewById(lead._id);
    const populatedRequest = await LeadStatusRequest.findById(request._id)
      .populate("lead", "name status nextFollowUp")
      .populate("requestedBy", "name role")
      .populate("reviewedBy", "name role")
      .lean();

    return res.json({
      message: "Status request approved",
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
    if (!isManagementRole(req.user.role) && req.user.role !== USER_ROLES.ADMIN) {
      return res.status(403).json({ message: "Access denied" });
    }

    const { requestId } = req.params;
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
    await request.save();

    await LeadActivity.create({
      lead: request.lead,
      action: "Status request rejected by admin",
      performedBy: req.user._id,
    });

    const populatedRequest = await LeadStatusRequest.findById(request._id)
      .populate("lead", "name status nextFollowUp")
      .populate("requestedBy", "name role")
      .populate("reviewedBy", "name role")
      .lean();

    return res.json({
      message: "Status request rejected",
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
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const query = {
      nextFollowUp: { $gte: todayStart, $lte: todayEnd },
    };

    if (EXECUTIVE_ROLES.includes(req.user.role)) {
      query.assignedTo = req.user._id;
    }

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

    const diaryQuery = { lead: leadId };
    if (req.user.role !== USER_ROLES.ADMIN) {
      diaryQuery.createdBy = req.user._id;
    }

    const queryBuilder = applyLeadDiaryPopulation(
      LeadDiary.find(diaryQuery)
        .sort({ createdAt: -1 }),
    );

    if (selectedFields) {
      queryBuilder.select(selectedFields);
    }

    if (pagination.enabled) {
      queryBuilder.skip(pagination.skip).limit(pagination.limit);
    }

    const entriesQuery = queryBuilder.lean();

    if (!pagination.enabled) {
      const entries = await entriesQuery;
      return res.json({
        entries: sanitizeDiaryEntriesForRole({
          entries,
          role: req.user.role,
        }),
      });
    }

    const [rawEntries, totalCount] = await Promise.all([
      entriesQuery,
      LeadDiary.countDocuments(diaryQuery),
    ]);
    const entries = sanitizeDiaryEntriesForRole({
      entries: rawEntries,
      role: req.user.role,
    });

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
    const conversation = String(req.body?.conversation || "").trim();
    const visitDetails = String(req.body?.visitDetails || "").trim();
    const nextStep = String(req.body?.nextStep || "").trim();
    const conversionDetails = String(req.body?.conversionDetails || "").trim();
    const voiceNoteUrl = String(req.body?.voiceNoteUrl || "").trim();
    const voiceNoteName = String(req.body?.voiceNoteName || "").trim();

    if (!note && !conversation && !visitDetails && !nextStep && !conversionDetails && !voiceNoteUrl) {
      return res.status(400).json({
        message: "At least one diary detail or voice note is required",
      });
    }

    if (note.length > MAX_LEAD_DIARY_NOTE_LENGTH || conversation.length > MAX_LEAD_DIARY_NOTE_LENGTH || visitDetails.length > MAX_LEAD_DIARY_NOTE_LENGTH || conversionDetails.length > MAX_LEAD_DIARY_NOTE_LENGTH) {
      return res.status(400).json({
        message: `Diary note cannot exceed ${MAX_LEAD_DIARY_NOTE_LENGTH} characters`,
      });
    }
    if (nextStep.length > MAX_LEAD_DIARY_NEXT_STEP_LENGTH) {
      return res.status(400).json({
        message: `Next step cannot exceed ${MAX_LEAD_DIARY_NEXT_STEP_LENGTH} characters`,
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
      conversation,
      visitDetails,
      nextStep,
      conversionDetails,
      voiceNoteUrl,
      voiceNoteName,
      createdBy: req.user._id,
    });

    await LeadActivity.create({
      lead: leadId,
      action: "Lead diary note added",
      performedBy: req.user._id,
    });

    const rawPopulatedEntry = await applyLeadDiaryPopulation(
      LeadDiary.findById(entry._id),
    ).lean();
    const [populatedEntry] = sanitizeDiaryEntriesForRole({
      entries: rawPopulatedEntry ? [rawPopulatedEntry] : [],
      role: req.user.role,
    });

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

exports.updateLeadDiaryEntry = async (req, res) => {
  try {
    const { leadId, entryId } = req.params;
    if (!isValidObjectId(leadId) || !isValidObjectId(entryId)) {
      return res.status(400).json({ message: "Invalid lead diary reference" });
    }

    const note = String(req.body?.note || "").trim();
    if (!note) {
      return res.status(400).json({ message: "Diary note cannot be empty" });
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

    const entry = await LeadDiary.findOne({
      _id: entryId,
      lead: leadId,
    });
    if (!entry) {
      return res.status(404).json({ message: "Lead diary entry not found" });
    }

    const canEditAny = req.user.role === USER_ROLES.ADMIN;
    const isOwnEntry = String(entry.createdBy || "") === String(req.user._id || "");
    if (!canEditAny && !isOwnEntry) {
      return res.status(403).json({
        message: "You can edit only your own diary entries",
      });
    }

    const currentNote = String(entry.note || "").trim();
    if (note === currentNote) {
      const rawEntry = await applyLeadDiaryPopulation(
        LeadDiary.findById(entry._id),
      ).lean();
      const [sameEntry] = sanitizeDiaryEntriesForRole({
        entries: rawEntry ? [rawEntry] : [],
        role: req.user.role,
      });
      return res.json({
        message: "No changes detected",
        entry: sameEntry || null,
      });
    }

    entry.editHistory.push({
      previousNote: currentNote,
      updatedNote: note,
      editedBy: req.user._id,
      editedAt: new Date(),
    });
    entry.note = note;
    entry.isEdited = true;
    entry.lastEditedAt = new Date();
    entry.lastEditedBy = req.user._id;
    await entry.save();

    await LeadActivity.create({
      lead: leadId,
      action: "Lead diary note edited",
      performedBy: req.user._id,
    });

    const rawPopulatedEntry = await applyLeadDiaryPopulation(
      LeadDiary.findById(entry._id),
    ).lean();
    const [populatedEntry] = sanitizeDiaryEntriesForRole({
      entries: rawPopulatedEntry ? [rawPopulatedEntry] : [],
      role: req.user.role,
    });

    return res.json({
      message: "Lead diary entry updated",
      entry: populatedEntry,
    });
  } catch (error) {
    logger.error({
      requestId: req.requestId || null,
      error: error.message,
      message: "updateLeadDiaryEntry failed",
    });
    return res.status(500).json({ message: "Server error" });
  }
};
