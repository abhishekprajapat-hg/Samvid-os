const Lead = require("../models/Lead");
const Inventory = require("../models/Inventory");
const User = require("../models/User");
const logger = require("../config/logger");
const {
  USER_ROLES,
  EXECUTIVE_ROLES,
  MANAGEMENT_ROLES,
  isManagementRole,
} = require("../constants/role.constants");
const { getDescendantExecutiveIds } = require("../services/hierarchy.service");

const escapeRegex = (value) => String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizeQuery = (value) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim();

const formatMoney = (value) => {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) return "0";
  return amount.toLocaleString("en-IN");
};

const formatInventoryLabel = (row) =>
  [row?.projectName, row?.towerName, row?.unitNumber]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(" - ");

const getCompanyUserIds = async (companyId) => {
  const users = await User.find({ companyId, isActive: true }).select("_id").lean();
  return users.map((row) => row._id);
};

const getInventoryScopeForUser = (user) => {
  if (!user?.companyId) return null;

  if (
    [
      USER_ROLES.ADMIN,
      ...MANAGEMENT_ROLES,
      USER_ROLES.EXECUTIVE,
      USER_ROLES.FIELD_EXECUTIVE,
    ].includes(user.role)
  ) {
    return { companyId: user.companyId };
  }

  return null;
};

const getLeadScopeForUser = async (user) => {
  if (!user?.companyId) return null;

  const companyUserIds = await getCompanyUserIds(user.companyId);
  if (!companyUserIds.length) return null;

  const baseCompanyScope = {
    $or: [
      { createdBy: { $in: companyUserIds } },
      { assignedTo: { $in: companyUserIds } },
    ],
  };

  if (user.role === USER_ROLES.ADMIN) {
    return baseCompanyScope;
  }

  if (isManagementRole(user.role)) {
    const executiveIds = await getDescendantExecutiveIds({
      rootUserId: user._id,
      companyId: user.companyId,
    });

    return {
      $and: [
        baseCompanyScope,
        {
          $or: [
            { createdBy: user._id },
            { assignedTo: { $in: executiveIds } },
            { assignedTo: null, createdBy: { $in: companyUserIds } },
          ],
        },
      ],
    };
  }

  if (EXECUTIVE_ROLES.includes(user.role)) {
    return {
      $and: [
        baseCompanyScope,
        {
          $or: [{ assignedTo: user._id }, { assignedTo: null }],
        },
      ],
    };
  }

  if (user.role === USER_ROLES.CHANNEL_PARTNER) {
    return {
      $and: [baseCompanyScope, { createdBy: user._id }],
    };
  }

  return null;
};

const detectIntent = (query) => {
  const q = query.toLowerCase();

  const hasSold = /\b(sold|sell|bik|sold out)\b/.test(q);
  const hasInterested = /\b(interested|interest|ruchi)\b/.test(q);
  const hasPerformance = /\b(best performance|top performance|top performer|best performer|performance best)\b/.test(q);
  const hasInventory = /\b(inventory|property|unit|project|flat|tower)\b/.test(q);
  const hasLead = /\b(lead|customer|client|prospect)\b/.test(q);

  if (hasSold && hasInterested) return "sales_interest_snapshot";
  if (hasPerformance) return "best_performer";
  if (hasSold && hasInventory) return "sold_inventory";
  if (hasInterested && hasLead) return "interested_leads";
  if (hasInventory) return "inventory_lookup";
  if (hasLead) return "lead_lookup";
  return "overview";
};

const queryInventory = async ({ user, query }) => {
  const scope = getInventoryScopeForUser(user);
  if (!scope) {
    return {
      answer: "Aapke role me inventory access allowed nahi hai.",
      data: { inventory: [] },
    };
  }

  const regex = new RegExp(escapeRegex(query), "i");
  const rows = await Inventory.find({
    ...scope,
    $or: [
      { projectName: { $regex: regex } },
      { towerName: { $regex: regex } },
      { unitNumber: { $regex: regex } },
      { location: { $regex: regex } },
      { status: { $regex: regex } },
    ],
  })
    .populate({
      path: "saleMeta.leadId",
      select: "name phone assignedTo createdBy",
      populate: [
        { path: "assignedTo", select: "name role" },
        { path: "createdBy", select: "name role" },
      ],
    })
    .sort({ updatedAt: -1 })
    .limit(12)
    .lean();

  const items = rows.map((row) => {
    const saleLead = row?.saleMeta?.leadId;
    const handledBy = saleLead?.assignedTo?.name || saleLead?.createdBy?.name || "-";

    return {
      id: row._id,
      label: formatInventoryLabel(row),
      status: row.status,
      location: row.location || "-",
      price: row.price || 0,
      through: handledBy,
      updatedAt: row.updatedAt || null,
    };
  });

  if (!items.length) {
    return {
      answer: "Is inventory query ke liye koi matching property nahi mili.",
      data: { inventory: [] },
    };
  }

  return {
    answer: `${items.length} matching inventory record mile. Top match: ${items[0].label} (${items[0].status}, Rs ${formatMoney(items[0].price)}).`,
    data: { inventory: items },
  };
};

const queryLeads = async ({ user, query, forcedStatus = "" }) => {
  const scope = await getLeadScopeForUser(user);
  if (!scope) {
    return {
      answer: "Aapke role me lead access available nahi hai.",
      data: { leads: [] },
    };
  }

  const regex = new RegExp(escapeRegex(query), "i");
  const filter = {
    ...scope,
    $or: [
      { name: { $regex: regex } },
      { phone: { $regex: regex } },
      { city: { $regex: regex } },
      { projectInterested: { $regex: regex } },
      { status: { $regex: regex } },
    ],
  };

  if (forcedStatus) {
    filter.status = forcedStatus;
  }

  const rows = await Lead.find(filter)
    .populate("assignedTo", "name role")
    .populate("createdBy", "name role")
    .populate("inventoryId", "projectName towerName unitNumber status")
    .sort({ updatedAt: -1 })
    .limit(12)
    .lean();

  const leads = rows.map((row) => ({
    id: row._id,
    name: row.name || "-",
    phone: row.phone || "-",
    status: row.status || "-",
    projectInterested: row.projectInterested || "-",
    assignee: row.assignedTo?.name || "Unassigned",
    createdBy: row.createdBy?.name || "-",
    inventory: row.inventoryId ? formatInventoryLabel(row.inventoryId) : "-",
    updatedAt: row.updatedAt || null,
  }));

  if (!leads.length) {
    return {
      answer: "Is lead query ke liye koi matching result nahi mila.",
      data: { leads: [] },
    };
  }

  return {
    answer: `${leads.length} matching leads mile. Top result: ${leads[0].name} (${leads[0].status}) assigned to ${leads[0].assignee}.`,
    data: { leads },
  };
};

const queryBestPerformer = async ({ user }) => {
  const scope = await getLeadScopeForUser(user);
  if (!scope) {
    return {
      answer: "Performance calculate karne ke liye lead scope available nahi hai.",
      data: { performers: [] },
    };
  }

  const rows = await Lead.aggregate([
    { $match: { ...scope, assignedTo: { $ne: null } } },
    {
      $group: {
        _id: "$assignedTo",
        totalLeads: { $sum: 1 },
        closedLeads: {
          $sum: {
            $cond: [{ $eq: ["$status", "CLOSED"] }, 1, 0],
          },
        },
        interestedLeads: {
          $sum: {
            $cond: [{ $eq: ["$status", "INTERESTED"] }, 1, 0],
          },
        },
      },
    },
    {
      $addFields: {
        score: {
          $add: [
            { $multiply: ["$closedLeads", 3] },
            "$interestedLeads",
          ],
        },
      },
    },
    { $sort: { score: -1, closedLeads: -1, totalLeads: -1 } },
    { $limit: 5 },
  ]);

  if (!rows.length) {
    return {
      answer: "Abhi performance ranking ke liye data available nahi hai.",
      data: { performers: [] },
    };
  }

  const userMap = new Map(
    (
      await User.find({ _id: { $in: rows.map((row) => row._id) } })
        .select("_id name role")
        .lean()
    ).map((row) => [String(row._id), row]),
  );

  const performers = rows.map((row, index) => {
    const person = userMap.get(String(row._id));
    const totalLeads = Number(row.totalLeads || 0);
    const closedLeads = Number(row.closedLeads || 0);
    const conversionRate = totalLeads ? Math.round((closedLeads / totalLeads) * 100) : 0;

    return {
      rank: index + 1,
      userId: row._id,
      name: person?.name || "Unknown",
      role: person?.role || "-",
      totalLeads,
      closedLeads,
      interestedLeads: Number(row.interestedLeads || 0),
      conversionRate,
      score: Number(row.score || 0),
    };
  });

  return {
    answer: `Best performer abhi ${performers[0].name} hai (${performers[0].closedLeads} closed leads, ${performers[0].conversionRate}% conversion).`,
    data: { performers },
  };
};

const querySalesInterestedSnapshot = async ({ user }) => {
  const inventoryScope = getInventoryScopeForUser(user);
  const leadScope = await getLeadScopeForUser(user);

  if (!inventoryScope || !leadScope) {
    return {
      answer: "Sales/interest snapshot ke liye required access available nahi hai.",
      data: { soldInventory: [], interestedLeads: [] },
    };
  }

  const [soldInventoryRows, interestedLeadRows] = await Promise.all([
    Inventory.find({ ...inventoryScope, status: "Sold" })
      .populate({
        path: "saleMeta.leadId",
        select: "name phone assignedTo createdBy",
        populate: [
          { path: "assignedTo", select: "name role" },
          { path: "createdBy", select: "name role" },
        ],
      })
      .sort({ updatedAt: -1 })
      .limit(10)
      .lean(),
    Lead.find({ ...leadScope, status: "INTERESTED" })
      .populate("assignedTo", "name role")
      .populate("createdBy", "name role")
      .sort({ updatedAt: -1 })
      .limit(10)
      .lean(),
  ]);

  const soldInventory = soldInventoryRows.map((row) => ({
    id: row._id,
    label: formatInventoryLabel(row),
    location: row.location || "-",
    price: row.price || 0,
    soldThrough:
      row?.saleMeta?.leadId?.assignedTo?.name
      || row?.saleMeta?.leadId?.createdBy?.name
      || "-",
    soldLeadName: row?.saleMeta?.leadId?.name || "-",
    updatedAt: row.updatedAt || null,
  }));

  const interestedLeads = interestedLeadRows.map((row) => ({
    id: row._id,
    name: row.name || "-",
    phone: row.phone || "-",
    projectInterested: row.projectInterested || "-",
    assignee: row.assignedTo?.name || "Unassigned",
    createdBy: row.createdBy?.name || "-",
    updatedAt: row.updatedAt || null,
  }));

  return {
    answer: `Snapshot ready: ${soldInventory.length} sold properties aur ${interestedLeads.length} interested leads mile.`,
    data: { soldInventory, interestedLeads },
  };
};

const queryOverview = async ({ user }) => {
  const inventoryScope = getInventoryScopeForUser(user);
  const leadScope = await getLeadScopeForUser(user);

  const [inventoryStats, leadStats] = await Promise.all([
    inventoryScope
      ? Inventory.aggregate([
        { $match: inventoryScope },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ])
      : Promise.resolve([]),
    leadScope
      ? Lead.aggregate([
        { $match: leadScope },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ])
      : Promise.resolve([]),
  ]);

  const inventoryByStatus = {};
  inventoryStats.forEach((row) => {
    inventoryByStatus[row._id || "Unknown"] = Number(row.count || 0);
  });

  const leadByStatus = {};
  leadStats.forEach((row) => {
    leadByStatus[row._id || "Unknown"] = Number(row.count || 0);
  });

  return {
    answer: "Overview ready. Aap sold/interested/performance ya specific lead/inventory puch kar detail le sakte ho.",
    data: {
      inventoryByStatus,
      leadByStatus,
    },
  };
};

exports.askSamvid = async (req, res) => {
  try {
    const query = normalizeQuery(req.body?.query);
    if (!query || query.length < 2) {
      return res.status(400).json({ message: "Query is required" });
    }

    const intent = detectIntent(query);
    let result = { answer: "", data: {} };

    if (intent === "inventory_lookup" || intent === "sold_inventory") {
      result = await queryInventory({ user: req.user, query });
    } else if (intent === "lead_lookup") {
      result = await queryLeads({ user: req.user, query });
    } else if (intent === "interested_leads") {
      result = await queryLeads({ user: req.user, query, forcedStatus: "INTERESTED" });
    } else if (intent === "best_performer") {
      result = await queryBestPerformer({ user: req.user });
    } else if (intent === "sales_interest_snapshot") {
      result = await querySalesInterestedSnapshot({ user: req.user });
    } else {
      result = await queryOverview({ user: req.user });
    }

    return res.json({
      intent,
      query,
      answer: result.answer,
      data: result.data,
      suggestions: [
        "Show sold properties and through whom sold",
        "Show interested leads assigned to my team",
        "Who is top performer this week",
      ],
    });
  } catch (error) {
    logger.error({
      requestId: req.requestId || null,
      error: error.message,
      message: "askSamvid failed",
    });
    return res.status(500).json({ message: "Server error" });
  }
};
