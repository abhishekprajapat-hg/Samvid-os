import { themePalette } from "../../theme/themedStyles";
import type { Task } from "../../services/taskService";

/*
 * One vocabulary for the whole Tasks module.
 *
 * The list, the board, the details page and the create form all draw the same
 * status and priority chips, so the colours and labels live here rather than
 * being restated four times. Colours are read through themePalette, which
 * resolves per scheme at access time - that is why these are getters on an
 * object built at call time rather than a frozen constant.
 */

export type StatusId = "BACKLOG" | "TODO" | "IN_PROGRESS" | "COMPLETED";
export type PriorityId = "LOW" | "MEDIUM" | "HIGH";

export type ChipTone = {
  id: string;
  label: string;
  color: string;
  bg: string;
  border: string;
};

export const STATUS_IDS: StatusId[] = ["BACKLOG", "TODO", "IN_PROGRESS", "COMPLETED"];
export const PRIORITY_IDS: PriorityId[] = ["LOW", "MEDIUM", "HIGH"];

/** The three columns the board draws, in the order the comp shows them. */
export const BOARD_COLUMNS: StatusId[] = ["TODO", "IN_PROGRESS", "COMPLETED"];

export const PREDEFINED_TAGS = ["Call", "Meeting", "Document", "Site Visit", "Urgent", "Follow-up"];

export const statusTone = (id?: string): ChipTone => {
  const c = themePalette;
  switch (String(id || "TODO").toUpperCase()) {
    case "BACKLOG":
      return { id: "BACKLOG", label: "Backlog", color: c.slate[600], bg: c.slate[100], border: c.slate[200] };
    case "IN_PROGRESS":
      return { id: "IN_PROGRESS", label: "In Progress", color: c.emerald[700], bg: c.emerald[50], border: c.emerald[200] };
    case "COMPLETED":
      return { id: "COMPLETED", label: "Completed", color: c.emerald[700], bg: c.emerald[100], border: c.emerald[200] };
    default:
      return { id: "TODO", label: "To Do", color: c.blue[600], bg: c.blue[50], border: c.blue[200] };
  }
};

export const priorityTone = (id?: string): ChipTone => {
  const c = themePalette;
  switch (String(id || "MEDIUM").toUpperCase()) {
    case "LOW":
      return { id: "LOW", label: "Low", color: c.emerald[700], bg: c.emerald[50], border: c.emerald[200] };
    case "HIGH":
      return { id: "HIGH", label: "High", color: c.rose[600], bg: c.rose[50], border: c.rose[200] };
    default:
      return { id: "MEDIUM", label: "Medium", color: c.amber[700], bg: c.amber[50], border: c.amber[200] };
  }
};

/* The solid dot the list rows use in place of a filled chip. */
export const priorityDot = (id?: string): string => {
  const c = themePalette;
  switch (String(id || "MEDIUM").toUpperCase()) {
    case "LOW":
      return c.blue[500];
    case "HIGH":
      return c.rose[500];
    default:
      return c.amber[400];
  }
};

/* ------------------------------------------------------------------ dates -- */

export const toDate = (value?: string | null): Date | null => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

/** "16 Sept 2026", the format every comp uses. */
export const formatTaskDate = (value?: string | null): string => {
  const date = toDate(value);
  if (!date) return "";
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

export const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export const isOverdue = (task: Task): boolean => {
  if (String(task.status || "").toUpperCase() === "COMPLETED") return false;
  const due = toDate(task.dueDate);
  return !!due && due.getTime() < Date.now();
};

export const isDueToday = (task: Task): boolean => {
  const due = toDate(task.dueDate);
  return !!due && isSameDay(due, new Date());
};

/* ------------------------------------------------------------------ people -- */

export const initialsOf = (name = ""): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "NA";

/*
 * A stable tint per person, so the same name keeps the same avatar colour
 * across the roster, the board and a task row.
 */
export const avatarTint = (name = ""): { bg: string; fg: string } => {
  const c = themePalette;
  const families = [
    { bg: c.blue[100], fg: c.blue[700] },
    { bg: c.emerald[100], fg: c.emerald[700] },
    { bg: c.violet[100], fg: c.violet[700] },
    { bg: c.amber[100], fg: c.amber[700] },
    { bg: c.rose[100], fg: c.rose[700] },
    { bg: c.cyan[100], fg: c.cyan[700] },
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return families[hash % families.length];
};

export const assigneeName = (task: Task): string => {
  const assigned = task.assignedTo;
  if (assigned && typeof assigned === "object" && assigned.name) return String(assigned.name);
  return "";
};

export const subtaskProgress = (task: Task): { done: number; total: number } => {
  const list = Array.isArray(task.subtasks) ? task.subtasks : [];
  return { done: list.filter((row) => row?.isCompleted).length, total: list.length };
};

export const completionRate = (completed: number, total: number): number =>
  total > 0 ? Math.round((completed / total) * 100) : 0;

/* ---------------------------------------------------------------- workload -- */

export type WorkloadBand = "BUSY" | "BALANCED" | "AVAILABLE" | "OFFLINE";

/*
 * The four bands the Team tab counts.
 *
 * The comp shows the bands but not the rule behind them, so the rule is set
 * here and stated in docs/mobile/: a deactivated account is Offline, four or
 * more open tasks is Busy, one to three is Balanced, and nothing open is
 * Available. Change the thresholds here and every reading of them follows.
 */
export const BUSY_THRESHOLD = 4;

export const workloadBand = (pending: number, isActive: boolean): WorkloadBand => {
  if (!isActive) return "OFFLINE";
  if (pending >= BUSY_THRESHOLD) return "BUSY";
  if (pending >= 1) return "BALANCED";
  return "AVAILABLE";
};

export const WORKLOAD_BANDS: Array<{ id: WorkloadBand; label: string }> = [
  { id: "BUSY", label: "Busy" },
  { id: "BALANCED", label: "Balanced" },
  { id: "AVAILABLE", label: "Available" },
  { id: "OFFLINE", label: "Offline" },
];

export const workloadColor = (band: WorkloadBand): string => {
  const c = themePalette;
  if (band === "BUSY") return c.rose[500];
  if (band === "BALANCED") return c.blue[500];
  if (band === "AVAILABLE") return c.emerald[500];
  return c.slate[400];
};
