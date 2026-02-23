import React, { useEffect, useMemo, useState } from "react";
import {
  Calendar,
  CheckCircle,
  ClipboardList,
  LayoutGrid,
  MapPin,
  MessageSquare,
  Navigation,
  Package,
  Users,
} from "lucide-react";
import AssetVault from "../inventory/AssetVault";
import FieldOps from "./FieldOps";
import TeamChat from "../chat/TeamChat";
import MasterSchedule from "../calendar/MasterSchedule";
import LeadsMatrix from "../leads/LeadsMatrix";
import api from "../../services/api";
import { toErrorMessage } from "../../utils/errorMessage";

const TABS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutGrid },
  { id: "leads", label: "My Leads", icon: Users },
  { id: "inventory", label: "Inventory", icon: Package },
  { id: "map", label: "Field Ops", icon: MapPin },
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "calendar", label: "Schedule", icon: Calendar },
];

const DEFAULT_TASKS = [
  {
    id: "visit-1",
    title: "Site Visit",
    detail: "Skyline Towers - 10:00 AM",
    status: "Pending",
  },
  {
    id: "visit-2",
    title: "Client Follow Up",
    detail: "Call after visit completion",
    status: "Pending",
  },
  {
    id: "visit-3",
    title: "Document Sync",
    detail: "Upload photos and unit notes",
    status: "Pending",
  },
];

const FieldDashboard = () => {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [inventoryCount, setInventoryCount] = useState(0);
  const [leadCount, setLeadCount] = useState(0);
  const [tasks, setTasks] = useState(DEFAULT_TASKS);

  useEffect(() => {
    const fetchDashboardData = async () => {
      const [inventoryResult, leadsResult] = await Promise.allSettled([
        api.get("/inventory"),
        api.get("/leads"),
      ]);

      if (inventoryResult.status === "fulfilled") {
        const rows = inventoryResult.value.data?.assets || [];
        setInventoryCount(Array.isArray(rows) ? rows.length : 0);
      } else {
        console.error(
          "Field dashboard inventory error:",
          toErrorMessage(inventoryResult.reason, "Unknown error"),
        );
      }

      if (leadsResult.status === "fulfilled") {
        const rows = leadsResult.value.data?.leads || [];
        setLeadCount(Array.isArray(rows) ? rows.length : 0);
      } else {
        console.error(
          "Field dashboard leads error:",
          toErrorMessage(leadsResult.reason, "Unknown error"),
        );
      }
    };

    fetchDashboardData();
  }, []);

  const tabLabel = useMemo(() => {
    const found = TABS.find((tab) => tab.id === activeTab);
    return found ? found.label : "Dashboard";
  }, [activeTab]);

  const completeTask = (taskId) => {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === taskId ? { ...task, status: "Done" } : task,
      ),
    );
  };

  const renderContent = () => {
    if (activeTab === "dashboard") {
      return (
        <FieldOverview
          tasks={tasks}
          inventoryCount={inventoryCount}
          leadCount={leadCount}
          onCompleteTask={completeTask}
          onOpen={setActiveTab}
        />
      );
    }

    if (activeTab === "leads") {
      return <LeadsMatrix />;
    }

    if (activeTab === "inventory") {
      return <AssetVault />;
    }

    if (activeTab === "map") {
      return <FieldOps />;
    }

    if (activeTab === "chat") {
      return <TeamChat />;
    }

    if (activeTab === "calendar") {
      return <MasterSchedule />;
    }

    return (
      <FieldOverview
        tasks={tasks}
        inventoryCount={inventoryCount}
        leadCount={leadCount}
        onCompleteTask={completeTask}
        onOpen={setActiveTab}
      />
    );
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-slate-100">
      <div className="shrink-0 border-b border-slate-200 bg-white px-4 pb-4 pt-5 sm:px-6 lg:px-8">
        <h2 className="font-display text-xl text-slate-900">Field Executive Desk</h2>
        <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-slate-500">
          Active View: {tabLabel}
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                  active
                    ? "border-emerald-400 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                }`}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {renderContent()}
      </div>
    </div>
  );
};

const FieldOverview = ({
  tasks,
  inventoryCount,
  leadCount,
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
        />
        <FieldStatCard
          title="Completed"
          value={tasks.length - pending}
          hint="Marked done"
          icon={CheckCircle}
        />
        <FieldStatCard
          title="My Leads"
          value={leadCount}
          hint="Assigned to me"
          icon={Users}
        />
        <FieldStatCard
          title="Inventory Access"
          value={inventoryCount}
          hint="Company units visible"
          icon={Package}
        />
        <FieldStatCard
          title="Live Navigation"
          value="On"
          hint="Map tracking available"
          icon={Navigation}
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

const FieldStatCard = ({ title, value, hint, icon: Icon }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex items-center justify-between">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        {title}
      </p>
      <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
        <Icon size={14} />
      </div>
    </div>
    <p className="mt-3 font-display text-3xl text-slate-900">{value}</p>
    <p className="mt-1 text-xs text-slate-500">{hint}</p>
  </div>
);

const QuickPageCard = ({ title, subtitle, icon: Icon, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full rounded-2xl border border-slate-200 bg-white p-5 text-left transition-all hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md"
  >
    <div className="mb-3 inline-flex rounded-lg bg-slate-100 p-2 text-slate-700">
      <Icon size={16} />
    </div>
    <p className="text-sm font-semibold text-slate-900">{title}</p>
    <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
  </button>
);

export default FieldDashboard;
