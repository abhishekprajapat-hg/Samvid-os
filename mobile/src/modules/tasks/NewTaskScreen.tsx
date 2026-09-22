import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
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
import DateTimePicker from "@react-native-community/datetimepicker";
import { Icon } from "../../components/ui/Icon";
import { AppSheet } from "../../components/ui";
import { radii, spacing, typography } from "../../theme/tokens";
import { themedStyles, themePalette } from "../../theme/themedStyles";
import { toErrorMessage } from "../../utils/errorMessage";
import {
  createTask,
  getTaskById,
  updateTask,
  type Task,
} from "../../services/taskService";
import { getUsers } from "../../services/userService";
import { getAllLeads } from "../../services/leadService";
import { useAuth } from "../../context/AuthContext";
import {
  PREDEFINED_TAGS,
  PRIORITY_IDS,
  STATUS_IDS,
  priorityTone,
  statusTone,
  toDate,
  type PriorityId,
  type StatusId,
} from "./taskConstants";

/*
 * The task form, used to raise one and to edit one.
 *
 * The comp is the create case; passing a taskId re-labels the page and
 * patches instead of posting. Keeping both in one screen is what stops the
 * edit path quietly losing a field the create path gained - there is only
 * one list of inputs.
 *
 * Description is capped at 500 to match the counter the comp draws. Nothing
 * on the server enforces that, so the cap is the input's own.
 */

const DESCRIPTION_LIMIT = 500;

const MAX_LABEL = "mm/dd/yyyy";

const asInputDate = (value: Date | null) =>
  value
    ? `${String(value.getMonth() + 1).padStart(2, "0")}/${String(value.getDate()).padStart(2, "0")}/${value.getFullYear()}`
    : "";

export const NewTaskScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const taskId = route.params?.taskId ? String(route.params.taskId) : "";
  const isEdit = !!taskId;
  const seedStatus = (route.params?.status as StatusId) || "TODO";

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<PriorityId>("MEDIUM");
  const [status, setStatus] = useState<StatusId>(seedStatus);
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [assignee, setAssignee] = useState("");
  const [leadId, setLeadId] = useState("");
  const [subtasks, setSubtasks] = useState<Array<{ title: string; isCompleted: boolean }>>([]);
  const [subtaskInput, setSubtaskInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");

  const [people, setPeople] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [sheet, setSheet] = useState<"assignee" | "lead" | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  const load = useCallback(async () => {
    try {
      const [userRows, leadRows, existing] = await Promise.allSettled([
        getUsers(),
        getAllLeads(),
        isEdit ? getTaskById(taskId) : Promise.resolve(null),
      ]);

      if (userRows.status === "fulfilled") setPeople(userRows.value?.users || []);
      if (leadRows.status === "fulfilled") setLeads(leadRows.value || []);

      if (existing.status === "fulfilled" && existing.value) {
        const row = existing.value as Task;
        setTitle(row.title || "");
        setDescription(row.description || "");
        setPriority((String(row.priority || "MEDIUM").toUpperCase() as PriorityId) || "MEDIUM");
        setStatus((String(row.status || "TODO").toUpperCase() as StatusId) || "TODO");
        setDueDate(toDate(row.dueDate));
        setAssignee(
          row.assignedTo && typeof row.assignedTo === "object" ? String(row.assignedTo._id) : "",
        );
        setLeadId(row.leadId && typeof row.leadId === "object" ? String(row.leadId._id) : "");
        setSubtasks(
          (row.subtasks || []).map((sub) => ({
            title: String(sub.title || ""),
            isCompleted: !!sub.isCompleted,
          })),
        );
        setTags(Array.isArray(row.tags) ? row.tags : []);
      } else if (existing.status === "rejected") {
        setError(toErrorMessage(existing.reason, "Could not load this task"));
      }
    } finally {
      setLoading(false);
    }
  }, [isEdit, taskId]);

  useEffect(() => {
    void load();
  }, [load]);

  const assigneeLabel = useMemo(() => {
    if (!assignee) return "Unassigned";
    const match = people.find((row) => String(row?._id || row?.id) === assignee);
    return match ? String(match.name || "User") : "Unassigned";
  }, [assignee, people]);

  const leadLabel = useMemo(() => {
    if (!leadId) return "No linked lead";
    const match = leads.find((row) => String(row?._id) === leadId);
    return match ? String(match.name || match.phone || "Lead") : "No linked lead";
  }, [leadId, leads]);

  const addSubtask = () => {
    const next = subtaskInput.trim();
    if (!next) return;
    setSubtasks((prev) => [...prev, { title: next, isCompleted: false }]);
    setSubtaskInput("");
  };

  const toggleTag = (tag: string) =>
    setTags((prev) => (prev.includes(tag) ? prev.filter((row) => row !== tag) : [...prev, tag]));

  const addCustomTag = () => {
    const next = tagInput.trim();
    if (!next || tags.includes(next)) {
      setTagInput("");
      return;
    }
    setTags((prev) => [...prev, next]);
    setTagInput("");
  };

  const submit = async () => {
    const trimmed = title.trim();
    if (!trimmed) {
      setError("A task needs a title.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const payload: Record<string, any> = {
        title: trimmed,
        description: description.trim(),
        priority,
        status,
        dueDate: dueDate ? dueDate.toISOString() : null,
        assignedTo: assignee || null,
        leadId: leadId || null,
        subtasks,
        tags,
      };

      if (isEdit) await updateTask(taskId, payload);
      else await createTask(payload);

      navigation.goBack();
    } catch (err) {
      setError(toErrorMessage(err, isEdit ? "Could not save the task" : "Could not create the task"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right"]}>
      <View style={styles.topRow}>
        <Pressable
          style={styles.back}
          onPress={() => navigation.goBack()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Icon name="chevron-back" size={20} color={themePalette.slate[900]} />
        </Pressable>
        <View style={styles.topText}>
          <Text style={styles.topTitle}>{isEdit ? "Edit Task" : "New Task"}</Text>
          <Text style={styles.topSub}>Fill in what matters — the rest can wait</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.centred}>
          <ActivityIndicator size="large" color={themePalette.blue[600]} />
        </View>
      ) : (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.page}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Field icon="list" label="Task title" required>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="What needs to be done?"
                placeholderTextColor={themePalette.slate[400]}
                style={styles.input}
              />
            </Field>

            <Field icon="list" label="Description">
              <View>
                <TextInput
                  value={description}
                  onChangeText={(next) => setDescription(next.slice(0, DESCRIPTION_LIMIT))}
                  placeholder="Add notes, instructions, or goals..."
                  placeholderTextColor={themePalette.slate[400]}
                  style={[styles.input, styles.textarea]}
                  multiline
                  textAlignVertical="top"
                />
                <Text style={styles.counter}>
                  {description.length}/{DESCRIPTION_LIMIT}
                </Text>
              </View>
            </Field>

            <Field icon="flag" label="Priority">
              <View style={styles.segmentRow}>
                {PRIORITY_IDS.map((id) => {
                  const active = priority === id;
                  const tone = priorityTone(id);
                  return (
                    <Pressable
                      key={id}
                      onPress={() => setPriority(id)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      style={[
                        styles.segment,
                        active && { borderColor: tone.border, backgroundColor: tone.bg },
                      ]}
                    >
                      <Text style={[styles.segmentText, active && { color: tone.color }]}>
                        {tone.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </Field>

            <Field icon="list" label="Status">
              <View style={styles.segmentRow}>
                {STATUS_IDS.map((id) => {
                  const active = status === id;
                  const tone = statusTone(id);
                  return (
                    <Pressable
                      key={id}
                      onPress={() => setStatus(id)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      style={[
                        styles.segment,
                        styles.segmentTight,
                        active && { borderColor: tone.border, backgroundColor: tone.bg },
                      ]}
                    >
                      <Text
                        numberOfLines={1}
                        style={[styles.segmentText, styles.segmentTextTight, active && { color: tone.color }]}
                      >
                        {tone.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </Field>

            <Field icon="calendarDays" label="Due date">
              <Pressable
                style={styles.select}
                onPress={() => setShowPicker(true)}
                accessibilityRole="button"
              >
                <Text style={dueDate ? styles.selectValue : styles.selectPlaceholder}>
                  {asInputDate(dueDate) || MAX_LABEL}
                </Text>
                <View style={styles.selectRight}>
                  {dueDate ? (
                    <Pressable onPress={() => setDueDate(null)} hitSlop={8}>
                      <Icon name="close" size={15} color={themePalette.slate[400]} />
                    </Pressable>
                  ) : null}
                  <Icon name="calendarDays" size={17} color={themePalette.slate[500]} />
                </View>
              </Pressable>
            </Field>

            <Field icon="person-outline" label="Assign to">
              <View style={styles.rowGap}>
                <Pressable
                  style={[styles.select, styles.flex]}
                  onPress={() => setSheet("assignee")}
                  accessibilityRole="button"
                >
                  <Text style={assignee ? styles.selectValue : styles.selectPlaceholder}>
                    {assigneeLabel}
                  </Text>
                  <Icon name="chevron-down" size={17} color={themePalette.slate[500]} />
                </Pressable>
                <Pressable
                  style={styles.meButton}
                  onPress={() => setAssignee(String(user?._id || user?.id || ""))}
                  accessibilityRole="button"
                >
                  <Text style={styles.meText}>Me</Text>
                </Pressable>
              </View>
            </Field>

            <Field icon="business" label="Linked lead">
              <Pressable
                style={styles.select}
                onPress={() => setSheet("lead")}
                accessibilityRole="button"
              >
                <Text style={leadId ? styles.selectValue : styles.selectPlaceholder}>
                  {leadLabel}
                </Text>
                <Icon name="chevron-down" size={17} color={themePalette.slate[500]} />
              </Pressable>
            </Field>

            <Field icon="subtasks" label="Subtasks / Checklist">
              <View style={styles.rowGap}>
                <TextInput
                  value={subtaskInput}
                  onChangeText={setSubtaskInput}
                  placeholder="Add a subtask..."
                  placeholderTextColor={themePalette.slate[400]}
                  style={[styles.input, styles.flex]}
                  onSubmitEditing={addSubtask}
                  returnKeyType="done"
                />
                <Pressable style={styles.addButton} onPress={addSubtask} accessibilityRole="button">
                  <Text style={styles.addText}>Add</Text>
                </Pressable>
              </View>

              {subtasks.map((row, index) => (
                <View key={`${row.title}-${index}`} style={styles.subtaskRow}>
                  <Icon name="checkbox" size={15} color={themePalette.slate[400]} />
                  <Text style={styles.subtaskText} numberOfLines={1}>
                    {row.title}
                  </Text>
                  <Pressable
                    onPress={() => setSubtasks((prev) => prev.filter((_, i) => i !== index))}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${row.title}`}
                  >
                    <Icon name="close" size={15} color={themePalette.slate[400]} />
                  </Pressable>
                </View>
              ))}
            </Field>

            <Field icon="tag" label="Category Tags">
              <View style={styles.tagWrap}>
                {PREDEFINED_TAGS.map((tag) => {
                  const active = tags.includes(tag);
                  return (
                    <Pressable
                      key={tag}
                      onPress={() => toggleTag(tag)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      style={[styles.tag, active && styles.tagActive]}
                    >
                      <Text style={[styles.tagText, active && styles.tagTextActive]}>{tag}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {tags.filter((tag) => !PREDEFINED_TAGS.includes(tag)).length ? (
                <View style={styles.tagWrap}>
                  {tags
                    .filter((tag) => !PREDEFINED_TAGS.includes(tag))
                    .map((tag) => (
                      <Pressable
                        key={tag}
                        onPress={() => toggleTag(tag)}
                        accessibilityRole="button"
                        style={[styles.tag, styles.tagActive]}
                      >
                        <Text style={[styles.tagText, styles.tagTextActive]}>{tag}</Text>
                        <Icon name="close" size={12} color={themePalette.blue[600]} />
                      </Pressable>
                    ))}
                </View>
              ) : null}

              <View style={styles.rowGap}>
                <TextInput
                  value={tagInput}
                  onChangeText={setTagInput}
                  placeholder="Or type custom tag..."
                  placeholderTextColor={themePalette.slate[400]}
                  style={[styles.input, styles.flex]}
                  onSubmitEditing={addCustomTag}
                  returnKeyType="done"
                />
                <Pressable
                  style={styles.addButton}
                  onPress={addCustomTag}
                  accessibilityRole="button"
                >
                  <Text style={styles.addText}>Add Tag</Text>
                </Pressable>
              </View>
            </Field>
          </ScrollView>

          <View
            style={[
              styles.footer,
              { paddingBottom: Math.max(insets.bottom, Platform.OS === "android" ? 14 : 10) },
            ]}
          >
            <Pressable
              style={styles.cancel}
              onPress={() => navigation.goBack()}
              accessibilityRole="button"
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.submit, saving && styles.submitBusy]}
              onPress={submit}
              disabled={saving}
              accessibilityRole="button"
            >
              <Icon name="checkmark" size={17} color="#ffffff" />
              <Text style={styles.submitText}>{isEdit ? "Save Task" : "Create Task"}</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      )}

      {showPicker ? (
        <DateTimePicker
          value={dueDate || new Date()}
          mode="date"
          display="default"
          onChange={(_, next) => {
            setShowPicker(false);
            if (next) setDueDate(next);
          }}
        />
      ) : null}

      <AppSheet
        visible={sheet === "assignee"}
        onClose={() => setSheet(null)}
        title="Assign to"
      >
        <PickList
          options={[
            { id: "", label: "Unassigned" },
            ...people.map((row) => ({
              id: String(row?._id || row?.id || ""),
              label: String(row?.name || "User"),
            })),
          ]}
          selected={assignee}
          onSelect={(id) => {
            setAssignee(id);
            setSheet(null);
          }}
        />
      </AppSheet>

      <AppSheet visible={sheet === "lead"} onClose={() => setSheet(null)} title="Linked lead">
        <PickList
          options={[
            { id: "", label: "No linked lead" },
            ...leads.slice(0, 200).map((row: any) => ({
              id: String(row?._id || ""),
              label: String(row?.name || row?.phone || "Lead"),
            })),
          ]}
          selected={leadId}
          onSelect={(id) => {
            setLeadId(id);
            setSheet(null);
          }}
        />
      </AppSheet>
    </SafeAreaView>
  );
};

/* ------------------------------------------------------------ small parts -- */

const Field = ({
  icon,
  label,
  required,
  children,
}: {
  icon: string;
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) => (
  <View style={styles.field}>
    <View style={styles.fieldHead}>
      <Icon name={icon} size={15} color={themePalette.slate[600]} />
      <Text style={styles.fieldLabel}>{label}</Text>
      {required ? <Text style={styles.required}>*</Text> : null}
    </View>
    {children}
  </View>
);

const PickList = ({
  options,
  selected,
  onSelect,
}: {
  options: Array<{ id: string; label: string }>;
  selected: string;
  onSelect: (id: string) => void;
}) => (
  // A plain View: AppSheet already puts its children inside a ScrollView, and
  // nesting a second vertical scroller inside it fights for the same gesture.
  <View>
    {options.map((option) => {
      const active = option.id === selected;
      return (
        <Pressable
          key={option.id || "__none"}
          style={styles.pickRow}
          onPress={() => onSelect(option.id)}
          accessibilityRole="button"
        >
          <Text style={[styles.pickText, active && styles.pickTextActive]} numberOfLines={1}>
            {option.label}
          </Text>
          {active ? <Icon name="checkmark" size={16} color={themePalette.blue[600]} /> : null}
        </Pressable>
      );
    })}
  </View>
);

const styles = themedStyles((c) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: c.bg,
  },
  flex: {
    flex: 1,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  back: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.surfaceMuted,
    borderWidth: 1,
    borderColor: c.border,
  },
  topText: {
    flex: 1,
  },
  topTitle: {
    fontSize: typography.displayMd,
    fontWeight: "700",
    color: c.slate[900],
    letterSpacing: -0.3,
  },
  topSub: {
    fontSize: typography.label,
    color: c.slate[500],
  },
  centred: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  page: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.xl,
  },
  error: {
    fontSize: typography.label,
    color: c.rose[600],
  },

  field: {
    gap: spacing.md,
  },
  fieldHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  fieldLabel: {
    fontSize: typography.section,
    fontWeight: "700",
    color: c.slate[900],
  },
  required: {
    fontSize: typography.section,
    fontWeight: "700",
    color: c.rose[500],
  },

  input: {
    height: 52,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
    color: c.slate[900],
    fontSize: typography.body,
  },
  textarea: {
    height: 104,
    paddingTop: spacing.lg,
  },
  counter: {
    position: "absolute",
    right: spacing.lg,
    bottom: spacing.md,
    fontSize: typography.caption,
    color: c.slate[400],
  },

  segmentRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  segment: {
    flex: 1,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  segmentTight: {
    paddingHorizontal: 2,
  },
  segmentText: {
    fontSize: typography.body,
    fontWeight: "600",
    color: c.slate[700],
  },
  segmentTextTight: {
    fontSize: typography.caption,
  },

  select: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 52,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  selectRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  selectValue: {
    flex: 1,
    fontSize: typography.body,
    fontWeight: "600",
    color: c.slate[900],
  },
  selectPlaceholder: {
    flex: 1,
    fontSize: typography.body,
    color: c.slate[400],
  },

  rowGap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  meButton: {
    height: 52,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  meText: {
    fontSize: typography.body,
    fontWeight: "600",
    color: c.slate[700],
  },
  addButton: {
    height: 52,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  addText: {
    fontSize: typography.body,
    fontWeight: "600",
    color: c.slate[700],
  },

  subtaskRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surfaceMuted,
  },
  subtaskText: {
    flex: 1,
    fontSize: typography.label,
    color: c.slate[700],
  },

  tagWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    height: 42,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  tagActive: {
    borderColor: c.blue[400],
    backgroundColor: c.blue[50],
  },
  tagText: {
    fontSize: typography.label,
    fontWeight: "600",
    color: c.slate[700],
  },
  tagTextActive: {
    color: c.blue[600],
  },

  pickRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  pickText: {
    flex: 1,
    fontSize: typography.body,
    color: c.slate[700],
  },
  pickTextActive: {
    fontWeight: "700",
    color: c.blue[600],
  },

  footer: {
    flexDirection: "row",
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: c.border,
    backgroundColor: c.bg,
  },
  cancel: {
    flex: 1,
    height: 54,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.surfaceMuted,
    borderWidth: 1,
    borderColor: c.border,
  },
  cancelText: {
    fontSize: typography.title,
    fontWeight: "600",
    color: c.slate[700],
  },
  submit: {
    flex: 1.6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    height: 54,
    borderRadius: radii.md,
    backgroundColor: c.blue[600],
  },
  submitBusy: {
    opacity: 0.7,
  },
  submitText: {
    fontSize: typography.title,
    fontWeight: "700",
    color: "#ffffff",
  },
}));

export default NewTaskScreen;
