import React from "react";
import { motion as Motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  Building2,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Eye,
  Filter,
  History,
  Loader,
  Mail,
  Mic,
  MicOff,
  MapPin,
  Phone,
  Plus,
  RefreshCw,
  Save,
  Search,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  UploadCloud,
  Users2,
  X,
} from "lucide-react";
import { EmptyState, Skeleton } from "../../../components/ui";
import { StatusBadge } from "../../../components/crm";
import ToastNotice from "../../../components/ui/ToastNotice";
import {
  FURNISHING_OPTIONS,
  INVENTORY_TYPE_OPTIONS,
  getPropertySubtypeConfig,
  getPropertySubtypeOptions,
} from "../../../config/propertyRequirementConfig";

const INR_CURRENCY_FORMATTER = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const formatCurrencyInr = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return "-";
  return INR_CURRENCY_FORMATTER.format(amount);
};

const AddLeadFieldShell = ({ title, className = "", fieldTitleClass, children }) => (
  <label className={`block space-y-1 ${className}`}>
    <span className={fieldTitleClass}>{title}</span>
    {children}
  </label>
);

const AddLeadSelectControl = ({ value, onChange, inputClass, isDark, children }) => (
  <div className="relative">
    <select
      value={value}
      onChange={onChange}
      className={`${inputClass} appearance-none pr-10`}
    >
      {children}
    </select>
    <ChevronDown
      size={16}
      className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 ${
        isDark ? "text-slate-400" : "text-slate-500"
      }`}
    />
  </div>
);

const AddLeadAdornedInput = ({
  adornment,
  adornmentPosition = "left",
  inputClass,
  isDark,
  ...inputProps
}) => (
  <div className="relative">
    <input
      {...inputProps}
      className={`${inputClass} ${adornmentPosition === "left" ? "pl-9" : "pr-12"}`}
    />
    <span
      className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-xs font-bold ${
        adornmentPosition === "left" ? "left-3" : "right-3"
      } ${isDark ? "text-slate-400" : "text-slate-500"}`}
    >
      {adornment}
    </span>
  </div>
);

const CUSTOM_NUMBER_OPTION_VALUE = "__CUSTOM_NUMBER__";

const getLeadPendingAmount = (lead) => {
  if (!lead || typeof lead !== "object") return null;
  const paymentType = String(lead?.dealPayment?.paymentType || "").trim().toUpperCase();
  const amount = Number(lead?.dealPayment?.remainingAmount);
  if (paymentType !== "PARTIAL") return null;
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return amount;
};

const CLOSED_STATUS_SET = new Set(["REQUESTED", "CLOSED", "LOST"]);
const INITIAL_VISIBLE_LEADS = 80;
const VISIBLE_LEADS_INCREMENT = 80;
const INITIAL_KANBAN_COLUMN_LEADS = 35;
const KANBAN_COLUMN_INCREMENT = 35;

const isLeadFollowUpDue = (lead, nowMs) => {
  if (!lead?.nextFollowUp || !nowMs) return false;
  const followUpMs = new Date(lead.nextFollowUp).getTime();
  return (
    Number.isFinite(followUpMs)
    && followUpMs <= nowMs
    && !CLOSED_STATUS_SET.has(String(lead.status || ""))
  );
};

const getLeadInitials = (leadName) =>
  String(leadName || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "LD";

const getLeadSourceMeta = (lead = {}) => {
  const rawSource = String(
    lead.source
    || lead.leadSource
    || lead.createdBySource
    || lead.metaLeadId
    || lead.metaLeadgenId
    || "",
  ).trim();
  const normalized = rawSource.toUpperCase();
  const isMeta =
    normalized.includes("META")
    || normalized.includes("FACEBOOK")
    || normalized.includes("INSTAGRAM")
    || Boolean(lead.metaLeadId || lead.metaLeadgenId || lead.metaAdId);

  return isMeta
    ? { label: "META", className: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200" }
    : { label: "MANUAL", className: "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200" };
};

const LeadSourceBadge = ({ lead }) => {
  const source = getLeadSourceMeta(lead);
  return (
    <span className={`inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] ${source.className}`}>
      {source.label}
    </span>
  );
};

const toTitleCaseLabel = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const getInventoryLocationLabel = (inventory = {}) => {
  const parts = [inventory?.city, inventory?.area, inventory?.pincode]
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  if (parts.length) {
    return parts.join(", ");
  }

  return String(inventory?.location || "").trim();
};

const getInventorySubtypeLabel = (inventory = {}) => {
  const inventoryType = String(inventory?.inventoryType || "").trim().toUpperCase();
  if (inventoryType === "COMMERCIAL") {
    return toTitleCaseLabel(inventory?.commercialDetails?.officeType);
  }

  if (inventoryType === "RESIDENTIAL") {
    return toTitleCaseLabel(
      inventory?.residentialDetails?.bhkType
      || inventory?.residentialDetails?.propertyType,
    );
  }

  return "";
};

const getInventoryAreaLabel = (inventory = {}) => {
  const totalArea = Number(inventory?.totalArea);
  if (!Number.isFinite(totalArea) || totalArea <= 0) return "";
  const areaUnit =
    String(inventory?.areaUnit || "SQ_FT").trim().toUpperCase() === "SQ_M"
      ? "sq m"
      : "sq ft";
  return `${totalArea.toLocaleString("en-IN")} ${areaUnit}`;
};

const getInventoryQuickInfo = (inventory = {}) =>
  [
    toTitleCaseLabel(inventory?.inventoryType),
    getInventorySubtypeLabel(inventory),
    toTitleCaseLabel(inventory?.furnishingStatus),
    getInventoryAreaLabel(inventory),
  ]
    .filter(Boolean)
    .join(" | ");

export const LeadsMatrixToolbar = ({
  isDark,
  refreshing,
  canAddLead,
  canBulkUploadLeads,
  onRefresh,
  onOpenAddModal,
  onOpenBulkUploadModal,
  totalLeads,
  filteredLeads,
  dueFollowUps,
}) => {
  const visibilityRatio = totalLeads > 0
    ? Math.max(0, Math.min(100, Math.round((filteredLeads / totalLeads) * 100)))
    : 0;

  return (
    <div
      className={`ui-hero-card relative overflow-hidden rounded-[26px] px-3 py-3 sm:rounded-2xl sm:px-4 sm:py-3 ${
        isDark
          ? "border-slate-700/80 bg-slate-900/90 shadow-[0_20px_80px_rgba(2,6,23,0.55)]"
          : "border-slate-200 bg-white shadow-[0_18px_55px_rgba(15,23,42,0.12)]"
      }`}
      style={{
        backgroundImage: isDark
          ? "radial-gradient(circle at 92% 10%, rgba(16,185,129,0.22), transparent 34%), radial-gradient(circle at 4% 80%, rgba(56,189,248,0.16), transparent 40%)"
          : "radial-gradient(circle at 92% 10%, rgba(16,185,129,0.2), transparent 34%), radial-gradient(circle at 4% 80%, rgba(56,189,248,0.13), transparent 40%)",
      }}
    >
      <div className="pointer-events-none absolute inset-0 opacity-70">
        <div className={`absolute inset-x-0 top-0 h-px ${isDark ? "bg-cyan-200/30" : "bg-cyan-300/80"}`} />
        <div className={`absolute inset-x-0 bottom-0 h-px ${isDark ? "bg-emerald-300/25" : "bg-emerald-300/60"}`} />
      </div>

      <div className="relative z-10 grid grid-cols-1 gap-3 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-3">
            <div className={`min-h-[86px] rounded-2xl border px-2.5 py-3 sm:min-h-0 sm:rounded-xl sm:px-3 sm:py-2 ${
              isDark ? "border-slate-700/80 bg-slate-950/70" : "border-slate-200 bg-white/80"
            }`}>
              <p className={`text-[9px] font-bold uppercase tracking-[0.1em] sm:text-[10px] sm:tracking-[0.14em] ${
                isDark ? "text-slate-400" : "text-slate-500"
              }`}>
                <span className="sm:hidden">Visible</span>
                <span className="hidden sm:inline">Visible Leads</span>
              </p>
              <p className={`mt-2 text-2xl font-display leading-none sm:mt-1 sm:text-xl ${isDark ? "text-cyan-100" : "text-cyan-700"}`}>
                {filteredLeads}
              </p>
            </div>

            <div className={`min-h-[86px] rounded-2xl border px-2.5 py-3 sm:min-h-0 sm:rounded-xl sm:px-3 sm:py-2 ${
              isDark ? "border-slate-700/80 bg-slate-950/70" : "border-slate-200 bg-white/80"
            }`}>
              <p className={`text-[9px] font-bold uppercase tracking-[0.1em] sm:text-[10px] sm:tracking-[0.14em] ${
                isDark ? "text-slate-400" : "text-slate-500"
              }`}>
                <span className="sm:hidden">Total</span>
                <span className="hidden sm:inline">Total Leads</span>
              </p>
              <p className={`mt-2 text-2xl font-display leading-none sm:mt-1 sm:text-xl ${isDark ? "text-slate-100" : "text-slate-800"}`}>
                {totalLeads}
              </p>
            </div>

            <div className={`min-h-[86px] rounded-2xl border px-2.5 py-3 sm:min-h-0 sm:rounded-xl sm:px-3 sm:py-2 ${
              isDark ? "border-rose-300/30 bg-rose-500/10" : "border-rose-200 bg-rose-50"
            }`}>
              <p className={`text-[9px] font-bold uppercase tracking-[0.1em] sm:text-[10px] sm:tracking-[0.14em] ${
                isDark ? "text-rose-200/90" : "text-rose-700"
              }`}>
                <span className="sm:hidden">Due</span>
                <span className="hidden sm:inline">Due Follow-ups</span>
              </p>
              <p className={`mt-2 text-2xl font-display leading-none sm:mt-1 sm:text-xl ${isDark ? "text-rose-100" : "text-rose-700"}`}>
                {dueFollowUps}
              </p>
            </div>
          </div>

          <div className="mt-3 rounded-2xl border px-3 py-2 sm:rounded-none sm:border-0 sm:px-0 sm:py-0">
            <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.14em]">
              <span className={isDark ? "text-slate-400" : "text-slate-500"}>View Coverage</span>
              <span className={isDark ? "text-cyan-200" : "text-cyan-700"}>{visibilityRatio}%</span>
            </div>
            <div className={`mt-1 h-2 w-full overflow-hidden rounded-full ${
              isDark ? "bg-slate-800" : "bg-slate-200"
            }`}>
              <Motion.div
                initial={{ width: 0 }}
                animate={{ width: `${visibilityRatio}%` }}
                transition={{ duration: 0.45, ease: "easeOut" }}
                className={`h-full rounded-full ${
                  isDark ? "bg-gradient-to-r from-cyan-300 to-emerald-300" : "bg-gradient-to-r from-cyan-500 to-emerald-500"
                }`}
              />
            </div>
          </div>
        </div>

        <div className="lg:col-span-4">
          <div className={`h-full rounded-[22px] border p-2.5 sm:rounded-2xl sm:p-3 ${
            isDark
              ? "border-slate-700 bg-slate-950/70"
              : "border-slate-200 bg-white/80"
          }`}>
            <p className={`px-1 text-[10px] font-bold uppercase tracking-[0.16em] sm:px-0 ${
              isDark ? "text-slate-400" : "text-slate-500"
            }`}>
              Quick Actions
            </p>

            <div className="mt-2 grid grid-cols-3 gap-1.5 sm:mt-3 sm:gap-2">
              <button
                type="button"
                onClick={onRefresh}
                className={`inline-flex h-10 min-w-0 items-center justify-center gap-1.5 rounded-2xl border px-2 text-[10px] font-bold uppercase tracking-[0.08em] transition-colors sm:rounded-xl sm:text-xs sm:tracking-[0.12em] ${
                  isDark
                    ? "border-slate-600 bg-slate-900 text-slate-100 hover:border-emerald-300/60 hover:text-emerald-100"
                    : "border-slate-300 bg-white text-slate-700 hover:border-emerald-400 hover:text-emerald-700"
                }`}
              >
                {refreshing ? <Loader size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                Refresh Feed
              </button>

              {canAddLead && (
                <button
                  type="button"
                  onClick={onOpenAddModal}
                  className={`inline-flex h-10 min-w-0 items-center justify-center gap-1.5 rounded-2xl px-2 text-[10px] font-bold uppercase tracking-[0.08em] text-white transition-colors sm:rounded-xl sm:text-xs sm:tracking-[0.12em] ${
                    isDark ? "bg-emerald-600 hover:bg-emerald-500" : "bg-slate-900 hover:bg-emerald-600"
                  }`}
                >
                  <Plus size={15} />
                  Add New Lead
                </button>
              )}

              {canBulkUploadLeads && (
                <button
                  type="button"
                  onClick={onOpenBulkUploadModal}
                  className={`inline-flex h-10 min-w-0 items-center justify-center gap-1.5 rounded-2xl border px-2 text-[10px] font-bold uppercase tracking-[0.08em] transition-colors sm:rounded-xl sm:text-xs sm:tracking-[0.12em] ${
                    isDark
                      ? "border-cyan-300/50 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/20"
                      : "border-cyan-300 bg-cyan-50 text-cyan-700 hover:bg-cyan-100"
                  }`}
                >
                  <UploadCloud size={14} />
                  Bulk Upload
                </button>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export const LeadsMatrixAlerts = ({ error, success }) => (
  <>
    <ToastNotice message={error} type="error" />
    <ToastNotice message={success} type="success" />
  </>
);

export const LeadsMatrixMetrics = ({
  isDark,
  metrics,
  statusFilter,
  showDueOnly,
  onMetricSelect,
}) => {
  const cards = [
    {
      key: "total",
      label: "Total Leads",
      value: metrics.total,
      tone: "text-slate-900",
      darkTone: "text-slate-100",
      accent: "from-slate-400 to-slate-600",
      icon: Users2,
    },
    {
      key: "new",
      label: "Fresh",
      value: metrics.new,
      tone: "text-sky-700",
      darkTone: "text-sky-100",
      accent: "from-sky-400 to-cyan-500",
      icon: Sparkles,
    },
    {
      key: "contacted",
      label: "Contacted",
      value: metrics.contacted,
      tone: "text-amber-700",
      darkTone: "text-amber-100",
      accent: "from-amber-400 to-orange-500",
      icon: Phone,
    },
    {
      key: "interested",
      label: "Interested",
      value: metrics.interested,
      tone: "text-emerald-700",
      darkTone: "text-emerald-100",
      accent: "from-emerald-400 to-teal-500",
      icon: CheckCircle2,
    },
    {
      key: "closed",
      label: "Closed",
      value: metrics.closed,
      tone: "text-indigo-700",
      darkTone: "text-indigo-100",
      accent: "from-indigo-400 to-blue-500",
      icon: BarChart3,
    },
    {
      key: "due",
      label: "Due Follow-up",
      value: metrics.dueFollowUps,
      tone: "text-rose-700",
      darkTone: "text-rose-100",
      accent: "from-rose-400 to-red-500",
      icon: CalendarClock,
    },
    {
      key: "conversion",
      label: "Conversion",
      value: `${metrics.conversionRate}%`,
      tone: "text-cyan-700",
      darkTone: "text-cyan-100",
      accent: "from-cyan-400 to-teal-500",
      icon: ArrowUpRight,
    },
  ];

  const isCardActive = (key) => {
    if (key === "due") return showDueOnly;
    if (key === "total") return statusFilter === "ALL" && !showDueOnly;
    if (key === "conversion" || key === "closed") return statusFilter === "CLOSED" && !showDueOnly;
    if (key === "new") return statusFilter === "NEW" && !showDueOnly;
    if (key === "contacted") return statusFilter === "CONTACTED" && !showDueOnly;
    if (key === "interested") return statusFilter === "INTERESTED" && !showDueOnly;
    return false;
  };

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7">
      {cards.map(({
        key,
        label,
        value,
        tone,
        darkTone,
        accent,
        icon,
      }) => (
        <button
          key={key}
          type="button"
          onClick={() => onMetricSelect(key)}
          className={`ui-soft-panel group relative overflow-hidden rounded-3xl px-4 py-3 text-left transition-all ${
            isCardActive(key)
              ? isDark
                ? "border-cyan-300/60 bg-slate-900 shadow-[0_0_0_1px_rgba(34,211,238,0.28)]"
                : "border-cyan-300 bg-cyan-50/80 shadow-[0_0_0_1px_rgba(14,165,233,0.25)]"
              : isDark
                ? "border-slate-700 bg-slate-900/80 hover:border-slate-500"
                : "border-slate-200 bg-white hover:border-slate-300"
          }`}
        >
          <div className={`pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${accent}`} />

          <div className="flex items-center justify-between gap-2">
            <p className={`truncate text-[10px] font-semibold uppercase tracking-[0.14em] ${
              isDark ? "text-slate-400" : "text-slate-500"
            }`}>
              {label}
            </p>
            <div className={`rounded-lg border p-1.5 ${
              isDark ? "border-slate-700 bg-slate-950/80 text-slate-300" : "border-slate-200 bg-slate-50 text-slate-600"
            }`}>
              {React.createElement(icon, { size: 13 })}
            </div>
          </div>

          <p className={`mt-2 text-3xl font-display tracking-tight ${isDark ? darkTone : tone}`}>
            {value}
          </p>

          <p className={`mt-1 text-[10px] font-semibold uppercase tracking-[0.13em] ${
            isDark ? "text-slate-500 group-hover:text-slate-400" : "text-slate-400 group-hover:text-slate-500"
          }`}>
            Tap to filter
          </p>
        </button>
      ))}
    </div>
  );
};

export const LeadsMatrixFilters = ({
  isDark,
  query,
  onQueryChange,
  statusFilter,
  onStatusFilterChange,
  leadStatuses,
  propertySubtypeFilter = "",
  onPropertySubtypeFilterChange,
  propertySubtypeOptions = [],
  sortBy,
  onSortByChange,
  getStatusLabel,
}) => {
  const [mobileMoreOpen, setMobileMoreOpen] = React.useState(false);
  const inputClass = `h-11 w-full rounded-2xl border text-sm outline-none transition-colors ${
    isDark
      ? "border-slate-700 bg-slate-950/90 text-slate-100 placeholder:text-slate-500 focus:border-cyan-300/50"
      : "border-slate-300 bg-white text-slate-700 placeholder:text-slate-400 focus:border-cyan-400"
  }`;
  const selectClass = `h-11 w-full rounded-2xl border px-3 text-xs font-semibold outline-none transition-colors sm:text-sm sm:font-normal ${
    isDark
      ? "border-slate-700 bg-slate-950/90 text-slate-100 focus:border-cyan-300/50"
      : "border-slate-300 bg-white text-slate-700 focus:border-cyan-400"
  }`;
  return (
    <div className={`ui-soft-panel relative mb-2 overflow-hidden rounded-2xl p-2.5 md:mb-4 md:rounded-3xl md:p-4 ${
      isDark
        ? "border-slate-700 bg-slate-900/85"
        : "border-slate-200 bg-white"
    }`}>
      <div className="pointer-events-none absolute inset-0 hidden opacity-80 md:block">
        <div className={`absolute -left-12 top-0 h-28 w-28 rounded-full blur-2xl ${
          isDark ? "bg-cyan-500/20" : "bg-cyan-300/35"
        }`} />
        <div className={`absolute right-0 top-0 h-24 w-24 rounded-full blur-2xl ${
          isDark ? "bg-emerald-500/15" : "bg-emerald-300/30"
        }`} />
      </div>

      <div className="relative z-10">
        <div className="hidden md:block">
          <div className="mb-3 flex items-center gap-2">
            <div className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${
              isDark ? "border-slate-700 bg-slate-950 text-slate-300" : "border-slate-300 bg-slate-50 text-slate-600"
            }`}>
              <Filter size={11} />
              Filter Stack
            </div>
            <p className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${
              isDark ? "text-slate-400" : "text-slate-500"
            }`}>
              Search, status and follow-up controls
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
            <div className="relative min-w-[260px] flex-[1_1_280px]">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 ${isDark ? "text-slate-400" : "text-slate-500"}`} size={15} />
              <input
                type="text"
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
                placeholder="Search by name, city, project, executive, phone"
                className={`${inputClass} pl-9 pr-9`}
              />
              {query && (
                <button
                  type="button"
                  onClick={() => onQueryChange("")}
                  className={`absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 ${
                    isDark ? "text-slate-400 hover:bg-slate-800" : "text-slate-500 hover:bg-slate-100"
                  }`}
                  aria-label="Clear search"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            <div className="min-w-[160px] flex-[1_1_170px]">
              <select
                aria-label="Filter leads by status"
                value={statusFilter}
                onChange={(event) => onStatusFilterChange(event.target.value)}
                className={selectClass}
              >
                <option value="ALL">All statuses</option>
                {leadStatuses.map((status) => (
                  <option key={status} value={status}>{getStatusLabel(status)}</option>
                ))}
              </select>
            </div>

            <div className="min-w-[180px] flex-[1_1_190px]">
              <select
                aria-label="Filter leads by property type"
                value={propertySubtypeFilter}
                onChange={(event) => onPropertySubtypeFilterChange?.(event.target.value)}
                className={selectClass}
              >
                <option value="">All property types</option>
                {propertySubtypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            <div className="min-w-[170px] flex-[0_1_190px]">
              <div className={`flex h-11 items-center gap-2 rounded-2xl border px-3 ${
                isDark ? "border-slate-700 bg-slate-950/90 text-slate-300" : "border-slate-300 bg-white text-slate-600"
              }`}>
                <SlidersHorizontal className="shrink-0" size={14} />
                <select
                  aria-label="Sort leads"
                  value={sortBy}
                  onChange={(event) => onSortByChange(event.target.value)}
                  className="h-full min-w-0 w-full bg-transparent text-xs font-semibold outline-none sm:text-sm sm:font-normal"
                >
                  <option value="RECENT">Latest updated</option>
                  <option value="FOLLOW_UP">Next follow-up</option>
                  <option value="NAME">Name A-Z</option>
                </select>
              </div>
            </div>

          </div>
        </div>

        <div className="md:hidden">
          <div className="relative">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 ${isDark ? "text-slate-400" : "text-slate-500"}`} size={15} />
            <input
              type="text"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Search leads"
              className={`${inputClass} pl-9 pr-9`}
            />
            {query && (
              <button
                type="button"
                onClick={() => onQueryChange("")}
                className={`absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 ${
                  isDark ? "text-slate-400 hover:bg-slate-800" : "text-slate-500 hover:bg-slate-100"
                }`}
                aria-label="Clear search"
              >
                <X size={12} />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setMobileMoreOpen((prev) => !prev)}
            className={`mt-2 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border text-xs font-bold uppercase tracking-[0.12em] ${
              isDark
                ? "border-slate-700 bg-slate-950 text-slate-300"
                : "border-slate-300 bg-white text-slate-600"
            }`}
            aria-expanded={mobileMoreOpen}
          >
            <SlidersHorizontal size={14} />
            {mobileMoreOpen ? "Hide Filters" : "More Filters"}
          </button>

          {mobileMoreOpen ? (
            <div className={`mt-2 space-y-2 rounded-2xl border p-2 ${
              isDark ? "border-slate-700 bg-slate-950/90" : "border-slate-200 bg-slate-50"
            }`}>
              <select
                aria-label="Filter leads by property type"
                value={propertySubtypeFilter}
                onChange={(event) => onPropertySubtypeFilterChange?.(event.target.value)}
                className={selectClass}
              >
                <option value="">All property types</option>
                {propertySubtypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>

              <select
                aria-label="Sort leads"
                value={sortBy}
                onChange={(event) => onSortByChange(event.target.value)}
                className={selectClass}
              >
                <option value="RECENT">Latest updated</option>
                <option value="FOLLOW_UP">Next follow-up</option>
                <option value="NAME">Name A-Z</option>
              </select>

            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export const LeadsMatrixTable = ({
  isDark,
  loading,
  filteredLeads,
  statusBreakdown = {},
  viewMode = "TABLE",
  onOpenLeadDetails,
  canAssignLead = false,
  onInlineStatusChange,
  updatingInlineStatusId,
  leadStatuses = [],
  getStatusColor,
  getStatusLabel,
  formatDate,
  nowMs,
}) => {
  const [openStatusMenuId, setOpenStatusMenuId] = React.useState("");
  const [visibleLeadCount, setVisibleLeadCount] = React.useState(INITIAL_VISIBLE_LEADS);
  const [kanbanVisibleByStatus, setKanbanVisibleByStatus] = React.useState({});

  React.useEffect(() => {
    setVisibleLeadCount(INITIAL_VISIBLE_LEADS);
    setKanbanVisibleByStatus({});
  }, [filteredLeads.length, viewMode]);

  const visibleLeads = React.useMemo(
    () => filteredLeads.slice(0, visibleLeadCount),
    [filteredLeads, visibleLeadCount],
  );
  const hiddenLeadCount = Math.max(0, filteredLeads.length - visibleLeads.length);

  const isFollowUpDue = (lead) => {
    return isLeadFollowUpDue(lead, nowMs);
  };

  const StatusPicker = ({ lead, compact = false }) => {
    const leadId = String(lead?._id || "");
    const isUpdating = updatingInlineStatusId === leadId;
    const currentStatus = String(lead?.status || "NEW").toUpperCase();
    const isOpen = openStatusMenuId === leadId;

    const handleStatusSelect = (status) => {
      const nextStatus = String(status || "").trim().toUpperCase();
      setOpenStatusMenuId("");

      if (nextStatus === "CLOSED") {
        onOpenLeadDetails(lead);
        return;
      }

      onInlineStatusChange?.(lead, nextStatus);
    };

    if (compact) {
      return (
        <div
          className="relative inline-flex shrink-0"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <select
            value={currentStatus}
            disabled={isUpdating}
            onChange={(event) => handleStatusSelect(event.target.value)}
            className={`h-10 max-w-[116px] appearance-none rounded-full border py-1 pl-3 pr-7 text-[10px] font-bold uppercase outline-none transition-all focus:ring-2 ${
              getStatusColor(lead?.status)
            } ${
              isUpdating ? "cursor-wait opacity-60" : "cursor-pointer"
            } ${
              isDark ? "focus:ring-cyan-300/20" : "focus:ring-blue-200"
            }`}
            title="Change lead status"
            aria-label={`Change status for ${lead?.name || "lead"}`}
          >
            {leadStatuses.map((status) => (
              <option key={status} value={status}>
                {getStatusLabel(status)}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] font-bold">
            v
          </span>
        </div>
      );
    }

    return (
      <div
        className={`relative inline-flex ${isOpen ? "z-[90]" : "z-10"}`}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          disabled={isUpdating}
          onClick={() => setOpenStatusMenuId((prev) => (prev === leadId ? "" : leadId))}
          className={`inline-flex items-center gap-1.5 rounded-full border py-1 pl-2.5 pr-2 font-bold uppercase outline-none transition-all focus:ring-2 ${
            compact ? "text-[10px]" : "text-[11px]"
          } ${getStatusColor(lead?.status)} ${
            isUpdating ? "cursor-wait opacity-60" : "cursor-pointer hover:shadow-sm"
          } ${
            isDark ? "focus:ring-cyan-300/20" : "focus:ring-blue-200"
          }`}
          title="Change lead status"
          aria-label={`Change status for ${lead?.name || "lead"}`}
          aria-expanded={isOpen}
        >
          <span>{isUpdating ? "Updating" : getStatusLabel(currentStatus)}</span>
          <span className={`text-[9px] transition-transform ${isOpen ? "rotate-180" : ""}`}>
            v
          </span>
        </button>

        {isOpen ? (
          <div
            className={`absolute left-0 top-full z-[100] mt-1.5 w-44 overflow-hidden rounded-xl border p-1 text-left shadow-2xl backdrop-blur-xl ${
              isDark
                ? "border-slate-700 bg-slate-950/95"
                : "border-slate-200 bg-white/95"
            }`}
          >
            {leadStatuses.map((status) => {
              const isCurrent = status === currentStatus;
              const isClosed = status === "CLOSED";

              return (
                <button
                  type="button"
                  key={status}
                  onClick={() => handleStatusSelect(status)}
                  className={`flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-[11px] font-bold uppercase transition-colors ${
                    isCurrent
                      ? isDark
                        ? "bg-cyan-400/15 text-cyan-100"
                        : "bg-blue-50 text-blue-700"
                      : isDark
                        ? "text-slate-300 hover:bg-white/10 hover:text-white"
                        : "text-slate-700 hover:bg-slate-100 hover:text-slate-950"
                  }`}
                >
                  <span className="min-w-0 truncate">{getStatusLabel(status)}</span>
                  {isClosed ? (
                    <span className={isDark ? "shrink-0 text-[9px] text-amber-200" : "shrink-0 text-[9px] text-amber-700"}>
                      OPEN
                    </span>
                  ) : isCurrent ? (
                    <span className={isDark ? "shrink-0 text-[9px] text-cyan-200" : "shrink-0 text-[9px] text-blue-600"}>
                      ACTIVE
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className={`ui-soft-panel relative flex min-h-[420px] flex-1 flex-col overflow-hidden rounded-3xl shadow-sm ${
      isDark
        ? "border-slate-700 bg-slate-900/90 shadow-[0_20px_70px_rgba(2,6,23,0.5)]"
        : "border-slate-200 bg-white shadow-[0_18px_48px_rgba(15,23,42,0.1)]"
    }`}>
      <div className="pointer-events-none absolute inset-0 opacity-70">
        <div className={`absolute inset-x-0 top-0 h-px ${isDark ? "bg-cyan-300/30" : "bg-cyan-300/70"}`} />
      </div>

      {loading ? (
        <div className="relative z-10 space-y-3 p-4" aria-busy="true" aria-live="polite">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
        </div>
      ) : filteredLeads.length === 0 ? (
        <EmptyState
          className="relative z-10 m-4"
          icon={Filter}
          title="No leads found"
          description="Try clearing the search, switching status tabs, or turning off due follow-up mode."
        />
      ) : viewMode === "KANBAN" ? (
        <>
        <div className="relative z-10 space-y-3 p-2.5 md:hidden">
          {leadStatuses.map((status) => {
            const rows = filteredLeads.filter(
              (lead) => String(lead?.status || "NEW").toUpperCase() === status,
            );
            const columnVisibleCount =
              kanbanVisibleByStatus[status] || INITIAL_KANBAN_COLUMN_LEADS;
            const visibleRows = rows.slice(0, columnVisibleCount);
            const hiddenRowsCount = Math.max(0, rows.length - visibleRows.length);

            return (
              <section
                key={status}
                className={`rounded-2xl border ${
                  isDark ? "border-slate-700 bg-slate-950/60" : "border-slate-200 bg-slate-50"
                }`}
              >
                <div className={`flex items-center justify-between gap-2 border-b px-3 py-2 ${
                  isDark ? "border-slate-700 bg-slate-950/80" : "border-slate-200 bg-white/90"
                }`}>
                  <StatusBadge status={status} />
                  <span className={`text-xs font-bold ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                    {rows.length || statusBreakdown[status] || 0}
                  </span>
                </div>

                <div className="space-y-2 p-2">
                  {rows.length === 0 ? (
                    <div className={`rounded-xl border border-dashed px-3 py-5 text-center text-xs ${
                      isDark ? "border-slate-700 text-slate-500" : "border-slate-300 text-slate-400"
                    }`}>
                      No leads
                    </div>
                  ) : visibleRows.map((lead) => {
                    const pendingAmount = getLeadPendingAmount(lead);
                    const followUpDue = isFollowUpDue(lead);
                    return (
                      <button
                        type="button"
                        key={lead._id}
                        onClick={() => onOpenLeadDetails(lead)}
                        className={`w-full rounded-xl border p-3 text-left transition ${
                          isDark
                            ? "border-slate-700 bg-slate-900/80 hover:border-cyan-300/45"
                            : "border-slate-200 bg-white hover:border-cyan-300"
                        }`}
                      >
                        <div className="flex min-w-0 items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className={`truncate text-sm font-bold ${isDark ? "text-slate-100" : "text-slate-900"}`}>
                              {lead.name || "Unnamed lead"}
                            </p>
                            <p className={`mt-0.5 truncate text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                              {lead.projectInterested || "Project not set"}
                            </p>
                          </div>
                          <LeadSourceBadge lead={lead} />
                        </div>
                        <div className="mt-3 grid grid-cols-1 gap-1 text-xs">
                          <p className={isDark ? "text-slate-300" : "text-slate-600"}>{lead.phone || "No phone"}</p>
                          <p className={isDark ? "font-semibold text-cyan-100" : "font-semibold text-cyan-700"}>
                            {lead.assignedTo?.name || "Unassigned"}
                          </p>
                          <p className={followUpDue ? "font-bold text-rose-600" : (isDark ? "text-slate-400" : "text-slate-500")}>
                            {followUpDue ? "Overdue: " : "Next: "}
                            {formatDate(lead.nextFollowUp)}
                          </p>
                          {pendingAmount ? (
                            <p className={isDark ? "font-semibold text-amber-200" : "font-semibold text-amber-700"}>
                              Pending {formatCurrencyInr(pendingAmount)}
                            </p>
                          ) : null}
                        </div>
                      </button>
                    );
                  })}
                  {hiddenRowsCount > 0 ? (
                    <button
                      type="button"
                      onClick={() =>
                        setKanbanVisibleByStatus((prev) => ({
                          ...prev,
                          [status]: columnVisibleCount + KANBAN_COLUMN_INCREMENT,
                        }))
                      }
                      className={`h-10 w-full rounded-xl border border-dashed px-3 text-[11px] font-bold uppercase tracking-[0.12em] transition-colors ${
                        isDark
                          ? "border-slate-700 text-slate-400 hover:border-cyan-300/40 hover:text-cyan-100"
                          : "border-slate-300 text-slate-500 hover:border-cyan-300 hover:text-cyan-700"
                      }`}
                    >
                      Show {Math.min(KANBAN_COLUMN_INCREMENT, hiddenRowsCount)} more
                    </button>
                  ) : null}
                </div>
              </section>
            );
          })}
        </div>

        <div className="relative z-10 hidden overflow-x-auto p-3 custom-scrollbar md:block">
          <div className="grid min-w-[980px] grid-cols-7 gap-3">
            {leadStatuses.map((status) => {
              const rows = filteredLeads.filter(
                (lead) => String(lead?.status || "NEW").toUpperCase() === status,
              );
              const columnVisibleCount =
                kanbanVisibleByStatus[status] || INITIAL_KANBAN_COLUMN_LEADS;
              const visibleRows = rows.slice(0, columnVisibleCount);
              const hiddenRowsCount = Math.max(0, rows.length - visibleRows.length);

              return (
                <section
                  key={status}
                  className={`flex max-h-[66vh] min-h-[380px] flex-col rounded-2xl border ${
                    isDark ? "border-slate-700 bg-slate-950/60" : "border-slate-200 bg-slate-50"
                  }`}
                >
                  <div className={`sticky top-0 z-10 border-b px-3 py-2 ${
                    isDark ? "border-slate-700 bg-slate-950/95" : "border-slate-200 bg-white/95"
                  }`}>
                    <div className="flex items-center justify-between gap-2">
                      <StatusBadge status={status} />
                      <span className={`text-xs font-bold ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                        {rows.length || statusBreakdown[status] || 0}
                      </span>
                    </div>
                  </div>

                  <div className="custom-scrollbar min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
                    {rows.length === 0 ? (
                      <div className={`rounded-xl border border-dashed px-3 py-8 text-center text-xs ${
                        isDark ? "border-slate-700 text-slate-500" : "border-slate-300 text-slate-400"
                      }`}>
                        No leads
                      </div>
                    ) : visibleRows.map((lead) => {
                      const pendingAmount = getLeadPendingAmount(lead);
                      const followUpDue = isFollowUpDue(lead);
                      return (
                        <button
                          type="button"
                          key={lead._id}
                          onClick={() => onOpenLeadDetails(lead)}
                          className={`w-full rounded-xl border p-3 text-left transition hover:-translate-y-0.5 ${
                            isDark
                              ? "border-slate-700 bg-slate-900/80 hover:border-cyan-300/45"
                              : "border-slate-200 bg-white hover:border-cyan-300"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className={`truncate text-sm font-bold ${isDark ? "text-slate-100" : "text-slate-900"}`}>
                                {lead.name || "Unnamed lead"}
                              </p>
                              <p className={`mt-0.5 truncate text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                                {lead.projectInterested || "Project not set"}
                              </p>
                            </div>
                            <LeadSourceBadge lead={lead} />
                          </div>
                          <div className="mt-3 space-y-1 text-xs">
                            <p className={`truncate ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                              {lead.phone || "No phone"}
                            </p>
                            <p className={`truncate font-semibold ${isDark ? "text-cyan-100" : "text-cyan-700"}`}>
                              {lead.assignedTo?.name || "Unassigned"}
                            </p>
                            <p className={followUpDue ? "font-bold text-rose-600" : (isDark ? "text-slate-400" : "text-slate-500")}>
                              {followUpDue ? "Overdue: " : "Next: "}
                              {formatDate(lead.nextFollowUp)}
                            </p>
                            {pendingAmount ? (
                              <p className={isDark ? "font-semibold text-amber-200" : "font-semibold text-amber-700"}>
                                Pending {formatCurrencyInr(pendingAmount)}
                              </p>
                            ) : null}
                          </div>
                        </button>
                      );
                    })}
                    {hiddenRowsCount > 0 ? (
                      <button
                        type="button"
                        onClick={() =>
                          setKanbanVisibleByStatus((prev) => ({
                            ...prev,
                            [status]: columnVisibleCount + KANBAN_COLUMN_INCREMENT,
                          }))
                        }
                        className={`w-full rounded-xl border border-dashed px-3 py-2 text-[11px] font-bold uppercase tracking-[0.12em] transition-colors ${
                          isDark
                            ? "border-slate-700 text-slate-400 hover:border-cyan-300/40 hover:text-cyan-100"
                            : "border-slate-300 text-slate-500 hover:border-cyan-300 hover:text-cyan-700"
                        }`}
                      >
                        Show {Math.min(KANBAN_COLUMN_INCREMENT, hiddenRowsCount)} more
                      </button>
                    ) : null}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
        </>
      ) : (
        <>
          <div className="relative z-10 p-2.5 md:hidden">
            <div className="space-y-2.5">
              {visibleLeads.map((lead) => {
                const pendingAmount = getLeadPendingAmount(lead);
                const followUpDue = isFollowUpDue(lead);
                const isStatusMenuOpen = openStatusMenuId === String(lead._id || "");
                return (
                  <div
                    key={lead._id}
                    onClick={() => onOpenLeadDetails(lead)}
                    className={`relative w-full rounded-2xl border p-3.5 text-left transition-all ${
                      isStatusMenuOpen ? "z-50" : "z-0"
                    } ${
                      isDark
                        ? "border-slate-700 bg-slate-950/70 hover:border-cyan-300/40"
                        : "border-slate-200 bg-white hover:border-cyan-300 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-2.5">
                        <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-xs font-bold ${
                          isDark
                            ? "border-cyan-300/30 bg-cyan-500/10 text-cyan-100"
                            : "border-cyan-200 bg-cyan-50 text-cyan-700"
                        }`}>
                          {getLeadInitials(lead.name)}
                        </div>

                        <div className="min-w-0">
                          <p className={`truncate text-sm font-semibold ${isDark ? "text-slate-100" : "text-slate-900"}`}>
                            {lead.name || "Unnamed lead"}
                          </p>
                          <p className={`mt-0.5 truncate text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                            {lead.projectInterested || "Project not set"}
                          </p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            <LeadSourceBadge lead={lead} />
                            {followUpDue ? (
                              <span className="inline-flex rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
                                Overdue
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      <StatusPicker lead={lead} compact />
                    </div>

                    <div className={`mt-3 grid grid-cols-1 gap-1.5 text-xs ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                      <p className="flex items-center gap-1.5">
                        <Phone size={12} />
                        {lead.phone || "-"}
                      </p>
                      <p className="flex items-center gap-1.5 truncate">
                        <Mail size={12} />
                        <span className="truncate">{lead.email || "-"}</span>
                      </p>
                      <p className="flex items-center gap-1.5 truncate">
                        <MapPin size={12} />
                        <span className="truncate">{lead.city || "-"}</span>
                      </p>
                      <p className={`flex items-center gap-1.5 ${followUpDue ? "font-semibold text-rose-600" : ""}`}>
                        <CalendarClock size={12} />
                        Follow-up: {formatDate(lead.nextFollowUp)}
                      </p>
                      <p className={pendingAmount ? (isDark ? "text-amber-200" : "text-amber-700") : ""}>
                        Remaining: {pendingAmount ? formatCurrencyInr(pendingAmount) : "-"}
                      </p>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-[0.13em] ${
                        isDark ? "text-cyan-200" : "text-cyan-700"
                      }`}>
                        Open profile
                        <ArrowUpRight size={12} />
                      </span>
                      {canAssignLead ? (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            onOpenLeadDetails(lead);
                          }}
                          className={`inline-flex h-8 items-center justify-center rounded-lg border px-2.5 text-[10px] font-bold uppercase tracking-[0.1em] ${
                            isDark ? "border-emerald-400/35 text-emerald-100" : "border-emerald-200 text-emerald-700"
                          }`}
                        >
                          Assign / Transfer
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
            {hiddenLeadCount > 0 ? (
              <div className="mt-3 flex justify-center">
                <button
                  type="button"
                  onClick={() => setVisibleLeadCount((count) => count + VISIBLE_LEADS_INCREMENT)}
                  className={`h-10 rounded-xl border px-4 text-xs font-bold uppercase tracking-widest transition-colors ${
                    isDark
                      ? "border-slate-700 bg-slate-950 text-slate-300 hover:border-cyan-300/40 hover:text-cyan-100"
                      : "border-slate-200 bg-white text-slate-600 hover:border-cyan-300 hover:text-cyan-700"
                  }`}
                >
                  Show {Math.min(VISIBLE_LEADS_INCREMENT, hiddenLeadCount)} more leads
                </button>
              </div>
            ) : null}
          </div>

          <div className="relative z-10 hidden flex-1 flex-col md:flex">
            <div className={`grid grid-cols-12 gap-3 border-b px-5 py-3 text-[10px] font-bold uppercase tracking-[0.16em] ${
              isDark ? "border-slate-700 bg-slate-900 text-slate-400" : "border-slate-200 bg-slate-50 text-slate-500"
            }`}>
              <div className="col-span-3">Lead Profile</div>
              <div className="col-span-3">Contact Trail</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2">Follow-up</div>
              <div className="col-span-2">Ownership</div>
            </div>

            <div className="max-h-[66vh] overflow-y-auto p-2.5 custom-scrollbar">
              <div className="space-y-2">
                {visibleLeads.map((lead) => {
                  const pendingAmount = getLeadPendingAmount(lead);
                  const followUpDue = isFollowUpDue(lead);
                  const isStatusMenuOpen = openStatusMenuId === String(lead._id || "");
                  return (
                    <div
                      key={lead._id}
                      onClick={() => onOpenLeadDetails(lead)}
                      className={`group relative grid w-full grid-cols-12 items-center gap-3 overflow-visible rounded-2xl border px-4 py-3 text-left transition-all ${
                        isStatusMenuOpen ? "z-50" : "z-0"
                      } ${
                        isDark
                          ? "border-slate-700 bg-slate-950/65 hover:border-cyan-300/45 hover:bg-slate-900"
                          : "border-slate-200 bg-white hover:border-cyan-300 hover:bg-slate-50"
                      }`}
                    >
                      <div className={`absolute left-0 top-0 h-full w-1 ${
                        followUpDue
                          ? "bg-rose-500"
                          : isDark
                            ? "bg-cyan-400/40"
                            : "bg-cyan-300/70"
                      }`}
                      />

                      <div className="col-span-3 flex min-w-0 items-center gap-2.5">
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-xs font-bold ${
                          isDark
                            ? "border-cyan-300/35 bg-cyan-500/10 text-cyan-100"
                            : "border-cyan-200 bg-cyan-50 text-cyan-700"
                        }`}>
                          {getLeadInitials(lead.name)}
                        </div>

                        <div className="min-w-0">
                          <p className={`truncate text-sm font-semibold ${isDark ? "text-slate-100" : "text-slate-900"}`}>
                          {lead.name || "Unnamed lead"}
                        </p>
                        <p className={`mt-0.5 truncate text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                          {lead.projectInterested || "Project not set"}
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <LeadSourceBadge lead={lead} />
                          {followUpDue ? (
                            <span className="inline-flex rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
                              Overdue
                            </span>
                          ) : null}
                        </div>
                      </div>
                      </div>

                      <div className={`col-span-3 min-w-0 text-xs ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                        <p className="flex items-center gap-1.5 truncate">
                          <Phone size={12} />
                          <span className="truncate">{lead.phone || "-"}</span>
                        </p>
                        <p className="mt-1 flex items-center gap-1.5 truncate">
                          <Mail size={12} />
                          <span className="truncate">{lead.email || "-"}</span>
                        </p>
                        <p className="mt-1 flex items-center gap-1.5 truncate">
                          <MapPin size={12} />
                          <span className="truncate">{lead.city || "-"}</span>
                        </p>
                      </div>

                      <div className="col-span-2">
                        <StatusPicker lead={lead} />
                      </div>

                      <div className={`col-span-2 text-xs ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                        <p className={`inline-flex items-center gap-1.5 ${
                          followUpDue ? "font-semibold text-rose-600" : ""
                        }`}>
                          <CalendarClock size={12} />
                          {formatDate(lead.nextFollowUp)}
                        </p>
                        <p className={`mt-1 ${pendingAmount ? (isDark ? "text-amber-200" : "text-amber-700") : ""}`}>
                          Remaining: {pendingAmount ? formatCurrencyInr(pendingAmount) : "-"}
                        </p>
                      </div>

                      <div className="col-span-2 min-w-0 text-xs">
                        <p className={`truncate font-semibold ${isDark ? "text-cyan-100" : "text-cyan-700"}`}>
                          {lead.assignedTo?.name || "Unassigned"}
                        </p>
                        <div className="mt-1 flex items-center justify-between gap-2">
                          <p className={`truncate ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                            {lead.assignedTo?.role || "Tap to manage"}
                          </p>
                          <ArrowUpRight size={13} className={isDark ? "text-slate-500 group-hover:text-cyan-200" : "text-slate-400 group-hover:text-cyan-600"} />
                        </div>
                        {canAssignLead ? (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              onOpenLeadDetails(lead);
                            }}
                            className={`mt-2 h-8 rounded-lg border px-2 text-[10px] font-bold uppercase tracking-[0.1em] ${
                              isDark ? "border-emerald-400/35 text-emerald-100 hover:bg-emerald-500/10" : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                            }`}
                          >
                            Assign / Transfer
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
              {hiddenLeadCount > 0 ? (
                <div className="mt-3 flex justify-center">
                  <button
                    type="button"
                    onClick={() => setVisibleLeadCount((count) => count + VISIBLE_LEADS_INCREMENT)}
                    className={`h-10 rounded-xl border px-4 text-xs font-bold uppercase tracking-widest transition-colors ${
                      isDark
                        ? "border-slate-700 bg-slate-950 text-slate-300 hover:border-cyan-300/40 hover:text-cyan-100"
                        : "border-slate-200 bg-white text-slate-600 hover:border-cyan-300 hover:text-cyan-700"
                    }`}
                  >
                    Show {Math.min(VISIBLE_LEADS_INCREMENT, hiddenLeadCount)} more leads
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export const AddLeadModal = ({
  isDark,
  formData,
  setFormData,
  inventoryOptions,
  getInventoryLeadLabel,
  onInventorySelection,
  onClose,
  onSave,
  savingLead,
}) => {
  const [customNumberFields, setCustomNumberFields] = React.useState({});
  const inputClass = `h-11 w-full rounded-lg border px-3 text-sm md:h-10 ${
    isDark ? "border-slate-700 bg-slate-950 text-slate-200" : "border-slate-300 bg-white text-slate-700"
  }`;
  const fieldTitleClass = `text-[11px] font-bold uppercase tracking-[0.08em] ${
    isDark ? "text-slate-400" : "text-slate-500"
  }`;
  const sectionCardClass = `rounded-xl border p-3 ${
    isDark ? "border-slate-700 bg-slate-950/55" : "border-slate-200 bg-slate-50/60"
  }`;
  const sectionHeadingClass = `mb-2 text-[11px] font-bold uppercase tracking-[0.14em] ${
    isDark ? "text-slate-400" : "text-slate-500"
  }`;
  const checkboxLabelClass = `inline-flex min-h-10 items-center gap-1.5 rounded border px-2.5 py-2 text-[11px] md:min-h-0 md:px-2 md:py-1 ${
    isDark ? "border-slate-700 bg-slate-900 text-slate-200" : "border-slate-300 bg-white text-slate-700"
  }`;

  const requirementInventoryType = String(formData.requirementsInventoryType || "").trim().toUpperCase();
  const requirementPropertySubtype = String(formData.requirementsPropertySubtype || "").trim().toUpperCase();
  const propertySubtypeOptions = getPropertySubtypeOptions(requirementInventoryType);
  const propertySubtypeConfig = getPropertySubtypeConfig(requirementInventoryType, requirementPropertySubtype);
  const showFurnishing = !propertySubtypeConfig || propertySubtypeConfig.showFurnishing !== false;
  const furnishingOptions = showFurnishing ? FURNISHING_OPTIONS : [];
  const furnishingValue = furnishingOptions.some((option) => option.value === formData.requirementsFurnishingStatus)
    ? formData.requirementsFurnishingStatus
    : "";

  const updateField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const updateRequirementInventoryType = (value) => {
    setFormData((prev) => {
      const nextFurnishingOptions = FURNISHING_OPTIONS;
      const nextFurnishingStatus = nextFurnishingOptions.some(
        (option) => option.value === prev.requirementsFurnishingStatus,
      )
        ? prev.requirementsFurnishingStatus
        : "";
      return {
        ...prev,
        requirementsInventoryType: value,
        requirementsPropertySubtype: "",
        requirementsSubtypeData: {},
        requirementsFurnishingStatus: nextFurnishingStatus,
      };
    });
  };

  const updateRequirementPropertySubtype = (value) => {
    const nextConfig = getPropertySubtypeConfig(requirementInventoryType, value);
    setFormData((prev) => ({
      ...prev,
      requirementsPropertySubtype: value,
      requirementsSubtypeData: {},
      requirementsFurnishingStatus: nextConfig?.showFurnishing === false
        ? ""
        : prev.requirementsFurnishingStatus,
      requirementsAreaMin: "",
      requirementsAreaMax: "",
      requirementsAreaUnit: "SQ_FT",
    }));
  };

  const updateSubtypeField = (fieldKey, value) => {
    setFormData((prev) => ({
      ...prev,
      requirementsSubtypeData: {
        ...(prev.requirementsSubtypeData || {}),
        [fieldKey]: value,
      },
    }));
  };

  const updateCustomNumberField = (fieldKey, isCustom) => {
    setCustomNumberFields((prev) => ({ ...prev, [fieldKey]: isCustom }));
  };

  const renderDynamicField = (field) => {
    const value = formData.requirementsSubtypeData?.[field.key] ?? "";
    const selectOptions = field.options || [];
    const normalizedValue = String(value || "");
    const isCustomNumberValue = field.allowCustomNumber
      && normalizedValue
      && !selectOptions.includes(normalizedValue);
    const isCustomNumberMode = Boolean(customNumberFields[field.key] || isCustomNumberValue);
    const selectValue = isCustomNumberMode ? CUSTOM_NUMBER_OPTION_VALUE : normalizedValue;
    const commonInputProps = {
      className: inputClass,
      placeholder: field.placeholder || field.label,
    };

    if (field.type === "checkbox") {
      return (
        <label key={field.key} className={checkboxLabelClass}>
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(event) => updateSubtypeField(field.key, event.target.checked)}
          />
          {field.label}
        </label>
      );
    }

    return (
      <AddLeadFieldShell fieldTitleClass={fieldTitleClass} key={field.key} title={field.label} className={field.fullWidth ? "md:col-span-2" : ""}>
        {field.type === "select" ? (
          <>
            <AddLeadSelectControl
              inputClass={inputClass}
              isDark={isDark}
              value={selectValue}
              onChange={(event) => {
                if (event.target.value === CUSTOM_NUMBER_OPTION_VALUE) {
                  updateCustomNumberField(field.key, true);
                  updateSubtypeField(field.key, "");
                  return;
                }
                updateCustomNumberField(field.key, false);
                updateSubtypeField(field.key, event.target.value);
              }}
            >
              <option value="">{field.label}</option>
              {selectOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
              {field.allowCustomNumber ? (
                <option value={CUSTOM_NUMBER_OPTION_VALUE}>Custom Number</option>
              ) : null}
            </AddLeadSelectControl>
            {field.allowCustomNumber && isCustomNumberMode ? (
              <input
                type="number"
                min="0"
                step="1"
                value={normalizedValue === CUSTOM_NUMBER_OPTION_VALUE ? "" : normalizedValue}
                onChange={(event) => updateSubtypeField(field.key, event.target.value)}
                placeholder="Enter custom number"
                className={`${inputClass} mt-2`}
              />
            ) : null}
          </>
        ) : field.type === "textarea" ? (
          <textarea
            {...commonInputProps}
            value={value}
            onChange={(event) => updateSubtypeField(field.key, event.target.value)}
            rows={3}
            className={`${inputClass} h-auto min-h-24 py-2`}
          />
        ) : (
          <input
            {...commonInputProps}
            type={field.type === "date" ? "date" : field.type === "number" ? "number" : "text"}
            min={field.min}
            max={field.max}
            step={field.step || (field.type === "number" ? "any" : undefined)}
            value={value}
            onChange={(event) => updateSubtypeField(field.key, event.target.value)}
          />
        )}
      </AddLeadFieldShell>
    );
  };

  return (
    <Motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={`mobile-bottom-sheet fixed inset-0 z-50 flex items-stretch justify-center p-0 sm:items-center sm:p-4 ${
        isDark ? "bg-slate-950/70" : "bg-slate-900/40"
      }`}
    >
      <Motion.div
        initial={{ scale: 0.96, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.96, y: 10 }}
        className={`mobile-fullscreen-panel ui-soft-panel flex h-dvh w-full max-w-3xl flex-col overflow-hidden rounded-none shadow-2xl sm:h-auto sm:max-h-[92vh] sm:rounded-2xl ${
          isDark ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white"
        }`}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700 sm:px-5">
          <h3 className={`text-lg font-bold ${isDark ? "text-slate-100" : "text-slate-900"}`}>Add New Lead</h3>
          <button
            onClick={onClose}
            className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${isDark ? "text-slate-300 hover:bg-slate-800" : "text-slate-600 hover:bg-slate-100"}`}
            aria-label="Close add lead modal"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mobile-modal-scroll custom-scrollbar flex-1 space-y-3 px-3 py-3 sm:px-5">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <AddLeadFieldShell fieldTitleClass={fieldTitleClass} title="Name">
              <input placeholder="Name" value={formData.name} onChange={(event) => updateField("name", event.target.value)} className={inputClass} />
            </AddLeadFieldShell>
            <AddLeadFieldShell fieldTitleClass={fieldTitleClass} title="Phone">
              <input placeholder="Phone" value={formData.phone} onChange={(event) => updateField("phone", event.target.value)} className={inputClass} />
            </AddLeadFieldShell>
            <AddLeadFieldShell fieldTitleClass={fieldTitleClass} title="Email">
              <input placeholder="Email" value={formData.email} onChange={(event) => updateField("email", event.target.value)} className={inputClass} />
            </AddLeadFieldShell>
            <AddLeadFieldShell fieldTitleClass={fieldTitleClass} title="City">
              <input placeholder="City" value={formData.city} onChange={(event) => updateField("city", event.target.value)} className={inputClass} />
            </AddLeadFieldShell>
            <AddLeadFieldShell fieldTitleClass={fieldTitleClass} title="Location" className="md:col-span-2">
              <input
                placeholder="Add multiple locations separated by comma"
                value={formData.preferredLocations}
                onChange={(event) => updateField("preferredLocations", event.target.value)}
                className={inputClass}
              />
            </AddLeadFieldShell>
          </div>

          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <AddLeadFieldShell fieldTitleClass={fieldTitleClass} title="Site Latitude">
              <input placeholder="Site Latitude (optional)" value={formData.siteLat} onChange={(event) => updateField("siteLat", event.target.value)} className={inputClass} />
            </AddLeadFieldShell>
            <AddLeadFieldShell fieldTitleClass={fieldTitleClass} title="Site Longitude">
              <input placeholder="Site Longitude (optional)" value={formData.siteLng} onChange={(event) => updateField("siteLng", event.target.value)} className={inputClass} />
            </AddLeadFieldShell>
          </div>

          <div className={sectionCardClass}>
            <div className={sectionHeadingClass}>Lead Requirement (Inventory Filters)</div>

            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <AddLeadFieldShell fieldTitleClass={fieldTitleClass} title="Inventory Type">
                <AddLeadSelectControl inputClass={inputClass} isDark={isDark} value={formData.requirementsInventoryType} onChange={(event) => updateRequirementInventoryType(event.target.value)}>
                  {INVENTORY_TYPE_OPTIONS.map((option) => (
                    <option key={option.value || "any-inventory-type"} value={option.value}>{option.label}</option>
                  ))}
                </AddLeadSelectControl>
              </AddLeadFieldShell>
              {requirementInventoryType ? (
                <AddLeadFieldShell fieldTitleClass={fieldTitleClass} title={requirementInventoryType === "COMMERCIAL" ? "Commercial Property Type" : "Residential Property Type"}>
                  <AddLeadSelectControl inputClass={inputClass} isDark={isDark} value={formData.requirementsPropertySubtype} onChange={(event) => updateRequirementPropertySubtype(event.target.value)}>
                    <option value="">Property Type (Any)</option>
                    {propertySubtypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </AddLeadSelectControl>
                </AddLeadFieldShell>
              ) : null}
              <AddLeadFieldShell fieldTitleClass={fieldTitleClass} title="Deal Type">
                <AddLeadSelectControl inputClass={inputClass} isDark={isDark} value={formData.requirementsTransactionType} onChange={(event) => updateField("requirementsTransactionType", event.target.value)}>
                  <option value="">Deal Type (Any)</option>
                  <option value="SALE">Purchase</option>
                  <option value="LEASE">Lease</option>
                  <option value="RENT">Rent</option>
                </AddLeadSelectControl>
              </AddLeadFieldShell>
              {showFurnishing ? (
                <AddLeadFieldShell fieldTitleClass={fieldTitleClass} title="Furnishing">
                  <AddLeadSelectControl inputClass={inputClass} isDark={isDark} value={furnishingValue} onChange={(event) => updateField("requirementsFurnishingStatus", event.target.value)}>
                    {furnishingOptions.map((option) => (
                      <option key={option.value || "any-furnishing"} value={option.value}>{option.label}</option>
                    ))}
                  </AddLeadSelectControl>
                </AddLeadFieldShell>
              ) : null}
            </div>

            <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
              <AddLeadFieldShell fieldTitleClass={fieldTitleClass} title="Budget Min">
                <AddLeadAdornedInput type="number" step="any" adornment="₹" inputClass={inputClass} isDark={isDark} placeholder="Budget Min" value={formData.requirementsBudgetMin} onChange={(event) => updateField("requirementsBudgetMin", event.target.value)} />
              </AddLeadFieldShell>
              <AddLeadFieldShell fieldTitleClass={fieldTitleClass} title="Budget Max">
                <AddLeadAdornedInput type="number" step="any" adornment="₹" inputClass={inputClass} isDark={isDark} placeholder="Budget Max" value={formData.requirementsBudgetMax} onChange={(event) => updateField("requirementsBudgetMax", event.target.value)} />
              </AddLeadFieldShell>
            </div>

            {propertySubtypeConfig ? (
              <div className="mt-2">
                <div className={sectionHeadingClass}>{propertySubtypeConfig.label} Preferences</div>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {(propertySubtypeConfig.fields || [])
                    .filter((field) => field.type !== "checkbox")
                    .map(renderDynamicField)}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(propertySubtypeConfig.fields || [])
                    .filter((field) => field.type === "checkbox")
                    .map(renderDynamicField)}
                </div>
              </div>
            ) : null}
          </div>

          <AddLeadFieldShell fieldTitleClass={fieldTitleClass} title="Select Inventory">
            <AddLeadSelectControl
              inputClass={inputClass}
              isDark={isDark}
              value={formData.inventoryId}
              onChange={(event) => onInventorySelection(event.target.value)}
            >
              <option value="">Select Inventory (optional)</option>
              {inventoryOptions.map((inventory) => {
                const inventoryLabel = getInventoryLeadLabel(inventory) || "Inventory Unit";
                const inventoryLocation = getInventoryLocationLabel(inventory);
                const inventoryQuickInfo = getInventoryQuickInfo(inventory);
                const optionText = [
                  inventoryLabel,
                  inventoryLocation,
                  inventoryQuickInfo,
                ]
                  .filter(Boolean)
                  .join(" | ");
                return (
                  <option key={inventory._id} value={inventory._id}>
                    {optionText || inventoryLabel}
                  </option>
                );
              })}
            </AddLeadSelectControl>
          </AddLeadFieldShell>
        </div>

        <div className={`mobile-safe-footer flex shrink-0 gap-2 border-t px-3 pt-3 sm:px-5 sm:pb-3 ${
          isDark ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white"
        }`}>
          <button
            onClick={onClose}
            className={`h-11 flex-1 rounded-lg text-sm font-semibold md:h-10 ${
              isDark ? "bg-slate-800 text-slate-200 hover:bg-slate-700" : "bg-slate-100 text-slate-600"
            }`}
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={savingLead}
            className={`h-11 flex-1 rounded-lg text-sm font-semibold text-white disabled:opacity-60 md:h-10 ${
              isDark ? "bg-emerald-600 hover:bg-emerald-500" : "bg-slate-900 hover:bg-emerald-600"
            }`}
          >
            {savingLead ? "Saving..." : "Save Lead"}
          </button>
        </div>
      </Motion.div>
    </Motion.div>
  );
};

export const BulkLeadUploadModal = ({
  isDark,
  csvText,
  onCsvTextChange,
  selectedFileName,
  onFileSelect,
  onClose,
  onUpload,
  uploading,
}) => (
  <Motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className={`mobile-bottom-sheet fixed inset-0 z-50 flex items-center justify-center p-4 ${
      isDark ? "bg-slate-950/70" : "bg-slate-900/40"
    }`}
  >
    <Motion.div
      initial={{ scale: 0.96, y: 10 }}
      animate={{ scale: 1, y: 0 }}
      exit={{ scale: 0.96, y: 10 }}
      className={`mobile-fullscreen-panel ui-soft-panel flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl p-4 shadow-2xl sm:p-5 ${
        isDark ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white"
      }`}
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className={`text-lg font-bold ${isDark ? "text-slate-100" : "text-slate-900"}`}>
          Bulk Lead Upload
        </h3>
        <button
          onClick={onClose}
          className={`rounded p-1 ${isDark ? "text-slate-300 hover:bg-slate-800" : "text-slate-600 hover:bg-slate-100"}`}
        >
          <X size={16} />
        </button>
      </div>

      <div className="mobile-modal-scroll flex-1 space-y-3">
        <label className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-5 text-sm ${
          isDark
            ? "border-slate-600 bg-slate-950 text-slate-300 hover:border-cyan-400/45"
            : "border-slate-300 bg-slate-50 text-slate-700 hover:border-cyan-400"
        }`}
        >
          <UploadCloud size={16} />
          <span>{selectedFileName ? `Selected: ${selectedFileName}` : "Choose Excel / CSV File"}</span>
          <input
            type="file"
            accept=".xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            className="hidden"
            onChange={(event) => onFileSelect(event.target.files?.[0] || null)}
          />
        </label>

        <div>
          <p className={`mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${
            isDark ? "text-slate-400" : "text-slate-500"
          }`}>
            Bulk Sheet Format
          </p>
          <p className={`rounded-lg border px-3 py-2 text-xs font-mono ${
            isDark ? "border-slate-700 bg-slate-950 text-slate-300" : "border-slate-200 bg-slate-50 text-slate-600"
          }`}>
            NAME, CONTACT/NUMBER, COMMENT, COMPANY, REQUIREMENT, BUDGET, LOCATION, VISIT, HANDLE, SOURCE
          </p>
        </div>

        <textarea
          value={csvText}
          onChange={(event) => onCsvTextChange(event.target.value)}
          placeholder="Paste CSV content here, or choose the PRE - SALES - LEADS Excel workbook"
          rows={10}
          className={`w-full resize-y rounded-xl border px-3 py-2 text-sm ${
            isDark
              ? "border-slate-700 bg-slate-950 text-slate-200 placeholder:text-slate-500"
              : "border-slate-300 bg-white text-slate-700 placeholder:text-slate-400"
          }`}
        />
      </div>

      <div className="mobile-safe-footer mt-4 flex gap-2">
        <button
          onClick={onClose}
          className={`h-10 flex-1 rounded-lg text-sm font-semibold ${
            isDark ? "bg-slate-800 text-slate-200 hover:bg-slate-700" : "bg-slate-100 text-slate-600"
          }`}
        >
          Cancel
        </button>
        <button
          onClick={onUpload}
          disabled={uploading}
          className={`h-10 flex-1 rounded-lg text-sm font-semibold text-white disabled:opacity-60 ${
            isDark ? "bg-cyan-600 hover:bg-cyan-500" : "bg-slate-900 hover:bg-cyan-600"
          }`}
        >
          {uploading ? "Uploading..." : "Upload Leads"}
        </button>
      </div>
    </Motion.div>
  </Motion.div>
);

export const LeadDetailsDrawer = ({
  layoutMode = "drawer",
  isDark,
  selectedLead,
  onClose,
  selectedLeadDialerHref,
  selectedLeadWhatsAppHref,
  selectedLeadMailHref,
  selectedLeadMapsHref,
  selectedLeadRelatedInventories,
  selectedLeadActiveInventoryId,
  propertyActionType,
  propertyActionInventoryId,
  canManageLeadProperties,
  canUpdateRelatedPropertyStatus,
  propertyStatusActionInventoryId,
  propertyStatusRequiresApproval,
  inventoryStatusOptions,
  toInventoryApiStatus,
  toInventoryStatusLabel,
  onSelectRelatedProperty,
  onOpenRelatedProperty,
  onRemoveRelatedProperty,
  onUpdateRelatedPropertyStatus,
  availableRelatedInventoryOptions,
  relatedInventoryDraft,
  setRelatedInventoryDraft,
  linkingProperty,
  onLinkPropertyToLead,
  leadStatuses,
  statusDraft,
  setStatusDraft,
  followUpDraft,
  setFollowUpDraft,
  dealPaymentModes,
  dealPaymentTypes,
  dealPaymentAdminDecisions,
  paymentModeDraft,
  setPaymentModeDraft,
  paymentTypeDraft,
  setPaymentTypeDraft,
  paymentRemainingDraft,
  setPaymentRemainingDraft,
  paymentReferenceDraft,
  setPaymentReferenceDraft,
  paymentNoteDraft,
  setPaymentNoteDraft,
  paymentApprovalStatusDraft,
  setPaymentApprovalStatusDraft,
  paymentApprovalNoteDraft,
  setPaymentApprovalNoteDraft,
  canReviewDealPayment,
  siteLatDraft,
  setSiteLatDraft,
  siteLngDraft,
  setSiteLngDraft,
  canConfigureSiteLocation,
  selectedLeadSiteLat,
  selectedLeadSiteLng,
  siteVisitRadiusMeters,
  userRole,
  onUpdateLead,
  savingUpdates,
  canAssignLead,
  executiveDraft,
  setExecutiveDraft,
  executives,
  onAssignLead,
  assigning,
  diaryDraft,
  setDiaryDraft,
  onDiaryVoiceToggle,
  savingDiary,
  isDiaryMicSupported,
  isDiaryListening,
  onAddDiary,
  diaryLoading,
  diaryEntries,
  activityLoading,
  activities,
  formatDate,
  getInventoryLeadLabel,
  toObjectIdString,
  WhatsAppIcon,
}) => {
  const isPageLayout = layoutMode === "page";
  const isClosedDealFlow =
    ["CLOSED", "REQUESTED"].includes(statusDraft)
    || ["CLOSED", "REQUESTED"].includes(String(selectedLead?.status || ""));
  const currentApprovalStatus = String(
    paymentApprovalStatusDraft || selectedLead?.dealPayment?.approvalStatus || "PENDING",
  ).toUpperCase();
  const showRemainingAmountField = paymentTypeDraft === "PARTIAL";
  const requiresPaymentReference = Boolean(paymentModeDraft) && paymentModeDraft !== "CASH";

  const getApprovalTone = (approvalStatus) => {
    if (approvalStatus === "APPROVED") {
      return isDark
        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-100"
        : "border-emerald-200 bg-emerald-50 text-emerald-700";
    }
    if (approvalStatus === "REJECTED") {
      return isDark
        ? "border-rose-500/40 bg-rose-500/10 text-rose-100"
        : "border-rose-200 bg-rose-50 text-rose-700";
    }
    return isDark
      ? "border-amber-500/40 bg-amber-500/10 text-amber-100"
      : "border-amber-200 bg-amber-50 text-amber-700";
  };

  const getApprovalLabel = (approvalStatus) => {
    if (approvalStatus === "APPROVED") return "Approved";
    if (approvalStatus === "REJECTED") return "Rejected";
    return "Pending";
  };

  const resolvedStatusLabel = String(statusDraft || selectedLead?.status || "NEW").replaceAll("_", " ");
  const followUpPreviewLabel = formatDate(followUpDraft || selectedLead?.nextFollowUp);
  const paymentModeLabel = dealPaymentModes.find(
    (mode) => String(mode?.value || "") === String(paymentModeDraft || selectedLead?.dealPayment?.mode || ""),
  )?.label || "Not Set";
  const paymentTypeLabel = dealPaymentTypes.find(
    (paymentType) => String(paymentType?.value || "") === String(paymentTypeDraft || selectedLead?.dealPayment?.paymentType || ""),
  )?.label || "Not Set";
  const activeRelatedProperty = selectedLeadRelatedInventories.find(
    (inventory) => String(toObjectIdString(inventory)) === String(selectedLeadActiveInventoryId || ""),
  );
  const activePropertyLabel = getInventoryLeadLabel(activeRelatedProperty) || "Not selected";
  const leadOverviewPills = [
    {
      label: "Assigned To",
      value: selectedLead?.assignedTo?.name || "Unassigned",
    },
    {
      label: "Next Follow-up",
      value: followUpPreviewLabel,
    },
    {
      label: "Payment Approval",
      value: getApprovalLabel(currentApprovalStatus),
    },
    {
      label: "Linked Properties",
      value: String(selectedLeadRelatedInventories.length || 0),
    },
    {
      label: "Primary Property",
      value: activePropertyLabel,
    },
    {
      label: "Deal Mode",
      value: `${paymentModeLabel} / ${paymentTypeLabel}`,
    },
  ];

  return (
    <>
      {!isPageLayout ? (
        <Motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className={`fixed inset-0 z-50 ${isDark ? "bg-slate-950/70" : "bg-slate-900/45"}`}
        />
      ) : null}

      <Motion.aside
        initial={isPageLayout ? { opacity: 0, y: 18 } : { x: 420 }}
        animate={isPageLayout ? { opacity: 1, y: 0 } : { x: 0 }}
        exit={isPageLayout ? { opacity: 0, y: 18 } : { x: 420 }}
        className={`${
          isPageLayout
            ? "relative z-10 flex min-h-[calc(100vh-8rem)] w-full flex-1 flex-col overflow-hidden rounded-2xl border shadow-2xl"
            : "fixed top-0 right-0 z-50 flex h-full w-full max-w-md flex-col border-l shadow-2xl"
        } ${isDark ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white"}`}
      >
      <div
        className={`border-b ${
          isPageLayout ? "px-5 py-4 sm:px-6 lg:px-8" : "px-4 py-3"
        } ${
          isDark ? "border-slate-700 bg-slate-900/95" : "border-slate-200 bg-slate-50/95"
        }`}
        style={{
          backgroundImage: isDark
            ? "radial-gradient(circle at 92% 0%, rgba(16,185,129,0.2), transparent 35%)"
            : "radial-gradient(circle at 92% 0%, rgba(16,185,129,0.16), transparent 35%)",
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${
              isDark ? "text-emerald-200" : "text-emerald-700"
            }`}>
              Lead Profile
            </p>
            <h3 className={`truncate font-bold ${
              isPageLayout ? "text-xl sm:text-2xl" : "text-lg"
            } ${isDark ? "text-slate-100" : "text-slate-900"}`}>
              {selectedLead.name}
            </h3>
            <p className={`truncate text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              {selectedLead.projectInterested || "Project not tagged yet"}
            </p>
          </div>
          <button
            onClick={onClose}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] ${
              isDark ? "text-slate-300 hover:bg-slate-800" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {isPageLayout ? (
              <span className="inline-flex items-center gap-1">
                <ArrowLeft size={13} />
                Back
              </span>
            ) : (
              <X size={16} />
            )}
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] ${
            isDark ? "border-cyan-400/45 bg-cyan-500/15 text-cyan-100" : "border-cyan-300 bg-cyan-50 text-cyan-700"
          }`}>
            {resolvedStatusLabel}
          </span>
          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
            isDark ? "border-slate-700 bg-slate-800 text-slate-300" : "border-slate-300 bg-white text-slate-600"
          }`}>
            ID: {String(selectedLead._id || "").slice(-6).toUpperCase()}
          </span>
        </div>

        {isPageLayout ? (
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {leadOverviewPills.map((pill) => (
              <div
                key={pill.label}
                className={`rounded-xl border px-3 py-2 ${
                  isDark ? "border-slate-700 bg-slate-950/65" : "border-slate-200 bg-white"
                }`}
              >
                <p className={`text-[10px] font-semibold uppercase tracking-[0.12em] ${
                  isDark ? "text-slate-400" : "text-slate-500"
                }`}>
                  {pill.label}
                </p>
                <p className={`mt-1 truncate text-xs font-semibold ${
                  isDark ? "text-slate-100" : "text-slate-800"
                }`}>
                  {pill.value || "-"}
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className={`flex-1 overflow-y-auto ${
        isPageLayout ? "p-4 sm:p-5 lg:p-6" : "p-4"
      } custom-scrollbar`}>
        <div className={isPageLayout ? "grid grid-cols-1 gap-4 xl:grid-cols-12" : "space-y-4"}>
        <div className={`rounded-2xl border p-3 ${isPageLayout ? "xl:col-span-5" : ""} ${
          isDark ? "border-slate-700 bg-slate-950/65" : "border-slate-200 bg-white"
        }`}>
          <div className={`text-xs font-bold uppercase tracking-widest ${
            isDark ? "text-slate-400" : "text-slate-500"
          }`}>Contact Channels</div>

          <div className="mt-2 grid grid-cols-2 gap-2">
            {selectedLeadDialerHref ? (
              <a
                href={selectedLeadDialerHref}
                className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border text-xs font-semibold ${
                  isDark
                    ? "border-slate-700 bg-slate-900 text-slate-200 hover:border-emerald-400/45 hover:text-emerald-200"
                    : "border-slate-300 bg-white text-slate-700 hover:border-emerald-400 hover:text-emerald-700"
                }`}
              >
                <Phone size={13} />
                Call
              </a>
            ) : (
              <button
                type="button"
                disabled
                className={`h-9 rounded-lg border text-xs font-semibold opacity-50 ${
                  isDark ? "border-slate-700 bg-slate-900 text-slate-400" : "border-slate-300 bg-slate-100 text-slate-500"
                }`}
              >
                Call
              </button>
            )}

            {selectedLeadWhatsAppHref ? (
              <a
                href={selectedLeadWhatsAppHref}
                target="_blank"
                rel="noreferrer"
                aria-label={`Open WhatsApp chat for ${selectedLead.phone}`}
                className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border text-xs font-semibold ${
                  isDark
                    ? "border-slate-700 bg-slate-900 text-slate-200 hover:border-emerald-400/45 hover:text-emerald-200"
                    : "border-slate-300 bg-white text-slate-700 hover:border-emerald-400 hover:text-emerald-700"
                }`}
              >
                {React.createElement(WhatsAppIcon, { size: 12 })}
                WhatsApp
              </a>
            ) : (
              <button
                type="button"
                disabled
                className={`h-9 rounded-lg border text-xs font-semibold opacity-50 ${
                  isDark ? "border-slate-700 bg-slate-900 text-slate-400" : "border-slate-300 bg-slate-100 text-slate-500"
                }`}
              >
                WhatsApp
              </button>
            )}

            {selectedLeadMailHref ? (
              <a
                href={selectedLeadMailHref}
                className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border text-xs font-semibold ${
                  isDark
                    ? "border-slate-700 bg-slate-900 text-slate-200 hover:border-emerald-400/45 hover:text-emerald-200"
                    : "border-slate-300 bg-white text-slate-700 hover:border-emerald-400 hover:text-emerald-700"
                }`}
              >
                <Mail size={13} />
                Email
              </a>
            ) : (
              <button
                type="button"
                disabled
                className={`h-9 rounded-lg border text-xs font-semibold opacity-50 ${
                  isDark ? "border-slate-700 bg-slate-900 text-slate-400" : "border-slate-300 bg-slate-100 text-slate-500"
                }`}
              >
                Email
              </button>
            )}

            {selectedLeadMapsHref ? (
              <a
                href={selectedLeadMapsHref}
                target="_blank"
                rel="noreferrer"
                className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border text-xs font-semibold ${
                  isDark
                    ? "border-slate-700 bg-slate-900 text-slate-200 hover:border-emerald-400/45 hover:text-emerald-200"
                    : "border-slate-300 bg-white text-slate-700 hover:border-emerald-400 hover:text-emerald-700"
                }`}
              >
                <MapPin size={13} />
                Maps
              </a>
            ) : (
              <button
                type="button"
                disabled
                className={`h-9 rounded-lg border text-xs font-semibold opacity-50 ${
                  isDark ? "border-slate-700 bg-slate-900 text-slate-400" : "border-slate-300 bg-slate-100 text-slate-500"
                }`}
              >
                Maps
              </button>
            )}
          </div>

          <div className={`mt-3 space-y-1.5 text-sm ${isDark ? "text-slate-200" : "text-slate-700"}`}>
            <div className="flex items-center gap-2">
              <Phone size={13} />
              <span>{selectedLead.phone || "-"}</span>
            </div>
            <div className="flex items-center gap-2 break-all">
              <Mail size={13} />
              <span>{selectedLead.email || "-"}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin size={13} />
              <span>{selectedLead.city || "-"}</span>
            </div>
            <div className="flex items-center gap-2">
              <Building2 size={13} />
              <span>{selectedLead.projectInterested || "-"}</span>
            </div>
            <div className="pt-2">
              <div className={`mb-1 text-[10px] font-bold uppercase tracking-wider ${
                isDark ? "text-slate-400" : "text-slate-500"
              }`}>
                Related Properties
              </div>

              {selectedLeadRelatedInventories.length === 0 ? (
                <div className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>No property linked yet</div>
              ) : (
                <div className="space-y-1">
                  {selectedLeadRelatedInventories.map((inventory) => {
                    const inventoryId = toObjectIdString(inventory);
                    const inventoryLabel = getInventoryLeadLabel(inventory);
                    const inventoryLocation = getInventoryLocationLabel(inventory);
                    const inventoryStatus = toInventoryApiStatus(inventory?.status);
                    const inventoryStatusLabel = toInventoryStatusLabel(inventory?.status);
                    const inventoryQuickInfo = getInventoryQuickInfo(inventory);
                    const fallbackLabel = inventoryId
                      ? `Inventory ${inventoryId.slice(-6)}`
                      : "Inventory";
                    const isActiveProperty =
                      String(selectedLeadActiveInventoryId || "") === String(inventoryId || "");
                    const isSelectingThisProperty =
                      propertyActionType === "select"
                      && String(propertyActionInventoryId || "") === String(inventoryId || "");
                    const isRemovingThisProperty =
                      propertyActionType === "remove"
                      && String(propertyActionInventoryId || "") === String(inventoryId || "");
                    const isUpdatingThisPropertyStatus =
                      String(propertyStatusActionInventoryId || "") === String(inventoryId || "");

                    return (
                      <div
                        key={inventoryId || fallbackLabel}
                        onClick={() => {
                          if (!inventoryId || isSelectingThisProperty || isRemovingThisProperty) {
                            return;
                          }
                          onSelectRelatedProperty(inventoryId);
                        }}
                        className={`rounded-lg border px-2 py-1 text-xs ${
                          isActiveProperty
                            ? isDark
                              ? "border-emerald-400/45 bg-emerald-500/12"
                              : "border-emerald-300 bg-emerald-50/60"
                            : isDark
                              ? "border-slate-700 bg-slate-900 hover:border-emerald-400/35"
                              : "border-slate-200 bg-white hover:border-emerald-200"
                        } ${
                          inventoryId && !isSelectingThisProperty && !isRemovingThisProperty
                            ? "cursor-pointer"
                            : ""
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className={`break-words font-semibold ${isDark ? "text-slate-100" : "text-slate-700"}`}>
                              {inventoryLabel || fallbackLabel}
                              {inventoryLocation ? ` (${inventoryLocation})` : ""}
                            </div>
                            {isActiveProperty && (
                              <div className={`text-[10px] ${isDark ? "text-emerald-200" : "text-emerald-700"}`}>
                                Active property for site coordinates
                              </div>
                            )}
                            <div className={`text-[10px] mt-0.5 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                              Status: {inventoryStatusLabel || "-"}
                            </div>
                            {inventoryQuickInfo ? (
                              <div className={`text-[10px] mt-0.5 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                                {inventoryQuickInfo}
                              </div>
                            ) : null}
                          </div>

                          {canManageLeadProperties && inventoryId && (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  onOpenRelatedProperty(inventoryId);
                                }}
                                disabled={isSelectingThisProperty || isRemovingThisProperty}
                                className={`inline-flex h-6 w-6 items-center justify-center rounded border disabled:cursor-not-allowed disabled:opacity-60 ${
                                  isDark
                                    ? "border-slate-600 bg-slate-800 text-slate-300 hover:text-emerald-200"
                                    : "border-slate-300 bg-white text-slate-600 hover:text-emerald-700"
                                }`}
                                title="Open property details"
                              >
                                {isSelectingThisProperty ? (
                                  <Loader size={12} className="animate-spin" />
                                ) : (
                                  <Eye size={12} />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  onRemoveRelatedProperty(inventoryId);
                                }}
                                disabled={isRemovingThisProperty || isSelectingThisProperty}
                                className={`inline-flex h-6 w-6 items-center justify-center rounded border disabled:cursor-not-allowed disabled:opacity-60 ${
                                  isDark
                                    ? "border-slate-600 bg-slate-800 text-slate-300 hover:text-rose-300"
                                    : "border-slate-300 bg-white text-slate-600 hover:text-rose-600"
                                }`}
                                title="Delete property from lead"
                              >
                                {isRemovingThisProperty ? (
                                  <Loader size={12} className="animate-spin" />
                                ) : (
                                  <Trash2 size={12} />
                                )}
                              </button>
                            </div>
                          )}
                        </div>

                        {canUpdateRelatedPropertyStatus && inventoryId && isClosedDealFlow ? (
                          <div className="mt-2" onClick={(event) => event.stopPropagation()}>
                            <div className="flex items-center gap-2">
                              <select
                                value={inventoryStatus}
                                onChange={(event) => onUpdateRelatedPropertyStatus(inventoryId, event.target.value)}
                                disabled={isUpdatingThisPropertyStatus || isSelectingThisProperty || isRemovingThisProperty}
                                className={`h-7 rounded-lg border px-2 text-[11px] font-semibold ${
                                  isDark
                                    ? "border-slate-600 bg-slate-900 text-slate-200"
                                    : "border-slate-300 bg-white text-slate-700"
                                } disabled:cursor-not-allowed disabled:opacity-60`}
                              >
                                {inventoryStatusOptions.map((statusOption) => (
                                  <option key={statusOption.value} value={statusOption.value}>
                                    {statusOption.label}
                                  </option>
                                ))}
                              </select>
                              {isUpdatingThisPropertyStatus ? (
                                <span className={`inline-flex items-center gap-1 text-[10px] ${
                                  isDark ? "text-slate-400" : "text-slate-500"
                                }`}>
                                  <Loader size={11} className="animate-spin" />
                                  Updating...
                                </span>
                              ) : null}
                            </div>
                            {propertyStatusRequiresApproval ? (
                              <div className={`mt-1 text-[10px] ${
                                isDark ? "text-emerald-200" : "text-emerald-700"
                              }`}>
                                Status update goes for admin approval.
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}

              {canManageLeadProperties && (
                <div className={`mt-2 rounded-xl border p-2.5 ${
                  isDark ? "border-slate-700 bg-slate-900/75" : "border-slate-200 bg-slate-50"
                }`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-[10px] font-semibold uppercase tracking-[0.12em] ${
                      isDark ? "text-slate-400" : "text-slate-500"
                    }`}>
                      Quick Link Property
                    </p>
                    <span className={`text-[10px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                      {availableRelatedInventoryOptions.length} available
                    </span>
                  </div>

                  <div className="mt-2 flex items-center gap-2">
                    <div className="relative flex-1">
                      <Building2
                        size={13}
                        className={`pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 ${
                          isDark ? "text-slate-500" : "text-slate-400"
                        }`}
                      />
                      <select
                        value={relatedInventoryDraft}
                        onChange={(event) => {
                          const selectedInventoryId = String(event.target.value || "");
                          setRelatedInventoryDraft(selectedInventoryId);
                        }}
                        disabled={linkingProperty || availableRelatedInventoryOptions.length === 0}
                        className={`h-9 w-full rounded-lg border pl-8 pr-2 text-xs ${
                          isDark ? "border-slate-700 bg-slate-950 text-slate-200" : "border-slate-300 bg-white text-slate-700"
                        } disabled:cursor-not-allowed disabled:opacity-60`}
                      >
                        <option value="">
                          {linkingProperty
                            ? "Linking property..."
                            : availableRelatedInventoryOptions.length === 0
                              ? "All available properties already linked"
                              : "Select property to link"}
                        </option>
                        {[...availableRelatedInventoryOptions]
                          .sort((a, b) => {
                            const aText = `${String(a?.location || "")} ${getInventoryLeadLabel(a)}`.toLowerCase();
                            const bText = `${String(b?.location || "")} ${getInventoryLeadLabel(b)}`.toLowerCase();
                            return aText.localeCompare(bText);
                          })
                          .map((inventory) => {
                            const inventoryLabel = getInventoryLeadLabel(inventory) || "Inventory Unit";
                            const inventoryLocation = getInventoryLocationLabel(inventory);
                            const inventoryQuickInfo = getInventoryQuickInfo(inventory);
                            const inventoryStatus = String(inventory.status || "").trim();
                            const price = Number(inventory?.price);
                            const priceLabel = Number.isFinite(price) && price > 0
                              ? `Rs ${price.toLocaleString("en-IN")}`
                              : "";
                            const optionText = [
                              inventoryLabel,
                              inventoryLocation,
                              inventoryQuickInfo,
                              priceLabel,
                              inventoryStatus,
                            ]
                              .filter(Boolean)
                              .join(" | ");

                            return (
                              <option key={inventory._id} value={inventory._id}>
                                {optionText || inventoryLabel}
                              </option>
                            );
                          })}
                      </select>
                    </div>

                    <button
                      type="button"
                      onClick={() => onLinkPropertyToLead(relatedInventoryDraft)}
                      disabled={!relatedInventoryDraft || linkingProperty || availableRelatedInventoryOptions.length === 0}
                      className={`inline-flex h-9 items-center justify-center gap-1 rounded-lg px-3 text-[11px] font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${
                        isDark
                          ? "bg-emerald-600 text-white hover:bg-emerald-500"
                          : "bg-slate-900 text-white hover:bg-emerald-600"
                      }`}
                    >
                      {linkingProperty ? <Loader size={12} className="animate-spin" /> : <Plus size={12} />}
                      Add
                    </button>
                  </div>

                  <p className={`mt-2 text-[10px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                    Choose a property and tap Add to link it with this lead.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className={`rounded-2xl border p-3 space-y-3 ${isPageLayout ? "xl:col-span-7" : ""} ${
          isDark ? "border-slate-700 bg-slate-950/65" : "border-slate-200 bg-white"
        }`}>
          <div className={`text-xs font-bold uppercase tracking-widest ${
            isDark ? "text-slate-400" : "text-slate-500"
          }`}>Lead Controls</div>

          <div>
            <label className={`text-[10px] uppercase tracking-wider font-bold ${isDark ? "text-slate-400" : "text-slate-500"}`}>Status</label>
            <select
              value={statusDraft}
              onChange={(event) => setStatusDraft(event.target.value)}
              className={`mt-1 w-full h-10 rounded-xl border px-3 text-sm ${
                isDark ? "border-slate-700 bg-slate-900 text-slate-200" : "border-slate-300 bg-white text-slate-700"
              }`}
            >
              {leadStatuses.map((status) => (
                <option
                  key={status}
                  value={status}
                  disabled={!canReviewDealPayment && status === "REQUESTED"}
                >
                  {String(status).replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={`text-[10px] uppercase tracking-wider font-bold flex items-center gap-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              <CalendarClock size={12} /> Next Follow-up
            </label>
            <input
              type="datetime-local"
              value={followUpDraft}
              onChange={(event) => setFollowUpDraft(event.target.value)}
              className={`mt-1 w-full h-10 rounded-xl border px-3 text-sm ${
                isDark ? "border-slate-700 bg-slate-900 text-slate-200" : "border-slate-300 bg-white text-slate-700"
              }`}
            />
          </div>

          {isClosedDealFlow && (
            <div className={`rounded-xl border p-3 space-y-3 ${
              isDark ? "border-slate-700 bg-slate-900/80" : "border-slate-200 bg-slate-50"
            }`}>
              <div className={`text-[10px] uppercase tracking-wider font-bold ${
                isDark ? "text-slate-400" : "text-slate-500"
              }`}>
                Deal Payment & Approval
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={`text-[10px] uppercase tracking-wider font-bold ${
                    isDark ? "text-slate-400" : "text-slate-500"
                  }`}>
                    Payment Mode
                  </label>
                  <select
                    value={paymentModeDraft}
                    onChange={(event) => {
                      const nextMode = String(event.target.value || "");
                      setPaymentModeDraft(nextMode);
                      if (nextMode === "CASH") {
                        setPaymentReferenceDraft("");
                      }
                    }}
                    className={`mt-1 w-full h-9 rounded-lg border px-2 text-xs ${
                      isDark ? "border-slate-700 bg-slate-950 text-slate-200" : "border-slate-300 bg-white text-slate-700"
                    }`}
                  >
                    <option value="">Select mode</option>
                    {dealPaymentModes.map((mode) => (
                      <option key={mode.value} value={mode.value}>
                        {mode.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={`text-[10px] uppercase tracking-wider font-bold ${
                    isDark ? "text-slate-400" : "text-slate-500"
                  }`}>
                    Payment Type
                  </label>
                  <select
                    value={paymentTypeDraft}
                    onChange={(event) => setPaymentTypeDraft(event.target.value)}
                    className={`mt-1 w-full h-9 rounded-lg border px-2 text-xs ${
                      isDark ? "border-slate-700 bg-slate-950 text-slate-200" : "border-slate-300 bg-white text-slate-700"
                    }`}
                  >
                    <option value="">Select type</option>
                    {dealPaymentTypes.map((paymentType) => (
                      <option key={paymentType.value} value={paymentType.value}>
                        {paymentType.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {requiresPaymentReference && (
                <div>
                  <label className={`text-[10px] uppercase tracking-wider font-bold ${
                    isDark ? "text-slate-400" : "text-slate-500"
                  }`}>
                    UTR / Txn / Cheque No.
                  </label>
                  <input
                    type="text"
                    value={paymentReferenceDraft}
                    onChange={(event) => setPaymentReferenceDraft(event.target.value)}
                    placeholder="Enter payment reference number"
                    maxLength={120}
                    className={`mt-1 w-full h-9 rounded-lg border px-3 text-sm ${
                      isDark ? "border-slate-700 bg-slate-950 text-slate-200" : "border-slate-300 bg-white text-slate-700"
                    }`}
                  />
                  <div className={`mt-1 text-[10px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                    Mandatory for non-cash payments
                  </div>
                </div>
              )}

              {showRemainingAmountField && (
                <div>
                  <label className={`text-[10px] uppercase tracking-wider font-bold ${
                    isDark ? "text-slate-400" : "text-slate-500"
                  }`}>
                    Remaining Amount
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={paymentRemainingDraft}
                    onChange={(event) => setPaymentRemainingDraft(event.target.value)}
                    placeholder="Enter pending amount"
                    className={`mt-1 w-full h-9 rounded-lg border px-3 text-sm ${
                      isDark ? "border-slate-700 bg-slate-950 text-slate-200" : "border-slate-300 bg-white text-slate-700"
                    }`}
                  />
                </div>
              )}

              <div>
                <label className={`text-[10px] uppercase tracking-wider font-bold ${
                  isDark ? "text-slate-400" : "text-slate-500"
                }`}>
                  Executive Note
                </label>
                <textarea
                  value={paymentNoteDraft}
                  onChange={(event) => setPaymentNoteDraft(event.target.value)}
                  placeholder="Add payment proof/reference or context for admin..."
                  maxLength={1000}
                  className={`mt-1 w-full min-h-[68px] rounded-lg border px-3 py-2 text-xs resize-y ${
                    isDark
                      ? "border-slate-700 bg-slate-950 text-slate-200 placeholder:text-slate-500"
                      : "border-slate-300 bg-white text-slate-700 placeholder:text-slate-400"
                  }`}
                />
                <div className={`mt-1 text-[10px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  {String(paymentNoteDraft || "").length}/1000
                </div>
              </div>

              <div className={`rounded-lg border px-2 py-1.5 text-xs ${
                getApprovalTone(currentApprovalStatus)
              }`}>
                Payment Approval Status: {getApprovalLabel(currentApprovalStatus)}
              </div>

              {!canReviewDealPayment && (
                <div className={`text-[10px] ${
                  isDark ? "text-slate-400" : "text-slate-500"
                }`}>
                  Executive close request remains REQUESTED until admin approves or rejects it.
                </div>
              )}

              {canReviewDealPayment && (
                <div className="space-y-2">
                  <div>
                    <label className={`text-[10px] uppercase tracking-wider font-bold ${
                      isDark ? "text-slate-400" : "text-slate-500"
                    }`}>
                      Admin Decision
                    </label>
                    <select
                      value={paymentApprovalStatusDraft}
                      onChange={(event) => setPaymentApprovalStatusDraft(event.target.value)}
                      className={`mt-1 w-full h-9 rounded-lg border px-2 text-xs ${
                        isDark ? "border-slate-700 bg-slate-950 text-slate-200" : "border-slate-300 bg-white text-slate-700"
                      }`}
                    >
                      <option value="">Keep current status</option>
                      {dealPaymentAdminDecisions.map((decision) => (
                        <option key={decision.value} value={decision.value}>
                          {decision.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className={`text-[10px] uppercase tracking-wider font-bold ${
                      isDark ? "text-slate-400" : "text-slate-500"
                    }`}>
                      Admin Note
                    </label>
                    <textarea
                      value={paymentApprovalNoteDraft}
                      onChange={(event) => setPaymentApprovalNoteDraft(event.target.value)}
                      placeholder="Add approval/rejection reason..."
                      maxLength={1000}
                      className={`mt-1 w-full min-h-[60px] rounded-lg border px-3 py-2 text-xs resize-y ${
                        isDark
                          ? "border-slate-700 bg-slate-950 text-slate-200 placeholder:text-slate-500"
                          : "border-slate-300 bg-white text-slate-700 placeholder:text-slate-400"
                      }`}
                    />
                    <div className={`mt-1 text-[10px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                      {String(paymentApprovalNoteDraft || "").length}/1000
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className={`rounded-xl border p-3 ${
            isDark ? "border-slate-700 bg-slate-900/80" : "border-slate-200 bg-slate-50"
          }`}>
            <div className={`mb-2 text-[10px] uppercase tracking-wider font-bold ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              Site Location
            </div>

            {canConfigureSiteLocation ? (
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  step="any"
                  value={siteLatDraft}
                  onChange={(event) => setSiteLatDraft(event.target.value)}
                  placeholder="Latitude"
                  className={`w-full h-9 rounded-lg border px-3 text-sm ${
                    isDark ? "border-slate-700 bg-slate-950 text-slate-200" : "border-slate-300 bg-white text-slate-700"
                  }`}
                />
                <input
                  type="number"
                  step="any"
                  value={siteLngDraft}
                  onChange={(event) => setSiteLngDraft(event.target.value)}
                  placeholder="Longitude"
                  className={`w-full h-9 rounded-lg border px-3 text-sm ${
                    isDark ? "border-slate-700 bg-slate-950 text-slate-200" : "border-slate-300 bg-white text-slate-700"
                  }`}
                />
              </div>
            ) : (
              <div className={`text-xs ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                {selectedLeadSiteLat !== null && selectedLeadSiteLng !== null
                  ? `${selectedLeadSiteLat}, ${selectedLeadSiteLng}`
                  : "Not configured by admin/manager"}
              </div>
            )}

            <div className={`mt-2 text-[10px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              Site visit status is verified within {siteVisitRadiusMeters} meters.
            </div>
          </div>

          {userRole === "FIELD_EXECUTIVE" && statusDraft === "SITE_VISIT" && (
            <div className={`rounded-lg border p-2 text-[11px] ${
              isDark ? "border-amber-500/35 bg-amber-500/15 text-amber-100" : "border-amber-200 bg-amber-50 text-amber-800"
            }`}>
              SITE_VISIT will be accepted only if your live location is within {siteVisitRadiusMeters} meters of configured site location.
            </div>
          )}

          <button
            onClick={onUpdateLead}
            disabled={savingUpdates}
            className={`w-full h-10 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60 ${
              isDark ? "bg-emerald-600 hover:bg-emerald-500" : "bg-slate-900 hover:bg-emerald-600"
            }`}
          >
            {savingUpdates ? <Loader size={14} className="animate-spin" /> : <Save size={14} />}
            Save Lead Update
          </button>
        </div>

        {canAssignLead && (
          <div className={`rounded-2xl border p-3 space-y-3 ${isPageLayout ? "xl:col-span-4" : ""} ${
            isDark ? "border-slate-700 bg-slate-950/65" : "border-slate-200 bg-white"
          }`}>
            <div className={`text-xs uppercase tracking-widest font-bold ${isDark ? "text-slate-400" : "text-slate-500"}`}>Assignment</div>

            <select
              value={executiveDraft}
              onChange={(event) => setExecutiveDraft(event.target.value)}
              className={`w-full h-10 rounded-xl border px-3 text-sm ${
                isDark ? "border-slate-700 bg-slate-900 text-slate-200" : "border-slate-300 bg-white text-slate-700"
              }`}
            >
              <option value="">Select executive</option>
              {executives.map((executive) => (
                <option key={executive._id} value={executive._id}>
                  {executive.name} ({executive.role})
                </option>
              ))}
            </select>

            <button
              onClick={onAssignLead}
              disabled={!executiveDraft || assigning}
              className={`w-full h-10 rounded-xl border text-sm font-semibold disabled:opacity-60 ${
                isDark
                  ? "border-slate-600 bg-slate-900 text-slate-200 hover:border-emerald-400/45 hover:text-emerald-200"
                  : "border-slate-300 bg-white text-slate-700 hover:border-emerald-400 hover:text-emerald-700"
              }`}
            >
              {assigning ? "Assigning..." : "Assign Lead"}
            </button>
          </div>
        )}

        <div className={`rounded-2xl border p-3 ${isPageLayout ? "xl:col-span-8" : ""} ${
          isDark ? "border-slate-700 bg-slate-950/65" : "border-slate-200 bg-white"
        }`}>
          <div className={`mb-2 text-xs uppercase tracking-widest font-bold ${
            isDark ? "text-slate-400" : "text-slate-500"
          }`}>
            Lead Diary
          </div>

          <textarea
            value={diaryDraft}
            onChange={(event) => setDiaryDraft(event.target.value)}
            placeholder="Add conversation notes, visit details, objections, or next step context..."
            className={`w-full min-h-[84px] rounded-xl border px-3 py-2 text-sm resize-y focus:outline-none ${
              isDark
                ? "border-slate-700 bg-slate-900 text-slate-200 placeholder:text-slate-500 focus:border-emerald-400/45"
                : "border-slate-300 bg-white text-slate-700 placeholder:text-slate-400 focus:border-emerald-400"
            }`}
            maxLength={2000}
          />

          <div className="mt-2 flex items-center justify-between gap-2">
            <div className={`text-[10px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              {diaryDraft.length}/2000
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onDiaryVoiceToggle}
                disabled={savingDiary || !isDiaryMicSupported}
                className={`h-9 px-3 rounded-lg border text-xs font-semibold disabled:opacity-60 inline-flex items-center gap-1 ${
                  isDark
                    ? "border-slate-600 bg-slate-900 text-slate-200 hover:border-emerald-400/45 hover:text-emerald-200"
                    : "border-slate-300 bg-white text-slate-700 hover:border-emerald-400 hover:text-emerald-700"
                }`}
              >
                {isDiaryListening ? <MicOff size={13} /> : <Mic size={13} />}
                {isDiaryListening ? "Stop Mic" : "Voice"}
              </button>
              <button
                onClick={onAddDiary}
                disabled={savingDiary || !diaryDraft.trim()}
                className={`h-9 px-3 rounded-lg text-white text-xs font-semibold disabled:opacity-60 inline-flex items-center gap-1 ${
                  isDark ? "bg-emerald-600 hover:bg-emerald-500" : "bg-slate-900 hover:bg-emerald-600"
                }`}
              >
                {savingDiary ? <Loader size={13} className="animate-spin" /> : <Save size={13} />}
                Add Note
              </button>
            </div>
          </div>

          {!isDiaryMicSupported && (
            <div className={`mt-2 text-[10px] ${isDark ? "text-amber-200" : "text-amber-700"}`}>
              Voice input is not supported in this browser. Use Chrome/Edge for mic dictation.
            </div>
          )}

          <div className="mt-3">
            {diaryLoading ? (
              <div className={`h-16 flex items-center justify-center text-sm gap-2 ${
                isDark ? "text-slate-400" : "text-slate-500"
              }`}>
                <Loader size={14} className="animate-spin" /> Loading diary...
              </div>
            ) : diaryEntries.length === 0 ? (
              <div className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>No diary notes yet</div>
            ) : (
              <div className="space-y-2 max-h-52 overflow-y-auto pr-1 custom-scrollbar">
                {diaryEntries.map((entry) => (
                  <div key={entry._id} className={`rounded-lg border p-2 ${
                    isDark ? "border-slate-700 bg-slate-900/70" : "border-slate-200 bg-slate-50"
                  }`}>
                    <div className={`text-sm whitespace-pre-wrap break-words ${isDark ? "text-slate-100" : "text-slate-800"}`}>
                      {entry.note}
                    </div>
                    <div className={`text-[11px] mt-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                      {formatDate(entry.createdAt)}
                      {entry.createdBy?.name ? ` - ${entry.createdBy.name}` : ""}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className={`rounded-2xl border p-3 ${isPageLayout ? "xl:col-span-12" : ""} ${
          isDark ? "border-slate-700 bg-slate-950/65" : "border-slate-200 bg-white"
        }`}>
          <div className={`text-xs uppercase tracking-widest font-bold flex items-center gap-1 mb-2 ${
            isDark ? "text-slate-400" : "text-slate-500"
          }`}>
            <History size={12} /> Activity Timeline
          </div>

          {activityLoading ? (
            <div className={`h-24 flex items-center justify-center text-sm gap-2 ${
              isDark ? "text-slate-400" : "text-slate-500"
            }`}>
              <Loader size={14} className="animate-spin" /> Loading timeline...
            </div>
          ) : activities.length === 0 ? (
            <div className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>No activity yet</div>
          ) : (
            <div className={`space-y-2 ${isPageLayout ? "max-h-[380px] overflow-y-auto pr-1 custom-scrollbar" : ""}`}>
              {activities.map((activity) => (
                <div key={activity._id} className={`relative rounded-lg border p-2 pl-4 ${
                  isDark ? "border-slate-700 bg-slate-900/70" : "border-slate-200 bg-slate-50"
                }`}>
                  <span className={`absolute left-1.5 top-3 h-1.5 w-1.5 rounded-full ${
                    isDark ? "bg-cyan-300" : "bg-cyan-600"
                  }`} />
                  <div className={`text-sm ${isDark ? "text-slate-100" : "text-slate-800"}`}>{activity.action}</div>
                  <div className={`text-[11px] mt-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                    {formatDate(activity.createdAt)}
                    {activity.performedBy?.name ? ` - ${activity.performedBy.name}` : ""}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      </div>
    </Motion.aside>
    </>
  );
};
