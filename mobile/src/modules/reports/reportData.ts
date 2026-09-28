import type { Lead } from "../../types";
import { STEPPER_STAGES, sourceLabel, stageOf } from "../leads/leadPipeline";

/*
 * The report numbers, worked out from the records the app already reads.
 *
 * There is no reporting endpoint: leads, the finance ledger, inventory and the
 * task stats are each fetched by their own service and aggregated here. That
 * keeps a report honest - it is the same data the module screens show, counted
 * the same way - and it means a new metric is a function here rather than a
 * migration.
 */

export const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"];

const at = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const within = (value: string | null | undefined, from: Date, to: Date) => {
  const date = at(value);
  return Boolean(date && date >= from && date <= to);
};

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

/* ----------------------------------------------------------- sales -- */

/** Statuses that count as qualified - the lead has said something real. */
const QUALIFIED = new Set(["INTERESTED", "SITE_VISIT_SCHEDULED", "SITE_VISIT", "REQUESTED", "CLOSED"]);
/* Only a visit that actually happened or is on the calendar. */
const VISITED = new Set(["SITE_VISIT_SCHEDULED", "SITE_VISIT"]);

export type SalesReport = {
  total: number;
  qualified: number;
  siteVisits: number;
  closed: number;
  conversion: number;
  /** Minutes from a lead arriving to it first being contacted. */
  avgResponseMinutes: number | null;
  growth: Array<{ label: string; sub: string; a: number; b: number }>;
  funnel: Array<{ label: string; value: number; share: number }>;
  sources: Array<{ label: string; value: number; share: number }>;
  performers: Array<{ name: string; leads: number; deals: number; value: number }>;
};

export const buildSalesReport = (
  leads: Lead[],
  from: Date,
  to: Date,
  dealValue = 50000,
): SalesReport => {
  const rows = leads.filter((lead) => within(lead.createdAt, from, to));
  const total = rows.length;
  const qualified = rows.filter((lead) => QUALIFIED.has(String(lead.status || ""))).length;
  const siteVisits = rows.filter((lead) => VISITED.has(String(lead.status || ""))).length;
  const closed = rows.filter((lead) => String(lead.status || "") === "CLOSED").length;

  /*
   * Response time is the gap between a lead arriving and somebody first
   * reaching it. `lastContactedAt` is the only timestamp for that, so a lead
   * contacted more than once reports its most recent touch - an upper bound,
   * which is the safer way to be wrong about a service level.
   */
  const gaps = rows
    .map((lead) => {
      const created = at(lead.createdAt);
      const contacted = at(lead.lastContactedAt);
      if (!created || !contacted || contacted < created) return null;
      return (contacted.getTime() - created.getTime()) / 60000;
    })
    .filter((value): value is number => value != null);
  const avgResponseMinutes = gaps.length
    ? Math.round(gaps.reduce((sum, value) => sum + value, 0) / gaps.length)
    : null;

  /* Weekly buckets across the range, as the comp's W1..W4 ticks. */
  const spanDays = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / 86400000));
  const weeks = Math.min(6, Math.max(1, Math.ceil(spanDays / 7)));
  const growth = Array.from({ length: weeks }, (_, index) => {
    const start = new Date(from.getTime() + index * 7 * 86400000);
    const end = new Date(Math.min(to.getTime(), start.getTime() + 7 * 86400000 - 1));
    const bucket = rows.filter((lead) => within(lead.createdAt, start, end));
    return {
      label: `W${index + 1}`,
      sub: `${start.getDate()}–${end.getDate()}`,
      a: bucket.length,
      b: bucket.filter((lead) => QUALIFIED.has(String(lead.status || ""))).length,
    };
  });

  /*
   * The comp reads each stage's share as a conversion from the one above it,
   * and says so under the chart.
   */
  const counts = STEPPER_STAGES.map((stage) => ({
    label: stage.label,
    value: rows.filter((lead) => stageOf(lead) === stage.key).length,
  }));
  /*
   * Each stage as a share of the first one, which is how the comp's numbers
   * read - 44 new, 8 contacted, 18%.
   */
  const head = counts[0]?.value || 0;
  const funnel = counts.map((stage, index) => ({
    ...stage,
    share: index === 0 ? 100 : pct(stage.value, head),
  }));

  const bySource = new Map<string, number>();
  for (const lead of rows) {
    const key = sourceLabel(lead);
    bySource.set(key, (bySource.get(key) || 0) + 1);
  }
  const sources = [...bySource.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([label, value]) => ({ label, value, share: pct(value, total) }));

  const byOwner = new Map<string, { leads: number; deals: number }>();
  for (const lead of rows) {
    const owner = lead.assignedTo && typeof lead.assignedTo === "object" ? lead.assignedTo.name : "";
    if (!owner) continue;
    const entry = byOwner.get(owner) || { leads: 0, deals: 0 };
    entry.leads += 1;
    if (String(lead.status || "") === "CLOSED") entry.deals += 1;
    byOwner.set(owner, entry);
  }
  const performers = [...byOwner.entries()]
    .map(([name, entry]) => ({ name, ...entry, value: entry.deals * dealValue }))
    .sort((a, b) => b.value - a.value || b.leads - a.leads)
    .slice(0, 3);

  return {
    total,
    qualified,
    siteVisits,
    closed,
    conversion: pct(closed, total),
    avgResponseMinutes,
    growth,
    funnel,
    sources,
    performers,
  };
};

/* --------------------------------------------------------- finance -- */

export type Breakdown = Array<{ label: string; value: number; share: number }>;

/** Groups ledger rows by category, biggest first, with the tail as "Other". */
export const groupByCategory = (
  rows: Array<{ category: string; amount: number }>,
  keep = 4,
): Breakdown => {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const key = String(row.category || "OTHER").toUpperCase();
    totals.set(key, (totals.get(key) || 0) + Math.abs(Number(row.amount) || 0));
  }

  const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  const grand = sorted.reduce((sum, [, value]) => sum + value, 0);

  const head = sorted.slice(0, keep);
  const tail = sorted.slice(keep).reduce((sum, [, value]) => sum + value, 0);
  const merged: Array<[string, number]> = tail > 0 ? [...head, ["OTHER", tail]] : head;

  return merged.map(([label, value]) => ({ label, value, share: pct(value, grand) }));
};

/** How much of what was billed actually came in. */
/** The comp prints it to one decimal - 74.6%, not 75%. */
export const collectionRate = (collected: number, income: number) =>
  income > 0 ? Math.round((collected / income) * 1000) / 10 : 0;

/* --------------------------------------------------------- ranges -- */

export const startOfMonth = (date = new Date()) =>
  new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);

export const endOfMonth = (date = new Date()) =>
  new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);

export const rangeLabel = (from: Date, to: Date) => {
  const sameMonth = from.getMonth() === to.getMonth() && from.getFullYear() === to.getFullYear();
  if (sameMonth) {
    return `${String(from.getDate()).padStart(2, "0")} – ${to.getDate()} ${MONTHS_SHORT[to.getMonth()]} ${to.getFullYear()}`;
  }
  return `${from.getDate()} ${MONTHS_SHORT[from.getMonth()]} – ${to.getDate()} ${MONTHS_SHORT[to.getMonth()]} ${to.getFullYear()}`;
};

export const monthLabel = (date = new Date()) =>
  `${["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][date.getMonth()]} ${date.getFullYear()}`;

/** "18 min", "2h 10m" - the comp's response-time tile. */
export const minutesLabel = (minutes: number | null) => {
  if (minutes == null) return "—";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${String(minutes % 60).padStart(2, "0")}m`;
};

export const changeLabel = (now: number, before: number) => {
  if (!before) return null;
  const change = ((now - before) / Math.abs(before)) * 100;
  return `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`;
};
