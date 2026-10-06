const mongoose = require("mongoose");
const { sendMongooseError } = require("../utils/mongooseError");
const Task = require("../models/Task");
const User = require("../models/User");
const Lead = require("../models/Lead");
const { USER_ROLES, PRODUCTION_ROLES } = require("../constants/role.constants");
const { notify } = require("../services/push.service");
const {
  TASK_PRIORITIES,
  TASK_STATUSES,
  effectiveSubtaskStatus,
  isSubtaskComplete,
  normalizeAndValidateSubtasks,
  normalizeSubtask,
  referenceId,
} = require("../utils/taskSubtasks");

const isProductionTaskRole = (user) => PRODUCTION_ROLES.includes(user?.role);

/*
 * A task is overdue once its due date has passed and it is not completed.
 * Due dates are picked as a calendar date and stored as that date at 00:00 UTC,
 * so "passed" means before today's date in the office timezone - a task due
 * today is not overdue yet. The list filter, the counts and the roster all use
 * this one cutoff so the number on a card always matches the list it opens.
 */
const TASK_TIMEZONE = process.env.TASK_TIMEZONE || process.env.ATTENDANCE_TIMEZONE || "Asia/Kolkata";
const OVERDUE_STATUS_FILTER = "OVERDUE";
const getOverdueCutoff = (now = new Date()) => {
  let todayKey;
  try {
    todayKey = new Intl.DateTimeFormat("en-CA", { timeZone: TASK_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  } catch {
    todayKey = now.toISOString().slice(0, 10);
  }
  return new Date(`${todayKey}T00:00:00.000Z`);
};
const populateTask = (query) => query
  .populate("assignedTo", "name email role profileImageUrl")
  .populate("createdBy", "name role profileImageUrl")
  .populate("leadId", "name phone email status")
  .populate("subtasks.assignedTo", "name email role profileImageUrl");

const canManageTask = (task, user) => {
  if (String(task.companyId) !== String(user.companyId)) return false;
  const isCreator = referenceId(task.createdBy) === referenceId(user);
  const isParentReceiver = referenceId(task.assignedTo) === referenceId(user) && !isCreator;
  if (isParentReceiver) return false;
  return isCreator || [USER_ROLES.ADMIN, USER_ROLES.MANAGER].includes(user.role);
};

const subtaskAssigneeIds = (subtasks = []) => [
  ...new Set(subtasks.map((subtask) => referenceId(subtask.assignedTo)).filter(Boolean)),
];

const validateActiveAssignees = async ({ assignedTo, subtasks = [], companyId }) => {
  const ids = [...new Set([referenceId(assignedTo), ...subtaskAssigneeIds(subtasks)].filter(Boolean))];
  for (const userId of ids) {
    if (!mongoose.Types.ObjectId.isValid(userId)) return `Invalid assignee ID: ${userId}`;
    const user = await User.findOne({ _id: userId, companyId, isActive: true });
    if (!user) return "Every assignee must be an active user in your company";
  }
  return "";
};

const emitTaskAssignment = ({ req, task, recipientId, message, eventName = "task:updated" }) => {
  const recipient = referenceId(recipientId);
  if (!recipient || recipient === referenceId(req.user)) return;
  const io = req.app.get("io");
  if (io) {
    io.to(`user:${recipient}`).emit(eventName, {
      actorId: referenceId(req.user),
      eventId: `${eventName}:${task._id}:${recipient}:${task.updatedAt || task.createdAt || Date.now()}`,
      task,
      message,
    });
  }
  notify(recipient, { title: "Task assignment", body: message, url: "/tasks", tag: `task:${task._id}:${recipient}` });
};

// Helper to check access permissions
const checkTaskAccess = (task, user) => {
  if (String(task.companyId) !== String(user.companyId)) return false;
  
  // Admin and Managers can access all company tasks
  if (user.role === USER_ROLES.ADMIN || 
      user.role === USER_ROLES.MANAGER) {
    return true;
  }
  
  // Executives/Field Executives can only access tasks assigned to or created by them
  return referenceId(task.assignedTo) === referenceId(user)
    || referenceId(task.createdBy) === referenceId(user)
    || (task.subtasks || []).some((subtask) => referenceId(subtask.assignedTo) === referenceId(user));
};

// Create a new task
exports.createTask = async (req, res) => {
  try {
    const { title, description, status, priority, dueDate, assignedTo, leadId, subtasks, tags } = req.body;
    const companyId = req.user.companyId;
    const cleanTitle = String(title || "").trim();
    const cleanDescription = String(description || "").trim();
    const nextStatus = String(status || "TODO").trim().toUpperCase();
    const nextPriority = String(priority || "MEDIUM").trim().toUpperCase();

    if (!cleanTitle) {
      return res.status(400).json({ message: "Task title is required" });
    }
    if (cleanTitle.length > 180) return res.status(400).json({ message: "Task title cannot exceed 180 characters" });
    if (cleanDescription.length > 10000) return res.status(400).json({ message: "Task description cannot exceed 10000 characters" });
    if (!assignedTo) return res.status(400).json({ message: "Task assignee is required" });
    if (!dueDate) return res.status(400).json({ message: "Task due date is required" });
    if (Number.isNaN(new Date(dueDate).getTime())) return res.status(400).json({ message: "Task due date is invalid" });
    if (!TASK_STATUSES.includes(nextStatus)) return res.status(400).json({ message: "Invalid task status" });
    if (!TASK_PRIORITIES.includes(nextPriority)) return res.status(400).json({ message: "Invalid task priority" });

    if (isProductionTaskRole(req.user) && leadId) {
      return res.status(403).json({ message: "Production role tasks cannot be linked to leads" });
    }

    const normalizedResult = normalizeAndValidateSubtasks(subtasks || [], {
      assignedTo,
      dueDate,
      priority: nextPriority,
    });
    if (normalizedResult.error) return res.status(400).json({ message: normalizedResult.error });
    if (nextStatus === "COMPLETED" && normalizedResult.subtasks.some((subtask) => !isSubtaskComplete(subtask))) {
      return res.status(409).json({ message: "Complete every subtask before completing the parent task" });
    }
    const assigneeError = await validateActiveAssignees({ assignedTo, subtasks: normalizedResult.subtasks, companyId });
    if (assigneeError) return res.status(400).json({ message: assigneeError });

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
      title: cleanTitle,
      description: cleanDescription,
      status: nextStatus,
      priority: nextPriority,
      dueDate,
      assignedTo,
      leadId: leadId || null,
      subtasks: normalizedResult.subtasks,
      tags: Array.isArray(tags) ? [...new Set(tags.map(t => String(t || "").trim()).filter(Boolean))].slice(0, 20) : [],
      companyId,
      createdBy: req.user._id,
      assignmentHistory: [{ fromUser: null, toUser: assignedTo || null, actor: req.user._id }],
    });

    const savedTask = await newTask.save();
    
    // Populate assignee, creator, and lead information before returning
    const populatedTask = await populateTask(Task.findById(savedTask._id));

    // Real-time notification via Socket.io
    const recipients = [referenceId(assignedTo)];
    recipients.forEach((recipient) => emitTaskAssignment({
      req,
      task: populatedTask,
      recipientId: recipient,
      eventName: "task:created",
      message: `You have been assigned a new task: "${cleanTitle}" by ${req.user.name}`,
    }));

    res.status(201).json(populatedTask);
  } catch (error) {
    if (sendMongooseError(res, error)) return;
    req.log?.error(error);
    res.status(500).json({ message: "Failed to create task" });
  }
};

// Get all tasks (with filters and search)
exports.getTasks = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { status, priority, leadId, assignedTo, search, dueDateStart, dueDateEnd, tag, scope } = req.query;

    const query = { companyId, $and: [] };

    // Role-based restrictions
    if (req.user.role !== USER_ROLES.ADMIN && 
        req.user.role !== USER_ROLES.MANAGER) {
      // Executives can only see their own tasks (assigned to or created by)
      query.$and.push({
        $or: [
          { assignedTo: req.user._id },
          { createdBy: req.user._id },
          { "subtasks.assignedTo": req.user._id },
        ],
      });
    }

    // Apply filters
    const wantsOverdue = String(status || "").toUpperCase() === OVERDUE_STATUS_FILTER;
    if (wantsOverdue) {
      const cutoff = getOverdueCutoff();
      query.$and.push({
        $or: [
          { status: { $ne: "COMPLETED" }, dueDate: { $ne: null, $lt: cutoff } },
          { subtasks: { $elemMatch: { status: { $ne: "COMPLETED" }, isCompleted: { $ne: true }, dueDate: { $ne: null, $lt: cutoff } } } },
        ],
      });
    } else if (status) {
      query.$and.push({ $or: [{ status }, { "subtasks.status": status }] });
    }
    if (priority) query.$and.push({ $or: [{ priority }, { "subtasks.priority": priority }] });
    if (leadId && !isProductionTaskRole(req.user)) query.leadId = leadId;
    if (assignedTo) query.$and.push({ $or: [{ assignedTo }, { "subtasks.assignedTo": assignedTo }] });
    if (scope === "assigned") {
      query.$and.push({ $or: [{ assignedTo: req.user._id }, { "subtasks.assignedTo": req.user._id }] });
      query.$and.push({ createdBy: { $ne: req.user._id } });
    }
    if (scope === "mine") query.createdBy = req.user._id;
    if (tag) query.tags = tag;
    
    if (search) {
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { title: { $regex: search, $options: "i" } },
          { description: { $regex: search, $options: "i" } },
          { "subtasks.title": { $regex: search, $options: "i" } },
          { "subtasks.description": { $regex: search, $options: "i" } },
        ]
      });
    }

    if (dueDateStart || dueDateEnd) {
      const dateRange = {};
      if (dueDateStart) dateRange.$gte = new Date(dueDateStart);
      if (dueDateEnd) dateRange.$lte = new Date(dueDateEnd);
      query.$and.push({ $or: [{ dueDate: dateRange }, { "subtasks.dueDate": dateRange }] });
    }

    if (!query.$and.length) delete query.$and;

    const tasks = await populateTask(Task.find(query)).sort({ createdAt: -1 });

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

    const task = await populateTask(Task.findById(taskId));

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

    if (isProductionTaskRole(req.user) && leadId) {
      return res.status(403).json({ message: "Production role tasks cannot be linked to leads" });
    }

    const task = await Task.findById(taskId);

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    if (!checkTaskAccess(task, req.user)) {
      return res.status(403).json({ message: "Access denied. You do not have permission to edit this task" });
    }

    const isCreator = referenceId(task.createdBy) === referenceId(req.user);
    const isReceiver = referenceId(task.assignedTo) === referenceId(req.user) && !isCreator;
    if (isReceiver && Object.keys(req.body).some((field) => field !== "status")) {
      return res.status(403).json({ message: "Task receivers can only change the status" });
    }
    const nextStatus = status === undefined ? undefined : String(status).trim().toUpperCase();
    const nextPriority = priority === undefined ? undefined : String(priority).trim().toUpperCase();
    if (nextStatus !== undefined && !TASK_STATUSES.includes(nextStatus)) {
      return res.status(400).json({ message: "Invalid task status" });
    }
    if (nextPriority !== undefined && !TASK_PRIORITIES.includes(nextPriority)) {
      return res.status(400).json({ message: "Invalid task priority" });
    }
    if (title !== undefined && (!String(title).trim() || String(title).trim().length > 180)) {
      return res.status(400).json({ message: "Task title is required and cannot exceed 180 characters" });
    }
    if (description !== undefined && String(description).trim().length > 10000) {
      return res.status(400).json({ message: "Task description cannot exceed 10000 characters" });
    }
    if (dueDate !== undefined && (!dueDate || Number.isNaN(new Date(dueDate).getTime()))) {
      return res.status(400).json({ message: "Task due date is required and must be valid" });
    }
    if (assignedTo !== undefined && !assignedTo) {
      return res.status(400).json({ message: "Task assignee is required" });
    }
    const effectiveAssignee = assignedTo !== undefined ? assignedTo : task.assignedTo;
    if (!effectiveAssignee) return res.status(400).json({ message: "Task assignee is required" });
    // Validate updates if changed
    if (assignedTo && String(assignedTo) !== String(task.assignedTo)) {
      if (!mongoose.Types.ObjectId.isValid(assignedTo)) {
        return res.status(400).json({ message: "Invalid assignee ID" });
      }
      const assignedUser = await User.findOne({ _id: assignedTo, companyId, isActive: true });
      if (!assignedUser) {
        return res.status(400).json({ message: "Assignee must be an active user in your company" });
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

    const originalStatus = task.status;
    const originalAssignee = task.assignedTo;
    let normalizedSubtasks = null;

    // Re-normalize on parent reassignment as well, so every existing subtask
    // follows the new owner in the same atomic save.
    if (subtasks !== undefined || assignedTo !== undefined) {
      const result = normalizeAndValidateSubtasks(subtasks !== undefined ? subtasks : (task.subtasks || []), {
        assignedTo: effectiveAssignee,
        dueDate: dueDate !== undefined ? dueDate : task.dueDate,
        priority: priority !== undefined ? priority : task.priority,
      });
      if (result.error) return res.status(400).json({ message: result.error });
      const assigneeError = await validateActiveAssignees({
        assignedTo: effectiveAssignee,
        subtasks: result.subtasks,
        companyId,
      });
      if (assigneeError) return res.status(400).json({ message: assigneeError });
      normalizedSubtasks = result.subtasks;
    }
    const completionSubtasks = normalizedSubtasks || task.subtasks || [];
    if (nextStatus === "COMPLETED" && completionSubtasks.some((subtask) => !isSubtaskComplete(subtask))) {
      return res.status(409).json({ message: "Complete every subtask before completing the parent task" });
    }

    // Apply updates
    if (title !== undefined) task.title = String(title).trim();
    if (description !== undefined) task.description = String(description).trim();
    if (nextStatus !== undefined) task.status = nextStatus;
    if (nextPriority !== undefined) task.priority = nextPriority;
    if (dueDate !== undefined) task.dueDate = dueDate || null;
    if (assignedTo !== undefined) task.assignedTo = assignedTo || null;
    if (leadId !== undefined) task.leadId = leadId || null;
    if (normalizedSubtasks) task.subtasks = normalizedSubtasks;
    if (tags !== undefined) {
      task.tags = Array.isArray(tags)
        ? tags.map(t => String(t || "").trim()).filter(Boolean)
        : [];
    }

    if (assignedTo !== undefined && referenceId(assignedTo) !== referenceId(originalAssignee)) {
      task.assignmentHistory = [...(task.assignmentHistory || []), { fromUser: originalAssignee || null, toUser: assignedTo || null, actor: req.user._id, at: new Date() }];
    }
    const updatedTask = await task.save();

    const populatedTask = await populateTask(Task.findById(updatedTask._id));

    // Employee changes go to company admins; admin changes go to the assignee.
    const io = req.app.get("io");
    const statusChanged = nextStatus !== undefined && nextStatus !== originalStatus;
    const assignmentChanged = assignedTo !== undefined && referenceId(assignedTo) !== referenceId(originalAssignee);
    const hasDetailChanges = Object.keys(req.body).some(field => field !== "status");
    if (io && (statusChanged || assignmentChanged || hasDetailChanges)) {
      const actorId = referenceId(req.user);
      const event = {
        actorId,
        eventId: `task:updated:${task._id}:${updatedTask.updatedAt || Date.now()}`,
        task: populatedTask,
        message: statusChanged
          ? `${req.user.name} changed "${task.title}" to ${nextStatus.replaceAll("_", " ")}`
          : `Task updated by ${req.user.name}: "${task.title}"`,
      };
      if (req.user.role !== USER_ROLES.ADMIN && statusChanged) {
        io.to(`company:${companyId}:role:${USER_ROLES.ADMIN}`).emit("task:updated", event);
      } else {
        const recipient = referenceId(task.assignedTo);
        if (recipient && recipient !== actorId) {
          io.to(`user:${recipient}`).emit("task:updated", {
            ...event,
            message: assignmentChanged ? `Task assigned to you: "${task.title}" by ${req.user.name}` : event.message,
          });
        }
      }
      const previousRecipient = referenceId(originalAssignee);
      if (assignmentChanged && previousRecipient && previousRecipient !== actorId) {
        io.to(`user:${previousRecipient}`).emit("task:updated", {
          ...event, task: undefined, taskId: task._id,
          message: `Task "${task.title}" has been reassigned`,
        });
      }
    }

    res.status(200).json(populatedTask);
  } catch (error) {
    req.log?.error(error);
    res.status(500).json({ message: "Failed to update task" });
  }
};

const findSubtaskIndex = (task, subtaskId) =>
  (task.subtasks || []).findIndex((subtask) => referenceId(subtask) === String(subtaskId));

exports.addSubtask = async (req, res) => {
  try {
    const { taskId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(taskId)) return res.status(400).json({ message: "Invalid task ID" });
    const task = await Task.findById(taskId);
    if (!task) return res.status(404).json({ message: "Task not found" });
    if (!canManageTask(task, req.user)) return res.status(403).json({ message: "Only the task creator or a task manager can add subtasks" });

    const subtask = normalizeSubtask(req.body, task);
    const result = normalizeAndValidateSubtasks([subtask], task);
    if (result.error) return res.status(400).json({ message: result.error });
    const assigneeError = await validateActiveAssignees({ assignedTo: task.assignedTo, subtasks: result.subtasks, companyId: req.user.companyId });
    if (assigneeError) return res.status(400).json({ message: assigneeError });

    task.subtasks.push(result.subtasks[0]);
    await task.save();
    const populatedTask = await populateTask(Task.findById(task._id));
    emitTaskAssignment({
      req,
      task: populatedTask,
      recipientId: result.subtasks[0].assignedTo,
      message: `You have been assigned a subtask in "${task.title}" by ${req.user.name}`,
    });
    return res.status(201).json(populatedTask);
  } catch (error) {
    if (sendMongooseError(res, error)) return;
    req.log?.error(error);
    return res.status(500).json({ message: "Failed to add subtask" });
  }
};

exports.updateSubtask = async (req, res) => {
  try {
    const { taskId, subtaskId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(taskId) || !mongoose.Types.ObjectId.isValid(subtaskId)) {
      return res.status(400).json({ message: "Invalid task or subtask ID" });
    }
    const task = await Task.findById(taskId);
    if (!task) return res.status(404).json({ message: "Task not found" });
    if (String(task.companyId) !== String(req.user.companyId)) return res.status(403).json({ message: "Access denied" });
    const index = findSubtaskIndex(task, subtaskId);
    if (index < 0) return res.status(404).json({ message: "Subtask not found" });

    const current = task.subtasks[index];
    const mayManage = canManageTask(task, req.user);
    const isReceiver = referenceId(task.assignedTo) === referenceId(req.user);
    if (!mayManage && !isReceiver) return res.status(403).json({ message: "Access denied" });
    const fields = Object.keys(req.body || {});
    if (!mayManage && fields.some((field) => !["status", "isCompleted"].includes(field))) {
      return res.status(403).json({ message: "Subtask receivers can only change the status" });
    }

    const raw = current.toObject ? current.toObject() : { ...current };
    const requestedStatus = req.body.status !== undefined
      ? String(req.body.status).trim().toUpperCase()
      : req.body.isCompleted !== undefined
        ? (req.body.isCompleted ? "COMPLETED" : "TODO")
        : effectiveSubtaskStatus(current);
    const next = normalizeSubtask({ ...raw, ...req.body, status: requestedStatus }, task);
    const result = normalizeAndValidateSubtasks([next], task);
    if (result.error) return res.status(400).json({ message: result.error });
    if (task.status === "COMPLETED" && result.subtasks[0].status !== "COMPLETED") {
      return res.status(409).json({ message: "Reopen the parent task before reopening a subtask" });
    }
    const assigneeError = await validateActiveAssignees({ assignedTo: task.assignedTo, subtasks: result.subtasks, companyId: req.user.companyId });
    if (assigneeError) return res.status(400).json({ message: assigneeError });

    if (current.set) current.set(result.subtasks[0]);
    else task.subtasks[index] = { ...current, ...result.subtasks[0] };
    await task.save();
    const populatedTask = await populateTask(Task.findById(task._id));
    return res.status(200).json(populatedTask);
  } catch (error) {
    if (sendMongooseError(res, error)) return;
    req.log?.error(error);
    return res.status(500).json({ message: "Failed to update subtask" });
  }
};

exports.deleteSubtask = async (req, res) => {
  try {
    const { taskId, subtaskId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(taskId) || !mongoose.Types.ObjectId.isValid(subtaskId)) {
      return res.status(400).json({ message: "Invalid task or subtask ID" });
    }
    const task = await Task.findById(taskId);
    if (!task) return res.status(404).json({ message: "Task not found" });
    if (!canManageTask(task, req.user)) return res.status(403).json({ message: "Only the task creator or a task manager can remove subtasks" });
    const index = findSubtaskIndex(task, subtaskId);
    if (index < 0) return res.status(404).json({ message: "Subtask not found" });
    task.subtasks.splice(index, 1);
    await task.save();
    const populatedTask = await populateTask(Task.findById(task._id));
    return res.status(200).json(populatedTask);
  } catch (error) {
    req.log?.error(error);
    return res.status(500).json({ message: "Failed to remove subtask" });
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
    const isAdmin = req.user.role === USER_ROLES.ADMIN;
    const isReceiver = referenceId(task.assignedTo) === referenceId(req.user) && !isCreator;

    if (String(task.companyId) !== String(req.user.companyId) || isReceiver || (!isAdmin && !isCreator)) {
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
    res.status(500).json({ message: "Failed to delete task" });
  }
};

// Get stats count for tasks (Pending, Completed, Overdue, Priority breakouts)
exports.getTaskStats = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const query = { companyId, $and: [] };
    if (req.query.scope === "assigned") query.$and.push(
      { $or: [{ assignedTo: req.user._id }, { "subtasks.assignedTo": req.user._id }] },
      { createdBy: { $ne: req.user._id } },
    );
    if (req.query.scope === "mine") query.createdBy = req.user._id;
    if (req.query.assignedTo) {
      if (!mongoose.Types.ObjectId.isValid(req.query.assignedTo)) return res.status(400).json({ message: "Invalid assignee ID" });
      const assigneeId = new mongoose.Types.ObjectId(req.query.assignedTo);
      query.$and.push({ $or: [{ assignedTo: assigneeId }, { "subtasks.assignedTo": assigneeId }] });
    }

    // Apply role filter (Executives only see their tasks)
    if (req.user.role !== USER_ROLES.ADMIN && 
        req.user.role !== USER_ROLES.MANAGER) {
      query.$and.push({
        $or: [
          { assignedTo: req.user._id },
          { createdBy: req.user._id },
          { "subtasks.assignedTo": req.user._id },
        ],
      });
    }
    if (!query.$and.length) delete query.$and;

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
                $or: [
                  { status: { $ne: "COMPLETED" }, dueDate: { $ne: null, $lt: getOverdueCutoff(now) } },
                  { subtasks: { $elemMatch: { status: { $ne: "COMPLETED" }, isCompleted: { $ne: true }, dueDate: { $ne: null, $lt: getOverdueCutoff(now) } } } },
                ],
              }
            },
            { $count: "count" }
          ],
          subtaskCounts: [
            { $unwind: "$subtasks" },
            {
              $group: {
                _id: {
                  $cond: [
                    { $eq: ["$subtasks.isCompleted", true] },
                    "COMPLETED",
                    { $ifNull: ["$subtasks.status", "TODO"] },
                  ],
                },
                count: { $sum: 1 },
              },
            },
          ],
          subtaskOverdueCount: [
            { $unwind: "$subtasks" },
            {
              $match: {
                "subtasks.status": { $ne: "COMPLETED" },
                "subtasks.isCompleted": { $ne: true },
                "subtasks.dueDate": { $ne: null, $lt: getOverdueCutoff(now) },
              },
            },
            { $count: "count" },
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
      HIGH: 0,
      subtaskTotal: 0,
      subtaskCompleted: 0,
      subtaskPending: 0,
      subtaskOverdue: 0,
      workItemsTotal: 0,
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
      (result.subtaskCounts || []).forEach((item) => {
        formattedStats.subtaskTotal += Number(item.count || 0);
        if (item._id === "COMPLETED") formattedStats.subtaskCompleted += Number(item.count || 0);
      });
      formattedStats.subtaskPending = formattedStats.subtaskTotal - formattedStats.subtaskCompleted;
      formattedStats.subtaskOverdue = Number(result.subtaskOverdueCount?.[0]?.count || 0);
      formattedStats.workItemsTotal = formattedStats.total + formattedStats.subtaskTotal;
    }

    res.status(200).json(formattedStats);
  } catch (error) {
    req.log?.error(error);
    res.status(500).json({ message: "Failed to compile task statistics", error: error.message });
  }
};

// Get task stats grouped by assignee (roster view) - Admin/Manager only
exports.getTaskStatsByUser = async (req, res) => {
  try {
    if (req.user.role !== USER_ROLES.ADMIN && req.user.role !== USER_ROLES.MANAGER) {
      return res.status(403).json({ message: "Access denied" });
    }

    const companyId = req.user.companyId;
    const now = new Date();

    const rows = await Task.aggregate([
      { $match: { companyId } },
      {
        $project: {
          workItems: {
            $concatArrays: [
              [{ assignedTo: "$assignedTo", status: "$status", dueDate: "$dueDate" }],
              {
                $map: {
                  input: { $ifNull: ["$subtasks", []] },
                  as: "subtask",
                  in: {
                    assignedTo: { $ifNull: ["$$subtask.assignedTo", "$assignedTo"] },
                    status: {
                      $cond: [
                        { $eq: ["$$subtask.isCompleted", true] },
                        "COMPLETED",
                        { $ifNull: ["$$subtask.status", "TODO"] },
                      ],
                    },
                    dueDate: "$$subtask.dueDate",
                  },
                },
              },
            ],
          },
        },
      },
      { $unwind: "$workItems" },
      { $match: { "workItems.assignedTo": { $ne: null } } },
      {
        $group: {
          _id: "$workItems.assignedTo",
          total: { $sum: 1 },
          TODO: { $sum: { $cond: [{ $eq: ["$workItems.status", "TODO"] }, 1, 0] } },
          IN_PROGRESS: { $sum: { $cond: [{ $eq: ["$workItems.status", "IN_PROGRESS"] }, 1, 0] } },
          COMPLETED: { $sum: { $cond: [{ $eq: ["$workItems.status", "COMPLETED"] }, 1, 0] } },
          BACKLOG: { $sum: { $cond: [{ $eq: ["$workItems.status", "BACKLOG"] }, 1, 0] } },
          overdue: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ["$workItems.status", "COMPLETED"] },
                    { $eq: [{ $type: "$workItems.dueDate" }, "date"] },
                    { $lt: ["$workItems.dueDate", getOverdueCutoff(now)] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      }
    ]);

    const byUser = {};
    rows.forEach((row) => {
      byUser[String(row._id)] = {
        total: row.total,
        TODO: row.TODO,
        IN_PROGRESS: row.IN_PROGRESS,
        COMPLETED: row.COMPLETED,
        BACKLOG: row.BACKLOG,
        pending: row.total - row.COMPLETED,
        overdue: row.overdue
      };
    });

    res.status(200).json(byUser);
  } catch (error) {
    req.log?.error(error);
    res.status(500).json({ message: "Failed to compile per-user task statistics", error: error.message });
  }
};

// A minimal company directory for task assignment, independent of team hierarchy.
exports.getAssignees = async (req, res) => {
  try {
    const users = await User.find({ companyId: req.user.companyId, isActive: true }).select("_id name role isActive profileImageUrl").sort({ name: 1 }).lean();
    res.json({ users });
  } catch (error) { req.log?.error(error); res.status(500).json({ message: "Failed to load assignees" }); }
};

module.exports.getOverdueCutoff = getOverdueCutoff;
