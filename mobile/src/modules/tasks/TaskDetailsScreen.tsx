import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Icon } from "../../components/ui/Icon";
import { AppSheet } from "../../components/ui";
import { radii, spacing, typography } from "../../theme/tokens";
import { themedStyles, themePalette } from "../../theme/themedStyles";
import { toErrorMessage } from "../../utils/errorMessage";
import {
  deleteTask,
  getTaskById,
  updateTask,
  type Task,
} from "../../services/taskService";
import { getUsers } from "../../services/userService";
import {
  STATUS_IDS,
  assigneeName,
  formatTaskDate,
  priorityTone,
  statusTone,
  subtaskProgress,
  toDate,
  type StatusId,
} from "./taskConstants";
import { Avatar } from "./components/TaskPieces";

/*
 * One task, in full.
 *
 * The header row, the fact grid, the description, the checklist and the
 * activity rail all come from the comp. The one place the comp asks for
 * something the data does not hold is the activity feed: there is no task
 * audit endpoint, so rather than invent entries this builds the timeline from
 * what the record actually carries - when it was raised and by whom, every
 * reassignment in assignmentHistory, and when it was last touched. If a real
 * audit trail lands later, replace buildActivity() and nothing else changes.
 */

type ActivityEntry = {
  id: string;
  actor: string;
  text: string;
  at: Date | null;
};

const buildActivity = (task: Task | null, nameFor: (id: string) => string): ActivityEntry[] => {
  if (!task) return [];
  const entries: ActivityEntry[] = [];

  const creator =
    task.createdBy && typeof task.createdBy === "object"
      ? String(task.createdBy.name || "Someone")
      : nameFor(String(task.createdBy || ""));

  entries.push({
    id: "created",
    actor: creator,
    text: "created this task",
    at: toDate(task.createdAt),
  });

  const history = Array.isArray((task as any).assignmentHistory)
    ? (task as any).assignmentHistory
    : [];
  history.forEach((row: any, index: number) => {
    const actor = nameFor(String(row?.actor || ""));
    const to = nameFor(String(row?.toUser || ""));
    entries.push({
      id: `assign-${index}`,
      actor,
      text: to ? `assigned this task to ${to}` : "unassigned this task",
      at: toDate(row?.at),
    });
  });

  const updated = toDate(task.updatedAt);
  const created = toDate(task.createdAt);
  if (updated && created && updated.getTime() - created.getTime() > 1000) {
    entries.push({ id: "updated", actor: "", text: "Task last updated", at: updated });
  }

  return entries.sort((a, b) => (a.at?.getTime() || 0) - (b.at?.getTime() || 0));
};

const stamp = (value: Date | null) =>
  value
    ? `${value.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}, ${value.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`
    : "";

/* ------------------------------------------------------------ small parts -- */

const FactCell = ({
  icon,
  label,
  children,
  onPress,
  trailing,
  wide,
}: {
  icon: string;
  label: string;
  children: React.ReactNode;
  onPress?: () => void;
  trailing?: React.ReactNode;
  wide?: boolean;
}) => {
  const Wrapper: any = onPress ? Pressable : View;
  return (
    <Wrapper
      style={[styles.fact, wide && styles.factWide]}
      onPress={onPress}
      accessibilityRole={onPress ? "button" : undefined}
    >
      <View style={styles.factIcon}>
        <Icon name={icon} size={16} color={themePalette.slate[600]} />
      </View>
      <View style={styles.factBody}>
        <Text style={styles.factLabel}>{label}</Text>
        {children}
      </View>
      {trailing}
    </Wrapper>
  );
};

const SectionCard = ({
  icon,
  title,
  action,
  children,
}: {
  icon: string;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <View style={styles.card}>
    <View style={styles.cardHead}>
      <View style={styles.cardIcon}>
        <Icon name={icon} size={16} color={themePalette.blue[600]} />
      </View>
      <Text style={styles.cardTitle}>{title}</Text>
      <View style={styles.spacer} />
      {action}
    </View>
    {children}
  </View>
);

/* ----------------------------------------------------------------- screen -- */

export const TaskDetailsScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const taskId = String(route.params?.taskId || "");

  const [task, setTask] = useState<Task | null>(null);
  const [people, setPeople] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [showAllActivity, setShowAllActivity] = useState(false);
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [subtaskTitle, setSubtaskTitle] = useState("");

  const load = useCallback(async () => {
    if (!taskId) {
      setError("This task could not be opened.");
      setLoading(false);
      return;
    }
    try {
      setError("");
      const [row, users] = await Promise.allSettled([getTaskById(taskId), getUsers()]);
      if (row.status === "fulfilled") setTask(row.value);
      else setError(toErrorMessage(row.reason, "Failed to load the task"));
      if (users.status === "fulfilled") setPeople(users.value?.users || []);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    void load();
  }, [load]);

  const nameFor = useCallback(
    (id: string) => {
      if (!id) return "";
      const match = people.find((row) => String(row?._id || row?.id) === id);
      return match ? String(match.name || "") : "";
    },
    [people],
  );

  const activity = useMemo(() => buildActivity(task, nameFor), [task, nameFor]);
  const visibleActivity = showAllActivity ? activity : activity.slice(0, 3);

  const save = async (patch: Partial<Task>) => {
    if (!task) return;
    setBusy(true);
    try {
      const updated = await updateTask(task._id, patch);
      if (updated) setTask(updated);
      else await load();
    } catch (err) {
      setError(toErrorMessage(err, "Could not save the change"));
    } finally {
      setBusy(false);
    }
  };

  const toggleSubtask = (index: number) => {
    if (!task) return;
    const next = (task.subtasks || []).map((row, i) =>
      i === index ? { ...row, isCompleted: !row.isCompleted } : row,
    );
    setTask({ ...task, subtasks: next });
    void save({ subtasks: next });
  };

  const addSubtask = () => {
    const title = subtaskTitle.trim();
    if (!task || !title) return;
    const next = [...(task.subtasks || []), { title, isCompleted: false }];
    setSubtaskTitle("");
    setAddingSubtask(false);
    void save({ subtasks: next });
  };

  const removeSubtask = (index: number) => {
    if (!task) return;
    void save({ subtasks: (task.subtasks || []).filter((_, i) => i !== index) });
  };

  const done = String(task?.status || "").toUpperCase() === "COMPLETED";

  const toggleComplete = () => {
    if (!task) return;
    void save({ status: done ? "TODO" : "COMPLETED" });
  };

  const removeTask = async () => {
    if (!task) return;
    setMenuOpen(false);
    try {
      await deleteTask(task._id);
      navigation.goBack();
    } catch (err) {
      setError(toErrorMessage(err, "Could not delete the task"));
    }
  };

  const lead = task?.leadId && typeof task.leadId === "object" ? task.leadId : null;
  const person = task ? assigneeName(task) : "";
  const progress = task ? subtaskProgress(task) : { done: 0, total: 0 };
  const creator =
    task?.createdBy && typeof task.createdBy === "object" ? String(task.createdBy.name || "") : "";
  const tags = Array.isArray(task?.tags) ? task!.tags! : [];

  return (
    <SafeAreaView style={styles.root} edges={["left", "right"]}>
      <View style={styles.topRow}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Icon name="arrow-back" size={22} color={themePalette.slate[900]} />
        </Pressable>
        <Text style={styles.topTitle}>Task Details</Text>
        <View style={styles.spacer} />
        <Pressable
          style={styles.editButton}
          onPress={() => navigation.navigate("NewTask", { taskId })}
          accessibilityRole="button"
          disabled={!task}
        >
          <Icon name="create-outline" size={14} color={themePalette.blue[600]} />
          <Text style={styles.editText}>Edit Task</Text>
        </Pressable>
        <Pressable
          style={styles.iconButton}
          onPress={() => setMenuOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="More actions"
        >
          <Icon name="ellipsis-vertical" size={16} color={themePalette.slate[600]} />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.centred}>
          <ActivityIndicator size="large" color={themePalette.blue[600]} />
        </View>
      ) : (
        <>
          <ScrollView
            contentContainerStyle={styles.page}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {error ? <Text style={styles.error}>{error}</Text> : null}

            {task ? (
              <>
                <View style={styles.card}>
                  <Text style={styles.title}>{task.title}</Text>
                  {task.description ? (
                    <Text style={styles.subtitle}>{task.description}</Text>
                  ) : null}

                  <View style={styles.chipRow}>
                    <View
                      style={[
                        styles.chip,
                        {
                          backgroundColor: statusTone(task.status).bg,
                          borderColor: statusTone(task.status).border,
                        },
                      ]}
                    >
                      <View
                        style={[styles.chipDot, { backgroundColor: statusTone(task.status).color }]}
                      />
                      <Text style={[styles.chipText, { color: statusTone(task.status).color }]}>
                        {statusTone(task.status).label}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.chip,
                        {
                          backgroundColor: priorityTone(task.priority).bg,
                          borderColor: priorityTone(task.priority).border,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.chipDot,
                          { backgroundColor: priorityTone(task.priority).color },
                        ]}
                      />
                      <Text style={[styles.chipText, { color: priorityTone(task.priority).color }]}>
                        {priorityTone(task.priority).label}
                      </Text>
                    </View>

                    <View style={styles.chipPlain}>
                      <Icon name="tag" size={12} color={themePalette.slate[500]} />
                      <Text style={styles.chipPlainText} numberOfLines={1}>
                        {tags.length ? tags.join(", ") : "Not set"}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.factGrid}>
                    <FactCell icon="person-outline" label="Assignee">
                      {person ? (
                        <View style={styles.factPerson}>
                          <Avatar name={person} size={22} />
                          <Text style={styles.factValue} numberOfLines={1}>
                            {person}
                          </Text>
                        </View>
                      ) : (
                        <Text style={styles.factMuted}>Unassigned</Text>
                      )}
                    </FactCell>

                    <FactCell icon="calendarDays" label="Due Date">
                      <Text style={task.dueDate ? styles.factValue : styles.factMuted}>
                        {formatTaskDate(task.dueDate) || "Not set"}
                      </Text>
                    </FactCell>

                    <FactCell
                      icon="business"
                      label="Linked Lead"
                      onPress={
                        lead
                          ? () => navigation.navigate("LeadDetails", { leadId: lead._id })
                          : undefined
                      }
                      trailing={
                        lead ? (
                          <Icon
                            name="chevron-forward"
                            size={16}
                            color={themePalette.slate[400]}
                          />
                        ) : undefined
                      }
                    >
                      <Text style={lead ? styles.factValue : styles.factMuted} numberOfLines={1}>
                        {lead?.name || "Not set"}
                      </Text>
                    </FactCell>

                    <FactCell icon="person-outline" label="Created By">
                      {creator ? (
                        <View style={styles.factPerson}>
                          <Avatar name={creator} size={22} />
                          <View style={styles.factPersonText}>
                            <Text style={styles.factValue} numberOfLines={1}>
                              {creator}
                            </Text>
                            <Text style={styles.factSub}>{formatTaskDate(task.createdAt)}</Text>
                          </View>
                        </View>
                      ) : (
                        <Text style={styles.factMuted}>Unknown</Text>
                      )}
                    </FactCell>

                    <FactCell icon="flag" label="Priority" wide>
                      <Text style={styles.factStrong}>{priorityTone(task.priority).label}</Text>
                    </FactCell>
                  </View>
                </View>

                {task.description ? (
                  <SectionCard icon="document-text-outline" title="Description">
                    <Text style={styles.body}>{task.description}</Text>
                  </SectionCard>
                ) : null}

                <SectionCard
                  icon="subtasks"
                  title={`Subtasks (${progress.done} of ${progress.total})`}
                  action={
                    <Pressable
                      style={styles.addSubtask}
                      onPress={() => setAddingSubtask((prev) => !prev)}
                      accessibilityRole="button"
                    >
                      <Icon name="add" size={13} color={themePalette.blue[600]} />
                      <Text style={styles.addSubtaskText}>Add Subtask</Text>
                    </Pressable>
                  }
                >
                  {addingSubtask ? (
                    <View style={styles.subtaskCompose}>
                      <TextInput
                        value={subtaskTitle}
                        onChangeText={setSubtaskTitle}
                        placeholder="What needs doing?"
                        placeholderTextColor={themePalette.slate[400]}
                        style={styles.subtaskInput}
                        onSubmitEditing={addSubtask}
                        returnKeyType="done"
                        autoFocus
                      />
                      <Pressable
                        style={styles.subtaskAdd}
                        onPress={addSubtask}
                        accessibilityRole="button"
                      >
                        <Text style={styles.subtaskAddText}>Add</Text>
                      </Pressable>
                    </View>
                  ) : null}

                  {progress.total === 0 && !addingSubtask ? (
                    <Text style={styles.empty}>No subtasks yet.</Text>
                  ) : (
                    (task.subtasks || []).map((row, index) => (
                      <View key={`${row.title}-${index}`} style={styles.subtaskRow}>
                        <Pressable
                          onPress={() => toggleSubtask(index)}
                          hitSlop={8}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: !!row.isCompleted }}
                          style={[styles.subtaskDot, row.isCompleted && styles.subtaskDotDone]}
                        >
                          {row.isCompleted ? (
                            <Icon name="checkmark" size={12} color={themePalette.emerald[700]} />
                          ) : null}
                        </Pressable>
                        <Text
                          style={[styles.subtaskText, row.isCompleted && styles.subtaskTextDone]}
                        >
                          {row.title}
                        </Text>
                        <Pressable
                          onPress={() => removeSubtask(index)}
                          hitSlop={8}
                          accessibilityRole="button"
                          accessibilityLabel={`Remove ${row.title}`}
                        >
                          <Icon
                            name="ellipsis-vertical"
                            size={15}
                            color={themePalette.slate[400]}
                          />
                        </Pressable>
                      </View>
                    ))
                  )}
                </SectionCard>

                <SectionCard
                  icon="time-outline"
                  title="Activity"
                  action={
                    activity.length > 3 ? (
                      <Pressable
                        onPress={() => setShowAllActivity((prev) => !prev)}
                        accessibilityRole="button"
                      >
                        <Text style={styles.seeAll}>
                          {showAllActivity ? "See less" : "See All"}
                        </Text>
                      </Pressable>
                    ) : null
                  }
                >
                  {visibleActivity.map((entry, index) => (
                    <View key={entry.id} style={styles.activityRow}>
                      <View style={styles.activityRail}>
                        <View style={styles.activityDot} />
                        {index < visibleActivity.length - 1 ? (
                          <View style={styles.activityLine} />
                        ) : null}
                      </View>
                      {entry.actor ? (
                        <Avatar name={entry.actor} size={30} />
                      ) : (
                        <View style={styles.activityIcon}>
                          <Icon
                            name="refresh"
                            size={14}
                            color={themePalette.slate[500]}
                          />
                        </View>
                      )}
                      <View style={styles.activityBody}>
                        <Text style={styles.activityText}>
                          {entry.actor ? (
                            <Text style={styles.activityActor}>{entry.actor} </Text>
                          ) : null}
                          {entry.text}
                        </Text>
                        <Text style={styles.activityStamp}>{stamp(entry.at)}</Text>
                      </View>
                    </View>
                  ))}
                </SectionCard>
              </>
            ) : null}
          </ScrollView>

          {task ? (
            <View
              style={[
                styles.footer,
                { paddingBottom: Math.max(insets.bottom, Platform.OS === "android" ? 14 : 10) },
              ]}
            >
              <Pressable
                style={[styles.complete, done && styles.reopen]}
                onPress={toggleComplete}
                disabled={busy}
                accessibilityRole="button"
              >
                <Icon
                  name={done ? "refresh" : "checkmark-circle-outline"}
                  size={18}
                  color="#ffffff"
                />
                <Text style={styles.completeText}>
                  {done ? "Reopen Task" : "Mark as Complete"}
                </Text>
              </Pressable>
            </View>
          ) : null}
        </>
      )}

      <AppSheet visible={menuOpen} onClose={() => setMenuOpen(false)} title={task?.title}>
        {task
          ? [
              ...STATUS_IDS.filter((id) => id !== String(task.status || "").toUpperCase()).map(
                (id) => ({ id: `move:${id}`, label: `Move to ${statusTone(id).label}` }),
              ),
              { id: "edit", label: "Edit task" },
              { id: "delete", label: "Delete task", danger: true },
            ].map((option: any) => (
              <Pressable
                key={option.id}
                style={styles.menuRow}
                accessibilityRole="button"
                onPress={() => {
                  if (option.id === "edit") {
                    setMenuOpen(false);
                    navigation.navigate("NewTask", { taskId });
                    return;
                  }
                  if (option.id === "delete") {
                    void removeTask();
                    return;
                  }
                  setMenuOpen(false);
                  void save({ status: option.id.slice(5) as StatusId });
                }}
              >
                <Text style={[styles.menuText, option.danger && styles.menuDanger]}>
                  {option.label}
                </Text>
              </Pressable>
            ))
          : null}
      </AppSheet>
    </SafeAreaView>
  );
};

const styles = themedStyles((c) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: c.bg,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  topTitle: {
    fontSize: typography.displayMd,
    fontWeight: "700",
    color: c.slate[900],
    letterSpacing: -0.3,
  },
  spacer: {
    flex: 1,
  },
  editButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    height: 38,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.blue[200],
    backgroundColor: c.blue[50],
  },
  editText: {
    fontSize: typography.label,
    fontWeight: "600",
    color: c.blue[600],
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  centred: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  page: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  error: {
    fontSize: typography.label,
    color: c.rose[600],
  },

  /* the fact card */
  card: {
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radii.md,
    backgroundColor: c.surface,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  title: {
    fontSize: typography.title,
    fontWeight: "700",
    color: c.slate[900],
  },
  subtitle: {
    marginTop: -spacing.md,
    fontSize: typography.label,
    color: c.slate[500],
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: 7,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  chipDot: {
    width: 8,
    height: 8,
    borderRadius: radii.pill,
  },
  chipText: {
    fontSize: typography.label,
    fontWeight: "600",
  },
  chipPlain: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: 7,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surfaceMuted,
    maxWidth: "60%",
  },
  chipPlainText: {
    fontSize: typography.label,
    fontWeight: "600",
    color: c.slate[600],
    flexShrink: 1,
  },
  factGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  fact: {
    width: "48.5%",
    flexGrow: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surfaceMuted,
  },
  factWide: {
    width: "100%",
  },
  factIcon: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.surface,
  },
  factBody: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  factLabel: {
    fontSize: typography.caption,
    color: c.slate[500],
  },
  factValue: {
    fontSize: typography.label,
    fontWeight: "600",
    color: c.slate[900],
    flexShrink: 1,
  },
  factStrong: {
    fontSize: typography.body,
    fontWeight: "700",
    color: c.slate[900],
  },
  factMuted: {
    fontSize: typography.label,
    color: c.slate[500],
  },
  factSub: {
    fontSize: typography.caption,
    color: c.slate[500],
  },
  factPerson: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  factPersonText: {
    flex: 1,
    minWidth: 0,
  },

  /* section cards */
  cardHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  cardIcon: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.blue[50],
  },
  cardTitle: {
    fontSize: typography.section,
    fontWeight: "700",
    color: c.slate[900],
  },
  body: {
    fontSize: typography.body,
    lineHeight: 20,
    color: c.slate[600],
  },
  seeAll: {
    fontSize: typography.label,
    fontWeight: "600",
    color: c.blue[600],
  },
  empty: {
    fontSize: typography.label,
    color: c.slate[400],
  },

  /* subtasks */
  addSubtask: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    height: 34,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: c.blue[200],
    backgroundColor: c.blue[50],
  },
  addSubtaskText: {
    fontSize: typography.caption,
    fontWeight: "600",
    color: c.blue[600],
  },
  subtaskCompose: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  subtaskInput: {
    flex: 1,
    height: 44,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
    color: c.slate[900],
    fontSize: typography.body,
  },
  subtaskAdd: {
    height: 44,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.blue[600],
  },
  subtaskAddText: {
    fontSize: typography.label,
    fontWeight: "700",
    color: "#ffffff",
  },
  subtaskRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: c.border,
  },
  subtaskDot: {
    width: 22,
    height: 22,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: c.slate[300],
    alignItems: "center",
    justifyContent: "center",
  },
  subtaskDotDone: {
    borderColor: c.emerald[500],
    backgroundColor: c.emerald[50],
  },
  subtaskText: {
    flex: 1,
    fontSize: typography.body,
    color: c.slate[700],
  },
  subtaskTextDone: {
    textDecorationLine: "line-through",
    color: c.slate[400],
  },

  /* activity */
  activityRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    paddingTop: spacing.lg,
  },
  activityRail: {
    width: 10,
    alignItems: "center",
    paddingTop: 10,
  },
  activityDot: {
    width: 8,
    height: 8,
    borderRadius: radii.pill,
    backgroundColor: c.blue[400],
  },
  activityLine: {
    flex: 1,
    width: 1.5,
    marginTop: 4,
    backgroundColor: c.border,
  },
  activityIcon: {
    width: 30,
    height: 30,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.surfaceMuted,
  },
  activityBody: {
    flex: 1,
    minWidth: 0,
  },
  activityText: {
    fontSize: typography.label,
    color: c.slate[700],
  },
  activityActor: {
    fontWeight: "700",
    color: c.slate[900],
  },
  activityStamp: {
    marginTop: 2,
    fontSize: typography.caption,
    color: c.slate[500],
  },

  /* footer */
  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: c.border,
    backgroundColor: c.bg,
  },
  complete: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    height: 54,
    borderRadius: radii.md,
    backgroundColor: c.blue[600],
  },
  reopen: {
    backgroundColor: c.slate[700],
  },
  completeText: {
    fontSize: typography.title,
    fontWeight: "700",
    color: "#ffffff",
  },

  /* menu sheet */
  menuRow: {
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  menuText: {
    fontSize: typography.body,
    color: c.slate[700],
  },
  menuDanger: {
    color: c.rose[600],
  },
}));

export default TaskDetailsScreen;
