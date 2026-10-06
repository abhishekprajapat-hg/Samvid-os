import React, { useEffect, useMemo, useState } from "react";
import {
  Building2,
  Calendar,
  CheckCircle,
  Clock3,
  MessageSquare,
  Percent,
  PhoneCall,
  Send,
  Target,
  Users,
} from "lucide-react";
import AssetVault from "../inventory/AssetVault";
import LeadsMatrix from "../leads/LeadsMatrix";
import TeamChat from "../chat/TeamChat";
import MasterSchedule from "../calendar/MasterSchedule";
import Performance from "../reports/Performance";
import LeadPerformancePanel from "../../components/dashboard/LeadPerformancePanel";
import { getAllLeads, getLeadSummary } from "../../services/leadService";
import { toErrorMessage } from "../../utils/errorMessage";

const getStoredUserId = () => {
  try {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    return String(user?._id || user?.id || "").trim();
  } catch {
    return "";
  }
};

// Fields the overview needs for its lists and charts; counts come from the summary.
const DASHBOARD_LEAD_FIELDS = [
  "_id", "name", "phone", "status", "nextFollowUp", "lastContactedAt", "createdAt", "updatedAt",
].join(",");

// "Qualified" is the Interested stage; anything past it counts toward conversion.
const QUALIFIED_STATUSES = ["INTERESTED"];
const CONVERTED_STATUSES = [
  "INTERESTED", "SITE_VISIT_SCHEDULED", "SITE_VISIT", "SITE_VISIT_OVERDUE", "REQUESTED", "CLOSED",
];

const EMPTY_STATS = {
  totalLeadsAssigned: 0,
  pendingFirstCalls: 0,
  followUpsDue: 0,
  qualifiedLeads: 0,
  leadsTransferred: 0,
  conversionRatio: 0,
};

const sumStatuses = (byStatus = {}, statuses = []) =>
  statuses.reduce((sum, status) => sum + Number(byStatus?.[status] || 0), 0);

const buildInsideExecutiveMetrics = (summary) => {
  if (!summary) return EMPTY_STATS;
  const total = Number(summary.total || 0);
  const converted = sumStatuses(summary.byStatus, CONVERTED_STATUSES);
  return {
    totalLeadsAssigned: total,
    pendingFirstCalls: Number(summary.pendingFirstCalls || 0),
    followUpsDue: Number(summary.followUpsDue || 0),
    qualifiedLeads: sumStatuses(summary.byStatus, QUALIFIED_STATUSES),
    leadsTransferred: Number(summary.transferredOut || 0),
    conversionRatio: total ? Math.round((converted / total) * 100) : 0,
  };
};

const ExecutiveDashboard = () => {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [stats, setStats] = useState(EMPTY_STATS);
  const [summary, setSummary] = useState(null);
  const [leadRows, setLeadRows] = useState([]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const currentUserId = getStoredUserId();
        const scope = currentUserId ? { assignedTo: currentUserId } : {};
        // Counts come from the server over every lead; the list (all pages)
        // only feeds the follow-up list, recent activity and the chart.
        const [leadSummary, leads] = await Promise.all([
          getLeadSummary(scope),
          getAllLeads({ ...scope, fields: DASHBOARD_LEAD_FIELDS }),
        ]);
        setSummary(leadSummary);
        setLeadRows(Array.isArray(leads) ? leads : []);
        setStats(buildInsideExecutiveMetrics(leadSummary));
      } catch (error) {
        setSummary(null);
        setLeadRows([]);
        setStats(EMPTY_STATS);
        console.error("Executive stats error:", toErrorMessage(error, "Unknown error"));
      }
    };

    fetchStats();
  }, []);

  const renderContent = () => {
    if (activeTab === "dashboard") {
      return <ExecutiveOverview stats={stats} summary={summary} leads={leadRows} onOpen={setActiveTab} />;
    }
    if (activeTab === "leads") {
      return <LeadsMatrix />;
    }
    if (activeTab === "inventory") {
      return <AssetVault />;
    }
    if (activeTab === "chat") {
      return <TeamChat />;
    }
    if (activeTab === "calendar") {
      return <MasterSchedule />;
    }
    if (activeTab === "targets") {
      return <Performance />;
    }

    return <ExecutiveOverview stats={stats} summary={summary} leads={leadRows} onOpen={setActiveTab} />;
  };

  return (
    <div className="ui-page-shell flex h-full w-full flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-hidden">
        {renderContent()}
      </div>
    </div>
  );
};

const ExecutiveOverview = ({ stats, summary, leads, onOpen }) => (
  <div className="dashboard-doc-screen h-full overflow-y-auto custom-scrollbar px-4 py-6 sm:px-6 lg:px-8">
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      <StatCard
        title="Total Leads Assigned"
        value={stats.totalLeadsAssigned}
        hint="Owned by me"
        icon={Users}
        onClick={() => onOpen("leads")}
      />
      <StatCard
        title="Pending First Calls"
        value={stats.pendingFirstCalls}
        hint="New leads to contact"
        icon={PhoneCall}
        onClick={() => onOpen("leads")}
      />
      <StatCard
        title="Follow-ups Due"
        value={stats.followUpsDue}
        hint="Due now or overdue"
        icon={Clock3}
        onClick={() => onOpen("leads")}
      />
      <StatCard
        title="Qualified Leads"
        value={stats.qualifiedLeads}
        hint="Marked Interested"
        icon={CheckCircle}
        onClick={() => onOpen("leads")}
      />
      <StatCard
        title="Leads Transferred"
        value={stats.leadsTransferred}
        hint="Moved to next owner"
        icon={Send}
        onClick={() => onOpen("leads")}
      />
      <StatCard
        title="Conversion Ratio"
        value={`${stats.conversionRatio}%`}
        hint="Qualified or beyond"
        icon={Percent}
        onClick={() => onOpen("targets")}
      />
    </div>

    <ExecutiveCommandSnapshot leads={leads} summary={summary} onOpen={onOpen} />

    <div className="ui-soft-panel mt-6 p-3 sm:p-4">
      <LeadPerformancePanel
        leads={leads}
        theme="light"
        accent="emerald"
        title="Role Performance Graph"
        subtitle="My lead pipeline movement by stage"
      />
    </div>

    <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      <QuickPageCard
        title="My Leads"
        subtitle="Track and update assigned leads"
        icon={Users}
        onClick={() => onOpen("leads")}
      />
      <QuickPageCard
        title="Inventory"
        subtitle="Browse and search available inventory"
        icon={Building2}
        onClick={() => onOpen("inventory")}
      />
      <QuickPageCard
        title="Chat"
        subtitle="Coordinate with manager and team"
        icon={MessageSquare}
        onClick={() => onOpen("chat")}
      />
      <QuickPageCard
        title="Schedule"
        subtitle="View meetings and follow-up slots"
        icon={Calendar}
        onClick={() => onOpen("calendar")}
      />
      <QuickPageCard
        title="Targets"
        subtitle="Review conversion and monthly goals"
        icon={Target}
        onClick={() => onOpen("targets")}
      />
    </div>
  </div>
);

const ExecutiveCommandSnapshot = ({ leads, summary, onOpen }) => {
  const snapshot = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    const toDate = (value) => {
      if (!value) return null;
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    };

    const dueToday = leads
      .map((lead) => ({ ...lead, followUpAt: toDate(lead.nextFollowUp) }))
      .filter((lead) => lead.followUpAt && lead.followUpAt >= todayStart && lead.followUpAt <= todayEnd)
      .sort((left, right) => left.followUpAt - right.followUpAt)
      .slice(0, 4);

    const stages = [
      "NEW",
      "CONTACTED",
      "INTERESTED",
      "SITE_VISIT",
      "REQUESTED",
      "CLOSED",
    ];
    const funnel = stages.map((stage) => ({
      stage,
      count: summary?.byStatus
        ? Number(summary.byStatus[stage] || 0)
        : leads.filter((lead) => String(lead.status || "") === stage).length,
    }));
    const funnelTotal = summary ? Number(summary.total || 0) : leads.length;

    const recent = [...leads]
      .sort((left, right) => {
        const leftDate = toDate(left.updatedAt || left.createdAt)?.getTime() || 0;
        const rightDate = toDate(right.updatedAt || right.createdAt)?.getTime() || 0;
        return rightDate - leftDate;
      })
      .slice(0, 4);

    return { dueToday, funnel, funnelTotal, recent, followUpsToday: summary ? Number(summary.followUpsToday || 0) : dueToday.length };
  }, [leads, summary]);

  return (
    <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
      <section className="ui-soft-panel rounded-2xl border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-bold text-slate-900">Today's Follow-ups</h3>
        <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-slate-500">
          {snapshot.followUpsToday} scheduled
        </p>
        <div className="mt-3 space-y-2">
          {snapshot.dueToday.length ? snapshot.dueToday.map((lead) => (
            <button
              key={lead._id}
              type="button"
              onClick={() => onOpen("leads")}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left"
            >
              <p className="truncate text-sm font-semibold text-slate-900">{lead.name || lead.phone || "Lead"}</p>
              <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                <Clock3 size={12} />
                {lead.followUpAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
              </p>
            </button>
          )) : (
            <p className="rounded-xl border border-dashed border-slate-300 px-3 py-6 text-center text-sm text-slate-500">
              No follow-ups due today.
            </p>
          )}
        </div>
      </section>

      <section className="ui-soft-panel rounded-2xl border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-bold text-slate-900">Lead Funnel Snapshot</h3>
        <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-slate-500">
          Current assigned pipeline
        </p>
        <div className="mt-3 space-y-2">
          {snapshot.funnel.map((row) => (
            <div key={row.stage}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-600">{row.stage.replace(/_/g, " ")}</span>
                <span className="text-slate-500">{row.count}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-500"
                  style={{ width: `${snapshot.funnelTotal ? Math.min((row.count / snapshot.funnelTotal) * 100, 100) : 0}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="ui-soft-panel rounded-2xl border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-bold text-slate-900">Recent Activity</h3>
        <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-slate-500">
          Latest lead updates
        </p>
        <div className="mt-3 space-y-2">
          {snapshot.recent.length ? snapshot.recent.map((lead) => (
            <button
              key={lead._id}
              type="button"
              onClick={() => onOpen("leads")}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left"
            >
              <p className="truncate text-sm font-semibold text-slate-900">{lead.name || lead.phone || "Lead"}</p>
              <p className="mt-1 text-xs text-slate-500">{lead.status || "-"}</p>
            </button>
          )) : (
            <p className="rounded-xl border border-dashed border-slate-300 px-3 py-6 text-center text-sm text-slate-500">
              No recent lead activity.
            </p>
          )}
        </div>
      </section>
    </div>
  );
};

const StatCard = ({ title, value, hint, icon, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="ui-soft-panel rounded-2xl p-5 text-left transition-all hover:-translate-y-0.5 hover:border-cyan-300/70"
  >
    <div className="flex items-center justify-between">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        {title}
      </p>
      <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
        {React.createElement(icon, { size: 14 })}
      </div>
    </div>
    <p className="mt-3 font-display text-3xl text-slate-900">{value}</p>
    <p className="mt-1 text-xs text-slate-500">{hint}</p>
  </button>
);

const QuickPageCard = ({ title, subtitle, icon, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="ui-soft-panel rounded-2xl p-5 text-left transition-all hover:-translate-y-0.5 hover:border-cyan-300/70"
  >
    <div className="mb-3 inline-flex rounded-lg bg-slate-100 p-2 text-slate-700">
      {React.createElement(icon, { size: 16 })}
    </div>
    <p className="text-sm font-semibold text-slate-900">{title}</p>
    <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
  </button>
);

export default ExecutiveDashboard;
