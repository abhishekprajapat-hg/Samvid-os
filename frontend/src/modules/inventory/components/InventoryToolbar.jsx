import { Ban, CheckCircle2, Grid2X2, KeyRound, List, Plus, XCircle } from "lucide-react";
import { Button, cn } from "../../../components/ui";

const StatusTab = ({ icon: Icon, label, count, active, tone = "slate", onClick }) => {
  const tones = {
    blue: "text-slate-700 hover:border-blue-300 hover:text-blue-700",
    green: "text-slate-700 hover:border-emerald-300 hover:text-emerald-700",
    orange: "text-slate-700 hover:border-orange-300 hover:text-orange-700",
    red: "text-slate-700 hover:border-rose-300 hover:text-rose-700",
    purple: "text-slate-700 hover:border-violet-300 hover:text-violet-700",
    slate: "text-slate-700 hover:border-slate-300 hover:text-slate-950",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex h-12 items-center gap-2 rounded-xl border px-5 text-[14px] font-semibold transition",
        active
          ? "border-blue-600 bg-blue-50 text-blue-700 shadow-sm"
          : `border-transparent bg-white ${tones[tone]}`,
      )}
    >
      {Icon ? <Icon size={16} className={cn(tone === "green" && "text-emerald-500", tone === "orange" && "text-orange-500", tone === "red" && "text-rose-500", tone === "purple" && "text-violet-500")} /> : null}
      {label}
      <span className={cn("rounded-md px-2 py-0.5 text-[12px]", active ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600")}>{count ?? 0}</span>
    </button>
  );
};

const CATEGORY_TABS = [
  { value: "all", label: "All" },
  { value: "COMMERCIAL", label: "Commercial" },
  { value: "RESIDENTIAL", label: "Residential" },
];

/*
 * R13 (30 Sep 2026): the category is the first decision - a client wants an
 * office or a flat - so Commercial / Residential sits on its own row above
 * status, instead of being one dropdown among nine filters.
 */
export const InventoryCategoryTabs = ({ value, onChange, counts = {} }) => (
  <div role="tablist" aria-label="Inventory category" className="inline-flex w-fit max-w-full self-start overflow-x-auto rounded-xl border border-slate-200 bg-white p-1">
    {CATEGORY_TABS.map((tab) => {
      const active = (value || "all") === tab.value;
      return (
        <button
          key={tab.value}
          type="button"
          role="tab"
          aria-selected={active}
          onClick={() => onChange(tab.value)}
          className={cn(
            "inline-flex h-10 items-center gap-2 rounded-lg px-4 text-[14px] font-semibold transition",
            active ? "bg-slate-900 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
          )}
        >
          {tab.label}
          {counts[tab.value] !== undefined ? (
            <span className={cn("rounded-md px-1.5 py-0.5 text-[12px]", active ? "bg-slate-700 text-white" : "bg-slate-100 text-slate-600")}>{counts[tab.value]}</span>
          ) : null}
        </button>
      );
    })}
  </div>
);

const InventoryToolbar = ({
  modeType,
  onModeChange,
  statusFilter,
  onStatusFilterChange,
  statusCounts = {},
  viewMode,
  onViewModeChange,
  onShareList,
  canManage = false,
  onOpenAddModal,
  className,
}) => {
  const activeTab = modeType === "rent" && statusFilter === "all" ? "Rented" : statusFilter;
  const selectTab = (value) => {
    if (value === "Rented") {
      onModeChange("rent");
      onStatusFilterChange("all");
      return;
    }
    onModeChange("all");
    onStatusFilterChange(value);
  };

  return (
    <div className={cn("inventory-toolbar space-y-4", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <StatusTab label="All" count={statusCounts.all} active={activeTab === "all"} tone="blue" onClick={() => selectTab("all")} />
        <StatusTab icon={CheckCircle2} label="Available" count={statusCounts.Available} active={activeTab === "Available"} tone="green" onClick={() => selectTab("Available")} />
        <StatusTab icon={Ban} label="Blocked" count={statusCounts.Blocked} active={activeTab === "Blocked"} tone="orange" onClick={() => selectTab("Blocked")} />
        <StatusTab icon={XCircle} label="Sold" count={statusCounts.Sold} active={activeTab === "Sold"} tone="red" onClick={() => selectTab("Sold")} />
        <StatusTab icon={KeyRound} label="For Rent" count={statusCounts.Rented || 0} active={activeTab === "Rented"} tone="purple" onClick={() => selectTab("Rented")} />

        <div className="ml-auto flex items-center gap-3">
          <span className="hidden text-[13px] font-medium text-slate-500 lg:inline">View</span>
          <div className="flex h-12 items-center rounded-xl border border-slate-200 bg-white p-1">
            <button type="button" onClick={() => onViewModeChange("cards")} aria-label="Grid view" className={cn("grid h-10 w-11 place-items-center rounded-lg", viewMode === "cards" ? "bg-blue-50 text-blue-700" : "text-slate-500 hover:bg-slate-50")}><Grid2X2 size={18} /></button>
            <button type="button" onClick={() => onViewModeChange("table")} aria-label="List view" className={cn("grid h-10 w-11 place-items-center rounded-lg", viewMode === "table" ? "bg-blue-50 text-blue-700" : "text-slate-500 hover:bg-slate-50")}><List size={19} /></button>
          </div>
          {onShareList ? <Button size="sm" variant="secondary" onClick={onShareList}>Share list</Button> : null}
          {canManage && onOpenAddModal ? <Button size="sm" leftIcon={Plus} onClick={onOpenAddModal} className="h-12 rounded-xl px-5 text-[14px]">Add Property</Button> : null}
        </div>
      </div>
    </div>
  );
};

export default InventoryToolbar;
