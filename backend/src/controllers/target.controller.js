const mongoose = require("mongoose");
const Lead = require("../models/Lead");
const User = require("../models/User");
const TargetAssignment = require("../models/TargetAssignment");
const logger = require("../config/logger");
const {
  USER_ROLES,
  ROLE_LABELS,
  EXECUTIVE_ROLES,
  isManagementRole,
} = require("../constants/role.constants");
const { getDescendantExecutiveIds } = require("../services/hierarchy.service");

const MONTH_KEY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const DEFAULT_REVENUE_PER_CLOSED =
  Number.parseInt(process.env.TARGET_REVENUE_PER_CLOSED, 10) || 50000;

const TARGET_ASSIGNMENT_FLOW = Object.freeze({
  [USER_ROLES.ADMIN]: [USER_ROLES.MANAGER],
  [USER_ROLES.MANAGER]: [USER_ROLES.ASSISTANT_MANAGER],
  [USER_ROLES.ASSISTANT_MANAGER]: [USER_ROLES.TEAM_LEADER],
  [USER_ROLES.TEAM_LEADER]: [USER_ROLES.EXECUTIVE, USER_ROLES.FIELD_EXECUTIVE],
});

const toMonthKey = (value = "") => {
  const clean = String(value || "").trim();
  if (clean) {
    if (!MONTH_KEY_PATTERN.test(clean)) return null;
    return clean;
  }

  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

const toMonthRange = (monthKey) => {
  const [yearRaw, monthRaw] = monthKey.split("-");
  const year = Number.parseInt(yearRaw, 10);
  const month = Number.parseInt(monthRaw, 10);

  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return { start, end };
};

const parseTargetNumber = (value) => {
  if (value === undefined || value === null || value === "") return 0;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed * 100) / 100;
};

const toPercent = (achieved, target) => {
  if (!target || target <= 0) return 0;
  return Math.round((Number(achieved || 0) / target) * 1000) / 10;
};

const getLeadScopeQueryForUser = async ({
  userDoc,
  companyUserIds = [],
}) => {
  if (!userDoc) return null;

  if (userDoc.role === USER_ROLES.ADMIN) {
    if (!companyUserIds.length) {
      return { _id: null };
    }

    return {
      $or: [
        { assignedTo: { $in: companyUserIds } },
        { createdBy: { $in: companyUserIds } },
      ],
    };
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

const computeTargetAchievement = async ({
  userDoc,
  companyUserIds,
  monthKey,
}) => {
  const scope = await getLeadScopeQueryForUser({
    userDoc,
    companyUserIds,
  });
  if (!scope) {
    return {
      leadsAchieved: 0,
      closedDealsAchieved: 0,
      siteVisitsAchieved: 0,
      revenueAchieved: 0,
    };
  }

  const { start, end } = toMonthRange(monthKey);
  const query = {
    ...scope,
    createdAt: { $gte: start, $lte: end },
  };

  const [leadsAchieved, closedDealsAchieved, siteVisitsAchieved] = await Promise.all([
    Lead.countDocuments(query),
    Lead.countDocuments({
      ...query,
      status: "CLOSED",
    }),
    Lead.countDocuments({
      ...query,
      status: "SITE_VISIT",
    }),
  ]);

  return {
    leadsAchieved,
    closedDealsAchieved,
    siteVisitsAchieved,
    revenueAchieved: closedDealsAchieved * DEFAULT_REVENUE_PER_CLOSED,
  };
};

const toUserRef = (userLike) => {
  if (!userLike) return null;

  return {
    _id: userLike._id || null,
    name: userLike.name || "",
    email: userLike.email || "",
    role: userLike.role || "",
    roleLabel: ROLE_LABELS[userLike.role] || userLike.role || "",
  };
};

const toTargetView = (row, achievements = {}) => {
  const leadsTarget = Number(row.leadsTarget || 0);
  const revenueTarget = Number(row.revenueTarget || 0);
  const siteVisitTarget = Number(row.siteVisitTarget || 0);
  const leadsAchieved = Number(achievements.leadsAchieved || 0);
  const revenueAchieved = Number(achievements.revenueAchieved || 0);
  const siteVisitsAchieved = Number(achievements.siteVisitsAchieved || 0);
  const closedDealsAchieved = Number(achievements.closedDealsAchieved || 0);

  return {
    _id: row._id,
    month: row.month,
    leadsTarget,
    revenueTarget,
    siteVisitTarget,
    notes: row.notes || "",
    assignedBy: toUserRef(row.assignedBy),
    assignedTo: toUserRef(row.assignedTo),
    assignedByRole: row.assignedByRole || row.assignedBy?.role || "",
    assignedToRole: row.assignedToRole || row.assignedTo?.role || "",
    achievements: {
      leadsAchieved,
      revenueAchieved,
      siteVisitsAchieved,
      closedDealsAchieved,
    },
    progress: {
      leadsPercent: toPercent(leadsAchieved, leadsTarget),
      revenuePercent: toPercent(revenueAchieved, revenueTarget),
      siteVisitPercent: toPercent(siteVisitsAchieved, siteVisitTarget),
    },
    createdAt: row.createdAt || null,
    updatedAt: row.updatedAt || null,
  };
};

const buildPopulationQuery = (queryBuilder) =>
  queryBuilder
    .populate("assignedBy", "_id name email role")
    .populate("assignedTo", "_id name email role")
    .lean();

exports.getMyTargets = async (req, res) => {
  try {
    if (!req.user.companyId) {
      return res.status(403).json({ message: "Company context is required" });
    }

    const month = toMonthKey(req.query?.month);
    if (!month) {
      return res.status(400).json({ message: "month must be in YYYY-MM format" });
    }

    const me = await User.findOne({
      _id: req.user._id,
      companyId: req.user.companyId,
      isActive: true,
    })
      .select("_id name email role parentId companyId isActive")
      .lean();

    if (!me) {
      return res.status(404).json({ message: "User not found" });
    }

    const allowedChildRoles = TARGET_ASSIGNMENT_FLOW[me.role] || [];
    const canAssign = allowedChildRoles.length > 0;

    const [incomingRows, outgoingRows, directReports, companyUserRows] = await Promise.all([
      buildPopulationQuery(
        TargetAssignment.find({
          companyId: req.user.companyId,
          assignedTo: req.user._id,
          month,
        }).sort({ updatedAt: -1 }),
      ),
      buildPopulationQuery(
        TargetAssignment.find({
          companyId: req.user.companyId,
          assignedBy: req.user._id,
          month,
        }).sort({ updatedAt: -1 }),
      ),
      User.find({
        companyId: req.user.companyId,
        parentId: req.user._id,
        isActive: true,
      })
        .select("_id name email role parentId")
        .sort({ name: 1 })
        .lean(),
      User.find({
        companyId: req.user.companyId,
        isActive: true,
      })
        .select("_id")
        .lean(),
    ]);
    const companyUserIds = companyUserRows.map((row) => row._id);

    const assignableReports = canAssign
      ? directReports.filter((row) => allowedChildRoles.includes(row.role))
      : [];

    const assigneeIds = [
      ...new Set(
        [...incomingRows, ...outgoingRows]
          .map((row) => String(row?.assignedTo?._id || row?.assignedTo || ""))
          .filter(Boolean),
      ),
    ];

    const scopedUsers = assigneeIds.length
      ? await User.find({
        _id: { $in: assigneeIds },
        companyId: req.user.companyId,
      })
        .select("_id name email role parentId companyId isActive")
        .lean()
      : [];
    const userById = new Map(scopedUsers.map((user) => [String(user._id), user]));

    const achievementsByUserId = new Map();
    await Promise.all(
      assigneeIds.map(async (assigneeId) => {
        const assignee = userById.get(String(assigneeId)) || null;
        if (!assignee) {
          achievementsByUserId.set(String(assigneeId), {
            leadsAchieved: 0,
            closedDealsAchieved: 0,
            siteVisitsAchieved: 0,
            revenueAchieved: 0,
          });
          return;
        }

        const metrics = await computeTargetAchievement({
          userDoc: assignee,
          companyUserIds,
          monthKey: month,
        });
        achievementsByUserId.set(String(assigneeId), metrics);
      }),
    );

    const incoming = incomingRows.map((row) =>
      toTargetView(
        row,
        achievementsByUserId.get(String(row?.assignedTo?._id || row?.assignedTo || "")) || {},
      ));
    const outgoing = outgoingRows.map((row) =>
      toTargetView(
        row,
        achievementsByUserId.get(String(row?.assignedTo?._id || row?.assignedTo || "")) || {},
      ));

    return res.json({
      month,
      canAssign,
      allowedChildRoles,
      assignableReports: assignableReports.map((row) => ({
        _id: row._id,
        name: row.name,
        email: row.email || "",
        role: row.role,
        roleLabel: ROLE_LABELS[row.role] || row.role,
      })),
      myTarget: incoming[0] || null,
      incoming,
      outgoing,
    });
  } catch (error) {
    logger.error({
      requestId: req.requestId || null,
      error: error.message,
      message: "getMyTargets failed",
    });
    return res.status(500).json({ message: "Server error" });
  }
};

exports.assignTarget = async (req, res) => {
  try {
    if (!req.user.companyId) {
      return res.status(403).json({ message: "Company context is required" });
    }

    const allowedChildRoles = TARGET_ASSIGNMENT_FLOW[req.user.role] || [];
    if (!allowedChildRoles.length) {
      return res.status(403).json({
        message: "You are not allowed to assign targets",
      });
    }

    const assignedToId = String(req.body?.assignedToId || "").trim();
    if (!assignedToId || !mongoose.Types.ObjectId.isValid(assignedToId)) {
      return res.status(400).json({ message: "Valid assignedToId is required" });
    }

    const month = toMonthKey(req.body?.month);
    if (!month) {
      return res.status(400).json({ message: "month must be in YYYY-MM format" });
    }

    const leadsTarget = parseTargetNumber(req.body?.leadsTarget);
    const revenueTarget = parseTargetNumber(req.body?.revenueTarget);
    const siteVisitTarget = parseTargetNumber(req.body?.siteVisitTarget);

    if (
      leadsTarget === null
      || revenueTarget === null
      || siteVisitTarget === null
    ) {
      return res.status(400).json({
        message: "Targets must be valid non-negative numbers",
      });
    }

    if (leadsTarget <= 0 && revenueTarget <= 0 && siteVisitTarget <= 0) {
      return res.status(400).json({
        message: "At least one target value must be greater than zero",
      });
    }

    const notes = String(req.body?.notes || "").trim().slice(0, 500);

    const assignee = await User.findOne({
      _id: assignedToId,
      companyId: req.user.companyId,
      isActive: true,
    })
      .select("_id name email role parentId companyId isActive")
      .lean();

    if (!assignee) {
      return res.status(404).json({ message: "Assignee not found" });
    }

    if (!allowedChildRoles.includes(assignee.role)) {
      const expectedRolesLabel = allowedChildRoles
        .map((role) => ROLE_LABELS[role] || role)
        .join(" / ");
      return res.status(400).json({
        message: `You can assign targets only to ${expectedRolesLabel}`,
      });
    }

    if (String(assignee.parentId || "") !== String(req.user._id || "")) {
      return res.status(403).json({
        message: "Targets can be assigned only to your direct reporting users",
      });
    }

    const updated = await TargetAssignment.findOneAndUpdate(
      {
        companyId: req.user.companyId,
        assignedTo: assignee._id,
        month,
      },
      {
        $set: {
          assignedBy: req.user._id,
          assignedByRole: req.user.role,
          assignedToRole: assignee.role,
          leadsTarget,
          revenueTarget,
          siteVisitTarget,
          notes,
        },
      },
      {
        upsert: true,
        setDefaultsOnInsert: true,
        new: true,
      },
    );

    const populated = await buildPopulationQuery(
      TargetAssignment.findById(updated._id),
    );
    const companyUserRows = await User.find({
      companyId: req.user.companyId,
      isActive: true,
    })
      .select("_id")
      .lean();
    const achievements = await computeTargetAchievement({
      userDoc: assignee,
      companyUserIds: companyUserRows.map((row) => row._id),
      monthKey: month,
    });

    return res.status(201).json({
      message: "Target assigned successfully",
      month,
      target: toTargetView(populated, achievements),
    });
  } catch (error) {
    logger.error({
      requestId: req.requestId || null,
      error: error.message,
      message: "assignTarget failed",
    });
    return res.status(500).json({ message: "Server error" });
  }
};
