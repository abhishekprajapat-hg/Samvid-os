const TASK_STATUSES = Object.freeze(["TODO", "IN_PROGRESS", "COMPLETED", "BACKLOG"]);
const TASK_PRIORITIES = Object.freeze(["LOW", "MEDIUM", "HIGH"]);

const referenceId = (value) => String(value?._id || value || "").trim();

const effectiveSubtaskStatus = (subtask = {}) => {
  const status = String(subtask.status || "").trim().toUpperCase();
  if (TASK_STATUSES.includes(status)) return status;
  return subtask.isCompleted ? "COMPLETED" : "TODO";
};

const isSubtaskComplete = (subtask = {}) => effectiveSubtaskStatus(subtask) === "COMPLETED";

const normalizeSubtask = (subtask = {}, parent = {}) => {
  const status = effectiveSubtaskStatus(subtask);
  const priority = String(subtask.priority || parent.priority || "MEDIUM").trim().toUpperCase();
  // Subtasks intentionally inherit the parent owner. Keeping this rule in the
  // normalizer prevents API clients from creating split ownership by sending a
  // different subtask assignee.
  const assignedTo = referenceId(parent.assignedTo) || referenceId(subtask.assignedTo) || null;
  return {
    ...(subtask._id ? { _id: subtask._id } : {}),
    title: String(subtask.title || "").trim(),
    description: String(subtask.description || "").trim(),
    assignedTo,
    dueDate: subtask.dueDate || parent.dueDate || null,
    status,
    priority: TASK_PRIORITIES.includes(priority) ? priority : "MEDIUM",
    isCompleted: status === "COMPLETED",
  };
};

const validateSubtask = (subtask, index = 0) => {
  const label = `Subtask ${index + 1}`;
  if (!subtask.title) return `${label} title is required`;
  if (subtask.title.length > 180) return `${label} title cannot exceed 180 characters`;
  if (subtask.description.length > 5000) return `${label} description cannot exceed 5000 characters`;
  if (!TASK_STATUSES.includes(subtask.status)) return `${label} has an invalid status`;
  if (!TASK_PRIORITIES.includes(subtask.priority)) return `${label} has an invalid priority`;
  if (!subtask.assignedTo) return `${label} assignee is required`;
  if (!subtask.dueDate) return `${label} due date is required`;
  if (Number.isNaN(new Date(subtask.dueDate).getTime())) return `${label} has an invalid due date`;
  return "";
};

const normalizeAndValidateSubtasks = (subtasks, parent = {}, { allowLegacyMissingFields = false } = {}) => {
  if (!Array.isArray(subtasks)) return { subtasks: [], error: "Subtasks must be an array" };
  const normalized = subtasks.map((subtask) => normalizeSubtask(subtask, parent));
  for (let index = 0; index < normalized.length; index += 1) {
    const subtask = normalized[index];
    if (allowLegacyMissingFields && subtask.title && (!subtask.assignedTo || !subtask.dueDate)) continue;
    const error = validateSubtask(subtask, index);
    if (error) return { subtasks: normalized, error };
  }
  return { subtasks: normalized, error: "" };
};

module.exports = {
  TASK_PRIORITIES,
  TASK_STATUSES,
  effectiveSubtaskStatus,
  isSubtaskComplete,
  normalizeAndValidateSubtasks,
  normalizeSubtask,
  referenceId,
  validateSubtask,
};
