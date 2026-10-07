/*
 * Pipeline filters, as query parameters.
 *
 * Web filters leads on the server rather than in the browser - LeadsMatrix.jsx
 * turns its filter state into query params and GET /leads does the work. Mobile
 * must do the same: filtering client-side would only ever filter the rows it
 * had already downloaded, which is both slower and wrong.
 *
 * The quick-filter date arithmetic mirrors LeadsMatrix.jsx (around line 1589)
 * and the parameter names match applyLeadListFilters in
 * backend/src/controllers/lead.controller.js.
 */

export const QUICK_FILTER_KEYS = {
  NEEDS_FOLLOW_UP_TODAY: "NEEDS_FOLLOW_UP_TODAY",
  OVERDUE_FOLLOW_UPS: "OVERDUE_FOLLOW_UPS",
  UNASSIGNED_LEADS: "UNASSIGNED_LEADS",
  NEW_THIS_WEEK: "NEW_THIS_WEEK",
} as const;

export type QuickFilterKey = (typeof QUICK_FILTER_KEYS)[keyof typeof QUICK_FILTER_KEYS];

export const QUICK_FILTERS: Array<{ key: QuickFilterKey; label: string }> = [
  { key: QUICK_FILTER_KEYS.NEEDS_FOLLOW_UP_TODAY, label: "Follow up today" },
  { key: QUICK_FILTER_KEYS.OVERDUE_FOLLOW_UPS, label: "Overdue" },
  { key: QUICK_FILTER_KEYS.UNASSIGNED_LEADS, label: "Unassigned" },
  { key: QUICK_FILTER_KEYS.NEW_THIS_WEEK, label: "New this week" },
];

/** The backend only recognises these two source values. */
export const SOURCE_OPTIONS = [
  { value: "", label: "Any source" },
  { value: "META", label: "Meta" },
  { value: "MANUAL", label: "Manual" },
];

export type LeadFilterState = {
  status: string;
  source: string;
  /** A user id, the literal "UNASSIGNED", or "" for any. */
  assignedTo: string;
  dateFrom: string;
  dateTo: string;
  followUpFrom: string;
  followUpTo: string;
  quickFilter: QuickFilterKey | "";
};

export const EMPTY_LEAD_FILTERS: LeadFilterState = {
  status: "",
  source: "",
  assignedTo: "",
  dateFrom: "",
  dateTo: "",
  followUpFrom: "",
  followUpTo: "",
  quickFilter: "",
};

/** YYYY-MM-DD for a day offset from a reference point. */
export const dateKeyOffset = (days: number, reference = Date.now()) => {
  const date = new Date(reference);
  date.setDate(date.getDate() + days);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
};

/*
 * A quick filter is a shortcut for a combination of the ordinary filters, so it
 * is expanded into them rather than being a parallel concept the server would
 * also have to understand.
 */
const applyQuickFilter = (
  filters: LeadFilterState,
  nowMs: number,
): Partial<LeadFilterState> => {
  switch (filters.quickFilter) {
    case QUICK_FILTER_KEYS.UNASSIGNED_LEADS:
      return { assignedTo: "UNASSIGNED" };

    case QUICK_FILTER_KEYS.NEW_THIS_WEEK:
      return { dateFrom: dateKeyOffset(-7, nowMs), dateTo: dateKeyOffset(0, nowMs) };

    case QUICK_FILTER_KEYS.NEEDS_FOLLOW_UP_TODAY:
      return { followUpFrom: dateKeyOffset(0, nowMs), followUpTo: dateKeyOffset(0, nowMs) };

    case QUICK_FILTER_KEYS.OVERDUE_FOLLOW_UPS:
      // Everything due up to and including yesterday.
      return { followUpTo: dateKeyOffset(-1, nowMs) };

    default:
      return {};
  }
};

/** Turns filter state into the query the lead list endpoint understands. */
export const toLeadQueryParams = (
  filters: LeadFilterState,
  nowMs = Date.now(),
): Record<string, string> => {
  const merged: LeadFilterState = { ...filters, ...applyQuickFilter(filters, nowMs) };
  const params: Record<string, string> = {};

  // "ALL" is the screen's word for no filter; the server would reject it.
  if (merged.status && merged.status !== "ALL") params.status = merged.status;
  if (merged.source) params.source = merged.source;
  if (merged.assignedTo) params.assignedTo = merged.assignedTo;
  if (merged.dateFrom) params.dateFrom = merged.dateFrom;
  if (merged.dateTo) params.dateTo = merged.dateTo;
  if (merged.followUpFrom) params.followUpFrom = merged.followUpFrom;
  if (merged.followUpTo) params.followUpTo = merged.followUpTo;

  return params;
};

/** How many filters are active, for the badge on the filter button. */
export const countActiveFilters = (filters: LeadFilterState) =>
  Object.entries(filters).filter(([key, value]) => {
    if (!value) return false;
    if (key === "status" && value === "ALL") return false;
    return true;
  }).length;

export const hasActiveFilters = (filters: LeadFilterState) => countActiveFilters(filters) > 0;
