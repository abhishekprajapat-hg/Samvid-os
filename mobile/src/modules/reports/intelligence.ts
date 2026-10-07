/*
 * Web's Intelligence Reports, as pure functions.
 *
 * Ported line for line from frontend/src/modules/reports/IntelligenceReports.jsx
 * so the phone and the browser count the same lead the same way: a closed, lost
 * or invalid lead belongs to the period it ended in, every other lead to the
 * period it arrived in; revenue is brokerage received, else the paid part of
 * the linked sale; cost per lead is Meta spend over Meta leads.
 *
 * Nothing here touches React or the network, which is what lets
 * test/intelligence.test.cjs hold it to web's numbers.
 */

export type RangeKey = "THIS_MONTH" | "QUARTER" | "YEAR" | "CUSTOM";
export type Bounds = { start: Date | null; end: Date | null };

export const RANGE_OPTIONS: Array<{ key: RangeKey; label: string }> = [
  { key: "THIS_MONTH", label: "This month" },
  { key: "QUARTER", label: "Quarter" },
  { key: "YEAR", label: "Year" },
  { key: "CUSTOM", label: "Custom" },
];

export const SITE_VISIT_STATUSES = new Set(["SITE_VISIT", "SITE_VISIT_SCHEDULED", "SITE_VISIT_OVERDUE"]);

export const LOST_REASON_LABELS: Record<string, string> = {
  NOT_PICKING_CALLS: "Not picking calls",
  MISSING_IN_ACTION: "Missing in action",
  SITE_VISIT_OVERDUE: "Visit no-show",
  INVALID: "Invalid number",
  LOST: "Lost",
};

const upper = (value: unknown) => String(value || "").toUpperCase();

export const parseLocalDateInput = (value: unknown): Date | null => {
  const raw = String(value || "").trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    Number.isNaN(date.getTime())
    || date.getFullYear() !== year
    || date.getMonth() !== month - 1
    || date.getDate() !== day
  ) {
    return null;
  }
  return date;
};

export const toDate = (value: unknown): Date | null => {
  const local = parseLocalDateInput(value);
  if (local) return local;
  if (value === null || value === undefined || value === "") return null;
  const date = new Date(value as any);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const toDateInputValue = (value: Date | string) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
};

const startOfDay = (date: Date) => {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const endOfDay = (date: Date) => {
  const copy = new Date(date);
  copy.setHours(23, 59, 59, 999);
  return copy;
};

export const resolveRangeBounds = ({
  rangeKey,
  customRange,
  offset = 0,
  now = new Date(),
}: {
  rangeKey: RangeKey;
  customRange: { startDate: string; endDate: string };
  offset?: number;
  now?: Date;
}): Bounds => {
  if (rangeKey === "THIS_MONTH") {
    return {
      start: new Date(now.getFullYear(), now.getMonth() + offset, 1),
      end: endOfDay(new Date(now.getFullYear(), now.getMonth() + offset + 1, 0)),
    };
  }
  if (rangeKey === "QUARTER") {
    const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3 + offset * 3;
    return {
      start: new Date(now.getFullYear(), quarterStartMonth, 1),
      end: endOfDay(new Date(now.getFullYear(), quarterStartMonth + 3, 0)),
    };
  }
  if (rangeKey === "YEAR") {
    return {
      start: new Date(now.getFullYear() + offset, 0, 1),
      end: endOfDay(new Date(now.getFullYear() + offset, 11, 31)),
    };
  }
  if (rangeKey === "CUSTOM") {
    const start = parseLocalDateInput(customRange.startDate);
    const end = parseLocalDateInput(customRange.endDate);
    return { start: start ? startOfDay(start) : null, end: end ? endOfDay(end) : null };
  }
  return { start: null, end: null };
};

export const getLeadRangeDate = (lead: any) => {
  const status = upper(lead?.status);
  if (status === "CLOSED" || status === "LOST" || status === "INVALID") {
    return toDate(lead?.updatedAt || lead?.createdAt);
  }
  return toDate(lead?.createdAt);
};

export const isInRange = (date: Date | null, bounds: Bounds) => {
  if (!date) return false;
  if (bounds.start && date < bounds.start) return false;
  if (bounds.end && date > bounds.end) return false;
  return true;
};

export const formatPercent = (value: number, digits = 0) =>
  `${(Number(value) || 0).toFixed(digits).replace(/\.0+$/, "")}%`;

export const formatCurrencyCompact = (value: number) => {
  const amount = Number(value) || 0;
  if (Math.abs(amount) >= 100000) {
    const lakhs = amount / 100000;
    return `₹${lakhs.toFixed(lakhs >= 10 ? 1 : 2).replace(/\.0+$/, "")} L`;
  }
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
};

export type Delta = { text: string; tone: "" | "up" | "down" };

export const formatSignedDelta = (
  current: number,
  previous: number,
  { suffix = "%", inverse = false }: { suffix?: string; inverse?: boolean } = {},
): Delta => {
  if (!Number.isFinite(previous) || previous <= 0) return { text: "No previous data", tone: "" };
  const change = current - previous;
  const tone = inverse ? (change <= 0 ? "up" : "down") : (change >= 0 ? "up" : "down");
  const symbol = change >= 0 ? "▲" : "▼";
  const absolute = Math.abs(change);
  const value = suffix === "pt"
    ? `${absolute.toFixed(1).replace(/\.0$/, "")}pt`
    : `${Math.round(absolute)}${suffix}`;
  return { text: `${symbol} ${value}`, tone };
};

export const getLeadRevenue = (lead: any = {}) => {
  const direct = Number(lead.brokerageReceived);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const inventories = [
    ...(lead.inventoryId ? [lead.inventoryId] : []),
    ...(Array.isArray(lead.relatedInventoryIds) ? lead.relatedInventoryIds : []),
  ];
  return inventories.reduce((sum: number, inventory: any) => {
    const saleDetails = inventory && typeof inventory === "object" ? inventory.saleDetails : null;
    const total = Number(saleDetails?.totalAmount || inventory?.price || 0);
    const remaining = Number(saleDetails?.remainingAmount || 0);
    return sum + Math.max(0, total - remaining);
  }, 0);
};

export type Summary = {
  received: number;
  closed: number;
  visits: number;
  conversion: number;
  avgDaysToClose: number;
  costPerLead: number | null;
  revenue: number;
};

export const buildSummary = (leadRows: any[]): Summary => {
  const received = leadRows.length;
  const closedRows = leadRows.filter((lead) => upper(lead.status) === "CLOSED");
  const visits = leadRows.filter((lead) => SITE_VISIT_STATUSES.has(upper(lead.status))).length;
  const closeAges = closedRows
    .map((lead) => {
      const created = toDate(lead.createdAt);
      const updated = toDate(lead.updatedAt || lead.createdAt);
      if (!created || !updated) return null;
      return Math.max(0, (updated.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
    })
    .filter((days): days is number => Number.isFinite(days));
  const revenue = closedRows.reduce((sum, lead) => sum + getLeadRevenue(lead), 0);
  const metaRows = leadRows.filter((lead) => upper(lead.source) === "META");
  const metaSpend = metaRows.reduce((sum, lead) => sum + Number(lead.adSpend || lead.campaignSpend || 0), 0);
  return {
    received,
    closed: closedRows.length,
    visits,
    conversion: received > 0 ? (closedRows.length / received) * 100 : 0,
    avgDaysToClose: closeAges.length ? closeAges.reduce((sum, days) => sum + days, 0) / closeAges.length : 0,
    costPerLead: metaSpend > 0 && metaRows.length > 0 ? metaSpend / metaRows.length : null,
    revenue,
  };
};

/* Transfers stay countable after the lead moves on, so they read off the
   assignment history rather than the current stage. */
export const countTransferred = (leadRows: any[]) =>
  leadRows.filter((lead) =>
    Array.isArray(lead?.assignmentHistory) && lead.assignmentHistory.some((entry: any) => entry?.action === "MANUAL_TRANSFER"),
  ).length;

export type StatRow = { key: string; value: string; delta?: Delta; detail: string };

export const buildStatRows = (summary: Summary, previous: Summary): StatRow[] => {
  const leadsDelta = formatSignedDelta(summary.received, previous.received);
  const conversionDelta = formatSignedDelta(summary.conversion, previous.conversion, { suffix: "pt" });
  const daysDelta = formatSignedDelta(summary.avgDaysToClose, previous.avgDaysToClose, { suffix: " days", inverse: true });
  const revenueDelta = formatSignedDelta(summary.revenue, previous.revenue);
  return [
    { key: "Leads received", value: String(summary.received), delta: leadsDelta, detail: "vs previous period" },
    { key: "Conversion", value: formatPercent(summary.conversion, 1), delta: conversionDelta, detail: "vs previous period" },
    {
      key: "Avg. days to close",
      value: String(Math.round(summary.avgDaysToClose)),
      delta: daysDelta,
      detail: daysDelta.tone === "down" ? "slower" : "faster",
    },
    {
      key: "Cost per lead",
      value: summary.costPerLead === null ? "-" : formatCurrencyCompact(summary.costPerLead),
      detail: "Meta campaigns only",
    },
    { key: "Revenue", value: formatCurrencyCompact(summary.revenue), delta: revenueDelta, detail: "vs previous period" },
  ];
};

export const buildMonthlyBars = (leads: any[], now = new Date()) => {
  const months = Array.from({ length: 6 }, (_, index) => new Date(now.getFullYear(), now.getMonth() - 5 + index, 1));
  const rows = months.map((month) => {
    const start = new Date(month.getFullYear(), month.getMonth(), 1);
    const end = endOfDay(new Date(month.getFullYear(), month.getMonth() + 1, 0));
    const inMonth = leads.filter((lead) => isInRange(getLeadRangeDate(lead), { start, end }));
    return {
      label: month.toLocaleString("en-IN", { month: "short" }),
      leads: inMonth.length,
      closed: inMonth.filter((lead) => upper(lead.status) === "CLOSED").length,
    };
  });
  const max = Math.max(...rows.map((row) => row.leads), 1);
  return rows.map((row) => ({
    ...row,
    leadHeight: Math.max(8, Math.round((row.leads / max) * 100)),
    closedHeight: Math.max(6, Math.round((row.closed / max) * 100)),
  }));
};

export const buildSourceMix = (leadRows: any[]) => {
  const rows = new Map<string, number>();
  leadRows.forEach((lead) => {
    const source = String(lead.source || "OTHER").trim().toUpperCase();
    const label = source === "META" ? "Meta ads" : source === "MANUAL" ? "Manual entry" : source || "Other";
    rows.set(label, (rows.get(label) || 0) + 1);
  });
  const total = [...rows.values()].reduce((sum, value) => sum + value, 0);
  return [...rows.entries()].map(([label, count]) => ({
    label,
    count,
    share: total > 0 ? Math.round((count / total) * 100) : 0,
  }));
};

export type ExecutiveRow = { key: string; name: string; leads: number; visits: number; closed: number; conversion: number };

export const buildExecutiveRows = (leadRows: any[]): ExecutiveRow[] => {
  const rows = new Map<string, Omit<ExecutiveRow, "conversion">>();
  leadRows.forEach((lead) => {
    const assignee = lead.assignedTo || lead.assignedExecutive || lead.createdBy;
    const key = String(assignee?._id || assignee?.email || "unassigned");
    const name = assignee?.name || "Unassigned";
    const current = rows.get(key) || { key, name, leads: 0, visits: 0, closed: 0 };
    const status = upper(lead.status);
    current.leads += 1;
    if (SITE_VISIT_STATUSES.has(status)) current.visits += 1;
    if (status === "CLOSED") current.closed += 1;
    rows.set(key, current);
  });
  return [...rows.values()]
    .map((row) => ({ ...row, conversion: row.leads > 0 ? (row.closed / row.leads) * 100 : 0 }))
    .sort((left, right) => right.closed - left.closed || right.visits - left.visits || right.leads - left.leads)
    .slice(0, 5);
};

export const buildLostRows = (leadRows: any[]) => {
  const rows = new Map<string, number>();
  leadRows.forEach((lead) => {
    const label = LOST_REASON_LABELS[upper(lead.status)];
    if (!label) return;
    rows.set(label, (rows.get(label) || 0) + 1);
  });
  const list = [...rows.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 5);
  const max = Math.max(...list.map((row) => row.count), 1);
  return list.map((row) => ({ ...row, width: Math.max(8, Math.round((row.count / max) * 100)) }));
};

const toCsvValue = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;

/* Web's "Export CSV", row for row. */
export const buildIntelligenceCsv = ({
  summary,
  transferred,
  executives,
  lost,
}: {
  summary: Summary;
  transferred: number;
  executives: ExecutiveRow[];
  lost: Array<{ label: string; count: number }>;
}) => {
  const rows: unknown[][] = [
    ["Section", "Metric", "Value"],
    ["Summary", "Leads received", summary.received],
    ["Summary", "Transferred leads", transferred],
    ["Summary", "Conversion", formatPercent(summary.conversion, 1)],
    ["Summary", "Avg. days to close", Math.round(summary.avgDaysToClose)],
    ["Summary", "Cost per lead", summary.costPerLead === null ? "" : Math.round(summary.costPerLead)],
    ["Summary", "Revenue", summary.revenue],
    ...executives.map((row) => [
      "Executive performance",
      row.name,
      `${row.leads} leads, ${row.visits} visits, ${row.closed} closed, ${formatPercent(row.conversion, 1)}`,
    ]),
    ...lost.map((row) => ["Where leads are lost", row.label, row.count]),
  ];
  return rows.map((row) => row.map(toCsvValue).join(",")).join("\n");
};
