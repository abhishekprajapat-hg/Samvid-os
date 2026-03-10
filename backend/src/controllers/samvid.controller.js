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

const SAMVID_STOP_WORDS = new Set([
  "show",
  "me",
  "please",
  "need",
  "i",
  "is",
  "the",
  "and",
  "of",
  "for",
  "to",
  "a",
  "an",
  "my",
  "this",
  "that",
  "details",
  "detail",
  "info",
  "information",
  "about",
  "who",
  "what",
  "where",
  "all",
  "through",
  "whom",
  "assigned",
]);

const buildSearchRegex = (value) => {
  const cleaned = normalizeQuery(value).toLowerCase();
  if (!cleaned) return null;
  const tokens = cleaned
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !SAMVID_STOP_WORDS.has(token));
  if (!tokens.length) return null;
  return new RegExp(tokens.map((token) => escapeRegex(token)).join("|"), "i");
};

const startOfDay = (date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const endOfDay = (date) => {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
};

const getDateRangeFromQuery = (query) => {
  const q = String(query || "").toLowerCase();
  const now = new Date();

  if (/\b(this month|current month|is month|is mahine|iss month|iss mahine)\b/.test(q)) {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return {
      label: now.toLocaleString("en-IN", { month: "long", year: "numeric" }),
      start: startOfDay(start),
      end: endOfDay(end),
    };
  }

  if (/\b(this week|current week|is week|is hafte|iss week|iss hafte)\b/.test(q)) {
    const day = now.getDay();
    const diffToMonday = day === 0 ? 6 : day - 1;
    const start = new Date(now);
    start.setDate(now.getDate() - diffToMonday);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return {
      label: "this week",
      start: startOfDay(start),
      end: endOfDay(end),
    };
  }

  if (/\b(today|aaj)\b/.test(q)) {
    return {
      label: "today",
      start: startOfDay(now),
      end: endOfDay(now),
    };
  }

  return null;
};

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
  const hasInventory = /\b(inventory|property|properties|unit|project|flat|tower|asset|assets)\b/.test(q);
  const hasLead = /\b(lead|leads|customer|customers|client|clients|prospect|prospects)\b/.test(q);
  const hasDetail = /\b(detail|details|info|information)\b/.test(q);

  if (hasDetail && hasInventory) return "asset_details";
  if (hasDetail && hasLead) return "lead_details";

  if (hasSold && hasInterested) return "sales_interest_snapshot";
  if (hasPerformance) return "best_performer";
  if (hasSold && hasInventory) return "sold_inventory";
  if (hasInterested && hasLead) return "interested_leads";
  if (hasInventory) return "inventory_lookup";
  if (hasLead) return "lead_lookup";
  return "overview";
};

const queryInventory = async ({
  user,
  query,
  forcedStatus = "",
  limit = 12,
  detailed = false,
}) => {
  const scope = getInventoryScopeForUser(user);
  if (!scope) {
    return {
      answer: "Aapke role me inventory access allowed nahi hai.",
      data: { inventory: [] },
    };
  }

  const regex = buildSearchRegex(query);
  const filter = { ...scope };
  if (regex) {
    filter.$or = [
      { projectName: { $regex: regex } },
      { towerName: { $regex: regex } },
      { unitNumber: { $regex: regex } },
      { location: { $regex: regex } },
      { status: { $regex: regex } },
      { category: { $regex: regex } },
      { type: { $regex: regex } },
    ];
  }
  if (forcedStatus) {
    filter.status = forcedStatus;
  }

  const rows = await Inventory.find(filter)
    .populate({
      path: "saleMeta.leadId",
      select: "name phone assignedTo createdBy",
      populate: [
        { path: "assignedTo", select: "name role" },
        { path: "createdBy", select: "name role" },
      ],
    })
    .sort({ updatedAt: -1 })
    .limit(Math.max(1, Math.min(Number(limit || 12), 25)))
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

  if (detailed) {
    const previewLines = items
      .slice(0, 5)
      .map(
        (row, index) =>
          `${index + 1}. ${row.label} | Status: ${row.status} | Location: ${row.location} | Price: Rs ${formatMoney(row.price)}`,
      )
      .join("\n");
    return {
      answer: `${items.length} asset record mile:\n${previewLines}`,
      data: { inventory: items },
    };
  }

  return {
    answer: `${items.length} matching inventory record mile. Top match: ${items[0].label} (${items[0].status}, Rs ${formatMoney(items[0].price)}).`,
    data: { inventory: items },
  };
};

const queryLeads = async ({
  user,
  query,
  forcedStatus = "",
  limit = 12,
  detailed = false,
}) => {
  const scope = await getLeadScopeForUser(user);
  if (!scope) {
    return {
      answer: "Aapke role me lead access available nahi hai.",
      data: { leads: [] },
    };
  }

  const regex = buildSearchRegex(query);
  const filter = { ...scope };
  if (regex) {
    filter.$or = [
      { name: { $regex: regex } },
      { phone: { $regex: regex } },
      { city: { $regex: regex } },
      { projectInterested: { $regex: regex } },
      { status: { $regex: regex } },
      { email: { $regex: regex } },
    ];
  }

  if (forcedStatus) {
    filter.status = forcedStatus;
  }

  const rows = await Lead.find(filter)
    .populate("assignedTo", "name role")
    .populate("createdBy", "name role")
    .populate("inventoryId", "projectName towerName unitNumber status")
    .sort({ updatedAt: -1 })
    .limit(Math.max(1, Math.min(Number(limit || 12), 25)))
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

  if (detailed) {
    const previewLines = leads
      .slice(0, 5)
      .map(
        (row, index) =>
          `${index + 1}. ${row.name} | ${row.phone} | Status: ${row.status} | Assigned: ${row.assignee} | Project: ${row.projectInterested}`,
      )
      .join("\n");
    return {
      answer: `${leads.length} lead record mile:\n${previewLines}`,
      data: { leads },
    };
  }

  return {
    answer: `${leads.length} matching leads mile. Top result: ${leads[0].name} (${leads[0].status}) assigned to ${leads[0].assignee}.`,
    data: { leads },
  };
};

const queryBestPerformer = async ({ user, query }) => {
  const scope = await getLeadScopeForUser(user);
  if (!scope) {
    return {
      answer: "Performance calculate karne ke liye lead scope available nahi hai.",
      data: { performers: [] },
    };
  }

  const dateRange = getDateRangeFromQuery(query);
  const match = {
    ...scope,
    assignedTo: { $ne: null },
  };
  if (dateRange) {
    match.updatedAt = {
      $gte: dateRange.start,
      $lte: dateRange.end,
    };
  }

  const rows = await Lead.aggregate([
    { $match: match },
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
    answer: `Best performer ${dateRange?.label ? `for ${dateRange.label}` : "right now"} is ${performers[0].name} (${performers[0].closedLeads} closed leads, ${performers[0].conversionRate}% conversion).`,
    data: { performers },
  };
};

const extractEntitySearchTerm = (query, type) => {
  const source = normalizeQuery(query).toLowerCase();
  if (!source) return "";

  const leadWords = /\b(lead|leads|customer|customers|client|clients|prospect|prospects)\b/g;
  const assetWords = /\b(asset|assets|inventory|property|properties|unit|project|flat|tower)\b/g;
  const genericWords = /\b(show|give|fetch|details|detail|info|information|about|please|need|i|me|this|that)\b/g;

  const withoutEntityWords =
    type === "lead"
      ? source.replace(leadWords, " ")
      : source.replace(assetWords, " ");

  return normalizeQuery(withoutEntityWords.replace(genericWords, " "));
};

const queryLeadDetails = async ({ user, query }) => {
  const searchTerm = extractEntitySearchTerm(query, "lead");
  if (!searchTerm) {
    return queryLeads({
      user,
      query: "",
      limit: 5,
      detailed: true,
    });
  }
  return queryLeads({
    user,
    query: searchTerm,
    limit: 10,
    detailed: true,
  });
};

const queryAssetDetails = async ({ user, query }) => {
  const searchTerm = extractEntitySearchTerm(query, "asset");
  if (!searchTerm) {
    return queryInventory({
      user,
      query: "",
      limit: 5,
      detailed: true,
    });
  }
  return queryInventory({
    user,
    query: searchTerm,
    limit: 10,
    detailed: true,
  });
};

const querySmartAssistant = async ({ user, query }) => {
  const [leadResult, inventoryResult] = await Promise.all([
    queryLeads({ user, query, limit: 5, detailed: true }),
    queryInventory({ user, query, limit: 5, detailed: true }),
  ]);

  const leadCount = Array.isArray(leadResult?.data?.leads) ? leadResult.data.leads.length : 0;
  const inventoryCount = Array.isArray(inventoryResult?.data?.inventory) ? inventoryResult.data.inventory.length : 0;

  if (leadCount && inventoryCount) {
    return {
      answer: `${leadResult.answer}\n\n${inventoryResult.answer}`,
      data: {
        leads: leadResult.data.leads,
        inventory: inventoryResult.data.inventory,
      },
    };
  }

  if (leadCount) return leadResult;
  if (inventoryCount) return inventoryResult;

  return {
    answer: "I can help with best performer, lead details, asset details, sold inventory, and interested leads. Please share a specific name, phone, project, or status.",
    data: {},
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
    answer: "Hello, I am Samvid bot. Ask me anything about best performer, lead details, asset details, sold inventory, interested leads, or company overview.",
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

    if (intent === "sold_inventory") {
      result = await queryInventory({
        user: req.user,
        query,
        forcedStatus: "Sold",
        limit: 12,
        detailed: true,
      });
    } else if (intent === "inventory_lookup") {
      result = await queryInventory({ user: req.user, query });
    } else if (intent === "asset_details") {
      result = await queryAssetDetails({ user: req.user, query });
    } else if (intent === "lead_lookup") {
      result = await queryLeads({ user: req.user, query });
    } else if (intent === "lead_details") {
      result = await queryLeadDetails({ user: req.user, query });
    } else if (intent === "interested_leads") {
      result = await queryLeads({ user: req.user, query, forcedStatus: "INTERESTED", detailed: true });
    } else if (intent === "best_performer") {
      result = await queryBestPerformer({ user: req.user, query });
    } else if (intent === "sales_interest_snapshot") {
      result = await querySalesInterestedSnapshot({ user: req.user });
    } else {
      const overviewResult = await queryOverview({ user: req.user });
      const smartResult = await querySmartAssistant({ user: req.user, query });
      const hasSmartData = Object.values(smartResult?.data || {}).some(
        (value) => Array.isArray(value) && value.length > 0,
      );
      result = hasSmartData ? smartResult : overviewResult;
    }

    return res.json({
      intent,
      query,
      answer: result.answer,
      data: result.data,
      suggestions: [],
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
