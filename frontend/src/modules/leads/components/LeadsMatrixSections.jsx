import React from "react";
import { motion as Motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  Building2,
  CalendarClock,
  CheckCircle2,
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

const getLeadPendingAmount = (lead) => {
  if (!lead || typeof lead !== "object") return null;
  const paymentType = String(lead?.dealPayment?.paymentType || "").trim().toUpperCase();
  const amount = Number(lead?.dealPayment?.remainingAmount);
  if (paymentType !== "PARTIAL") return null;
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return amount;
};

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
}) => (
  <div
    className={`mb-5 overflow-hidden rounded-3xl border px-4 py-4 sm:px-5 sm:py-5 ${
      isDark ? "border-slate-700 bg-slate-900/75" : "border-slate-200 bg-white/90"
    }`}
    style={{
      backgroundImage: isDark
        ? "radial-gradient(circle at 88% 8%, rgba(16,185,129,0.16), transparent 35%), radial-gradient(circle at 8% 90%, rgba(56,189,248,0.12), transparent 38%)"
        : "radial-gradient(circle at 88% 8%, rgba(16,185,129,0.12), transparent 35%), radial-gradient(circle at 8% 90%, rgba(56,189,248,0.1), transparent 38%)",
    }}
  >
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        <p className={`inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] ${
          isDark ? "text-emerald-200" : "text-emerald-700"
        }`}>
          <Sparkles size={13} />
          Sales Intelligence
        </p>
        <h1 className={`mt-1 font-display text-2xl tracking-tight sm:text-4xl ${
          isDark ? "text-slate-50" : "text-slate-900"
        }`}>
          Lead Matrix
        </h1>
        <p className={`mt-2 text-xs uppercase tracking-[0.16em] ${
          isDark ? "text-slate-400" : "text-slate-500"
        }`}>
          {filteredLeads} visible of {totalLeads} total | {dueFollowUps} follow-ups due
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onRefresh}
          className={`h-10 rounded-xl border px-4 text-xs font-bold uppercase tracking-wide transition-colors ${
            isDark
              ? "border-slate-600 bg-slate-950 text-slate-200 hover:border-emerald-400/50 hover:text-emerald-200"
              : "border-slate-300 bg-white text-slate-700 hover:border-emerald-400 hover:text-emerald-700"
          } inline-flex items-center gap-2`}
        >
          {refreshing ? <Loader size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Refresh
        </button>

        {canAddLead && (
          <button
            type="button"
            onClick={onOpenAddModal}
            className={`h-10 rounded-xl px-5 text-xs font-bold uppercase tracking-wide text-white transition-colors ${
              isDark ? "bg-emerald-600 hover:bg-emerald-500" : "bg-slate-900 hover:bg-emerald-600"
            } inline-flex items-center gap-2`}
          >
            <Plus size={15} />
            Add Lead
          </button>
        )}

        {canBulkUploadLeads && (
          <button
            type="button"
            onClick={onOpenBulkUploadModal}
            className={`h-10 rounded-xl border px-4 text-xs font-bold uppercase tracking-wide transition-colors ${
              isDark
                ? "border-cyan-400/40 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/20"
                : "border-cyan-300 bg-cyan-50 text-cyan-700 hover:bg-cyan-100"
            } inline-flex items-center gap-2`}
          >
            <UploadCloud size={14} />
            Bulk Upload
          </button>
        )}
      </div>
    </div>
  </div>
);

export const LeadsMatrixAlerts = ({ isDark, error, success }) => (
  <>
    {error && (
      <div className={`mb-4 rounded-xl border px-3 py-2 text-sm ${
        isDark ? "border-rose-500/35 bg-rose-500/15 text-rose-100" : "border-rose-200 bg-rose-50 text-rose-700"
      }`}>
        {error}
      </div>
    )}

    {success && (
      <div className={`mb-4 flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${
        isDark ? "border-emerald-500/35 bg-emerald-500/15 text-emerald-100" : "border-emerald-200 bg-emerald-50 text-emerald-700"
      }`}>
        <CheckCircle2 size={14} /> {success}
      </div>
    )}
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
    { key: "total", label: "Total Leads", value: metrics.total, tone: "text-slate-700", icon: Users2 },
    { key: "new", label: "Fresh", value: metrics.new, tone: "text-sky-700", icon: Sparkles },
    { key: "contacted", label: "Contacted", value: metrics.contacted, tone: "text-amber-700", icon: Phone },
    { key: "interested", label: "Interested", value: metrics.interested, tone: "text-emerald-700", icon: CheckCircle2 },
    { key: "closed", label: "Closed", value: metrics.closed, tone: "text-violet-700", icon: BarChart3 },
    { key: "due", label: "Due Follow-up", value: metrics.dueFollowUps, tone: "text-rose-700", icon: CalendarClock },
    { key: "conversion", label: "Conversion", value: `${metrics.conversionRate}%`, tone: "text-cyan-700", icon: ArrowUpRight },
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
    <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-7">
      {cards.map(({ key, label, value, tone, icon: Icon }) => (
        <button
          key={key}
          type="button"
          onClick={() => onMetricSelect(key)}
          className={`rounded-2xl border p-3 text-left transition-colors ${
            isCardActive(key)
              ? isDark
                ? "border-emerald-400/45 bg-emerald-500/10"
                : "border-emerald-300 bg-emerald-50/75"
              : isDark
                ? "border-slate-700 bg-slate-900/80 hover:border-slate-600"
                : "border-slate-200 bg-white hover:border-slate-300"
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <p className={`truncate text-[10px] font-semibold uppercase tracking-[0.14em] ${
              isDark ? "text-slate-400" : "text-slate-500"
            }`}>
              {label}
            </p>
            <Icon size={13} className={isDark ? "text-slate-400" : "text-slate-500"} />
          </div>
          <p className={`mt-1 text-2xl font-display ${isDark ? "text-slate-100" : tone}`}>
            {value}
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
  statusBreakdown,
  sortBy,
  onSortByChange,
  showDueOnly,
  onShowDueOnlyChange,
  getStatusLabel,
}) => (
  <div className={`mb-4 rounded-2xl border p-3 sm:p-4 ${
    isDark ? "border-slate-700 bg-slate-900/80" : "border-slate-200 bg-white/90"
  }`}>
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
      <div className="relative lg:col-span-5">
        <Search className={`absolute left-3 top-1/2 -translate-y-1/2 ${isDark ? "text-slate-500" : "text-slate-400"}`} size={15} />
        <input
          type="text"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search by name, city, project, executive, phone"
          className={`h-10 w-full rounded-xl border pl-9 pr-9 text-sm outline-none transition-colors ${
            isDark
              ? "border-slate-700 bg-slate-950 text-slate-200 placeholder:text-slate-500 focus:border-emerald-400/45"
              : "border-slate-300 bg-white text-slate-700 placeholder:text-slate-400 focus:border-emerald-400"
          }`}
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

      <div className="lg:col-span-3">
        <select
          value={statusFilter}
          onChange={(event) => onStatusFilterChange(event.target.value)}
          className={`h-10 w-full rounded-xl border px-3 text-sm outline-none transition-colors ${
            isDark
              ? "border-slate-700 bg-slate-950 text-slate-200 focus:border-emerald-400/45"
              : "border-slate-300 bg-white text-slate-700 focus:border-emerald-400"
          }`}
        >
          <option value="ALL">All statuses</option>
          {leadStatuses.map((status) => (
            <option key={status} value={status}>
              {getStatusLabel(status)}
            </option>
          ))}
        </select>
      </div>

      <div className="lg:col-span-2">
        <div className={`flex h-10 items-center gap-2 rounded-xl border px-3 ${
          isDark ? "border-slate-700 bg-slate-950 text-slate-300" : "border-slate-300 bg-white text-slate-600"
        }`}>
          <SlidersHorizontal size={14} />
          <select
            value={sortBy}
            onChange={(event) => onSortByChange(event.target.value)}
            className="h-full w-full bg-transparent text-sm outline-none"
          >
            <option value="RECENT">Latest updated</option>
            <option value="FOLLOW_UP">Next follow-up</option>
            <option value="NAME">Name A-Z</option>
          </select>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onShowDueOnlyChange(!showDueOnly)}
        className={`lg:col-span-2 h-10 rounded-xl border text-xs font-semibold uppercase tracking-[0.12em] transition-colors ${
          showDueOnly
            ? isDark
              ? "border-rose-400/45 bg-rose-500/15 text-rose-100"
              : "border-rose-300 bg-rose-50 text-rose-700"
            : isDark
              ? "border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-600"
              : "border-slate-300 bg-white text-slate-600 hover:border-slate-400"
        }`}
      >
        Due Follow-ups
      </button>
    </div>

    <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
      <button
        type="button"
        onClick={() => onStatusFilterChange("ALL")}
        className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] ${
          statusFilter === "ALL"
            ? isDark
              ? "border-emerald-400/45 bg-emerald-500/15 text-emerald-100"
              : "border-emerald-300 bg-emerald-50 text-emerald-700"
            : isDark
              ? "border-slate-700 bg-slate-950 text-slate-300"
              : "border-slate-300 bg-white text-slate-600"
        }`}
      >
        All ({leadStatuses.reduce((sum, status) => sum + Number(statusBreakdown[status] || 0), 0)})
      </button>
      {leadStatuses.map((status) => (
        <button
          key={status}
          type="button"
          onClick={() => onStatusFilterChange(status)}
          className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] ${
            statusFilter === status
              ? isDark
                ? "border-cyan-400/45 bg-cyan-500/15 text-cyan-100"
                : "border-cyan-300 bg-cyan-50 text-cyan-700"
              : isDark
                ? "border-slate-700 bg-slate-950 text-slate-300"
                : "border-slate-300 bg-white text-slate-600"
          }`}
        >
          {getStatusLabel(status)} ({statusBreakdown[status] || 0})
        </button>
      ))}
    </div>
  </div>
);

export const LeadsMatrixTable = ({
  isDark,
  loading,
  filteredLeads,
  onOpenLeadDetails,
  getStatusColor,
  getStatusLabel,
  formatDate,
}) => {
  const isFollowUpDue = (lead) => {
    if (!lead?.nextFollowUp) return false;
    const followUpMs = new Date(lead.nextFollowUp).getTime();
    return Number.isFinite(followUpMs) && followUpMs <= Date.now() && !["REQUESTED", "CLOSED", "LOST"].includes(String(lead.status || ""));
  };

  return (
    <div className={`flex min-h-[420px] flex-1 flex-col overflow-hidden rounded-2xl border shadow-sm ${
      isDark ? "border-slate-700 bg-slate-900/85" : "border-slate-200 bg-white"
    }`}>
      {loading ? (
        <div className={`flex h-56 items-center justify-center gap-2 text-sm ${
          isDark ? "text-slate-400" : "text-slate-500"
        }`}>
          <Loader className="animate-spin" size={18} /> Loading leads...
        </div>
      ) : filteredLeads.length === 0 ? (
        <div className={`flex h-64 flex-col items-center justify-center ${
          isDark ? "text-slate-400" : "text-slate-500"
        }`}>
          <Filter size={40} className="mb-3 opacity-40" />
          <p className="text-sm">No leads found for current filters.</p>
        </div>
      ) : (
        <>
          <div className="max-h-[62vh] overflow-y-auto p-2 custom-scrollbar md:hidden">
            <div className="space-y-2">
              {filteredLeads.map((lead) => {
                const pendingAmount = getLeadPendingAmount(lead);
                return (
                  <Motion.button
                    type="button"
                    key={lead._id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => onOpenLeadDetails(lead)}
                    className={`w-full rounded-xl border p-3 text-left transition-colors ${
                      isDark
                        ? "border-slate-700 bg-slate-950/60 hover:border-cyan-400/40"
                        : "border-slate-200 bg-white hover:border-cyan-300 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className={`truncate text-sm font-semibold ${isDark ? "text-slate-100" : "text-slate-900"}`}>
                          {lead.name || "Unnamed lead"}
                        </p>
                        <p className={`mt-0.5 truncate text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                          {lead.projectInterested || "Project not set"}
                        </p>
                      </div>
                      <span className={`rounded border px-2 py-1 text-[10px] font-bold uppercase ${getStatusColor(lead.status)}`}>
                        {getStatusLabel(lead.status) || "-"}
                      </span>
                    </div>

                    <div className={`mt-2 space-y-1 text-xs ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                      <p className="flex items-center gap-1.5">
                        <Phone size={12} />
                        {lead.phone || "-"}
                      </p>
                      <p className="truncate">{lead.email || "-"}</p>
                      <p className="truncate">City: {lead.city || "-"}</p>
                      <p className={isFollowUpDue(lead) ? "text-rose-600 font-semibold" : ""}>
                        Follow-up: {formatDate(lead.nextFollowUp)}
                      </p>
                      <p className={pendingAmount ? (isDark ? "text-amber-200" : "text-amber-700") : ""}>
                        Remaining: {pendingAmount ? formatCurrencyInr(pendingAmount) : "-"}
                      </p>
                    </div>

                    <div className={`mt-3 inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-[0.12em] ${
                      isDark ? "text-cyan-200" : "text-cyan-700"
                    }`}>
                      Open
                      <ArrowUpRight size={12} />
                    </div>
                  </Motion.button>
                );
              })}
            </div>
          </div>

          <div className="hidden flex-1 flex-col md:flex">
            <div className={`grid grid-cols-12 gap-3 border-b px-4 py-3 text-[11px] font-bold uppercase tracking-[0.14em] ${
              isDark ? "border-slate-700 bg-slate-900 text-slate-400" : "border-slate-200 bg-slate-50 text-slate-500"
            }`}>
              <div className="col-span-3">Lead</div>
              <div className="col-span-3">Contact</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2">Follow-up / Pending</div>
              <div className="col-span-2">Assigned</div>
            </div>

            <div className="max-h-[62vh] overflow-y-auto p-2 custom-scrollbar">
              <div className="space-y-1.5">
                {filteredLeads.map((lead) => {
                  const pendingAmount = getLeadPendingAmount(lead);
                  return (
                    <Motion.button
                      type="button"
                      key={lead._id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      onClick={() => onOpenLeadDetails(lead)}
                      className={`grid w-full grid-cols-12 items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors ${
                        isDark
                          ? "border-slate-700 bg-slate-950/55 hover:border-cyan-400/40 hover:bg-slate-900"
                          : "border-slate-200 bg-white hover:border-cyan-300 hover:bg-slate-50"
                      }`}
                    >
                      <div className="col-span-3 min-w-0">
                        <p className={`truncate text-sm font-semibold ${isDark ? "text-slate-100" : "text-slate-900"}`}>
                          {lead.name || "Unnamed lead"}
                        </p>
                        <p className={`mt-0.5 truncate text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                          {lead.projectInterested || "Project not set"}
                        </p>
                      </div>

                      <div className={`col-span-3 min-w-0 text-xs ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                        <p className="truncate">{lead.phone || "-"}</p>
                        <p className="truncate">{lead.email || "-"}</p>
                        <p className="truncate">{lead.city || "-"}</p>
                      </div>

                      <div className="col-span-2">
                        <span className={`rounded border px-2 py-1 text-[11px] font-bold uppercase ${getStatusColor(lead.status)}`}>
                          {getStatusLabel(lead.status) || "-"}
                        </span>
                      </div>

                      <div className={`col-span-2 text-xs ${
                        isFollowUpDue(lead)
                          ? "font-semibold text-rose-600"
                          : isDark
                            ? "text-slate-300"
                            : "text-slate-600"
                      }`}>
                        <p>{formatDate(lead.nextFollowUp)}</p>
                        <p className={`mt-1 ${pendingAmount ? (isDark ? "text-amber-200" : "text-amber-700") : ""}`}>
                          Remaining: {pendingAmount ? formatCurrencyInr(pendingAmount) : "-"}
                        </p>
                      </div>

                      <div className={`col-span-2 min-w-0 text-xs ${isDark ? "text-cyan-200" : "text-cyan-700"}`}>
                        <p className="truncate font-semibold">
                          {lead.assignedTo?.name || "Unassigned"}
                        </p>
                        <p className={`truncate ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                          {lead.assignedTo?.role || "Tap to manage"}
                        </p>
                      </div>
                    </Motion.button>
                  );
                })}
              </div>
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
}) => (
  <Motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${
      isDark ? "bg-slate-950/70" : "bg-slate-900/40"
    }`}
  >
    <Motion.div
      initial={{ scale: 0.96, y: 10 }}
      animate={{ scale: 1, y: 0 }}
      exit={{ scale: 0.96, y: 10 }}
      className={`w-full max-w-md rounded-2xl border p-5 shadow-2xl ${
        isDark ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white"
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className={`text-lg font-bold ${isDark ? "text-slate-100" : "text-slate-900"}`}>Add New Lead</h3>
        <button
          onClick={onClose}
          className={`rounded p-1 ${isDark ? "hover:bg-slate-800 text-slate-300" : "hover:bg-slate-100 text-slate-600"}`}
        >
          <X size={16} />
        </button>
      </div>

      <div className="space-y-3">
        <select
          value={formData.inventoryId}
          onChange={(event) => onInventorySelection(event.target.value)}
          className={`h-10 w-full rounded-lg border px-3 text-sm ${
            isDark ? "border-slate-700 bg-slate-950 text-slate-200" : "border-slate-300 bg-white text-slate-700"
          }`}
        >
          <option value="">Select Inventory (optional)</option>
          {inventoryOptions.map((inventory) => {
            const inventoryLabel = getInventoryLeadLabel(inventory) || "Inventory Unit";
            const inventoryLocation = String(inventory.location || "").trim();
            return (
              <option key={inventory._id} value={inventory._id}>
                {inventoryLocation ? `${inventoryLabel} - ${inventoryLocation}` : inventoryLabel}
              </option>
            );
          })}
        </select>

        {[
          ["name", "Name"],
          ["phone", "Phone"],
          ["email", "Email"],
          ["city", "City"],
          ["projectInterested", "Project Interested"],
        ].map(([field, label]) => (
          <input
            key={field}
            placeholder={label}
            value={formData[field]}
            onChange={(event) =>
              setFormData((prev) => ({ ...prev, [field]: event.target.value }))
            }
            className={`h-10 w-full rounded-lg border px-3 text-sm ${
              isDark ? "border-slate-700 bg-slate-950 text-slate-200" : "border-slate-300 bg-white text-slate-700"
            }`}
          />
        ))}

        <div className="grid grid-cols-2 gap-2">
          <input
            placeholder="Site Latitude (optional)"
            value={formData.siteLat}
            onChange={(event) =>
              setFormData((prev) => ({ ...prev, siteLat: event.target.value }))
            }
            className={`h-10 w-full rounded-lg border px-3 text-sm ${
              isDark ? "border-slate-700 bg-slate-950 text-slate-200" : "border-slate-300 bg-white text-slate-700"
            }`}
          />
          <input
            placeholder="Site Longitude (optional)"
            value={formData.siteLng}
            onChange={(event) =>
              setFormData((prev) => ({ ...prev, siteLng: event.target.value }))
            }
            className={`h-10 w-full rounded-lg border px-3 text-sm ${
              isDark ? "border-slate-700 bg-slate-950 text-slate-200" : "border-slate-300 bg-white text-slate-700"
            }`}
          />
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          onClick={onClose}
          className={`h-10 flex-1 rounded-lg text-sm font-semibold ${
            isDark ? "bg-slate-800 text-slate-200 hover:bg-slate-700" : "bg-slate-100 text-slate-600"
          }`}
        >
          Cancel
        </button>
        <button
          onClick={onSave}
          disabled={savingLead}
          className={`h-10 flex-1 rounded-lg text-sm font-semibold text-white disabled:opacity-60 ${
            isDark ? "bg-emerald-600 hover:bg-emerald-500" : "bg-slate-900 hover:bg-emerald-600"
          }`}
        >
          {savingLead ? "Saving..." : "Save Lead"}
        </button>
      </div>
    </Motion.div>
  </Motion.div>
);

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
    className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${
      isDark ? "bg-slate-950/70" : "bg-slate-900/40"
    }`}
  >
    <Motion.div
      initial={{ scale: 0.96, y: 10 }}
      animate={{ scale: 1, y: 0 }}
      exit={{ scale: 0.96, y: 10 }}
      className={`w-full max-w-2xl rounded-2xl border p-5 shadow-2xl ${
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

      <div className="space-y-3">
        <label className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-5 text-sm ${
          isDark
            ? "border-slate-600 bg-slate-950 text-slate-300 hover:border-cyan-400/45"
            : "border-slate-300 bg-slate-50 text-slate-700 hover:border-cyan-400"
        }`}
        >
          <UploadCloud size={16} />
          <span>{selectedFileName ? `Selected: ${selectedFileName}` : "Choose CSV File"}</span>
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(event) => onFileSelect(event.target.files?.[0] || null)}
          />
        </label>

        <div>
          <p className={`mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${
            isDark ? "text-slate-400" : "text-slate-500"
          }`}>
            CSV Template
          </p>
          <p className={`rounded-lg border px-3 py-2 text-xs font-mono ${
            isDark ? "border-slate-700 bg-slate-950 text-slate-300" : "border-slate-200 bg-slate-50 text-slate-600"
          }`}>
            name,phone,email,city,projectInterested,inventoryId,siteLat,siteLng
          </p>
        </div>

        <textarea
          value={csvText}
          onChange={(event) => onCsvTextChange(event.target.value)}
          placeholder="Paste CSV content here (with header row)"
          rows={10}
          className={`w-full resize-y rounded-xl border px-3 py-2 text-sm ${
            isDark
              ? "border-slate-700 bg-slate-950 text-slate-200 placeholder:text-slate-500"
              : "border-slate-300 bg-white text-slate-700 placeholder:text-slate-400"
          }`}
        />
      </div>

      <div className="mt-4 flex gap-2">
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
                    const inventoryLocation = String(inventory?.location || "").trim();
                    const inventoryStatus = toInventoryApiStatus(inventory?.status);
                    const inventoryStatusLabel = toInventoryStatusLabel(inventory?.status);
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
                            const inventoryLocation = String(inventory.location || "").trim();
                            const inventoryStatus = String(inventory.status || "").trim();
                            const price = Number(inventory?.price);
                            const priceLabel = Number.isFinite(price) && price > 0
                              ? `Rs ${price.toLocaleString("en-IN")}`
                              : "";
                            const optionText = [
                              inventoryLabel,
                              inventoryLocation,
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
