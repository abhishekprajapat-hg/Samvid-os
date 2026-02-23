const User = require("../models/User");
const Lead = require("../models/Lead");
const Inventory = require("../models/Inventory");
const LeadActivity = require("../models/leadActivity.model");
const LeadDiary = require("../models/leadDiary.model");
const logger = require("../config/logger");
const {
  redistributePipelineLeads,
} = require("../services/leadAssignment.service");
const {
  USER_ROLES,
  EXECUTIVE_ROLES,
  MANAGEMENT_ROLES,
  ROLE_LABELS,
  getAllowedParentRoles,
  getAutoParentRoles,
  isManagementRole,
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
  USER_ROLES.ADMIN,
  ...MANAGEMENT_ROLES,
  USER_ROLES.FIELD_EXECUTIVE,
];
const LEAD_STATUSES = [
  "NEW",
  "CONTACTED",
  "INTERESTED",
  "SITE_VISIT",
  "CLOSED",
  "LOST",
];
const TEAM_HIERARCHY_CHILD_ROLES = {
  [USER_ROLES.MANAGER]: [USER_ROLES.ASSISTANT_MANAGER],
  [USER_ROLES.ASSISTANT_MANAGER]: [USER_ROLES.TEAM_LEADER],
  [USER_ROLES.TEAM_LEADER]: [...EXECUTIVE_ROLES],
  [USER_ROLES.ADMIN]: [USER_ROLES.MANAGER, USER_ROLES.CHANNEL_PARTNER],
};
const USER_SELECTABLE_FIELDS = [
  "_id",
  "name",
  "email",
  "phone",
  "role",
  "companyId",
  "parentId",
  "isActive",
  "lastAssignedAt",
  "liveLocation",
  "createdAt",
  "updatedAt",
];

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
const isValidObjectId = (value) =>
  /^[a-fA-F0-9]{24}$/.test(String(value || "").trim());

const getLeadScopeLabel = (role) => {
  if (role === USER_ROLES.ADMIN) return "Global Leads";
  if (isManagementRole(role)) return "Team Leads";
  if (EXECUTIVE_ROLES.includes(role)) return "Assigned Leads";
  if (role === USER_ROLES.CHANNEL_PARTNER) return "Created Leads";
  return "Owned Leads";
};

const buildLeadScopeQuery = async (userDoc) => {
  if (userDoc.role === USER_ROLES.ADMIN) {
    return {};
  }

  if (isManagementRole(userDoc.role)) {
    const teamExecutiveIds = await getDescendantExecutiveIds({
      rootUserId: userDoc._id,
      companyId: userDoc.companyId,
    });
    return {
      assignedTo: { $in: teamExecutiveIds },
    };
  }

  if (EXECUTIVE_ROLES.includes(userDoc.role)) {
    return { assignedTo: userDoc._id };
  }

  if (userDoc.role === USER_ROLES.CHANNEL_PARTNER) {
    return { createdBy: userDoc._id };
  }

  return { createdBy: userDoc._id };
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

  const [totalLeads, statusRows, dueFollowUpsToday, overdueFollowUps, siteVisits, recentLeads, activitiesPerformed, diaryEntriesCreated, directReports] = await Promise.all([
    Lead.countDocuments(leadQuery),
    Lead.aggregate([
      { $match: leadQuery },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]),
    Lead.countDocuments({
      ...leadQuery,
      nextFollowUp: { $gte: todayStart, $lte: todayEnd },
    }),
    Lead.countDocuments({
      ...leadQuery,
      nextFollowUp: { $lt: todayStart },
      status: { $nin: ["CLOSED", "LOST"] },
    }),
    Lead.countDocuments({
      ...leadQuery,
      status: "SITE_VISIT",
    }),
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

const toProfileView = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone || "",
  role: user.role,
  companyId: user.companyId || null,
  parentId: user.parentId || null,
  partnerCode: user.partnerCode || null,
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

  if (role === USER_ROLES.ADMIN) {
    const [
      users,
      managers,
      assistantManagers,
      teamLeaders,
      executives,
      fieldExecutives,
      leads,
      inventory,
    ] = await Promise.all([
      User.countDocuments({ companyId, isActive: true }),
      User.countDocuments({ companyId, role: USER_ROLES.MANAGER, isActive: true }),
      User.countDocuments({
        companyId,
        role: USER_ROLES.ASSISTANT_MANAGER,
        isActive: true,
      }),
      User.countDocuments({ companyId, role: USER_ROLES.TEAM_LEADER, isActive: true }),
      User.countDocuments({ companyId, role: USER_ROLES.EXECUTIVE, isActive: true }),
      User.countDocuments({
        companyId,
        role: USER_ROLES.FIELD_EXECUTIVE,
        isActive: true,
      }),
      Lead.countDocuments({}),
      Inventory.countDocuments({ companyId }),
    ]);

    return {
      users,
      managers,
      assistantManagers,
      teamLeaders,
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
        USER_ROLES.ASSISTANT_MANAGER,
        USER_ROLES.TEAM_LEADER,
        USER_ROLES.EXECUTIVE,
        USER_ROLES.FIELD_EXECUTIVE,
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
        Lead.countDocuments({ assignedTo: { $in: executiveIds } }),
        Lead.countDocuments({
          assignedTo: { $in: executiveIds },
          nextFollowUp: { $gte: todayStart, $lte: todayEnd },
        }),
      ])
      : [0, 0];

    const assistantManagers = Number(
      descendantCounts[USER_ROLES.ASSISTANT_MANAGER] || 0,
    );
    const teamLeaders = Number(descendantCounts[USER_ROLES.TEAM_LEADER] || 0);
    const executives = Number(descendantCounts[USER_ROLES.EXECUTIVE] || 0);
    const fieldExecutives = Number(
      descendantCounts[USER_ROLES.FIELD_EXECUTIVE] || 0,
    );

    return {
      teamMembers: assistantManagers + teamLeaders + executives + fieldExecutives,
      assistantManagers,
      teamLeaders,
      executives,
      fieldExecutives,
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
      Lead.countDocuments({ assignedTo: userId }),
      Lead.countDocuments({
        assignedTo: userId,
        status: { $in: ["NEW", "CONTACTED", "INTERESTED", "SITE_VISIT"] },
      }),
      Lead.countDocuments({ assignedTo: userId, status: "CLOSED" }),
      Lead.countDocuments({
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
      Lead.countDocuments({ createdBy: userId }),
      Lead.countDocuments({ createdBy: userId, status: "CLOSED" }),
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
    if (!req.user.companyId) {
      return res.status(403).json({ message: "Company context is required" });
    }

    const companyScope = { companyId: req.user.companyId };
    let query = {};

    if (req.user.role === USER_ROLES.ADMIN) {
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
      query = { ...companyScope, _id: req.user._id };
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
    if (req.user.role !== USER_ROLES.ADMIN) {
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

    if (req.user.role !== USER_ROLES.ADMIN) {
      return res.status(403).json({
        message: "Only ADMIN can create users",
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

    if (role === USER_ROLES.ADMIN) {
      return res.status(400).json({
        message: "Admin role cannot be created from this endpoint",
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

    const newUser = await User.create({
      name,
      email,
      phone,
      password,
      role,
      companyId: req.user.companyId,
      parentId: resolvedParentId,
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

exports.rebalanceExecutives = async (req, res) => {
  try {
    if (req.user.role !== USER_ROLES.ADMIN) {
      return res.status(403).json({ message: "Only ADMIN can rebalance team" });
    }

    if (!req.user.companyId) {
      return res.status(403).json({ message: "Company context is required" });
    }

    const teamLeaders = await User.find({
      role: USER_ROLES.TEAM_LEADER,
      isActive: true,
      companyId: req.user.companyId,
    })
      .select("_id name createdAt")
      .sort({ createdAt: 1 })
      .lean();

    if (!teamLeaders.length) {
      return res.status(400).json({ message: "No active team leader found" });
    }

    const executives = await User.find({
      role: { $in: EXECUTIVE_ROLES },
      isActive: true,
      companyId: req.user.companyId,
    })
      .select("_id name parentId createdAt")
      .sort({ createdAt: 1 })
      .lean();

    if (!executives.length) {
      return res.json({ message: "No active executive found", updated: 0 });
    }

    const bulkOps = [];
    for (let i = 0; i < executives.length; i += 1) {
      const teamLeader = teamLeaders[i % teamLeaders.length];
      if (String(executives[i].parentId || "") !== String(teamLeader._id)) {
        bulkOps.push({
          updateOne: {
            filter: { _id: executives[i]._id },
            update: { $set: { parentId: teamLeader._id } },
          },
        });
      }
    }

    if (bulkOps.length) {
      await User.bulkWrite(bulkOps);
    }

    // Rebalance active pipeline leads with the same load-aware strategy
    // used during auto-assignment so new executives start receiving leads.
    const leadRebalance = await redistributePipelineLeads({
      executiveIds: executives.map((executive) => executive._id),
    });

    const distribution = await User.aggregate([
      {
        $match: {
          parentId: { $in: teamLeaders.map((leader) => leader._id) },
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

    const rowByLeaderId = new Map(
      distribution.map((item) => [String(item._id), Number(item.count || 0)]),
    );

    const distributionByLeader = teamLeaders.map((leader) => {
      const count = rowByLeaderId.get(String(leader._id)) || 0;
      return {
        leaderId: leader._id,
        leaderName: leader.name,
        executives: count,
      };
    });

    const executiveLeadDistribution = await Lead.aggregate([
      {
        $match: {
          assignedTo: { $in: executives.map((e) => e._id) },
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

    const leadDistributionByExecutive = executives.map((executive) => {
      const row = leadRowByExecutiveId.get(String(executive._id)) || null;

      return {
        executiveId: executive._id,
        executiveName: executive.name,
        totalLeads: row ? row.totalLeads : 0,
        convertedLeads: row ? row.convertedLeads : 0,
      };
    });

    res.json({
      message: "Executives and leads rebalanced successfully across team leaders",
      updated: bulkOps.length,
      leadsUpdated: leadRebalance.updated,
      distribution: distributionByLeader,
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

exports.deleteUser = async (req, res) => {
  try {
    if (req.user.role !== USER_ROLES.ADMIN) {
      return res.status(403).json({ message: "Only ADMIN can delete users" });
    }

    const { userId } = req.params;

    if (String(req.user._id) === String(userId)) {
      return res.status(400).json({ message: "You cannot delete your own account" });
    }

    const user = await User.findOne({
      _id: userId,
      companyId: req.user.companyId,
    })
      .select("_id role")
      .lean();
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (isManagementRole(user.role)) {
      const hasTeam = await User.exists({
        parentId: user._id,
        companyId: req.user.companyId,
      });

      if (hasTeam) {
        return res.status(400).json({
          message: "User has active direct reports. Reassign team before deleting.",
        });
      }
    }

    await Lead.updateMany(
      { assignedTo: user._id },
      { $set: { assignedTo: null } },
    );

    await User.deleteOne({ _id: userId });

    res.json({ message: "User deleted successfully" });
  } catch (error) {
    logger.error({
      requestId: req.requestId || null,
      error: error.message,
      message: "deleteUser failed",
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
