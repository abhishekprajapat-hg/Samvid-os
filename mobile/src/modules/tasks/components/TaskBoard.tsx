import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Icon } from "../../../components/ui/Icon";
import { radii, spacing, typography } from "../../../theme/tokens";
import { themedStyles, themePalette } from "../../../theme/themedStyles";
import type { Task } from "../../../services/taskService";
import {
  BOARD_COLUMNS,
  assigneeName,
  formatTaskDate,
  isOverdue,
  priorityTone,
  statusTone,
  type StatusId,
} from "../taskConstants";
import { Avatar, KebabButton, ToneChip } from "./TaskPieces";

/*
 * The board view: To Do, In Progress and Completed side by side.
 *
 * Web has room to lay three columns across the page. A phone does not, so the
 * columns keep their width and the board scrolls sideways - the one change
 * from the comp's intent that the screen width forces, and the same choice the
 * design system records for wide tables.
 *
 * Dragging between columns is deliberately not here: a horizontal pan inside a
 * horizontal scroller fights the scroller on touch. A card moves status from
 * its own menu instead, which is reachable and does not misfire.
 */

const COLUMN_WIDTH = 252;

const columnTint = (status: StatusId) => {
  const c = themePalette;
  if (status === "IN_PROGRESS") return { head: c.blue[50], body: c.blue[50], text: c.blue[700] };
  if (status === "COMPLETED") return { head: c.emerald[50], body: c.emerald[50], text: c.emerald[700] };
  return { head: c.rose[50], body: c.rose[50], text: c.rose[600] };
};

const BoardCard = ({
  task,
  onPress,
  onMenu,
}: {
  task: Task;
  onPress: () => void;
  onMenu: () => void;
}) => {
  const person = assigneeName(task);
  const due = formatTaskDate(task.dueDate);
  return (
    <Pressable style={styles.card} onPress={onPress} accessibilityRole="button">
      <View style={styles.cardHead}>
        <Text style={styles.cardTitle} numberOfLines={3}>
          {task.title}
        </Text>
        <KebabButton onPress={onMenu} />
      </View>

      {task.description ? (
        <Text style={styles.cardSubtitle} numberOfLines={2}>
          {task.description}
        </Text>
      ) : null}

      <View style={styles.cardChipRow}>
        <ToneChip tone={priorityTone(task.priority)} />
      </View>

      {due ? (
        <View style={styles.cardMeta}>
          <Icon
            name="calendarDays"
            size={13}
            color={isOverdue(task) ? themePalette.rose[600] : themePalette.slate[500]}
          />
          <Text
            style={[styles.cardMetaText, isOverdue(task) && { color: themePalette.rose[600] }]}
          >
            {due}
          </Text>
        </View>
      ) : null}

      {person ? (
        <View style={styles.cardMeta}>
          <Avatar name={person} size={24} />
          <Text style={styles.cardMetaText} numberOfLines={1}>
            {person}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
};

export const TaskBoard = ({
  tasks,
  onOpenTask,
  onTaskMenu,
  onAddTask,
}: {
  tasks: Task[];
  onOpenTask: (task: Task) => void;
  onTaskMenu: (task: Task) => void;
  onAddTask: (status: StatusId) => void;
}) => (
  <ScrollView
    horizontal
    showsHorizontalScrollIndicator={false}
    contentContainerStyle={styles.board}
  >
    {BOARD_COLUMNS.map((status) => {
      const tint = columnTint(status);
      const column = tasks.filter((task) => String(task.status || "TODO").toUpperCase() === status);
      return (
        <View key={status} style={[styles.column, { backgroundColor: tint.body }]}>
          <View style={[styles.columnHead, { backgroundColor: tint.head }]}>
            <Text style={[styles.columnTitle, { color: tint.text }]} numberOfLines={1}>
              {statusTone(status).label}
            </Text>
            <View style={styles.countPill}>
              <Text style={[styles.countText, { color: tint.text }]}>{column.length}</Text>
            </View>
            <View style={styles.columnSpacer} />
            <KebabButton onPress={() => onAddTask(status)} />
          </View>

          <ScrollView
            style={styles.columnScroll}
            contentContainerStyle={styles.columnBody}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
          >
            {column.map((task) => (
              <BoardCard
                key={task._id}
                task={task}
                onPress={() => onOpenTask(task)}
                onMenu={() => onTaskMenu(task)}
              />
            ))}

            <Pressable
              style={styles.addTask}
              onPress={() => onAddTask(status)}
              accessibilityRole="button"
            >
              <Icon name="add" size={15} color={themePalette.blue[600]} />
              <Text style={styles.addTaskText}>Add task</Text>
            </Pressable>
          </ScrollView>
        </View>
      );
    })}
  </ScrollView>
);

const styles = themedStyles((c) => StyleSheet.create({
  board: {
    gap: spacing.lg,
    paddingBottom: spacing.lg,
  },
  column: {
    width: COLUMN_WIDTH,
    borderRadius: radii.md,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: c.border,
  },
  columnHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    height: 46,
  },
  columnTitle: {
    fontSize: typography.section,
    fontWeight: "700",
    flexShrink: 1,
  },
  countPill: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.surface,
  },
  countText: {
    fontSize: typography.caption,
    fontWeight: "700",
  },
  columnSpacer: {
    flex: 1,
  },
  columnScroll: {
    maxHeight: 520,
  },
  columnBody: {
    padding: spacing.md,
    gap: spacing.md,
  },
  card: {
    borderRadius: radii.sm,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cardHead: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  cardTitle: {
    flex: 1,
    fontSize: typography.label,
    fontWeight: "700",
    color: c.slate[900],
  },
  cardSubtitle: {
    fontSize: typography.caption,
    color: c.slate[500],
  },
  cardChipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: 2,
  },
  cardMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  cardMetaText: {
    fontSize: typography.caption,
    color: c.slate[500],
    flexShrink: 1,
  },
  addTask: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    height: 44,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: c.borderStrong,
  },
  addTaskText: {
    fontSize: typography.label,
    fontWeight: "600",
    color: c.blue[600],
  },
}));

export default TaskBoard;
