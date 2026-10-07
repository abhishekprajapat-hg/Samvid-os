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
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import { Glyph } from "../../components/ui/Glyph";
import { AppSheet } from "../../components/ui/Overlay";
import { brand, brandStyles, layout, round, type as t } from "../../theme/brand";
import { toErrorMessage } from "../../utils/errorMessage";
import { deleteTask, getTaskById, updateTask, type Task } from "../../services/taskService";
import { assigneeName, initialsOf, subtaskProgress, toDate } from "./taskConstants";
import { dueLabel, priorityPill, statePill } from "./taskTones";

/*
 * Task Details, drawn to the comp.
 *
 * Two of the comp's cards are not drawn: Attachments and Comments. The task
 * model carries neither - no file list, no thread - so the choice was between
 * a picker that drops what it is given and leaving them out until the model
 * has somewhere to put them. Activity is drawn, from the assignment history
 * the model does keep plus the task's own creation.
 */

const stamp = (value?: string | null) => {
  const date = toDate(value || null);
  if (!date) return "";
  return `${date.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}, ${date
    .toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true })
    .toUpperCase()}`;
};

const personName = (value: unknown): string => {
  if (value && typeof value === "object" && "name" in (value as Record<string, unknown>)) {
    return String((value as { name?: string }).name || "");
  }
  return "";
};

export const TaskDetailsScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const taskId = String(route.params?.taskId || "");

  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [itemInput, setItemInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [menu, setMenu] = useState(false);

  const load = useCallback(
    async (quiet = false) => {
      try {
        if (quiet) setRefreshing(true);
        else setLoading(true);
        const row = await getTaskById(taskId);
        setTask(row);
        if (!row) setError("This task could not be found");
      } catch (err) {
        setError(toErrorMessage(err, "Failed to load the task"));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [taskId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      void load(true);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [taskId]),
  );

  const save = async (patch: Partial<Task>) => {
    if (!task) return;
    setSaving(true);
    try {
      const updated = await updateTask(task._id, patch);
      if (updated) setTask(updated);
      else void load(true);
    } catch (err) {
      setError(toErrorMessage(err, "Could not save the change"));
    } finally {
      setSaving(false);
    }
  };

  const subtasks = useMemo(() => (Array.isArray(task?.subtasks) ? task!.subtasks : []), [task]);
  const progress = task ? subtaskProgress(task) : { done: 0, total: 0 };
  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  const toggleItem = (index: number) => {
    const next = subtasks.map((row, i) => (i === index ? { ...row, isCompleted: !row.isCompleted } : row));
    setTask((prev) => (prev ? { ...prev, subtasks: next } : prev));
    void save({ subtasks: next });
  };

  /*
   * Web's subtask edit, delete and detail panel. A long press opens the item:
   * rename it, give it the note and due date web's SubtaskDetailPanel holds,
   * or delete it.
   */
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState({ title: "", description: "", dueDate: "" });
  const openItem = (index: number) => {
    const row = subtasks[index];
    if (!row) return;
    setEditDraft({
      title: row.title || "",
      description: row.description || "",
      dueDate: String(row.dueDate || "").slice(0, 10),
    });
    setEditIndex(index);
  };
  const saveItem = () => {
    if (editIndex === null) return;
    const title = editDraft.title.trim();
    if (!title) return;
    const dueDate = /^\d{4}-\d{2}-\d{2}$/.test(editDraft.dueDate) ? editDraft.dueDate : null;
    const next = subtasks.map((row, i) =>
      i === editIndex ? { ...row, title, description: editDraft.description, dueDate } : row);
    setTask((prev) => (prev ? { ...prev, subtasks: next } : prev));
    setEditIndex(null);
    void save({ subtasks: next });
  };
  const deleteItem = () => {
    if (editIndex === null) return;
    const next = subtasks.filter((_, i) => i !== editIndex);
    setTask((prev) => (prev ? { ...prev, subtasks: next } : prev));
    setEditIndex(null);
    void save({ subtasks: next });
  };

  const addItem = () => {
    const trimmed = itemInput.trim();
    if (!trimmed) return;
    const next = [...subtasks, { title: trimmed, isCompleted: false }];
    setItemInput("");
    setAdding(false);
    void save({ subtasks: next });
  };

  const activity = useMemo(() => {
    if (!task) return [] as Array<{ label: string; who: string; at?: string }>;
    const rows: Array<{ label: string; who: string; at?: string }> = [];
    rows.push({
      label: "Task created",
      who: personName(task.createdBy) || "-",
      at: task.createdAt,
    });
    (task.assignmentHistory || []).forEach((row) => {
      const to = personName(row?.toUser);
      rows.push({
        label: to ? `Assigned to ${to}` : "Assignment changed",
        who: personName(row?.actor) || "-",
        at: row?.at,
      });
    });
    return rows;
  }, [task]);

  const bottomPad = 24 + Math.max(insets.bottom, Platform.OS === "android" ? 16 : 0);

  if (loading) {
    return (
      <SafeAreaView style={styles.root} edges={["top", "left", "right"]}>
        <View style={styles.centred}>
          <ActivityIndicator size="large" color={brand.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!task) {
    return (
      <SafeAreaView style={styles.root} edges={["top", "left", "right"]}>
        <View style={styles.bar}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back">
            <Glyph name="chevron-back" size={26} color={brand.text} />
          </Pressable>
          <Text style={styles.barTitle}>Task Details</Text>
          <View style={styles.barSpacer} />
        </View>
        <View style={styles.centred}>
          <Text style={styles.emptyText}>{error || "This task could not be found"}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const done = String(task.status || "").toUpperCase() === "COMPLETED";
  const state = statePill(task);
  const prio = priorityPill(task.priority);
  const lead = task.leadId && typeof task.leadId === "object" ? task.leadId : null;
  const who = assigneeName(task);

  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right"]}>
      <View style={styles.bar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back">
          <Glyph name="chevron-back" size={26} color={brand.text} />
        </Pressable>
        <Text style={styles.barTitle}>Task Details</Text>
        <Pressable onPress={() => setMenu(true)} hitSlop={12} accessibilityRole="button" accessibilityLabel="Task actions">
          <Glyph name="ellipsis-horizontal" size={22} color={brand.text} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={brand.primary} />
        }
      >
        {error ? (
          <Pressable style={styles.banner} onPress={() => setError("")} accessibilityRole="button">
            <Text style={styles.bannerText}>{error}</Text>
          </Pressable>
        ) : null}

        {/* ---- summary ---- */}
        <View style={styles.card}>
          <View style={styles.summaryTop}>
            <View style={[styles.pill, { backgroundColor: state.bg }]}>
              <Text style={[styles.pillText, { color: state.fg }]}>{state.label}</Text>
            </View>
            <View style={[styles.pill, styles.pushRight, { backgroundColor: prio.bg }]}>
              <View style={styles.pillRow}>
                <Glyph name="flag" size={13} color={prio.fg} />
                <Text style={[styles.pillText, { color: prio.fg }]}>{prio.label} Priority</Text>
              </View>
            </View>
          </View>

          <Text style={styles.title}>{task.title}</Text>

          {lead ? (
            <View style={styles.metaRow}>
              <Glyph name="business-outline" size={16} color={brand.textMuted} />
              <Text style={styles.metaText} numberOfLines={1}>
                {String(lead.name || "Lead")}
              </Text>
            </View>
          ) : null}

          <View style={styles.metaRow}>
            <Glyph name="briefcase-outline" size={16} color={brand.textMuted} />
            <Text style={styles.metaText}>{dueLabel(task)}</Text>
          </View>

          <View style={styles.metaRow}>
            <Glyph name="person-outline" size={16} color={brand.textMuted} />
            <View style={styles.assignee}>
              <Text style={styles.assigneeText}>{initialsOf(who)}</Text>
            </View>
            <View style={styles.grow}>
              <Text style={styles.assigneeName} numberOfLines={1}>
                {who || "Unassigned"}
              </Text>
              <Text style={styles.assigneeCaption}>Assignee</Text>
            </View>
          </View>

          <View style={styles.actionRow}>
            <Pressable
              style={styles.outlineBtn}
              onPress={() => navigation.navigate("NewTask", { taskId: task._id })}
              accessibilityRole="button"
            >
              <Text style={styles.outlineBtnText}>Edit task</Text>
            </Pressable>
            <Pressable
              style={[styles.solidBtn, saving && styles.solidBtnOff]}
              onPress={() => void save({ status: done ? "TODO" : "COMPLETED" })}
              disabled={saving}
              accessibilityRole="button"
            >
              <Text style={styles.solidBtnText}>{done ? "Reopen task" : "Mark complete"}</Text>
            </Pressable>
          </View>
        </View>

        {/* ---- description ---- */}
        {task.description ? (
          <View style={[styles.card, styles.cardGap]}>
            <Text style={styles.cardTitle}>Description</Text>
            <Text style={styles.paragraph}>{task.description}</Text>
          </View>
        ) : null}

        {/* ---- checklist ---- */}
        <View style={[styles.card, styles.cardGap]}>
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>Checklist</Text>
            <Text style={styles.cardCount}>
              {progress.done} of {progress.total}
            </Text>
          </View>
          <View style={styles.track}>
            <View style={[styles.trackFill, { width: `${pct}%` }]} />
          </View>

          {subtasks.map((row, index) => (
            <Pressable
              key={`${row.title}-${index}`}
              style={styles.checkRow}
              onPress={() => toggleItem(index)}
              onLongPress={() => openItem(index)}
              delayLongPress={280}
              accessibilityRole="checkbox"
              accessibilityHint="Long press to edit or delete"
              accessibilityState={{ checked: !!row.isCompleted }}
            >
              <View style={[styles.check, row.isCompleted && styles.checkOn]}>
                {row.isCompleted ? <Glyph name="checkmark" size={15} color={brand.onPrimary} /> : null}
              </View>
              <View style={styles.checkText}>
                <Text style={[styles.checkLabel, row.isCompleted && styles.checkLabelDone]} numberOfLines={2}>
                  {row.title}
                </Text>
                {row.description || row.dueDate ? (
                  <Text style={styles.checkMeta} numberOfLines={1}>
                    {[row.dueDate ? `Due ${String(row.dueDate).slice(0, 10)}` : "", row.description || ""].filter(Boolean).join(" · ")}
                  </Text>
                ) : null}
              </View>
              <Pressable onPress={() => openItem(index)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Edit ${row.title}`}>
                <Glyph name="ellipsis-horizontal" size={17} color={brand.textMuted} />
              </Pressable>
            </Pressable>
          ))}

          {adding ? (
            <View style={styles.addRow}>
              <TextInput
                style={styles.addInput}
                value={itemInput}
                onChangeText={setItemInput}
                placeholder="Checklist item"
                placeholderTextColor={brand.placeholder}
                autoFocus
                onSubmitEditing={addItem}
                returnKeyType="done"
              />
              <Pressable onPress={addItem} hitSlop={8} accessibilityRole="button">
                <Glyph name="checkmark" size={20} color={brand.primary} />
              </Pressable>
            </View>
          ) : (
            <Pressable style={styles.addLink} onPress={() => setAdding(true)} accessibilityRole="button">
              <Glyph name="add" size={18} color={brand.primary} />
              <Text style={styles.addLinkText}>Add checklist item</Text>
            </Pressable>
          )}
        </View>

        {/* ---- activity ---- */}
        <View style={[styles.card, styles.cardGap]}>
          <Text style={styles.cardTitle}>Activity</Text>
          {activity.map((row, index) => (
            <View key={`${row.label}-${index}`} style={styles.activityRow}>
              <View style={styles.activityRail}>
                <View style={styles.activityDot} />
                {index < activity.length - 1 ? <View style={styles.activityLine} /> : null}
              </View>
              <View style={styles.grow}>
                <Text style={styles.activityLabel}>
                  {row.label}
                  {row.at ? <Text style={styles.activityStamp}>{`  ·  ${stamp(row.at)}`}</Text> : null}
                </Text>
                <Text style={styles.activityWho}>By {row.who}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <AppSheet
        visible={editIndex !== null}
        onClose={() => setEditIndex(null)}
        title="Checklist item"
        footer={
          <View style={styles.sheetActions}>
            <Pressable style={[styles.sheetBtn, styles.sheetBtnDanger]} onPress={deleteItem} accessibilityRole="button">
              <Text style={styles.sheetBtnDangerText}>Delete</Text>
            </Pressable>
            <Pressable style={[styles.sheetBtn, styles.sheetBtnPrimary]} onPress={saveItem} accessibilityRole="button">
              <Text style={styles.sheetBtnPrimaryText}>Save</Text>
            </Pressable>
          </View>
        }
      >
        <Text style={styles.fieldLabel}>Title</Text>
        <TextInput
          style={styles.fieldInput}
          value={editDraft.title}
          onChangeText={(value) => setEditDraft((prev) => ({ ...prev, title: value }))}
          placeholder="Checklist item"
          placeholderTextColor={brand.placeholder}
        />
        <Text style={styles.fieldLabel}>Details</Text>
        <TextInput
          style={[styles.fieldInput, styles.fieldArea]}
          value={editDraft.description}
          onChangeText={(value) => setEditDraft((prev) => ({ ...prev, description: value }))}
          placeholder="What this subtask involves"
          placeholderTextColor={brand.placeholder}
          multiline
          maxLength={5000}
        />
        <Text style={styles.fieldLabel}>Due date</Text>
        <TextInput
          style={styles.fieldInput}
          value={editDraft.dueDate}
          onChangeText={(value) => setEditDraft((prev) => ({ ...prev, dueDate: value }))}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={brand.placeholder}
          keyboardType="numbers-and-punctuation"
        />
      </AppSheet>

      <AppSheet visible={menu} onClose={() => setMenu(false)} title={task.title}>
        <Pressable
          style={styles.sheetRow}
          onPress={() => {
            setMenu(false);
            navigation.navigate("NewTask", { taskId: task._id });
          }}
          accessibilityRole="button"
        >
          <Text style={styles.sheetLabel}>Edit task</Text>
        </Pressable>
        <Pressable
          style={styles.sheetRow}
          onPress={() => {
            setMenu(false);
            void save({ status: done ? "TODO" : "COMPLETED" });
          }}
          accessibilityRole="button"
        >
          <Text style={styles.sheetLabel}>{done ? "Reopen task" : "Mark complete"}</Text>
        </Pressable>
        <Pressable
          style={styles.sheetRow}
          onPress={async () => {
            setMenu(false);
            try {
              await deleteTask(task._id);
              navigation.goBack();
            } catch (err) {
              setError(toErrorMessage(err, "Could not delete the task"));
            }
          }}
          accessibilityRole="button"
        >
          <Text style={[styles.sheetLabel, styles.sheetDanger]}>Delete task</Text>
        </Pressable>
      </AppSheet>
    </SafeAreaView>
  );
};

const styles = brandStyles((b) =>
  StyleSheet.create({
    checkText: { flex: 1, minWidth: 0 },
    checkMeta: { marginTop: 2, fontSize: t.label, color: b.textMuted },
    fieldLabel: { marginTop: 10, marginBottom: 6, fontSize: t.fieldLabel, fontWeight: "600", color: b.text },
    fieldInput: {
      height: 44,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: b.fieldBorder,
      borderRadius: round.field,
      fontSize: t.field,
      color: b.text,
      backgroundColor: b.surface,
    },
    fieldArea: { height: 96, paddingTop: 10, textAlignVertical: "top" },
    sheetActions: { flexDirection: "row", gap: 8 },
    sheetBtn: { flex: 1, height: 44, borderRadius: round.button, alignItems: "center", justifyContent: "center" },
    sheetBtnDanger: { backgroundColor: b.alertTint },
    sheetBtnDangerText: { fontSize: t.field, fontWeight: "700", color: b.alertInk },
    sheetBtnPrimary: { backgroundColor: b.primary },
    sheetBtnPrimaryText: { fontSize: t.field, fontWeight: "700", color: b.onPrimary },
    root: {
      flex: 1,
      backgroundColor: b.bg,
    },
    centred: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
    },
    grow: {
      flex: 1,
      minWidth: 0,
    },
    emptyText: {
      fontSize: t.field,
      textAlign: "center",
      color: b.textMuted,
    },

    bar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      paddingHorizontal: layout.pageGutter,
      paddingTop: 6,
      paddingBottom: 12,
    },
    barTitle: {
      flex: 1,
      minWidth: 0,
      fontSize: t.barTitle,
      lineHeight: 23,
      fontWeight: "700",
      letterSpacing: -0.3,
      color: b.text,
    },
    barSpacer: {
      width: 22,
    },

    body: {
      paddingHorizontal: layout.pageGutter,
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

    card: {
      padding: layout.cardPadding,
      borderWidth: 1,
      borderColor: b.border,
      borderRadius: round.panel,
      backgroundColor: b.surface,
    },
    cardGap: {
      marginTop: 12,
    },
    cardHead: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    cardTitle: {
      fontSize: t.barTitle,
      lineHeight: 22,
      fontWeight: "700",
      letterSpacing: -0.3,
      color: b.text,
    },
    cardCount: {
      fontSize: t.body,
      color: b.textMuted,
    },
    paragraph: {
      marginTop: 8,
      fontSize: t.field,
      lineHeight: 20,
      color: b.textSecondary,
    },

    summaryTop: {
      flexDirection: "row",
      alignItems: "center",
    },
    pushRight: {
      marginLeft: "auto",
    },
    pill: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: round.button,
    },
    pillRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    pillText: {
      fontSize: t.body,
      fontWeight: "600",
    },
    title: {
      marginTop: 14,
      fontSize: t.hero,
      lineHeight: 26,
      fontWeight: "700",
      letterSpacing: -0.4,
      color: b.text,
    },
    metaRow: {
      marginTop: 10,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    metaText: {
      flexShrink: 1,
      minWidth: 0,
      fontSize: t.field,
      color: b.textSecondary,
    },
    assignee: {
      width: 34,
      height: 34,
      borderRadius: round.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: b.tint,
    },
    assigneeText: {
      fontSize: t.body,
      fontWeight: "700",
      color: b.deep,
    },
    assigneeName: {
      fontSize: t.field,
      fontWeight: "600",
      color: b.text,
    },
    assigneeCaption: {
      fontSize: t.body,
      color: b.textMuted,
    },

    actionRow: {
      marginTop: 16,
      flexDirection: "row",
      gap: 12,
    },
    outlineBtn: {
      flex: 1,
      minWidth: 0,
      height: 46,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: b.primary,
      borderRadius: round.field,
      backgroundColor: b.surface,
    },
    outlineBtnText: {
      fontSize: t.field,
      fontWeight: "700",
      color: b.deep,
    },
    solidBtn: {
      flex: 1,
      minWidth: 0,
      height: 46,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: round.field,
      backgroundColor: b.primary,
    },
    solidBtnOff: {
      opacity: 0.7,
    },
    solidBtnText: {
      fontSize: t.field,
      fontWeight: "700",
      color: b.onPrimary,
    },

    track: {
      marginTop: 12,
      height: 8,
      borderRadius: round.pill,
      overflow: "hidden",
      backgroundColor: b.hairline,
    },
    trackFill: {
      height: "100%",
      borderRadius: round.pill,
      backgroundColor: b.greenBright,
    },
    checkRow: {
      marginTop: 14,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    check: {
      width: 22,
      height: 22,
      borderRadius: 5,
      borderWidth: 1.5,
      borderColor: b.fieldBorder,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: b.surface,
    },
    checkOn: {
      borderColor: b.primary,
      backgroundColor: b.primary,
    },
    checkLabel: {
      flexShrink: 1,
      minWidth: 0,
      fontSize: t.field,
      color: b.text,
    },
    checkLabelDone: {
      color: b.textMuted,
    },
    addRow: {
      marginTop: 14,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      height: 40,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: b.fieldBorder,
      borderRadius: round.field,
    },
    addInput: {
      flex: 1,
      minWidth: 0,
      paddingVertical: 0,
      fontSize: t.field,
      color: b.text,
    },
    addLink: {
      marginTop: 14,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    addLinkText: {
      fontSize: t.field,
      fontWeight: "600",
      color: b.deep,
    },

    activityRow: {
      marginTop: 12,
      flexDirection: "row",
      gap: 12,
    },
    activityRail: {
      width: 12,
      alignItems: "center",
    },
    activityDot: {
      width: 10,
      height: 10,
      marginTop: 4,
      borderRadius: round.pill,
      backgroundColor: b.greenBright,
    },
    activityLine: {
      flex: 1,
      width: 2,
      marginTop: 2,
      backgroundColor: b.hairline,
    },
    activityLabel: {
      fontSize: t.body,
      fontWeight: "600",
      color: b.text,
    },
    activityStamp: {
      fontWeight: "400",
      color: b.textMuted,
    },
    activityWho: {
      marginTop: 1,
      fontSize: t.label,
      color: b.textMuted,
    },

    sheetRow: {
      flexDirection: "row",
      alignItems: "center",
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
  }),
);

export default TaskDetailsScreen;
