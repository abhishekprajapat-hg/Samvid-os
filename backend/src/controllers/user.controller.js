const User = require("../models/User");
const Lead = require("../models/Lead");
const {
  EXECUTIVE_ROLES,
  redistributePipelineLeads,
} = require("../services/leadAssignment.service");

const LOCATION_ALLOWED_ROLES = ["FIELD_EXECUTIVE", "EXECUTIVE"];
const LOCATION_VIEWER_ROLES = ["ADMIN", "MANAGER", "FIELD_EXECUTIVE"];

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

const findLeastLoadedManager = async (companyId) => {
  const managers = await User.find({
    role: "MANAGER",
    isActive: true,
    companyId,
  }).sort({ createdAt: 1 });

  if (!managers.length) return null;

  const managerIds = managers.map((m) => m._id);

  const teamCounts = await User.aggregate([
    {
      $match: {
        parentId: { $in: managerIds },
        role: { $in: EXECUTIVE_ROLES },
        isActive: true,
        companyId,
      },
    },
    {
      $group: {
        _id: "$parentId",
        count: { $sum: 1 },
      },
    },
  ]);

  const countMap = new Map(teamCounts.map((row) => [String(row._id), row.count]));

  let selected = managers[0];
  let minCount = Number.POSITIVE_INFINITY;

  for (const manager of managers) {
    const count = countMap.get(String(manager._id)) || 0;
    if (count < minCount) {
      minCount = count;
      selected = manager;
    }
  }

  return selected;
};

exports.getUsers = async (req, res) => {
  try {
    if (!req.user.companyId) {
      return res.status(403).json({ message: "Company context is required" });
    }

    const companyScope = { companyId: req.user.companyId };
    let query = {};

    if (req.user.role === "ADMIN") {
      query = companyScope;
    } else if (req.user.role === "MANAGER") {
      query = {
        ...companyScope,
        $or: [
          { _id: req.user._id },
          { parentId: req.user._id },
        ],
      };
    } else {
      query = { ...companyScope, _id: req.user._id };
    }

    const users = await User.find(query)
      .select("-password")
      .populate("parentId", "name role")
      .sort({ createdAt: -1 });

    res.json({
      count: users.length,
      users,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// Hierarchy based user creation
exports.createUserByRole = async (req, res) => {
  try {
    const { name, email, phone, password, role, managerId, parentId } = req.body;

    if (req.user.role !== "ADMIN") {
      return res.status(403).json({
        message: "Only ADMIN can create users",
      });
    }

    if (!req.user.companyId) {
      return res.status(403).json({ message: "Company context is required" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    let resolvedParentId = req.user._id;

    if (EXECUTIVE_ROLES.includes(role)) {
      const requestedManagerId = managerId || parentId;
      let manager = null;

      if (requestedManagerId) {
        manager = await User.findOne({
          _id: requestedManagerId,
          role: "MANAGER",
          isActive: true,
          companyId: req.user.companyId,
        });

        if (!manager) {
          return res.status(400).json({ message: "Invalid managerId" });
        }
      } else {
        manager = await findLeastLoadedManager(req.user.companyId);
      }

      if (!manager) {
        return res.status(400).json({
          message: "No active manager available for assignment",
        });
      }

      resolvedParentId = manager._id;
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
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.rebalanceExecutives = async (req, res) => {
  try {
    if (req.user.role !== "ADMIN") {
      return res.status(403).json({ message: "Only ADMIN can rebalance team" });
    }

    if (!req.user.companyId) {
      return res.status(403).json({ message: "Company context is required" });
    }

    const managers = await User.find({
      role: "MANAGER",
      isActive: true,
      companyId: req.user.companyId,
    }).sort({ createdAt: 1 });

    if (!managers.length) {
      return res.status(400).json({ message: "No active manager found" });
    }

    const executives = await User.find({
      role: { $in: EXECUTIVE_ROLES },
      isActive: true,
      companyId: req.user.companyId,
    }).sort({ createdAt: 1 });

    if (!executives.length) {
      return res.json({ message: "No active executive found", updated: 0 });
    }

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

    // Rebalance active pipeline leads with the same load-aware strategy
    // used during auto-assignment so new executives start receiving leads.
    const leadRebalance = await redistributePipelineLeads({
      executiveIds: executives.map((executive) => executive._id),
    });

    const distribution = await User.aggregate([
      {
        $match: {
          parentId: { $in: managers.map((m) => m._id) },
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

    const distributionByManager = managers.map((manager) => {
      const row = distribution.find((d) => String(d._id) === String(manager._id));
      return {
        managerId: manager._id,
        managerName: manager.name,
        executives: row ? row.count : 0,
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

    const leadDistributionByExecutive = executives.map((executive) => {
      const row = executiveLeadDistribution.find(
        (d) => String(d._id) === String(executive._id),
      );

      return {
        executiveId: executive._id,
        executiveName: executive.name,
        totalLeads: row ? row.totalLeads : 0,
        convertedLeads: row ? row.convertedLeads : 0,
      };
    });

    res.json({
      message: "Executives and leads rebalanced successfully",
      updated: bulkOps.length,
      leadsUpdated: leadRebalance.updated,
      distribution: distributionByManager,
      leadDistribution: leadDistributionByExecutive,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    if (req.user.role !== "ADMIN") {
      return res.status(403).json({ message: "Only ADMIN can delete users" });
    }

    const { userId } = req.params;

    if (String(req.user._id) === String(userId)) {
      return res.status(400).json({ message: "You cannot delete your own account" });
    }

    const user = await User.findOne({
      _id: userId,
      companyId: req.user.companyId,
    });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.role === "MANAGER") {
      const hasTeam = await User.exists({
        parentId: user._id,
        role: { $in: EXECUTIVE_ROLES },
        companyId: req.user.companyId,
      });

      if (hasTeam) {
        return res.status(400).json({
          message: "Manager has active team. Reassign executives before deleting.",
        });
      }
    }

    await Lead.updateMany(
      { assignedTo: user._id },
      { $set: { assignedTo: null } },
    );

    await User.deleteOne({ _id: user._id });

    res.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get my direct team
exports.getMyTeam = async (req, res) => {
  try {
    const users = await User.find({
      parentId: req.user._id,
      isActive: true,
      companyId: req.user.companyId,
    }).select("-password");

    res.json({
      count: users.length,
      team: users,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
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
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.getFieldExecutiveLocations = async (req, res) => {
  try {
    if (!LOCATION_VIEWER_ROLES.includes(req.user.role)) {
      return res.status(403).json({
        message: "Only admin and managers can view field locations",
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
      role: "FIELD_EXECUTIVE",
      isActive: true,
    };

    if (req.user.role === "MANAGER") {
      query.parentId = req.user._id;
    } else if (req.user.role === "FIELD_EXECUTIVE") {
      query._id = req.user._id;
    }

    const users = await User.find(query)
      .select("name email phone role parentId isActive lastAssignedAt liveLocation")
      .sort({ name: 1 });

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

    return res.json({
      count: rows.length,
      staleMinutes,
      users: rows,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  }
};
