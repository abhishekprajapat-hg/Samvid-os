import type { Lead } from "../../types";
import type { Task } from "../../services/taskService";
import { stageOf } from "../leads/leadPipeline";

/*
 * Points, ranks, levels and badges.
 *
 * Nothing here is stored. A score is the sum of what somebody actually did -
 * deals closed, leads converted, visits made, tasks finished - priced by the
 * table below, which is the same table the Leaderboard prints under "How
 * Points Work". That means a score can always be explained by pointing at the
 * records behind it, and correcting a lead corrects the leaderboard.
 *
 * The prices and the reward tiers are the comps' own figures. They are the one
 * thing here that is policy rather than arithmetic, so they live at the top of
 * this file and nowhere else - change them here and every screen follows.
 */

export const POINTS = {
  DEAL_CLOSED: 500,
  LEAD_CONVERTED: 250,
  SITE_VISIT: 100,
  TASK_COMPLETED: 25,
} as const;

/** What the top three take home each month. */
export const REWARD_TIERS = [5000, 3000, 2000];

/** A level every 250 points. */
export const LEVEL_STEP = 250;

export const levelOf = (points: number) => Math.max(1, Math.floor(points / LEVEL_STEP) + 1);
export const levelFloor = (points: number) => (levelOf(points) - 1) * LEVEL_STEP;
export const levelCeiling = (points: number) => levelOf(points) * LEVEL_STEP;

const at = (value?: string | null) => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
};

const within = (value: string | null | undefined, from: Date, to: Date) => {
  const date = at(value);
  return Boolean(date && date >= from && date <= to);
};

/* --------------------------------------------------------------- scores -- */

export type Score = {
  id: string;
  name: string;
  role: string;
  deals: number;
  converted: number;
  visits: number;
  tasks: number;
  revenue: number;
  /** Minutes, averaged over the leads this person was first to contact. */
  responseMinutes: number | null;
  points: number;
  breakdown: Array<{ label: string; points: number }>;
};

const VISIT_STATUSES = new Set(["SITE_VISIT_SCHEDULED", "SITE_VISIT"]);
const CONVERTED_STAGES = new Set(["INTERESTED", "VISIT", "REQUESTED", "CLOSED"]);

const ownerOf = (row: { assignedTo?: unknown }) => {
  const value = row.assignedTo as { _id?: string; name?: string; role?: string } | null | undefined;
  if (!value || typeof value !== "object" || !value._id) return null;
  return { id: String(value._id), name: String(value.name || ""), role: String(value.role || "") };
};

const prettyRole = (role: string) =>
  role
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/(^|\s)\S/g, (ch) => ch.toUpperCase()) || "Team";

/**
 * One score per person who owns anything in the window. `dealValue` prices a
 * closed deal for the revenue column - the same assumption the sales report
 * makes, and the only number here that is not counted.
 */
export const buildScores = (
  leads: Lead[],
  tasks: Task[],
  from: Date,
  to: Date,
  dealValue = 80000,
): Score[] => {
  const rows = new Map<string, Score>();

  const ensure = (person: { id: string; name: string; role: string }) => {
    let row = rows.get(person.id);
    if (!row) {
      row = {
        id: person.id,
        name: person.name,
        role: prettyRole(person.role),
        deals: 0,
        converted: 0,
        visits: 0,
        tasks: 0,
        revenue: 0,
        responseMinutes: null,
        points: 0,
        breakdown: [],
      };
      rows.set(person.id, row);
    }
    return row;
  };

  const gaps = new Map<string, number[]>();

  for (const lead of leads) {
    const owner = ownerOf(lead);
    if (!owner) continue;
    /*
     * A lead counts in the window it was last worked in, not the one it
     * arrived in - otherwise a deal closed this month would score against last
     * month's leaderboard.
     */
    const worked = lead.updatedAt || lead.createdAt;
    if (!within(worked, from, to)) continue;

    const row = ensure(owner);
    const status = String(lead.status || "");
    if (status === "CLOSED") {
      row.deals += 1;
      row.revenue += dealValue;
    }
    if (CONVERTED_STAGES.has(stageOf(lead))) row.converted += 1;
    if (VISIT_STATUSES.has(status)) row.visits += 1;

    const created = at(lead.createdAt);
    const contacted = at(lead.lastContactedAt);
    if (created && contacted && contacted >= created) {
      const list = gaps.get(owner.id) || [];
      list.push((contacted.getTime() - created.getTime()) / 60000);
      gaps.set(owner.id, list);
    }
  }

  for (const task of tasks) {
    const owner = ownerOf(task);
    if (!owner) continue;
    if (String(task.status || "") !== "COMPLETED") continue;
    if (!within((task as { updatedAt?: string }).updatedAt, from, to)) continue;
    ensure(owner).tasks += 1;
  }

  for (const row of rows.values()) {
    const list = gaps.get(row.id) || [];
    row.responseMinutes = list.length
      ? Math.round(list.reduce((sum, value) => sum + value, 0) / list.length)
      : null;

    row.breakdown = [
      { label: "Deals Closed", points: row.deals * POINTS.DEAL_CLOSED },
      { label: "Lead Conversions", points: row.converted * POINTS.LEAD_CONVERTED },
      { label: "Site Visits", points: row.visits * POINTS.SITE_VISIT },
      { label: "Tasks Completed", points: row.tasks * POINTS.TASK_COMPLETED },
    ];
    row.points = row.breakdown.reduce((sum, entry) => sum + entry.points, 0);
  }

  return [...rows.values()].sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
};

/** Where each person sat last period, so a row can show which way it moved. */
export const movementOf = (current: Score[], previous: Score[]) => {
  const before = new Map(previous.map((row, index) => [row.id, index + 1]));
  return new Map(
    current.map((row, index) => {
      const was = before.get(row.id);
      return [row.id, was == null ? null : was - (index + 1)];
    }),
  );
};

/* --------------------------------------------------------------- badges -- */

export type Badge = {
  key: string;
  label: string;
  requirement: string;
  icon: string;
  tone: "GOLD" | "GREEN" | "BLUE";
  /** Where the person is against the requirement. */
  progress: number;
  target: number;
  unlocked: boolean;
};

/*
 * A badge is a threshold on a count, so it is unlocked exactly when the count
 * reaches it - no store, and no way for a badge to survive a correction to the
 * record that earned it.
 */
export const buildBadges = (score: Score | null, attendanceDays = 0): Badge[] => {
  const s = score || {
    deals: 0, converted: 0, visits: 0, tasks: 0, revenue: 0, responseMinutes: null,
  } as Partial<Score>;

  const make = (
    key: string,
    label: string,
    requirement: string,
    icon: string,
    tone: Badge["tone"],
    progress: number,
    target: number,
  ): Badge => ({
    key, label, requirement, icon, tone,
    progress: Math.min(progress, target),
    target,
    unlocked: progress >= target,
  });

  return [
    make("deal-closer", "Deal Closer", "Close 3 deals", "trophy", "GOLD", Number(s.deals || 0), 3),
    make(
      "speed-responder",
      "Speed Responder",
      "Respond under 15 min",
      "flash",
      "GREEN",
      s.responseMinutes != null && s.responseMinutes <= 15 ? 1 : 0,
      1,
    ),
    make("lead-champion", "Lead Champion", "Convert 10 leads", "people", "BLUE", Number(s.converted || 0), 10),
    make("visit-pro", "Visit Pro", "20 site visits", "business", "GREEN", Number(s.visits || 0), 20),
    make("task-master", "Task Master", "50 tasks", "clipboard", "GOLD", Number(s.tasks || 0), 50),
    make("streak", "7-Day Streak", "Active for 7 days", "calendar", "BLUE", attendanceDays, 7),
    make("revenue-star", "Revenue Star", "₹5L in revenue", "star", "GREEN", Number(s.revenue || 0), 500000),
    make("conversion-expert", "Conversion Expert", "Convert 10 leads", "funnel", "BLUE", Number(s.converted || 0), 10),
    make("attendance-hero", "Attendance Hero", "20 days present", "calendar-number", "GREEN", attendanceDays, 20),
  ];
};

/* ------------------------------------------------------------ formatting -- */

export const pointsLabel = (points: number) => `${Math.round(points).toLocaleString("en-IN")} pts`;

export const movementLabel = (delta: number | null) => {
  if (delta == null) return { text: "new", tone: "flat" as const };
  if (delta > 0) return { text: `+${delta}`, tone: "up" as const };
  if (delta < 0) return { text: String(delta), tone: "down" as const };
  return { text: "0", tone: "flat" as const };
};
