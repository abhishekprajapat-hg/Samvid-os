import React, { useEffect, useMemo, useState } from "react";
import {
  Building2,
  Calendar,
  CheckCircle,
  LayoutGrid,
  MessageSquare,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import AssetVault from "../inventory/AssetVault";
import LeadsMatrix from "../leads/LeadsMatrix";
import TeamChat from "../chat/TeamChat";
import MasterSchedule from "../calendar/MasterSchedule";
import Performance from "../reports/Performance";
import api from "../../services/api";
import { toErrorMessage } from "../../utils/errorMessage";

const TABS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutGrid },
  { id: "leads", label: "My Leads", icon: Users },
  { id: "inventory", label: "Inventory", icon: Building2 },
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "calendar", label: "Schedule", icon: Calendar },
  { id: "targets", label: "Targets", icon: Target },
];

const ExecutiveDashboard = () => {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [stats, setStats] = useState({
    totalLeads: 0,
    dealsClosed: 0,
    commission: 0,
    inventoryCount: 0,
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [leadRes, inventoryRes] = await Promise.all([
          api.get("/leads"),
          api.get("/inventory"),
        ]);

        const leads = leadRes.data?.leads || [];
        const inventoryAssets = inventoryRes.data?.assets || [];
        const closedLeads = leads.filter((lead) => lead.status === "CLOSED");

        setStats({
          totalLeads: leads.length,
          dealsClosed: closedLeads.length,
          commission: closedLeads.length * 50000,
          inventoryCount: Array.isArray(inventoryAssets) ? inventoryAssets.length : 0,
        });
      } catch (error) {
        console.error("Executive stats error:", toErrorMessage(error, "Unknown error"));
      }
    };

    fetchStats();
  }, []);

  const tabLabel = useMemo(() => {
    const found = TABS.find((tab) => tab.id === activeTab);
    return found ? found.label : "Dashboard";
  }, [activeTab]);

  const renderContent = () => {
    if (activeTab === "dashboard") {
      return <ExecutiveOverview stats={stats} onOpen={setActiveTab} />;
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

    return <ExecutiveOverview stats={stats} onOpen={setActiveTab} />;
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-slate-50">
      <div className="shrink-0 border-b border-slate-200 bg-white px-4 pb-4 pt-5 sm:px-6 lg:px-8">
        <h2 className="font-display text-xl text-slate-900">
          Executive Command Desk
        </h2>
        <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-slate-500">
          Active View: {tabLabel}
        </p>

      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {renderContent()}
      </div>
    </div>
  );
};

const ExecutiveOverview = ({ stats, onOpen }) => (
  <div className="h-full overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
      <StatCard
        title="Total Leads"
        value={stats.totalLeads}
        hint="My pipeline"
        icon={Users}
      />
      <StatCard
        title="Deals Closed"
        value={stats.dealsClosed}
        hint="Won opportunities"
        icon={CheckCircle}
      />
      <StatCard
        title="Commission"
        value={`Rs ${(stats.commission / 100000).toFixed(1)}L`}
        hint="Estimated earnings"
        icon={TrendingUp}
      />
      <StatCard
        title="Inventory Access"
        value={stats.inventoryCount}
        hint="Company units"
        icon={Building2}
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

const StatCard = ({ title, value, hint, icon: Icon }) => (
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
    className="rounded-2xl border border-slate-200 bg-white p-5 text-left transition-all hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md"
  >
    <div className="mb-3 inline-flex rounded-lg bg-slate-100 p-2 text-slate-700">
      <Icon size={16} />
    </div>
    <p className="text-sm font-semibold text-slate-900">{title}</p>
    <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
  </button>
);

export default ExecutiveDashboard;
