import React from "react";
import {
  Calendar,
  CheckCircle,
  ClipboardList,
  IndianRupee,
  MapPin,
  MessageSquare,
  PhoneCall,
  Package,
  TrendingDown,
  Users,
} from "lucide-react";
import LeadPerformancePanel from "../../../components/dashboard/LeadPerformancePanel";

const formatCurrencyShort = (value) => {
  const amount = Number(value) || 0;
  if (amount >= 10000000) return `Rs ${(amount / 10000000).toFixed(1)}Cr`;
  if (amount >= 100000) return `Rs ${(amount / 100000).toFixed(1)}L`;
  if (amount >= 1000) return `Rs ${(amount / 1000).toFixed(1)}K`;
  return `Rs ${amount.toLocaleString("en-IN")}`;
};

const FieldOverview = ({
  tasks,
  inventoryCount,
  leadCount,
  metrics,
  leads,
  onCompleteTask,
  onOpen,
}) => {
  const pending = tasks.filter((task) => task.status !== "Done").length;
  const dashboardMetrics = {
    leadsAssigned: leadCount,
    activeClients: 0,
    siteVisitsScheduled: 0,
    ongoingNegotiations: 0,
    dealsClosed: 0,
    dealsLost: 0,
    revenueGenerated: 0,
    ...(metrics || {}),
  };

  return (
    <div className="dashboard-doc-screen h-full overflow-y-auto custom-scrollbar px-4 py-6 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
        <FieldStatCard
          title="Leads Assigned"
          value={dashboardMetrics.leadsAssigned}
          hint="Assigned to me"
          icon={Users}
          onClick={() => onOpen("leads")}
        />
        <FieldStatCard
          title="Active Clients"
          value={dashboardMetrics.activeClients}
          hint="Open field pipeline"
          icon={PhoneCall}
          onClick={() => onOpen("leads")}
        />
        <FieldStatCard
          title="Site Visits Scheduled"
          value={dashboardMetrics.siteVisitsScheduled}
          hint="Visit required or active"
          icon={MapPin}
          onClick={() => onOpen("map")}
        />
        <FieldStatCard
          title="Ongoing Negotiations"
          value={dashboardMetrics.ongoingNegotiations}
          hint="Interested/requested"
          icon={ClipboardList}
          onClick={() => onOpen("leads")}
        />
        <FieldStatCard
          title="Deals Closed"
          value={dashboardMetrics.dealsClosed}
          hint="Won deals"
          icon={CheckCircle}
          onClick={() => onOpen("leads")}
        />
        <FieldStatCard
          title="Deals Lost"
          value={dashboardMetrics.dealsLost}
          hint="Lost opportunities"
          icon={TrendingDown}
          onClick={() => onOpen("leads")}
        />
        <FieldStatCard
          title="Revenue Generated"
          value={formatCurrencyShort(dashboardMetrics.revenueGenerated)}
          hint="Closed brokerage"
          icon={IndianRupee}
          onClick={() => onOpen("leads")}
        />
      </div>

      <div className="ui-soft-panel mt-6 p-3 sm:p-4">
        <LeadPerformancePanel
          leads={leads}
          theme="light"
          accent="amber"
          title="Role Performance Graph"
          subtitle="Assigned pipeline stage trend"
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_1fr]">
        <div className="ui-soft-panel rounded-2xl p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Today Tasks
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {pending} pending, {tasks.length - pending} completed
          </p>

          <div className="mt-4 space-y-3">
            {tasks.map((task) => (
              <div
                key={task.id}
                className={`rounded-xl border p-3 ${
                  task.status === "Done"
                    ? "border-emerald-200 bg-emerald-50/50"
                    : "border-slate-200 bg-slate-50"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{task.title}</p>
                    <p className="mt-1 text-xs text-slate-500">{task.detail}</p>
                  </div>

                  {task.status === "Done" ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold uppercase text-emerald-700">
                      Done
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onCompleteTask(task.id)}
                      className="rounded-lg bg-slate-900 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white hover:bg-cyan-700"
                    >
                      Check In
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <QuickPageCard
            title="My Leads"
            subtitle="Open assigned leads and update status"
            icon={Users}
            onClick={() => onOpen("leads")}
          />
          <QuickPageCard
            title="Field Ops Map"
            subtitle="Open live map and active visit panel"
            icon={MapPin}
            onClick={() => onOpen("map")}
          />
          <QuickPageCard
            title="Inventory"
            subtitle={`${inventoryCount} company units visible`}
            icon={Package}
            onClick={() => onOpen("inventory")}
          />
          <QuickPageCard
            title="Chat"
            subtitle="Connect with manager/admin instantly"
            icon={MessageSquare}
            onClick={() => onOpen("chat")}
          />
          <QuickPageCard
            title="Schedule"
            subtitle="Check route and follow-up calendar"
            icon={Calendar}
            onClick={() => onOpen("calendar")}
          />
        </div>
      </div>
    </div>
  );
};

const FieldStatCard = ({ title, value, hint, icon, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="ui-soft-panel rounded-2xl p-5 text-left transition-all hover:-translate-y-0.5 hover:border-cyan-300/70"
  >
    <div className="flex items-center justify-between">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        {title}
      </p>
      <div className="rounded-lg bg-cyan-50 p-2 text-cyan-700">
        {icon ? React.createElement(icon, { size: 14 }) : null}
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
    className="ui-soft-panel w-full rounded-2xl p-5 text-left transition-all hover:-translate-y-0.5 hover:border-cyan-300/70"
  >
    <div className="mb-3 inline-flex rounded-lg bg-slate-100 p-2 text-slate-700">
      {icon ? React.createElement(icon, { size: 16 }) : null}
    </div>
    <p className="text-sm font-semibold text-slate-900">{title}</p>
    <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
  </button>
);

export default FieldOverview;

