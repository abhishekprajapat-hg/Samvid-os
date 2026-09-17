import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import "./tasks-reference.css";
import SubtaskDetailPanel from "./SubtaskDetailPanel";
import { useNavigate } from "react-router-dom";
import { motion as Motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Edit2,
  Trash2,
  Check,
  CheckSquare,
  ListTodo,
  Calendar,
  User,
  UserPlus,
  Link as LinkIcon,
  AlertCircle,
  Clock,
  SlidersHorizontal,
  X,
  Search,
  ArrowRight,
  ChevronRight,
  KanbanSquare,
  List,
  ArrowLeft,
  Users,
  Flag,
  Tag,
  AlignLeft,
  MoreVertical,
  Lightbulb,
  FileText,
  BarChart3,
  CheckCircle2
} from "lucide-react";
import {
  getTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
  getTaskStats,
  getTaskStatsByUser,
  getTaskAssignees
} from "../../services/taskService";
import { getUsers } from "../../services/userService";
import { getAllLeads } from "../../services/leadService";
import ToastNotice from "../../components/ui/ToastNotice";

const STATUS_COLUMNS = [
  { id: "BACKLOG", label: "Backlog", color: "text-slate-400 border-slate-400 bg-slate-400/5" },
  { id: "TODO", label: "To Do", color: "text-sky-400 border-sky-400 bg-sky-400/5" },
  { id: "IN_PROGRESS", label: "In Progress", color: "text-amber-400 border-amber-400 bg-amber-400/5" },
  { id: "COMPLETED", label: "Completed", color: "text-emerald-400 border-emerald-400 bg-emerald-400/5" }
];

// Workload buckets shown on the Team Tasks roster. Derived from each member's open
// task load because the API exposes no live presence signal.
const WORKLOAD_STATUSES = [
  { id: "busy", label: "Busy", dot: "bg-rose-500", bar: "bg-rose-500", text: "text-rose-500" },
  { id: "balanced", label: "Balanced", dot: "bg-blue-500", bar: "bg-blue-500", text: "text-blue-500" },
  { id: "available", label: "Available", dot: "bg-emerald-500", bar: "bg-emerald-500", text: "text-emerald-500" },
  { id: "offline", label: "Offline", dot: "bg-slate-400", bar: "bg-slate-400", text: "text-slate-400" }
];

const workloadStatusFor = (stat) => {
  const total = stat?.total || 0;
  if (total === 0) return "offline";
  const open = total - (stat.COMPLETED || 0);
  if ((stat.overdue || 0) > 0 || open >= 5) return "busy";
  if (open >= 3) return "balanced";
  return "available";
};

const STATUS_DOTS = {
  BACKLOG: "bg-slate-400",
  TODO: "bg-slate-400",
  IN_PROGRESS: "bg-sky-500",
  COMPLETED: "bg-emerald-500"
};

const PRIORITY_DOTS = { LOW: "bg-blue-500", MEDIUM: "bg-amber-500", HIGH: "bg-rose-500" };

const ROSTER_SORTS = [
  { id: "overdue", label: "Most overdue" },
  { id: "tasks", label: "Most tasks" },
  { id: "progress", label: "Least progress" },
  { id: "name", label: "Name (A-Z)" }
];

const AVATAR_COLORS = [
  "bg-sky-500/15 text-sky-500",
  "bg-emerald-500/15 text-emerald-500",
  "bg-amber-500/15 text-amber-500",
  "bg-rose-500/15 text-rose-500",
  "bg-violet-500/15 text-violet-500",
  "bg-cyan-500/15 text-cyan-500",
  "bg-fuchsia-500/15 text-fuchsia-500",
  "bg-orange-500/15 text-orange-500",
];

const PRIORITIES = [
  { value: "LOW", label: "Low", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  { value: "MEDIUM", label: "Medium", color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  { value: "HIGH", label: "High", color: "bg-rose-500/10 text-rose-400 border-rose-500/20" }
];

export default function TaskManager({ theme = "light" }) {
  const isDark = theme === "dark";
  const navigate = useNavigate();
  const currentRole = String(localStorage.getItem("role") || "").trim().toUpperCase();
  const isProductionExecutive = ["PRODUCTION_EXECUTIVE", "COMMUNITY_MANAGER"].includes(currentRole);
  const canViewProfiles = ["ADMIN", "MANAGER"].includes(currentRole);
  const canViewRoster = ["ADMIN", "MANAGER"].includes(currentRole);
  const currentUserId = (() => {
    try { const user = JSON.parse(localStorage.getItem("user") || "{}"); return String(user.id || user._id || ""); }
    catch { return ""; }
  })();
  const currentUserName = (() => {
    try { const user = JSON.parse(localStorage.getItem("user") || "{}"); return String(user.name || "").trim(); }
    catch { return ""; }
  })();
  const taskReferenceId = (value) => String(value?._id || value || "");
  const isTaskCreator = (task) => Boolean(currentUserId) && taskReferenceId(task?.createdBy) === currentUserId;
  const isTaskReceiver = (task) => Boolean(currentUserId) && taskReferenceId(task?.assignedTo) === currentUserId && !isTaskCreator(task);
  const canEditTask = (task) => Boolean(currentUserId) && (isTaskCreator(task) || (!isTaskReceiver(task) && canViewRoster));
  const canDeleteTask = (task) => Boolean(currentUserId) && (isTaskCreator(task) || (!isTaskReceiver(task) && currentRole === "ADMIN"));

  const handleOpenAssigneeProfile = (e, assignee) => {
    e.stopPropagation();
    const assigneeId = assignee?._id || assignee;
    if (!assigneeId || !canViewProfiles) return;
    navigate(`/admin/users/${assigneeId}`);
  };

  // State
  const [tasks, setTasks] = useState([]);
  const [stats, setStats] = useState({
    TODO: 0, IN_PROGRESS: 0, COMPLETED: 0, BACKLOG: 0,
    total: 0, pending: 0, overdue: 0, LOW: 0, MEDIUM: 0, HIGH: 0
  });
  const [teamUsers, setTeamUsers] = useState([]);
  const [leads, setLeads] = useState([]);
  const [viewMode, setViewMode] = useState("list"); // kanban or list
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Filters state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [taskScope, setTaskScope] = useState("all");
  const [leadFilter, setLeadFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");

  // Grouping & Sorting
  const [groupBy, setGroupBy] = useState("status"); // status, priority, assignee
  const [sortBy, setSortBy] = useState("createdNewest"); // createdNewest, dueDate, priority, title

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    status: "TODO",
    priority: "MEDIUM",
    dueDate: "",
    assignedTo: "",
    leadId: "",
    subtasks: [],
    tags: []
  });
  const [submitting, setSubmitting] = useState(false);

  // Task Details View Modal
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [detailsTask, setDetailsTask] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Subtask & Tag inputs inside form
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [formSubtaskEditIndex, setFormSubtaskEditIndex] = useState(null);
  const [formSubtaskEditValue, setFormSubtaskEditValue] = useState("");
  const [newTagInput, setNewTagInput] = useState("");

  // Drag states
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [activeDragCol, setActiveDragCol] = useState(null);

  // Roster (team) view - Admins/Managers land here first, then drill into a user's board
  const [viewLevel, setViewLevel] = useState(canViewRoster ? "roster" : "board");
  const [selectedUserObj, setSelectedUserObj] = useState(null);
  const [userStatsMap, setUserStatsMap] = useState({});
  const [rosterLoading, setRosterLoading] = useState(false);
  const [rosterSearch, setRosterSearch] = useState("");
  const [rosterRoleFilter, setRosterRoleFilter] = useState("");
  const [rosterWorkloadFilter, setRosterWorkloadFilter] = useState("");
  const [rosterSort, setRosterSort] = useState("overdue");
  const [showRosterFilters, setShowRosterFilters] = useState(true);
  const [openMemberMenuId, setOpenMemberMenuId] = useState(null);

  // Google Tasks-style flat list: quick add, inline expand, collapsible completed section
  const [quickAddTitle, setQuickAddTitle] = useState("");
  const [quickAddSubmitting, setQuickAddSubmitting] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [mobileTaskDetailsOpen, setMobileTaskDetailsOpen] = useState(false);
  const [workloadExpanded, setWorkloadExpanded] = useState(true);
  const [openTaskMenuId, setOpenTaskMenuId] = useState(null);
  const [inlineSubtaskInput, setInlineSubtaskInput] = useState("");
  // Subtask being renamed on a saved task, keyed as `${taskId}:${index}`
  const [subtaskEditKey, setSubtaskEditKey] = useState(null);
  const [subtaskEditValue, setSubtaskEditValue] = useState("");
  // Subtask whose detail panel is open, keyed as `${scope}:${index}` where the
  // scope is a task id, or "form" for a task still being written.
  const [subtaskDetailKey, setSubtaskDetailKey] = useState(null);

  // Fetch initial data
  const fetchSequence = useRef(0);
  const fetchData = useCallback(async ({ silent = false } = {}) => {
    const sequence = ++fetchSequence.current;
    if (!silent) setLoading(true);
    setError("");
    try {
      const filters = {};
      filters.scope = taskScope;
      if (statusFilter) filters.status = statusFilter;
      if (priorityFilter) filters.priority = priorityFilter;
      if (assigneeFilter) filters.assignedTo = assigneeFilter;
      if (!isProductionExecutive && leadFilter) filters.leadId = leadFilter;
      if (searchQuery) filters.search = searchQuery;
      if (tagFilter) filters.tag = tagFilter;

      const [taskResult, statsResult, usersResult, leadsResult] = await Promise.allSettled([
        getTasks(filters),
        getTaskStats({ scope: taskScope, assignedTo: assigneeFilter }),
        getTaskAssignees(),
        isProductionExecutive ? Promise.resolve([]) : getAllLeads()
      ]);
      if (sequence !== fetchSequence.current) return;
      if (taskResult.status === "rejected") throw taskResult.reason;
      const tasksData = taskResult.value;
      const statsData = statsResult.status === "fulfilled" ? statsResult.value : null;
      const usersData = usersResult.status === "fulfilled" ? usersResult.value : null;
      const leadsData = leadsResult.status === "fulfilled" ? leadsResult.value : null;

      setTasks(tasksData);
      if (statsData) setStats(statsData);
      if (usersData?.users) setTeamUsers(usersData.users.filter(u => u.isActive));
      if (leadsData) setLeads(leadsData);
    } catch (err) {
      console.error(err);
      if (sequence === fetchSequence.current && !silent) setError("Failed to retrieve task details");
    } finally {
      if (sequence === fetchSequence.current && !silent) setLoading(false);
    }
  }, [statusFilter, priorityFilter, assigneeFilter, leadFilter, searchQuery, tagFilter, isProductionExecutive, taskScope]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Roster data: team members + per-user task counts, refetched whenever the roster is shown
  useEffect(() => {
    if (viewLevel !== "roster" || !canViewRoster) return;
    let cancelled = false;
    (async () => {
      setRosterLoading(true);
      try {
        const [usersData, statsByUser] = await Promise.all([getUsers(), getTaskStatsByUser()]);
        if (cancelled) return;
        if (usersData?.users) setTeamUsers(usersData.users.filter(u => u.isActive));
        setUserStatsMap(statsByUser || {});
      } catch (err) {
        console.error(err);
        if (!cancelled) setError("Failed to load team roster");
      } finally {
        if (!cancelled) setRosterLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [viewLevel, canViewRoster]);

  const handleSelectRosterUser = (user) => {
    setTaskScope("all");
    setSelectedUserObj(user);
    setAssigneeFilter(user._id);
    setViewLevel("board");
  };

  const handleViewAllTasks = () => {
    setTaskScope("all");
    setSelectedUserObj(null);
    setAssigneeFilter("");
    setViewLevel("board");
  };

  // Roster card menu: start a new task with this member pre-selected as the assignee
  const handleAssignTaskToMember = (user) => {
    setOpenMemberMenuId(null);
    setEditingTask(null);
    setFormData({
      title: "",
      description: "",
      status: "TODO",
      priority: "MEDIUM",
      dueDate: "",
      assignedTo: user._id,
      leadId: "",
      subtasks: [],
      tags: []
    });
    setNewSubtaskTitle("");
    handleCancelFormSubtaskEdit();
    setNewTagInput("");
    setIsModalOpen(true);
  };

  const handleBackToRoster = () => {
    setViewLevel("roster");
    setSelectedUserObj(null);
    setAssigneeFilter("");
  };

  // Flash Alerts auto-dismiss
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(""), 4000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(""), 6000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Form handling
  const handleOpenCreateModal = () => {
    setEditingTask(null);
    setFormData({
      title: "",
      description: "",
      status: "TODO",
      priority: "MEDIUM",
      dueDate: "",
      assignedTo: selectedUserObj?._id || "",
      leadId: "",
      subtasks: [],
      tags: []
    });
    setNewSubtaskTitle("");
    handleCancelFormSubtaskEdit();
    setNewTagInput("");
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (task) => {
    if (!canEditTask(task)) return;
    setEditingTask(task);
    setFormData({
      title: task.title || "",
      description: task.description || "",
      status: task.status || "TODO",
      priority: task.priority || "MEDIUM",
      dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split("T")[0] : "",
      assignedTo: task.assignedTo?._id || task.assignedTo || "",
      leadId: task.leadId?._id || task.leadId || "",
      subtasks: task.subtasks || [],
      tags: task.tags || []
    });
    setNewSubtaskTitle("");
    handleCancelFormSubtaskEdit();
    setNewTagInput("");
    setIsModalOpen(true);
  };

  const handleOpenDetails = async (task) => {
    setIsDetailsOpen(true);
    setDetailsTask(task);
    setDetailsLoading(true);
    try {
      const fullTask = await getTaskById(task._id);
      if (fullTask) setDetailsTask(fullTask);
    } catch (err) {
      console.error(err);
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleCloseDetails = () => {
    setIsDetailsOpen(false);
    setDetailsTask(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      setError("Title is required");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const payload = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        status: formData.status,
        priority: formData.priority,
        dueDate: formData.dueDate || null,
        assignedTo: formData.assignedTo || null,
        leadId: isProductionExecutive ? null : formData.leadId || null,
        subtasks: formData.subtasks,
        tags: formData.tags
      };

      if (editingTask) {
        const updated = await updateTask(editingTask._id, payload);
        if (updated) {
          setSuccess("Task updated successfully");
          setIsModalOpen(false);
          fetchData();
        }
      } else {
        const created = await createTask(payload);
        if (created) {
          const assigneeName = assignableUsers.find(u => String(u._id) === String(formData.assignedTo))?.name;
          setSuccess(assigneeName ? `Task created and assigned to ${assigneeName}` : "Task created successfully");
          setIsModalOpen(false);
          fetchData();
        }
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Failed to save task");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm("Are you sure you want to delete this task?")) return;

    try {
      await deleteTask(taskId);
      setSuccess("Task deleted successfully");
      fetchData();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Failed to delete task");
    }
  };

  const handleUpdateStatus = async (taskId, newStatus) => {
    const previousTasks = tasks;
    const previousDetails = detailsTask;

    // Optimistic: paint the new status right away, no spinner, no refetch flash
    setTasks(prev => prev.map(t => (t._id === taskId ? { ...t, status: newStatus } : t)));
    setDetailsTask(prev => (prev?._id === taskId ? { ...prev, status: newStatus } : prev));

    try {
      const updated = await updateTask(taskId, { status: newStatus });
      if (updated) {
        setSuccess("Status updated");
        setTasks(prev => prev.map(t => (t._id === taskId ? updated : t)));
        setDetailsTask(prev => (prev?._id === taskId ? updated : prev));
      }
      fetchData({ silent: true });
    } catch (err) {
      console.error(err);
      setTasks(previousTasks);
      setDetailsTask(previousDetails);
      setError("Failed to update status");
    }
  };

  // Google Tasks-style quick add: single-line title, sensible defaults, no modal
  const handleQuickAddTask = async (e) => {
    e.preventDefault();
    const title = quickAddTitle.trim();
    if (!title) return;

    setQuickAddSubmitting(true);
    try {
      const created = await createTask({
        title,
        status: "TODO",
        priority: "MEDIUM",
        assignedTo: selectedUserObj?._id || (() => {
          try { const user = JSON.parse(localStorage.getItem("user") || "{}"); return user.id || user._id || null; }
          catch { return null; }
        })(),
        leadId: null
      });
      if (created) {
        setQuickAddTitle("");
        fetchData();
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Failed to add task");
    } finally {
      setQuickAddSubmitting(false);
    }
  };

  const handleToggleComplete = async (task) => {
    const nextStatus = task.status === "COMPLETED" ? "TODO" : "COMPLETED";
    await handleUpdateStatus(task._id, nextStatus);
  };

  const handleInlineUpdate = async (taskId, patch) => {
    if (!canEditTask(tasks.find(task => task._id === taskId))) return;
    const previousTasks = tasks;

    // assignedTo travels as an id but renders as a populated user, so swap it locally
    const localPatch = { ...patch };
    if ("assignedTo" in patch) {
      const assignee = teamUsers.find(u => String(u._id) === String(patch.assignedTo));
      localPatch.assignedTo = assignee
        ? { _id: assignee._id, name: assignee.name, role: assignee.role, profileImageUrl: assignee.profileImageUrl }
        : null;
    }
    setTasks(prev => prev.map(t => (t._id === taskId ? { ...t, ...localPatch } : t)));

    try {
      await updateTask(taskId, patch);
      fetchData({ silent: true });
    } catch (err) {
      console.error(err);
      setTasks(previousTasks);
      setError("Failed to update task");
    }
  };

  const handleInlineAddSubtask = (task) => {
    const title = inlineSubtaskInput.trim();
    if (!title) return;
    handleInlineUpdate(task._id, { subtasks: [...(task.subtasks || []), { title, isCompleted: false }] });
    setInlineSubtaskInput("");
  };

  const handleInlineToggleSubtask = (task, index) => {
    const updatedSubtasks = (task.subtasks || []).map((s, i) => (i === index ? { ...s, isCompleted: !s.isCompleted } : s));
    persistSubtasks(task, updatedSubtasks);
  };

  // Subtask edit / delete on an already saved task (expanded row + details modal)
  const persistSubtasks = async (task, nextSubtasks) => {
    if (!task || !canEditTask(task)) return;
    const previousTasks = tasks;
    const previousDetails = detailsTask;

    setTasks(prev => prev.map(t => (t._id === task._id ? { ...t, subtasks: nextSubtasks } : t)));
    setDetailsTask(prev => (prev?._id === task._id ? { ...prev, subtasks: nextSubtasks } : prev));

    try {
      const updated = await updateTask(task._id, { subtasks: nextSubtasks });
      if (updated) {
        setTasks(prev => prev.map(t => (t._id === task._id ? updated : t)));
        setDetailsTask(prev => (prev?._id === task._id ? updated : prev));
      }
      fetchData({ silent: true });
    } catch (err) {
      console.error(err);
      setTasks(previousTasks);
      setDetailsTask(previousDetails);
      setError(err.response?.data?.message || "Failed to update checklist");
    }
  };

  const handleStartSubtaskEdit = (task, index, title) => {
    if (!canEditTask(task)) return;
    setSubtaskEditKey(`${task._id}:${index}`);
    setSubtaskEditValue(title || "");
  };

  const handleCancelSubtaskEdit = () => {
    setSubtaskEditKey(null);
    setSubtaskEditValue("");
  };

  const handleSaveSubtaskEdit = async (task, index) => {
    const title = subtaskEditValue.trim();
    if (!title) return;
    const nextSubtasks = (task.subtasks || []).map((s, i) => (i === index ? { ...s, title } : s));
    handleCancelSubtaskEdit();
    await persistSubtasks(task, nextSubtasks);
  };

  const handleDeleteSubtask = async (task, index) => {
    if (!canEditTask(task)) return;
    if (!window.confirm("Delete this subtask?")) return;
    const nextSubtasks = (task.subtasks || []).filter((_, i) => i !== index);
    handleCancelSubtaskEdit();
    setSubtaskDetailKey(null);
    await persistSubtasks(task, nextSubtasks);
  };

  // Detail panel plumbing. A saved task writes through to the API; a task still
  // being composed only touches form state.
  const toggleSubtaskDetail = (scope, index) =>
    setSubtaskDetailKey(prev => (prev === `${scope}:${index}` ? null : `${scope}:${index}`));

  const isSubtaskDetailOpen = (scope, index) => subtaskDetailKey === `${scope}:${index}`;

  // The open subtask for a scope, or null. Guards against a stale key left
  // behind when the list shrinks or another task is selected.
  const openSubtaskIndex = (scope, subtasks = []) => {
    if (!String(subtaskDetailKey || "").startsWith(`${scope}:`)) return null;
    const index = Number(String(subtaskDetailKey).slice(String(scope).length + 1));
    return Number.isInteger(index) && index >= 0 && index < subtasks.length ? index : null;
  };

  // A one-glance hint that a subtask carries more than its title.
  const subtaskMeta = (subtask) => {
    const parts = [];
    if (subtask?.description) parts.push("note");
    if (subtask?.dueDate) parts.push(new Date(subtask.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" }));
    return parts.join(" · ");
  };

  const patchSubtask = (task, index, patch) => {
    if (!canEditTask(task)) return;
    persistSubtasks(task, (task.subtasks || []).map((s, i) => (i === index ? { ...s, ...patch } : s)));
  };

  const patchFormSubtask = (index, patch) =>
    setFormData(prev => ({
      ...prev,
      subtasks: (prev.subtasks || []).map((s, i) => (i === index ? { ...s, ...patch } : s)),
    }));

  // Drag and Drop (Native HTML5)
  const handleDragStart = (e, taskId) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.setData("text/plain", taskId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e, status) => {
    e.preventDefault();
    if (activeDragCol !== status) {
      setActiveDragCol(status);
    }
  };

  const handleDragLeave = () => {
    setActiveDragCol(null);
  };

  const handleDrop = async (e, columnValue) => {
    e.preventDefault();
    setActiveDragCol(null);
    const taskId = e.dataTransfer.getData("text/plain") || draggedTaskId;
    if (!taskId) return;

    const taskIndex = tasks.findIndex(t => String(t._id) === String(taskId));
    if (taskIndex === -1) return;
    if (groupBy !== "status" && !canEditTask(tasks[taskIndex])) return;

    let updatedField = {};
    let hasChanged = false;

    if (groupBy === "status") {
      if (tasks[taskIndex].status !== columnValue) {
        updatedField = { status: columnValue };
        hasChanged = true;
      }
    } else if (groupBy === "priority") {
      if (tasks[taskIndex].priority !== columnValue) {
        updatedField = { priority: columnValue };
        hasChanged = true;
      }
    } else if (groupBy === "assignee") {
      const newAssigneeId = columnValue === "unassigned" ? null : columnValue;
      const currentAssigneeId = tasks[taskIndex].assignedTo?._id || tasks[taskIndex].assignedTo || null;
      if (String(currentAssigneeId) !== String(newAssigneeId)) {
        updatedField = { assignedTo: newAssigneeId };
        hasChanged = true;
      }
    }

    if (!hasChanged) return;

    const previousTasks = [...tasks];
    const updatedTasks = [...tasks];
    let updatedTaskValue = { ...updatedTasks[taskIndex], ...updatedField };
    if (groupBy === "assignee") {
      if (columnValue === "unassigned") {
        updatedTaskValue.assignedTo = null;
      } else {
        const userObj = teamUsers.find(u => String(u._id) === String(columnValue));
        updatedTaskValue.assignedTo = userObj ? { _id: userObj._id, name: userObj.name, role: userObj.role } : null;
      }
    }
    updatedTasks[taskIndex] = updatedTaskValue;
    setTasks(updatedTasks);

    try {
      await updateTask(taskId, updatedField);
      setSuccess("Task updated successfully");
      const statsData = await getTaskStats({ scope: taskScope, assignedTo: assigneeFilter });
      if (statsData) setStats(statsData);
      fetchData();
    } catch (err) {
      console.error(err);
      setTasks(previousTasks); // roll back
      setError("Failed to update task");
    } finally {
      setDraggedTaskId(null);
    }
  };

  // Subtasks checklist modifications in form
  const handleAddSubtask = () => {
    if (!newSubtaskTitle.trim()) return;
    setFormData(prev => ({
      ...prev,
      subtasks: [...(prev.subtasks || []), { title: newSubtaskTitle.trim(), isCompleted: false, description: "", dueDate: null }]
    }));
    setNewSubtaskTitle("");
  };

  const handleRemoveSubtask = (index) => {
    setFormData(prev => ({
      ...prev,
      subtasks: (prev.subtasks || []).filter((_, i) => i !== index)
    }));
    handleCancelFormSubtaskEdit();
    // Indexes shift on removal, so the open panel no longer points at the same subtask.
    setSubtaskDetailKey(null);
  };

  const handleStartFormSubtaskEdit = (index, title) => {
    setFormSubtaskEditIndex(index);
    setFormSubtaskEditValue(title || "");
  };

  const handleCancelFormSubtaskEdit = () => {
    setFormSubtaskEditIndex(null);
    setFormSubtaskEditValue("");
  };

  const handleSaveFormSubtaskEdit = () => {
    const title = formSubtaskEditValue.trim();
    if (!title || formSubtaskEditIndex === null) return;
    setFormData(prev => ({
      ...prev,
      subtasks: (prev.subtasks || []).map((s, i) => (i === formSubtaskEditIndex ? { ...s, title } : s))
    }));
    handleCancelFormSubtaskEdit();
  };

  const handleToggleSubtaskInForm = (index) => {
    setFormData(prev => {
      const updatedSubtasks = [...(prev.subtasks || [])];
      if (updatedSubtasks[index]) {
        updatedSubtasks[index] = {
          ...updatedSubtasks[index],
          isCompleted: !updatedSubtasks[index].isCompleted
        };
      }
      return { ...prev, subtasks: updatedSubtasks };
    });
  };

  // Tags management in form
  const handleToggleTag = (tag) => {
    setFormData(prev => {
      const currentTags = prev.tags || [];
      const exists = currentTags.includes(tag);
      if (exists) {
        return { ...prev, tags: currentTags.filter(t => t !== tag) };
      } else {
        return { ...prev, tags: [...currentTags, tag] };
      }
    });
  };

  const handleAddCustomTag = () => {
    const cleanTag = newTagInput.trim();
    if (!cleanTag) return;
    setFormData(prev => {
      const currentTags = prev.tags || [];
      if (currentTags.includes(cleanTag)) return prev;
      return { ...prev, tags: [...currentTags, cleanTag] };
    });
    setNewTagInput("");
  };

  // Sorting & Grouping computing helpers
  const sortedTasks = useMemo(() => {
    let result = [...tasks];
    if (sortBy === "dueDate") {
      result.sort((a, b) => {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate) - new Date(b.dueDate);
      });
    } else if (sortBy === "priority") {
      const priorityWeight = { HIGH: 3, MEDIUM: 2, LOW: 1 };
      result.sort((a, b) => (priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0));
    } else if (sortBy === "title") {
      result.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortBy === "createdNewest") {
      result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
    return result;
  }, [tasks, sortBy]);

  const boardColumns = useMemo(() => {
    if (groupBy === "priority") {
      return [
        { id: "LOW", label: "Low Priority", color: "text-blue-400 border-blue-400 bg-blue-400/5" },
        { id: "MEDIUM", label: "Medium Priority", color: "text-amber-400 border-amber-400 bg-amber-400/5" },
        { id: "HIGH", label: "High Priority", color: "text-rose-400 border-rose-400 bg-rose-400/5" }
      ];
    }
    if (groupBy === "assignee") {
      const cols = [
        { id: "unassigned", label: "Unassigned", color: "text-slate-400 border-slate-400 bg-slate-400/5" }
      ];
      teamUsers.forEach(u => {
        cols.push({
          id: u._id,
          label: u.name,
          color: "text-sky-400 border-sky-400 bg-sky-400/5"
        });
      });
      return cols;
    }
    return STATUS_COLUMNS;
  }, [groupBy, teamUsers]);

  const getColumnTasks = useCallback((colId) => {
    let filtered = [];
    if (groupBy === "priority") {
      filtered = sortedTasks.filter(t => t.priority === colId);
    } else if (groupBy === "assignee") {
      filtered = sortedTasks.filter(t => {
        const assignedId = t.assignedTo?._id || t.assignedTo || null;
        if (colId === "unassigned") {
          return !assignedId;
        }
        return String(assignedId) === String(colId);
      });
    } else {
      // status
      filtered = sortedTasks.filter(t => t.status === colId);
    }
    return filtered;
  }, [groupBy, sortedTasks]);

  const getSubtasksProgress = (task) => {
    if (!task.subtasks || task.subtasks.length === 0) return null;
    const completed = task.subtasks.filter(s => s.isCompleted).length;
    const total = task.subtasks.length;
    const percent = Math.round((completed / total) * 100);
    return { completed, total, percent };
  };

  const TAG_COLORS = {
    "Call": "bg-blue-500/10 text-blue-400 border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20",
    "Meeting": "bg-purple-500/10 text-purple-400 border-purple-500/20 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/20",
    "Document": "bg-slate-500/10 text-slate-400 border-slate-500/20 dark:bg-slate-500/10 dark:text-slate-400 dark:border-slate-500/20",
    "Site Visit": "bg-orange-500/10 text-orange-400 border-orange-500/20 dark:bg-orange-500/10 dark:text-orange-400 dark:border-orange-500/20",
    "Urgent": "bg-rose-500/10 text-rose-400 border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20",
    "Follow-up": "bg-amber-500/10 text-amber-400 border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20",
  };

  // Helper formats
  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  };

  const isOverdue = (task) => {
    if (task.status === "COMPLETED" || !task.dueDate) return false;
    return new Date(task.dueDate) < new Date().setHours(0,0,0,0);
  };

  // Task shown in the side detail panel: the clicked one, falling back to the first row
  const panelTask = useMemo(
    () => sortedTasks.find(t => t._id === selectedTaskId) || sortedTasks[0] || null,
    [sortedTasks, selectedTaskId]
  );

  const formatDateTime = (value) => {
    if (!value) return "";
    return new Date(value).toLocaleString("en-IN", {
      day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit"
    });
  };

  const boardCompletion = stats.total > 0 ? Math.round(((stats.COMPLETED || 0) / stats.total) * 100) : 0;
  const memberStatus = WORKLOAD_STATUSES.find(w => w.id === workloadStatusFor(stats)) || WORKLOAD_STATUSES[3];

  // Roster: per-member rows (stats + workload bucket), filtered and sorted for the grid
  const rosterRows = useMemo(() => {
    return teamUsers.map((user) => {
      const stat = userStatsMap[user._id] || {};
      const total = stat.total || 0;
      const done = stat.COMPLETED || 0;
      const overdue = stat.overdue || 0;
      return {
        user,
        total,
        done,
        overdue,
        progress: total > 0 ? Math.round((done / total) * 100) : 0,
        status: WORKLOAD_STATUSES.find(w => w.id === workloadStatusFor(stat)) || WORKLOAD_STATUSES[3]
      };
    });
  }, [teamUsers, userStatsMap]);

  const rosterRoles = useMemo(
    () => [...new Set(teamUsers.map(u => u.role).filter(Boolean))].sort(),
    [teamUsers]
  );

  const visibleRosterRows = useMemo(() => {
    const term = rosterSearch.trim().toLowerCase();
    const rows = rosterRows.filter(row => {
      if (term && !`${row.user.name || ""} ${row.user.email || ""}`.toLowerCase().includes(term)) return false;
      if (rosterRoleFilter && row.user.role !== rosterRoleFilter) return false;
      if (rosterWorkloadFilter && row.status.id !== rosterWorkloadFilter) return false;
      return true;
    });

    const byName = (a, b) => String(a.user.name || "").localeCompare(String(b.user.name || ""));
    return [...rows].sort((a, b) => {
      if (rosterSort === "name") return byName(a, b);
      if (rosterSort === "tasks") return b.total - a.total || byName(a, b);
      if (rosterSort === "progress") return a.progress - b.progress || byName(a, b);
      return b.overdue - a.overdue || b.total - a.total || byName(a, b);
    });
  }, [rosterRows, rosterSearch, rosterRoleFilter, rosterWorkloadFilter, rosterSort]);

  const rosterSummary = useMemo(() => {
    const totals = rosterRows.reduce((acc, row) => ({
      total: acc.total + row.total,
      done: acc.done + row.done,
      overdue: acc.overdue + row.overdue
    }), { total: 0, done: 0, overdue: 0 });

    const members = rosterRows.length;
    const workload = WORKLOAD_STATUSES.map(status => {
      const count = rosterRows.filter(row => row.status.id === status.id).length;
      return { ...status, count, pct: members > 0 ? Math.round((count / members) * 100) : 0 };
    });
    const membersWithOverdue = rosterRows.filter(row => row.overdue > 0).length;

    return {
      members,
      ...totals,
      completionRate: totals.total > 0 ? Math.round((totals.done / totals.total) * 100) : 0,
      workload,
      membersWithOverdue,
      overduePct: members > 0 ? Math.round((membersWithOverdue / members) * 100) : 0,
      overdueRows: rosterRows.filter(row => row.overdue > 0).sort((a, b) => b.overdue - a.overdue)
    };
  }, [rosterRows]);

  // Assignee options for the task form. The current user is always present so anyone
  // — admins included — can assign a task to themselves, and the assignee of the task
  // being edited is kept even if they are no longer on the active roster.
  const assignableUsers = useMemo(() => {
    const list = [...teamUsers];
    const has = (id) => list.some(u => String(u._id) === String(id));

    if (currentUserId && !has(currentUserId)) {
      list.push({ _id: currentUserId, name: currentUserName || "Me", role: currentRole });
    }

    const editingAssignee = editingTask?.assignedTo;
    if (editingAssignee?._id && !has(editingAssignee._id)) {
      list.push({ _id: editingAssignee._id, name: editingAssignee.name || "Unknown user", role: editingAssignee.role });
    }

    return list.sort((a, b) => {
      const aSelf = String(a._id) === currentUserId ? 0 : 1;
      const bSelf = String(b._id) === currentUserId ? 0 : 1;
      if (aSelf !== bSelf) return aSelf - bSelf;
      return String(a.name || "").localeCompare(String(b.name || ""));
    });
  }, [teamUsers, editingTask, currentUserId, currentUserName, currentRole]);

  // Styles mapping
  const styles = useMemo(() => {
    const isDark = theme === "dark";
    return {
      card: isDark 
        ? "border border-white/5 bg-slate-900/60 backdrop-blur-xl shadow-lg"
        : "border border-slate-200 bg-white shadow-md",
      headerCard: isDark
        ? "border border-white/5 bg-slate-900/30 backdrop-blur-md"
        : "border border-slate-100 bg-slate-50",
      input: isDark
        ? "border-slate-800 bg-slate-950/80 text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
        : "border-slate-200 bg-white text-slate-700 placeholder:text-slate-400 focus:border-sky-500 focus:ring-1 focus:ring-sky-500",
      button: isDark
        ? "border-white/5 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white"
        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-950",
      primaryButton: isDark
        ? "bg-sky-600 hover:bg-sky-500 text-white shadow-sky-950/30 shadow-md"
        : "bg-slate-900 hover:bg-slate-800 text-white shadow-slate-300 shadow-md",
      text: isDark ? "text-slate-300" : "text-slate-600",
      title: isDark ? "text-slate-100" : "text-slate-800",
      label: isDark ? "text-slate-400" : "text-slate-500",
      column: isDark
        ? "bg-slate-950/40 border-white/5 shadow-inner"
        : "bg-slate-100/60 border-slate-200/80 shadow-sm"
    };
  }, [theme]);

  const renderScopeTabs = () => (
    <nav aria-label="Task lists" className="tasks-scope-tabs flex items-center gap-2">
      <div className={`inline-flex flex-wrap items-center gap-1 rounded-xl border p-1 ${
        isDark ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"
      }`}>
        {[["all", "All Task"], ["assigned", "Assigned to Me"], ["mine", "My Task"]].map(([scope, label]) => {
          const isActiveScope = taskScope === scope && viewLevel === "board" && !selectedUserObj;
          return (
            <button
              key={scope}
              type="button"
              aria-pressed={isActiveScope}
              className={`rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors ${
                isActiveScope
                  ? (isDark ? "bg-sky-500/15 text-sky-300" : "bg-sky-100 text-sky-700")
                  : `${styles.label} hover:bg-slate-500/10`
              }`}
              onClick={() => {
                setTaskScope(scope); setViewLevel("board"); setSelectedUserObj(null);
                setAssigneeFilter(""); setStatusFilter(""); setPriorityFilter("");
                setLeadFilter(""); setTagFilter(""); setSearchQuery("");
              }}
            >
              {label}
            </button>
          );
        })}
        {canViewRoster && (
          <button
            type="button"
            aria-pressed={viewLevel === "roster"}
            onClick={handleBackToRoster}
            className={`rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors ${
              viewLevel === "roster"
                ? (isDark ? "bg-sky-500/15 text-sky-300" : "bg-sky-100 text-sky-700")
                : `${styles.label} hover:bg-slate-500/10`
            }`}
          >
            Team Tasks
          </button>
        )}
      </div>
      {selectedUserObj && (
        <span
          className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold ${
            isDark ? "border-sky-500/40 bg-sky-500/10 text-sky-300" : "border-sky-500 bg-sky-50 text-sky-700"
          }`}
        >
          <User size={14} />
          {selectedUserObj.name.split(" ")[0]}&rsquo;s Tasks
        </span>
      )}
    </nav>
  );

  return (
    <div className={`tasks-reference-page flex flex-col h-full w-full overflow-hidden ${isDark ? "bg-slate-950" : "bg-slate-50/50"}`}>
      <ToastNotice message={success} type="success" />
      <ToastNotice message={error} type="error" />

      {/* Main Container */}
      <div className="tasks-scroll custom-scrollbar mx-auto flex min-h-0 w-full flex-1 flex-col space-y-3 overflow-y-auto overscroll-contain p-3 sm:space-y-4 sm:p-4 lg:p-6">
        {viewLevel === "roster" && canViewRoster ? (
          <div className="tasks-roster flex flex-none flex-col gap-4 pb-2">
            {/* Page header */}
            <div className="tasks-roster-heading flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <h1 className={`text-2xl font-black tracking-tight sm:text-3xl ${styles.title}`}>Team Tasks</h1>
                <p className={`mt-1 text-sm ${styles.label}`}>Monitor workload and progress</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[180px] flex-1 sm:max-w-[220px]">
                  <Search className={`pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${styles.label}`} />
                  <input
                    type="text"
                    value={rosterSearch}
                    onChange={(e) => setRosterSearch(e.target.value)}
                    placeholder="Search..."
                    className={`h-10 w-full rounded-xl border pl-9 pr-3 text-sm ${styles.input}`}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setShowRosterFilters(v => !v)}
                  aria-pressed={showRosterFilters}
                  className={`flex h-10 shrink-0 items-center gap-2 rounded-xl border px-3.5 text-sm font-semibold ${
                    showRosterFilters
                      ? (isDark ? "border-sky-500/40 bg-sky-500/10 text-sky-300" : "border-sky-500 bg-sky-50 text-sky-700")
                      : styles.button
                  }`}
                >
                  <SlidersHorizontal size={15} /> Filters
                </button>
                <button
                  type="button"
                  onClick={handleViewAllTasks}
                  className={`flex h-10 shrink-0 items-center gap-2 rounded-xl border px-3.5 text-sm font-semibold ${styles.button}`}
                >
                  <ListTodo size={15} /> View all tasks
                </button>
                <button
                  type="button"
                  onClick={handleOpenCreateModal}
                  className={`flex h-10 shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-bold ${styles.primaryButton}`}
                >
                    <Plus size={16} /> Create
                </button>
              </div>
            </div>

            {renderScopeTabs()}

            <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1fr)_330px]">
              {/* Left: summary tiles, filters, member grid */}
              <div className="min-w-0 space-y-4">
                <div className="tasks-metrics grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  {[
                    { key: "members", label: "Team Members", value: rosterSummary.members, icon: Users, tone: isDark ? "bg-sky-500/10 text-sky-400" : "bg-sky-50 text-sky-600", valueTone: styles.title },
                    { key: "total", label: "Total Tasks", value: rosterSummary.total, icon: FileText, tone: isDark ? "bg-indigo-500/10 text-indigo-400" : "bg-indigo-50 text-indigo-600", valueTone: styles.title },
                    { key: "done", label: "Completed", value: rosterSummary.done, icon: CheckCircle2, tone: isDark ? "bg-emerald-500/10 text-emerald-400" : "bg-emerald-50 text-emerald-600", valueTone: isDark ? "text-emerald-400" : "text-emerald-600" },
                    { key: "overdue", label: "Overdue", value: rosterSummary.overdue, icon: AlertCircle, tone: isDark ? "bg-rose-500/10 text-rose-400" : "bg-rose-50 text-rose-600", valueTone: isDark ? "text-rose-400" : "text-rose-600" },
                    { key: "rate", label: "Completion Rate", value: `${rosterSummary.completionRate}%`, icon: BarChart3, tone: isDark ? "bg-violet-500/10 text-violet-400" : "bg-violet-50 text-violet-600", valueTone: styles.title }
                  ].map(card => (
                    <div key={card.key} className={`rounded-2xl border p-3.5 ${styles.card}`}>
                      <div className="flex items-center gap-3">
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${card.tone}`}>
                          <card.icon size={18} />
                        </div>
                        <div className="min-w-0">
                          <p className={`truncate text-[11px] font-semibold ${styles.label}`}>{card.label}</p>
                          <p className={`text-xl font-black ${card.valueTone}`}>{card.value}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {showRosterFilters && (
                  <div className={`tasks-roster-filters flex flex-col gap-2 rounded-2xl border p-3 sm:flex-row sm:items-center ${styles.card}`}>
                    <div className="relative min-w-0 flex-1">
                      <Search className={`pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${styles.label}`} />
                      <input
                        type="text"
                        value={rosterSearch}
                        onChange={(e) => setRosterSearch(e.target.value)}
                        placeholder="Search team member..."
                        className={`h-10 w-full rounded-xl border pl-9 pr-3 text-sm ${styles.input}`}
                      />
                    </div>
                    <select
                      value={rosterRoleFilter}
                      onChange={(e) => setRosterRoleFilter(e.target.value)}
                      aria-label="Filter by role"
                      className={`h-10 rounded-xl border px-3 text-sm font-semibold sm:w-40 ${styles.input}`}
                    >
                      <option value="">All Roles</option>
                      {rosterRoles.map(role => <option key={role} value={role}>{role}</option>)}
                    </select>
                    <select
                      value={rosterWorkloadFilter}
                      onChange={(e) => setRosterWorkloadFilter(e.target.value)}
                      aria-label="Filter by workload"
                      className={`h-10 rounded-xl border px-3 text-sm font-semibold sm:w-40 ${styles.input}`}
                    >
                      <option value="">All Workload</option>
                      {WORKLOAD_STATUSES.map(w => <option key={w.id} value={w.id}>{w.label}</option>)}
                    </select>
                    <div className="flex items-center gap-2 sm:ml-auto">
                      <span className={`shrink-0 text-xs font-semibold ${styles.label}`}>Sort by:</span>
                      <select
                        value={rosterSort}
                        onChange={(e) => setRosterSort(e.target.value)}
                        aria-label="Sort team members"
                        className={`h-10 min-w-0 flex-1 rounded-xl border px-3 text-sm font-semibold sm:w-40 sm:flex-none ${styles.input}`}
                      >
                        {ROSTER_SORTS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                      </select>
                    </div>
                  </div>
                )}

                {rosterLoading ? (
                  <div className={`flex items-center justify-center rounded-2xl border p-10 ${styles.card}`}>
                    <p className={`text-sm ${styles.label}`}>Loading team...</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
                    {visibleRosterRows.map(({ user: u, total, done, overdue, progress, status }) => {
                      const needsAttention = overdue > 0;
                      const avatarColor = AVATAR_COLORS[(u.name || "?").charCodeAt(0) % AVATAR_COLORS.length];
                      return (
                        <div
                          key={u._id}
                          role="button"
                          tabIndex={0}
                          onClick={() => handleSelectRosterUser(u)}
                          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleSelectRosterUser(u); } }}
                          aria-label={`Open tasks for ${u.name}`}
                          className={`tasks-member-card relative cursor-pointer rounded-2xl border p-4 transition-all hover:-translate-y-0.5 hover:shadow-lg ${styles.card} ${
                            needsAttention ? "border-l-4 border-l-rose-500" : ""
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            {u.profileImageUrl ? (
                              <img src={u.profileImageUrl} alt={u.name} className="h-11 w-11 shrink-0 rounded-full object-cover" />
                            ) : (
                              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-black uppercase ${avatarColor}`}>
                                {(u.name || "?").slice(0, 2)}
                              </div>
                            )}

                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <p className={`truncate text-sm font-black ${styles.title}`}>{u.name}</p>
                                <div className="flex shrink-0 items-center gap-1">
                                  {needsAttention && (
                                    <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                                      isDark ? "bg-rose-500/15 text-rose-300" : "bg-rose-50 text-rose-600"
                                    }`}>
                                      Needs attention
                                    </span>
                                  )}
                                  <div className="relative">
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); setOpenMemberMenuId(prev => (prev === u._id ? null : u._id)); }}
                                      aria-label={`Actions for ${u.name}`}
                                      className={`rounded-lg p-1 ${styles.label} hover:bg-slate-500/10`}
                                    >
                                      <MoreVertical size={15} />
                                    </button>
                                    {openMemberMenuId === u._id && (
                                      <>
                                        <button
                                          type="button"
                                          aria-label="Close menu"
                                          onClick={(e) => { e.stopPropagation(); setOpenMemberMenuId(null); }}
                                          className="fixed inset-0 z-20 cursor-default"
                                        />
                                        <div className={`absolute right-0 top-8 z-30 w-40 overflow-hidden rounded-xl border py-1 shadow-xl ${
                                          isDark ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"
                                        }`}>
                                          <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); setOpenMemberMenuId(null); handleSelectRosterUser(u); }}
                                            className={`block w-full px-3 py-2 text-left text-xs font-semibold ${styles.title} hover:bg-slate-500/10`}
                                          >
                                            View tasks
                                          </button>
                                          <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); handleAssignTaskToMember(u); }}
                                            className={`block w-full px-3 py-2 text-left text-xs font-semibold ${styles.title} hover:bg-slate-500/10`}
                                          >
                                            Assign task
                                          </button>
                                          {canViewProfiles && (
                                            <button
                                              type="button"
                                              onClick={(e) => { e.stopPropagation(); setOpenMemberMenuId(null); navigate(`/admin/users/${u._id}`); }}
                                              className={`block w-full px-3 py-2 text-left text-xs font-semibold ${styles.title} hover:bg-slate-500/10`}
                                            >
                                              View profile
                                            </button>
                                          )}
                                        </div>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                                <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                                  isDark ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-600"
                                }`}>
                                  {u.role}
                                </span>
                                <span className={`flex items-center gap-1.5 text-[11px] font-semibold ${styles.label}`}>
                                  <span className={`h-2 w-2 rounded-full ${status.dot}`} />
                                  {status.label}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="mt-3 flex items-center gap-2">
                            <div className={`h-1.5 min-w-0 flex-1 overflow-hidden rounded-full ${isDark ? "bg-slate-800" : "bg-slate-100"}`}>
                              <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} />
                            </div>
                            <span className={`shrink-0 text-[11px] font-bold ${styles.label}`}>{progress}%</span>
                          </div>

                          <div className="mt-3">
                            <div className="grid grid-cols-3 gap-1">
                              <div>
                                <p className={`text-base font-black ${styles.title}`}>{total}</p>
                                <p className={`text-[10px] font-semibold ${styles.label}`}>Total</p>
                              </div>
                              <div>
                                <p className={`text-base font-black ${isDark ? "text-emerald-400" : "text-emerald-600"}`}>{done}</p>
                                <p className={`text-[10px] font-semibold ${styles.label}`}>Done</p>
                              </div>
                              <div>
                                <p className={`text-base font-black ${overdue > 0 ? (isDark ? "text-rose-400" : "text-rose-600") : styles.title}`}>{overdue}</p>
                                <p className={`text-[10px] font-semibold ${styles.label}`}>Overdue</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {visibleRosterRows.length === 0 && (
                      <div className={`col-span-full flex items-center justify-center rounded-2xl border p-10 ${styles.card}`}>
                        <p className={`text-sm ${styles.label}`}>
                          {rosterRows.length === 0 ? "No team members found" : "No team members match these filters"}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Right: workload, overdue queue, insight */}
              <aside className="tasks-workload min-w-0 space-y-4">
                <div className={`rounded-2xl border p-4 ${styles.card}`}>
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${isDark ? "bg-sky-500/10 text-sky-400" : "bg-sky-50 text-sky-600"}`}>
                      <Users size={18} />
                    </div>
                    <div className="min-w-0">
                      <button type="button" aria-expanded={workloadExpanded} onClick={() => setWorkloadExpanded(value => !value)} className={`flex items-center gap-3 text-sm font-black ${styles.title}`}>Team workload <ChevronRight size={16} className={workloadExpanded ? "-rotate-90" : "rotate-90"} /></button>
                      <p className={`text-xs ${styles.label}`}>{rosterSummary.members} members</p>
                    </div>
                  </div>
                  <div hidden={!workloadExpanded} className="mt-4 space-y-2.5">
                    {rosterSummary.workload.map(w => (
                      <div key={w.id} className="flex items-center gap-2">
                        <span className={`h-2 w-2 shrink-0 rounded-full ${w.dot}`} />
                        <span className={`w-16 shrink-0 text-xs font-semibold ${styles.title}`}>{w.label}</span>
                        <span className={`w-4 shrink-0 text-xs font-bold ${styles.label}`}>{w.count}</span>
                        <div className={`h-1.5 min-w-0 flex-1 overflow-hidden rounded-full ${isDark ? "bg-slate-800" : "bg-slate-100"}`}>
                          <div className={`h-full rounded-full ${w.bar}`} style={{ width: `${w.pct}%` }} />
                        </div>
                        <span className={`w-9 shrink-0 text-right text-[11px] font-semibold ${styles.label}`}>{w.pct}%</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className={`rounded-2xl border p-4 ${styles.card}`}>
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${isDark ? "bg-rose-500/10 text-rose-400" : "bg-rose-50 text-rose-600"}`}>
                      <AlertCircle size={18} />
                    </div>
                    <p className={`min-w-0 flex-1 text-sm font-black ${styles.title}`}>Overdue tasks</p>
                    <span className={`text-sm font-black ${styles.label}`}>{rosterSummary.overdue}</span>
                  </div>
                  <div className="mt-3 space-y-1">
                    {rosterSummary.overdueRows.map(({ user: u, overdue }) => {
                      const avatarColor = AVATAR_COLORS[(u.name || "?").charCodeAt(0) % AVATAR_COLORS.length];
                      return (
                        <button
                          key={u._id}
                          type="button"
                          onClick={() => handleSelectRosterUser(u)}
                          className="flex w-full items-center gap-2.5 rounded-xl p-2 text-left transition-colors hover:bg-slate-500/10"
                        >
                          {u.profileImageUrl ? (
                            <img src={u.profileImageUrl} alt={u.name} className="h-8 w-8 shrink-0 rounded-full object-cover" />
                          ) : (
                            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-black uppercase ${avatarColor}`}>
                              {(u.name || "?").slice(0, 2)}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className={`truncate text-xs font-bold ${styles.title}`}>{u.name}</p>
                            <p className={`truncate text-[10px] font-semibold uppercase tracking-wider ${styles.label}`}>{u.role}</p>
                          </div>
                          <span className={`shrink-0 text-[11px] font-bold ${isDark ? "text-rose-400" : "text-rose-600"}`}>
                            {overdue} overdue
                          </span>
                          <ChevronRight size={14} className={`shrink-0 ${styles.label}`} />
                        </button>
                      );
                    })}
                    {rosterSummary.overdueRows.length === 0 && (
                      <p className={`px-2 py-3 text-xs ${styles.label}`}>Nothing overdue. The team is on track.</p>
                    )}
                  </div>
                </div>

                <div className={`rounded-2xl border p-4 ${
                  isDark ? "border-sky-500/20 bg-sky-500/10" : "border-sky-100 bg-sky-50"
                }`}>
                  <div className="flex items-start gap-2.5">
                    <Lightbulb size={16} className={`mt-0.5 shrink-0 ${isDark ? "text-amber-300" : "text-amber-500"}`} />
                    <div className="min-w-0">
                      <p className={`text-sm font-black ${isDark ? "text-sky-300" : "text-sky-700"}`}>Quick insight</p>
                      <p className={`mt-1 text-xs leading-relaxed ${isDark ? "text-sky-200/80" : "text-sky-700/80"}`}>
                        {rosterSummary.membersWithOverdue > 0
                          ? `${rosterSummary.overduePct}% of your team members have overdue tasks. Follow up to keep work on track.`
                          : "No overdue work across the team. Keep the momentum going."}
                      </p>
                    </div>
                  </div>
                </div>
              </aside>
            </div>
          </div>
        ) : (
        <>
        {/* Member / scope header */}
        <div className={`tasks-member-summary flex flex-col gap-4 rounded-2xl border p-4 xl:flex-row xl:items-center ${styles.card}`}>
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {canViewRoster && (
              <button
                onClick={handleBackToRoster}
                className={`flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold ${styles.button}`}
              >
                <ArrowLeft size={14} />
                <span className="hidden sm:inline">Back to </span>Team Tasks
              </button>
            )}

            {selectedUserObj ? (
              <>
                {selectedUserObj.profileImageUrl ? (
                  <img src={selectedUserObj.profileImageUrl} alt={selectedUserObj.name} className="h-14 w-14 shrink-0 rounded-full object-cover" />
                ) : (
                  <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-lg font-black uppercase ${
                    AVATAR_COLORS[(selectedUserObj.name || "?").charCodeAt(0) % AVATAR_COLORS.length]
                  }`}>
                    {(selectedUserObj.name || "?").slice(0, 2)}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className={`truncate text-xl font-black ${styles.title}`}>{selectedUserObj.name}</h2>
                    <span className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                      isDark ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-600"
                    }`}>
                      <span className={`h-2 w-2 rounded-full ${memberStatus.dot}`} />
                      {memberStatus.label}
                    </span>
                  </div>
                  <span className={`mt-1 inline-block rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                    isDark ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-600"
                  }`}>
                    {selectedUserObj.role}
                  </span>
                </div>
              </>
            ) : (
              <h2 className={`truncate text-xl font-black ${styles.title}`}>
                {taskScope === "mine" ? "My Task" : taskScope === "assigned" ? "Assigned to Me" : "All Accessible Tasks"}
              </h2>
            )}
          </div>

          <div className="grid grid-cols-4 gap-1 xl:w-[380px]">
            {[
              { label: "Total", value: stats.total || 0, tone: styles.title },
              { label: "Completed", value: stats.COMPLETED || 0, tone: (stats.COMPLETED || 0) > 0 ? (isDark ? "text-emerald-400" : "text-emerald-600") : styles.title },
              { label: "Pending", value: stats.pending || 0, tone: (stats.pending || 0) > 0 ? (isDark ? "text-rose-400" : "text-rose-600") : styles.title },
              { label: "Overdue", value: stats.overdue || 0, tone: (stats.overdue || 0) > 0 ? (isDark ? "text-rose-400" : "text-rose-600") : styles.title }
            ].map((metric, i) => (
              <div key={metric.label} className={`px-2 text-center ${i > 0 ? (isDark ? "border-l border-white/5" : "border-l border-slate-200") : ""}`}>
                <p className={`text-xl font-black ${metric.tone}`}>{metric.value}</p>
                <p className={`truncate text-[11px] font-semibold ${styles.label}`}>{metric.label}</p>
              </div>
            ))}
          </div>

          <div className="min-w-0 xl:w-64">
            <div className="flex items-center justify-between gap-2">
              <span className={`text-xs font-semibold ${styles.title}`}>Completion</span>
              <span className={`text-xs font-bold ${styles.label}`}>{boardCompletion}%</span>
            </div>
            <div className={`mt-2 h-2 overflow-hidden rounded-full ${isDark ? "bg-slate-800" : "bg-slate-100"}`}>
              <div className="h-full rounded-full bg-sky-500 transition-all" style={{ width: `${boardCompletion}%` }} />
            </div>
          </div>
        </div>

        {/* Toolbar */}
        {renderScopeTabs()}
        <div className={`tasks-toolbar flex flex-col gap-2 rounded-2xl border p-3 xl:flex-row xl:items-center ${styles.card}`}>
          <div className="relative min-w-0 flex-1">
            <Search className={`pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${styles.label}`} />
            <input
              type="text"
              placeholder="Search tasks by title or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`h-10 w-full rounded-xl border pl-9 pr-3 text-sm ${styles.input}`}
            />
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by status"
              className={`h-10 rounded-xl border px-3 text-sm font-semibold ${styles.input}`}
            >
              <option value="">Status</option>
              {STATUS_COLUMNS.map(col => <option key={col.id} value={col.id}>{col.label}</option>)}
            </select>

            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              aria-label="Filter by priority"
              className={`h-10 rounded-xl border px-3 text-sm font-semibold ${styles.input}`}
            >
              <option value="">Priority</option>
              {PRIORITIES.map(pr => <option key={pr.value} value={pr.value}>{pr.label}</option>)}
            </select>

            <select
              value={assigneeFilter}
              onChange={(e) => setAssigneeFilter(e.target.value)}
              aria-label="Filter by assignee"
              className={`h-10 max-w-[160px] rounded-xl border px-3 text-sm font-semibold ${styles.input}`}
            >
              <option value="">Assignee</option>
              {teamUsers.map(u => <option key={u._id} value={u._id}>{u.name}</option>)}
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              aria-label="Sort tasks"
              className={`h-10 rounded-xl border px-3 text-sm font-semibold ${styles.input}`}
            >
              <option value="createdNewest">Newest</option>
              <option value="dueDate">Due Date</option>
              <option value="priority">Priority</option>
              <option value="title">Title (A-Z)</option>
            </select>

            {viewMode === "kanban" && (
              <select
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value)}
                aria-label="Group board by"
                className={`h-10 rounded-xl border px-3 text-sm font-semibold ${styles.input}`}
              >
                <option value="status">Group: Status</option>
                <option value="priority">Group: Priority</option>
                <option value="assignee">Group: Assignee</option>
              </select>
            )}

            <button
              type="button"
              onClick={() => setShowFilters(v => !v)}
              title="More filters"
              aria-label="More filters"
              aria-pressed={showFilters}
              className={`flex h-10 w-10 items-center justify-center rounded-xl border ${
                showFilters || leadFilter || tagFilter
                  ? (isDark ? "border-sky-500/40 bg-sky-500/10 text-sky-300" : "border-sky-500 bg-sky-50 text-sky-700")
                  : styles.button
              }`}
            >
              <SlidersHorizontal size={15} />
            </button>

            <div className={`flex items-center gap-1 rounded-xl border p-1 ${isDark ? "border-slate-800 bg-slate-950" : "border-slate-200 bg-white"}`}>
              <button
                type="button"
                onClick={() => setViewMode("kanban")}
                aria-pressed={viewMode === "kanban"}
                className={`flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition-colors ${
                  viewMode === "kanban"
                    ? (isDark ? "bg-sky-500/15 text-sky-300" : "bg-sky-50 text-sky-700")
                    : `${styles.label} hover:bg-slate-500/10`
                }`}
              >
                <KanbanSquare size={15} /> <span className="hidden sm:inline">Board</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                aria-pressed={viewMode === "list"}
                className={`flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition-colors ${
                  viewMode === "list"
                    ? (isDark ? "bg-sky-500/15 text-sky-300" : "bg-sky-50 text-sky-700")
                    : `${styles.label} hover:bg-slate-500/10`
                }`}
              >
                <List size={15} /> <span className="hidden sm:inline">List</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleOpenCreateModal}
              className={`flex h-10 items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-bold ${styles.primaryButton}`}
            >
              <Plus size={16} /> New Task
            </button>
          </div>
        </div>

        {showFilters && (
          <div className={`flex flex-wrap items-center gap-2 rounded-2xl border p-3 ${styles.card}`}>
            {!isProductionExecutive && (
              <select
                value={leadFilter}
                onChange={(e) => setLeadFilter(e.target.value)}
                aria-label="Filter by lead"
                className={`h-9 max-w-[180px] rounded-xl border px-3 text-xs font-semibold ${styles.input}`}
              >
                <option value="">All Leads</option>
                {leads.map(l => <option key={l._id} value={l._id}>{l.name}</option>)}
              </select>
            )}
            <select
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
              aria-label="Filter by tag"
              className={`h-9 rounded-xl border px-3 text-xs font-semibold ${styles.input}`}
            >
              <option value="">All Tags</option>
              {["Call", "Meeting", "Document", "Site Visit", "Urgent", "Follow-up"].map(tagOpt => (
                <option key={tagOpt} value={tagOpt}>{tagOpt}</option>
              ))}
            </select>
            {(statusFilter || priorityFilter || assigneeFilter || (!isProductionExecutive && leadFilter) || searchQuery || tagFilter) && (
              <button
                type="button"
                onClick={() => {
                  setStatusFilter("");
                  setPriorityFilter("");
                  setAssigneeFilter("");
                  setLeadFilter("");
                  setSearchQuery("");
                  setTagFilter("");
                }}
                className={`h-9 rounded-xl border px-3 text-xs font-semibold ${
                  isDark ? "border-slate-800 text-rose-400 hover:bg-rose-950/20" : "border-slate-200 text-rose-600 hover:bg-rose-50"
                }`}
              >
                Clear Filters
              </button>
            )}
          </div>
        )}

        {/* Content Body */}
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center space-y-2 py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
            <p className={`text-sm font-semibold ${styles.label}`}>Fetching tasks...</p>
          </div>
        ) : tasks.length === 0 ? (
          <div className={`flex-1 rounded-2xl border p-12 text-center flex flex-col items-center justify-center space-y-3 ${styles.card}`}>
            <ListTodo size={40} className={isDark ? "text-slate-700" : "text-slate-300"} />
            <div>
              <p className={`text-base font-bold ${styles.title}`}>No tasks found</p>
              <p className={`text-xs mt-1 max-w-sm mx-auto ${styles.label}`}>
                Try relaxing your search or filter queries, or create a brand new task.
              </p>
            </div>
            <button
              onClick={handleOpenCreateModal}
              className={`h-9 px-4 rounded-xl flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider ${styles.primaryButton}`}
            >
              <Plus size={14} />
              Create First Task
            </button>
          </div>
        ) : viewMode === "kanban" ? (
          /* ========================================================
             KANBAN BOARD VIEW (HTML5 Drag & Drop)
             ======================================================== */
          <div className="scrollbar-hide grid min-h-0 flex-1 grid-cols-1 gap-3 pb-4 sm:flex sm:gap-4 sm:overflow-x-auto">
            {boardColumns.map((col) => {
              const columnTasks = getColumnTasks(col.id);
              const isOver = activeDragCol === col.id;

              return (
                <div
                  key={col.id}
                  onDragOver={(e) => handleDragOver(e, col.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, col.id)}
                  className={`flex max-h-full w-full flex-col rounded-2xl border transition-all sm:w-[280px] sm:min-w-[280px] sm:shrink-0 ${styles.column} ${
                    isOver ? "ring-2 ring-sky-500/50 bg-sky-500/5 border-sky-400" : ""
                  }`}
                >
                  {/* Column Header */}
                  <div className="p-3 flex items-center justify-between border-b border-slate-800/10 dark:border-white/5">
                    <div className="flex items-center gap-2">
                      <span className={`inline-block w-2.5 h-2.5 rounded-full border ${col.color ? col.color.split(" ")[0] : "text-sky-450"} ${col.color ? col.color.split(" ")[1] : "border-sky-450"}`} />
                      <span className={`text-sm font-bold tracking-tight ${styles.title}`}>{col.label}</span>
                    </div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isDark ? "bg-slate-900 text-slate-400" : "bg-slate-200 text-slate-600"}`}>
                      {columnTasks.length}
                    </span>
                  </div>

                  {/* Task Card List */}
                  <div className="scrollbar-hide min-h-[120px] flex-1 space-y-2.5 p-2 sm:overflow-y-auto">
                    <AnimatePresence initial={false}>
                      {columnTasks.map((task) => {
                        const priority = PRIORITIES.find(p => p.value === task.priority) || PRIORITIES[1];
                        const expired = isOverdue(task);
                        const progress = getSubtasksProgress(task);

                        return (
                          <Motion.div
                            key={task._id}
                            layoutId={task._id}
                            draggable={groupBy === "status" || canEditTask(task)}
                            onDragStart={(e) => handleDragStart(e, task._id)}
                            onClick={() => handleOpenDetails(task)}
                            className={`rounded-xl p-3 border group/card relative cursor-pointer active:cursor-grabbing hover:shadow-md transition-all ${
                              isDark 
                                ? "bg-slate-900/90 border-slate-800/80 hover:border-slate-700/80" 
                                : "bg-white border-slate-200 hover:border-slate-300"
                            }`}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.2 }}
                          >
                            {/* Priority & Quick Actions */}
                            <div className="flex items-center justify-between mb-2">
                              <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${priority.color}`}>
                                {priority.label}
                              </span>
                              
                              <div className="opacity-0 group-hover/card:opacity-100 flex items-center gap-1 transition-opacity">
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleOpenEditModal(task); }}
                                  disabled={!canEditTask(task)}
                                  className={`p-1 rounded hover:bg-slate-800/50 ${isDark ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-800"}`}
                                  title="Edit Task"
                                >
                                  <Edit2 size={11} />
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleDeleteTask(task._id); }}
                                  disabled={!canDeleteTask(task)}
                                  className="p-1 rounded hover:bg-rose-950/20 text-rose-500 hover:text-rose-400"
                                  title="Delete Task"
                                >
                                  <Trash2 size={11} />
                                </button>
                              </div>
                            </div>

                            {/* Task Content */}
                            <h4 className={`text-xs font-semibold leading-snug break-words ${styles.title}`}>
                              {task.title}
                            </h4>

                            {/* Tags List */}
                            {task.tags && task.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1.5 mb-1">
                                {task.tags.map((t) => {
                                  const colorClass = TAG_COLORS[t] || "bg-sky-500/10 text-sky-400 border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-400 dark:border-sky-500/20";
                                  return (
                                    <span 
                                      key={t} 
                                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border ${colorClass}`}
                                    >
                                      {t}
                                    </span>
                                  );
                                })}
                              </div>
                            )}

                            {task.description && (
                              <p className={`text-[11px] mt-1 line-clamp-2 break-words ${styles.label}`}>
                                {task.description}
                              </p>
                            )}

                            {/* Subtask progress bar */}
                            {progress && (
                              <div className="mt-2.5 space-y-1">
                                <div className="flex items-center justify-between text-[9px] text-slate-400 font-medium">
                                  <span className="flex items-center gap-1">
                                    <CheckSquare size={9} />
                                    {progress.completed}/{progress.total} Subtasks
                                  </span>
                                  <span>{progress.percent}%</span>
                                </div>
                                <div className={`w-full h-1 rounded-full overflow-hidden ${isDark ? "bg-slate-800" : "bg-slate-200"}`}>
                                  <div 
                                    className="h-full bg-emerald-500 transition-all duration-300"
                                    style={{ width: `${progress.percent}%` }}
                                  />
                                </div>
                              </div>
                            )}

                            {/* Metadata (Lead, Assignee, Date) */}
                            <div className="mt-3 pt-2 border-t border-slate-800/10 dark:border-white/5 space-y-1.5 text-[10px]">
                              {/* Linked Lead */}
                              {!isProductionExecutive && task.leadId && (
                                <div className={`flex items-center gap-1 truncate ${styles.label}`}>
                                  <LinkIcon size={10} className="shrink-0" />
                                  <span className="truncate">Lead: {task.leadId.name}</span>
                                </div>
                              )}

                              {/* Dates */}
                              {task.dueDate && (
                                <div className={`flex items-center gap-1 ${
                                  expired ? "text-rose-500 font-bold" : styles.label
                                }`}>
                                  <Calendar size={10} className="shrink-0" />
                                  <span>{formatDate(task.dueDate)}</span>
                                  {expired && <span className="text-[9px] uppercase tracking-wider ml-1">Overdue</span>}
                                </div>
                              )}
                            </div>

                            {/* Assignee Avatar Indicator */}
                            <div className="mt-2.5 flex items-center justify-between">
                              <span className={`text-[9px] ${styles.label}`}>
                                By {task.createdBy?.name || "System"}
                              </span>
                              {task.assignedTo ? (
                                <div
                                  onClick={(e) => handleOpenAssigneeProfile(e, task.assignedTo)}
                                  className={`h-5 w-5 rounded-full bg-sky-500 flex items-center justify-center text-[10px] text-white font-bold tracking-tight shadow-sm shrink-0 border border-slate-800 dark:border-slate-900 ${canViewProfiles ? "cursor-pointer hover:ring-2 hover:ring-sky-400" : ""}`}
                                  title={canViewProfiles ? `View ${task.assignedTo.name}'s profile` : `Assigned to ${task.assignedTo.name}`}
                                >
                                  {task.assignedTo.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                                </div>
                              ) : (
                                <div 
                                  className="h-5 w-5 rounded-full border border-dashed border-slate-700/80 flex items-center justify-center text-slate-500 shrink-0"
                                  title="Unassigned"
                                >
                                  <User size={10} />
                                </div>
                              )}
                            </div>

                            {/* Kanban Quick Navigation */}
                            {groupBy === "status" && (
                              <div className="mt-2.5 pt-1.5 border-t border-slate-850 flex items-center justify-end gap-1.5 opacity-0 group-hover/card:opacity-100 transition-opacity">
                                {col.id !== "BACKLOG" && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleUpdateStatus(task._id, STATUS_COLUMNS[STATUS_COLUMNS.findIndex(c => c.id === col.id) - 1].id); }}
                                    className={`p-1 rounded text-[9px] font-semibold flex items-center gap-0.5 border ${styles.button}`}
                                  >
                                    Move Left
                                  </button>
                                )}
                                {col.id !== "COMPLETED" && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleUpdateStatus(task._id, STATUS_COLUMNS[STATUS_COLUMNS.findIndex(c => c.id === col.id) + 1].id); }}
                                    className={`p-1 rounded text-[9px] font-semibold flex items-center gap-0.5 border ${styles.button}`}
                                  >
                                    Move Right
                                  </button>
                                )}
                              </div>
                            )}
                          </Motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* ========================================================
             TASK LIST + LIVE DETAIL PANEL
             ======================================================== */
          <div className="grid flex-none gap-4 xl:min-h-0 xl:flex-1 xl:grid-cols-[minmax(0,1fr)_400px] 2xl:grid-cols-[minmax(0,1fr)_440px]">
            {/* Task list */}
            <div className={`tasks-list scrollbar-hide flex flex-col gap-3 rounded-2xl border p-4 xl:min-h-0 xl:overflow-y-auto ${styles.card}`}>
              <h3 className={`text-lg font-black ${styles.title}`}>Tasks</h3>

              <div className="flex flex-wrap gap-2">
                {[
                  { id: "", label: "All", count: stats.total || 0 },
                  { id: "TODO", label: "To Do", count: stats.TODO || 0 },
                  { id: "IN_PROGRESS", label: "In Progress", count: stats.IN_PROGRESS || 0 },
                  { id: "COMPLETED", label: "Completed", count: stats.COMPLETED || 0 }
                ].map(tab => {
                  const isActiveTab = statusFilter === tab.id;
                  return (
                    <button
                      key={tab.id || "all"}
                      type="button"
                      onClick={() => setStatusFilter(tab.id)}
                      aria-pressed={isActiveTab}
                      className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-bold transition-colors ${
                        isActiveTab
                          ? (isDark ? "border-sky-500/40 bg-sky-500/10 text-sky-300" : "border-sky-500 bg-sky-50 text-sky-700")
                          : styles.button
                      }`}
                    >
                      {tab.label}
                      <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-black ${
                        isActiveTab
                          ? (isDark ? "bg-sky-500/20 text-sky-200" : "bg-sky-100 text-sky-700")
                          : (isDark ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-600")
                      }`}>
                        {tab.count}
                      </span>
                    </button>
                  );
                })}
              </div>

              <form
                onSubmit={handleQuickAddTask}
                className={`flex items-center gap-2 rounded-xl border border-dashed px-3 py-2.5 ${isDark ? "border-slate-800" : "border-slate-200"}`}
              >
                <Plus size={16} className={isDark ? "text-sky-400" : "text-sky-600"} />
                <input
                  type="text"
                  value={quickAddTitle}
                  onChange={(e) => setQuickAddTitle(e.target.value)}
                  placeholder={selectedUserObj ? `Add a task for ${selectedUserObj.name}...` : "Add a task..."}
                  disabled={quickAddSubmitting}
                  className={`h-6 min-w-0 flex-1 bg-transparent text-sm focus:outline-none ${styles.title}`}
                />
                {quickAddTitle.trim() && (
                  <button
                    type="submit"
                    disabled={quickAddSubmitting}
                    className={`h-8 shrink-0 rounded-lg px-3 text-xs font-bold disabled:opacity-60 ${styles.primaryButton}`}
                  >
                    Add
                  </button>
                )}
              </form>

              <div className="space-y-2">
                {sortedTasks.map(task => {
                  const priority = PRIORITIES.find(pr => pr.value === task.priority) || PRIORITIES[1];
                  const statusCol = STATUS_COLUMNS.find(col => col.id === task.status) || STATUS_COLUMNS[1];
                  const isSelected = panelTask?._id === task._id;
                  const isDone = task.status === "COMPLETED";
                  const expired = isOverdue(task);
                  const subtasks = task.subtasks || [];
                  return (
                    <div
                      key={task._id}
                      role="button"
                      tabIndex={0}
                      onClick={() => { setSelectedTaskId(task._id); setMobileTaskDetailsOpen(true); }}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedTaskId(task._id); setMobileTaskDetailsOpen(true); } }}
                      className={`tasks-task-card cursor-pointer rounded-2xl border p-3.5 transition-all ${
                        isSelected
                          ? (isDark ? "border-sky-500/60 bg-sky-500/5 ring-1 ring-sky-500/40" : "border-sky-500 bg-sky-50/40 ring-1 ring-sky-500/30")
                          : (isDark ? "border-slate-800 hover:border-slate-700" : "border-slate-200 hover:border-slate-300")
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleToggleComplete(task); }}
                          aria-label={isDone ? `Reopen ${task.title}` : `Mark ${task.title} completed`}
                          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                            isDone
                              ? "border-emerald-500 bg-emerald-500 text-white"
                              : isDark ? "border-slate-700 hover:border-sky-400" : "border-slate-300 hover:border-sky-500"
                          }`}
                        >
                          {isDone && <Check size={12} />}
                        </button>

                        <div className="min-w-0 flex-1">
                          <p className={`truncate text-sm font-bold ${styles.title}`}>{task.title}</p>
                          <p className={`truncate text-xs ${styles.label}`}>{task.description?.trim() || "No description"}</p>

                          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                            <span className={`flex items-center gap-1.5 rounded-md px-2 py-0.5 font-semibold ${
                              isDark ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-600"
                            }`}>
                              <span className={`h-2 w-2 rounded-full ${PRIORITY_DOTS[task.priority] || PRIORITY_DOTS.MEDIUM}`} />
                              {priority.label}
                            </span>
                            <span className={`flex items-center gap-1.5 rounded-md px-2 py-0.5 font-semibold ${
                              isDark ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-600"
                            }`}>
                              <span className={`h-2 w-2 rounded-full ${STATUS_DOTS[task.status] || STATUS_DOTS.TODO}`} />
                              {statusCol.label}
                            </span>
                            <span className={`flex items-center gap-1 ${expired ? (isDark ? "text-rose-400" : "text-rose-600") : styles.label}`}>
                              <Calendar size={12} /> {task.dueDate ? formatDate(task.dueDate) : "Not set"}
                            </span>
                            <span className={`flex min-w-0 items-center gap-1 ${styles.label}`}>
                              <User size={12} />
                              <span className="truncate">{task.assignedTo ? `Assigned to ${task.assignedTo.name}` : "Unassigned"}</span>
                            </span>
                          </div>

                          <div className={`mt-1.5 flex flex-wrap items-center gap-3 text-[11px] ${styles.label}`}>
                            <span className="flex items-center gap-1">
                              <List size={12} /> {subtasks.filter(st => st.isCompleted).length} of {subtasks.length} subtasks
                            </span>
                            <span className="truncate">Created by {task.createdBy?.name || "System"}</span>
                          </div>
                        </div>

                        <div className="relative shrink-0">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setOpenTaskMenuId(prev => (prev === task._id ? null : task._id)); }}
                            aria-label={`Actions for ${task.title}`}
                            className={`rounded-lg p-1 ${styles.label} hover:bg-slate-500/10`}
                          >
                            <MoreVertical size={15} />
                          </button>
                          {openTaskMenuId === task._id && (
                            <>
                              <button
                                type="button"
                                aria-label="Close menu"
                                onClick={(e) => { e.stopPropagation(); setOpenTaskMenuId(null); }}
                                className="fixed inset-0 z-20 cursor-default"
                              />
                              <div className={`absolute right-0 top-8 z-30 w-36 overflow-hidden rounded-xl border py-1 shadow-xl ${
                                isDark ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"
                              }`}>
                                <button
                                  type="button"
                                  disabled={!canEditTask(task)}
                                  onClick={(e) => { e.stopPropagation(); setOpenTaskMenuId(null); handleOpenEditModal(task); }}
                                  className={`block w-full px-3 py-2 text-left text-xs font-semibold disabled:opacity-40 ${styles.title} hover:bg-slate-500/10`}
                                >
                                  Edit task
                                </button>
                                <button
                                  type="button"
                                  disabled={!canDeleteTask(task)}
                                  onClick={(e) => { e.stopPropagation(); setOpenTaskMenuId(null); handleDeleteTask(task._id); }}
                                  className="block w-full px-3 py-2 text-left text-xs font-semibold text-rose-500 disabled:opacity-40 hover:bg-rose-500/10"
                                >
                                  Delete task
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className={`flex flex-col items-center justify-center gap-1 rounded-2xl border border-dashed p-8 text-center ${
                isDark ? "border-slate-800" : "border-slate-200"
              }`}>
                <CheckCircle2 size={28} className={isDark ? "text-slate-700" : "text-slate-300"} />
                <p className={`text-sm font-bold ${styles.title}`}>No more tasks</p>
                <p className={`text-xs ${styles.label}`}>
                  {selectedUserObj ? `All tasks for ${selectedUserObj.name} are shown here.` : "All matching tasks are shown here."}
                </p>
              </div>
            </div>

            {/* Task detail panel */}
            <aside aria-label="Task details" className={`tasks-detail-panel ${mobileTaskDetailsOpen ? "tasks-detail-open" : ""} scrollbar-hide flex flex-col rounded-2xl border p-4 xl:min-h-0 xl:overflow-y-auto ${styles.card}`}>
              <button type="button" onClick={() => setMobileTaskDetailsOpen(false)} aria-label="Close task details" className="tasks-detail-close self-end rounded-lg p-2 xl:hidden"><X size={20} /></button>
              {panelTask ? (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className={`text-lg font-black ${styles.title}`}>Task details</h3>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(panelTask)}
                        disabled={!canEditTask(panelTask)}
                        className={`flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-bold disabled:opacity-40 ${styles.button}`}
                      >
                        <Edit2 size={13} /> Edit task
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteTask(panelTask._id)}
                        disabled={!canDeleteTask(panelTask)}
                        title="Delete task"
                        aria-label="Delete task"
                        className={`rounded-xl border p-2 text-rose-500 disabled:opacity-40 ${
                          isDark ? "border-slate-800 hover:bg-rose-500/10" : "border-slate-200 hover:bg-rose-50"
                        }`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="mt-4">
                    <p className={`text-base font-black ${styles.title}`}>{panelTask.title}</p>
                    <p className={`mt-1 text-xs ${styles.label}`}>{panelTask.description?.trim() || "No description"}</p>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="min-w-0">
                      <span className={`mb-1 block text-xs font-semibold ${styles.label}`}>Status</span>
                      <select
                        value={panelTask.status}
                        onChange={(e) => handleUpdateStatus(panelTask._id, e.target.value)}
                        aria-label="Task status"
                        className={`h-9 w-full rounded-xl border px-2 text-xs font-semibold ${styles.input}`}
                      >
                        {STATUS_COLUMNS.map(col => <option key={col.id} value={col.id}>{col.label}</option>)}
                      </select>
                    </div>

                    <div className="min-w-0">
                      <span className={`mb-1 block text-xs font-semibold ${styles.label}`}>Priority</span>
                      <select
                        value={panelTask.priority}
                        disabled={!canEditTask(panelTask)}
                        onChange={(e) => handleInlineUpdate(panelTask._id, { priority: e.target.value })}
                        aria-label="Task priority"
                        className={`h-9 w-full rounded-xl border px-2 text-xs font-semibold ${styles.input}`}
                      >
                        {PRIORITIES.map(pr => <option key={pr.value} value={pr.value}>{pr.label}</option>)}
                      </select>
                    </div>

                    <div className="min-w-0">
                      <span className={`mb-1 block text-xs font-semibold ${styles.label}`}>Assignee</span>
                      <select
                        value={panelTask.assignedTo?._id || panelTask.assignedTo || ""}
                        disabled={!canEditTask(panelTask)}
                        onChange={(e) => handleInlineUpdate(panelTask._id, { assignedTo: e.target.value || null })}
                        aria-label="Task assignee"
                        className={`h-9 w-full rounded-xl border px-2 text-xs font-semibold ${styles.input}`}
                      >
                        <option value="">Unassigned</option>
                        {assignableUsers.map(u => (
                          <option key={u._id} value={u._id}>
                            {String(u._id) === currentUserId ? `${u.name} (Me)` : u.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="min-w-0">
                      <span className={`mb-1 block text-xs font-semibold ${styles.label}`}>Due date</span>
                      <input
                        type="date"
                        value={panelTask.dueDate ? new Date(panelTask.dueDate).toISOString().split("T")[0] : ""}
                        disabled={!canEditTask(panelTask)}
                        onChange={(e) => handleInlineUpdate(panelTask._id, { dueDate: e.target.value || null })}
                        aria-label="Task due date"
                        className={`h-9 w-full rounded-xl border px-2 text-xs font-semibold ${styles.input}`}
                      />
                    </div>
                  </div>

                  <div className="mt-5">
                    <p className={`text-sm font-black ${styles.title}`}>
                      Subtasks ({(panelTask.subtasks || []).filter(st => st.isCompleted).length} of {(panelTask.subtasks || []).length})
                    </p>
                    <div className={`mt-2 grid gap-2 ${openSubtaskIndex(panelTask._id, panelTask.subtasks) !== null ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,230px)]" : ""}`}>
                    <div className="space-y-1.5">
                      {(panelTask.subtasks || []).map((st, idx) => {
                        const isEditingSubtask = subtaskEditKey === `${panelTask._id}:${idx}`;
                        return (
                          <div key={idx} className="flex items-center gap-2 text-xs">
                            {isEditingSubtask ? (
                              <>
                                <input
                                  type="text"
                                  autoFocus
                                  value={subtaskEditValue}
                                  onChange={(e) => setSubtaskEditValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") { e.preventDefault(); handleSaveSubtaskEdit(panelTask, idx); }
                                    if (e.key === "Escape") { e.preventDefault(); handleCancelSubtaskEdit(); }
                                  }}
                                  className={`h-8 min-w-0 flex-1 rounded-lg border px-2 text-xs ${styles.input}`}
                                />
                                <button type="button" onClick={() => handleSaveSubtaskEdit(panelTask, idx)} title="Save subtask" aria-label="Save subtask" className="rounded p-1 text-emerald-500 hover:bg-emerald-500/10">
                                  <Check size={13} />
                                </button>
                                <button type="button" onClick={handleCancelSubtaskEdit} title="Cancel" aria-label="Cancel subtask edit" className={`rounded p-1 ${styles.label} hover:bg-slate-500/10`}>
                                  <X size={13} />
                                </button>
                              </>
                            ) : (
                              <>
                                <input
                                  type="checkbox"
                                  checked={st.isCompleted}
                                  aria-label={st.title}
                                  disabled={!canEditTask(panelTask)}
                                  onChange={() => handleInlineToggleSubtask(panelTask, idx)}
                                  className="h-3.5 w-3.5 shrink-0 rounded"
                                />
                                <button
                                  type="button"
                                  onClick={() => toggleSubtaskDetail(panelTask._id, idx)}
                                  aria-expanded={isSubtaskDetailOpen(panelTask._id, idx)}
                                  title="Open subtask details"
                                  className={`min-w-0 flex-1 truncate text-left hover:underline ${st.isCompleted ? `line-through ${styles.label}` : styles.title}`}
                                >
                                  {st.title}
                                </button>
                                {subtaskMeta(st) ? (
                                  <span className={`shrink-0 text-[10px] ${styles.label}`}>{subtaskMeta(st)}</span>
                                ) : null}
                                <button
                                  type="button"
                                  onClick={() => handleStartSubtaskEdit(panelTask, idx, st.title)}
                                  disabled={!canEditTask(panelTask)}
                                  title="Edit subtask"
                                  aria-label={`Edit subtask ${st.title}`}
                                  className={`rounded p-1 ${styles.label} hover:bg-slate-500/10 disabled:opacity-40`}
                                >
                                  <Edit2 size={12} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteSubtask(panelTask, idx)}
                                  disabled={!canEditTask(panelTask)}
                                  title="Delete subtask"
                                  aria-label={`Delete subtask ${st.title}`}
                                  className="rounded p-1 text-rose-500 hover:bg-rose-500/10 disabled:opacity-40"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {openSubtaskIndex(panelTask._id, panelTask.subtasks) !== null ? (
                      <SubtaskDetailPanel
                        key={subtaskDetailKey}
                        subtask={panelTask.subtasks[openSubtaskIndex(panelTask._id, panelTask.subtasks)]}
                        readOnly={!canEditTask(panelTask)}
                        styles={styles}
                        isDark={isDark}
                        onClose={() => setSubtaskDetailKey(null)}
                        onChange={(patch) => patchSubtask(panelTask, openSubtaskIndex(panelTask._id, panelTask.subtasks), patch)}
                      />
                    ) : null}
                    </div>
                    <div className={`mt-2 flex items-center gap-2 rounded-xl border border-dashed px-3 py-2 ${isDark ? "border-slate-800" : "border-slate-200"}`}>
                      <Plus size={14} className={styles.label} />
                      <input
                        type="text"
                        value={inlineSubtaskInput}
                        disabled={!canEditTask(panelTask)}
                        onChange={(e) => setInlineSubtaskInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleInlineAddSubtask(panelTask); } }}
                        placeholder="Add a subtask..."
                        className={`h-6 min-w-0 flex-1 bg-transparent text-xs focus:outline-none ${styles.title}`}
                      />
                    </div>
                  </div>

                  <div className={`mt-5 flex items-center gap-3 border-t pt-4 ${isDark ? "border-white/5" : "border-slate-100"}`}>
                    <span className={`text-xs font-semibold ${styles.label}`}>Created by</span>
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-black uppercase ${
                      AVATAR_COLORS[(panelTask.createdBy?.name || "?").charCodeAt(0) % AVATAR_COLORS.length]
                    }`}>
                      {(panelTask.createdBy?.name || "?").slice(0, 2)}
                    </div>
                    <div className="min-w-0">
                      <p className={`truncate text-xs font-bold ${styles.title}`}>{panelTask.createdBy?.name || "System"}</p>
                      <p className={`text-[11px] ${styles.label}`}>{formatDate(panelTask.createdAt)}</p>
                    </div>
                  </div>

                  <div className={`mt-5 border-t pt-4 ${isDark ? "border-white/5" : "border-slate-100"}`}>
                    <p className={`text-sm font-black ${styles.title}`}>Activity</p>
                    <div className="mt-3 space-y-3">
                      {panelTask.status === "COMPLETED" && (
                        <div className="flex items-start gap-3">
                          <span className="mt-1 h-3 w-3 shrink-0 rounded-full border-2 border-emerald-500 bg-emerald-500/30" />
                          <div className="flex min-w-0 flex-1 flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className={`text-xs font-bold ${styles.title}`}>Task completed</p>
                              <p className={`text-[11px] ${styles.label}`}>Marked completed</p>
                            </div>
                            <span className={`text-[11px] ${styles.label}`}>{formatDateTime(panelTask.updatedAt)}</span>
                          </div>
                        </div>
                      )}
                      <div className="flex items-start gap-3">
                        <span className="mt-1 h-3 w-3 shrink-0 rounded-full border-2 border-sky-500 bg-sky-500/30" />
                        <div className="flex min-w-0 flex-1 flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className={`text-xs font-bold ${styles.title}`}>Task created</p>
                            <p className={`truncate text-[11px] ${styles.label}`}>
                              {panelTask.createdBy?.name || "System"} created this task
                            </p>
                          </div>
                          <span className={`text-[11px] ${styles.label}`}>{formatDateTime(panelTask.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
                  <ListTodo size={28} className={isDark ? "text-slate-700" : "text-slate-300"} />
                  <p className={`text-sm font-semibold ${styles.label}`}>Select a task to see its details</p>
                </div>
              )}
            </aside>
          </div>
        )}
        </>
        )}
      </div>

      {/* Task Details View Modal */}
      <AnimatePresence>
        {isDetailsOpen && detailsTask && (
          <div className="mobile-bottom-sheet fixed inset-0 z-[70] flex items-center justify-center p-0 sm:p-4">
            <Motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCloseDetails}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            />

            <Motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className={`mobile-fullscreen-panel relative z-10 flex max-h-[100dvh] w-full max-w-lg flex-col overflow-hidden rounded-[22px] border p-4 sm:max-h-[calc(100dvh-2rem)] sm:p-6 ${
                isDark ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"
              }`}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <h3 className={`text-base font-black uppercase tracking-wider ${styles.title}`}>
                  Task Details
                </h3>
                <button
                  onClick={handleCloseDetails}
                  className={`p-1 rounded-lg border ${styles.button}`}
                >
                  <X size={14} />
                </button>
              </div>

              {detailsLoading ? (
                <div className="flex flex-1 items-center justify-center py-12">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
                </div>
              ) : (
                <div className="mobile-modal-scroll scrollbar-hide flex-1 space-y-4">
                  {/* Title & Priority */}
                  <div className="flex items-start justify-between gap-2">
                    <h4 className={`text-lg font-bold leading-snug break-words ${styles.title}`}>
                      {detailsTask.title}
                    </h4>
                    {(() => {
                      const priority = PRIORITIES.find(p => p.value === detailsTask.priority) || PRIORITIES[1];
                      return (
                        <span className={`shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${priority.color}`}>
                          {priority.label}
                        </span>
                      );
                    })()}
                  </div>

                  {/* Status */}
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${styles.label}`}>Status:</span>
                    <select
                      aria-label="Task status"
                      value={detailsTask.status}
                      onChange={(e) => handleUpdateStatus(detailsTask._id, e.target.value)}
                      className={`h-8 rounded-lg border px-2 text-xs font-semibold ${styles.input}`}
                    >
                      {STATUS_COLUMNS.map(colOpt => (
                        <option key={colOpt.id} value={colOpt.id}>{colOpt.label}</option>
                      ))}
                    </select>
                    {isOverdue(detailsTask) && (
                      <span className="text-[9px] font-bold uppercase tracking-wider text-rose-500 bg-rose-500/10 border border-rose-500/20 px-1.5 py-0.5 rounded">
                        Overdue
                      </span>
                    )}
                  </div>

                  {/* Description */}
                  <div className="space-y-2">
                    <p className={`text-sm ${styles.text}`}>{detailsTask.status === "COMPLETED" ? "Completed. No further action is required unless the task needs to be reopened." : "Review the requirement below, mark the task In Progress when you start, and mark Completed when finished."}</p>
                    <div className="flex flex-wrap gap-2">
                      {detailsTask.status !== "COMPLETED" && <>
                        <button type="button" disabled={detailsTask.status === "IN_PROGRESS"} onClick={() => handleUpdateStatus(detailsTask._id, "IN_PROGRESS")} className={`rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50 ${styles.button}`}>In Progress / Ongoing</button>
                        <button type="button" disabled={detailsTask.status === "COMPLETED"} onClick={() => handleUpdateStatus(detailsTask._id, "COMPLETED")} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Mark Completed</button>
                      </>}
                      <button type="button" onClick={handleCloseDetails} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${styles.button}`}>Back to task list</button>
                    </div>
                  </div>
                  {detailsTask.description && (
                    <div className="space-y-1">
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${styles.label}`}>Description</span>
                      <p className={`text-sm whitespace-pre-wrap break-words ${styles.text}`}>{detailsTask.description}</p>
                    </div>
                  )}

                  {/* Tags */}
                  {detailsTask.tags && detailsTask.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {detailsTask.tags.map((t) => {
                        const colorClass = TAG_COLORS[t] || "bg-sky-500/10 text-sky-400 border-sky-500/20";
                        return (
                          <span key={t} className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${colorClass}`}>
                            {t}
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* Meta grid */}
                  <div className={`grid grid-cols-2 gap-3 rounded-xl border p-3 text-xs ${isDark ? "border-slate-800 bg-slate-950/40" : "border-slate-150 bg-slate-50/60"}`}>
                    <div>
                      <div className={`text-[10px] font-bold uppercase tracking-wider ${styles.label}`}>Due Date</div>
                      <div className={`mt-0.5 font-semibold ${isOverdue(detailsTask) ? "text-rose-500" : styles.title}`}>
                        {detailsTask.dueDate ? formatDate(detailsTask.dueDate) : "-"}
                      </div>
                    </div>
                    <div>
                      <div className={`text-[10px] font-bold uppercase tracking-wider ${styles.label}`}>Assignee</div>
                      <div
                        onClick={(e) => detailsTask.assignedTo && handleOpenAssigneeProfile(e, detailsTask.assignedTo)}
                        className={`mt-0.5 font-semibold ${styles.title} ${detailsTask.assignedTo && canViewProfiles ? "cursor-pointer underline decoration-dotted hover:text-sky-500 w-fit" : ""}`}
                        title={detailsTask.assignedTo && canViewProfiles ? `View ${detailsTask.assignedTo.name}'s profile` : undefined}
                      >
                        {detailsTask.assignedTo?.name || "Unassigned"}
                      </div>
                    </div>
                    {!isProductionExecutive && (
                      <div className="col-span-2">
                        <div className={`text-[10px] font-bold uppercase tracking-wider ${styles.label}`}>Linked Lead</div>
                        <div className={`mt-0.5 font-semibold ${styles.title}`}>
                          {detailsTask.leadId?.name || "-"}
                        </div>
                      </div>
                    )}
                    <div>
                      <div className={`text-[10px] font-bold uppercase tracking-wider ${styles.label}`}>Created By</div>
                      <div className={`mt-0.5 font-semibold ${styles.title}`}>
                        {detailsTask.createdBy?.name || "System"}
                      </div>
                    </div>
                    <div>
                      <div className={`text-[10px] font-bold uppercase tracking-wider ${styles.label}`}>Created On</div>
                      <div className={`mt-0.5 font-semibold ${styles.title}`}>
                        {detailsTask.createdAt ? formatDate(detailsTask.createdAt) : "-"}
                      </div>
                    </div>
                  </div>

                  {/* Subtasks */}
                  {detailsTask.subtasks && detailsTask.subtasks.length > 0 && (
                    <div className="space-y-2">
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${styles.label}`}>
                        Subtasks ({detailsTask.subtasks.filter(s => s.isCompleted).length}/{detailsTask.subtasks.length})
                      </span>
                      <div className={`grid gap-2 ${openSubtaskIndex(detailsTask._id, detailsTask.subtasks) !== null ? "sm:grid-cols-[minmax(0,1fr)_minmax(0,230px)]" : ""}`}>
                      <div className={`rounded-xl border p-2 space-y-1.5 ${isDark ? "border-slate-850 bg-slate-950/40" : "border-slate-150 bg-slate-50/50"}`}>
                        {detailsTask.subtasks.map((st, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-xs py-0.5">
                            {subtaskEditKey === `${detailsTask._id}:${idx}` ? (
                              <>
                                <input
                                  type="text"
                                  autoFocus
                                  value={subtaskEditValue}
                                  onChange={(e) => setSubtaskEditValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") { e.preventDefault(); handleSaveSubtaskEdit(detailsTask, idx); }
                                    if (e.key === "Escape") { e.preventDefault(); handleCancelSubtaskEdit(); }
                                  }}
                                  className={`h-8 min-w-0 flex-1 rounded-lg border px-2 text-xs ${styles.input}`}
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSaveSubtaskEdit(detailsTask, idx)}
                                  title="Save subtask"
                                  aria-label="Save subtask"
                                  className="rounded p-1 text-emerald-500 hover:bg-emerald-500/10"
                                >
                                  <Check size={13} />
                                </button>
                                <button
                                  type="button"
                                  onClick={handleCancelSubtaskEdit}
                                  title="Cancel"
                                  aria-label="Cancel subtask edit"
                                  className={`rounded p-1 ${styles.label} hover:bg-slate-500/10`}
                                >
                                  <X size={13} />
                                </button>
                              </>
                            ) : (
                            <>
                            <input
                              type="checkbox"
                              aria-label={st.title}
                              checked={st.isCompleted}
                              disabled={!canEditTask(detailsTask)}
                              onChange={() => handleInlineToggleSubtask(detailsTask, idx)}
                              className="h-3.5 w-3.5 shrink-0 rounded"
                            />
                            <button
                              type="button"
                              onClick={() => toggleSubtaskDetail(detailsTask._id, idx)}
                              aria-expanded={isSubtaskDetailOpen(detailsTask._id, idx)}
                              title="Open subtask details"
                              className={`min-w-0 flex-1 truncate text-left hover:underline ${st.isCompleted ? "line-through text-slate-500" : styles.text}`}
                            >
                              {st.title}
                            </button>
                            {subtaskMeta(st) ? (
                              <span className={`shrink-0 text-[10px] ${styles.label}`}>{subtaskMeta(st)}</span>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => handleStartSubtaskEdit(detailsTask, idx, st.title)}
                              disabled={!canEditTask(detailsTask)}
                              title="Edit subtask"
                              aria-label={`Edit subtask ${st.title}`}
                              className={`rounded p-1 ${styles.label} hover:bg-slate-500/10 disabled:opacity-40`}
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteSubtask(detailsTask, idx)}
                              disabled={!canEditTask(detailsTask)}
                              title="Delete subtask"
                              aria-label={`Delete subtask ${st.title}`}
                              className="rounded p-1 text-rose-500 hover:bg-rose-500/10 disabled:opacity-40"
                            >
                              <Trash2 size={13} />
                            </button>
                            </>
                            )}
                          </div>
                        ))}
                      </div>
                      {openSubtaskIndex(detailsTask._id, detailsTask.subtasks) !== null ? (
                        <SubtaskDetailPanel
                          key={subtaskDetailKey}
                          subtask={detailsTask.subtasks[openSubtaskIndex(detailsTask._id, detailsTask.subtasks)]}
                          readOnly={!canEditTask(detailsTask)}
                          styles={styles}
                          isDark={isDark}
                          onClose={() => setSubtaskDetailKey(null)}
                          onChange={(patch) => patchSubtask(detailsTask, openSubtaskIndex(detailsTask._id, detailsTask.subtasks), patch)}
                        />
                      ) : null}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  {isTaskReceiver(detailsTask) && <p className={`text-sm ${styles.label}`}>You can only change the status of this assigned task. Contact the task creator for other changes.</p>}
                  <div className={`mobile-safe-footer sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center justify-end gap-2 border-t px-4 pb-1 pt-3 sm:mx-0 sm:px-0 ${
                    isDark ? "border-white/5 bg-slate-900" : "border-slate-200 bg-white"
                  }`}>
                    <button
                      disabled={!canDeleteTask(detailsTask)}
                      onClick={() => {
                        handleCloseDetails();
                        handleDeleteTask(detailsTask._id);
                      }}
                      className="h-10 px-4 rounded-xl border border-rose-500/20 text-rose-500 hover:bg-rose-500/10 text-sm font-semibold"
                    >
                      Delete
                    </button>
                    <button
                      disabled={!canEditTask(detailsTask)}
                      onClick={() => {
                        handleCloseDetails();
                        handleOpenEditModal(detailsTask);
                      }}
                      className={`h-10 px-5 rounded-xl text-sm font-semibold ${styles.primaryButton}`}
                    >
                      Edit Task
                    </button>
                  </div>
                </div>
              )}
            </Motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Task Creation / Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="mobile-bottom-sheet fixed inset-0 z-[70] flex items-center justify-center p-0 sm:p-4">
            {/* Backdrop */}
            <Motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            />

            {/* Modal Box */}
            <Motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className={`mobile-fullscreen-panel relative z-10 flex max-h-[100dvh] w-full max-w-2xl flex-col overflow-hidden rounded-[22px] border p-4 sm:max-h-[calc(100dvh-2rem)] sm:p-6 ${
                isDark ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"
              }`}
            >
              {/* Header */}
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${isDark ? "bg-sky-500/10 text-sky-400" : "bg-sky-50 text-sky-600"}`}>
                    <ListTodo size={18} />
                  </div>
                  <div>
                    <h3 className={`text-sm font-black ${styles.title}`}>
                      {editingTask ? "Edit Task" : "New Task"}
                    </h3>
                    <p className={`text-[11px] ${styles.label}`}>
                      {editingTask ? "Update details, assignment, or checklist" : "Fill in what matters — the rest can wait"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className={`rounded-lg border p-1.5 ${styles.button}`}
                >
                  <X size={14} />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="tasks-edit-form mobile-modal-scroll scrollbar-hide flex-1 space-y-4">
                {/* Title - the focal point: bigger and bolder than every other field, not boxless */}
                <div>
                  <input
                    type="text"
                    required
                    autoFocus
                    placeholder="What needs to be done?"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    className={`h-12 w-full rounded-xl border px-3.5 text-base font-bold ${styles.input}`}
                  />
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <label className={`flex items-center gap-1.5 text-xs font-semibold ${styles.label}`}>
                    <AlignLeft size={14} /> Description
                  </label>
                  <textarea
                    placeholder="Add notes, instructions, or goals..."
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    className={`h-16 w-full resize-none rounded-xl border px-3 py-2 text-sm ${styles.input}`}
                  />
                </div>

                {/* Details card: priority, status, due date, assignee, lead — icon rows */}
                <div className={`tasks-edit-fields divide-y overflow-hidden rounded-xl border ${isDark ? "divide-white/5 border-slate-800" : "divide-slate-100 border-slate-200"}`}>
                  {/* Priority */}
                  <div className="flex flex-wrap items-center gap-2 p-2.5">
                    <div className={`flex w-24 shrink-0 items-center gap-2 text-xs font-semibold sm:w-28 ${styles.label}`}>
                      <Flag size={14} /> Priority
                    </div>
                    <div className="flex min-w-0 flex-1 gap-1.5">
                      {PRIORITIES.map(p => (
                        <button
                          type="button"
                          key={p.value}
                          onClick={() => setFormData(prev => ({ ...prev, priority: p.value }))}
                          className={`h-8 flex-1 rounded-lg border text-xs font-bold transition-all ${
                            formData.priority === p.value ? `${p.color} ring-1 ring-inset ring-current` : styles.button
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Status */}
                  <div className="flex flex-wrap items-center gap-2 p-2.5">
                    <div className={`flex w-24 shrink-0 items-center gap-2 text-xs font-semibold sm:w-28 ${styles.label}`}>
                      <ListTodo size={14} /> Status
                    </div>
                    <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                      {STATUS_COLUMNS.map(col => (
                        <button
                          type="button"
                          key={col.id}
                          onClick={() => setFormData(prev => ({ ...prev, status: col.id }))}
                          className={`h-8 min-w-[72px] flex-1 rounded-lg border px-2 text-xs font-bold transition-all ${
                            formData.status === col.id ? `${col.color} ring-1 ring-inset ring-current` : styles.button
                          }`}
                        >
                          {col.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Due Date */}
                  <div className="flex items-center gap-2 p-2.5">
                    <div className={`flex w-24 shrink-0 items-center gap-2 text-xs font-semibold sm:w-28 ${styles.label}`}>
                      <Calendar size={14} /> Due date
                    </div>
                    <input
                      type="date"
                      value={formData.dueDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
                      className={`h-8 min-w-0 flex-1 rounded-lg border px-2 text-xs ${styles.input}`}
                    />
                    {formData.dueDate && (
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, dueDate: "" }))}
                        className={`rounded-lg p-1.5 ${styles.label} hover:text-rose-500`}
                        title="Clear date"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>

                  {/* Assignee */}
                  <div className="flex items-center gap-2 p-2.5">
                    <div className={`flex w-24 shrink-0 items-center gap-2 text-xs font-semibold sm:w-28 ${styles.label}`}>
                      <User size={14} /> Assign to
                    </div>
                    <select
                      value={formData.assignedTo}
                      onChange={(e) => setFormData(prev => ({ ...prev, assignedTo: e.target.value }))}
                      className={`h-8 min-w-0 flex-1 rounded-lg border px-2 text-xs ${styles.input}`}
                    >
                      <option value="">Unassigned</option>
                      {assignableUsers.map(u => (
                        <option key={u._id} value={u._id}>
                          {String(u._id) === currentUserId
                            ? `${u.name} (Me)`
                            : `${u.name}${u.role ? ` — ${u.role}` : ""}`}
                        </option>
                      ))}
                    </select>
                    {currentUserId && String(formData.assignedTo) !== currentUserId && (
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, assignedTo: currentUserId }))}
                        title="Assign this task to me"
                        className={`h-8 shrink-0 rounded-lg border px-2.5 text-[11px] font-bold ${styles.button}`}
                      >
                        Me
                      </button>
                    )}
                  </div>

                  {/* Linked Lead */}
                  {!isProductionExecutive && (
                    <div className="flex items-center gap-2 p-2.5">
                      <div className={`flex w-24 shrink-0 items-center gap-2 text-xs font-semibold sm:w-28 ${styles.label}`}>
                        <LinkIcon size={14} /> Lead
                      </div>
                      <select
                        value={formData.leadId}
                        onChange={(e) => setFormData(prev => ({ ...prev, leadId: e.target.value }))}
                        className={`h-8 min-w-0 flex-1 rounded-lg border px-2 text-xs ${styles.input}`}
                      >
                        <option value="">No linked lead</option>
                        {leads.map(l => (
                          <option key={l._id} value={l._id}>{l.name} ({l.phone})</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Subtasks Section */}
                <div className="space-y-2">
                  <label className={`flex items-center gap-1.5 text-xs font-semibold ${styles.label}`}>
                    <CheckSquare size={14} /> Subtasks / Checklist
                  </label>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Add a subtask..."
                      value={newSubtaskTitle}
                      onChange={(e) => setNewSubtaskTitle(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddSubtask(); } }}
                      className={`flex-1 h-9 px-3 rounded-lg border text-xs ${styles.input}`}
                    />
                    <button
                      type="button"
                      onClick={handleAddSubtask}
                      className={`h-9 px-3 rounded-lg text-xs font-bold ${styles.button}`}
                    >
                      Add
                    </button>
                  </div>

                  {formData.subtasks && formData.subtasks.length > 0 && (
                    <div className={`grid gap-2 ${openSubtaskIndex("form", formData.subtasks) !== null ? "sm:grid-cols-[minmax(0,1fr)_minmax(0,230px)]" : ""}`}>
                    <div className={`scrollbar-hide rounded-xl border p-2 space-y-1.5 max-h-32 overflow-y-auto ${
                      isDark ? "border-slate-850 bg-slate-950/40" : "border-slate-150 bg-slate-50/50"
                    }`}>
                      {formData.subtasks.map((st, idx) => (
                        <div key={idx} className="flex items-center justify-between gap-1 text-xs py-0.5">
                          {formSubtaskEditIndex === idx ? (
                            <>
                              <input
                                type="text"
                                autoFocus
                                value={formSubtaskEditValue}
                                onChange={(e) => setFormSubtaskEditValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") { e.preventDefault(); handleSaveFormSubtaskEdit(); }
                                  if (e.key === "Escape") { e.preventDefault(); handleCancelFormSubtaskEdit(); }
                                }}
                                className={`h-8 min-w-0 flex-1 rounded-lg border px-2 text-xs ${styles.input}`}
                              />
                              <button
                                type="button"
                                onClick={handleSaveFormSubtaskEdit}
                                title="Save subtask"
                                aria-label="Save subtask"
                                className="text-emerald-500 hover:text-emerald-400 p-1 rounded"
                              >
                                <Check size={12} />
                              </button>
                              <button
                                type="button"
                                onClick={handleCancelFormSubtaskEdit}
                                title="Cancel"
                                aria-label="Cancel subtask edit"
                                className="text-slate-400 hover:text-slate-300 p-1 rounded"
                              >
                                <X size={12} />
                              </button>
                            </>
                          ) : (
                            <>
                              <input
                                type="checkbox"
                                aria-label={st.title}
                                checked={st.isCompleted}
                                onChange={() => handleToggleSubtaskInForm(idx)}
                                className="rounded border-slate-700 bg-transparent text-sky-500 focus:ring-0 focus:ring-offset-0"
                              />
                              <button
                                type="button"
                                onClick={() => toggleSubtaskDetail("form", idx)}
                                aria-expanded={isSubtaskDetailOpen("form", idx)}
                                title="Open subtask details"
                                className={`min-w-0 flex-1 truncate pr-2 text-left hover:underline ${st.isCompleted ? "line-through text-slate-500" : styles.text}`}
                              >
                                {st.title}
                              </button>
                              {subtaskMeta(st) ? (
                                <span className={`shrink-0 text-[10px] ${styles.label}`}>{subtaskMeta(st)}</span>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => handleStartFormSubtaskEdit(idx, st.title)}
                                title="Edit subtask"
                                aria-label={`Edit subtask ${st.title}`}
                                className="text-slate-400 hover:text-sky-400 p-1 rounded"
                              >
                                <Edit2 size={12} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveSubtask(idx)}
                                title="Delete subtask"
                                aria-label={`Delete subtask ${st.title}`}
                                className="text-rose-500 hover:text-rose-400 p-1 rounded"
                              >
                                <Trash2 size={12} />
                              </button>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                    {openSubtaskIndex("form", formData.subtasks) !== null ? (
                      <SubtaskDetailPanel
                        key={subtaskDetailKey}
                        subtask={formData.subtasks[openSubtaskIndex("form", formData.subtasks)]}
                        styles={styles}
                        isDark={isDark}
                        onClose={() => setSubtaskDetailKey(null)}
                        onChange={(patch) => patchFormSubtask(openSubtaskIndex("form", formData.subtasks), patch)}
                      />
                    ) : null}
                    </div>
                  )}
                </div>

                {/* Tags Section */}
                <div className="space-y-2">
                  <label className={`flex items-center gap-1.5 text-xs font-semibold ${styles.label}`}>
                    <Tag size={14} /> Category Tags
                  </label>

                  <div className="flex flex-wrap gap-1.5">
                    {["Call", "Meeting", "Document", "Site Visit", "Urgent", "Follow-up"].map((t) => {
                      const isSelected = formData.tags && formData.tags.includes(t);
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => handleToggleTag(t)}
                          className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors ${
                            isSelected
                              ? "bg-sky-500/20 text-sky-400 border-sky-500/40"
                              : isDark
                                ? "border-slate-850 text-slate-400 hover:bg-slate-800"
                                : "border-slate-200 text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          {t}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Or type custom tag..."
                      value={newTagInput}
                      onChange={(e) => setNewTagInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddCustomTag(); } }}
                      className={`flex-1 h-9 px-3 rounded-lg border text-xs ${styles.input}`}
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomTag}
                      className={`h-9 px-3 rounded-lg text-xs font-bold ${styles.button}`}
                    >
                      Add Tag
                    </button>
                  </div>

                  {formData.tags && formData.tags.filter(t => !["Call", "Meeting", "Document", "Site Visit", "Urgent", "Follow-up"].includes(t)).length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {formData.tags
                        .filter(t => !["Call", "Meeting", "Document", "Site Visit", "Urgent", "Follow-up"].includes(t))
                        .map(t => (
                          <span
                            key={t}
                            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${
                              isDark ? "bg-slate-850 text-slate-300 border-slate-700" : "bg-slate-100 text-slate-700 border-slate-200"
                            }`}
                          >
                            {t}
                            <button
                              type="button"
                              onClick={() => handleToggleTag(t)}
                              className="text-slate-400 hover:text-slate-200"
                            >
                              <X size={8} />
                            </button>
                          </span>
                        ))
                      }
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className={`mobile-safe-footer sticky bottom-0 z-10 -mx-4 flex items-center justify-end gap-2 border-t px-4 pb-1 pt-3 sm:mx-0 sm:px-0 ${
                  isDark ? "border-white/5 bg-slate-900" : "border-slate-200 bg-white"
                }`}>
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className={`h-10 px-4 rounded-xl border text-sm font-semibold ${styles.button}`}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !formData.title.trim()}
                    className={`flex h-10 items-center gap-1.5 rounded-xl px-5 text-sm font-semibold disabled:opacity-50 ${styles.primaryButton}`}
                  >
                    {submitting ? (
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    ) : (
                      <Check size={15} />
                    )}
                    {submitting ? "Saving..." : editingTask ? "Save Changes" : "Create Task"}
                  </button>
                </div>
              </form>
            </Motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
