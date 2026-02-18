import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowUpRight,
  CalendarClock,
  Clock3,
  MapPin,
  RefreshCw,
  Route,
  UserRound,
  Users,
} from "lucide-react";
import { getAllLeads } from "../../services/leadService";
import { getUsers } from "../../services/userService";
import { toErrorMessage } from "../../utils/errorMessage";

const ACTIVE_STATUSES = new Set(["NEW", "CONTACTED", "INTERESTED", "SITE_VISIT"]);
const VISIT_STATUS = "SITE_VISIT";

const toDate = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const isSameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const getLeadStatusLabel = (status) => {
  switch (String(status || "")) {
    case "NEW":
      return "New";
    case "CONTACTED":
      return "Contacted";
    case "INTERESTED":
      return "Interested";
    case "SITE_VISIT":
      return "Site Visit";
    case "CLOSED":
      return "Closed";
    case "LOST":
      return "Lost";
    default:
      return "Unknown";
  }
};

const formatDateTime = (value) => {
  const parsed = toDate(value);
  if (!parsed) return "-";
  return parsed.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const getExecutiveFromLead = (lead) => {
  if (lead?.assignedFieldExecutive?._id) {
    return lead.assignedFieldExecutive;
  }
  if (lead?.assignedTo?.role === "FIELD_EXECUTIVE") {
    return lead.assignedTo;
  }
  return null;
};

const getPinPosition = (seedText) => {
  const text = String(seedText || "0");
  let hash = 0;

  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  }

  const absHash = Math.abs(hash);
  const top = 15 + (absHash % 70);
  const left = 8 + ((absHash * 7) % 84);
  return { top, left };
};

const FieldOps = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [leads, setLeads] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedExecutiveId, setSelectedExecutiveId] = useState("");

  const loadFieldOps = useCallback(async (silent = false) => {
    try {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");
      const [leadRows, userPayload] = await Promise.all([getAllLeads(), getUsers()]);
      const userRows = userPayload?.users || [];

      setLeads(Array.isArray(leadRows) ? leadRows : []);
      setUsers(Array.isArray(userRows) ? userRows : []);
    } catch (fetchError) {
      setError(toErrorMessage(fetchError, "Failed to load field operations"));
      setLeads([]);
      setUsers([]);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFieldOps(false);
  }, [loadFieldOps]);

  const dashboard = useMemo(() => {
    const now = new Date();
    const fieldExecutives = users.filter(
      (user) => user.role === "FIELD_EXECUTIVE" && user.isActive !== false,
    );

    const activeLeads = leads.filter((lead) => ACTIVE_STATUSES.has(String(lead.status || "")));
    const siteVisitLeads = activeLeads.filter((lead) => String(lead.status || "") === VISIT_STATUS);
    const unassignedQueue = activeLeads.filter((lead) => !lead.assignedTo?._id);

    const overdueFollowUps = activeLeads.filter((lead) => {
      const followUp = toDate(lead.nextFollowUp);
      return followUp && followUp < now;
    });

    const leadRowsByExecutive = new Map();
    activeLeads.forEach((lead) => {
      const executive = getExecutiveFromLead(lead);
      if (!executive?._id) return;

      const key = String(executive._id);
      if (!leadRowsByExecutive.has(key)) {
        leadRowsByExecutive.set(key, []);
      }
      leadRowsByExecutive.get(key).push(lead);
    });

    const executiveStats = fieldExecutives
      .map((executive) => {
        const assignedRows = leadRowsByExecutive.get(String(executive._id)) || [];

        const siteVisits = assignedRows.filter(
          (lead) => String(lead.status || "") === VISIT_STATUS,
        ).length;

        const overdue = assignedRows.filter((lead) => {
          const followUp = toDate(lead.nextFollowUp);
          return followUp && followUp < now;
        }).length;

        const todaysVisits = assignedRows.filter((lead) => {
          if (String(lead.status || "") !== VISIT_STATUS) return false;
          const followUp = toDate(lead.nextFollowUp);
          return followUp ? isSameDay(followUp, now) : false;
        }).length;

        return {
          executive,
          activeAssigned: assignedRows.length,
          siteVisits,
          overdue,
          todaysVisits,
          assignedRows: assignedRows.sort((a, b) => {
            const aDate = toDate(a.nextFollowUp) || toDate(a.createdAt) || new Date(0);
            const bDate = toDate(b.nextFollowUp) || toDate(b.createdAt) || new Date(0);
            return aDate - bDate;
          }),
        };
      })
      .sort((a, b) => b.siteVisits - a.siteVisits || b.activeAssigned - a.activeAssigned);

    const visitsTimeline = siteVisitLeads
      .map((lead) => ({
        ...lead,
        followUpDate: toDate(lead.nextFollowUp),
      }))
      .sort((a, b) => {
        const aDate = a.followUpDate || toDate(a.createdAt) || new Date(0);
        const bDate = b.followUpDate || toDate(b.createdAt) || new Date(0);
        return aDate - bDate;
      })
      .slice(0, 10);

    return {
      fieldExecutives,
      activeLeads,
      siteVisitLeads,
      unassignedQueue,
      overdueFollowUps,
      executiveStats,
      visitsTimeline,
    };
  }, [leads, users]);

  useEffect(() => {
    if (!dashboard.executiveStats.length) {
      setSelectedExecutiveId("");
      return;
    }

    const exists = dashboard.executiveStats.some(
      (item) => String(item.executive._id) === String(selectedExecutiveId),
    );

    if (!exists) {
      setSelectedExecutiveId(String(dashboard.executiveStats[0].executive._id));
    }
  }, [dashboard.executiveStats, selectedExecutiveId]);

  const selectedExecutive = useMemo(
    () =>
      dashboard.executiveStats.find(
        (item) => String(item.executive._id) === String(selectedExecutiveId),
      ) || null,
    [dashboard.executiveStats, selectedExecutiveId],
  );

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center gap-2 text-sm text-slate-500">
        <RefreshCw size={16} className="animate-spin" />
        Loading field operations...
      </div>
    );
  }

  return (
    <div className="w-full h-full px-4 sm:px-6 lg:px-8 py-6 space-y-6 overflow-y-auto custom-scrollbar">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Field Operations</h1>
          <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">
            Live coordination for visit teams and queue dispatch
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => loadFieldOps(true)}
            disabled={refreshing}
            className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:border-slate-400 disabled:opacity-60 inline-flex items-center gap-2"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => navigate("/leads")}
            className="h-9 rounded-lg border border-slate-900 bg-slate-900 px-3 text-xs font-semibold text-white hover:bg-slate-800 inline-flex items-center gap-2"
          >
            Open Leads
            <ArrowUpRight size={14} />
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Active Field Executives"
          value={dashboard.fieldExecutives.length}
          helper="Users available for field assignments"
          icon={Users}
        />
        <StatCard
          title="Site Visits In Pipeline"
          value={dashboard.siteVisitLeads.length}
          helper="Active leads currently at site visit stage"
          icon={MapPin}
        />
        <StatCard
          title="Overdue Follow-ups"
          value={dashboard.overdueFollowUps.length}
          helper="Requires immediate action from field team"
          icon={Clock3}
        />
        <StatCard
          title="Dispatch Queue"
          value={dashboard.unassignedQueue.length}
          helper="Active leads without executive assignment"
          icon={Route}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.4fr_1fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-600">
              Executive Coverage Grid
            </h2>
            <span className="text-xs text-slate-500">
              {dashboard.fieldExecutives.length} executives online
            </span>
          </div>

          {dashboard.executiveStats.length === 0 ? (
            <EmptyState text="No active field executives found for your access scope." />
          ) : (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="relative h-[340px] overflow-hidden rounded-lg border border-slate-200 bg-[linear-gradient(90deg,rgba(148,163,184,0.16)_1px,transparent_1px),linear-gradient(0deg,rgba(148,163,184,0.16)_1px,transparent_1px)] bg-[size:32px_32px]">
                {dashboard.executiveStats.map((row) => {
                  const id = String(row.executive._id);
                  const active = id === String(selectedExecutiveId);
                  const pin = getPinPosition(id);

                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setSelectedExecutiveId(id)}
                      className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-lg border px-2 py-1 text-left transition-shadow ${
                        active
                          ? "border-slate-900 bg-slate-900 text-white shadow-lg"
                          : "border-slate-300 bg-white text-slate-700 hover:border-slate-500"
                      }`}
                      style={{ top: `${pin.top}%`, left: `${pin.left}%` }}
                    >
                      <div className="flex items-center gap-2">
                        <MapPin size={14} />
                        <span className="text-xs font-semibold">{row.executive.name || "Executive"}</span>
                      </div>
                      <p className={`mt-1 text-[11px] ${active ? "text-slate-200" : "text-slate-500"}`}>
                        {row.activeAssigned} active | {row.siteVisits} visits
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-600">
            Executive Task Queue
          </h2>

          {!selectedExecutive ? (
            <EmptyState text="Select an executive from coverage grid to inspect assignments." />
          ) : (
            <>
              <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {selectedExecutive.executive.name || "Unnamed executive"}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {selectedExecutive.executive.email || selectedExecutive.executive.phone || "-"}
                    </p>
                  </div>
                  <span className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-700">
                    FIELD_EXECUTIVE
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <MiniStat label="Active" value={selectedExecutive.activeAssigned} />
                  <MiniStat label="Visits" value={selectedExecutive.siteVisits} />
                  <MiniStat label="Overdue" value={selectedExecutive.overdue} />
                </div>
              </div>

              <div className="mt-3 space-y-2">
                {selectedExecutive.assignedRows.length === 0 ? (
                  <EmptyState text="No active leads assigned to this executive." />
                ) : (
                  selectedExecutive.assignedRows.slice(0, 8).map((lead) => (
                    <div key={lead._id} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-slate-800">{lead.name || "-"}</p>
                          <p className="text-xs text-slate-500">
                            {lead.projectInterested || "Project not set"}
                          </p>
                        </div>
                        <StatusBadge status={lead.status} />
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        Next follow-up: {formatDateTime(lead.nextFollowUp)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </section>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-600">
            Dispatch Queue (Unassigned)
          </h2>
          {dashboard.unassignedQueue.length === 0 ? (
            <EmptyState text="No unassigned active leads in queue." />
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-slate-500">
                    <th className="py-2 pr-3">Lead</th>
                    <th className="py-2 pr-3">Project</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2">Follow-up</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.unassignedQueue.slice(0, 12).map((lead) => (
                    <tr key={lead._id} className="border-t border-slate-100">
                      <td className="py-2 pr-3 text-slate-800">
                        <p className="font-medium">{lead.name || "-"}</p>
                        <p className="text-xs text-slate-500">{lead.phone || "-"}</p>
                      </td>
                      <td className="py-2 pr-3 text-slate-700">{lead.projectInterested || "-"}</td>
                      <td className="py-2 pr-3">
                        <StatusBadge status={lead.status} />
                      </td>
                      <td className="py-2 text-slate-600">{formatDateTime(lead.nextFollowUp)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-600">
            Upcoming Site Visits
          </h2>
          {dashboard.visitsTimeline.length === 0 ? (
            <EmptyState text="No site-visit leads in current active pipeline." />
          ) : (
            <div className="mt-3 space-y-2">
              {dashboard.visitsTimeline.map((lead) => (
                <div key={lead._id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{lead.name || "-"}</p>
                      <p className="text-xs text-slate-500">
                        {lead.assignedTo?.name || "Unassigned"} | {lead.projectInterested || "Project not set"}
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-slate-600">
                      {formatDateTime(lead.nextFollowUp || lead.createdAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-600">
          Field Executive Workload
        </h2>
        {dashboard.executiveStats.length === 0 ? (
          <EmptyState text="No executive workload data available." />
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-slate-500">
                  <th className="py-2 pr-3">Executive</th>
                  <th className="py-2 pr-3">Active Leads</th>
                  <th className="py-2 pr-3">Site Visits</th>
                  <th className="py-2 pr-3">Today Visits</th>
                  <th className="py-2 pr-3">Overdue</th>
                  <th className="py-2">Last Assigned</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.executiveStats.map((row) => (
                  <tr
                    key={row.executive._id}
                    className={`border-t border-slate-100 ${
                      String(row.executive._id) === String(selectedExecutiveId) ? "bg-slate-50" : ""
                    }`}
                  >
                    <td className="py-2 pr-3 text-slate-800">
                      <button
                        type="button"
                        onClick={() => setSelectedExecutiveId(String(row.executive._id))}
                        className="inline-flex items-center gap-2 text-left hover:text-slate-900"
                      >
                        <UserRound size={14} />
                        <span className="font-medium">{row.executive.name || "-"}</span>
                      </button>
                    </td>
                    <td className="py-2 pr-3 text-slate-700">{row.activeAssigned}</td>
                    <td className="py-2 pr-3 text-slate-700">{row.siteVisits}</td>
                    <td className="py-2 pr-3 text-slate-700">{row.todaysVisits}</td>
                    <td className="py-2 pr-3 text-slate-700">{row.overdue}</td>
                    <td className="py-2 text-slate-600">{formatDateTime(row.executive.lastAssignedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

const StatCard = ({ title, value, helper, icon: Icon }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4">
    <div className="flex items-center justify-between gap-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{title}</p>
      <div className="rounded-lg bg-slate-100 p-2 text-slate-700">
        <Icon size={14} />
      </div>
    </div>
    <p className="mt-3 text-2xl font-semibold text-slate-900">{value}</p>
    <p className="mt-1 text-xs text-slate-500">{helper}</p>
  </div>
);

const MiniStat = ({ label, value }) => (
  <div className="rounded-md border border-slate-200 bg-white px-2 py-1.5">
    <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">{label}</p>
    <p className="mt-0.5 text-sm font-semibold text-slate-900">{value}</p>
  </div>
);

const StatusBadge = ({ status }) => {
  const normalized = String(status || "");
  const label = getLeadStatusLabel(normalized);

  let classes = "border-slate-300 bg-slate-100 text-slate-700";
  if (normalized === "SITE_VISIT") classes = "border-indigo-200 bg-indigo-50 text-indigo-700";
  else if (normalized === "INTERESTED") classes = "border-amber-200 bg-amber-50 text-amber-700";
  else if (normalized === "CONTACTED") classes = "border-sky-200 bg-sky-50 text-sky-700";
  else if (normalized === "NEW") classes = "border-slate-300 bg-slate-100 text-slate-700";
  else if (normalized === "CLOSED") classes = "border-emerald-200 bg-emerald-50 text-emerald-700";
  else if (normalized === "LOST") classes = "border-rose-200 bg-rose-50 text-rose-700";

  return (
    <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold uppercase ${classes}`}>
      {label}
    </span>
  );
};

const EmptyState = ({ text }) => (
  <div className="mt-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
    <CalendarClock size={16} className="mx-auto mb-2 text-slate-400" />
    {text}
  </div>
);

export default FieldOps;
