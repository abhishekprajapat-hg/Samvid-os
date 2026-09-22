import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { radii, spacing, typography } from "../../../theme/tokens";
import { themedStyles } from "../../../theme/themedStyles";
import type { Task } from "../../../services/taskService";
import {
  assigneeName,
  formatTaskDate,
  isOverdue,
  priorityDot,
  priorityTone,
  statusTone,
  subtaskProgress,
} from "../taskConstants";
import {
  CompleteToggle,
  DotLabel,
  KebabButton,
  MetaItem,
  PersonMeta,
  ToneChip,
} from "./TaskPieces";

/*
 * A task as a list row, in the two forms the comps draw.
 *
 * `chips` is the Assigned tab: the priority and status ride beside the title
 * as filled chips, and the meta line underneath is due date, who it is on and
 * the subtask count.
 *
 * `meta` is the My Task and All Task tabs: no chips beside the title, and the
 * same facts wrap as dotted labels below it. Same data either way - only the
 * arrangement differs, which is why this is one component with a variant
 * rather than two that drift apart.
 */

export type TaskRowVariant = "chips" | "meta";

export const TaskListRow = ({
  task,
  variant,
  selfLabel,
  onPress,
  onToggle,
  onMenu,
}: {
  task: Task;
  variant: TaskRowVariant;
  /** Assigned-tab rows read "Assigned to me" rather than naming the person. */
  selfLabel?: boolean;
  onPress: () => void;
  onToggle: () => void;
  onMenu: () => void;
}) => {
  const done = String(task.status || "").toUpperCase() === "COMPLETED";
  const overdue = isOverdue(task);
  const { done: subDone, total: subTotal } = subtaskProgress(task);
  const person = assigneeName(task);
  const due = formatTaskDate(task.dueDate);

  return (
    <Pressable style={styles.card} onPress={onPress} accessibilityRole="button">
      <View style={styles.head}>
        <CompleteToggle done={done} onPress={onToggle} />

        <View style={styles.headText}>
          <Text style={[styles.title, done && styles.titleDone]} numberOfLines={2}>
            {task.title}
          </Text>
          {task.description ? (
            <Text style={styles.subtitle} numberOfLines={2}>
              {task.description}
            </Text>
          ) : null}
        </View>

        {variant === "chips" ? (
          <View style={styles.headChips}>
            <ToneChip tone={priorityTone(task.priority)} />
            <ToneChip tone={statusTone(task.status)} />
          </View>
        ) : null}

        <KebabButton onPress={onMenu} />
      </View>

      <View style={styles.meta}>
        {variant === "meta" ? (
          <>
            <DotLabel color={priorityDot(task.priority)} label={priorityTone(task.priority).label} />
            <DotLabel color={statusTone(task.status).color} label={statusTone(task.status).label} />
          </>
        ) : null}

        <MetaItem
          icon="calendarDays"
          label={due || "No due date"}
          tone={overdue || (variant === "chips" && !!due) ? "danger" : "muted"}
        />

        <MetaItem
          icon="subtasks"
          label={
            variant === "chips"
              ? `${subDone}/${subTotal} subtasks`
              : `${subDone} of ${subTotal} subtasks`
          }
        />

        {selfLabel ? <MetaItem icon="person-outline" label="Assigned to me" /> : <PersonMeta name={person} />}
      </View>
    </Pressable>
  );
};

const styles = themedStyles((c) => StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radii.md,
    backgroundColor: c.surface,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  head: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  headText: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  headChips: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flexShrink: 0,
  },
  title: {
    fontSize: typography.body,
    fontWeight: "700",
    color: c.slate[900],
    letterSpacing: -0.1,
  },
  titleDone: {
    textDecorationLine: "line-through",
    color: c.slate[500],
  },
  subtitle: {
    fontSize: typography.caption,
    color: c.slate[500],
  },
  meta: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.lg,
    rowGap: spacing.sm,
    // Clears the toggle so the meta line starts under the title, as drawn.
    paddingLeft: 22 + spacing.md,
  },
}));

export default TaskListRow;
