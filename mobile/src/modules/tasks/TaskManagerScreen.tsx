import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, { DateTimePickerAndroid, type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { Screen } from "../../components/common/Screen";
import { AppButton, AppCard, AppChip, AppInput } from "../../components/common/ui";
import { useAuth } from "../../context/AuthContext";
import { clay, colors, radii } from "../../theme/tokens";
import { toErrorMessage } from "../../utils/errorMessage";
import {
  createTask,
  deleteTask,
  getTasks,
  getTaskStats,
  updateTask,
  type Task,
} from "../../services/taskService";
import { getUsers } from "../../services/userService";
import { getAllLeads } from "../../services/leadService";

const STATUS_OPTIONS = [
  { id: "BACKLOG", label: "Backlog", color: "#64748b", bg: "#f1f5f9", border: "#cbd5e1" },
  { id: "TODO", label: "To Do", color: "#0284c7", bg: "#e0f2fe", border: "#bae6fd" },
  { id: "IN_PROGRESS", label: "In Progress", color: "#d97706", bg: "#fef3c7", border: "#fde68a" },
  { id: "COMPLETED", label: "Completed", color: "#059669", bg: "#d1fae5", border: "#a7f3d0" },
];

const PRIORITY_OPTIONS = [
  { id: "LOW", label: "Low", color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe" },
  { id: "MEDIUM", label: "Medium", color: "#d97706", bg: "#fef3c7", border: "#fde68a" },
  { id: "HIGH", label: "High", color: "#b91c1c", bg: "#fef2f2", border: "#fecaca" },
];

const PREDEFINED_TAGS = ["Call", "Meeting", "Document", "Site Visit", "Urgent", "Follow-up"];

export const TaskManagerScreen = () => {
  const insets = useSafeAreaInsets();
  const { user, role } = useAuth();
  const isAdmin = role === "ADMIN" || (role as string) === "SUPER_ADMIN";
  const isProductionTaskRole = ["PRODUCTION_EXECUTIVE", "COMMUNITY_MANAGER"].includes(String(role || ""));

  // Data States
  const [tasks, setTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState({
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
  });
  const [teamUsers, setTeamUsers] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);

  // UI States
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Filters State
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [leadFilter, setLeadFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");

  // Grouping & Sorting State
  const [groupBy, setGroupBy] = useState<"status" | "priority" | "assignee">("status");
  const [sortBy, setSortBy] = useState<"createdNewest" | "dueDate" | "priority" | "title">("createdNewest");

  // Collapsed Groups State
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  // Modal / Form States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    status: "TODO",
    priority: "MEDIUM",
    dueDate: "",
    assignedTo: "",
    leadId: "",
    subtasks: [] as Array<{ title: string; isCompleted: boolean }>,
    tags: [] as string[],
  });

  // Form Inputs
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [newTagInput, setNewTagInput] = useState("");

  // Date Picker States
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerSeed, setDatePickerSeed] = useState<Date>(new Date());

  // Picker Overlay Dropdowns
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [priorityDropdownOpen, setPriorityDropdownOpen] = useState(false);
  const [assigneeDropdownOpen, setAssigneeDropdownOpen] = useState(false);
  const [leadDropdownOpen, setLeadDropdownOpen] = useState(false);

  // Load stats and data
  const loadData = useCallback(async (quiet = false) => {
    try {
      if (quiet) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError("");

      const filters: Record<string, any> = {};
      if (statusFilter) filters.status = statusFilter;
      if (priorityFilter) filters.priority = priorityFilter;
      if (assigneeFilter) filters.assignedTo = assigneeFilter;
      if (!isProductionTaskRole && leadFilter) filters.leadId = leadFilter;
      if (searchQuery.trim()) filters.search = searchQuery.trim();
      if (tagFilter) filters.tag = tagFilter;

      const [tasksResult, statsResult, usersResult, leadsResult] = await Promise.allSettled([
        getTasks(filters),
        getTaskStats(),
        getUsers(),
        isProductionTaskRole ? Promise.resolve([]) : getAllLeads(),
      ]);

      if (tasksResult.status === "fulfilled") {
        setTasks(tasksResult.value || []);
      } else {
        console.error("Failed to load tasks", tasksResult.reason);
      }

      if (statsResult.status === "fulfilled" && statsResult.value) {
        setStats(statsResult.value);
      }

      if (usersResult.status === "fulfilled" && usersResult.value?.users) {
        setTeamUsers(usersResult.value.users.filter((u: any) => u.isActive));
      }

      if (leadsResult.status === "fulfilled") {
        setLeads(leadsResult.value || []);
      }
    } catch (err) {
      setError(toErrorMessage(err, "Failed to load dashboard data"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter, priorityFilter, assigneeFilter, leadFilter, searchQuery, tagFilter, isProductionTaskRole]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Flash messages auto dismiss
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(""), 2500);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(""), 4500);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Sorting & Grouping
  const sortedTasks = useMemo(() => {
    const list = [...tasks];
    if (sortBy === "dueDate") {
      list.sort((a, b) => {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      });
    } else if (sortBy === "priority") {
      const weight: Record<string, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };
      list.sort((a, b) => (weight[b.priority || "MEDIUM"] || 0) - (weight[a.priority || "MEDIUM"] || 0));
    } else if (sortBy === "title") {
      list.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    } else {
      // createdNewest
      list.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });
    }
    return list;
  }, [tasks, sortBy]);

  const groups = useMemo(() => {
    const map: Record<string, { label: string; tasks: Task[]; key: string; colorStyle?: any }> = {};

    if (groupBy === "status") {
      STATUS_OPTIONS.forEach((opt) => {
        map[opt.id] = { label: opt.label, tasks: [], key: opt.id, colorStyle: opt };
      });
      sortedTasks.forEach((t) => {
        const key = t.status || "TODO";
        if (map[key]) {
          map[key].tasks.push(t);
        } else {
          // fallback
          if (!map["TODO"]) {
            map["TODO"] = { label: "To Do", tasks: [], key: "TODO" };
          }
          map["TODO"].tasks.push(t);
        }
      });
    } else if (groupBy === "priority") {
      PRIORITY_OPTIONS.forEach((opt) => {
        map[opt.id] = { label: opt.label + " Priority", tasks: [], key: opt.id, colorStyle: opt };
      });
      sortedTasks.forEach((t) => {
        const key = t.priority || "MEDIUM";
        if (map[key]) {
          map[key].tasks.push(t);
        }
      });
    } else {
      // assignee
      map["unassigned"] = { label: "Unassigned", tasks: [], key: "unassigned" };
      teamUsers.forEach((u) => {
        map[u._id] = { label: u.name, tasks: [], key: u._id };
      });
      sortedTasks.forEach((t) => {
        const assignId = t.assignedTo && typeof t.assignedTo === "object" ? t.assignedTo._id : t.assignedTo;
        const key = assignId || "unassigned";
        if (map[key]) {
          map[key].tasks.push(t);
        } else {
          map["unassigned"].tasks.push(t);
        }
      });
    }

    return Object.values(map).filter((g) => g.tasks.length > 0 || groupBy === "status");
  }, [groupBy, sortedTasks, teamUsers]);

  // Toggles Collapsed Group
  const toggleGroup = (key: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Toggle Task Completion
  const handleToggleTaskStatus = async (task: Task) => {
    const newStatus = task.status === "COMPLETED" ? "TODO" : "COMPLETED";
    try {
      // optimistic update
      setTasks((prev) =>
        prev.map((t) => (t._id === task._id ? { ...t, status: newStatus } : t))
      );
      await updateTask(task._id, { status: newStatus });
      setSuccess("Task updated");
      void loadData(true);
    } catch (err) {
      setError(toErrorMessage(err, "Failed to toggle task status"));
      void loadData(true);
    }
  };

  // Open Form Modal
  const openCreateModal = () => {
    setEditingTask(null);
    setFormData({
      title: "",
      description: "",
      status: "TODO",
      priority: "MEDIUM",
      dueDate: "",
      assignedTo: "",
      leadId: "",
      subtasks: [],
      tags: [],
    });
    setNewSubtaskTitle("");
    setNewTagInput("");
    setIsModalOpen(true);
  };

  const openEditModal = (task: Task) => {
    setEditingTask(task);
    const assignId = task.assignedTo && typeof task.assignedTo === "object" ? task.assignedTo._id : (task.assignedTo || "");
    const leadId = task.leadId && typeof task.leadId === "object" ? task.leadId._id : (task.leadId || "");
    setFormData({
      title: task.title || "",
      description: task.description || "",
      status: task.status || "TODO",
      priority: task.priority || "MEDIUM",
      dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split("T")[0] : "",
      assignedTo: assignId,
      leadId: leadId,
      subtasks: task.subtasks || [],
      tags: task.tags || [],
    });
    setNewSubtaskTitle("");
    setNewTagInput("");
    setIsModalOpen(true);
  };

  // Submit form
  const handleSaveTask = async () => {
    if (!formData.title.trim()) {
      setError("Task title is required");
      return;
    }
    setSaving(true);
    setError("");

    const payload = {
      title: formData.title.trim(),
      description: formData.description.trim(),
      status: formData.status,
      priority: formData.priority,
      dueDate: formData.dueDate || null,
      assignedTo: (formData.assignedTo || null) as any,
      leadId: (isProductionTaskRole ? null : formData.leadId || null) as any,
      subtasks: formData.subtasks,
      tags: formData.tags,
    };

    try {
      if (editingTask) {
        const res = await updateTask(editingTask._id, payload);
        if (res) {
          setSuccess("Task updated successfully");
          setIsModalOpen(false);
          void loadData(true);
        }
      } else {
        const res = await createTask(payload);
        if (res) {
          setSuccess("Task created successfully");
          setIsModalOpen(false);
          void loadData(true);
        }
      }
    } catch (err) {
      setError(toErrorMessage(err, "Failed to save task"));
    } finally {
      setSaving(false);
    }
  };

  // Delete task
  const handleDeleteTask = (taskId: string) => {
    const proceedDelete = async () => {
      try {
        setSaving(true);
        await deleteTask(taskId);
        setSuccess("Task deleted successfully");
        setIsModalOpen(false);
        void loadData(true);
      } catch (err) {
        setError(toErrorMessage(err, "Failed to delete task"));
      } finally {
        setSaving(false);
      }
    };

    if (Platform.OS === "web") {
      const conf = typeof window !== "undefined" && window.confirm("Are you sure you want to delete this task?");
      if (conf) void proceedDelete();
      return;
    }

    Alert.alert("Delete Task", "Are you sure you want to delete this task?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => void proceedDelete() },
    ]);
  };

  // Date picker handlers
  const triggerDatePicker = () => {
    const seed = formData.dueDate ? new Date(formData.dueDate) : new Date();
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: seed,
        mode: "date",
        onChange: (event: DateTimePickerEvent, date?: Date) => {
          if (event.type !== "set" || !date) return;
          setFormData((prev) => ({ ...prev, dueDate: date.toISOString().split("T")[0] }));
        },
      });
      return;
    }
    setDatePickerSeed(seed);
    setShowDatePicker(true);
  };

  const onDatePickerChange = (event: DateTimePickerEvent, date?: Date) => {
    if (event.type === "dismissed") {
      setShowDatePicker(false);
      return;
    }
    if (date) {
      setFormData((prev) => ({ ...prev, dueDate: date.toISOString().split("T")[0] }));
    }
    setShowDatePicker(false);
  };

  // Subtasks checklist modifications
  const addSubtask = () => {
    if (!newSubtaskTitle.trim()) return;
    setFormData((prev) => ({
      ...prev,
      subtasks: [...prev.subtasks, { title: newSubtaskTitle.trim(), isCompleted: false }],
    }));
    setNewSubtaskTitle("");
  };

  const toggleSubtaskInForm = (idx: number) => {
    setFormData((prev) => {
      const list = [...prev.subtasks];
      if (list[idx]) {
        list[idx] = { ...list[idx], isCompleted: !list[idx].isCompleted };
      }
      return { ...prev, subtasks: list };
    });
  };

  const deleteSubtask = (idx: number) => {
    setFormData((prev) => ({
      ...prev,
      subtasks: prev.subtasks.filter((_, i) => i !== idx),
    }));
  };

  // Tags management
  const toggleTagSelection = (tag: string) => {
    setFormData((prev) => {
      const exists = prev.tags.includes(tag);
      return {
        ...prev,
        tags: exists ? prev.tags.filter((t) => t !== tag) : [...prev.tags, tag],
      };
    });
  };

  const addCustomTag = () => {
    const cleaned = newTagInput.trim();
    if (!cleaned) return;
    setFormData((prev) => {
      if (prev.tags.includes(cleaned)) return prev;
      return { ...prev, tags: [...prev.tags, cleaned] };
    });
    setNewTagInput("");
  };

  // Helper date status
  const getOverdueInfo = (task: Task) => {
    if (task.status === "COMPLETED" || !task.dueDate) return { overdue: false, text: "" };
    const date = new Date(task.dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const overdue = date < today;
    return {
      overdue,
      text: overdue ? "Overdue" : `Due: ${task.dueDate.split("T")[0]}`,
    };
  };

  const currentAssigneeName = useMemo(() => {
    const selected = teamUsers.find((u) => u._id === formData.assignedTo);
    return selected?.name || "Unassigned";
  }, [formData.assignedTo, teamUsers]);

  const currentLeadName = useMemo(() => {
    const selected = leads.find((l) => l._id === formData.leadId);
    return selected?.name || "None";
  }, [formData.leadId, leads]);

  return (
    <Screen title="Task Desk" subtitle="Operational Todo Lists" loading={loading} error={error}>
      <FlatList
        data={groups}
        keyExtractor={(item) => item.key}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadData(true)} />}
        contentContainerStyle={{ paddingBottom: 64 + insets.bottom }}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={{ marginBottom: 12 }}>
            {success ? <Text style={styles.success}>{success}</Text> : null}

            {/* Quick Stats Grid */}
            <View style={styles.statsGrid}>
              <View style={styles.statsCard}>
                <Ionicons name="list" size={16} color="#64748b" />
                <Text style={styles.statsLabel}>Total</Text>
                <Text style={styles.statsValue}>{stats.total}</Text>
              </View>
              <View style={[styles.statsCard, { borderColor: "#fde68a" }]}>
                <Ionicons name="time-outline" size={16} color="#d97706" />
                <Text style={styles.statsLabel}>Pending</Text>
                <Text style={[styles.statsValue, { color: "#d97706" }]}>{stats.pending}</Text>
              </View>
              <View style={[styles.statsCard, { borderColor: "#a7f3d0" }]}>
                <Ionicons name="checkmark-circle-outline" size={16} color="#059669" />
                <Text style={styles.statsLabel}>Done</Text>
                <Text style={[styles.statsValue, { color: "#059669" }]}>{stats.COMPLETED}</Text>
              </View>
              <View style={[styles.statsCard, { borderColor: "#fecaca" }]}>
                <Ionicons name="alert-circle-outline" size={16} color="#b91c1c" />
                <Text style={styles.statsLabel}>Overdue</Text>
                <Text style={[styles.statsValue, { color: "#b91c1c" }]}>{stats.overdue}</Text>
              </View>
            </View>

            {/* Controls Bar */}
            <View style={styles.toolbar}>
              <View style={styles.searchRow}>
                <Ionicons name="search" size={16} color="#64748b" style={styles.searchIcon} />
                <AppInput
                  style={styles.searchInput as object}
                  placeholder="Search title, description..."
                  value={searchQuery}
                  onChangeText={(val) => {
                    setSearchQuery(val);
                    void loadData(true);
                  }}
                />
                {searchQuery ? (
                  <Pressable
                    style={styles.clearSearchBtn}
                    onPress={() => {
                      setSearchQuery("");
                      void loadData(true);
                    }}
                  >
                    <Ionicons name="close-circle" size={16} color="#64748b" />
                  </Pressable>
                ) : null}
              </View>

              <View style={styles.groupSortRow}>
                <View style={styles.selectBtnContainer}>
                  <Text style={styles.selectBtnTitle}>Group:</Text>
                  <View style={styles.selectBtnWrap}>
                    <Pressable
                      style={[styles.smallToggleBtn, groupBy === "status" && styles.smallToggleBtnActive]}
                      onPress={() => setGroupBy("status")}
                    >
                      <Text style={[styles.smallToggleBtnText, groupBy === "status" && styles.smallToggleBtnTextActive]}>Status</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.smallToggleBtn, groupBy === "priority" && styles.smallToggleBtnActive]}
                      onPress={() => setGroupBy("priority")}
                    >
                      <Text style={[styles.smallToggleBtnText, groupBy === "priority" && styles.smallToggleBtnTextActive]}>Priority</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.smallToggleBtn, groupBy === "assignee" && styles.smallToggleBtnActive]}
                      onPress={() => setGroupBy("assignee")}
                    >
                      <Text style={[styles.smallToggleBtnText, groupBy === "assignee" && styles.smallToggleBtnTextActive]}>Assignee</Text>
                    </Pressable>
                  </View>
                </View>

                <View style={styles.selectBtnContainer}>
                  <Text style={styles.selectBtnTitle}>Sort:</Text>
                  <View style={styles.selectBtnWrap}>
                    <Pressable
                      style={[styles.smallToggleBtn, sortBy === "createdNewest" && styles.smallToggleBtnActive]}
                      onPress={() => setSortBy("createdNewest")}
                    >
                      <Text style={[styles.smallToggleBtnText, sortBy === "createdNewest" && styles.smallToggleBtnTextActive]}>Newest</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.smallToggleBtn, sortBy === "dueDate" && styles.smallToggleBtnActive]}
                      onPress={() => setSortBy("dueDate")}
                    >
                      <Text style={[styles.smallToggleBtnText, sortBy === "dueDate" && styles.smallToggleBtnTextActive]}>Due</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.smallToggleBtn, sortBy === "priority" && styles.smallToggleBtnActive]}
                      onPress={() => setSortBy("priority")}
                    >
                      <Text style={[styles.smallToggleBtnText, sortBy === "priority" && styles.smallToggleBtnTextActive]}>Priority</Text>
                    </Pressable>
                  </View>
                </View>
              </View>

              {/* Filters Scroll */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersRow}>
                <Text style={styles.filterTextLabel}>Filters:</Text>
                
                {/* Status Filter */}
                <Pressable
                  style={[styles.filterChip, !!statusFilter && styles.filterChipActive]}
                  onPress={() => {
                    const idx = STATUS_OPTIONS.findIndex((s) => s.id === statusFilter);
                    const next = STATUS_OPTIONS[idx + 1]?.id || "";
                    setStatusFilter(next);
                  }}
                >
                  <Text style={[styles.filterChipText, !!statusFilter && styles.filterChipTextActive]}>
                    Status: {statusFilter ? STATUS_OPTIONS.find((s) => s.id === statusFilter)?.label : "All"}
                  </Text>
                </Pressable>

                {/* Priority Filter */}
                <Pressable
                  style={[styles.filterChip, !!priorityFilter && styles.filterChipActive]}
                  onPress={() => {
                    const idx = PRIORITY_OPTIONS.findIndex((p) => p.id === priorityFilter);
                    const next = PRIORITY_OPTIONS[idx + 1]?.id || "";
                    setPriorityFilter(next);
                  }}
                >
                  <Text style={[styles.filterChipText, !!priorityFilter && styles.filterChipTextActive]}>
                    Priority: {priorityFilter ? PRIORITY_OPTIONS.find((p) => p.id === priorityFilter)?.label : "All"}
                  </Text>
                </Pressable>

                {/* Tag Filter */}
                <Pressable
                  style={[styles.filterChip, !!tagFilter && styles.filterChipActive]}
                  onPress={() => {
                    const idx = PREDEFINED_TAGS.indexOf(tagFilter);
                    const next = PREDEFINED_TAGS[idx + 1] || "";
                    setTagFilter(next);
                  }}
                >
                  <Text style={[styles.filterChipText, !!tagFilter && styles.filterChipTextActive]}>
                    Tag: {tagFilter || "All"}
                  </Text>
                </Pressable>

                {(!!statusFilter || !!priorityFilter || !!tagFilter || !!searchQuery) && (
                  <Pressable
                    style={styles.clearFiltersBtn}
                    onPress={() => {
                      setStatusFilter("");
                      setPriorityFilter("");
                      setTagFilter("");
                      setSearchQuery("");
                      void loadData(true);
                    }}
                  >
                    <Text style={styles.clearFiltersText}>Clear</Text>
                  </Pressable>
                )}
              </ScrollView>

              <AppButton title="+ Create Task" onPress={openCreateModal} style={{ marginTop: 8 }} />
            </View>
          </View>
        }
        renderItem={({ item }) => {
          const isCollapsed = collapsedGroups[item.key];
          const colorStyles = item.colorStyle;

          return (
            <View style={styles.groupContainer}>
              <Pressable
                style={[
                  styles.groupHeader,
                  colorStyles && { backgroundColor: colorStyles.bg, borderColor: colorStyles.border },
                ]}
                onPress={() => toggleGroup(item.key)}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Ionicons
                    name={isCollapsed ? "chevron-forward" : "chevron-down"}
                    size={16}
                    color={colorStyles ? colorStyles.color : "#64748b"}
                  />
                  <Text
                    style={[
                      styles.groupTitle,
                      colorStyles && { color: colorStyles.color },
                    ]}
                  >
                    {item.label}
                  </Text>
                  <View
                    style={[
                      styles.groupBadge,
                      {
                        backgroundColor: colorStyles ? colorStyles.color : "#64748b",
                      },
                    ]}
                  >
                    <Text style={styles.groupBadgeText}>{item.tasks.length}</Text>
                  </View>
                </View>
              </Pressable>

              {!isCollapsed && (
                <View style={styles.groupList}>
                  {item.tasks.map((task) => {
                    const isCompleted = task.status === "COMPLETED";
                    const priorityStyle = PRIORITY_OPTIONS.find((p) => p.id === task.priority) || PRIORITY_OPTIONS[1];
                    const dueInfo = getOverdueInfo(task);

                    return (
                      <View key={task._id} style={[styles.taskCard, isCompleted && styles.taskCardCompleted]}>
                        <View style={styles.taskCardRow}>
                          <Pressable
                            style={[styles.checkbox, isCompleted && styles.checkboxCompleted]}
                            onPress={() => void handleToggleTaskStatus(task)}
                          >
                            {isCompleted && <Ionicons name="checkmark" size={14} color="#fff" />}
                          </Pressable>

                          <Pressable style={{ flex: 1 }} onPress={() => openEditModal(task)}>
                            <Text style={[styles.taskTitle, isCompleted && styles.taskTitleCompleted]}>
                              {task.title}
                            </Text>
                            {task.description ? (
                              <Text style={styles.taskDesc} numberOfLines={2}>
                                {task.description}
                              </Text>
                            ) : null}

                            <View style={styles.taskMetaRow}>
                              {/* Priority */}
                              <View
                                style={[
                                  styles.badge,
                                  {
                                    backgroundColor: priorityStyle.bg,
                                    borderColor: priorityStyle.border,
                                  },
                                ]}
                              >
                                <Text style={[styles.badgeText, { color: priorityStyle.color }]}>
                                  {priorityStyle.label}
                                </Text>
                              </View>

                              {/* Due Date */}
                              {task.dueDate ? (
                                <View
                                  style={[
                                    styles.badge,
                                    dueInfo.overdue && { backgroundColor: "#fef2f2", borderColor: "#fecaca" },
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.badgeText,
                                      { color: dueInfo.overdue ? "#b91c1c" : "#64748b" },
                                      dueInfo.overdue && { fontWeight: "700" },
                                    ]}
                                  >
                                    {dueInfo.text}
                                  </Text>
                                </View>
                              ) : null}

                              {/* Assignee */}
                              {task.assignedTo ? (
                                <View style={styles.badge}>
                                  <Text style={styles.badgeText}>
                                    Assigned: {task.assignedTo && typeof task.assignedTo === "object" ? task.assignedTo.name : task.assignedTo}
                                  </Text>
                                </View>
                              ) : null}

                              {/* Lead Link */}
                              {!isProductionTaskRole && task.leadId ? (
                                <View style={[styles.badge, { backgroundColor: "#f0fdf4", borderColor: "#bbf7d0" }]}>
                                  <Text style={[styles.badgeText, { color: "#15803d" }]}>
                                    Lead: {task.leadId && typeof task.leadId === "object" ? task.leadId.name : "Linked"}
                                  </Text>
                                </View>
                              ) : null}
                            </View>

                            {/* Tags list */}
                            {task.tags && task.tags.length > 0 ? (
                              <View style={styles.tagGrid}>
                                {task.tags.map((t: string, idx: number) => (
                                  <View key={`${t}-${idx}`} style={styles.tagBadge}>
                                    <Text style={styles.tagBadgeText}>#{t}</Text>
                                  </View>
                                ))}
                              </View>
                            ) : null}

                            {/* Subtask progress bar */}
                            {task.subtasks && task.subtasks.length > 0 ? (
                              <View style={styles.subtaskProgressBarContainer}>
                                <Text style={styles.subtaskProgressText}>
                                  Checklist: {task.subtasks.filter((s: any) => s.isCompleted).length}/{task.subtasks.length}
                                </Text>
                                <View style={styles.progressBarBg}>
                                  <View
                                    style={[
                                      styles.progressBarFill,
                                      {
                                        width: `${Math.round(
                                          (task.subtasks.filter((s: any) => s.isCompleted).length / task.subtasks.length) * 100
                                        )}%`,
                                      },
                                    ]}
                                  />
                                </View>
                              </View>
                            ) : null}
                          </Pressable>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          );
        }}
      />

      {/* CREATE/EDIT OVERLAY MODAL */}
      <Modal visible={isModalOpen} animationType="slide" transparent onRequestClose={() => setIsModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <AppCard style={styles.modalContentCard as object}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitleText}>{editingTask ? "Update Task" : "Create Task"}</Text>
              <Pressable onPress={() => setIsModalOpen(false)}>
                <Ionicons name="close" size={24} color="#0f172a" />
              </Pressable>
            </View>

            <ScrollView style={styles.modalFormScroll} keyboardShouldPersistTaps="handled">
              <Text style={styles.formLabel}>Title *</Text>
              <AppInput
                placeholder="What needs to be done?"
                value={formData.title}
                onChangeText={(val) => setFormData((prev) => ({ ...prev, title: val }))}
              />

              <Text style={styles.formLabel}>Description</Text>
              <AppInput
                placeholder="Add details, links, or info..."
                value={formData.description}
                onChangeText={(val) => setFormData((prev) => ({ ...prev, description: val }))}
              />

              {/* Status Selector */}
              <Text style={styles.formLabel}>Status</Text>
              <Pressable style={styles.selectRowField} onPress={() => setStatusDropdownOpen(!statusDropdownOpen)}>
                <Text style={styles.selectRowText}>
                  {STATUS_OPTIONS.find((s) => s.id === formData.status)?.label || formData.status}
                </Text>
                <Ionicons name="chevron-down" size={16} color="#64748b" />
              </Pressable>
              {statusDropdownOpen && (
                <View style={styles.dropdownCard}>
                  {STATUS_OPTIONS.map((opt) => (
                    <Pressable
                      key={opt.id}
                      style={styles.dropdownItem}
                      onPress={() => {
                        setFormData((prev) => ({ ...prev, status: opt.id }));
                        setStatusDropdownOpen(false);
                      }}
                    >
                      <Text style={styles.dropdownItemText}>{opt.label}</Text>
                    </Pressable>
                  ))}
                </View>
              )}

              {/* Priority Selector */}
              <Text style={styles.formLabel}>Priority</Text>
              <Pressable style={styles.selectRowField} onPress={() => setPriorityDropdownOpen(!priorityDropdownOpen)}>
                <Text style={styles.selectRowText}>
                  {PRIORITY_OPTIONS.find((p) => p.id === formData.priority)?.label || formData.priority}
                </Text>
                <Ionicons name="chevron-down" size={16} color="#64748b" />
              </Pressable>
              {priorityDropdownOpen && (
                <View style={styles.dropdownCard}>
                  {PRIORITY_OPTIONS.map((opt) => (
                    <Pressable
                      key={opt.id}
                      style={styles.dropdownItem}
                      onPress={() => {
                        setFormData((prev) => ({ ...prev, priority: opt.id }));
                        setPriorityDropdownOpen(false);
                      }}
                    >
                      <Text style={styles.dropdownItemText}>{opt.label}</Text>
                    </Pressable>
                  ))}
                </View>
              )}

              {/* Due Date Picker */}
              <Text style={styles.formLabel}>Due Date</Text>
              <Pressable style={styles.selectRowField} onPress={triggerDatePicker}>
                <Text style={styles.selectRowText}>{formData.dueDate || "Select due date (Optional)"}</Text>
                <Ionicons name="calendar-outline" size={16} color="#64748b" />
              </Pressable>

              {/* Assignee Selector */}
              <Text style={styles.formLabel}>Assignee</Text>
              <Pressable style={styles.selectRowField} onPress={() => setAssigneeDropdownOpen(!assigneeDropdownOpen)}>
                <Text style={styles.selectRowText}>{currentAssigneeName}</Text>
                <Ionicons name="person-outline" size={16} color="#64748b" />
              </Pressable>
              {assigneeDropdownOpen && (
                <View style={styles.dropdownCard}>
                  <Pressable
                    style={styles.dropdownItem}
                    onPress={() => {
                      setFormData((prev) => ({ ...prev, assignedTo: "" }));
                      setAssigneeDropdownOpen(false);
                    }}
                  >
                    <Text style={styles.dropdownItemText}>Unassigned</Text>
                  </Pressable>
                  {teamUsers.map((u) => (
                    <Pressable
                      key={u._id}
                      style={styles.dropdownItem}
                      onPress={() => {
                        setFormData((prev) => ({ ...prev, assignedTo: u._id }));
                        setAssigneeDropdownOpen(false);
                      }}
                    >
                      <Text style={styles.dropdownItemText}>{u.name} ({u.role})</Text>
                    </Pressable>
                  ))}
                </View>
              )}

              {!isProductionTaskRole ? (
                <>
                  {/* Lead Association */}
                  <Text style={styles.formLabel}>Associated Lead</Text>
                  <Pressable style={styles.selectRowField} onPress={() => setLeadDropdownOpen(!leadDropdownOpen)}>
                    <Text style={styles.selectRowText}>{currentLeadName}</Text>
                    <Ionicons name="people-outline" size={16} color="#64748b" />
                  </Pressable>
                  {leadDropdownOpen && (
                    <View style={styles.dropdownCard}>
                      <Pressable
                        style={styles.dropdownItem}
                        onPress={() => {
                          setFormData((prev) => ({ ...prev, leadId: "" }));
                          setLeadDropdownOpen(false);
                        }}
                      >
                        <Text style={styles.dropdownItemText}>None</Text>
                      </Pressable>
                      {leads.map((l) => (
                        <Pressable
                          key={l._id}
                          style={styles.dropdownItem}
                          onPress={() => {
                            setFormData((prev) => ({ ...prev, leadId: l._id }));
                            setLeadDropdownOpen(false);
                          }}
                        >
                          <Text style={styles.dropdownItemText}>{l.name} {l.phone ? `(${l.phone})` : ""}</Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                </>
              ) : null}

              {/* Tags Section */}
              <Text style={styles.formLabel}>Tags</Text>
              <View style={styles.tagsContainer}>
                {PREDEFINED_TAGS.map((tag) => {
                  const selected = formData.tags.includes(tag);
                  return (
                    <Pressable
                      key={tag}
                      style={[styles.tagSelectChip, selected && styles.tagSelectChipActive]}
                      onPress={() => toggleTagSelection(tag)}
                    >
                      <Text style={[styles.tagSelectChipText, selected && styles.tagSelectChipTextActive]}>
                        {tag}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.customTagRow}>
                <AppInput
                  style={[styles.customTagInput, { marginBottom: 0 }] as object}
                  placeholder="Custom tag..."
                  value={newTagInput}
                  onChangeText={setNewTagInput}
                />
                <AppButton title="Add" onPress={addCustomTag} style={styles.customTagAddBtn as object} />
              </View>

              {formData.tags.length > 0 ? (
                <View style={[styles.tagGrid, { marginTop: 8 }]}>
                  {formData.tags.map((t, idx) => (
                    <View key={`selected-${t}-${idx}`} style={styles.tagBadge}>
                      <Text style={styles.tagBadgeText}>#{t}</Text>
                      <Pressable style={{ marginLeft: 4 }} onPress={() => toggleTagSelection(t)}>
                        <Ionicons name="close-circle" size={12} color="#64748b" />
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : null}

              {/* Subtasks checklist */}
              <Text style={styles.formLabel}>Subtasks Checklist</Text>
              <View style={styles.subtaskAddContainer}>
                <AppInput
                  style={[styles.subtaskAddInput, { marginBottom: 0 }] as object}
                  placeholder="Add checklist item..."
                  value={newSubtaskTitle}
                  onChangeText={setNewSubtaskTitle}
                />
                <AppButton title="Add" onPress={addSubtask} style={styles.subtaskAddBtn as object} />
              </View>

              <View style={styles.subtaskList}>
                {formData.subtasks.map((sub, idx) => (
                  <View key={`form-sub-${idx}`} style={styles.subtaskRow}>
                    <Pressable
                      style={[styles.checkbox, sub.isCompleted && styles.checkboxCompleted]}
                      onPress={() => toggleSubtaskInForm(idx)}
                    >
                      {sub.isCompleted && <Ionicons name="checkmark" size={12} color="#fff" />}
                    </Pressable>
                    <Text style={[styles.subtaskTitle, sub.isCompleted && styles.subtaskTitleCompleted]}>
                      {sub.title}
                    </Text>
                    <Pressable style={styles.deleteSubtaskBtn} onPress={() => deleteSubtask(idx)}>
                      <Ionicons name="trash-outline" size={14} color="#b91c1c" />
                    </Pressable>
                  </View>
                ))}
              </View>
            </ScrollView>

            <View style={styles.modalButtonRow}>
              {editingTask && (isAdmin || String(editingTask.createdBy) === String(user?._id)) ? (
                <AppButton
                  title={saving ? "Deleting..." : "Delete"}
                  onPress={() => handleDeleteTask(editingTask._id)}
                  disabled={saving}
                  style={styles.modalDeleteBtn as object}
                />
              ) : null}
              <AppButton title="Cancel" variant="ghost" onPress={() => setIsModalOpen(false)} disabled={saving} style={{ flex: 1 }} />
              <AppButton title={saving ? "Saving..." : "Save"} onPress={handleSaveTask} disabled={saving} style={{ flex: 1 }} />
            </View>
          </AppCard>
        </View>
      </Modal>

      {/* iOS Date Picker Modal */}
      {showDatePicker && (
        <DateTimePicker
          value={datePickerSeed}
          mode="date"
          display="default"
          onChange={onDatePickerChange}
        />
      )}
    </Screen>
  );
};

const styles = StyleSheet.create({
  success: {
    marginBottom: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.successBorder,
    borderRadius: 10,
    backgroundColor: colors.successBg,
    color: colors.success,
  },
  statsGrid: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  statsCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: "#fff",
    padding: 8,
    alignItems: "center",
  },
  statsLabel: {
    fontSize: 9,
    color: colors.textMuted,
    textTransform: "uppercase",
    marginTop: 4,
  },
  statsValue: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    marginTop: 2,
  },
  toolbar: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    backgroundColor: "#fff",
    padding: 10,
    marginBottom: 8,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    height: 40,
    paddingHorizontal: 8,
    marginBottom: 8,
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    borderWidth: 0,
    backgroundColor: "transparent",
    marginBottom: 0,
    height: "100%",
    paddingHorizontal: 0,
  },
  clearSearchBtn: {
    padding: 4,
  },
  groupSortRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  selectBtnContainer: {
    flex: 1,
  },
  selectBtnTitle: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: "600",
    marginBottom: 4,
  },
  selectBtnWrap: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceMuted,
    padding: 2,
  },
  smallToggleBtn: {
    flex: 1,
    height: 26,
    borderRadius: radii.sm - 2,
    alignItems: "center",
    justifyContent: "center",
  },
  smallToggleBtnActive: {
    backgroundColor: "#fff",
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 1,
    elevation: 1,
  },
  smallToggleBtnText: {
    fontSize: 10,
    fontWeight: "600",
    color: colors.textMuted,
  },
  smallToggleBtnTextActive: {
    color: colors.text,
    fontWeight: "700",
  },
  filtersRow: {
    gap: 6,
    alignItems: "center",
    paddingVertical: 4,
  },
  filterTextLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.textMuted,
    marginRight: 2,
  },
  filterChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    height: 26,
    paddingHorizontal: 8,
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  filterChipActive: {
    borderColor: colors.accent,
    backgroundColor: colors.primary,
  },
  filterChipText: {
    fontSize: 10,
    color: colors.text,
    fontWeight: "600",
  },
  filterChipTextActive: {
    color: "#fff",
  },
  clearFiltersBtn: {
    paddingHorizontal: 8,
    justifyContent: "center",
  },
  clearFiltersText: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.error,
  },
  groupContainer: {
    marginBottom: 8,
  },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  groupTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
  },
  groupBadge: {
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
  },
  groupBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#fff",
  },
  groupList: {
    marginTop: 4,
    paddingLeft: 4,
  },
  taskCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: "#fff",
    padding: 10,
    marginBottom: 6,
    ...clay.shadowSmall,
  },
  taskCardCompleted: {
    opacity: 0.65,
    backgroundColor: colors.surfaceMuted,
  },
  taskCardRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
    backgroundColor: "#fff",
  },
  checkboxCompleted: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  taskTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
  },
  taskTitleCompleted: {
    textDecorationLine: "line-through",
    color: colors.textMuted,
  },
  taskDesc: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  taskMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 6,
  },
  badge: {
    fontSize: 9,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: "600",
    color: colors.textMuted,
  },
  tagGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 4,
  },
  tagBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#e0f2fe",
    borderWidth: 1,
    borderColor: "#bae6fd",
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  tagBadgeText: {
    fontSize: 9,
    fontWeight: "600",
    color: "#0369a1",
  },
  subtaskProgressBarContainer: {
    marginTop: 6,
  },
  subtaskProgressText: {
    fontSize: 9,
    color: colors.textMuted,
    fontWeight: "600",
  },
  progressBarBg: {
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    marginTop: 2,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: colors.success,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "rgba(15,23,42,0.45)",
    padding: 16,
  },
  modalContentCard: {
    maxHeight: "85%",
    borderRadius: radii.xl,
    padding: 16,
  },
  modalHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  modalTitleText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  modalFormScroll: {
    marginBottom: 12,
  },
  formLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.textMuted,
    textTransform: "uppercase",
    marginBottom: 4,
    marginTop: 8,
  },
  selectRowField: {
    height: 40,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radii.md,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  selectRowText: {
    fontSize: 12,
    color: colors.text,
  },
  dropdownCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: "#fff",
    paddingVertical: 4,
    marginBottom: 8,
    ...clay.shadowSmall,
  },
  dropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceMuted,
  },
  dropdownItemText: {
    fontSize: 12,
    color: colors.text,
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 8,
  },
  tagSelectChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#fff",
  },
  tagSelectChipActive: {
    borderColor: colors.accent,
    backgroundColor: colors.primary,
  },
  tagSelectChipText: {
    fontSize: 10,
    color: colors.text,
    fontWeight: "600",
  },
  tagSelectChipTextActive: {
    color: "#fff",
  },
  customTagRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 8,
    height: 36,
  },
  customTagInput: {
    flex: 1,
    height: 36,
  },
  customTagAddBtn: {
    height: 36,
    paddingHorizontal: 12,
  },
  subtaskAddContainer: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 8,
    height: 36,
  },
  subtaskAddInput: {
    flex: 1,
    height: 36,
  },
  subtaskAddBtn: {
    height: 36,
    paddingHorizontal: 12,
  },
  subtaskList: {
    marginTop: 4,
  },
  subtaskRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  subtaskTitle: {
    fontSize: 12,
    color: colors.text,
    flex: 1,
  },
  subtaskTitleCompleted: {
    textDecorationLine: "line-through",
    color: colors.textMuted,
  },
  deleteSubtaskBtn: {
    padding: 4,
  },
  modalButtonRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  modalDeleteBtn: {
    backgroundColor: colors.error,
  },
});
