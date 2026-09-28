import { brand } from "../../theme/brand";
import { isDueToday, isOverdue, toDate } from "./taskConstants";
import type { Task } from "../../services/taskService";

/*
 * The Tasks comps' own colour vocabulary.
 *
 * `taskConstants.ts` already carries one, written against the web-parity
 * tokens the board and the old list used. These are the values measured off
 * the comps instead - the priority bar down a card's left edge, the flag
 * beside a row, and the state pill. Read at call time so they follow the
 * active colour scheme.
 */

export type Tone = { label: string; bg: string; fg: string };

/** The bar down a card's left edge. The comps colour it by priority. */
export const accentFor = (priority?: string): string => {
  switch (String(priority || "MEDIUM").toUpperCase()) {
    case "HIGH":
      return "#ef5e5c";
    case "LOW":
      return "#c7ced8";
    default:
      return "#fdb94e";
  }
};

/** The little flag the Assigned rows put beside the priority word. */
export const flagFor = (priority?: string): { color: string; label: string } => {
  switch (String(priority || "MEDIUM").toUpperCase()) {
    case "HIGH":
      return { color: "#e0433f", label: "High" };
    case "LOW":
      return { color: brand.greenBright, label: "Low" };
    default:
      return { color: "#e08328", label: "Medium" };
  }
};

export const priorityPill = (priority?: string): Tone => {
  switch (String(priority || "MEDIUM").toUpperCase()) {
    case "HIGH":
      return { label: "High", bg: "#fdedee", fg: "#d64545" };
    case "LOW":
      return { label: "Low", bg: brand.tintSoft, fg: brand.deep };
    default:
      return { label: "Medium", bg: "#e8f5ef", fg: brand.deep };
  }
};

/**
 * The state pill on a row. It is not just the status: the comps show a task
 * that is late as "Overdue" and one due today as "Due Today", which are
 * readings of the date, not columns on the task.
 */
export const statePill = (task: Task): Tone => {
  const status = String(task.status || "TODO").toUpperCase();
  if (status === "COMPLETED") return { label: "Completed", bg: "#e6f4f0", fg: brand.deep };
  if (isOverdue(task)) return { label: "Overdue", bg: "#fdedee", fg: "#d64545" };
  if (status === "IN_PROGRESS") return { label: "In Progress", bg: "#fef2e0", fg: "#b4791a" };
  if (isDueToday(task)) return { label: "Due Today", bg: "#fef6eb", fg: "#b4791a" };
  const due = toDate(task.dueDate);
  if (due) return { label: "Upcoming", bg: "#eef1f5", fg: "#64748b" };
  return { label: "To Do", bg: "#eef1f5", fg: "#64748b" };
};

/** "Today", "Tomorrow", "25 Sept" - the way the comps write a due date. */
export const dueLabel = (task: Task): string => {
  const due = toDate(task.dueDate);
  if (!due) return "No due date";

  const start = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((start(due) - start(new Date())) / 86400000);

  if (days === 0) {
    return due.getHours() || due.getMinutes()
      ? due.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true }).toUpperCase()
      : "Today";
  }
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  return due.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};
