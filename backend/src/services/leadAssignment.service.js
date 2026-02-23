const Lead = require("../models/Lead");
const User = require("../models/User");
const LeadActivity = require("../models/leadActivity.model");
const {
  USER_ROLES,
  EXECUTIVE_ROLES,
  MANAGEMENT_ROLES,
  isManagementRole,
} = require("../constants/role.constants");
const {
  getAncestorByRoles,
  getDescendantExecutiveIds,
} = require("./hierarchy.service");

const PIPELINE_STATUSES = ["NEW", "CONTACTED", "INTERESTED", "SITE_VISIT"];

const DEFAULT_MAX_ACTIVE_LEADS = 120;
const ACTIVE_LOAD_WEIGHT = 100;
const DAILY_LOAD_WEIGHT = 10;

const configuredMaxActiveLeads = Number.parseInt(
  process.env.AUTO_ASSIGN_MAX_ACTIVE_LEADS || "",
  10,
);

const MAX_ACTIVE_LEADS_PER_EXECUTIVE =
  Number.isInteger(configuredMaxActiveLeads) && configuredMaxActiveLeads > 0
    ? configuredMaxActiveLeads
    : DEFAULT_MAX_ACTIVE_LEADS;

const toId = (value) => String(value || "");
const toTimestamp = (value) => (value ? new Date(value).getTime() : 0);

const buildCountMap = (rows) =>
  new Map(rows.map((row) => [toId(row._id), Number(row.count || 0)]));

const getStartOfDay = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return start;
};

const compareExecutiveCandidates = (left, right) => {
  if (left.metric.score !== right.metric.score) {
    return left.metric.score - right.metric.score;
  }

  if (left.metric.activeLeads !== right.metric.activeLeads) {
    return left.metric.activeLeads - right.metric.activeLeads;
  }

  const leftAssignedAt = toTimestamp(left.executive.lastAssignedAt);
  const rightAssignedAt = toTimestamp(right.executive.lastAssignedAt);
  if (leftAssignedAt !== rightAssignedAt) {
    return leftAssignedAt - rightAssignedAt;
  }

  const leftCreatedAt = toTimestamp(left.executive.createdAt);
  const rightCreatedAt = toTimestamp(right.executive.createdAt);
  if (leftCreatedAt !== rightCreatedAt) {
    return leftCreatedAt - rightCreatedAt;
  }

  return toId(left.executive._id).localeCompare(toId(right.executive._id));
};

const compareLeaders = (left, right) => {
  if (left.candidate.metric.score !== right.candidate.metric.score) {
    return left.candidate.metric.score - right.candidate.metric.score;
  }

  if (left.candidate.metric.activeLeads !== right.candidate.metric.activeLeads) {
    return left.candidate.metric.activeLeads - right.candidate.metric.activeLeads;
  }

  const leftAssignedAt = toTimestamp(left.manager.lastAssignedAt);
  const rightAssignedAt = toTimestamp(right.manager.lastAssignedAt);
  if (leftAssignedAt !== rightAssignedAt) {
    return leftAssignedAt - rightAssignedAt;
  }

  const leftCreatedAt = toTimestamp(left.manager.createdAt);
  const rightCreatedAt = toTimestamp(right.manager.createdAt);
  if (leftCreatedAt !== rightCreatedAt) {
    return leftCreatedAt - rightCreatedAt;
  }

  return toId(left.manager._id).localeCompare(toId(right.manager._id));
};

const buildAssignmentAction = ({ mode, executive, manager }) => {
  if (mode === "SELF") {
    return `Self assigned by ${executive.name}`;
  }

  if (mode === "LEADER_TEAM") {
    return `Auto assigned to ${executive.name} from reporting team`;
  }

  if (mode === "LEADER_HIERARCHY") {
    return `Auto assigned to ${executive.name} under ${manager.name}`;
  }

  return `Auto assigned to ${executive.name} (global fallback)`;
};

const getExecutiveMetrics = async (executives) => {
  if (!executives.length) return new Map();

  const executiveIds = executives.map((executive) => executive._id);
  const startOfDay = getStartOfDay();

  const [activeRows, todayRows] = await Promise.all([
    Lead.aggregate([
      {
        $match: {
          assignedTo: { $in: executiveIds },
          status: { $in: PIPELINE_STATUSES },
        },
      },
      {
        $group: {
          _id: "$assignedTo",
          count: { $sum: 1 },
        },
      },
    ]),
    Lead.aggregate([
      {
        $match: {
          assignedTo: { $in: executiveIds },
          createdAt: { $gte: startOfDay },
        },
      },
      {
        $group: {
          _id: "$assignedTo",
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  const activeMap = buildCountMap(activeRows);
  const todayMap = buildCountMap(todayRows);

  const metrics = new Map();

  executives.forEach((executive) => {
    const executiveId = toId(executive._id);
    const activeLeads = activeMap.get(executiveId) || 0;
    const assignedToday = todayMap.get(executiveId) || 0;

    metrics.set(executiveId, {
      activeLeads,
      assignedToday,
      score: activeLeads * ACTIVE_LOAD_WEIGHT + assignedToday * DAILY_LOAD_WEIGHT,
      atCapacity: activeLeads >= MAX_ACTIVE_LEADS_PER_EXECUTIVE,
    });
  });

  return metrics;
};

const rankExecutiveCandidates = (executives, metricMap) =>
  executives
    .map((executive) => {
      const metric =
        metricMap.get(toId(executive._id)) || {
          activeLeads: 0,
          assignedToday: 0,
          score: 0,
          atCapacity: false,
        };

      return { executive, metric };
    })
    .filter(({ metric }) => !metric.atCapacity)
    .sort(compareExecutiveCandidates);

const selectLeaderCandidate = (leaders, candidates) => {
  if (!leaders.length || !candidates.length) return null;

  const candidatesByLeader = new Map();

  candidates.forEach((candidate) => {
    const leaderId = toId(candidate.executive.parentId);
    if (!leaderId) return;

    const existing = candidatesByLeader.get(leaderId) || [];
    existing.push(candidate);
    candidatesByLeader.set(leaderId, existing);
  });

  const leaderCandidates = leaders
    .map((leader) => ({
      manager: leader,
      candidate: (candidatesByLeader.get(toId(leader._id)) || [])[0] || null,
    }))
    .filter((row) => row.candidate);

  if (!leaderCandidates.length) return null;

  leaderCandidates.sort(compareLeaders);
  return leaderCandidates[0];
};

const persistAssignment = async ({
  lead,
  executive,
  manager,
  mode,
  performedBy,
}) => {
  const now = new Date();
  const topManager = await getAncestorByRoles({
    user: executive,
    targetRoles: [USER_ROLES.MANAGER],
    companyId: executive?.companyId || null,
    select: "_id role parentId companyId isActive",
  });
  const inferredManagerId = topManager?._id || manager?._id || executive?.parentId || null;
  const isFieldExecutive = executive?.role === USER_ROLES.FIELD_EXECUTIVE;
  const isExecutive = executive?.role === USER_ROLES.EXECUTIVE;

  lead.assignedTo = executive._id;
  lead.assignedManager = inferredManagerId;
  lead.assignedExecutive = isExecutive ? executive._id : null;
  lead.assignedFieldExecutive = isFieldExecutive ? executive._id : null;
  await lead.save();

  const updates = [
    User.updateOne(
      { _id: executive._id },
      { $set: { lastAssignedAt: now } },
    ),
  ];

  if (manager) {
    updates.push(
      User.updateOne(
        { _id: manager._id },
        { $set: { lastAssignedAt: now }, $inc: { lastAssignedIndex: 1 } },
      ),
    );
  }

  await Promise.all(updates);

  await LeadActivity.create({
    lead: lead._id,
    action: buildAssignmentAction({ mode, executive, manager }),
    performedBy: performedBy || null,
  });
};

const createNoAssignmentActivity = async (leadId, performedBy, reason) => {
  await LeadActivity.create({
    lead: leadId,
    action: `Auto assignment pending: ${reason}`,
    performedBy: performedBy || null,
  });
};

const autoAssignLead = async ({ lead, requester = null, performedBy = null }) => {
  if (!lead || !lead._id) {
    throw new Error("A saved lead document is required for auto assignment");
  }

  const actorId = performedBy || requester?._id || null;

  if (requester && EXECUTIVE_ROLES.includes(requester.role) && requester.isActive) {
    await persistAssignment({
      lead,
      executive: requester,
      manager: null,
      mode: "SELF",
      performedBy: actorId,
    });

    return {
      assigned: true,
      mode: "SELF",
      executive: requester,
      manager: null,
    };
  }

  const executiveQuery = {
    role: { $in: EXECUTIVE_ROLES },
    isActive: true,
  };
  if (requester?.companyId) {
    executiveQuery.companyId = requester.companyId;
  }

  const activeExecutives = await User.find(executiveQuery)
    .select("_id name role parentId companyId isActive createdAt lastAssignedAt")
    .sort({ createdAt: 1 })
    .lean();

  if (!activeExecutives.length) {
    await createNoAssignmentActivity(lead._id, actorId, "no active executive available");
    return {
      assigned: false,
      reason: "NO_ACTIVE_EXECUTIVE",
      mode: null,
      executive: null,
      manager: null,
    };
  }

  const metricMap = await getExecutiveMetrics(activeExecutives);
  const rankedCandidates = rankExecutiveCandidates(activeExecutives, metricMap);

  if (!rankedCandidates.length) {
    await createNoAssignmentActivity(lead._id, actorId, "all executives are at capacity");
    return {
      assigned: false,
      reason: "EXECUTIVE_CAPACITY_REACHED",
      mode: null,
      executive: null,
      manager: null,
    };
  }

  let selected = null;
  let selectedManager = null;
  let mode = "GLOBAL_FALLBACK";

  if (requester?.isActive && isManagementRole(requester?.role)) {
    const teamExecutiveIds = await getDescendantExecutiveIds({
      rootUserId: requester._id,
      companyId: requester.companyId || null,
    });
    const teamExecutiveIdSet = new Set(teamExecutiveIds.map(toId));
    const teamCandidate =
      rankedCandidates.find(({ executive }) =>
        teamExecutiveIdSet.has(toId(executive._id)),
      ) || null;

    if (teamCandidate) {
      selected = teamCandidate;
      selectedManager = requester;
      mode = "LEADER_TEAM";
    }
  }

  const leaderIds = [
    ...new Set(
      rankedCandidates
        .map(({ executive }) => toId(executive.parentId))
        .filter(Boolean),
    ),
  ];
  const leaders = leaderIds.length
    ? await User.find({
      _id: { $in: leaderIds },
      role: { $in: MANAGEMENT_ROLES },
      isActive: true,
      ...(requester?.companyId ? { companyId: requester.companyId } : {}),
    })
      .select("_id name role createdAt lastAssignedAt")
      .sort({ createdAt: 1 })
      .lean()
    : [];

  const managerMap = new Map(leaders.map((leader) => [toId(leader._id), leader]));

  if (!selected) {
    const hierarchySelection = selectLeaderCandidate(leaders, rankedCandidates);
    if (hierarchySelection) {
      selected = hierarchySelection.candidate;
      selectedManager = hierarchySelection.manager;
      mode = "LEADER_HIERARCHY";
    }
  }

  if (!selected) {
    selected = rankedCandidates[0];
    selectedManager =
      managerMap.get(toId(selected.executive.parentId)) || selectedManager;
    mode = "GLOBAL_FALLBACK";
  }

  await persistAssignment({
    lead,
    executive: selected.executive,
    manager: selectedManager,
    mode,
    performedBy: actorId,
  });

  return {
    assigned: true,
    mode,
    executive: selected.executive,
    manager: selectedManager,
    metrics: selected.metric,
  };
};

const redistributePipelineLeads = async ({ executiveIds = null } = {}) => {
  const query = {
    role: { $in: EXECUTIVE_ROLES },
    isActive: true,
  };

  if (Array.isArray(executiveIds) && executiveIds.length) {
    query._id = { $in: executiveIds };
  }

  const executives = await User.find(query)
    .select("_id createdAt lastAssignedAt")
    .sort({ createdAt: 1 })
    .lean();

  if (!executives.length) {
    return {
      updated: 0,
      totalLeads: 0,
      executiveCount: 0,
    };
  }

  const executiveObjectIds = executives.map((executive) => executive._id);
  const pipelineLeads = await Lead.find({
    status: { $in: PIPELINE_STATUSES },
  })
    .select("_id assignedTo createdAt")
    .sort({ createdAt: 1 })
    .lean();

  if (!pipelineLeads.length) {
    return {
      updated: 0,
      totalLeads: 0,
      executiveCount: executives.length,
    };
  }

  // Start with non-pipeline ownership so redistribution balances active work
  // while keeping historical closed/lost ownership weighted.
  const totalLoadRows = await Lead.aggregate([
    {
      $match: {
        assignedTo: { $in: executiveObjectIds },
        status: { $nin: PIPELINE_STATUSES },
      },
    },
    {
      $group: {
        _id: "$assignedTo",
        count: { $sum: 1 },
      },
    },
  ]);

  const totalLoadMap = buildCountMap(totalLoadRows);

  const compareByCurrentLoad = (left, right) => {
    const leftLoad = totalLoadMap.get(toId(left._id)) || 0;
    const rightLoad = totalLoadMap.get(toId(right._id)) || 0;

    if (leftLoad !== rightLoad) {
      return leftLoad - rightLoad;
    }

    const leftAssignedAt = toTimestamp(left.lastAssignedAt);
    const rightAssignedAt = toTimestamp(right.lastAssignedAt);
    if (leftAssignedAt !== rightAssignedAt) {
      return leftAssignedAt - rightAssignedAt;
    }

    const leftCreatedAt = toTimestamp(left.createdAt);
    const rightCreatedAt = toTimestamp(right.createdAt);
    if (leftCreatedAt !== rightCreatedAt) {
      return leftCreatedAt - rightCreatedAt;
    }

    return toId(left._id).localeCompare(toId(right._id));
  };

  const orderedExecutives = [...executives].sort(compareByCurrentLoad);
  const leadUpdates = [];

  pipelineLeads.forEach((lead) => {
    const selectedExecutive = orderedExecutives[0];
    const selectedExecutiveId = toId(selectedExecutive._id);
    const currentAssignee = toId(lead.assignedTo);

    if (currentAssignee !== selectedExecutiveId) {
      leadUpdates.push({
        updateOne: {
          filter: { _id: lead._id },
          update: { $set: { assignedTo: selectedExecutive._id } },
        },
      });
    }

    totalLoadMap.set(
      selectedExecutiveId,
      (totalLoadMap.get(selectedExecutiveId) || 0) + 1,
    );

    orderedExecutives.sort(compareByCurrentLoad);
  });

  if (leadUpdates.length) {
    await Lead.bulkWrite(leadUpdates);
  }

  return {
    updated: leadUpdates.length,
    totalLeads: pipelineLeads.length,
    executiveCount: executives.length,
  };
};

module.exports = {
  EXECUTIVE_ROLES,
  PIPELINE_STATUSES,
  MAX_ACTIVE_LEADS_PER_EXECUTIVE,
  autoAssignLead,
  redistributePipelineLeads,
};
