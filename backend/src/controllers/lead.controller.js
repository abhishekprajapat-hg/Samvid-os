const Lead = require("../models/Lead");
const User = require("../models/User");
const LeadActivity = require("../models/leadActivity.model");
const {
  EXECUTIVE_ROLES,
  autoAssignLead,
} = require("../services/leadAssignment.service");
const LEAD_POPULATE_FIELDS = [
  { path: "assignedTo", select: "name role" },
  { path: "assignedManager", select: "name role" },
  { path: "assignedExecutive", select: "name role" },
  { path: "assignedFieldExecutive", select: "name role" },
  { path: "createdBy", select: "name role" },
];

exports.createLead = async (req, res) => {
  try {
    const { name, phone, email, city, projectInterested } = req.body;

    const existing = await Lead.findOne({ phone });
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

    const populatedLead = await Lead.findById(lead._id).populate(LEAD_POPULATE_FIELDS);

    res.status(201).json({
      message: "Lead created and assignment processed",
      lead: populatedLead,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getAllLeads = async (req, res) => {
  try {
    const user = req.user;
    let leads;
    if (user.role === "ADMIN") {
      leads = await Lead.find()
        .populate(LEAD_POPULATE_FIELDS)
        .sort({ createdAt: -1 });
    } else if (user.role === "MANAGER") {
      const executives = await User.find({
        parentId: user._id,
        role: { $in: EXECUTIVE_ROLES },
      }).select("_id");

      const execIds = executives.map((e) => e._id);

      leads = await Lead.find({
        $or: [
          { createdBy: user._id },
          { assignedTo: { $in: execIds } },
          { assignedTo: null },
        ],
      })
        .populate(LEAD_POPULATE_FIELDS)
        .sort({ createdAt: -1 });
    } else if (EXECUTIVE_ROLES.includes(user.role)) {
      leads = await Lead.find({
        $or: [{ assignedTo: user._id }, { assignedTo: null }],
      })
        .populate(LEAD_POPULATE_FIELDS)
        .sort({ createdAt: -1 });
    } else {
      return res.status(403).json({ message: "Access denied" });
    }

    res.json({ leads });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
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
      }).select("_id");

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
        !leadAssigneeId ||
        teamExecutiveIds.has(leadAssigneeId) ||
        leadCreatorId === managerId;

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

    const populatedLead = await Lead.findById(lead._id).populate(LEAD_POPULATE_FIELDS);

    res.json({
      message: "Lead assigned successfully",
      lead: populatedLead,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
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

    const populatedLead = await Lead.findById(lead._id).populate(LEAD_POPULATE_FIELDS);

    res.json({
      message: "Lead status updated",
      lead: populatedLead,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getLeadActivity = async (req, res) => {
  try {
    const { leadId } = req.params;

    const activities = await LeadActivity.find({ lead: leadId })
      .populate("performedBy", "name role")
      .sort({ createdAt: -1 });

    res.json({ activities });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
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

    const leads = await Lead.find(query)
      .populate("assignedTo", "name role")
      .sort({ nextFollowUp: 1 });

    res.json({ leads });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};
