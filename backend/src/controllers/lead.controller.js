const Lead = require("../models/Lead");
const User = require("../models/User");
const LeadActivity = require("../models/leadActivity.model");
const logger = require("../config/logger");
const {
  EXECUTIVE_ROLES,
  autoAssignLead,
} = require("../services/leadAssignment.service");
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
];

const LEAD_SELECTABLE_FIELDS = [
  "_id",
  "name",
  "phone",
  "email",
  "city",
  "projectInterested",
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

const getLeadViewById = (leadId) =>
  Lead.findById(leadId).populate(LEAD_POPULATE_FIELDS).lean();

const buildLeadQueryForUser = async (user) => {
  if (user.role === "ADMIN") {
    return {};
  }

  if (user.role === "MANAGER") {
    const executives = await User.find({
      parentId: user._id,
      role: { $in: EXECUTIVE_ROLES },
    })
      .select("_id")
      .lean();

    const execIds = executives.map((item) => item._id);
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

  return null;
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
    const { name, phone, email, city, projectInterested } = req.body;

    const existing = await Lead.findOne({ phone }).select("_id").lean();
    if (existing) {
      return res.status(400).json({ message: "Lead already exists" });
    }

    const lead = await Lead.create({
      name,
      phone,
      email,
      city,
      projectInterested,
      source: "MANUAL",
      createdBy: req.user._id,
    });

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
      const leads = await leadQuery;
      return res.json({ leads });
    }

    const [leads, totalCount] = await Promise.all([
      leadQuery,
      Lead.countDocuments(query),
    ]);

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

    if (req.user.role === "MANAGER") {
      const teamExecutives = await User.find({
        parentId: req.user._id,
        role: { $in: EXECUTIVE_ROLES },
      })
        .select("_id")
        .lean();

      const teamExecutiveIds = new Set(
        teamExecutives.map((item) => String(item._id)),
      );

      const targetExecutiveId = String(executive._id);
      const leadAssigneeId = String(lead.assignedTo || "");
      const leadCreatorId = String(lead.createdBy || "");
      const managerId = String(req.user._id);

      if (!teamExecutiveIds.has(targetExecutiveId)) {
        return res.status(403).json({
          message: "Managers can assign leads only to their own executives",
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

    lead.assignedTo = executive._id;
    lead.assignedManager = executive.parentId || null;
    lead.assignedExecutive = executive.role === "EXECUTIVE" ? executive._id : null;
    lead.assignedFieldExecutive =
      executive.role === "FIELD_EXECUTIVE" ? executive._id : null;
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

exports.updateLeadStatus = async (req, res) => {
  try {
    const { leadId } = req.params;
    const { status, nextFollowUp } = req.body;

    if (!status) {
      return res.status(400).json({ message: "Status is required" });
    }

    const lead = await Lead.findById(leadId);
    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    lead.status = status;
    lead.lastContactedAt = new Date();

    if (nextFollowUp) {
      lead.nextFollowUp = new Date(nextFollowUp);
    }

    await lead.save();

    await LeadActivity.create({
      lead: lead._id,
      action: `Status changed to ${status}`,
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
      const leads = await leadsQuery;
      return res.json({ leads });
    }

    const [leads, totalCount] = await Promise.all([
      leadsQuery,
      Lead.countDocuments(query),
    ]);

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
