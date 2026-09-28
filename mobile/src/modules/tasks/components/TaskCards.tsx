import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Glyph, type GlyphName } from "../../../components/ui/Glyph";
import { brand, brandStyles, round, type as t } from "../../../theme/brand";
import { assigneeName, initialsOf, subtaskProgress } from "../taskConstants";
import { accentFor, dueLabel, flagFor, priorityPill, statePill } from "../taskTones";
import type { Task } from "../../../services/taskService";

/*
 * The three task rows the comps draw.
 *
 * They differ enough to be three components rather than one with flags: the
 * All list leads with a state pill against the time, Assigned leads with the
 * assignee and a priority flag, and My Tasks leads with a priority pill and
 * strikes a completed row through. What they share - the left priority bar,
 * the checkbox, the subject line - is in the stylesheet at the foot.
 */

const subjectOf = (task: Task) => {
  const lead = task.leadId;
  if (lead && typeof lead === "object" && lead.name) return String(lead.name);
  const tag = (task.tags || [])[0];
  return tag ? String(tag) : "";
};

const Avatar = ({ name, size = 30 }: { name: string; size?: number }) => (
  <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
    <Text style={[styles.avatarText, size < 28 && styles.avatarTextSmall]}>{initialsOf(name)}</Text>
  </View>
);

const Check = ({
  done,
  round: circular,
  onPress,
}: {
  done: boolean;
  round?: boolean;
  onPress: () => void;
}) => (
  <Pressable
    onPress={onPress}
    hitSlop={10}
    accessibilityRole="checkbox"
    accessibilityState={{ checked: done }}
  >
    <View style={[styles.check, circular && styles.checkRound, done && styles.checkOn]}>
      {done ? <Glyph name="checkmark" size={15} color={brand.onPrimary} /> : null}
    </View>
  </Pressable>
);

const Pill = ({ tone }: { tone: { label: string; bg: string; fg: string } }) => (
  <View style={[styles.pill, { backgroundColor: tone.bg }]}>
    <Text style={[styles.pillText, { color: tone.fg }]}>{tone.label}</Text>
  </View>
);

const Meta = ({ icon, text }: { icon: GlyphName; text: string }) => (
  <View style={styles.metaRow}>
    <Glyph name={icon} size={14} color={brand.textMuted} />
    <Text style={styles.metaText} numberOfLines={1}>
      {text}
    </Text>
  </View>
);

/* -------------------------------------------------------------- All Tasks -- */

export const TaskCard = ({
  task,
  onPress,
  onToggle,
  onMenu,
}: {
  task: Task;
  onPress: () => void;
  onToggle: () => void;
  onMenu: () => void;
}) => {
  const done = String(task.status || "").toUpperCase() === "COMPLETED";
  const subject = subjectOf(task);

  return (
    <Pressable style={styles.card} onPress={onPress} accessibilityRole="button">
      <View style={[styles.accent, { backgroundColor: accentFor(task.priority) }]} />
      <View style={styles.cardBody}>
        <Check done={done} onPress={onToggle} />
        <View style={styles.grow}>
          <Text style={[styles.title, done && styles.titleDone]} numberOfLines={2}>
            {task.title}
          </Text>
          {subject ? <Meta icon="business-outline" text={subject} /> : null}
          <View style={styles.inlineRow}>
            <Glyph name="calendar-outline" size={14} color={brand.textMuted} />
            <Text style={styles.metaText}>{dueLabel(task)}</Text>
            <Pill tone={statePill(task)} />
          </View>
        </View>
        <View style={styles.cardRight}>
          <Avatar name={assigneeName(task)} />
          <Pressable onPress={onMenu} hitSlop={10} accessibilityRole="button" accessibilityLabel="Task actions">
            <Glyph name="ellipsis-horizontal" size={20} color={brand.textMuted} />
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
};

/* ---------------------------------------------------------- Assigned to me -- */

export const AssignedRow = ({
  task,
  onPress,
  onToggle,
  onMenu,
}: {
  task: Task;
  onPress: () => void;
  onToggle: () => void;
  onMenu: () => void;
}) => {
  const done = String(task.status || "").toUpperCase() === "COMPLETED";
  const subject = subjectOf(task);
  const flag = flagFor(task.priority);
  const state = statePill(task);

  return (
    <Pressable style={styles.row} onPress={onPress} accessibilityRole="button">
      <Check done={done} onPress={onToggle} />
      <View style={styles.grow}>
        <View style={styles.inlineTop}>
          <Text style={[styles.title, done && styles.titleDone]} numberOfLines={1}>
            {task.title}
          </Text>
          <Pill tone={state} />
          <Pressable onPress={onMenu} hitSlop={10} accessibilityRole="button" accessibilityLabel="Task actions">
            <Glyph name="ellipsis-horizontal" size={20} color={brand.textMuted} />
          </Pressable>
        </View>
        {subject ? <Meta icon="business-outline" text={subject} /> : null}
        <View style={styles.inlineRow}>
          <Avatar name={assigneeName(task)} size={24} />
          <Text style={styles.metaText} numberOfLines={1}>
            {assigneeName(task) || "Unassigned"}
          </Text>
          <Glyph name="time-outline" size={14} color={state.fg} />
          <Text style={[styles.metaText, { color: state.fg }]}>{dueLabel(task)}</Text>
          <View style={styles.flagWrap}>
            <Glyph name="flag" size={14} color={flag.color} />
            <Text style={[styles.metaText, { color: flag.color }]}>{flag.label}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
};

/* -------------------------------------------------------------- My tasks -- */

export const MyTaskRow = ({
  task,
  onPress,
  onToggle,
  onMenu,
}: {
  task: Task;
  onPress: () => void;
  onToggle: () => void;
  onMenu: () => void;
}) => {
  const done = String(task.status || "").toUpperCase() === "COMPLETED";
  const subject = subjectOf(task);
  const progress = subtaskProgress(task);

  return (
    <Pressable
      style={[styles.card, done && styles.cardDone]}
      onPress={onPress}
      accessibilityRole="button"
    >
      {done ? null : <View style={[styles.accent, { backgroundColor: accentFor(task.priority) }]} />}
      <View style={styles.cardBody}>
        <Check done={done} round onPress={onToggle} />
        <View style={styles.grow}>
          <View style={styles.inlineTop}>
            <Text style={[styles.title, done && styles.titleDone]} numberOfLines={1}>
              {task.title}
            </Text>
            <Pill tone={priorityPill(task.priority)} />
            <Pressable onPress={onMenu} hitSlop={10} accessibilityRole="button" accessibilityLabel="Task actions">
              <Glyph name="ellipsis-horizontal" size={20} color={brand.textMuted} />
            </Pressable>
          </View>

          <View style={styles.inlineRow}>
            <Avatar name={assigneeName(task)} size={24} />
            <Text style={styles.metaText} numberOfLines={1}>
              {assigneeName(task) || "Unassigned"}
            </Text>
          </View>

          <View style={styles.inlineRow}>
            {subject ? (
              <>
                <Glyph name="business-outline" size={14} color={brand.textMuted} />
                <Text style={styles.metaText} numberOfLines={1}>
                  {subject}
                </Text>
              </>
            ) : null}
            <Glyph name="calendar-outline" size={14} color={brand.textMuted} />
            <Text style={styles.metaText}>{dueLabel(task)}</Text>
            {progress.total ? (
              <Text style={styles.metaText}>
                {progress.done}/{progress.total}
              </Text>
            ) : null}
            <View style={styles.pushRight}>
              <Pill tone={statePill(task)} />
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
};

const styles = brandStyles((b) =>
  StyleSheet.create({
    grow: {
      flex: 1,
      minWidth: 0,
    },

    card: {
      marginBottom: 10,
      flexDirection: "row",
      overflow: "hidden",
      borderWidth: 1,
      borderColor: b.border,
      borderRadius: round.panel,
      backgroundColor: b.surface,
    },
    cardDone: {
      backgroundColor: "#f5fbfa",
    },
    accent: {
      width: 6,
    },
    cardBody: {
      flex: 1,
      minWidth: 0,
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
      padding: 14,
    },
    cardRight: {
      alignItems: "center",
      gap: 10,
    },

    row: {
      marginBottom: 10,
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: b.border,
      borderRadius: round.panel,
      backgroundColor: b.surface,
    },

    check: {
      width: 22,
      height: 22,
      marginTop: 1,
      borderRadius: 5,
      borderWidth: 1.5,
      borderColor: b.fieldBorder,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: b.surface,
    },
    checkRound: {
      borderRadius: round.pill,
    },
    checkOn: {
      borderColor: b.primary,
      backgroundColor: b.primary,
    },

    title: {
      flexShrink: 1,
      minWidth: 0,
      fontSize: t.sectionTitle,
      lineHeight: 20,
      fontWeight: "700",
      letterSpacing: -0.3,
      color: b.text,
    },
    titleDone: {
      textDecorationLine: "line-through",
      color: b.textMuted,
    },

    inlineTop: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    inlineRow: {
      marginTop: 7,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    metaRow: {
      marginTop: 7,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    metaText: {
      flexShrink: 1,
      minWidth: 0,
      fontSize: t.body,
      color: b.textMuted,
    },
    flagWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      marginLeft: "auto",
    },
    pushRight: {
      marginLeft: "auto",
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

    avatar: {
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: b.tint,
    },
    avatarText: {
      fontSize: t.body,
      fontWeight: "700",
      color: b.deep,
    },
    avatarTextSmall: {
      fontSize: t.tagline,
    },
  }),
);
