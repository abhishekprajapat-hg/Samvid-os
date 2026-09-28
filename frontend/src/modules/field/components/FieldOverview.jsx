import { createElement, useMemo, useState } from "react";
import {
  Activity, ArrowRight, CalendarDays, Check, CircleCheck, CircleX, ClipboardList,
  Handshake, IndianRupee, MapPin, RefreshCw, Sparkles, Users,
} from "lucide-react";
import {
  buildConversionOverview,
  buildFieldExecutiveMetrics,
  buildWeeklyPipeline,
  getRecentFieldActivity,
  getTodayTasks,
  getUpcomingSiteVisits,
} from "../fieldDashboardData";
import "./FieldOverview.css";

const numberFormat = new Intl.NumberFormat("en-IN");
const moneyFormat = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const timeFormat = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit" });
const dayFormat = new Intl.DateTimeFormat("en-IN", { day: "2-digit" });
const monthFormat = new Intl.DateTimeFormat("en-IN", { month: "short" });

const formatMoney = (value) => `Rs ${moneyFormat.format(Number(value) || 0)}`;
const formatTime = (value) => timeFormat.format(new Date(value));
const titleCase = (value) => String(value || "").replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());

const relativeTime = (date) => {
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  return `${Math.floor(minutes / 1440)}d ago`;
};

const insightFor = (conversion, metrics) => {
  if (!metrics.leadsAssigned) return "Your assigned pipeline is empty. New leads will appear here as soon as they are assigned.";
  if (!conversion.total) return "No leads were created in this period. Change the time range to review an earlier cohort.";
  if (conversion.leakagePercent >= 30) return "Lead loss is high in this period. Review qualification and follow-up timing.";
  if (conversion.engagedPercent < 35) return "Many recent leads are still new. Prioritize first contact to build engagement.";
  if (metrics.siteVisitsScheduled < Math.max(1, Math.round(metrics.activeClients * 0.1))) return "The active pipeline is larger than the visit queue. Schedule visits for qualified clients.";
  if (conversion.closePercent >= 25) return "Recent leads are converting well. Keep follow-ups and site visits moving.";
  return "Keep contacted leads moving toward visits and negotiations to improve conversion.";
};

const STAT_CARDS = [
  { key: "leadsAssigned", title: "Leads Assigned", hint: "Assigned to me", icon: Users, tone: "blue", page: "leads" },
  { key: "activeClients", title: "Active Clients", hint: "Open field pipeline", icon: ClipboardList, tone: "violet", page: "leads" },
  { key: "siteVisitsScheduled", title: "Site Visits Scheduled", hint: "Visit required or active", icon: MapPin, tone: "orange", page: "calendar" },
  { key: "ongoingNegotiations", title: "Ongoing Negotiations", hint: "Interested / requested", icon: Handshake, tone: "rose", page: "leads" },
  { key: "dealsClosed", title: "Deals Closed", hint: "Won deals", icon: CircleCheck, tone: "green", page: "leads" },
  { key: "dealsLost", title: "Deals Lost", hint: "Lost opportunities", icon: CircleX, tone: "red", page: "leads" },
  { key: "revenueGenerated", title: "Revenue Generated", hint: "Closed brokerage", icon: IndianRupee, tone: "indigo", page: "leads" },
];

const PIPELINE_STAGES = [
  { key: "created", label: "Created", color: "#70b5ff" },
  { key: "contacted", label: "Contacted", color: "#4f7bf5" },
  { key: "interested", label: "Interested", color: "#ffae58" },
  { key: "closed", label: "Closed", color: "#42c789" },
  { key: "lost", label: "Lost", color: "#fb7185" },
];

const FieldOverview = ({ userId, leads, tasks, loading, error, savingTaskId, onRefresh, onCompleteTask, onOpen }) => {
  const [trendWeeks, setTrendWeeks] = useState(8);
  const [conversionWeeks, setConversionWeeks] = useState(3);
  const metrics = useMemo(() => buildFieldExecutiveMetrics(leads), [leads]);
  const trend = useMemo(() => buildWeeklyPipeline(leads, trendWeeks), [leads, trendWeeks]);
  const conversion = useMemo(() => buildConversionOverview(leads, conversionWeeks), [leads, conversionWeeks]);
  const todayTasks = useMemo(() => getTodayTasks(tasks, userId), [tasks, userId]);
  const upcomingVisits = useMemo(() => getUpcomingSiteVisits(leads), [leads]);
  const activity = useMemo(() => getRecentFieldActivity(leads, tasks), [leads, tasks]);
  const maxTrend = Math.max(1, ...trend.map((week) => week.total));
  const axisMax = Math.max(5, Math.ceil(maxTrend / 5) * 5);
  const donutClosed = conversion.total ? (conversion.closed / conversion.total) * 360 : 0;
  const donutActive = conversion.total ? (conversion.active / conversion.total) * 360 : 0;
  const donutLost = conversion.total ? (conversion.lost / conversion.total) * 360 : 0;

  return (
    <main className="field-home custom-scrollbar">
      {error ? (
        <div className="field-home-error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={onRefresh}><RefreshCw size={14} /> Retry</button>
        </div>
      ) : null}

      <section className="field-home-stats" aria-label="Field executive summary">
        {STAT_CARDS.map(({ key, title, hint, icon, tone, page }) => (
          <button key={key} type="button" className={`field-home-stat field-home-stat-${tone}`} onClick={() => onOpen(page)}>
            <span className="field-home-stat-icon">{createElement(icon, { size: 23, strokeWidth: 2.4 })}</span>
            <span className="field-home-stat-copy">
              <span className="field-home-stat-title">{title}</span>
              <strong>{loading ? "…" : key === "revenueGenerated" ? formatMoney(metrics[key]) : numberFormat.format(metrics[key])}</strong>
              <span className="field-home-stat-hint">{hint}</span>
            </span>
          </button>
        ))}
      </section>

      <div className="field-home-analytics">
        <section className="field-home-panel field-home-pipeline">
          <div className="field-home-panel-head">
            <div><h2>Pipeline Performance</h2><p>Track how your assigned pipeline is moving through stages</p></div>
            <div className="field-home-panel-controls">
              <span className="field-home-select field-home-scope">Assigned to Me</span>
              <select aria-label="Pipeline time range" className="field-home-select" value={trendWeeks} onChange={(event) => setTrendWeeks(Number(event.target.value))}>
                <option value={4}>Last 4 Weeks</option><option value={8}>Last 8 Weeks</option><option value={12}>Last 12 Weeks</option>
              </select>
            </div>
          </div>
          <div className="field-home-chart" role="img" aria-label={`Lead counts by creation week for the last ${trendWeeks} weeks`}>
            <div className="field-home-chart-axis">{[axisMax, Math.round(axisMax * 0.75), Math.round(axisMax * 0.5), Math.round(axisMax * 0.25), 0].map((value, index) => <span key={index}>{value}</span>)}</div>
            <div className="field-home-chart-plot">
              <div className="field-home-chart-grid"><i /><i /><i /><i /><i /></div>
              <div className="field-home-chart-bars">
                {trend.map((week, index) => (
                  <div className="field-home-chart-column" key={`${week.label}-${index}`} title={`${week.label}: ${week.total} leads`}>
                    <div className="field-home-chart-stack" style={{ height: `${(week.total / axisMax) * 100}%` }}>
                      {PIPELINE_STAGES.map((stage) => week[stage.key] ? <span key={stage.key} style={{ height: `${(week[stage.key] / week.total) * 100}%`, backgroundColor: stage.color }} /> : null)}
                    </div>
                    <span className="field-home-chart-label">{week.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="field-home-chart-legend">{PIPELINE_STAGES.map((stage) => <span key={stage.key}><i style={{ backgroundColor: stage.color }} />{stage.label}</span>)}</div>
          <p className="field-home-chart-note">Each bar groups leads by creation week and current stage.</p>
        </section>

        <section className="field-home-panel field-home-conversion">
          <div className="field-home-panel-head">
            <div><h2>Conversion Overview</h2></div>
            <select aria-label="Conversion time range" className="field-home-select" value={conversionWeeks} onChange={(event) => setConversionWeeks(Number(event.target.value))}>
              <option value={3}>Last 3 Weeks</option><option value={6}>Last 6 Weeks</option><option value={12}>Last 12 Weeks</option>
            </select>
          </div>
          <div className="field-home-conversion-body">
            <div className="field-home-donut" style={{ background: `conic-gradient(#49c789 0deg ${donutClosed}deg, #6daeff ${donutClosed}deg ${donutClosed + donutActive}deg, #ffc88d ${donutClosed + donutActive}deg ${donutClosed + donutActive + donutLost}deg, #e8edf6 ${donutClosed + donutActive + donutLost}deg 360deg)` }}>
              <div><strong>{conversion.closePercent}%</strong><span>Close rate</span></div>
            </div>
            <div className="field-home-conversion-list">
              <div className="field-home-conversion-row field-home-row-blue"><Users size={16} /><span>Total</span><strong>{loading ? "…" : numberFormat.format(conversion.total)}</strong></div>
              <div className="field-home-conversion-row field-home-row-violet"><Activity size={16} /><span>Active</span><strong>{loading ? "…" : numberFormat.format(conversion.active)}</strong></div>
              <div className="field-home-conversion-row field-home-row-green"><CircleCheck size={16} /><span>Engaged</span><strong>{loading ? "…" : `${conversion.engagedPercent}%`}</strong></div>
              <div className="field-home-conversion-row field-home-row-rose"><CircleX size={16} /><span>Leakage</span><strong>{loading ? "…" : `${conversion.leakagePercent}%`}</strong></div>
            </div>
          </div>
          <div className="field-home-insight"><Sparkles size={18} /><div><strong>Insight</strong><p>{loading ? "Analyzing your assigned leads…" : insightFor(conversion, metrics)}</p></div></div>
        </section>
      </div>

      <div className="field-home-lower">
        <section className="field-home-panel field-home-list-panel">
          <div className="field-home-panel-head"><h2>Today's Tasks</h2><button type="button" onClick={() => onOpen("tasks")}>View All</button></div>
          {loading ? <p className="field-home-empty">Loading tasks…</p> : todayTasks.length ? (
            <div className="field-home-task-list">{todayTasks.slice(0, 4).map((task) => (
              <div className="field-home-task-row" key={task._id}>
                <button type="button" className={`field-home-task-check ${task.status === "COMPLETED" ? "is-complete" : ""}`} aria-label={task.status === "COMPLETED" ? `${task.title} completed` : `Complete ${task.title}`} disabled={task.status === "COMPLETED" || savingTaskId === String(task._id)} onClick={() => onCompleteTask(task._id)}>{task.status === "COMPLETED" ? <Check size={14} /> : null}</button>
                <button type="button" className="field-home-task-name" onClick={() => onOpen("task", task._id)}>{task.title}</button>
                <time dateTime={task.dueDate}>{formatTime(task.dueDate)}</time>
                <span className={`field-home-task-tag ${task.status === "COMPLETED" ? "is-complete" : ""}`}>{task.status === "COMPLETED" ? "Done" : titleCase(task.status || "TODO")}</span>
              </div>
            ))}</div>
          ) : <p className="field-home-empty">No tasks due today.</p>}
        </section>

        <section className="field-home-panel field-home-list-panel">
          <div className="field-home-panel-head"><h2>Upcoming Site Visits</h2><button type="button" onClick={() => onOpen("leads")}>View All</button></div>
          {loading ? <p className="field-home-empty">Loading visits…</p> : upcomingVisits.length ? (
            <div className="field-home-visit-list">{upcomingVisits.slice(0, 3).map((lead) => {
              const date = new Date(lead.nextFollowUp);
              return <button type="button" className="field-home-visit-row" key={lead._id} onClick={() => onOpen("lead", lead._id)}>
                <span className="field-home-visit-date"><strong>{dayFormat.format(date)}</strong><small>{monthFormat.format(date)}</small></span>
                <MapPin size={16} className="field-home-visit-pin" />
                <span className="field-home-visit-copy"><strong>{lead.name || "Site visit"}</strong><small>{lead.projectInterested || lead.preferredLocations || lead.city || "Location not set"}</small></span>
                <time dateTime={lead.nextFollowUp}>{formatTime(date)}</time><ArrowRight size={15} />
              </button>;
            })}</div>
          ) : <p className="field-home-empty">No dated site visits scheduled.</p>}
        </section>

        <section className="field-home-panel field-home-list-panel">
          <div className="field-home-panel-head"><h2>Recent Activity</h2><button type="button" onClick={() => onOpen("leads")}>View All</button></div>
          {loading ? <p className="field-home-empty">Loading activity…</p> : activity.length ? (
            <div className="field-home-activity-list">{activity.map((entry) => (
              <button type="button" className="field-home-activity-row" key={entry.id} onClick={() => onOpen(entry.leadId ? "lead" : "task", entry.leadId || entry.taskId)}>
                <span className={`field-home-activity-icon field-home-activity-${entry.type}`}>{entry.type === "complete" ? <Check size={15} /> : entry.type === "task" ? <ClipboardList size={15} /> : <Users size={15} />}</span>
                <span className="field-home-activity-copy"><strong>{entry.title}</strong><small>{entry.detail}</small></span>
                <time dateTime={entry.at.toISOString()}>{relativeTime(entry.at)}</time>
              </button>
            ))}</div>
          ) : <p className="field-home-empty">No recent lead or task activity.</p>}
        </section>
      </div>
      <p className="field-home-footnote"><CalendarDays size={13} /> Dashboard figures use all leads visible to your Field Executive account, not just the first page.</p>
    </main>
  );
};

export default FieldOverview;
