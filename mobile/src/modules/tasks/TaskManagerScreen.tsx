import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Glyph, type GlyphName } from "../../components/ui/Glyph";
import { AppSheet } from "../../components/ui/Overlay";
import { useAuth } from "../../context/AuthContext";
import { brand, brandStyles, layout, round, type as t } from "../../theme/brand";
import { toErrorMessage } from "../../utils/errorMessage";
import {
  createTask,
  deleteTask,
  getTaskAssignees,
  getTasks,
  getTaskStats,
  getTaskStatsByUser,
  updateTask,
  type Task,
} from "../../services/taskService";
import { getUsers } from "../../services/userService";
import { getAllLeads } from "../../services/leadService";
import {
  PREDEFINED_TAGS,
  PRIORITY_IDS,
  priorityTone,
  completionRate,
  initialsOf,
  isDueToday,
  isOverdue,
  toDate,
  workloadBand,
  type StatusId,
  type WorkloadBand,
} from "./taskConstants";
import { AssignedRow, MyTaskRow, TaskCard } from "./components/TaskCards";

/*
 * The Tasks screen, drawn to the comps.
 *
 * Four scopes across the top - everything, what was handed to me, what I
 * raised, and how the team is carrying it - and each one is its own layout,
 * because the comps draw four different pages rather than one list with a
 * filter. The scopes are the API's own: `scope=assigned` is assigned-to-me and
 * `scope=mine` is what I created.
 *
 * The board view the previous version carried is gone: the comps have no
 * board. Everything else it could do - filtering by status, priority and
 * assignee, sorting, completing a task, moving it, deleting it - is still
 * here, in the controls the comps draw.
 */

type TabKey = "ALL" | "ASSIGNED" | "MINE" | "TEAM";
type SortKey = "NEWEST" | "DUE" | "PRIORITY" | "TITLE";
type SheetKind = "sort" | "status" | "assignee" | "task" | "role" | null;

const TABS: Array<{ key: TabKey; label: string; subtitle: string }> = [
  { key: "ALL", label: "All Tasks", subtitle: "Manage your daily activities" },
  { key: "ASSIGNED", label: "Assigned to Me", subtitle: "Tasks assigned to you" },
  { key: "MINE", label: "My Tasks", subtitle: "Tasks created by you" },
  { key: "TEAM", label: "Team", subtitle: "Monitor workload and progress" },
];

const SORTS: Array<{ id: SortKey; label: string }> = [
  { id: "NEWEST", label: "Recently created" },
  { id: "DUE", label: "Due date" },
  { id: "PRIORITY", label: "Priority" },
  { id: "TITLE", label: "Title" },
];

const STATUS_OPTIONS = [
  { id: "", label: "All statuses" },
  { id: "TODO", label: "To Do" },
  { id: "IN_PROGRESS", label: "In Progress" },
  { id: "COMPLETED", label: "Completed" },
];

const BAND_ROWS: Array<{ id: WorkloadBand; label: string; color: string }> = [
  { id: "BUSY", label: "Busy", color: "#ef5e5c" },
  { id: "BALANCED", label: "Balanced", color: "#12a06a" },
  { id: "AVAILABLE", label: "Available", color: "#6cc8b0" },
];

const BAND_PILL: Record<WorkloadBand, { bg: string; fg: string; label: string }> = {
  BUSY: { bg: "#fdedee", fg: "#d64545", label: "Busy" },
  BALANCED: { bg: "#e6f4f0", fg: "#0a6b4a", label: "Balanced" },
  AVAILABLE: { bg: "#e6f4f0", fg: "#0a6b4a", label: "Available" },
  OFFLINE: { bg: "#eef1f5", fg: "#64748b", label: "Offline" },
};

const scopeFor = (tab: TabKey) => {
  if (tab === "ASSIGNED") return "assigned";
  if (tab === "MINE") return "mine";
  return undefined;
};

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Admin",
  MANAGER: "Sales Manager",
  EXECUTIVE: "Executive",
  FIELD_EXECUTIVE: "Field Executive",
  COWORKING_ADMIN: "Coworking Admin",
  PRODUCTION_EXECUTIVE: "Production Executive",
  COMMUNITY_MANAGER: "Community Manager",
};

type Member = {
  id: string;
  name: string;
  role: string;
  band: WorkloadBand;
  total: number;
  done: number;
  overdue: number;
  pending: number;
};

/* ------------------------------------------------------------- pieces -- */

const StatTile = ({
  label,
  value,
  tint,
  color,
  icon,
}: {
  label: string;
  value: string;
  tint?: string;
  color?: string;
  icon?: GlyphName;
}) => (
  <View style={[styles.tile, tint ? { backgroundColor: tint, borderColor: tint } : null]}>
    {icon ? (
      <View style={[styles.tileIcon, { backgroundColor: tint || brand.tintSoft }]}>
        <Glyph name={icon} size={20} color={color || brand.primary} />
      </View>
    ) : null}
    <Text style={[styles.tileValue, color ? { color } : null]}>{value}</Text>
    <Text style={styles.tileLabel} numberOfLines={1}>
      {label}
    </Text>
  </View>
);

const ToolButton = ({
  label,
  icon,
  chevron,
  compact,
  onPress,
}: {
  label: string;
  icon?: GlyphName;
  chevron?: boolean;
  /** Three across instead of two - tighter padding and a smaller label. */
  compact?: boolean;
  onPress: () => void;
}) => (
  <Pressable style={[styles.tool, compact && styles.toolTight]} onPress={onPress} accessibilityRole="button">
    {icon ? <Glyph name={icon} size={compact ? 14 : 17} color={brand.text} /> : null}
    <Text style={[styles.toolLabel, compact && styles.toolLabelTight]} numberOfLines={1}>
      {label}
    </Text>
    {chevron ? <Glyph name="chevron-down" size={compact ? 13 : 15} color={brand.textSecondary} /> : null}
  </Pressable>
);

const FilterChip = ({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) => (
  <Pressable
    style={[styles.filterChip, on && styles.filterChipOn]}
    onPress={onPress}
    accessibilityRole="button"
    accessibilityState={{ selected: on }}
  >
    <Text style={[styles.filterChipText, on && styles.filterChipTextOn]}>{label}</Text>
  </Pressable>
);

const SectionHead = ({
  title,
  count,
  onSeeAll,
  bubble,
}: {
  title: string;
  count?: number;
  onSeeAll?: () => void;
  bubble?: boolean;
}) => (
  <View style={styles.sectionHead}>
    <Text style={styles.sectionTitle}>
      {title}
      {count !== undefined && !bubble ? ` (${count})` : ""}
    </Text>
    {count !== undefined && bubble ? (
      <View style={styles.sectionBubble}>
        <Text style={styles.sectionBubbleText}>{count}</Text>
      </View>
    ) : null}
    {onSeeAll ? (
      <Pressable style={styles.seeAll} onPress={onSeeAll} hitSlop={8} accessibilityRole="button">
        <Text style={styles.seeAllText}>See all</Text>
      </Pressable>
    ) : null}
  </View>
);

/* -------------------------------------------------------------- screen -- */

export const TaskManagerScreen = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { role, user } = useAuth();
  const canSeeTeam = role === "ADMIN" || role === "MANAGER";
  /* Web hides the lead filter from production staff, who work no leads. */
  const canFilterByLead = role !== "PRODUCTION_EXECUTIVE";

  const [tab, setTab] = useState<TabKey>("ALL");

  const [tasks, setTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [byUser, setByUser] = useState<Record<string, any>>({});
  const [teamUsers, setTeamUsers] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  /* Web's other three filters - the API takes each as a query parameter. */
  const [priorityFilter, setPriorityFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [leadFilter, setLeadFilter] = useState("");
  const [leadOptions, setLeadOptions] = useState<Array<{ _id: string; name: string }>>([]);
  const [leadOptionsState, setLeadOptionsState] = useState<"idle" | "loading" | "ready" | "failed">("idle");
  const [leadQuery, setLeadQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("NEWEST");
  const [chip, setChip] = useState("ALL");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const [sheet, setSheet] = useState<SheetKind>(null);
  const [menuTask, setMenuTask] = useState<Task | null>(null);

  /* The list refetches on every keystroke otherwise. */
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const filterCount =
    (statusFilter ? 1 : 0) + (priorityFilter ? 1 : 0) + (tagFilter ? 1 : 0) + (leadFilter && canFilterByLead ? 1 : 0);

  /*
   * The lead list is only needed once someone opens the filters, and walking
   * every lead page on each visit to Tasks would cost more than the screen.
   */
  useEffect(() => {
    if (sheet !== "status" || !canFilterByLead || leadOptionsState !== "idle") return;
    setLeadOptionsState("loading");
    getAllLeads()
      .then((rows) => {
        setLeadOptions(
          (rows || [])
            .map((row: any) => ({ _id: String(row?._id || ""), name: String(row?.name || "Unnamed lead") }))
            .filter((row) => row._id)
            .sort((a, b) => a.name.localeCompare(b.name)),
        );
        setLeadOptionsState("ready");
      })
      .catch(() => setLeadOptionsState("failed"));
  }, [sheet, canFilterByLead, leadOptionsState]);

  const visibleLeadOptions = useMemo(() => {
    const q = leadQuery.trim().toLowerCase();
    const rows = q ? leadOptions.filter((row) => row.name.toLowerCase().includes(q)) : leadOptions;
    return rows.slice(0, 30);
  }, [leadOptions, leadQuery]);

  const clearFilters = () => {
    setStatusFilter("");
    setPriorityFilter("");
    setTagFilter("");
    setLeadFilter("");
    setLeadQuery("");
  };

  /* Team is an admin/manager view; a demoted account must not sit on it. */
  useEffect(() => {
    if (tab === "TEAM" && !canSeeTeam) setTab("ALL");
  }, [tab, canSeeTeam]);

  const load = useCallback(
    async (quiet = false) => {
      try {
        if (quiet) setRefreshing(true);
        else setLoading(true);
        setError("");

        const scope = scopeFor(tab);
        const listParams: Record<string, any> = {};
        if (scope) listParams.scope = scope;
        if (statusFilter) listParams.status = statusFilter;
        if (assigneeFilter) listParams.assignedTo = assigneeFilter;
        if (priorityFilter) listParams.priority = priorityFilter;
        if (tagFilter) listParams.tag = tagFilter;
        if (leadFilter && canFilterByLead) listParams.leadId = leadFilter;
        if (search) listParams.search = search;

        const statsParams: Record<string, any> = {};
        if (scope) statsParams.scope = scope;

        const wantsTeam = tab === "TEAM" && canSeeTeam;

        /*
         * The roster reads /users (admins and managers, who alone see it, may);
         * everyone else fills the assignee filter from /tasks/assignees, as web
         * does - /users answers 403 for an executive.
         */
        const [taskRows, statRow, teamRow, userRow] = await Promise.allSettled([
          getTasks(listParams),
          getTaskStats(statsParams),
          wantsTeam ? getTaskStatsByUser() : Promise.resolve({}),
          canSeeTeam ? getUsers() : getTaskAssignees(),
        ]);

        if (taskRows.status === "fulfilled") setTasks(taskRows.value || []);
        if (statRow.status === "fulfilled" && statRow.value) setStats(statRow.value);
        if (teamRow.status === "fulfilled") setByUser(teamRow.value || {});
        if (userRow.status === "fulfilled") setTeamUsers(userRow.value?.users || []);

        /*
         * Only the task list failing is worth a banner. The rest degrade to a
         * zero or an empty roster, and a red bar over a page that otherwise
         * rendered is noise.
         */
        if (taskRows.status === "rejected") {
          setError(toErrorMessage(taskRows.reason, "Failed to load tasks"));
        }
      } catch (err) {
        setError(toErrorMessage(err, "Failed to load tasks"));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [tab, statusFilter, assigneeFilter, priorityFilter, tagFilter, leadFilter, canFilterByLead, search, canSeeTeam],
  );

  useEffect(() => {
    void load();
  }, [load]);

  /*
   * Web's quick add: a title and nothing else, to the TODO column at medium
   * priority, assigned to whoever the list is filtered to - or to me.
   */
  const [quickAddTitle, setQuickAddTitle] = useState("");
  const [quickAddSaving, setQuickAddSaving] = useState(false);
  const quickAdd = async () => {
    const title = quickAddTitle.trim();
    if (!title || quickAddSaving) return;
    setQuickAddSaving(true);
    try {
      const created = await createTask({
        title,
        status: "TODO",
        priority: "MEDIUM",
        assignedTo: (assigneeFilter || String((user as any)?._id || (user as any)?.id || "") || null) as any,
        leadId: null as any,
      });
      if (created) {
        setQuickAddTitle("");
        void load(true);
      }
    } catch (err) {
      setError(toErrorMessage(err, "Failed to add task"));
    } finally {
      setQuickAddSaving(false);
    }
  };

  /* Coming back from the details or create screen should show the change. */
  useFocusEffect(
    useCallback(() => {
      void load(true);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab]),
  );

  /* ------------------------------------------------------------ derived -- */

  const sorted = useMemo(() => {
    const list = [...tasks];
    if (sortBy === "DUE") {
      list.sort((a, b) => {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      });
    } else if (sortBy === "PRIORITY") {
      const weight: Record<string, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };
      list.sort((a, b) => (weight[b.priority || "MEDIUM"] || 0) - (weight[a.priority || "MEDIUM"] || 0));
    } else if (sortBy === "TITLE") {
      list.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    } else {
      list.sort((a, b) => {
        const left = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const right = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return right - left;
      });
    }
    return list;
  }, [tasks, sortBy]);

  /* The All tab's own chip row, applied on top of whatever the API returned. */
  const chipped = useMemo(() => {
    if (tab !== "ALL" || chip === "ALL") return sorted;
    if (chip === "OVERDUE") return sorted.filter(isOverdue);
    return sorted.filter((task) => String(task.status || "").toUpperCase() === chip);
  }, [sorted, chip, tab]);

  const chipCounts = useMemo(
    () => ({
      ALL: sorted.length,
      IN_PROGRESS: sorted.filter((row) => String(row.status || "").toUpperCase() === "IN_PROGRESS").length,
      COMPLETED: sorted.filter((row) => String(row.status || "").toUpperCase() === "COMPLETED").length,
      OVERDUE: sorted.filter(isOverdue).length,
    }),
    [sorted],
  );

  const members: Member[] = useMemo(() => {
    if (!canSeeTeam) return [];
    return teamUsers
      .filter((row) => String(row?.role || "") !== "CHANNEL_PARTNER")
      .filter((row) => !roleFilter || String(row?.role || "") === roleFilter)
      .filter((row) => !search || String(row?.name || "").toLowerCase().includes(search.toLowerCase()))
      .map((row) => {
        const id = String(row?._id || row?.id || "");
        const stat = byUser[id] || {};
        const total = Number(stat.total || 0);
        const done = Number(stat.COMPLETED || 0);
        const pending = Number(stat.pending ?? Math.max(total - done, 0));
        return {
          id,
          name: String(row?.name || "User"),
          role: ROLE_LABEL[String(row?.role || "")] || String(row?.role || "-"),
          band: workloadBand(pending, row?.isActive !== false),
          total,
          done,
          overdue: Number(stat.overdue || 0),
          pending,
        };
      })
      .sort((a, b) => b.overdue - a.overdue || b.total - a.total);
  }, [canSeeTeam, teamUsers, byUser, roleFilter, search]);

  const teamTotals = useMemo(() => {
    const total = members.reduce((sum, row) => sum + row.total, 0);
    const done = members.reduce((sum, row) => sum + row.done, 0);
    const overdue = members.reduce((sum, row) => sum + row.overdue, 0);
    return { total, done, overdue };
  }, [members]);

  const bandCounts = useMemo(() => {
    const counts: Record<string, number> = { BUSY: 0, BALANCED: 0, AVAILABLE: 0, OFFLINE: 0 };
    members.forEach((row) => { counts[row.band] += 1; });
    return counts;
  }, [members]);

  /* ------------------------------------------------------------ actions -- */

  const openTask = (task: Task) => navigation.navigate("TaskDetails", { taskId: task._id });
  const openCreate = (status?: StatusId) => navigation.navigate("NewTask", { status });

  const toggleDone = async (task: Task) => {
    const next = String(task.status || "").toUpperCase() === "COMPLETED" ? "TODO" : "COMPLETED";
    /* Optimistic: the row flips now and the reload confirms it. */
    setTasks((prev) => prev.map((row) => (row._id === task._id ? { ...row, status: next } : row)));
    try {
      await updateTask(task._id, { status: next });
      void load(true);
    } catch (err) {
      setError(toErrorMessage(err, "Could not update the task"));
      void load(true);
    }
  };

  const moveTask = async (task: Task, status: StatusId) => {
    setSheet(null);
    setMenuTask(null);
    try {
      await updateTask(task._id, { status });
      void load(true);
    } catch (err) {
      setError(toErrorMessage(err, "Could not move the task"));
    }
  };

  const removeTask = async (task: Task) => {
    setSheet(null);
    setMenuTask(null);
    try {
      await deleteTask(task._id);
      void load(true);
    } catch (err) {
      setError(toErrorMessage(err, "Could not delete the task"));
    }
  };

  const openMenu = (task: Task) => {
    setMenuTask(task);
    setSheet("task");
  };

  /* ------------------------------------------------------------- render -- */

  const meta = TABS.find((row) => row.key === tab) || TABS[0];
  const visibleTabs = TABS.filter((row) => row.key !== "TEAM" || canSeeTeam);
  const bottomPad = 24 + Math.max(insets.bottom, Platform.OS === "android" ? 16 : 0);

  const section = (key: string, rows: Task[]) => {
    const open = expanded[key];
    return { rows: open ? rows : rows.slice(0, 3), more: rows.length > 3, open };
  };

  const toggleSection = (key: string) => setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  const renderAll = () => {
    const today = chipped.filter((task) => isDueToday(task) || isOverdue(task));
    const upcoming = chipped.filter((task) => {
      const due = toDate(task.dueDate);
      return !!due && !isDueToday(task) && !isOverdue(task);
    });
    const undated = chipped.filter((task) => !toDate(task.dueDate));

    const blocks: Array<[string, Task[]]> = [
      ["Today", today],
      ["Upcoming", upcoming],
      ["No due date", undated],
    ];

    return (
      <>
        <View style={styles.searchBox}>
          <Glyph name="search" size={18} color={brand.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search tasks..."
            placeholderTextColor={brand.placeholder}
            value={searchInput}
            onChangeText={setSearchInput}
          />
        </View>

        <View style={styles.toolRow}>
          <ToolButton label={filterCount ? `Filter · ${filterCount}` : "Filter"} icon="options-outline" onPress={() => setSheet("status")} />
          <ToolButton
            label={SORTS.find((row) => row.id === sortBy)?.label || "Due date"}
            icon="swap-vertical"
            chevron
            onPress={() => setSheet("sort")}
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipScroll}
          contentContainerStyle={styles.chipRow}
        >
          {[
            { id: "ALL", label: "All" },
            { id: "IN_PROGRESS", label: "In Progress" },
            { id: "COMPLETED", label: "Completed" },
            { id: "OVERDUE", label: "Overdue" },
          ].map((row) => {
            const active = chip === row.id;
            return (
              <Pressable
                key={row.id}
                style={[styles.chip, active && styles.chipOn]}
                onPress={() => setChip(row.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.chipLabel, active && styles.chipLabelOn]}>{row.label}</Text>
                <View style={[styles.chipCount, active && styles.chipCountOn]}>
                  <Text style={[styles.chipCountText, active && styles.chipCountTextOn]}>
                    {(chipCounts as Record<string, number>)[row.id] ?? 0}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>

        {blocks.map(([title, rows]) =>
          rows.length ? (
            <View key={title}>
              <SectionHead title={title} />
              {rows.map((task) => (
                <TaskCard
                  key={task._id}
                  task={task}
                  onPress={() => openTask(task)}
                  onToggle={() => void toggleDone(task)}
                  onMenu={() => openMenu(task)}
                />
              ))}
            </View>
          ) : null,
        )}
        {chipped.length === 0 ? <Empty /> : null}
      </>
    );
  };

  const renderAssigned = () => {
    const dueToday = sorted.filter((task) => isDueToday(task) || isOverdue(task));
    const later = sorted.filter((task) => !isDueToday(task) && !isOverdue(task));
    const a = section("assigned-today", dueToday);
    const b = section("assigned-later", later);

    return (
      <>
        <View style={styles.tileRow}>
          <StatTile label="Assigned" value={String(stats.total || 0)} tint="#f0f8f5" color={brand.deep} />
          <StatTile
            label="Due Today"
            value={String(sorted.filter(isDueToday).length)}
            tint="#fdf8f0"
            color="#b4791a"
          />
          <StatTile label="Completed" value={String(stats.COMPLETED || 0)} tint="#f0f8f5" color={brand.deep} />
          <StatTile label="Overdue" value={String(stats.overdue || 0)} tint="#fdf3f4" color="#d64545" />
        </View>

        <View style={styles.searchBox}>
          <Glyph name="search" size={18} color={brand.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search assigned tasks..."
            placeholderTextColor={brand.placeholder}
            value={searchInput}
            onChangeText={setSearchInput}
          />
        </View>

        <View style={styles.toolRow}>
          <ToolButton label={filterCount ? `Filters · ${filterCount}` : "Status"} icon="options-outline" chevron onPress={() => setSheet("status")} />
          <ToolButton
            label={SORTS.find((row) => row.id === sortBy)?.label || "Due date"}
            icon="swap-vertical"
            chevron
            onPress={() => setSheet("sort")}
          />
        </View>

        {dueToday.length ? (
          <>
            <SectionHead
              title="Due Today"
              count={dueToday.length}
              onSeeAll={a.more ? () => toggleSection("assigned-today") : undefined}
            />
            {a.rows.map((task) => (
              <AssignedRow
                key={task._id}
                task={task}
                onPress={() => openTask(task)}
                onToggle={() => void toggleDone(task)}
                onMenu={() => openMenu(task)}
              />
            ))}
          </>
        ) : null}

        {later.length ? (
          <>
            <SectionHead
              title="Later"
              count={later.length}
              onSeeAll={b.more ? () => toggleSection("assigned-later") : undefined}
            />
            {b.rows.map((task) => (
              <AssignedRow
                key={task._id}
                task={task}
                onPress={() => openTask(task)}
                onToggle={() => void toggleDone(task)}
                onMenu={() => openMenu(task)}
              />
            ))}
          </>
        ) : null}
        {sorted.length === 0 ? <Empty /> : null}
      </>
    );
  };

  const renderMine = () => {
    const open = sorted.filter((task) => String(task.status || "").toUpperCase() !== "COMPLETED");
    const done = sorted.filter((task) => String(task.status || "").toUpperCase() === "COMPLETED");

    return (
      <>
        <View style={styles.tileRow}>
          <StatTile label="Created" value={String(stats.total || 0)} />
          <StatTile label="Open" value={String(open.length)} />
          <StatTile label="Completed" value={String(done.length)} />
          <StatTile label="Overdue" value={String(stats.overdue || 0)} color="#d64545" />
        </View>

        <View style={styles.searchBox}>
          <Glyph name="search" size={18} color={brand.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search my tasks..."
            placeholderTextColor={brand.placeholder}
            value={searchInput}
            onChangeText={setSearchInput}
          />
        </View>

        <View style={styles.toolRow}>
          <ToolButton
            label={
              assigneeFilter
                ? teamUsers.find((row) => String(row?._id) === assigneeFilter)?.name || "Assignee"
                : "All assignees"
            }
            icon="person-outline"
            chevron
            compact
            onPress={() => setSheet("assignee")}
          />
          <ToolButton label={filterCount ? `Filters · ${filterCount}` : "Status"} icon="ellipse-outline" chevron compact onPress={() => setSheet("status")} />
          <ToolButton
            label={SORTS.find((row) => row.id === sortBy)?.label || "Recently created"}
            icon="swap-vertical"
            chevron
            compact
            onPress={() => setSheet("sort")}
          />
        </View>

        {open.length ? (
          <>
            <SectionHead title="Open tasks" count={open.length} bubble />
            {open.map((task) => (
              <MyTaskRow
                key={task._id}
                task={task}
                onPress={() => openTask(task)}
                onToggle={() => void toggleDone(task)}
                onMenu={() => openMenu(task)}
              />
            ))}
          </>
        ) : null}

        {done.length ? (
          <>
            <SectionHead title="Completed" count={done.length} bubble />
            {done.map((task) => (
              <MyTaskRow
                key={task._id}
                task={task}
                onPress={() => openTask(task)}
                onToggle={() => void toggleDone(task)}
                onMenu={() => openMenu(task)}
              />
            ))}
          </>
        ) : null}
        {sorted.length === 0 ? <Empty /> : null}
      </>
    );
  };

  const renderTeam = () => {
    const rate = completionRate(teamTotals.done, teamTotals.total);
    const maxBand = Math.max(1, ...Object.values(bandCounts));

    return (
      <>
        <View style={styles.tileRow}>
          <StatTile label="Team Members" value={String(members.length)} icon="people" />
          <StatTile label="Total Tasks" value={String(teamTotals.total)} icon="document-text-outline" />
          <StatTile label="Completed" value={String(teamTotals.done)} icon="checkmark-circle-outline" />
          <StatTile
            label="Overdue"
            value={String(teamTotals.overdue)}
            icon="alert-circle-outline"
            tint="#fdf3f4"
            color="#d64545"
          />
        </View>

        <View style={styles.rateCard}>
          <View style={styles.rateHead}>
            <View style={styles.grow}>
              <Text style={styles.rateTitle}>Completion rate</Text>
              <Text style={styles.rateNote}>{rate}% of team tasks completed</Text>
            </View>
            <Text style={styles.rateValue}>{rate}%</Text>
          </View>
          <View style={styles.track}>
            <View style={[styles.trackFill, { width: `${rate}%` }]} />
          </View>
        </View>

        <View style={styles.searchBox}>
          <Glyph name="search" size={18} color={brand.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search team member..."
            placeholderTextColor={brand.placeholder}
            value={searchInput}
            onChangeText={setSearchInput}
          />
        </View>

        <View style={styles.toolRow}>
          <ToolButton
            label={roleFilter ? ROLE_LABEL[roleFilter] || roleFilter : "All roles"}
            chevron
            onPress={() => setSheet("role")}
          />
          <ToolButton label="Most overdue" icon="options-outline" chevron onPress={() => setSheet("sort")} />
        </View>

        <SectionHead title="Team workload" />

        {members.map((member) => {
          const pill = BAND_PILL[member.band];
          const share = member.total ? Math.round((member.done / member.total) * 100) : 0;
          return (
            <Pressable
              key={member.id}
              style={styles.memberCard}
              onPress={() => {
                setAssigneeFilter(member.id);
                setTab("ALL");
              }}
              accessibilityRole="button"
            >
              <View style={styles.memberAvatar}>
                <Text style={styles.memberInitials}>{initialsOf(member.name)}</Text>
              </View>
              <View style={styles.grow}>
                <View style={styles.memberTop}>
                  <View style={styles.grow}>
                    <Text style={styles.memberName} numberOfLines={1}>
                      {member.name}
                    </Text>
                    <Text style={styles.memberRole} numberOfLines={1}>
                      {member.role}
                    </Text>
                  </View>
                  <View style={[styles.pill, { backgroundColor: pill.bg }]}>
                    <Text style={[styles.pillText, { color: pill.fg }]}>{pill.label}</Text>
                  </View>
                  <Glyph name="chevron-forward" size={18} color={brand.textMuted} />
                </View>

                <View style={styles.memberStats}>
                  <View>
                    <Text style={styles.memberFigure}>{member.pending}</Text>
                    <Text style={styles.memberCaption}>Active tasks</Text>
                  </View>
                  <View style={styles.memberDivider} />
                  <View>
                    <Text style={styles.memberFigure}>{member.overdue}</Text>
                    <Text style={styles.memberCaption}>Overdue</Text>
                  </View>
                  <View style={styles.memberBarWrap}>
                    <View style={styles.track}>
                      <View style={[styles.trackFill, { width: `${share}%` }]} />
                    </View>
                  </View>
                  <Text style={styles.memberCount}>
                    {member.done}/{member.total}
                  </Text>
                </View>
              </View>
            </Pressable>
          );
        })}

        {members.length === 0 ? <Empty label="No team members to show" /> : null}

        <View style={styles.overviewCard}>
          <Text style={styles.rateTitle}>Workload overview</Text>
          {BAND_ROWS.map((row) => (
            <View key={row.id} style={styles.overviewRow}>
              <Text style={styles.overviewLabel}>{row.label}</Text>
              <Text style={styles.overviewCount}>{bandCounts[row.id]}</Text>
              <View style={styles.overviewTrack}>
                <View
                  style={[
                    styles.overviewFill,
                    { width: `${(bandCounts[row.id] / maxBand) * 100}%`, backgroundColor: row.color },
                  ]}
                />
              </View>
            </View>
          ))}
        </View>
      </>
    );
  };

  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <Text style={styles.pageTitle} numberOfLines={1}>
          Tasks
        </Text>
        <Text style={styles.pageSubtitle}>{meta.subtitle}</Text>
        <Pressable style={styles.addBtn} onPress={() => openCreate()} accessibilityRole="button">
          <Glyph name="add" size={20} color={brand.onPrimary} />
          <Text style={styles.addBtnText}>Add Task</Text>
        </Pressable>
      </View>

      <View style={styles.tabBar}>
        {visibleTabs.map((row) => {
          const active = row.key === tab;
          return (
            <Pressable
              key={row.key}
              style={styles.tabItem}
              onPress={() => setTab(row.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.tabLabel, active && styles.tabLabelOn]} numberOfLines={1}>
                {row.label}
              </Text>
              <View style={[styles.tabRule, active && styles.tabRuleOn]} />
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.centred}>
          <ActivityIndicator size="large" color={brand.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.body, { paddingBottom: bottomPad }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={brand.primary} />
          }
        >
          {error ? (
            <Pressable style={styles.banner} onPress={() => load()} accessibilityRole="button">
              <Text style={styles.bannerText}>{error}</Text>
            </Pressable>
          ) : null}

          {tab !== "TEAM" ? (
            <View style={styles.quickAdd}>
              <Glyph name="add-circle-outline" size={20} color={brand.primary} />
              <TextInput
                style={styles.quickAddInput}
                value={quickAddTitle}
                onChangeText={setQuickAddTitle}
                placeholder="Quick add a task…"
                placeholderTextColor={brand.placeholder}
                onSubmitEditing={() => void quickAdd()}
                returnKeyType="done"
                editable={!quickAddSaving}
              />
              {quickAddTitle.trim() ? (
                <Pressable onPress={() => void quickAdd()} disabled={quickAddSaving} hitSlop={8} accessibilityRole="button" accessibilityLabel="Add task">
                  <Glyph name="arrow-forward-circle" size={24} color={brand.primary} />
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {tab === "ALL" ? renderAll() : null}
          {tab === "ASSIGNED" ? renderAssigned() : null}
          {tab === "MINE" ? renderMine() : null}
          {tab === "TEAM" ? renderTeam() : null}
        </ScrollView>
      )}

      <AppSheet visible={sheet === "sort"} onClose={() => setSheet(null)} title="Sort by">
        {SORTS.map((row) => (
          <Pressable
            key={row.id}
            style={styles.sheetRow}
            onPress={() => {
              setSortBy(row.id);
              setSheet(null);
            }}
            accessibilityRole="button"
          >
            <Text style={styles.sheetLabel}>{row.label}</Text>
            {sortBy === row.id ? <Glyph name="checkmark" size={18} color={brand.primary} /> : null}
          </Pressable>
        ))}
      </AppSheet>

      <AppSheet
        visible={sheet === "status"}
        onClose={() => setSheet(null)}
        title="Filters"
        footer={
          <View style={styles.filterFooter}>
            <Pressable style={styles.filterClear} onPress={clearFilters} disabled={!filterCount} accessibilityRole="button">
              <Text style={[styles.filterClearText, !filterCount && styles.filterMuted]}>Clear filters</Text>
            </Pressable>
            <Pressable style={styles.filterDone} onPress={() => setSheet(null)} accessibilityRole="button">
              <Text style={styles.filterDoneText}>Done</Text>
            </Pressable>
          </View>
        }
      >
        <Text style={styles.filterHeading}>Status</Text>
        <View style={styles.filterChips}>
          {STATUS_OPTIONS.map((row) => (
            <FilterChip key={row.id || "all"} label={row.label} on={statusFilter === row.id} onPress={() => setStatusFilter(row.id)} />
          ))}
        </View>

        <Text style={styles.filterHeading}>Priority</Text>
        <View style={styles.filterChips}>
          <FilterChip label="All priorities" on={!priorityFilter} onPress={() => setPriorityFilter("")} />
          {PRIORITY_IDS.map((id) => (
            <FilterChip key={id} label={priorityTone(id).label} on={priorityFilter === id} onPress={() => setPriorityFilter(id)} />
          ))}
        </View>

        <Text style={styles.filterHeading}>Tag</Text>
        <View style={styles.filterChips}>
          <FilterChip label="All tags" on={!tagFilter} onPress={() => setTagFilter("")} />
          {PREDEFINED_TAGS.map((tag) => (
            <FilterChip key={tag} label={tag} on={tagFilter === tag} onPress={() => setTagFilter(tag)} />
          ))}
        </View>

        {canFilterByLead ? (
          <>
            <Text style={styles.filterHeading}>Lead</Text>
            <View style={styles.leadSearch}>
              <Glyph name="search" size={16} color={brand.textMuted} />
              <TextInput
                style={styles.leadSearchInput}
                placeholder="Search leads"
                placeholderTextColor={brand.placeholder}
                value={leadQuery}
                onChangeText={setLeadQuery}
              />
            </View>
            <Pressable style={styles.sheetRow} onPress={() => setLeadFilter("")} accessibilityRole="button">
              <Text style={styles.sheetLabel}>All leads</Text>
              {!leadFilter ? <Glyph name="checkmark" size={18} color={brand.primary} /> : null}
            </Pressable>
            {leadOptionsState === "loading" ? <ActivityIndicator style={styles.leadLoading} color={brand.primary} /> : null}
            {leadOptionsState === "failed" ? <Text style={styles.filterNote}>Could not load leads.</Text> : null}
            {visibleLeadOptions.map((row) => (
              <Pressable key={row._id} style={styles.sheetRow} onPress={() => setLeadFilter(row._id)} accessibilityRole="button">
                <Text style={[styles.sheetLabel, styles.leadName]} numberOfLines={1}>{row.name}</Text>
                {leadFilter === row._id ? <Glyph name="checkmark" size={18} color={brand.primary} /> : null}
              </Pressable>
            ))}
            {leadOptionsState === "ready" && leadOptions.length > visibleLeadOptions.length && !leadQuery.trim() ? (
              <Text style={styles.filterNote}>Showing 30 of {leadOptions.length}. Search to find the rest.</Text>
            ) : null}
          </>
        ) : null}
      </AppSheet>

      <AppSheet visible={sheet === "assignee"} onClose={() => setSheet(null)} title="Assignee">
        <Pressable
          style={styles.sheetRow}
          onPress={() => {
            setAssigneeFilter("");
            setSheet(null);
          }}
          accessibilityRole="button"
        >
          <Text style={styles.sheetLabel}>All assignees</Text>
          {!assigneeFilter ? <Glyph name="checkmark" size={18} color={brand.primary} /> : null}
        </Pressable>
        {teamUsers.map((row) => {
          const id = String(row?._id || "");
          return (
            <Pressable
              key={id}
              style={styles.sheetRow}
              onPress={() => {
                setAssigneeFilter(id);
                setSheet(null);
              }}
              accessibilityRole="button"
            >
              <Text style={styles.sheetLabel}>{String(row?.name || "User")}</Text>
              {assigneeFilter === id ? <Glyph name="checkmark" size={18} color={brand.primary} /> : null}
            </Pressable>
          );
        })}
      </AppSheet>

      <AppSheet visible={sheet === "role"} onClose={() => setSheet(null)} title="Role">
        {[{ id: "", label: "All roles" }, ...Object.keys(ROLE_LABEL).map((id) => ({ id, label: ROLE_LABEL[id] }))].map(
          (row) => (
            <Pressable
              key={row.id || "all"}
              style={styles.sheetRow}
              onPress={() => {
                setRoleFilter(row.id);
                setSheet(null);
              }}
              accessibilityRole="button"
            >
              <Text style={styles.sheetLabel}>{row.label}</Text>
              {roleFilter === row.id ? <Glyph name="checkmark" size={18} color={brand.primary} /> : null}
            </Pressable>
          ),
        )}
      </AppSheet>

      <AppSheet
        visible={sheet === "task"}
        onClose={() => {
          setSheet(null);
          setMenuTask(null);
        }}
        title={menuTask?.title || "Task"}
      >
        {(["TODO", "IN_PROGRESS", "COMPLETED"] as StatusId[]).map((status) => (
          <Pressable
            key={status}
            style={styles.sheetRow}
            onPress={() => menuTask && void moveTask(menuTask, status)}
            accessibilityRole="button"
          >
            <Text style={styles.sheetLabel}>
              Move to {status === "IN_PROGRESS" ? "In Progress" : status === "TODO" ? "To Do" : "Completed"}
            </Text>
          </Pressable>
        ))}
        <Pressable
          style={styles.sheetRow}
          onPress={() => menuTask && void removeTask(menuTask)}
          accessibilityRole="button"
        >
          <Text style={[styles.sheetLabel, styles.sheetDanger]}>Delete task</Text>
        </Pressable>
      </AppSheet>
    </SafeAreaView>
  );
};

const Empty = ({ label = "No tasks to show" }: { label?: string }) => (
  <View style={styles.empty}>
    <Glyph name="checkbox-outline" size={34} color={brand.textMuted} />
    <Text style={styles.emptyText}>{label}</Text>
  </View>
);

const styles = brandStyles((b) =>
  StyleSheet.create({
    quickAdd: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      height: 44,
      paddingHorizontal: 12,
      marginBottom: 12,
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: b.track,
      borderRadius: round.field,
      backgroundColor: b.uploadTint,
    },
    quickAddInput: { flex: 1, fontSize: t.field, color: b.text, paddingVertical: 0 },
    root: {
      flex: 1,
      backgroundColor: b.bg,
    },
    centred: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    grow: {
      flex: 1,
      minWidth: 0,
    },

    header: {
      paddingHorizontal: layout.pageGutter,
      paddingTop: 8,
      paddingBottom: 12,
    },
    pageTitle: {
      width: "62%",
      fontSize: t.pageTitle,
      lineHeight: 30,
      fontWeight: "700",
      letterSpacing: -0.8,
      color: b.text,
    },
    pageSubtitle: {
      marginTop: 2,
      fontSize: t.cardTitle,
      lineHeight: 18,
      color: b.textMuted,
    },
    addBtn: {
      position: "absolute",
      right: layout.pageGutter,
      top: 6,
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      height: 34,
      paddingHorizontal: 14,
      borderRadius: round.button,
      backgroundColor: b.primary,
    },
    addBtnText: {
      fontSize: t.body,
      fontWeight: "600",
      color: b.onPrimary,
    },

    tabBar: {
      flexDirection: "row",
      paddingHorizontal: layout.pageGutter,
      borderBottomWidth: 1,
      borderBottomColor: b.hairline,
    },
    tabItem: {
      flex: 1,
      minWidth: 0,
      alignItems: "center",
    },
    tabLabel: {
      paddingBottom: 9,
      fontSize: t.cardTitle,
      fontWeight: "600",
      color: b.textSecondary,
    },
    tabLabelOn: {
      color: b.deep,
    },
    tabRule: {
      alignSelf: "stretch",
      height: 2,
      backgroundColor: "transparent",
    },
    tabRuleOn: {
      backgroundColor: b.primary,
    },

    body: {
      paddingHorizontal: layout.pageGutter,
      paddingTop: 14,
    },

    banner: {
      marginBottom: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: b.alert,
      borderRadius: round.field,
      backgroundColor: b.surface,
    },
    bannerText: {
      fontSize: t.body,
      lineHeight: 17,
      color: b.alert,
    },

    tileRow: {
      flexDirection: "row",
      gap: 7,
      marginBottom: 14,
    },
    tile: {
      flex: 1,
      minWidth: 0,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 12,
      paddingHorizontal: 4,
      borderWidth: 1,
      borderColor: b.border,
      borderRadius: round.panel,
      backgroundColor: b.surface,
    },
    tileIcon: {
      width: 36,
      height: 36,
      borderRadius: round.pill,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 6,
    },
    tileValue: {
      fontSize: t.hero,
      lineHeight: 26,
      fontWeight: "700",
      letterSpacing: -0.4,
      color: b.text,
    },
    tileLabel: {
      marginTop: 2,
      fontSize: t.label,
      textAlign: "center",
      color: b.textSecondary,
    },

    searchBox: {
      height: 39,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 15,
      borderWidth: 1,
      borderColor: b.border,
      borderRadius: round.field,
      backgroundColor: b.surface,
    },
    searchInput: {
      flex: 1,
      minWidth: 0,
      paddingVertical: 0,
      fontSize: t.body,
      color: b.text,
    },

    toolRow: {
      marginTop: 14,
      marginBottom: 6,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    },
    tool: {
      flexShrink: 1,
      minWidth: 0,
      height: 35,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 14,
      borderWidth: 1,
      borderColor: b.border,
      borderRadius: round.field,
      backgroundColor: b.surface,
    },
    toolTight: {
      /* Three across on My Tasks: the comp sizes each pill to its own label
         rather than splitting the row in three, so the chrome has to be tight
         enough for all three to fit. */
      paddingHorizontal: 8,
      gap: 4,
    },
    toolLabel: {
      flexShrink: 1,
      minWidth: 0,
      fontSize: t.cardTitle,
      fontWeight: "500",
      color: b.text,
    },
    toolLabelTight: {
      fontSize: t.body,
    },

    chipScroll: {
      marginTop: 8,
      marginHorizontal: -layout.pageGutter,
    },
    chipRow: {
      flexDirection: "row",
      gap: 6,
      paddingHorizontal: layout.pageGutter,
    },
    chip: {
      height: 32,
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: b.border,
      borderRadius: round.chip,
      backgroundColor: b.surface,
    },
    chipOn: {
      borderColor: b.greenBright,
      backgroundColor: b.chipActiveBg,
    },
    chipLabel: {
      fontSize: t.cardTitle,
      fontWeight: "500",
      color: b.text,
    },
    chipLabelOn: {
      fontWeight: "600",
    },
    chipCount: {
      minWidth: 19,
      paddingHorizontal: 5,
      paddingVertical: 1,
      alignItems: "center",
      borderRadius: round.pill,
      backgroundColor: b.hairline,
    },
    chipCountOn: {
      backgroundColor: b.chipActiveCount,
    },
    chipCountText: {
      fontSize: t.label,
      fontWeight: "600",
      color: b.textSecondary,
    },
    chipCountTextOn: {
      color: b.onPrimary,
    },

    sectionHead: {
      marginTop: 18,
      marginBottom: 10,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    sectionTitle: {
      fontSize: t.barTitle,
      lineHeight: 23,
      fontWeight: "700",
      letterSpacing: -0.3,
      color: b.text,
    },
    sectionBubble: {
      minWidth: 22,
      paddingHorizontal: 6,
      paddingVertical: 2,
      alignItems: "center",
      borderRadius: round.pill,
      backgroundColor: b.hairline,
    },
    sectionBubbleText: {
      fontSize: t.body,
      fontWeight: "600",
      color: b.textSecondary,
    },
    seeAll: {
      marginLeft: "auto",
    },
    seeAllText: {
      fontSize: t.cardTitle,
      fontWeight: "600",
      color: b.deep,
    },

    empty: {
      alignItems: "center",
      gap: 10,
      paddingVertical: 44,
    },
    emptyText: {
      fontSize: t.field,
      color: b.textMuted,
    },

    /* ---- team ---- */
    rateCard: {
      marginBottom: 14,
      padding: 16,
      borderWidth: 1,
      borderColor: b.border,
      borderRadius: round.panel,
      backgroundColor: b.surface,
    },
    rateHead: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    rateTitle: {
      fontSize: t.barTitle,
      lineHeight: 22,
      fontWeight: "700",
      letterSpacing: -0.3,
      color: b.text,
    },
    rateNote: {
      marginTop: 2,
      fontSize: t.body,
      color: b.textMuted,
    },
    rateValue: {
      fontSize: t.hero,
      fontWeight: "700",
      letterSpacing: -0.4,
      color: b.deep,
    },
    track: {
      marginTop: 12,
      height: 10,
      borderRadius: round.pill,
      overflow: "hidden",
      backgroundColor: b.hairline,
    },
    trackFill: {
      height: "100%",
      borderRadius: round.pill,
      backgroundColor: b.greenBright,
    },

    memberCard: {
      marginBottom: 10,
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: b.border,
      borderRadius: round.panel,
      backgroundColor: b.surface,
    },
    memberAvatar: {
      width: 46,
      height: 46,
      borderRadius: round.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: b.tint,
    },
    memberInitials: {
      fontSize: t.sectionTitle,
      fontWeight: "700",
      color: b.deep,
    },
    memberTop: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    memberName: {
      fontSize: t.sectionTitle,
      lineHeight: 20,
      fontWeight: "700",
      letterSpacing: -0.3,
      color: b.text,
    },
    memberRole: {
      marginTop: 1,
      fontSize: t.body,
      color: b.textMuted,
    },
    memberStats: {
      marginTop: 10,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    memberDivider: {
      width: 1,
      height: 28,
      backgroundColor: b.hairline,
    },
    memberFigure: {
      fontSize: t.sectionTitle,
      fontWeight: "700",
      color: b.text,
    },
    memberCaption: {
      fontSize: t.tagline,
      color: b.textMuted,
    },
    memberBarWrap: {
      flex: 1,
      minWidth: 0,
    },
    memberCount: {
      fontSize: t.body,
      color: b.textMuted,
    },

    overviewCard: {
      marginTop: 14,
      padding: 16,
      borderWidth: 1,
      borderColor: b.border,
      borderRadius: round.panel,
      backgroundColor: b.surface,
    },
    overviewRow: {
      marginTop: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    overviewLabel: {
      width: 82,
      fontSize: t.field,
      color: b.text,
    },
    overviewCount: {
      width: 18,
      fontSize: t.field,
      fontWeight: "600",
      color: b.text,
    },
    overviewTrack: {
      flex: 1,
      minWidth: 0,
      height: 10,
      borderRadius: round.pill,
      overflow: "hidden",
      backgroundColor: b.hairline,
    },
    overviewFill: {
      height: "100%",
      borderRadius: round.pill,
    },

    pill: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: round.button,
    },
    pillText: {
      fontSize: t.body,
      fontWeight: "600",
    },

    sheetRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: b.hairline,
    },
    sheetLabel: {
      fontSize: t.field,
      color: b.text,
    },
    sheetDanger: {
      color: b.alert,
      fontWeight: "600",
    },
    filterHeading: {
      marginTop: 14,
      marginBottom: 8,
      fontSize: t.label,
      fontWeight: "700",
      color: b.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.6,
    },
    filterChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    filterChip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: round.pill,
      borderWidth: 1,
      borderColor: b.hairline,
      backgroundColor: b.surface,
    },
    filterChipOn: { borderColor: b.primary, backgroundColor: b.chipActiveBg },
    filterChipText: { fontSize: t.body, color: b.text },
    filterChipTextOn: { color: b.deep, fontWeight: "600" },
    leadSearch: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      height: 42,
      paddingHorizontal: 12,
      borderRadius: round.field,
      borderWidth: 1,
      borderColor: b.hairline,
    },
    leadSearchInput: { flex: 1, fontSize: t.field, color: b.text },
    leadName: { flex: 1, marginRight: 8 },
    leadLoading: { marginVertical: 12 },
    filterNote: { marginTop: 8, fontSize: t.label, color: b.textMuted },
    filterFooter: { flexDirection: "row", gap: 10 },
    filterClear: {
      flex: 1,
      height: 46,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: round.button,
      borderWidth: 1,
      borderColor: b.hairline,
    },
    filterClearText: { fontSize: t.field, fontWeight: "600", color: b.text },
    filterMuted: { color: b.textMuted },
    filterDone: {
      flex: 1,
      height: 46,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: round.button,
      backgroundColor: b.primary,
    },
    filterDoneText: { fontSize: t.field, fontWeight: "700", color: b.onPrimary },
  }),
);
