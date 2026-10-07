const CLOSED_STATUSES = new Set(["CLOSED", "LOST", "INVALID"]);
const VISIT_STATUSES = new Set(["SITE_VISIT_SCHEDULED", "SITE_VISIT", "SITE_VISIT_OVERDUE"]);
const NEGOTIATION_STATUSES = new Set(["INTERESTED", "REQUESTED"]);
const CONTACTED_STATUSES = new Set(["CONTACTED", "FOLLOW_UP_1", "FOLLOW_UP_2", "FOLLOW_UP_3", "NOT_PICKING_CALLS"]);

export const normalizeLeadStatus = (value) => String(value || "").trim().toUpperCase();

export const referenceId = (value) => String(value?._id || value?.id || value || "").trim();

export const parseDashboardDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const buildFieldExecutiveMetrics = (leads = []) => {
  const rows = Array.isArray(leads) ? leads : [];
  return rows.reduce((metrics, lead) => {
    const status = normalizeLeadStatus(lead?.status);
    metrics.leadsAssigned += 1;
    if (!CLOSED_STATUSES.has(status)) metrics.activeClients += 1;
    if (VISIT_STATUSES.has(status)) metrics.siteVisitsScheduled += 1;
    if (NEGOTIATION_STATUSES.has(status)) metrics.ongoingNegotiations += 1;
    if (status === "CLOSED") {
      metrics.dealsClosed += 1;
      metrics.revenueGenerated += Math.max(0, Number(lead?.brokerageReceived) || 0);
    }
    if (status === "LOST") metrics.dealsLost += 1;
    return metrics;
  }, {
    leadsAssigned: 0,
    activeClients: 0,
    siteVisitsScheduled: 0,
    ongoingNegotiations: 0,
    dealsClosed: 0,
    dealsLost: 0,
    revenueGenerated: 0,
  });
};

const startOfWeek = (value) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return date;
};

export const buildWeeklyPipeline = (leads = [], weekCount = 8, now = new Date()) => {
  const count = Math.max(1, Number(weekCount) || 8);
  const thisWeek = startOfWeek(now);
  const firstWeek = new Date(thisWeek);
  firstWeek.setDate(firstWeek.getDate() - 7 * (count - 1));
  const labelFormat = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" });
  const weeks = Array.from({ length: count }, (_, index) => {
    const start = new Date(firstWeek);
    start.setDate(start.getDate() + index * 7);
    return { label: labelFormat.format(start), start, created: 0, contacted: 0, interested: 0, closed: 0, lost: 0, total: 0 };
  });

  for (const lead of leads) {
    const created = parseDashboardDate(lead?.createdAt);
    if (!created || created < firstWeek || created > now) continue;
    const index = Math.floor((startOfWeek(created).getTime() - firstWeek.getTime()) / (7 * 24 * 60 * 60 * 1000));
    const week = weeks[index];
    if (!week) continue;
    const status = normalizeLeadStatus(lead?.status);
    const stage = status === "CLOSED" ? "closed"
      : status === "LOST" ? "lost"
        : NEGOTIATION_STATUSES.has(status) || VISIT_STATUSES.has(status) ? "interested"
          : CONTACTED_STATUSES.has(status) ? "contacted" : "created";
    week[stage] += 1;
    week.total += 1;
  }
  return weeks;
};

export const buildConversionOverview = (leads = [], weekCount = 3, now = new Date()) => {
  const since = startOfWeek(now);
  since.setDate(since.getDate() - 7 * (Math.max(1, Number(weekCount) || 3) - 1));
  const rows = leads.filter((lead) => {
    const created = parseDashboardDate(lead?.createdAt);
    return created && created >= since && created <= now;
  });
  const total = rows.length;
  const closed = rows.filter((lead) => normalizeLeadStatus(lead?.status) === "CLOSED").length;
  const lost = rows.filter((lead) => normalizeLeadStatus(lead?.status) === "LOST").length;
  const active = rows.filter((lead) => !CLOSED_STATUSES.has(normalizeLeadStatus(lead?.status))).length;
  const engaged = rows.filter((lead) => {
    const status = normalizeLeadStatus(lead?.status);
    return status !== "NEW" && status !== "INVALID" && status !== "LOST";
  }).length;
  const percent = (value) => total ? Math.round((value / total) * 100) : 0;
  return { total, closed, lost, active, closePercent: percent(closed), engagedPercent: percent(engaged), leakagePercent: percent(lost) };
};

export const getTodayTasks = (tasks = [], userId = "", now = new Date()) => tasks
  .filter((task) => {
    const due = parseDashboardDate(task?.dueDate);
    if (!due || due.toDateString() !== now.toDateString()) return false;
    const assignee = referenceId(task?.assignedTo);
    return !userId || assignee === userId || (!assignee && referenceId(task?.createdBy) === userId);
  })
  .sort((a, b) => {
    const completedA = a?.status === "COMPLETED" ? 1 : 0;
    const completedB = b?.status === "COMPLETED" ? 1 : 0;
    return completedA - completedB || new Date(a.dueDate) - new Date(b.dueDate);
  });

export const getUpcomingSiteVisits = (leads = [], now = new Date()) => leads
  .filter((lead) => normalizeLeadStatus(lead?.status) === "SITE_VISIT_SCHEDULED")
  .filter((lead) => {
    const date = parseDashboardDate(lead?.nextFollowUp);
    return date && date >= now;
  })
  .sort((a, b) => new Date(a.nextFollowUp) - new Date(b.nextFollowUp));

export const getRecentFieldActivity = (leads = [], tasks = []) => {
  const entries = [];
  for (const lead of leads) {
    const name = String(lead?.name || "Lead").trim();
    const created = parseDashboardDate(lead?.createdAt);
    const updated = parseDashboardDate(lead?.updatedAt);
    if (created) entries.push({ id: `lead-created-${lead._id}`, type: "lead", title: "Lead added", detail: name, at: created, leadId: lead._id });
    if (updated && (!created || updated.getTime() - created.getTime() > 60_000)) {
      entries.push({ id: `lead-updated-${lead._id}`, type: "update", title: "Lead updated", detail: `${name} · ${String(lead?.status || "Updated").replaceAll("_", " ")}`, at: updated, leadId: lead._id });
    }
  }
  for (const task of tasks) {
    const updated = parseDashboardDate(task?.updatedAt);
    if (!updated) continue;
    entries.push({ id: `task-${task._id}`, type: task.status === "COMPLETED" ? "complete" : "task", title: "Task updated", detail: `${String(task.title || "Task")} · ${String(task.status || "Updated").replaceAll("_", " ")}`, at: updated, taskId: task._id });
  }
  return entries.sort((a, b) => b.at - a.at).slice(0, 5);
};
