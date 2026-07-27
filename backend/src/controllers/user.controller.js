const User = require("../models/User");
const Lead = require("../models/Lead");
const Inventory = require("../models/Inventory");
const UserDeleteRequest = require("../models/UserDeleteRequest");
const LeadActivity = require("../models/leadActivity.model");
const LeadDiary = require("../models/leadDiary.model");
const mongoose = require("mongoose");
const logger = require("../config/logger");
const {
  redistributePipelineLeads,
} = require("../services/leadAssignment.service");
const {
  USER_ROLES,
  PLATFORM_ADMIN_ROLES,
  EXECUTIVE_ROLES,
  LEAD_OWNER_ROLES,
  MANUAL_LEAD_TRANSFER_TARGET_ROLES,
  PRODUCTION_ROLES,
  MANAGEMENT_ROLES,
  ROLE_LABELS,
  getAllowedParentRoles,
  getAutoParentRoles,
  isManagementRole,
  isPlatformAdminRole,
} = require("../constants/role.constants");
const {
  getDescendantUsers,
  getDescendantExecutiveIds,
  getDescendantByRoleCount,
  getFirstLevelChildrenByRole,
} = require("../services/hierarchy.service");
const {
  parsePagination,
  buildPaginationMeta,
  parseFieldSelection,
} = require("../utils/queryOptions");

const LOCATION_ALLOWED_ROLES = [...EXECUTIVE_ROLES];
const LOCATION_VIEWER_ROLES = [
  ...PLATFORM_ADMIN_ROLES,
  ...MANAGEMENT_ROLES,
  USER_ROLES.FIELD_EXECUTIVE,
];
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
const TEAM_HIERARCHY_CHILD_ROLES = {
  [USER_ROLES.MANAGER]: [
    ...EXECUTIVE_ROLES,
    ...PRODUCTION_ROLES,
    USER_ROLES.CHANNEL_PARTNER,
  ],
  [USER_ROLES.ADMIN]: [USER_ROLES.MANAGER],
  [USER_ROLES.SUPER_ADMIN]: [USER_ROLES.ADMIN],
};
const USER_SELECTABLE_FIELDS = [
  "_id",
  "name",
  "email",
  "phone",
  "role",
  "companyId",
  "parentId",
  "partnerCode",
  "canViewInventory",
  "brokerageConfig",
  "isActive",
  "lastAssignedAt",
  "liveLocation",
  "createdAt",
  "updatedAt",
];
const USER_ROLE_VALUES = Object.values(USER_ROLES);
const ADMIN_TOOL_ROLES = [...PLATFORM_ADMIN_ROLES, USER_ROLES.MANAGER];
const canUseAdminTools = (role) => ADMIN_TOOL_ROLES.includes(role);
const CRM_ASSIGNABLE_ROLES = [
  ...PLATFORM_ADMIN_ROLES,
  ...MANAGEMENT_ROLES,
  USER_ROLES.INSIDE_EXECUTIVE,
  USER_ROLES.EXECUTIVE,
];
const BROKERAGE_MODES = Object.freeze(["FLAT", "PERCENTAGE"]);
const DEFAULT_BROKERAGE_VALUE = 50000;
const DEFAULT_BROKERAGE_PERCENTAGE = 2;
const MAX_BROKERAGE_NOTES_LENGTH = 240;
const LEADERBOARD_ROLE_OPTIONS_BY_ACTOR = Object.freeze({
  [USER_ROLES.ADMIN]: [
    USER_ROLES.MANAGER,
    USER_ROLES.EXECUTIVE,
    USER_ROLES.FIELD_EXECUTIVE,
    USER_ROLES.CHANNEL_PARTNER,
  ],
  [USER_ROLES.SUPER_ADMIN]: [
    USER_ROLES.ADMIN,
    USER_ROLES.MANAGER,
    USER_ROLES.EXECUTIVE,
    USER_ROLES.FIELD_EXECUTIVE,
    USER_ROLES.CHANNEL_PARTNER,
  ],
  [USER_ROLES.MANAGER]: [
    USER_ROLES.EXECUTIVE,
    USER_ROLES.FIELD_EXECUTIVE,
    USER_ROLES.CHANNEL_PARTNER,
  ],
  [USER_ROLES.EXECUTIVE]: [USER_ROLES.EXECUTIVE],
  [USER_ROLES.FIELD_EXECUTIVE]: [USER_ROLES.FIELD_EXECUTIVE],
  [USER_ROLES.CHANNEL_PARTNER]: [USER_ROLES.CHANNEL_PARTNER],
});

const toFiniteNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeLatitude = (value) => {
  const parsed = toFiniteNumber(value);
  if (parsed === null) return null;
  if (parsed < -90 || parsed > 90) return null;
  return parsed;
};

const normalizeLongitude = (value) => {
  const parsed = toFiniteNumber(value);
  if (parsed === null) return null;
  if (parsed < -180 || parsed > 180) return null;
  return parsed;
};

const normalizeOptionalNumber = (value) => {
  const parsed = toFiniteNumber(value);
  return parsed === null ? null : Math.max(0, parsed);
};

const sanitizeName = (value) => String(value || "").trim();
const sanitizePhone = (value) => String(value || "").trim();
const sanitizeProfileImageUrl = (value) => String(value || "").trim();
const sanitizeEmail = (value) => String(value || "").trim().toLowerCase();
const sanitizeBrokerageNotes = (value) => String(value || "").trim();
const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ""));
const isValidObjectId = (value) =>
  /^[a-fA-F0-9]{24}$/.test(String(value || "").trim());
const toRoleExpectationLabel = (roles = []) =>
  roles.map((parentRole) => ROLE_LABELS[parentRole] || parentRole).join(" / ");

const toBrokerageConfigView = (config) => {
  const normalizedMode = String(config?.mode || "").trim().toUpperCase();
  const mode = BROKERAGE_MODES.includes(normalizedMode) ? normalizedMode : "FLAT";
  const fallbackValue =
    mode === "PERCENTAGE" ? DEFAULT_BROKERAGE_PERCENTAGE : DEFAULT_BROKERAGE_VALUE;
  const parsedValue = toFiniteNumber(config?.value);
  const value = parsedValue === null ? fallbackValue : Math.max(0, parsedValue);

  return {
    mode,
    value: mode === "PERCENTAGE" ? Math.min(value, 100) : value,
    notes: sanitizeBrokerageNotes(config?.notes),
  };
};

const normalizeBrokerageConfigInput = (input, fallbackConfig = null) => {
  if (input === null || input === undefined) {
    return { value: toBrokerageConfigView(fallbackConfig) };
  }

  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { error: "brokerageConfig must be an object" };
  }

  const fallback = toBrokerageConfigView(fallbackConfig);
  const requestedMode = Object.prototype.hasOwnProperty.call(input, "mode")
    ? String(input.mode || "").trim().toUpperCase()
    : fallback.mode;

  if (!BROKERAGE_MODES.includes(requestedMode)) {
    return {
      error: `brokerageConfig.mode must be one of: ${BROKERAGE_MODES.join(", ")}`,
    };
  }

  const requestedValue = Object.prototype.hasOwnProperty.call(input, "value")
    ? input.value
    : fallback.value;
  const value = toFiniteNumber(requestedValue);
  if (value === null || value < 0) {
    return {
      error: "brokerageConfig.value must be a valid number greater than or equal to 0",
    };
  }

  if (requestedMode === "PERCENTAGE" && value > 100) {
    return {
      error: "brokerageConfig.value cannot exceed 100 for percentage brokerage",
    };
  }

  const notes = Object.prototype.hasOwnProperty.call(input, "notes")
    ? sanitizeBrokerageNotes(input.notes)
    : fallback.notes;
  if (notes.length > MAX_BROKERAGE_NOTES_LENGTH) {
    return {
      error: `brokerageConfig.notes cannot exceed ${MAX_BROKERAGE_NOTES_LENGTH} characters`,
    };
  }

  return {
    value: {
      mode: requestedMode,
      value,
      notes,
    },
  };
};

const getLeadScopeLabel = (role) => {
  if (isPlatformAdminRole(role)) return "Global Leads";
  if (isManagementRole(role)) return "Team Leads";
  if (EXECUTIVE_ROLES.includes(role)) return "Assigned Leads";
  if (role === USER_ROLES.CHANNEL_PARTNER) return "Created Leads";
  return "Owned Leads";
};

const buildLeadScopeQuery = async (userDoc) => {
  if (!userDoc.companyId) {
    return { _id: null };
  }

  const companyScope = { companyId: userDoc.companyId };

  if (isPlatformAdminRole(userDoc.role)) {
    return companyScope;
  }

  if (isManagementRole(userDoc.role)) {
    const teamExecutiveIds = await getDescendantExecutiveIds({
      rootUserId: userDoc._id,
      companyId: userDoc.companyId,
    });
    return {
      ...companyScope,
      assignedTo: { $in: teamExecutiveIds },
    };
  }

  if (EXECUTIVE_ROLES.includes(userDoc.role)) {
    return { ...companyScope, assignedTo: userDoc._id };
  }

  if (userDoc.role === USER_ROLES.CHANNEL_PARTNER) {
    return { ...companyScope, createdBy: userDoc._id };
  }

  return { ...companyScope, createdBy: userDoc._id };
};

const buildLeadStatusMap = (rows) => {
  const map = {};
  LEAD_STATUSES.forEach((status) => {
    map[status] = 0;
  });

  rows.forEach((row) => {
    if (!row?._id || !Object.prototype.hasOwnProperty.call(map, row._id)) return;
    map[row._id] = Number(row.count || 0);
  });

  return map;
};

const buildProfilePerformanceSummary = async (userDoc) => {
  const leadQuery = await buildLeadScopeQuery(userDoc);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const [leadSummaryRows, recentLeads, activitiesPerformed, diaryEntriesCreated, directReports] = await Promise.all([
    Lead.aggregate([
      { $match: leadQuery },
      {
        $facet: {
          statusRows: [
            {
              $group: {
                _id: "$status",
                count: { $sum: 1 },
              },
            },
          ],
          totals: [
            {
              $group: {
                _id: null,
                totalLeads: { $sum: 1 },
                dueFollowUpsToday: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $gte: ["$nextFollowUp", todayStart] },
                          { $lte: ["$nextFollowUp", todayEnd] },
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
                overdueFollowUps: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $lt: ["$nextFollowUp", todayStart] },
                          { $not: [{ $in: ["$status", ["CLOSED", "LOST"]] }] },
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
                siteVisits: {
                  $sum: {
                    $cond: [{ $eq: ["$status", "SITE_VISIT"] }, 1, 0],
                  },
                },
              },
            },
          ],
        },
      },
    ]),
    Lead.find(leadQuery)
      .select(
        "_id name phone city projectInterested status nextFollowUp updatedAt assignedTo createdBy",
      )
      .populate("assignedTo", "name role")
      .populate("createdBy", "name role")
      .sort({ updatedAt: -1 })
      .limit(6)
      .lean(),
    LeadActivity.countDocuments({ performedBy: userDoc._id }),
    LeadDiary.countDocuments({ createdBy: userDoc._id }),
    User.countDocuments({
      companyId: userDoc.companyId,
      parentId: userDoc._id,
      isActive: true,
    }),
  ]);

  const leadSummary = leadSummaryRows?.[0] || {};
  const statusRows = leadSummary.statusRows || [];
  const totals = leadSummary.totals?.[0] || {};
  const totalLeads = Number(totals.totalLeads || 0);
  const dueFollowUpsToday = Number(totals.dueFollowUpsToday || 0);
  const overdueFollowUps = Number(totals.overdueFollowUps || 0);
  const siteVisits = Number(totals.siteVisits || 0);
  const statusBreakdown = buildLeadStatusMap(statusRows);
  const closedLeads = statusBreakdown.CLOSED || 0;
  const conversionRate = totalLeads
    ? Math.round((closedLeads / totalLeads) * 100)
    : 0;

  return {
    leadScope: getLeadScopeLabel(userDoc.role),
    totalLeads,
    closedLeads,
    conversionRate,
    dueFollowUpsToday,
    overdueFollowUps,
    siteVisits,
    directReports,
    activitiesPerformed,
    diaryEntriesCreated,
    statusBreakdown,
    recentLeads,
  };
};

const parseWindowDays = (value, fallback = 30, max = 365) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
};

const toUserDeleteRequestView = (request) => ({
  _id: request._id,
  companyId: request.companyId,
  requestedBy: request.requestedBy,
  targetUser: request.targetUser,
  reason: request.reason || "",
  snapshot: request.snapshot || {},
  status: request.status,
  reviewedBy: request.reviewedBy || null,
  reviewedAt: request.reviewedAt || null,
  reviewNote: request.reviewNote || "",
  createdAt: request.createdAt || null,
  updatedAt: request.updatedAt || null,
});

const emitUserDeleteRequestCreated = ({ req, request }) => {
  const io = req.app.get("io");
  if (!io || !request?.companyId) return;

  const companyId = String(request.companyId);
  const payload = {
    eventId: `user-delete:${request._id}`,
    source: "user-delete",
    requestType: "USER_DELETE",
    requestId: request._id,
    status: request.status,
    companyId,
    targetUser: request.targetUser || null,
    requestedBy: request.requestedBy || null,
    createdAt: request.createdAt,
    message: "New user delete request",
  };

  io.to(`company:${companyId}:role:${USER_ROLES.ADMIN}`).emit("admin:request:new", payload);
  io.to(`company:${companyId}:role:${USER_ROLES.ADMIN}`).emit(
    "user-delete:request:created",
    payload,
  );
};

const deleteUserForAdmin = async ({ adminUser, targetUserId }) => {
  if (String(adminUser._id) === String(targetUserId)) {
    return { statusCode: 400, payload: { message: "You cannot delete your own account" } };
  }

  const user = await User.findOne({
    _id: targetUserId,
    companyId: adminUser.companyId,
  })
    .select("_id role")
    .lean();
  if (!user) {
    return { statusCode: 404, payload: { message: "User not found" } };
  }

  if (isManagementRole(user.role)) {
    const hasTeam = await User.exists({
      parentId: user._id,
      companyId: adminUser.companyId,
    });

    if (hasTeam) {
      return {
        statusCode: 400,
        payload: {
          message: "User has active direct reports. Reassign team before deleting.",
        },
      };
    }
  }

  await Lead.updateMany(
    { assignedTo: user._id, companyId: adminUser.companyId },
    { $set: { assignedTo: null } },
  );

  await User.deleteOne({ _id: targetUserId, companyId: adminUser.companyId });

  return { statusCode: 200, payload: { message: "User deleted successfully" } };
};

const getLeaderboardAllowedRolesForActor = (actorRole) => {
  const role = String(actorRole || "").trim().toUpperCase();
  if (!role) return [];
  const options = LEADERBOARD_ROLE_OPTIONS_BY_ACTOR[role] || [];
  return options.filter((option) => USER_ROLE_VALUES.includes(option));
};

const resolveLeaderboardRoleForActor = ({
  actorRole,
  requestedRole,
  allowedRoles = [],
}) => {
  const requested = String(requestedRole || "").trim().toUpperCase();

  if (!allowedRoles.length) return null;
  if (!requested) return allowedRoles[0];

  if (!allowedRoles.includes(requested)) {
    return null;
  }

  return requested;
};

const toLeaderboardRoleFilterOptions = (roles = []) =>
  roles.map((role) => ({
    value: role,
    label: ROLE_LABELS[role] || role,
  }));

const normalizeOwnerIds = (ownerIds = []) => {
  const deduped = new Map();

  ownerIds.forEach((ownerId) => {
    if (ownerId === null || ownerId === undefined) return;

    if (typeof ownerId === "object" && ownerId._bsontype === "ObjectId") {
      const key = String(ownerId);
      if (!deduped.has(key)) deduped.set(key, ownerId);
      return;
    }

    const key = String(ownerId || "").trim();
    if (!isValidObjectId(key)) return;
    if (!deduped.has(key)) {
      deduped.set(key, new mongoose.Types.ObjectId(key));
    }
  });

  return [...deduped.values()];
};

const toLeaderboardRate = (closedLeads, totalLeads) => {
  const total = Number(totalLeads || 0);
  if (!total) return 0;
  return Math.round((Number(closedLeads || 0) / total) * 1000) / 10;
};

const sortLeaderboardRows = (rows = []) =>
  [...rows].sort((left, right) => {
    if (right.closedLeads !== left.closedLeads) {
      return right.closedLeads - left.closedLeads;
    }
    if (right.conversionRate !== left.conversionRate) {
      return right.conversionRate - left.conversionRate;
    }
    if (right.totalLeads !== left.totalLeads) {
      return right.totalLeads - left.totalLeads;
    }
    if (right.siteVisits !== left.siteVisits) {
      return right.siteVisits - left.siteVisits;
    }
    return String(left.name || "").localeCompare(String(right.name || ""));
  });

const rankLeaderboardRows = (rows = []) => {
  const sorted = sortLeaderboardRows(rows);
  let previousKey = "";
  let currentRank = 0;

  return sorted.map((row, index) => {
    const key = [
      row.closedLeads,
      row.conversionRate,
      row.totalLeads,
      row.siteVisits,
    ].join(":");

    if (key !== previousKey) {
      currentRank = index + 1;
      previousKey = key;
    }

    return {
      ...row,
      rank: currentRank,
    };
  });
};

const buildLeadPerformanceRowsByOwnerIds = async ({
  ownerField,
  ownerIds = [],
  sinceDate = null,
  companyId = null,
}) => {
  const normalizedOwnerIds = normalizeOwnerIds(ownerIds);
  if (!ownerField || !normalizedOwnerIds.length) {
    return new Map();
  }

  const match = {
    [ownerField]: { $in: normalizedOwnerIds },
  };
  if (companyId) {
    match.companyId = companyId;
  }

  if (sinceDate instanceof Date && !Number.isNaN(sinceDate.getTime())) {
    // Use updatedAt so closures in the selected window are reflected immediately.
    match.updatedAt = { $gte: sinceDate };
  }

  const rows = await Lead.aggregate([
    { $match: match },
    {
      $group: {
        _id: `$${ownerField}`,
        totalLeads: { $sum: 1 },
        closedLeads: {
          $sum: {
            $cond: [{ $eq: ["$status", "CLOSED"] }, 1, 0],
          },
        },
        siteVisits: {
          $sum: {
            $cond: [{ $eq: ["$status", "SITE_VISIT"] }, 1, 0],
          },
        },
      },
    },
  ]);

  return new Map(
    rows.map((row) => [
      String(row._id),
      {
        totalLeads: Number(row.totalLeads || 0),
        closedLeads: Number(row.closedLeads || 0),
        siteVisits: Number(row.siteVisits || 0),
      },
    ]),
  );
};

const toProfileView = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone || "",
  profileImageUrl: user.profileImageUrl || "",
  role: user.role,
  companyId: user.companyId || null,
  parentId: user.parentId || null,
  partnerCode: user.partnerCode || null,
  canViewInventory: Boolean(user.canViewInventory),
  brokerageConfig: toBrokerageConfigView(user.brokerageConfig),
  isActive: Boolean(user.isActive),
  lastAssignedAt: user.lastAssignedAt || null,
  liveLocation: user.liveLocation || null,
  createdAt: user.createdAt || null,
  updatedAt: user.updatedAt || null,
  manager: user.parentId
    ? {
      _id: user.parentId._id || null,
      name: user.parentId.name || "",
      email: user.parentId.email || "",
      phone: user.parentId.phone || "",
      role: user.parentId.role || "",
    }
    : null,
});

const buildProfileSummary = async (userDoc) => {
  const role = userDoc.role;
  const companyId = userDoc.companyId;
  const userId = userDoc._id;

  if (isPlatformAdminRole(role)) {
    const [
      users,
      managers,
      executives,
      fieldExecutives,
      leads,
      inventory,
    ] = await Promise.all([
      User.countDocuments({ companyId, isActive: true }),
      User.countDocuments({ companyId, role: USER_ROLES.MANAGER, isActive: true }),
      User.countDocuments({ companyId, role: USER_ROLES.EXECUTIVE, isActive: true }),
      User.countDocuments({
        companyId,
        role: USER_ROLES.FIELD_EXECUTIVE,
        isActive: true,
      }),
      Lead.countDocuments({ companyId }),
      Inventory.countDocuments({ companyId }),
    ]);

    return {
      users,
      managers,
      executives,
      fieldExecutives,
      leads,
      inventory,
    };
  }

  if (isManagementRole(role)) {
    const descendantCounts = await getDescendantByRoleCount({
      rootUserId: userId,
      companyId,
      roles: [
        USER_ROLES.EXECUTIVE,
        USER_ROLES.FIELD_EXECUTIVE,
        USER_ROLES.CHANNEL_PARTNER,
      ],
    });
    const executiveIds = await getDescendantExecutiveIds({
      rootUserId: userId,
      companyId,
    });

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const [teamLeads, dueFollowUpsToday] = executiveIds.length
      ? await Promise.all([
        Lead.countDocuments({ companyId, assignedTo: { $in: executiveIds } }),
        Lead.countDocuments({
          companyId,
          assignedTo: { $in: executiveIds },
          nextFollowUp: { $gte: todayStart, $lte: todayEnd },
        }),
      ])
      : [0, 0];

    const executives = Number(descendantCounts[USER_ROLES.EXECUTIVE] || 0);
    const fieldExecutives = Number(
      descendantCounts[USER_ROLES.FIELD_EXECUTIVE] || 0,
    );
    const channelPartners = Number(descendantCounts[USER_ROLES.CHANNEL_PARTNER] || 0);

    return {
      teamMembers: executives + fieldExecutives + channelPartners,
      executives,
      fieldExecutives,
      channelPartners,
      teamLeads,
      dueFollowUpsToday,
    };
  }

  if (EXECUTIVE_ROLES.includes(role)) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const [assignedLeads, openLeads, closedLeads, dueFollowUpsToday] = await Promise.all([
      Lead.countDocuments({ companyId, assignedTo: userId }),
      Lead.countDocuments({
        companyId,
        assignedTo: userId,
        status: {
          $in: [
            "NEW",
            "CONTACTED",
            "INTERESTED",
            "SITE_VISIT_SCHEDULED",
            "SITE_VISIT",
            "SITE_VISIT_OVERDUE",
            "MISSING_IN_ACTION",
            "NOT_PICKING_CALLS",
            "OWNER",
            "BROKER",
            "REQUESTED",
          ],
        },
      }),
      Lead.countDocuments({ companyId, assignedTo: userId, status: "CLOSED" }),
      Lead.countDocuments({
        companyId,
        assignedTo: userId,
        nextFollowUp: { $gte: todayStart, $lte: todayEnd },
      }),
    ]);

    return {
      assignedLeads,
      openLeads,
      closedLeads,
      dueFollowUpsToday,
    };
  }

  if (role === USER_ROLES.CHANNEL_PARTNER) {
    const [createdLeads, closedLeads] = await Promise.all([
      Lead.countDocuments({ companyId, createdBy: userId }),
      Lead.countDocuments({ companyId, createdBy: userId, status: "CLOSED" }),
    ]);

    return {
      createdLeads,
      closedLeads,
    };
  }

  return {};
};

const findLeastLoadedParentForRole = async ({
  companyId,
  role,
  currentAdminId,
}) => {
  const autoParentRoles = getAutoParentRoles(role);
  if (!autoParentRoles.length) return null;

  if (autoParentRoles.includes(USER_ROLES.ADMIN)) {
    return currentAdminId
      ? { _id: currentAdminId, role: USER_ROLES.ADMIN }
      : null;
  }

  for (const parentRole of autoParentRoles) {
    const childRoles = TEAM_HIERARCHY_CHILD_ROLES[parentRole] || [];
    const candidates = await getFirstLevelChildrenByRole({
      parentRole,
      childRoles,
      companyId,
    });

    if (candidates.length) {
      return candidates[0];
    }
  }

  return null;
};

exports.getUsers = async (req, res) => {
  try {
    if (!req.user.companyId && req.user.role !== USER_ROLES.SUPER_ADMIN) {
      return res.status(403).json({ message: "Company context is required" });
    }

    const companyScope = req.user.role === USER_ROLES.SUPER_ADMIN ? {} : { companyId: req.user.companyId };
    const crmAssignableOnly = String(req.query?.crmAssignable || "").trim().toLowerCase() === "true";
    let query = {};

    if (crmAssignableOnly) {
      if (!CRM_ASSIGNABLE_ROLES.includes(req.user.role)) {
        return res.status(403).json({ message: "Access denied" });
      }
      query = {
        ...companyScope,
        role: { $in: MANUAL_LEAD_TRANSFER_TARGET_ROLES },
        isActive: true,
      };
    } else if (isPlatformAdminRole(req.user.role)) {
      query = companyScope;
    } else if (isManagementRole(req.user.role)) {
      const descendants = await getDescendantUsers({
        rootUserId: req.user._id,
        companyId: req.user.companyId,
        includeInactive: true,
        select: "_id role parentId isActive",
      });
      const visibleIds = [req.user._id, ...descendants.map((row) => row._id)];
      query = {
        ...companyScope,
        _id: { $in: visibleIds },
      };
    } else {
      return res.status(403).json({ message: "Access denied" });
    }

    const pagination = parsePagination(req.query, {
      defaultLimit: Number.parseInt(process.env.USERS_PAGE_LIMIT, 10) || 50,
      maxLimit: Number.parseInt(process.env.USERS_PAGE_MAX_LIMIT, 10) || 200,
    });
    const selectedFields = parseFieldSelection(
      req.query?.fields,
      USER_SELECTABLE_FIELDS,
    );

    const usersQuery = User.find(query)
      .populate("parentId", "name role")
      .sort({ createdAt: -1 });

    if (selectedFields) {
      usersQuery.select(selectedFields);
    }

    if (pagination.enabled) {
      usersQuery.skip(pagination.skip).limit(pagination.limit);
    }

    const resolvedUsersQuery = usersQuery.lean();

    if (!pagination.enabled) {
      const users = await resolvedUsersQuery;
      return res.json({
        count: users.length,
        users,
      });
    }

    const [users, totalCount] = await Promise.all([
      resolvedUsersQuery,
      User.countDocuments(query),
    ]);

    return res.json({
      count: users.length,
      users,
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
      message: "getUsers failed",
    });
    return res.status(500).json({ message: "Server error" });
  }
};

exports.getRoleLeaderboard = async (req, res) => {
  try {
    if (!req.user.companyId && req.user.role !== USER_ROLES.SUPER_ADMIN) {
      return res.status(403).json({ message: "Company context is required" });
    }

    const actorRole = String(req.user.role || "").trim().toUpperCase();
    if (!actorRole) {
      return res.status(400).json({ message: "Role context is required" });
    }
    const allowedRoleFilters = getLeaderboardAllowedRolesForActor(actorRole);
    if (!allowedRoleFilters.length) {
      return res.status(403).json({ message: "Role does not have leaderboard access" });
    }
    const selectedRole = resolveLeaderboardRoleForActor({
      actorRole,
      requestedRole: req.query?.role,
      allowedRoles: allowedRoleFilters,
    });
    if (!selectedRole) {
      return res.status(400).json({ message: "Invalid role filter" });
    }

    const windowDays = parseWindowDays(req.query?.windowDays, 30, 365);
    const sinceDate = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

    const peers = await User.find({
      companyId: req.user.companyId,
      role: selectedRole,
      isActive: true,
    })
      .select("_id name role")
      .sort({ name: 1 })
      .lean();

    if (!peers.length) {
      return res.json({
        role: selectedRole,
        roleLabel: ROLE_LABELS[selectedRole] || selectedRole,
        allowedRoleFilters: toLeaderboardRoleFilterOptions(allowedRoleFilters),
        windowDays,
        since: sinceDate.toISOString(),
        count: 0,
        leaderboard: [],
      });
    }

    const peerIds = peers.map((peer) => peer._id);
    const metricsByPeerId = new Map(
      peerIds.map((peerId) => [
        String(peerId),
        {
          totalLeads: 0,
          closedLeads: 0,
          siteVisits: 0,
        },
      ]),
    );

    if (EXECUTIVE_ROLES.includes(selectedRole)) {
      const assignedMetricsByOwnerId = await buildLeadPerformanceRowsByOwnerIds({
        ownerField: "assignedTo",
        ownerIds: peerIds,
        sinceDate,
        companyId: req.user.companyId,
      });

      assignedMetricsByOwnerId.forEach((metrics, ownerId) => {
        metricsByPeerId.set(String(ownerId), metrics);
      });
    } else if (isManagementRole(selectedRole)) {
      const managementTeams = await Promise.all(
        peers.map(async (peer) => ({
          peerId: String(peer._id),
          executiveIds: await getDescendantExecutiveIds({
            rootUserId: peer._id,
            companyId: req.user.companyId,
          }),
        })),
      );

      const allExecutiveIds = [
        ...new Map(
          managementTeams
            .flatMap((row) => row.executiveIds)
            .map((executiveId) => [String(executiveId), executiveId]),
        ).values(),
      ];
      const assignedMetricsByOwnerId = await buildLeadPerformanceRowsByOwnerIds({
        ownerField: "assignedTo",
        ownerIds: allExecutiveIds,
        sinceDate,
        companyId: req.user.companyId,
      });

      managementTeams.forEach((teamRow) => {
        const summary = {
          totalLeads: 0,
          closedLeads: 0,
          siteVisits: 0,
        };

        teamRow.executiveIds.forEach((executiveId) => {
          const metrics = assignedMetricsByOwnerId.get(String(executiveId));
          if (!metrics) return;
          summary.totalLeads += Number(metrics.totalLeads || 0);
          summary.closedLeads += Number(metrics.closedLeads || 0);
          summary.siteVisits += Number(metrics.siteVisits || 0);
        });

        metricsByPeerId.set(teamRow.peerId, summary);
      });
    } else if ([USER_ROLES.CHANNEL_PARTNER, USER_ROLES.ADMIN].includes(selectedRole)) {
      const creatorMetricsByOwnerId = await buildLeadPerformanceRowsByOwnerIds({
        ownerField: "createdBy",
        ownerIds: peerIds,
        sinceDate,
        companyId: req.user.companyId,
      });

      creatorMetricsByOwnerId.forEach((metrics, ownerId) => {
        metricsByPeerId.set(String(ownerId), metrics);
      });
    }

    const me = String(req.user._id || "");
    const rows = peers.map((peer) => {
      const metrics = metricsByPeerId.get(String(peer._id)) || {
        totalLeads: 0,
        closedLeads: 0,
        siteVisits: 0,
      };

      const totalLeads = Number(metrics.totalLeads || 0);
      const closedLeads = Number(metrics.closedLeads || 0);
      const siteVisits = Number(metrics.siteVisits || 0);

      return {
        userId: peer._id,
        name: peer.name || "Unknown User",
        role: peer.role || selectedRole,
        totalLeads,
        closedLeads,
        siteVisits,
        conversionRate: toLeaderboardRate(closedLeads, totalLeads),
        isSelf: String(peer._id) === me,
      };
    });

    const leaderboard = rankLeaderboardRows(rows);
    return res.json({
      role: selectedRole,
      roleLabel: ROLE_LABELS[selectedRole] || selectedRole,
      allowedRoleFilters: toLeaderboardRoleFilterOptions(allowedRoleFilters),
      windowDays,
      since: sinceDate.toISOString(),
      count: leaderboard.length,
      leaderboard,
    });
  } catch (error) {
    logger.error({
      requestId: req.requestId || null,
      error: error.message,
      message: "getRoleLeaderboard failed",
    });
    return res.status(500).json({ message: "Server error" });
  }
};

exports.getMyProfile = async (req, res) => {
  try {
    const profileDoc = await User.findOne({
      _id: req.user._id,
      companyId: req.user.companyId,
    })
      .populate("parentId", "name email phone role")
      .lean();

    if (!profileDoc) {
      return res.status(404).json({ message: "User not found" });
    }

    const summary = await buildProfileSummary({
      ...profileDoc,
      _id: req.user._id,
      companyId: req.user.companyId,
      role: req.user.role,
    });

    return res.json({
      profile: toProfileView(profileDoc),
      summary,
    });
  } catch (error) {
    logger.error({
      requestId: req.requestId || null,
      error: error.message,
      message: "getMyProfile failed",
    });
    return res.status(500).json({ message: "Server error" });
  }
};

exports.getUserProfileForAdmin = async (req, res) => {
  try {
    if (!canUseAdminTools(req.user.role)) {
      return res.status(403).json({ message: "Only ADMIN can view this profile" });
    }

    const { userId } = req.params;
    if (!isValidObjectId(userId)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    const profileDoc = await User.findOne({
      _id: userId,
      companyId: req.user.companyId,
    })
      .populate("parentId", "name email phone role")
      .lean();

    if (!profileDoc) {
      return res.status(404).json({ message: "User not found" });
    }

    const profileContext = {
      ...profileDoc,
      _id: profileDoc._id,
      role: profileDoc.role,
      companyId: profileDoc.companyId || req.user.companyId,
    };

    const [summary, performance] = await Promise.all([
      buildProfileSummary(profileContext),
      buildProfilePerformanceSummary(profileContext),
    ]);

    return res.json({
      profile: toProfileView(profileDoc),
      summary,
      performance,
    });
  } catch (error) {
    logger.error({
      requestId: req.requestId || null,
      error: error.message,
      message: "getUserProfileForAdmin failed",
    });
    return res.status(500).json({ message: "Server error" });
  }
};

exports.updateMyProfile = async (req, res) => {
  try {
    const patch = {};
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "name")) {
      const name = sanitizeName(req.body.name);
      if (!name || name.length < 2 || name.length > 80) {
        return res.status(400).json({
          message: "Name must be between 2 and 80 characters",
        });
      }
      patch.name = name;
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, "phone")) {
      const phone = sanitizePhone(req.body.phone);
      if (phone.length > 25) {
        return res.status(400).json({
          message: "Phone cannot exceed 25 characters",
        });
      }
      patch.phone = phone;
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, "profileImageUrl")) {
      const profileImageUrl = sanitizeProfileImageUrl(req.body.profileImageUrl);
      if (profileImageUrl.length > 1200) {
        return res.status(400).json({
          message: "Profile image URL is too long",
        });
      }
      if (
        profileImageUrl
        && !/^https?:\/\//i.test(profileImageUrl)
      ) {
        return res.status(400).json({
          message: "Profile image URL must be a valid http/https URL",
        });
      }
      patch.profileImageUrl = profileImageUrl;
    }

    if (!Object.keys(patch).length) {
      return res.status(400).json({
        message: "No valid profile fields provided",
      });
    }

    const updated = await User.findOneAndUpdate(
      { _id: req.user._id, companyId: req.user.companyId },
      { $set: patch },
      {
        new: true,
      },
    )
      .populate("parentId", "name email phone role")
      .lean();

    if (!updated) {
      return res.status(404).json({ message: "User not found" });
    }

    const summary = await buildProfileSummary({
      ...updated,
      _id: req.user._id,
      companyId: req.user.companyId,
      role: req.user.role,
    });

    return res.json({
      message: "Profile updated",
      profile: toProfileView(updated),
      summary,
    });
  } catch (error) {
    logger.error({
      requestId: req.requestId || null,
      error: error.message,
      message: "updateMyProfile failed",
    });
    return res.status(500).json({ message: "Server error" });
  }
};

// Hierarchy based user creation
exports.createUserByRole = async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      password,
      role,
      managerId,
      parentId,
      reportingToId,
    } = req.body;

    if (!canUseAdminTools(req.user.role)) {
      return res.status(403).json({
        message: "Only ADMIN or MANAGER can create users",
      });
    }

    if (!req.user.companyId) {
      return res.status(403).json({ message: "Company context is required" });
    }

    const existingUser = await User.findOne({ email }).select("_id").lean();
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    if (!Object.values(USER_ROLES).includes(role)) {
      return res.status(400).json({
        message: "Invalid role",
      });
    }

    if (role === USER_ROLES.SUPER_ADMIN || role === USER_ROLES.ADMIN) {
      return res.status(400).json({
        message: "This role cannot be created from this endpoint",
      });
    }

    const requestedReportingToId = reportingToId || managerId || parentId || null;
    const allowedParentRoles = getAllowedParentRoles(role);
    let resolvedParentId = req.user._id;

    if (allowedParentRoles.length) {
      let reportingParent = null;

      if (requestedReportingToId) {
        reportingParent = await User.findOne({
          _id: requestedReportingToId,
          role: { $in: allowedParentRoles },
          isActive: true,
          companyId: req.user.companyId,
        })
          .select("_id role")
          .lean();

        if (!reportingParent) {
          const expected = allowedParentRoles
            .map((parentRole) => ROLE_LABELS[parentRole] || parentRole)
            .join(" / ");
          return res.status(400).json({
            message: `Invalid reportingToId. Expected active ${expected}`,
          });
        }
      } else {
        reportingParent = await findLeastLoadedParentForRole({
          companyId: req.user.companyId,
          role,
          currentAdminId: req.user._id,
        });
      }

      if (!reportingParent?._id) {
        const expected = allowedParentRoles
          .map((parentRole) => ROLE_LABELS[parentRole] || parentRole)
          .join(" / ");
        return res.status(400).json({
          message: `No active ${expected} available for assignment`,
        });
      }

      resolvedParentId = reportingParent._id;
    }

    const shouldParseBrokerageConfig =
      role === USER_ROLES.CHANNEL_PARTNER
      || Object.prototype.hasOwnProperty.call(req.body || {}, "brokerageConfig");
    const parsedBrokerageConfig = shouldParseBrokerageConfig
      ? normalizeBrokerageConfigInput(req.body?.brokerageConfig, null)
      : { value: toBrokerageConfigView(null) };
    if (parsedBrokerageConfig.error) {
      return res.status(400).json({ message: parsedBrokerageConfig.error });
    }

    const newUser = await User.create({
      name,
      email,
      phone,
      password,
      role,
      companyId: req.user.companyId,
      parentId: resolvedParentId,
      canViewInventory:
        role === USER_ROLES.CHANNEL_PARTNER
          ? Boolean(req.body?.canViewInventory)
          : false,
      brokerageConfig: parsedBrokerageConfig.value,
    });

    res.status(201).json({
      message: `${role} created successfully`,
      user: {
        _id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        companyId: newUser.companyId,
        parentId: newUser.parentId,
        canViewInventory: Boolean(newUser.canViewInventory),
        brokerageConfig: toBrokerageConfigView(newUser.brokerageConfig),
      },
    });
  } catch (error) {
    logger.error({
      requestId: req.requestId || null,
      error: error.message,
      message: "createUserByRole failed",
    });
    return res.status(500).json({ message: "Server error" });
  }
};

exports.updateUserByAdmin = async (req, res) => {
  try {
    if (!canUseAdminTools(req.user.role)) {
      return res.status(403).json({
        message: "Only ADMIN or MANAGER can update user details",
      });
    }

    if (!req.user.companyId && req.user.role !== USER_ROLES.SUPER_ADMIN) {
      return res.status(403).json({ message: "Company context is required" });
    }

    const { userId } = req.params;
    if (!isValidObjectId(userId)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    if (String(req.user._id) === String(userId)) {
      return res.status(400).json({
        message: "You cannot edit your own account from this page",
      });
    }

    const hasAnyEditableField = [
      "name",
      "email",
      "phone",
      "role",
      "reportingToId",
      "parentId",
      "managerId",
      "isActive",
      "canViewInventory",
      "brokerageConfig",
      "password",
    ].some((key) => Object.prototype.hasOwnProperty.call(req.body || {}, key));

    if (!hasAnyEditableField) {
      return res.status(400).json({
        message: "No editable fields provided",
      });
    }

    const user = await User.findOne({
      _id: userId,
      ...(req.user.role === USER_ROLES.SUPER_ADMIN ? {} : { companyId: req.user.companyId }),
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const previousRole = user.role;
    const patch = {};

    if (Object.prototype.hasOwnProperty.call(req.body || {}, "name")) {
      const name = sanitizeName(req.body.name);
      if (!name || name.length < 2 || name.length > 80) {
        return res.status(400).json({
          message: "Name must be between 2 and 80 characters",
        });
      }
      patch.name = name;
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, "email")) {
      const email = sanitizeEmail(req.body.email);
      if (!isValidEmail(email)) {
        return res.status(400).json({
          message: "Valid email is required",
        });
      }

      const existingUser = await User.findOne({
        email,
        _id: { $ne: user._id },
      })
        .select("_id")
        .lean();
      if (existingUser) {
        return res.status(400).json({ message: "Email already in use" });
      }

      patch.email = email;
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, "phone")) {
      const phone = sanitizePhone(req.body.phone);
      if (phone.length > 25) {
        return res.status(400).json({
          message: "Phone cannot exceed 25 characters",
        });
      }
      patch.phone = phone;
    }

    let nextRole = user.role;
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "role")) {
      const requestedRole = String(req.body.role || "").trim().toUpperCase();
      if (!requestedRole || !Object.values(USER_ROLES).includes(requestedRole)) {
        return res.status(400).json({ message: "Invalid role" });
      }

      if (requestedRole === USER_ROLES.SUPER_ADMIN || (requestedRole === USER_ROLES.ADMIN && req.user.role !== USER_ROLES.SUPER_ADMIN)) {
        return res.status(400).json({
          message: "Role cannot be changed to this admin level",
        });
      }

      nextRole = requestedRole;
      patch.role = nextRole;
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, "isActive")) {
      patch.isActive = Boolean(req.body?.isActive);
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, "password")) {
      const rawPassword = String(req.body?.password || "");
      if (rawPassword && rawPassword.length < 6) {
        return res.status(400).json({
          message: "Password must be at least 6 characters",
        });
      }
      if (rawPassword) {
        user.password = rawPassword;
      }
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, "brokerageConfig")) {
      const parsedBrokerageConfig = normalizeBrokerageConfigInput(
        req.body?.brokerageConfig,
        user.brokerageConfig,
      );
      if (parsedBrokerageConfig.error) {
        return res.status(400).json({ message: parsedBrokerageConfig.error });
      }
      patch.brokerageConfig = parsedBrokerageConfig.value;
    }

    if (EXECUTIVE_ROLES.includes(previousRole) && !EXECUTIVE_ROLES.includes(nextRole)) {
      const openAssignedLeads = await Lead.countDocuments({
        companyId: req.user.companyId,
        assignedTo: user._id,
        status: { $nin: ["CLOSED", "LOST"] },
      });
      if (openAssignedLeads > 0) {
        return res.status(400).json({
          message:
            "User has active assigned leads. Reassign leads before changing designation.",
        });
      }
    }

    if (nextRole !== previousRole) {
      const activeDirectReports = await User.find({
        parentId: user._id,
        companyId: req.user.companyId,
        isActive: true,
      })
        .select("_id role")
        .lean();

      const allowedChildRoles = new Set(TEAM_HIERARCHY_CHILD_ROLES[nextRole] || []);
      const incompatibleReports = activeDirectReports.filter(
        (row) => !allowedChildRoles.has(row.role),
      );

      if (incompatibleReports.length) {
        return res.status(400).json({
          message:
            "User has direct reports incompatible with requested designation. Reassign direct reports first.",
        });
      }
    }

    const requestedReportingToId =
      req.body?.reportingToId
      ?? req.body?.parentId
      ?? req.body?.managerId
      ?? undefined;

    const allowedParentRoles = getAllowedParentRoles(nextRole);
    let resolvedParentId = user.parentId || null;

    if (allowedParentRoles.length) {
      let reportingParent = null;
      const hasReportingInput = requestedReportingToId !== undefined;
      const reportingId =
        hasReportingInput && requestedReportingToId !== null
          ? String(requestedReportingToId || "").trim()
          : "";

      if (reportingId) {
        if (!isValidObjectId(reportingId)) {
          return res.status(400).json({ message: "Invalid reportingToId" });
        }
        if (String(user._id) === reportingId) {
          return res.status(400).json({
            message: "User cannot report to itself",
          });
        }

        reportingParent = await User.findOne({
          _id: reportingId,
          role: { $in: allowedParentRoles },
          isActive: true,
          companyId: req.user.companyId,
        })
          .select("_id role")
          .lean();

        if (!reportingParent) {
          const expected = toRoleExpectationLabel(allowedParentRoles);
          return res.status(400).json({
            message: `Invalid reportingToId. Expected active ${expected}`,
          });
        }
      } else if (
        resolvedParentId
        && !hasReportingInput
      ) {
        reportingParent = await User.findOne({
          _id: resolvedParentId,
          role: { $in: allowedParentRoles },
          isActive: true,
          companyId: req.user.companyId,
        })
          .select("_id role")
          .lean();
      }

      if (!reportingParent) {
        reportingParent = await findLeastLoadedParentForRole({
          companyId: req.user.companyId,
          role: nextRole,
          currentAdminId: req.user._id,
        });
      }

      if (!reportingParent?._id) {
        const expected = toRoleExpectationLabel(allowedParentRoles);
        return res.status(400).json({
          message: `No active ${expected} available for assignment`,
        });
      }

      const descendants = await getDescendantUsers({
        rootUserId: user._id,
        companyId: req.user.companyId,
        includeInactive: true,
        select: "_id role parentId isActive",
      });
      const descendantIdSet = new Set(
        descendants.map((row) => String(row._id)),
      );
      if (descendantIdSet.has(String(reportingParent._id))) {
        return res.status(400).json({
          message: "Reporting manager cannot be selected from this user's team tree",
        });
      }

      resolvedParentId = reportingParent._id;
      patch.parentId = resolvedParentId;
    }

    if (nextRole === USER_ROLES.CHANNEL_PARTNER) {
      if (Object.prototype.hasOwnProperty.call(req.body || {}, "canViewInventory")) {
        patch.canViewInventory = Boolean(req.body?.canViewInventory);
      }
    } else {
      patch.canViewInventory = false;
    }

    Object.entries(patch).forEach(([key, value]) => {
      user[key] = value;
    });

    await user.save();

    if (nextRole !== previousRole) {
      if (nextRole === USER_ROLES.EXECUTIVE) {
        await Lead.updateMany(
          { assignedTo: user._id, companyId: req.user.companyId },
          { $set: { assignedExecutive: user._id, assignedFieldExecutive: null } },
        );
      } else if (nextRole === USER_ROLES.FIELD_EXECUTIVE) {
        await Lead.updateMany(
          { assignedTo: user._id, companyId: req.user.companyId },
          { $set: { assignedExecutive: null, assignedFieldExecutive: user._id } },
        );
      } else {
        await Lead.updateMany(
          { assignedTo: user._id, companyId: req.user.companyId },
          { $set: { assignedExecutive: null, assignedFieldExecutive: null } },
        );
      }
    }

    const updated = await User.findOne({
      _id: user._id,
      companyId: req.user.companyId,
    })
      .populate("parentId", "name email phone role")
      .lean();

    return res.json({
      message: "User updated successfully",
      user: toProfileView(updated),
    });
  } catch (error) {
    logger.error({
      requestId: req.requestId || null,
      error: error.message,
      message: "updateUserByAdmin failed",
    });
    return res.status(500).json({ message: "Server error" });
  }
};

exports.updateUserDesignation = async (req, res) => {
  try {
    if (!canUseAdminTools(req.user.role)) {
      return res.status(403).json({
        message: "Only ADMIN or MANAGER can change user designation",
      });
    }

    if (!req.user.companyId) {
      return res.status(403).json({ message: "Company context is required" });
    }

    const { userId } = req.params;
    if (!isValidObjectId(userId)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    if (String(req.user._id) === String(userId)) {
      return res.status(400).json({
        message: "You cannot change your own designation",
      });
    }

    const requestedRole = String(req.body?.role || "").trim().toUpperCase();
    if (!requestedRole) {
      return res.status(400).json({ message: "role is required" });
    }

    if (!Object.values(USER_ROLES).includes(requestedRole)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    if (requestedRole === USER_ROLES.SUPER_ADMIN || requestedRole === USER_ROLES.ADMIN) {
      return res.status(400).json({
        message: "Designation cannot be changed to this admin level",
      });
    }

    const targetUser = await User.findOne({
      _id: userId,
      companyId: req.user.companyId,
    })
      .select("_id role parentId companyId canViewInventory")
      .lean();
    if (!targetUser) {
      return res.status(404).json({ message: "User not found" });
    }

    const requestedReportingToId =
      req.body?.reportingToId || req.body?.managerId || req.body?.parentId || null;
    const allowedParentRoles = getAllowedParentRoles(requestedRole);

    const activeDirectReports = await User.find({
      parentId: targetUser._id,
      companyId: req.user.companyId,
      isActive: true,
    })
      .select("_id role")
      .lean();
    const allowedChildRoles = new Set(TEAM_HIERARCHY_CHILD_ROLES[requestedRole] || []);
    const invalidReports = activeDirectReports.filter(
      (row) => !allowedChildRoles.has(row.role),
    );
    if (invalidReports.length) {
      return res.status(400).json({
        message:
          "User has direct reports incompatible with requested designation. Reassign direct reports first.",
      });
    }

    if (
      EXECUTIVE_ROLES.includes(targetUser.role)
      && !EXECUTIVE_ROLES.includes(requestedRole)
    ) {
      const openAssignedLeads = await Lead.countDocuments({
        companyId: req.user.companyId,
        assignedTo: targetUser._id,
        status: { $nin: ["CLOSED", "LOST"] },
      });
      if (openAssignedLeads > 0) {
        return res.status(400).json({
          message:
            "User has active assigned leads. Reassign leads before changing designation.",
        });
      }
    }

    let resolvedParentId = targetUser.parentId || null;
    if (allowedParentRoles.length) {
      let reportingParent = null;

      if (requestedReportingToId) {
        if (!isValidObjectId(requestedReportingToId)) {
          return res.status(400).json({ message: "Invalid reportingToId" });
        }

        if (String(requestedReportingToId) === String(targetUser._id)) {
          return res.status(400).json({
            message: "User cannot report to itself",
          });
        }

        reportingParent = await User.findOne({
          _id: requestedReportingToId,
          role: { $in: allowedParentRoles },
          isActive: true,
          companyId: req.user.companyId,
        })
          .select("_id role")
          .lean();

        if (!reportingParent) {
          const expected = toRoleExpectationLabel(allowedParentRoles);
          return res.status(400).json({
            message: `Invalid reportingToId. Expected active ${expected}`,
          });
        }

        const descendants = await getDescendantUsers({
          rootUserId: targetUser._id,
          companyId: req.user.companyId,
          includeInactive: true,
          select: "_id role parentId isActive",
        });
        const descendantIdSet = new Set(
          descendants.map((row) => String(row._id)),
        );
        if (descendantIdSet.has(String(reportingParent._id))) {
          return res.status(400).json({
            message: "Reporting manager cannot be selected from this user's team tree",
          });
        }
      } else if (resolvedParentId) {
        reportingParent = await User.findOne({
          _id: resolvedParentId,
          role: { $in: allowedParentRoles },
          isActive: true,
          companyId: req.user.companyId,
        })
          .select("_id role")
          .lean();
      }

      if (!reportingParent) {
        reportingParent = await findLeastLoadedParentForRole({
          companyId: req.user.companyId,
          role: requestedRole,
          currentAdminId: req.user._id,
        });
      }

      if (!reportingParent?._id) {
        const expected = toRoleExpectationLabel(allowedParentRoles);
        return res.status(400).json({
          message: `No active ${expected} available for assignment`,
        });
      }

      resolvedParentId = reportingParent._id;
    }

    const updatedUser = await User.findOneAndUpdate(
      { _id: userId, companyId: req.user.companyId },
      {
        $set: {
          role: requestedRole,
          parentId: resolvedParentId || null,
          canViewInventory:
            requestedRole === USER_ROLES.CHANNEL_PARTNER
              ? Boolean(targetUser.canViewInventory)
              : false,
        },
      },
      { new: true },
    )
      .populate("parentId", "name role")
      .lean();

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    if (EXECUTIVE_ROLES.includes(requestedRole)) {
      const assignmentPatch =
        requestedRole === USER_ROLES.EXECUTIVE
          ? {
            assignedExecutive: updatedUser._id,
            assignedFieldExecutive: null,
          }
          : {
            assignedExecutive: null,
            assignedFieldExecutive: updatedUser._id,
          };

      await Lead.updateMany(
        { assignedTo: updatedUser._id, companyId: req.user.companyId },
        { $set: assignmentPatch },
      );
    }

    return res.json({
      message: "User designation updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    logger.error({
      requestId: req.requestId || null,
      error: error.message,
      message: "updateUserDesignation failed",
    });
    return res.status(500).json({ message: "Server error" });
  }
};

exports.updateChannelPartnerInventoryAccess = async (req, res) => {
  try {
    if (!canUseAdminTools(req.user.role)) {
      return res.status(403).json({
        message: "Only ADMIN or MANAGER can change channel partner inventory access",
      });
    }

    const { userId } = req.params;
    if (!isValidObjectId(userId)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    const hasFlag = Object.prototype.hasOwnProperty.call(
      req.body || {},
      "canViewInventory",
    );
    if (!hasFlag) {
      return res.status(400).json({
        message: "canViewInventory is required",
      });
    }

    const canViewInventory = Boolean(req.body?.canViewInventory);

    const updatedUser = await User.findOneAndUpdate(
      {
        _id: userId,
        companyId: req.user.companyId,
        role: USER_ROLES.CHANNEL_PARTNER,
      },
      {
        $set: { canViewInventory },
      },
      {
        new: true,
      },
    )
      .populate("parentId", "name role")
      .lean();

    if (!updatedUser) {
      return res.status(404).json({
        message: "Channel partner not found",
      });
    }

    return res.json({
      message: canViewInventory
        ? "Channel partner inventory access enabled"
        : "Channel partner inventory access disabled",
      user: updatedUser,
    });
  } catch (error) {
    logger.error({
      requestId: req.requestId || null,
      error: error.message,
      message: "updateChannelPartnerInventoryAccess failed",
    });
    return res.status(500).json({ message: "Server error" });
  }
};

exports.rebalanceExecutives = async (req, res) => {
  try {
    if (!canUseAdminTools(req.user.role)) {
      return res.status(403).json({ message: "Only ADMIN or MANAGER can rebalance team" });
    }

    if (!req.user.companyId) {
      return res.status(403).json({ message: "Company context is required" });
    }

    const managers = await User.find({
      role: USER_ROLES.MANAGER,
      isActive: true,
      companyId: req.user.companyId,
    })
      .select("_id name createdAt")
      .sort({ createdAt: 1 })
      .lean();

    if (!managers.length) {
      return res.status(400).json({ message: "No active manager found" });
    }

    const executives = await User.find({
      role: { $in: EXECUTIVE_ROLES },
      isActive: true,
      companyId: req.user.companyId,
    })
      .select("_id name role parentId createdAt")
      .sort({ createdAt: 1 })
      .lean();

    if (!executives.length) {
      return res.json({ message: "No active executive found", updated: 0 });
    }

    const leadOwners = executives.filter((executive) =>
      LEAD_OWNER_ROLES.includes(executive.role),
    );

    const bulkOps = [];
    for (let i = 0; i < executives.length; i += 1) {
      const manager = managers[i % managers.length];
      if (String(executives[i].parentId || "") !== String(manager._id)) {
        bulkOps.push({
          updateOne: {
            filter: { _id: executives[i]._id },
            update: { $set: { parentId: manager._id } },
          },
        });
      }
    }

    if (bulkOps.length) {
      await User.bulkWrite(bulkOps);
    }

    // Rebalance active pipeline leads (including currently unassigned leads)
    // with the same load-aware strategy used during auto-assignment.
    const leadRebalance = await redistributePipelineLeads({
      executiveIds: leadOwners.map((executive) => executive._id),
      companyId: req.user.companyId,
      includeUnassigned: true,
    });

    const distribution = await User.aggregate([
      {
        $match: {
          parentId: { $in: managers.map((manager) => manager._id) },
          role: { $in: EXECUTIVE_ROLES },
          isActive: true,
        },
      },
      {
        $group: {
          _id: "$parentId",
          count: { $sum: 1 },
        },
      },
    ]);

    const rowByManagerId = new Map(
      distribution.map((item) => [String(item._id), Number(item.count || 0)]),
    );

    const distributionByManager = managers.map((manager) => {
      const count = rowByManagerId.get(String(manager._id)) || 0;
      return {
        managerId: manager._id,
        managerName: manager.name,
        executives: count,
      };
    });

    const executiveLeadDistribution = await Lead.aggregate([
      {
        $match: {
          companyId: req.user.companyId,
          assignedTo: { $in: leadOwners.map((e) => e._id) },
        },
      },
      {
        $group: {
          _id: "$assignedTo",
          totalLeads: { $sum: 1 },
          convertedLeads: {
            $sum: {
              $cond: [{ $eq: ["$status", "CLOSED"] }, 1, 0],
            },
          },
        },
      },
    ]);

    const leadRowByExecutiveId = new Map(
      executiveLeadDistribution.map((item) => [
        String(item._id),
        {
          totalLeads: Number(item.totalLeads || 0),
          convertedLeads: Number(item.convertedLeads || 0),
        },
      ]),
    );

    const leadDistributionByExecutive = leadOwners.map((executive) => {
      const row = leadRowByExecutiveId.get(String(executive._id)) || null;

      return {
        executiveId: executive._id,
        executiveName: executive.name,
        totalLeads: row ? row.totalLeads : 0,
        convertedLeads: row ? row.convertedLeads : 0,
      };
    });

    res.json({
      message: "Executives and leads rebalanced successfully across managers",
      updated: bulkOps.length,
      leadsUpdated: leadRebalance.updated,
      distribution: distributionByManager,
      leadDistribution: leadDistributionByExecutive,
    });
  } catch (error) {
    logger.error({
      requestId: req.requestId || null,
      error: error.message,
      message: "rebalanceExecutives failed",
    });
    return res.status(500).json({ message: "Server error" });
  }
};

exports.createUserDeleteRequest = async (req, res) => {
  try {
    if (!isManagementRole(req.user.role)) {
      return res.status(403).json({ message: "Only MANAGER can request user deletion" });
    }

    const { userId } = req.params;
    if (!isValidObjectId(userId)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    if (String(req.user._id) === String(userId)) {
      return res.status(400).json({ message: "You cannot request deletion of your own account" });
    }

    const targetUser = await User.findOne({
      _id: userId,
      companyId: req.user.companyId,
    })
      .populate("parentId", "name role")
      .select("_id name email phone role parentId isActive")
      .lean();

    if (!targetUser) {
      return res.status(404).json({ message: "User not found" });
    }

    if (isPlatformAdminRole(targetUser.role)) {
      return res.status(403).json({ message: "Admin account cannot be deleted by request" });
    }

    const descendants = await getDescendantUsers({
      rootUserId: req.user._id,
      companyId: req.user.companyId,
      includeInactive: true,
      select: "_id role parentId isActive",
    });
    const allowedIds = new Set(descendants.map((row) => String(row._id)));
    if (!allowedIds.has(String(targetUser._id))) {
      return res.status(403).json({ message: "You can request deletion only for users under your hierarchy" });
    }

    const existingRequest = await UserDeleteRequest.findOne({
      companyId: req.user.companyId,
      targetUser: userId,
      status: "PENDING",
    })
      .populate("requestedBy", "name email phone role")
      .populate("targetUser", "name email phone role parentId isActive")
      .lean();

    if (existingRequest) {
      return res.status(409).json({
        message: "A delete request is already pending for this user",
        request: toUserDeleteRequestView(existingRequest),
      });
    }

    const request = await UserDeleteRequest.create({
      companyId: req.user.companyId,
      requestedBy: req.user._id,
      targetUser: targetUser._id,
      reason: String(req.body?.reason || "").trim().slice(0, 500),
      snapshot: {
        name: targetUser.name || "",
        email: targetUser.email || "",
        phone: targetUser.phone || "",
        role: targetUser.role || "",
        parentName: targetUser.parentId?.name || "",
        parentRole: targetUser.parentId?.role || "",
        isActive: Boolean(targetUser.isActive),
      },
    });

    const populated = await UserDeleteRequest.findById(request._id)
      .populate("requestedBy", "name email phone role")
      .populate("targetUser", "name email phone role parentId isActive")
      .populate("reviewedBy", "name email role")
      .lean();

    emitUserDeleteRequestCreated({ req, request: populated || request });

    return res.status(201).json({
      message: "User delete request sent to admin",
      request: toUserDeleteRequestView(populated || request),
    });
  } catch (error) {
    logger.error({
      requestId: req.requestId || null,
      error: error.message,
      message: "createUserDeleteRequest failed",
    });
    return res.status(500).json({ message: "Server error" });
  }
};

exports.getAdminUserDeleteRequests = async (req, res) => {
  try {
    if (!isPlatformAdminRole(req.user.role)) {
      return res.status(403).json({ message: "Only ADMIN can view user delete requests" });
    }

    const status = String(req.query?.status || "PENDING").trim().toUpperCase();
    const query = req.user.role === USER_ROLES.SUPER_ADMIN ? {} : { companyId: req.user.companyId };
    if (["PENDING", "APPROVED", "REJECTED"].includes(status)) {
      query.status = status;
    }

    const requests = await UserDeleteRequest.find(query)
      .populate("requestedBy", "name email phone role")
      .populate("targetUser", "name email phone role parentId isActive")
      .populate("reviewedBy", "name email role")
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    return res.json({
      count: requests.length,
      requests: requests.map(toUserDeleteRequestView),
    });
  } catch (error) {
    logger.error({
      requestId: req.requestId || null,
      error: error.message,
      message: "getAdminUserDeleteRequests failed",
    });
    return res.status(500).json({ message: "Server error" });
  }
};

exports.reviewUserDeleteRequest = async (req, res) => {
  try {
    if (!isPlatformAdminRole(req.user.role)) {
      return res.status(403).json({ message: "Only ADMIN can review user delete requests" });
    }

    const { requestId } = req.params;
    if (!isValidObjectId(requestId)) {
      return res.status(400).json({ message: "Invalid request id" });
    }

    const action = String(req.body?.action || req.body?.status || "").trim().toUpperCase();
    if (!["APPROVED", "REJECTED"].includes(action)) {
      return res.status(400).json({ message: "action must be APPROVED or REJECTED" });
    }

    const request = await UserDeleteRequest.findOne({
      _id: requestId,
      ...(req.user.role === USER_ROLES.SUPER_ADMIN ? {} : { companyId: req.user.companyId }),
    });

    if (!request) {
      return res.status(404).json({ message: "User delete request not found" });
    }

    if (request.status !== "PENDING") {
      return res.status(400).json({ message: "Request has already been reviewed" });
    }

    if (action === "APPROVED") {
      const result = await deleteUserForAdmin({
        adminUser: req.user,
        targetUserId: request.targetUser,
      });
      if (result.statusCode !== 200) {
        return res.status(result.statusCode).json(result.payload);
      }
    }

    request.status = action;
    request.reviewedBy = req.user._id;
    request.reviewedAt = new Date();
    request.reviewNote = String(req.body?.reviewNote || "").trim().slice(0, 500);
    await request.save();

    const populated = await UserDeleteRequest.findById(request._id)
      .populate("requestedBy", "name email phone role")
      .populate("targetUser", "name email phone role parentId isActive")
      .populate("reviewedBy", "name email role")
      .lean();

    return res.json({
      message:
        action === "APPROVED"
          ? "User delete request approved and user deleted"
          : "User delete request rejected",
      request: toUserDeleteRequestView(populated || request),
    });
  } catch (error) {
    logger.error({
      requestId: req.requestId || null,
      error: error.message,
      message: "reviewUserDeleteRequest failed",
    });
    return res.status(500).json({ message: "Server error" });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    if (!isPlatformAdminRole(req.user.role)) {
      return res.status(403).json({ message: "Only ADMIN can delete users" });
    }

    const result = await deleteUserForAdmin({
      adminUser: req.user,
      targetUserId: req.params.userId,
    });

    return res.status(result.statusCode).json(result.payload);
  } catch (error) {
    logger.error({
      requestId: req.requestId || null,
      error: error.message,
      message: "deleteUser failed",
    });
    return res.status(500).json({ message: "Server error" });
  }
};

exports.updateUserByRole = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!isValidObjectId(userId)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    const actorRole = req.user.role;
    const canEditAsAdmin = isPlatformAdminRole(actorRole);
    const canEditAsManager = isManagementRole(actorRole);
    if (!canEditAsAdmin && !canEditAsManager) {
      return res.status(403).json({ message: "Access denied" });
    }

    const targetUser = await User.findOne({
      _id: userId,
      ...(req.user.role === USER_ROLES.SUPER_ADMIN ? {} : { companyId: req.user.companyId }),
    })
      .select("_id role parentId companyId isActive")
      .lean();
    if (!targetUser) {
      return res.status(404).json({ message: "User not found" });
    }

    if (isPlatformAdminRole(targetUser.role)) {
      return res.status(403).json({ message: "Admin account cannot be edited from this endpoint" });
    }

    if (!canEditAsAdmin) {
      const descendants = await getDescendantUsers({
        rootUserId: req.user._id,
        companyId: req.user.companyId,
        includeInactive: true,
        select: "_id role parentId isActive",
      });
      const allowedIds = new Set(descendants.map((row) => String(row._id)));
      if (!allowedIds.has(String(targetUser._id))) {
        return res.status(403).json({ message: "You can edit only users under your hierarchy" });
      }
    }

    const patch = {};
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "name")) {
      const name = sanitizeName(req.body.name);
      if (!name || name.length < 2 || name.length > 80) {
        return res.status(400).json({ message: "Name must be between 2 and 80 characters" });
      }
      patch.name = name;
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, "phone")) {
      const phone = sanitizePhone(req.body.phone);
      if (phone.length > 25) {
        return res.status(400).json({ message: "Phone cannot exceed 25 characters" });
      }
      patch.phone = phone;
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, "profileImageUrl")) {
      const profileImageUrl = sanitizeProfileImageUrl(req.body.profileImageUrl);
      if (profileImageUrl.length > 1200) {
        return res.status(400).json({
          message: "Profile image URL is too long",
        });
      }
      if (
        profileImageUrl
        && !/^https?:\/\//i.test(profileImageUrl)
      ) {
        return res.status(400).json({
          message: "Profile image URL must be a valid http/https URL",
        });
      }
      patch.profileImageUrl = profileImageUrl;
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, "isActive")) {
      patch.isActive = Boolean(req.body.isActive);
    }

    if (canEditAsAdmin) {
      const nextRole = Object.prototype.hasOwnProperty.call(req.body || {}, "role")
        ? String(req.body.role || "").trim()
        : targetUser.role;

      if (nextRole && !Object.values(USER_ROLES).includes(nextRole)) {
        return res.status(400).json({ message: "Invalid role" });
      }
      if (nextRole === USER_ROLES.SUPER_ADMIN || nextRole === USER_ROLES.ADMIN) {
        return res.status(400).json({ message: "Cannot assign admin role" });
      }

      if (nextRole && nextRole !== targetUser.role) {
        patch.role = nextRole;
      }

      if (
        Object.prototype.hasOwnProperty.call(req.body || {}, "reportingToId")
        || Object.prototype.hasOwnProperty.call(req.body || {}, "managerId")
        || Object.prototype.hasOwnProperty.call(req.body || {}, "parentId")
        || (nextRole && nextRole !== targetUser.role)
      ) {
        const allowedParentRoles = getAllowedParentRoles(nextRole || targetUser.role);
        const requestedReportingToId = String(
          req.body?.reportingToId || req.body?.managerId || req.body?.parentId || "",
        ).trim();

        if (allowedParentRoles.length) {
          const finalParentId = requestedReportingToId || String(targetUser.parentId || "");
          if (!isValidObjectId(finalParentId)) {
            return res.status(400).json({ message: "Valid reporting manager is required" });
          }

          const parent = await User.findOne({
            _id: finalParentId,
            companyId: req.user.companyId,
            role: { $in: allowedParentRoles },
            isActive: true,
          })
            .select("_id role")
            .lean();
          if (!parent) {
            return res.status(400).json({ message: "Invalid reporting manager for selected role" });
          }
          patch.parentId = parent._id;
        } else {
          patch.parentId = req.user._id;
        }
      }
    }

    if (!Object.keys(patch).length) {
      return res.status(400).json({ message: "No valid fields provided for update" });
    }

    const updated = await User.findOneAndUpdate(
      { _id: userId, companyId: req.user.companyId },
      { $set: patch },
      { new: true },
    )
      .populate("parentId", "name role")
      .select("-password")
      .lean();

    if (!updated) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json({
      message: "User updated successfully",
      user: updated,
    });
  } catch (error) {
    logger.error({
      requestId: req.requestId || null,
      error: error.message,
      message: "updateUserByRole failed",
    });
    return res.status(500).json({ message: "Server error" });
  }
};

// Get my direct team
exports.getMyTeam = async (req, res) => {
  try {
    const users = await User.find({
      parentId: req.user._id,
      isActive: true,
      companyId: req.user.companyId,
    })
      .select("-password")
      .lean();

    res.json({
      count: users.length,
      team: users,
    });
  } catch (error) {
    logger.error({
      requestId: req.requestId || null,
      error: error.message,
      message: "getMyTeam failed",
    });
    return res.status(500).json({ message: "Server error" });
  }
};

exports.updateMyLocation = async (req, res) => {
  try {
    if (!LOCATION_ALLOWED_ROLES.includes(req.user.role)) {
      return res.status(403).json({
        message: "Only executives can update live location",
      });
    }

    const lat = normalizeLatitude(req.body?.lat);
    const lng = normalizeLongitude(req.body?.lng);

    if (lat === null || lng === null) {
      return res.status(400).json({
        message: "Valid lat and lng are required",
      });
    }

    const accuracy = normalizeOptionalNumber(req.body?.accuracy);
    const heading = normalizeOptionalNumber(req.body?.heading);
    const speed = normalizeOptionalNumber(req.body?.speed);
    const locationUpdatedAt = new Date();

    const updatedUser = await User.findOneAndUpdate(
      { _id: req.user._id, companyId: req.user.companyId },
      {
        $set: {
          liveLocation: {
            lat,
            lng,
            accuracy,
            heading,
            speed,
            updatedAt: locationUpdatedAt,
          },
        },
      },
      {
        new: true,
        select: "_id name role liveLocation",
        lean: true,
      },
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json({
      message: "Live location updated",
      user: updatedUser,
    });
  } catch (error) {
    logger.error({
      requestId: req.requestId || null,
      error: error.message,
      message: "updateMyLocation failed",
    });
    return res.status(500).json({ message: "Server error" });
  }
};

exports.getFieldExecutiveLocations = async (req, res) => {
  try {
    if (!LOCATION_VIEWER_ROLES.includes(req.user.role)) {
      return res.status(403).json({
        message: "Only admin and leadership roles can view field locations",
      });
    }

    const staleMinutesRaw = Number.parseInt(req.query?.staleMinutes, 10);
    const staleMinutes =
      Number.isInteger(staleMinutesRaw) && staleMinutesRaw > 0
        ? Math.min(staleMinutesRaw, 1440)
        : 30;
    const threshold = new Date(Date.now() - staleMinutes * 60 * 1000);

    const query = {
      companyId: req.user.companyId,
      role: USER_ROLES.FIELD_EXECUTIVE,
      isActive: true,
    };

    if (isManagementRole(req.user.role)) {
      const descendants = await getDescendantUsers({
        rootUserId: req.user._id,
        companyId: req.user.companyId,
        includeInactive: false,
        select: "_id role parentId isActive",
      });
      const fieldExecutiveIds = descendants
        .filter((row) => row.role === USER_ROLES.FIELD_EXECUTIVE)
        .map((row) => row._id);
      query._id = { $in: fieldExecutiveIds };
    } else if (req.user.role === USER_ROLES.FIELD_EXECUTIVE) {
      query._id = req.user._id;
    }

    const pagination = parsePagination(req.query, {
      defaultLimit: Number.parseInt(process.env.FIELD_LOCATION_PAGE_LIMIT, 10) || 100,
      maxLimit: Number.parseInt(process.env.FIELD_LOCATION_PAGE_MAX_LIMIT, 10) || 300,
    });
    const selectedFields = parseFieldSelection(
      req.query?.fields,
      USER_SELECTABLE_FIELDS,
    );

    const usersQuery = User.find(query)
      .select("name email phone role parentId isActive lastAssignedAt liveLocation")
      .sort({ name: 1 });

    if (selectedFields) {
      usersQuery.select(selectedFields);
    }

    if (pagination.enabled) {
      usersQuery.skip(pagination.skip).limit(pagination.limit);
    }

    const resolvedUsersQuery = usersQuery.lean();
    const users = await resolvedUsersQuery;

    const rows = users.map((user) => {
      const location = user.liveLocation || null;
      const updatedAt = location?.updatedAt ? new Date(location.updatedAt) : null;
      const isFresh = Boolean(updatedAt && updatedAt >= threshold);

      return {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        parentId: user.parentId,
        isActive: user.isActive,
        lastAssignedAt: user.lastAssignedAt || null,
        liveLocation: location,
        isLocationFresh: isFresh,
      };
    });

    if (!pagination.enabled) {
      return res.json({
        count: rows.length,
        staleMinutes,
        users: rows,
      });
    }

    const totalCount = await User.countDocuments(query);

    return res.json({
      count: rows.length,
      staleMinutes,
      users: rows,
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
      message: "getFieldExecutiveLocations failed",
    });
    return res.status(500).json({ message: "Server error" });
  }
};
