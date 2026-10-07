import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  TextInput,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { Glyph } from "../../components/ui/Glyph";
import {
  FieldCol,
  FieldLabel,
  FieldRow,
  FieldShell,
  SectionCard,
  SelectField,
  TextField,
  Toggle,
} from "../../components/ui/form";
import { brand, brandStyles, layout, round, type as t } from "../../theme/brand";
import { toErrorMessage } from "../../utils/errorMessage";
import { createTask, getTaskAssignees, getTaskById, updateTask } from "../../services/taskService";
import { useAuth } from "../../context/AuthContext";
import { getAllLeads } from "../../services/leadService";
import { scheduleLocalReminder } from "../../services/pushNotifications";
import { PREDEFINED_TAGS, initialsOf, type PriorityId } from "./taskConstants";

/*
 * Create Task, drawn to the comp.
 *
 * Three of the controls the comp draws have nowhere to go: the task model
 * carries no attachments, no repeat rule and no reminder column. Attachments
 * and Repeat are therefore not drawn - a file picker that drops the file, or a
 * repeat that never repeats, is worse than not offering it. The reminder is
 * drawn, because a reminder can be kept honestly without the server: it
 * schedules a local notification on this device. That limit is stated on the
 * control and in docs/mobile/00_MOBILE_PARITY_SPEC.md.
 *
 * "Task type" is the task's first tag, which is the vocabulary the rest of the
 * module already filters on, and "Related to" is the lead link - the only
 * relation the model has.
 */

const REMINDERS = [
  { label: "10 minutes before", value: "10" },
  { label: "30 minutes before", value: "30" },
  { label: "1 hour before", value: "60" },
  { label: "1 day before", value: "1440" },
];

const PRIORITIES: PriorityId[] = ["LOW", "MEDIUM", "HIGH"];

const PRIORITY_TONE: Record<PriorityId, { bg: string; fg: string }> = {
  LOW: { bg: "#e6f4f0", fg: "#0a6b4a" },
  MEDIUM: { bg: "#feebc9", fg: "#a06a10" },
  HIGH: { bg: "#fdedee", fg: "#d64545" },
};

const dateLabel = (value: Date | null) =>
  value ? value.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "";

const timeLabel = (value: Date | null) =>
  value
    ? value.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true }).toUpperCase()
    : "";

export const NewTaskScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const taskId = String(route.params?.taskId || "");
  const isEdit = !!taskId;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  /*
   * Web's form takes any number of tags - the predefined six plus custom ones.
   * The comp drew one "Task type" select, which can hold one; saving through it
   * dropped every other tag on the task. The chips hold them all.
   */
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [leadId, setLeadId] = useState("");
  const [due, setDue] = useState<Date | null>(null);
  const [reminderOn, setReminderOn] = useState(false);
  const [reminder, setReminder] = useState("30");
  const [assignee, setAssignee] = useState("");
  const { user } = useAuth();
  const myId = String((user as any)?._id || (user as any)?.id || "");
  const myName = String(user?.name || "");
  const [editingAssignee, setEditingAssignee] = useState<{ _id: string; name: string } | null>(null);
  /* Web's form builds the checklist before the task exists. */
  const [checklist, setChecklist] = useState<Array<{ title: string; isCompleted?: boolean; description?: string; dueDate?: string | null }>>([]);
  const [checklistInput, setChecklistInput] = useState("");
  const [priority, setPriority] = useState<PriorityId>("MEDIUM");

  const [people, setPeople] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [picker, setPicker] = useState<"date" | "time" | null>(null);

  const load = useCallback(async () => {
    try {
      const [userRows, leadRows, existing] = await Promise.allSettled([
        getTaskAssignees(),
        getAllLeads(),
        isEdit ? getTaskById(taskId) : Promise.resolve(null),
      ]);

      if (userRows.status === "fulfilled") {
        const rows = (userRows.value?.users || []).filter((row: any) => row?.isActive !== false);
        setPeople(rows);
      }
      if (leadRows.status === "fulfilled") setLeads(Array.isArray(leadRows.value) ? leadRows.value : []);

      if (existing.status === "fulfilled" && existing.value) {
        const task = existing.value;
        setTitle(task.title || "");
        setDescription(task.description || "");
        setTags(Array.isArray(task.tags) ? task.tags.map(String) : []);
        setPriority((String(task.priority || "MEDIUM").toUpperCase() as PriorityId) || "MEDIUM");
        setDue(task.dueDate ? new Date(task.dueDate) : null);
        setAssignee(
          typeof task.assignedTo === "object" && task.assignedTo ? String(task.assignedTo._id) : "",
        );
        if (typeof task.assignedTo === "object" && task.assignedTo?._id) {
          setEditingAssignee({ _id: String(task.assignedTo._id), name: String((task.assignedTo as any).name || "Unknown user") });
        }
        setChecklist(Array.isArray(task.subtasks) ? task.subtasks.map((row: any) => ({ ...row })) : []);
        setLeadId(typeof task.leadId === "object" && task.leadId ? String(task.leadId._id) : "");
      } else {
        /* "Assign task" on a member's page opens this form already pointed at
           them, so the one thing that brought you here is not retyped. */
        const preset = String(route.params?.assigneeId || "");
        if (preset) setAssignee(preset);
      }
    } catch (err) {
      setError(toErrorMessage(err, "Could not load the form"));
    } finally {
      setLoading(false);
    }
  }, [isEdit, taskId, route.params]);

  useEffect(() => {
    void load();
  }, [load]);

  /*
   * Web's assignableUsers: the assignees route, plus me if it left me out, plus
   * whoever the task being edited is already with - then me first, the rest by
   * name - so an edit never silently reassigns a task to "nobody".
   */
  const peopleOptions = useMemo(() => {
    const list: Array<{ _id?: string; name?: string }> = [...people];
    const has = (id: string) => list.some((row) => String(row?._id) === String(id));
    if (myId && !has(myId)) list.push({ _id: myId, name: myName || "Me" });
    if (editingAssignee?._id && !has(editingAssignee._id)) list.push(editingAssignee);
    return list
      .sort((a, b) => {
        const aSelf = String(a._id) === myId ? 0 : 1;
        const bSelf = String(b._id) === myId ? 0 : 1;
        if (aSelf !== bSelf) return aSelf - bSelf;
        return String(a.name || "").localeCompare(String(b.name || ""));
      })
      .map((row) => ({ label: String(row?.name || "User"), value: String(row?._id || "") }));
  }, [people, myId, myName, editingAssignee]);

  const leadOptions = useMemo(
    () => [
      { label: "Not linked", value: "" },
      ...leads.map((row) => ({
        label: `${String(row?.name || "Lead")}${row?.projectInterested ? ` · ${row.projectInterested}` : ""}`,
        value: String(row?._id || ""),
      })),
    ],
    [leads],
  );

  const assigneeName = peopleOptions.find((row) => row.value === assignee)?.label || "";

  const onPicked = (event: DateTimePickerEvent, picked?: Date) => {
    const mode = picker;
    setPicker(null);
    if (event.type === "dismissed" || !picked) return;

    setDue((prev) => {
      const base = prev ? new Date(prev) : new Date();
      if (mode === "time") {
        base.setHours(picked.getHours(), picked.getMinutes(), 0, 0);
      } else {
        base.setFullYear(picked.getFullYear(), picked.getMonth(), picked.getDate());
        if (!prev) base.setHours(9, 0, 0, 0);
      }
      return base;
    });
  };

  const save = async () => {
    const trimmed = title.trim();
    if (!trimmed) {
      setError("A task title is required");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const payload: Record<string, any> = {
        title: trimmed,
        description: description.trim(),
        priority,
        dueDate: due ? due.toISOString() : null,
        assignedTo: assignee || null,
        leadId: leadId || null,
        tags,
        subtasks: checklist
          .filter((row) => String(row.title || "").trim())
          .map((row) => ({ ...row, title: String(row.title).trim(), isCompleted: Boolean(row.isCompleted) })),
      };

      if (isEdit) await updateTask(taskId, payload);
      else await createTask(payload);

      if (reminderOn && due) {
        const at = new Date(due.getTime() - Number(reminder) * 60000);
        if (at.getTime() > Date.now()) {
          await scheduleLocalReminder(at, { title: "Task reminder", body: trimmed });
        }
      }

      navigation.goBack();
    } catch (err) {
      setError(toErrorMessage(err, isEdit ? "Could not save the task" : "Could not create the task"));
    } finally {
      setSaving(false);
    }
  };

  const bottomPad = 16 + Math.max(insets.bottom, Platform.OS === "android" ? 16 : 0);

  if (loading) {
    return (
      <SafeAreaView style={styles.root} edges={["top", "left", "right"]}>
        <View style={styles.centred}>
          <ActivityIndicator size="large" color={brand.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right"]}>
      <View style={styles.bar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back">
          <Glyph name="arrow-back" size={24} color={brand.text} />
        </Pressable>
        <Text style={styles.barTitle}>{isEdit ? "Edit Task" : "Create Task"}</Text>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10} accessibilityRole="button">
          <Text style={styles.barAction}>Save draft</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={styles.grow}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {error ? (
            <Pressable style={styles.banner} onPress={() => setError("")} accessibilityRole="button">
              <Text style={styles.bannerText}>{error}</Text>
            </Pressable>
          ) : null}

          <SectionCard title="Task Details">
            <TextField
              label="Task title"
              required
              value={title}
              onChangeText={setTitle}
              placeholder="What needs doing?"
            />
            <TextField
              label="Description"
              value={description}
              onChangeText={setDescription}
              placeholder="Add task details or instructions"
              multiline
            />
            <Text style={styles.tagLabel}>Tags</Text>
            <View style={styles.tagWrap}>
              {[...PREDEFINED_TAGS, ...tags.filter((tag) => !PREDEFINED_TAGS.includes(tag))].map((tag) => {
                const on = tags.includes(tag);
                return (
                  <Pressable
                    key={tag}
                    style={[styles.tagChip, on && styles.tagChipOn]}
                    onPress={() => setTags((prev) => (prev.includes(tag) ? prev.filter((row) => row !== tag) : [...prev, tag]))}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                  >
                    {on ? <Glyph name="checkmark" size={13} color={brand.ink} /> : null}
                    <Text style={[styles.tagChipText, on && styles.tagChipTextOn]}>{tag}</Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.inlineAdd}>
              <TextInput
                style={styles.inlineInput}
                value={tagInput}
                onChangeText={setTagInput}
                placeholder="Add a custom tag"
                placeholderTextColor={brand.placeholder}
                onSubmitEditing={() => {
                  const clean = tagInput.trim();
                  if (clean && !tags.includes(clean)) setTags((prev) => [...prev, clean]);
                  setTagInput("");
                }}
                returnKeyType="done"
              />
              <Pressable
                onPress={() => {
                  const clean = tagInput.trim();
                  if (clean && !tags.includes(clean)) setTags((prev) => [...prev, clean]);
                  setTagInput("");
                }}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Add tag"
              >
                <Glyph name="add-circle" size={22} color={brand.primary} />
              </Pressable>
            </View>
            <SelectField
              label="Related to"
              icon="business-outline"
              value={leadId}
              options={leadOptions}
              onChange={setLeadId}
              placeholder="Not linked"
            />
          </SectionCard>

          <SectionCard title="Schedule" style={styles.cardGap}>
            <FieldRow>
              <FieldCol>
                <View style={styles.group}>
                  <FieldLabel label="Due date" />
                  <Pressable onPress={() => setPicker("date")} accessibilityRole="button">
                    <FieldShell>
                      <Glyph name="calendar-outline" size={18} color={brand.textSecondary} />
                      <Text style={[styles.value, !due && styles.valueMuted]}>
                        {dateLabel(due) || "Pick a date"}
                      </Text>
                    </FieldShell>
                  </Pressable>
                </View>
              </FieldCol>
              <FieldCol>
                <View style={styles.group}>
                  <FieldLabel label="Time" />
                  <Pressable onPress={() => setPicker("time")} accessibilityRole="button">
                    <FieldShell>
                      <Glyph name="time-outline" size={18} color={brand.textSecondary} />
                      <Text style={[styles.value, !due && styles.valueMuted]}>
                        {timeLabel(due) || "Pick a time"}
                      </Text>
                    </FieldShell>
                  </Pressable>
                </View>
              </FieldCol>
            </FieldRow>

            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Set reminder</Text>
              <Toggle value={reminderOn} onValueChange={setReminderOn} />
            </View>

            <SelectField
              icon="notifications-outline"
              value={reminder}
              options={REMINDERS}
              onChange={setReminder}
            />
            <Text style={styles.hint}>Reminders are scheduled on this device.</Text>
          </SectionCard>

          <SectionCard title="Assignment" style={styles.cardGap}>
            <SelectField
              label="Assign to"
              value={assignee}
              options={peopleOptions}
              onChange={setAssignee}
              placeholder="Choose a team member"
              leading={
                assigneeName ? (
                  <View style={styles.chipAvatar}>
                    <Text style={styles.chipAvatarText}>{initialsOf(assigneeName)}</Text>
                  </View>
                ) : (
                  <Glyph name="person-outline" size={18} color={brand.textSecondary} />
                )
              }
            />

            <View style={styles.priorityRow}>
              <Text style={styles.priorityLabel}>Priority</Text>
              <View style={styles.segment}>
                {PRIORITIES.map((id) => {
                  const active = priority === id;
                  const tone = PRIORITY_TONE[id];
                  return (
                    <Pressable
                      key={id}
                      style={[styles.segmentItem, active && { backgroundColor: tone.bg }]}
                      onPress={() => setPriority(id)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                    >
                      <Text style={[styles.segmentLabel, active && { color: tone.fg, fontWeight: "700" }]}>
                        {id === "LOW" ? "Low" : id === "HIGH" ? "High" : "Medium"}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </SectionCard>

          {/* Web's form checklist: built before the task exists, saved with it. */}
          <SectionCard title="Checklist" subtitle={checklist.length ? `${checklist.length} item${checklist.length === 1 ? "" : "s"}` : undefined} style={styles.cardGap}>
            {checklist.map((row, index) => (
              <View key={`${index}-${row.title}`} style={styles.checkItem}>
                <Pressable
                  onPress={() =>
                    setChecklist((prev) => prev.map((item, i) => (i === index ? { ...item, isCompleted: !item.isCompleted } : item)))}
                  hitSlop={6}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: Boolean(row.isCompleted) }}
                >
                  <Glyph name={row.isCompleted ? "checkbox" : "square-outline"} size={20} color={row.isCompleted ? brand.primary : brand.textMuted} />
                </Pressable>
                <TextInput
                  style={[styles.checkItemInput, row.isCompleted && styles.checkItemDone]}
                  value={row.title}
                  onChangeText={(value) => setChecklist((prev) => prev.map((item, i) => (i === index ? { ...item, title: value } : item)))}
                />
                <Pressable
                  onPress={() => setChecklist((prev) => prev.filter((_, i) => i !== index))}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel="Remove item"
                >
                  <Glyph name="close" size={18} color={brand.textMuted} />
                </Pressable>
              </View>
            ))}
            <View style={styles.inlineAdd}>
              <TextInput
                style={styles.inlineInput}
                value={checklistInput}
                onChangeText={setChecklistInput}
                placeholder="Add a checklist item"
                placeholderTextColor={brand.placeholder}
                onSubmitEditing={() => {
                  const clean = checklistInput.trim();
                  if (clean) setChecklist((prev) => [...prev, { title: clean, isCompleted: false }]);
                  setChecklistInput("");
                }}
                returnKeyType="done"
              />
              <Pressable
                onPress={() => {
                  const clean = checklistInput.trim();
                  if (clean) setChecklist((prev) => [...prev, { title: clean, isCompleted: false }]);
                  setChecklistInput("");
                }}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Add checklist item"
              >
                <Glyph name="add-circle" size={22} color={brand.primary} />
              </Pressable>
            </View>
          </SectionCard>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={[styles.footer, { paddingBottom: bottomPad }]}>
        <Pressable
          style={[styles.primaryBtn, saving && styles.primaryBtnOff]}
          onPress={save}
          disabled={saving}
          accessibilityRole="button"
        >
          {saving ? (
            <ActivityIndicator size="small" color={brand.onPrimary} />
          ) : (
            <>
              <Text style={styles.primaryBtnText}>{isEdit ? "Save task" : "Create task"}</Text>
              <Glyph name="arrow-forward" size={18} color={brand.onPrimary} />
            </>
          )}
        </Pressable>
      </View>

      {picker ? (
        <DateTimePicker
          value={due || new Date()}
          mode={picker}
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={onPicked}
        />
      ) : null}
    </SafeAreaView>
  );
};

const styles = brandStyles((b) =>
  StyleSheet.create({
    tagLabel: { marginBottom: 8, fontSize: t.fieldLabel, fontWeight: "500", color: b.text },
    tagWrap: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginBottom: 10 },
    tagChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      height: 32,
      paddingHorizontal: 11,
      borderRadius: round.chip,
      borderWidth: 1,
      borderColor: b.fieldBorder,
      backgroundColor: b.surface,
    },
    tagChipOn: { backgroundColor: b.chipActiveBg, borderColor: b.chipActiveBg },
    tagChipText: { fontSize: t.label, fontWeight: "500", color: b.textSecondary },
    tagChipTextOn: { color: b.ink, fontWeight: "600" },
    inlineAdd: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      height: 44,
      paddingHorizontal: 11,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: b.fieldBorder,
      borderRadius: round.field,
      backgroundColor: b.surface,
    },
    inlineInput: { flex: 1, fontSize: t.field, color: b.text, paddingVertical: 0 },
    checkItem: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
    checkItemInput: {
      flex: 1,
      height: 40,
      paddingHorizontal: 10,
      borderWidth: 1,
      borderColor: b.hairline,
      borderRadius: round.field,
      fontSize: t.field,
      color: b.text,
    },
    checkItemDone: { textDecorationLine: "line-through", color: b.textMuted },
    root: {
      flex: 1,
      backgroundColor: b.bg,
    },
    grow: {
      flex: 1,
    },
    centred: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },

    bar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 16,
      paddingHorizontal: layout.pageGutter,
      paddingTop: 6,
      paddingBottom: 14,
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
    barAction: {
      fontSize: t.field,
      fontWeight: "600",
      color: b.primary,
    },

    body: {
      paddingHorizontal: layout.pageGutter,
      paddingBottom: 24,
    },
    cardGap: {
      marginTop: 16,
    },
    group: {
      marginBottom: layout.fieldGap,
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

    value: {
      flex: 1,
      minWidth: 0,
      fontSize: t.field,
      color: b.text,
    },
    valueMuted: {
      color: b.placeholder,
    },

    toggleRow: {
      marginBottom: 12,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    toggleLabel: {
      fontSize: t.fieldLabel,
      fontWeight: "500",
      color: b.text,
    },
    hint: {
      marginTop: -8,
      fontSize: t.label,
      color: b.textMuted,
    },

    chipAvatar: {
      width: 26,
      height: 26,
      borderRadius: round.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: b.tint,
    },
    chipAvatarText: {
      fontSize: t.tagline,
      fontWeight: "700",
      color: b.deep,
    },

    priorityRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
    },
    priorityLabel: {
      fontSize: t.fieldLabel,
      fontWeight: "500",
      color: b.text,
    },
    segment: {
      flex: 1,
      minWidth: 0,
      flexDirection: "row",
      height: 40,
      borderWidth: 1,
      borderColor: b.border,
      borderRadius: round.field,
      overflow: "hidden",
      backgroundColor: b.surface,
    },
    segmentItem: {
      flex: 1,
      minWidth: 0,
      alignItems: "center",
      justifyContent: "center",
    },
    segmentLabel: {
      fontSize: t.cardTitle,
      fontWeight: "500",
      color: b.textSecondary,
    },

    footer: {
      paddingHorizontal: layout.pageGutter,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: b.hairline,
      backgroundColor: b.bg,
    },
    primaryBtn: {
      height: 52,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      borderRadius: round.field,
      backgroundColor: b.primary,
    },
    primaryBtnOff: {
      opacity: 0.7,
    },
    primaryBtnText: {
      fontSize: t.rowTitle,
      fontWeight: "700",
      color: b.onPrimary,
    },
  }),
);

export default NewTaskScreen;
