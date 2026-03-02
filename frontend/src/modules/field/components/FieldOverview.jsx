import React from "react";
import {
  Calendar,
  CheckCircle,
  ClipboardList,
  MapPin,
  MessageSquare,
  Navigation,
  Package,
  Users,
} from "lucide-react";
import LeadPerformancePanel from "../../../components/dashboard/LeadPerformancePanel";

const FieldOverview = ({
  tasks,
  inventoryCount,
  leadCount,
  leads,
  onCompleteTask,
  onOpen,
}) => {
  const pending = tasks.filter((task) => task.status !== "Done").length;

  return (
    <div className="h-full overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-5">
        <FieldStatCard
          title="Pending Tasks"
          value={pending}
          hint="Today route actions"
          icon={ClipboardList}
          onClick={() => onOpen("calendar")}
        />
        <FieldStatCard
          title="Completed"
          value={tasks.length - pending}
          hint="Marked done"
          icon={CheckCircle}
          onClick={() => onOpen("calendar")}
        />
        <FieldStatCard
          title="My Leads"
          value={leadCount}
          hint="Assigned to me"
          icon={Users}
          onClick={() => onOpen("leads")}
        />
        <FieldStatCard
          title="Inventory Access"
          value={inventoryCount}
          hint="Company units visible"
          icon={Package}
          onClick={() => onOpen("inventory")}
        />
        <FieldStatCard
          title="Live Navigation"
          value="On"
          hint="Map tracking available"
          icon={Navigation}
          onClick={() => onOpen("map")}
        />
      </div>

      <div className="mt-6">
        <LeadPerformancePanel
          leads={leads}
          theme="light"
          accent="amber"
          title="Role Performance Graph"
          subtitle="Assigned pipeline stage trend"
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Today Tasks
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
                      className="rounded-lg bg-slate-900 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white hover:bg-emerald-600"
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
            subtitle="View all inventory in your company"
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
    className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md"
  >
    <div className="flex items-center justify-between">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        {title}
      </p>
      <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
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
    className="w-full rounded-2xl border border-slate-200 bg-white p-5 text-left transition-all hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md"
  >
    <div className="mb-3 inline-flex rounded-lg bg-slate-100 p-2 text-slate-700">
      {icon ? React.createElement(icon, { size: 16 }) : null}
    </div>
    <p className="text-sm font-semibold text-slate-900">{title}</p>
    <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
  </button>
);

export default FieldOverview;

