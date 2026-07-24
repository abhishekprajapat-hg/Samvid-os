const mongoose = require("mongoose");
const Task = require("../models/Task");
const User = require("../models/User");
const Lead = require("../models/Lead");
const { USER_ROLES, isPlatformAdminRole } = require("../constants/role.constants");

const isProductionExecutive = (user) => user?.role === USER_ROLES.PRODUCTION_EXECUTIVE;

// Helper to check access permissions
const checkTaskAccess = (task, user) => {
  if (user.role !== USER_ROLES.SUPER_ADMIN && String(task.companyId) !== String(user.companyId)) return false;
  
  // Admin and Managers can access all company tasks
  if (isPlatformAdminRole(user.role) ||
      user.role === USER_ROLES.MANAGER) {
    return true;
  }
  
  // Executives/Field Executives can only access tasks assigned to or created by them
  return String(task.assignedTo) === String(user._id) || String(task.createdBy) === String(user._id);
};

// Create a new task
exports.createTask = async (req, res) => {
  try {
    const { title, description, status, priority, dueDate, assignedTo, leadId, subtasks, tags } = req.body;
    const companyId = req.user.companyId;

    if (!title) {
      return res.status(400).json({ message: "Task title is required" });
    }

    if (isProductionExecutive(req.user) && leadId) {
      return res.status(403).json({ message: "Production Executive tasks cannot be linked to leads" });
    }

    // Validation: Assigned User must be in the same company
    if (assignedTo) {
      if (!mongoose.Types.ObjectId.isValid(assignedTo)) {
        return res.status(400).json({ message: "Invalid assignee ID" });
      }
      const assignedUser = await User.findOne({ _id: assignedTo, companyId });
      if (!assignedUser) {
        return res.status(400).json({ message: "Assignee does not belong to your company" });
      }
    }

    // Validation: Lead must be in the same company
    if (leadId) {
      if (!mongoose.Types.ObjectId.isValid(leadId)) {
        return res.status(400).json({ message: "Invalid lead ID" });
      }
      const lead = await Lead.findOne({ _id: leadId, companyId });
      if (!lead) {
        return res.status(400).json({ message: "Lead does not belong to your company" });
      }
    }

    const newTask = new Task({
      title,
      description,
      status,
      priority,
      dueDate: dueDate || null,
      assignedTo: assignedTo || null,
      leadId: leadId || null,
      subtasks: Array.isArray(subtasks) ? subtasks.map(s => ({ title: String(s.title || "").trim(), isCompleted: Boolean(s.isCompleted) })).filter(s => s.title) : [],
      tags: Array.isArray(tags) ? tags.map(t => String(t || "").trim()).filter(Boolean) : [],
      companyId,
      createdBy: req.user._id,
    });

    const savedTask = await newTask.save();
    
    // Populate assignee, creator, and lead information before returning
    const populatedTask = await Task.findById(savedTask._id)
      .populate("assignedTo", "name email role profileImageUrl")
      .populate("createdBy", "name role")
      .populate("leadId", "name phone email status");

    // Real-time notification via Socket.io
    const io = req.app.get("io");
    if (io && assignedTo) {
      io.to(`user:${assignedTo}`).emit("task:created", {
        task: populatedTask,
        message: `You have been assigned a new task: "${title}" by ${req.user.name}`,
      });
    }

    res.status(201).json(populatedTask);
  } catch (error) {
    req.log?.error(error);
    res.status(500).json({ message: "Failed to create task", error: error.message });
  }
};

// Get all tasks (with filters and search)
exports.getTasks = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { status, priority, leadId, assignedTo, search, dueDateStart, dueDateEnd, tag } = req.query;

    const query = req.user.role === USER_ROLES.SUPER_ADMIN ? {} : { companyId };

    // Role-based restrictions
    if (!isPlatformAdminRole(req.user.role) && 
        req.user.role !== USER_ROLES.MANAGER) {
      // Executives can only see their own tasks (assigned to or created by)
      query.$or = [
        { assignedTo: req.user._id },
        { createdBy: req.user._id }
      ];
    }

    // Apply filters
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (leadId && !isProductionExecutive(req.user)) query.leadId = leadId;
    if (assignedTo) query.assignedTo = assignedTo;
    if (tag) query.tags = tag;
    
    if (search) {
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { title: { $regex: search, $options: "i" } },
          { description: { $regex: search, $options: "i" } }
        ]
      });
    }

    if (dueDateStart || dueDateEnd) {
      query.dueDate = {};
      if (dueDateStart) query.dueDate.$gte = new Date(dueDateStart);
      if (dueDateEnd) query.dueDate.$lte = new Date(dueDateEnd);
    }

    const tasks = await Task.find(query)
      .populate("assignedTo", "name email role profileImageUrl")
      .populate("createdBy", "name role")
      .populate("leadId", "name phone email status")
      .sort({ createdAt: -1 });

    res.status(200).json(tasks);
  } catch (error) {
    req.log?.error(error);
    res.status(500).json({ message: "Failed to retrieve tasks", error: error.message });
  }
};

// Get details for a single task
exports.getTaskById = async (req, res) => {
  try {
    const { taskId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(taskId)) {
      return res.status(400).json({ message: "Invalid task ID" });
    }

    const task = await Task.findById(taskId)
      .populate("assignedTo", "name email role profileImageUrl")
      .populate("createdBy", "name role")
      .populate("leadId", "name phone email status");

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    if (!checkTaskAccess(task, req.user)) {
      return res.status(403).json({ message: "Access denied. You do not have permission to view this task" });
    }

    res.status(200).json(task);
  } catch (error) {
    req.log?.error(error);
    res.status(500).json({ message: "Failed to retrieve task details", error: error.message });
  }
};

// Update a task
exports.updateTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { title, description, status, priority, dueDate, assignedTo, leadId, subtasks, tags } = req.body;
    const companyId = req.user.companyId;

    if (!mongoose.Types.ObjectId.isValid(taskId)) {
      return res.status(400).json({ message: "Invalid task ID" });
    }

    if (isProductionExecutive(req.user) && leadId) {
      return res.status(403).json({ message: "Production Executive tasks cannot be linked to leads" });
    }

    const task = await Task.findById(taskId);

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    if (!checkTaskAccess(task, req.user)) {
      return res.status(403).json({ message: "Access denied. You do not have permission to edit this task" });
    }

    // Validate updates if changed
    if (assignedTo && String(assignedTo) !== String(task.assignedTo)) {
      if (!mongoose.Types.ObjectId.isValid(assignedTo)) {
        return res.status(400).json({ message: "Invalid assignee ID" });
      }
      const assignedUser = await User.findOne({ _id: assignedTo, companyId });
      if (!assignedUser) {
        return res.status(400).json({ message: "Assignee does not belong to your company" });
      }
    }

    if (leadId && String(leadId) !== String(task.leadId)) {
      if (!mongoose.Types.ObjectId.isValid(leadId)) {
        return res.status(400).json({ message: "Invalid lead ID" });
      }
      const lead = await Lead.findOne({ _id: leadId, companyId });
      if (!lead) {
        return res.status(400).json({ message: "Lead does not belong to your company" });
      }
    }

    const originalAssignee = task.assignedTo;

    // Apply updates
    if (title !== undefined) task.title = title;
    if (description !== undefined) task.description = description;
    if (status !== undefined) task.status = status;
    if (priority !== undefined) task.priority = priority;
    if (dueDate !== undefined) task.dueDate = dueDate || null;
    if (assignedTo !== undefined) task.assignedTo = assignedTo || null;
    if (leadId !== undefined) task.leadId = leadId || null;
    if (subtasks !== undefined) {
      task.subtasks = Array.isArray(subtasks)
        ? subtasks.map(s => ({ title: String(s.title || "").trim(), isCompleted: Boolean(s.isCompleted) })).filter(s => s.title)
        : [];
    }
    if (tags !== undefined) {
      task.tags = Array.isArray(tags)
        ? tags.map(t => String(t || "").trim()).filter(Boolean)
        : [];
    }

    const updatedTask = await task.save();

    const populatedTask = await Task.findById(updatedTask._id)
      .populate("assignedTo", "name email role profileImageUrl")
      .populate("createdBy", "name role")
      .populate("leadId", "name phone email status");

    // Socket Notifications
    const io = req.app.get("io");
    if (io) {
      // Notify new assignee if changed
      if (assignedTo && String(assignedTo) !== String(originalAssignee)) {
        io.to(`user:${assignedTo}`).emit("task:updated", {
          task: populatedTask,
          message: `Task assigned to you: "${task.title}" by ${req.user.name}`,
        });
      }
      // Notify original assignee of update if it wasn't unassigned
      if (originalAssignee && String(originalAssignee) !== String(assignedTo)) {
        io.to(`user:${originalAssignee}`).emit("task:updated", {
          taskId: task._id,
          message: `Task "${task.title}" has been reassigned to someone else`,
        });
      } else if (originalAssignee) {
        io.to(`user:${originalAssignee}`).emit("task:updated", {
          task: populatedTask,
          message: `Task updated: "${task.title}"`,
        });
      }
      
      // Notify creator of status changes
      if (String(task.createdBy) !== String(req.user._id)) {
        io.to(`user:${task.createdBy}`).emit("task:updated", {
          task: populatedTask,
          message: `Task you created was updated by ${req.user.name}: "${task.title}"`,
        });
      }
    }

    res.status(200).json(populatedTask);
  } catch (error) {
    req.log?.error(error);
    res.status(500).json({ message: "Failed to update task", error: error.message });
  }
};

// Delete a task
exports.deleteTask = async (req, res) => {
  try {
    const { taskId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(taskId)) {
      return res.status(400).json({ message: "Invalid task ID" });
    }

    const task = await Task.findById(taskId);

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    // Access check: Admin or creator can delete
    const isCreator = String(task.createdBy) === String(req.user._id);
    const isAdmin = isPlatformAdminRole(req.user.role);

    if (!isAdmin && !isCreator) {
      return res.status(403).json({ message: "Access denied. Only the creator or an Admin can delete this task" });
    }

    const originalAssignee = task.assignedTo;
    const taskTitle = task.title;

    await Task.findByIdAndDelete(taskId);

    // Socket Notifications
    const io = req.app.get("io");
    if (io) {
      if (originalAssignee && String(originalAssignee) !== String(req.user._id)) {
        io.to(`user:${originalAssignee}`).emit("task:deleted", {
          taskId,
          message: `Task "${taskTitle}" assigned to you has been deleted by ${req.user.name}`,
        });
      }
    }

    res.status(200).json({ message: "Task successfully deleted", taskId });
  } catch (error) {
    req.log?.error(error);
    res.status(500).json({ message: "Failed to delete task", error: error.message });
  }
};

// Get stats count for tasks (Pending, Completed, Overdue, Priority breakouts)
exports.getTaskStats = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const query = { companyId };

    // Apply role filter (Executives only see their tasks)
    if (!isPlatformAdminRole(req.user.role) && 
        req.user.role !== USER_ROLES.MANAGER) {
      query.$or = [
        { assignedTo: req.user._id },
        { createdBy: req.user._id }
      ];
    }

    const now = new Date();

    const stats = await Task.aggregate([
      { $match: query },
      {
        $facet: {
          statusCounts: [
            { $group: { _id: "$status", count: { $sum: 1 } } }
          ],
          priorityCounts: [
            { $group: { _id: "$priority", count: { $sum: 1 } } }
          ],
          overdueCount: [
            {
              $match: {
                status: { $ne: "COMPLETED" },
                dueDate: { $lt: now }
              }
            },
            { $count: "count" }
          ]
        }
      }
    ]);

    const formattedStats = {
      TODO: 0,
      IN_PROGRESS: 0,
      COMPLETED: 0,
      BACKLOG: 0,
      total: 0,
      pending: 0,
      overdue: 0,
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0
    };

    if (stats && stats.length > 0) {
      const result = stats[0];
      
      // Map status counts
      result.statusCounts.forEach(item => {
        formattedStats[item._id] = item.count;
        formattedStats.total += item.count;
        if (item._id !== "COMPLETED") {
          formattedStats.pending += item.count;
        }
      });

      // Map priority counts
      result.priorityCounts.forEach(item => {
        formattedStats[item._id] = item.count;
      });

      // Map overdue count
      if (result.overdueCount && result.overdueCount.length > 0) {
        formattedStats.overdue = result.overdueCount[0].count;
      }
    }

    res.status(200).json(formattedStats);
  } catch (error) {
    req.log?.error(error);
    res.status(500).json({ message: "Failed to compile task statistics", error: error.message });
  }
};
