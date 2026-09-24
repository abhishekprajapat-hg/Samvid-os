/**
 * View definitions and follow-up formatting for the pipeline screen.
 *
 * Kept out of the components so the "needs action" rule - the one that decides
 * what a salesperson sees first every morning - is in one readable place.
 */

export const PIPELINE_VIEWS = {
  NEEDS_ACTION: "NEEDS_ACTION",
  ALL: "ALL",
  TEAM: "TEAM",
  UNASSIGNED: "UNASSIGNED",
  CLOSED: "CLOSED",
};

/** Statuses that are out of the pipeline: nothing here is ever "needs action". */
export const TERMINAL_STATUSES = new Set(["CLOSED", "LOST", "INVALID"]);

export const startOfDayMs = (ms) => {
  const date = new Date(ms);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};

export const endOfDayMs = (ms) => startOfDayMs(ms) + 24 * 60 * 60 * 1000 - 1;

export const toMs = (value) => {
  if (!value) return 0;
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? 0 : ms;
};

/**
 * A lead needs action when it is still live and its follow-up is either in the
 * past or falls today. No follow-up date at all is not "needs action" - it is
 * unscheduled work, which the All view covers.
 */
export const isNeedsAction = (lead, nowMs) => {
  if (TERMINAL_STATUSES.has(String(lead?.status || ""))) return false;
  const followUpMs = toMs(lead?.nextFollowUp);
  if (!followUpMs) return false;
  return followUpMs <= endOfDayMs(nowMs);
};

export const isUnassigned = (lead) => !lead?.assignedTo?._id && !lead?.assignedTo?.name;

export const matchesView = (lead, view, nowMs) => {
  switch (view) {
    case PIPELINE_VIEWS.NEEDS_ACTION:
      return isNeedsAction(lead, nowMs);
    case PIPELINE_VIEWS.UNASSIGNED:
      return isUnassigned(lead);
    case PIPELINE_VIEWS.CLOSED:
      return String(lead?.status || "") === "CLOSED";
    case PIPELINE_VIEWS.ALL:
    case PIPELINE_VIEWS.TEAM:
    default:
      return true;
  }
};

export const countNeedsAction = (leads, nowMs) =>
  leads.reduce((total, lead) => (isNeedsAction(lead, nowMs) ? total + 1 : total), 0);

/**
 * How a follow-up date should read and colour in the table.
 * @returns {{ text: string, tone: "overdue"|"today"|"future"|"none" }}
 */
export const describeFollowUp = (value, nowMs) => {
  const followUpMs = toMs(value);
  if (!followUpMs) return { text: "—", tone: "none" };

  const today = startOfDayMs(nowMs);
  const day = startOfDayMs(followUpMs);

  if (day < today) {
    const daysLate = Math.round((today - day) / (24 * 60 * 60 * 1000));
    return { text: `${daysLate}d late`, tone: "overdue" };
  }

  if (day === today) {
    const time = new Date(followUpMs).toLocaleTimeString("en-IN", {
      hour: "numeric",
      minute: "2-digit",
    });
    return { text: `Today · ${time}`, tone: followUpMs <= nowMs ? "overdue" : "today" };
  }

  return {
    text: new Date(followUpMs).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
    tone: "future",
  };
};

export const formatBudgetShort = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return "";
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)} L`;
  if (amount >= 1000) return `₹${Math.round(amount / 1000)} K`;
  return `₹${amount}`;
};

export const formatBudgetRange = (requirements = {}) => {
  const min = formatBudgetShort(requirements?.budgetMin);
  const max = formatBudgetShort(requirements?.budgetMax);
  if (max) return max;
  if (min) return min;
  return "—";
};
