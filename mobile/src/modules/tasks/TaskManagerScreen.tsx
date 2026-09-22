import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Icon } from "../../components/ui/Icon";
import { Screen } from "../../components/common/Screen";
import { AppSearchInput, AppSegmentedTabs, AppSheet } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { radii, spacing, typography } from "../../theme/tokens";
import { themedStyles, themePalette } from "../../theme/themedStyles";
import { toErrorMessage } from "../../utils/errorMessage";
import {
  deleteTask,
  getTasks,
  getTaskStats,
  getTaskStatsByUser,
  updateTask,
  type Task,
} from "../../services/taskService";
import { getUsers } from "../../services/userService";
import {
  PRIORITY_IDS,
  STATUS_IDS,
  completionRate,
  isDueToday,
  isOverdue,
  priorityTone,
  statusTone,
  workloadBand,
  type StatusId,
} from "./taskConstants";
import { FilterPill, StatGrid, type StatTile } from "./components/TaskPieces";
import { TaskListRow } from "./components/TaskListRow";
import { TaskBoard } from "./components/TaskBoard";
import { TeamMemberCard, TeamWorkloadCard, type TeamMemberRow } from "./components/TeamPanel";

/*
 * The Tasks screen, built to the mobile comps.
 *
 * Four scopes across the top - everything, what was handed to me, what I
 * raised, and how the team is carrying it - then a list or a board of the
 * same tasks underneath. The scopes are the API's own: `scope=assigned` is
 * assigned-to-me-but-raised-by-someone-else and `scope=mine` is what I
 * created, which is why the Assigned rows can say "Assigned to me" flatly
 * while My Task rows have to name the person.
 *
 * This is ahead of the web Tasks page, which has neither the board nor the
 * team roll-up. The divergence is deliberate and recorded in
 * docs/mobile/00_MOBILE_PARITY_SPEC.md.
 */

type TabKey = "ALL" | "ASSIGNED" | "MINE" | "TEAM";
type ViewMode = "LIST" | "BOARD";
type SortKey = "NEWEST" | "DUE" | "PRIORITY" | "TITLE";

const SORTS: Array<{ id: SortKey; label: string }> = [
  { id: "NEWEST", label: "Newest first" },
  { id: "DUE", label: "Due date" },
  { id: "PRIORITY", label: "Priority" },
  { id: "TITLE", label: "Title" },
];

const scopeFor = (tab: TabKey) => {
  if (tab === "ASSIGNED") return "assigned";
  if (tab === "MINE") return "mine";
  return undefined;
};

type SheetKind = "status" | "priority" | "assignee" | "sort" | "task" | null;

export const TaskManagerScreen = () => {
  const navigation = useNavigation<any>();
  const { user, role } = useAuth();
  const canSeeTeam = role === "ADMIN" || role === "MANAGER";

  const [tab, setTab] = useState<TabKey>("ALL");
  const [view, setView] = useState<ViewMode>("LIST");

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
  const [priorityFilter, setPriorityFilter] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("NEWEST");

  const [sheet, setSheet] = useState<SheetKind>(null);
  const [menuTask, setMenuTask] = useState<Task | null>(null);

  /* The list refetches on every keystroke otherwise. */
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

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
        if (priorityFilter) listParams.priority = priorityFilter;
        if (assigneeFilter) listParams.assignedTo = assigneeFilter;
        if (search) listParams.search = search;

        const statsParams: Record<string, any> = {};
        if (scope) statsParams.scope = scope;

        const wantsTeam = tab === "TEAM" && canSeeTeam;

        const [taskRows, statRow, teamRow, userRow] = await Promise.allSettled([
          getTasks(listParams),
          getTaskStats(statsParams),
          wantsTeam ? getTaskStatsByUser() : Promise.resolve({}),
          getUsers(),
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
    [tab, statusFilter, priorityFilter, assigneeFilter, search, canSeeTeam],
  );

  useEffect(() => {
    void load();
  }, [load]);

  /* Coming back from the details or create screen should show the change. */
  useFocusEffect(
    useCallback(() => {
      void load(true);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab]),
  );

  /* -------------------------------------------------------------- derived -- */

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
      list.sort(
        (a, b) => (weight[b.priority || "MEDIUM"] || 0) - (weight[a.priority || "MEDIUM"] || 0),
      );
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

  const members: TeamMemberRow[] = useMemo(() => {
    if (!canSeeTeam) return [];
    return teamUsers
      .filter((row) => String(row?.role || "") !== "CHANNEL_PARTNER")
      .map((row) => {
        const id = String(row?._id || row?.id || "");
        const row_ = byUser[id] || {};
        const total = Number(row_.total || 0);
        const done = Number(row_.COMPLETED || 0);
        const pending = Number(row_.pending ?? Math.max(total - done, 0));
        return {
          id,
          name: String(row?.name || "User"),
          role: String(row?.role || "-"),
          band: workloadBand(pending, row?.isActive !== false),
          total,
          done,
          overdue: Number(row_.overdue || 0),
        };
      })
      .sort((a, b) => b.overdue - a.overdue || b.total - a.total);
  }, [canSeeTeam, teamUsers, byUser]);

  const teamTotals = useMemo(() => {
    const total = members.reduce((sum, row) => sum + row.total, 0);
    const done = members.reduce((sum, row) => sum + row.done, 0);
    const overdue = members.reduce((sum, row) => sum + row.overdue, 0);
    return { total, done, overdue };
  }, [members]);

  const tiles: StatTile[] = useMemo(() => {
    const c = themePalette;
    const total = Number(stats.total || 0);
    const completed = Number(stats.COMPLETED || 0);
    const pending = Number(stats.pending || 0);
    const overdue = Number(stats.overdue || 0);
    const inProgress = Number(stats.IN_PROGRESS || 0);
    const dueToday = tasks.filter(isDueToday).length;

    if (tab === "TEAM") {
      return [
        { label: "Team Members", value: String(members.length), icon: "people", tint: c.blue[50], color: c.blue[600] },
        { label: "Total Tasks", value: String(teamTotals.total), icon: "document-text-outline", tint: c.blue[50], color: c.blue[600] },
        { label: "Completed", value: String(teamTotals.done), icon: "checkmark-circle-outline", tint: c.emerald[50], color: c.emerald[600], emphasis: "success" },
        { label: "Overdue", value: String(teamTotals.overdue), icon: "alert-circle-outline", tint: c.rose[50], color: c.rose[600], emphasis: "danger" },
        { label: "Completion Rate", value: `${completionRate(teamTotals.done, teamTotals.total)}%`, icon: "barChart", tint: c.violet[50], color: c.violet[600] },
      ];
    }

    if (tab === "ASSIGNED") {
      return [
        { label: "Total Assigned", value: String(total), icon: "people", tint: c.blue[50], color: c.blue[600] },
        { label: "In Progress", value: String(inProgress), icon: "time-outline", tint: c.blue[50], color: c.blue[600] },
        { label: "Due Today", value: String(dueToday), icon: "calendarDays", tint: c.amber[50], color: c.amber[700], emphasis: "warning" },
        { label: "Overdue", value: String(overdue), icon: "alert-circle-outline", tint: c.rose[50], color: c.rose[600], emphasis: "danger" },
        { label: "Completion Rate", value: `${completionRate(completed, total)}%`, icon: "barChart", tint: c.violet[50], color: c.violet[600] },
      ];
    }

    return [
      { label: "Total Tasks", value: String(total), icon: "document-text-outline", tint: c.blue[50], color: c.blue[600] },
      { label: "Completed", value: String(completed), icon: "checkmark-circle-outline", tint: c.emerald[50], color: c.emerald[600], emphasis: "success" },
      { label: "Pending", value: String(pending), icon: "time-outline", tint: c.amber[50], color: c.amber[700], emphasis: "warning" },
      { label: "Overdue", value: String(overdue), icon: "alert-circle-outline", tint: c.rose[50], color: c.rose[600], emphasis: "danger" },
      { label: "Completion Rate", value: `${completionRate(completed, total)}%`, icon: "barChart", tint: c.violet[50], color: c.violet[600] },
    ];
  }, [tab, stats, tasks, members.length, teamTotals]);

  const activeFilterCount =
    (statusFilter ? 1 : 0) + (priorityFilter ? 1 : 0) + (assigneeFilter ? 1 : 0);

  const assigneeLabel = assigneeFilter
    ? teamUsers.find((row) => String(row?._id || row?.id) === assigneeFilter)?.name || "Assignee"
    : "Assignee";

  /* -------------------------------------------------------------- actions -- */

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

  const showMemberTasks = (member: TeamMemberRow) => {
    setAssigneeFilter(member.id);
    setTab("ALL");
  };

  /* --------------------------------------------------------------- render -- */

  const listVariant = tab === "ASSIGNED" ? "chips" : "meta";

  const renderContent = () => {
    if (tab === "TEAM") {
      return (
        <View style={styles.stack}>
          <TeamWorkloadCard members={members} />
          {members.length === 0 ? (
            <Text style={styles.empty}>No team members to show.</Text>
          ) : (
            members.map((member) => (
              <TeamMemberCard
                key={member.id}
                member={member}
                onPress={() => showMemberTasks(member)}
                onMenu={() => showMemberTasks(member)}
              />
            ))
          )}
        </View>
      );
    }

    if (view === "BOARD") {
      return (
        <TaskBoard
          tasks={sorted}
          onOpenTask={openTask}
          onTaskMenu={(task) => {
            setMenuTask(task);
            setSheet("task");
          }}
          onAddTask={(status) => openCreate(status)}
        />
      );
    }

    if (sorted.length === 0) {
      return <Text style={styles.empty}>No tasks match this view.</Text>;
    }

    return (
      <View style={styles.stack}>
        {sorted.map((task) => (
          <TaskListRow
            key={task._id}
            task={task}
            variant={listVariant}
            selfLabel={tab === "ASSIGNED"}
            onPress={() => openTask(task)}
            onToggle={() => toggleDone(task)}
            onMenu={() => {
              setMenuTask(task);
              setSheet("task");
            }}
          />
        ))}
      </View>
    );
  };

  const tabs = useMemo(() => {
    const base = [
      { key: "ALL", label: "All Task" },
      { key: "ASSIGNED", label: "Assigned" },
      { key: "MINE", label: "My Task" },
    ];
    return canSeeTeam ? [...base, { key: "TEAM", label: "Team" }] : base;
  }, [canSeeTeam]);

  return (
    <Screen
      title="Tasks"
      description="Manage work and track progress"
      loading={loading}
      error={error}
      onRetry={() => load()}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.page}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
      >
        <AppSegmentedTabs tabs={tabs} activeKey={tab} onChange={(key) => setTab(key as TabKey)} />

        <StatGrid tiles={tiles} />

        {tab === "TEAM" ? (
          <View style={styles.controlRow}>
            <AppSearchInput
              value={searchInput}
              onChangeText={setSearchInput}
              placeholder="Search team member..."
              style={styles.searchFlex}
            />
            <FilterPill
              icon="sliders"
              label="Filters"
              caret={false}
              active={activeFilterCount > 0}
              onPress={() => setSheet("status")}
            />
            <FilterPill icon="sort" label="Sort" caret={false} onPress={() => setSheet("sort")} />
          </View>
        ) : view === "BOARD" ? (
          <View style={styles.controlRow}>
            <AppSearchInput
              value={searchInput}
              onChangeText={setSearchInput}
              placeholder="Search tasks..."
              style={styles.searchFlex}
            />
            <FilterPill
              icon="sliders"
              label="Filters"
              caret={false}
              active={activeFilterCount > 0}
              onPress={() => setSheet("status")}
            />
            <ViewToggle view={view} onChange={setView} />
          </View>
        ) : (
          <>
            <AppSearchInput
              value={searchInput}
              onChangeText={setSearchInput}
              placeholder="Search tasks by title or description..."
            />

            <View style={styles.filterRow}>
              <FilterPill
                label={statusFilter ? statusTone(statusFilter).label : "Status"}
                icon="funnel-outline"
                active={!!statusFilter}
                onPress={() => setSheet("status")}
                style={styles.filterFlex}
              />
              <FilterPill
                label={priorityFilter ? priorityTone(priorityFilter).label : "Priority"}
                icon="flag"
                active={!!priorityFilter}
                onPress={() => setSheet("priority")}
                style={styles.filterFlex}
              />
              <FilterPill
                label={assigneeLabel}
                icon="people"
                active={!!assigneeFilter}
                onPress={() => setSheet("assignee")}
                style={styles.filterFlex}
              />
              <FilterPill icon="sort" label="Sort" caret={false} onPress={() => setSheet("sort")} />
            </View>

            <View style={styles.actionRow}>
              <ViewToggle view={view} onChange={setView} />
              <View style={styles.spacer} />
              <Pressable
                style={styles.newTask}
                onPress={() => openCreate()}
                accessibilityRole="button"
              >
                <Icon name="add" size={16} color="#ffffff" />
                <Text style={styles.newTaskText}>New Task</Text>
              </Pressable>
            </View>
          </>
        )}

        {renderContent()}
      </ScrollView>

      <Pressable
        style={styles.fab}
        onPress={() => openCreate()}
        accessibilityRole="button"
        accessibilityLabel="New task"
      >
        <Icon name="add" size={26} color="#ffffff" />
      </Pressable>

      {/* ------------------------------------------------------------ sheets -- */}

      <AppSheet
        visible={sheet === "status"}
        onClose={() => setSheet(null)}
        title="Status"
        subtitle="Show only tasks in this state"
      >
        <OptionList
          options={[
            { id: "", label: "All statuses" },
            ...STATUS_IDS.map((id) => ({ id, label: statusTone(id).label })),
          ]}
          selected={statusFilter}
          onSelect={(id) => {
            setStatusFilter(id);
            setSheet(null);
          }}
        />
      </AppSheet>

      <AppSheet
        visible={sheet === "priority"}
        onClose={() => setSheet(null)}
        title="Priority"
        subtitle="Show only tasks at this priority"
      >
        <OptionList
          options={[
            { id: "", label: "All priorities" },
            ...PRIORITY_IDS.map((id) => ({ id, label: priorityTone(id).label })),
          ]}
          selected={priorityFilter}
          onSelect={(id) => {
            setPriorityFilter(id);
            setSheet(null);
          }}
        />
      </AppSheet>

      <AppSheet
        visible={sheet === "assignee"}
        onClose={() => setSheet(null)}
        title="Assignee"
        subtitle="Show only tasks on this person"
      >
        <OptionList
          options={[
            { id: "", label: "Anyone" },
            ...(user?._id || user?.id
              ? [{ id: String(user?._id || user?.id), label: "Me" }]
              : []),
            ...teamUsers.map((row) => ({
              id: String(row?._id || row?.id || ""),
              label: String(row?.name || "User"),
            })),
          ]}
          selected={assigneeFilter}
          onSelect={(id) => {
            setAssigneeFilter(id);
            setSheet(null);
          }}
        />
      </AppSheet>

      <AppSheet
        visible={sheet === "sort"}
        onClose={() => setSheet(null)}
        title="Sort by"
      >
        <OptionList
          options={SORTS.map((row) => ({ id: row.id, label: row.label }))}
          selected={sortBy}
          onSelect={(id) => {
            setSortBy(id as SortKey);
            setSheet(null);
          }}
        />
      </AppSheet>

      <AppSheet
        visible={sheet === "task" && !!menuTask}
        onClose={() => {
          setSheet(null);
          setMenuTask(null);
        }}
        title={menuTask?.title}
      >
        {menuTask ? (
          <OptionList
            options={[
              { id: "open", label: "Open task" },
              ...STATUS_IDS.filter(
                (id) => id !== String(menuTask.status || "").toUpperCase(),
              ).map((id) => ({ id: `move:${id}`, label: `Move to ${statusTone(id).label}` })),
              { id: "delete", label: "Delete task", tone: "danger" as const },
            ]}
            selected=""
            onSelect={(id) => {
              if (id === "open") {
                const task = menuTask;
                setSheet(null);
                setMenuTask(null);
                openTask(task);
                return;
              }
              if (id === "delete") {
                void removeTask(menuTask);
                return;
              }
              if (id.startsWith("move:")) {
                void moveTask(menuTask, id.slice(5) as StatusId);
              }
            }}
          />
        ) : null}
      </AppSheet>
    </Screen>
  );
};

/* ------------------------------------------------------------ small parts -- */

const ViewToggle = ({
  view,
  onChange,
}: {
  view: ViewMode;
  onChange: (next: ViewMode) => void;
}) => (
  <View style={styles.toggle}>
    {(["BOARD", "LIST"] as ViewMode[]).map((mode) => {
      const active = view === mode;
      return (
        <Pressable
          key={mode}
          onPress={() => onChange(mode)}
          accessibilityRole="button"
          accessibilityState={{ selected: active }}
          style={[styles.toggleItem, active && styles.toggleItemActive]}
        >
          <Icon
            name={mode === "BOARD" ? "board" : "list"}
            size={15}
            color={active ? themePalette.blue[600] : themePalette.slate[600]}
          />
          <Text style={[styles.toggleText, active && styles.toggleTextActive]}>
            {mode === "BOARD" ? "Board" : "List"}
          </Text>
        </Pressable>
      );
    })}
  </View>
);

const OptionList = ({
  options,
  selected,
  onSelect,
}: {
  options: Array<{ id: string; label: string; tone?: "danger" }>;
  selected: string;
  onSelect: (id: string) => void;
}) => (
  <View>
    {options.map((option) => {
      const active = option.id === selected;
      return (
        <Pressable
          key={option.id || "__all"}
          onPress={() => onSelect(option.id)}
          accessibilityRole="button"
          style={styles.option}
        >
          <Text
            style={[
              styles.optionText,
              active && styles.optionTextActive,
              option.tone === "danger" && styles.optionTextDanger,
            ]}
          >
            {option.label}
          </Text>
          {active ? (
            <Icon name="checkmark" size={16} color={themePalette.blue[600]} />
          ) : null}
        </Pressable>
      );
    })}
  </View>
);

const styles = themedStyles((c) => StyleSheet.create({
  page: {
    gap: spacing.lg,
    paddingBottom: 96,
  },
  stack: {
    gap: spacing.lg,
  },
  controlRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  searchFlex: {
    flex: 1,
  },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  filterFlex: {
    flex: 1,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  spacer: {
    flex: 1,
  },
  toggle: {
    flexDirection: "row",
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
    overflow: "hidden",
  },
  toggleItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    height: 44,
    paddingHorizontal: spacing.lg,
  },
  toggleItemActive: {
    backgroundColor: c.blue[50],
  },
  toggleText: {
    fontSize: typography.label,
    fontWeight: "600",
    color: c.slate[600],
  },
  toggleTextActive: {
    color: c.blue[600],
  },
  newTask: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    height: 44,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.md,
    backgroundColor: c.slate[900],
  },
  newTaskText: {
    fontSize: typography.label,
    fontWeight: "700",
    color: "#ffffff",
  },
  empty: {
    paddingVertical: 40,
    textAlign: "center",
    fontSize: typography.label,
    color: c.slate[400],
  },
  fab: {
    position: "absolute",
    right: spacing.xl,
    bottom: spacing.xl,
    width: 60,
    height: 60,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.blue[600],
    shadowColor: c.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 6,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  optionText: {
    fontSize: typography.body,
    color: c.slate[700],
  },
  optionTextActive: {
    fontWeight: "700",
    color: c.blue[600],
  },
  optionTextDanger: {
    color: c.rose[600],
  },
}));

export default TaskManagerScreen;
