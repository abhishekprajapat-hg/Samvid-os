import React, { useEffect, useMemo, useState } from "react";
import {
  Calendar,
  LayoutGrid,
  MapPin,
  MessageSquare,
  Package,
  Users,
} from "lucide-react";
import AssetVault from "../inventory/AssetVault";
import FieldOps from "./FieldOps";
import TeamChat from "../chat/TeamChat";
import MasterSchedule from "../calendar/MasterSchedule";
import LeadsMatrix from "../leads/LeadsMatrix";
import FieldOverview from "./components/FieldOverview";
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
  const [leadRows, setLeadRows] = useState([]);
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
        setLeadRows(Array.isArray(rows) ? rows : []);
        setLeadCount(Array.isArray(rows) ? rows.length : 0);
      } else {
        setLeadRows([]);
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
          leads={leadRows}
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
        leads={leadRows}
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

export default FieldDashboard;
