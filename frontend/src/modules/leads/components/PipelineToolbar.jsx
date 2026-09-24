import React, { useState, useRef, useEffect } from "react";
import {
  Search,
  ChevronDown,
  Filter,
  ArrowDownUp,
  Zap,
  Clock,
  Users as UsersIcon,
  Calendar,
  X,
  RefreshCw,
  Upload,
  Plus,
} from "lucide-react";
import { cn } from "../../../components/ui";
import { PIPELINE_VIEWS } from "./pipelineViews";
import { QUICK_FILTER_KEYS } from "./leadFilterConstants";

/**
 * PipelineToolbar: Tabs, Actions, Search, Dropdowns, Quick Filters, and Active Chips
 */
const PipelineToolbar = ({
  view,
  onViewChange,
  needsActionCount = 0,
  canSeeUnassigned = false,
  query = "",
  onQueryChange,
  refreshing = false,
  onRefresh,
  onOpenAddModal,
  onOpenBulkUploadModal,
  canAddLead = true,
  canBulkUploadLeads = true,
  // Filter states
  filterState = {},
  onFilterChange,
  onResetFilters,
  onOpenFiltersFlyout,
  employees = [],
  propertySubtypes = [],
  sortBy = "FOLLOW_UP",
  onSortByChange,
  className,
}) => {
  const views = [
    { key: PIPELINE_VIEWS.ALL, label: "All" },
    { key: PIPELINE_VIEWS.TEAM, label: "Team" },
    ...(canSeeUnassigned ? [{ key: PIPELINE_VIEWS.UNASSIGNED, label: "Unassigned" }] : []),
    { key: PIPELINE_VIEWS.CLOSED, label: "Closed" },
    { key: PIPELINE_VIEWS.NEEDS_ACTION, label: "Needs action", count: needsActionCount },
  ];

  // Open inline dropdown popover state
  const [openDropdown, setOpenDropdown] = useState(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Compute active filters
  const activeChips = [];
  if (filterState.status && filterState.status !== "ALL") {
    activeChips.push({
      key: "status",
      label: `Status: ${filterState.status.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}`,
      onRemove: () => onFilterChange?.({ ...filterState, status: "ALL" }),
    });
  }
  if (filterState.source && filterState.source !== "ALL" && filterState.source !== "") {
    activeChips.push({
      key: "source",
      label: `Source: ${filterState.source}`,
      onRemove: () => onFilterChange?.({ ...filterState, source: "" }),
    });
  }
  if (filterState.assignedTo && filterState.assignedTo !== "ALL" && filterState.assignedTo !== "") {
    const emp = employees.find((e) => (e._id || e.id) === filterState.assignedTo);
    const name = filterState.assignedTo === "UNASSIGNED" ? "Unassigned" : emp?.name || emp?.fullName || "Assigned";
    activeChips.push({
      key: "assignedTo",
      label: `Assigned: ${name}`,
      onRemove: () => onFilterChange?.({ ...filterState, assignedTo: "" }),
    });
  }
  if (filterState.propertyType && filterState.propertyType !== "ALL" && filterState.propertyType !== "") {
    activeChips.push({
      key: "propertyType",
      label: `Property: ${filterState.propertyType.replace(/_/g, " ")}`,
      onRemove: () => onFilterChange?.({ ...filterState, propertyType: "" }),
    });
  }
  if (filterState.budgetRange && filterState.budgetRange !== "ALL" && filterState.budgetRange !== "") {
    const budgetMap = {
      UNDER_50L: "< ₹50 L",
      "50L_1CR": "₹50 L - ₹1 Cr",
      "1CR_3CR": "₹1 Cr - ₹3 Cr",
      "3CR_5CR": "₹3 Cr - ₹5 Cr",
      ABOVE_5CR: "> ₹5 Cr",
    };
    activeChips.push({
      key: "budgetRange",
      label: `Budget: ${budgetMap[filterState.budgetRange] || filterState.budgetRange}`,
      onRemove: () => onFilterChange?.({ ...filterState, budgetRange: "" }),
    });
  }
  if (filterState.followUpDate && filterState.followUpDate !== "ALL" && filterState.followUpDate !== "") {
    activeChips.push({
      key: "followUpDate",
      label: `Follow-up: ${filterState.followUpDate}`,
      onRemove: () => onFilterChange?.({ ...filterState, followUpDate: "" }),
    });
  }
  if (filterState.createdDate && filterState.createdDate !== "ALL" && filterState.createdDate !== "") {
    activeChips.push({
      key: "createdDate",
      label: `Created: ${filterState.createdDate}`,
      onRemove: () => onFilterChange?.({ ...filterState, createdDate: "" }),
    });
  }

  const activeFiltersCount = activeChips.length + (filterState.quickFilter ? 1 : 0);

  const toggleQuickFilter = (key) => {
    const next = filterState.quickFilter === key ? "" : key;
    onFilterChange?.({ ...filterState, quickFilter: next });
  };

  return (
    <div className={cn("flex flex-col gap-3.5 pb-1", className)}>
      {/* 1. Top Row: View Tabs + Right Action Buttons */}
      <div className="flex flex-col items-stretch gap-5 border-b border-slate-100 pb-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:pb-2">
        {/* View Tabs */}
        <div className="flex w-full items-center justify-between gap-1 sm:w-auto sm:gap-6">
          {views.map((item) => {
            const isActive = item.key === view;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onViewChange?.(item.key)}
                className={cn(
                  "relative rounded-2xl px-2 py-2.5 text-[13px] transition-colors outline-none sm:rounded-none sm:px-0 sm:py-0 sm:pb-2.5",
                  isActive
                    ? "bg-blue-50 font-bold text-blue-700 dark:bg-blue-500/15 dark:text-blue-300 sm:bg-transparent"
                    : "font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200",
                  item.key === PIPELINE_VIEWS.NEEDS_ACTION && "border-l border-slate-200 pl-3 sm:border-l-0 sm:pl-0",
                )}
              >
                <span className="flex items-center gap-1.5">
                  {item.label}
                  {item.count > 0 && (
                    <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-600 px-1.5 text-[11px] font-bold text-white">
                      {item.count}
                    </span>
                  )}
                </span>
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2.5px] rounded-full bg-blue-600 dark:bg-blue-400" />
                )}
              </button>
            );
          })}
        </div>

        {/* Right Action Buttons */}
        <div className="grid grid-cols-3 gap-2 sm:flex sm:items-center">
          {canBulkUploadLeads && (
            <button
              type="button"
              onClick={onOpenBulkUploadModal}
              className="flex h-12 items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-2 text-[12.5px] font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 sm:h-auto sm:justify-start sm:gap-1.5 sm:rounded-lg sm:px-3 sm:py-1.5"
            >
              <Upload size={18} className="text-slate-500 sm:h-3.5 sm:w-3.5" />
              <span>Bulk upload</span>
            </button>
          )}

          {canAddLead && (
            <button
              type="button"
              onClick={onOpenAddModal}
              className="flex h-12 items-center justify-center gap-1 rounded-xl bg-blue-600 px-2 text-[12.5px] font-semibold text-white shadow-sm transition hover:bg-blue-700 sm:h-auto sm:justify-start sm:gap-1.5 sm:rounded-lg sm:px-3.5 sm:py-1.5"
            >
              <Plus size={20} strokeWidth={2.5} className="sm:h-[15px] sm:w-[15px]" />
              <span>Add lead</span>
            </button>
          )}

          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="flex h-12 items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-2 text-[12.5px] font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 sm:h-auto sm:justify-start sm:gap-1.5 sm:rounded-lg sm:px-3 sm:py-1.5"
          >
            <RefreshCw size={19} className={cn("text-slate-500 sm:h-3.5 sm:w-3.5", refreshing && "animate-spin")} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* 2. Second Row: Search Input + Inline Filter Dropdowns + Filters Button */}
      <div className="relative flex flex-wrap items-center gap-2" ref={dropdownRef}>
        {/* Search Bar */}
        <div className="relative w-full min-w-0 flex-1 sm:min-w-[240px] sm:max-w-[340px]">
          <Search
            size={22}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => onQueryChange?.(e.target.value)}
            placeholder="Search leads by name, phone, project..."
            className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-3 text-[15px] text-slate-800 placeholder-slate-400 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:h-9 sm:rounded-lg sm:pl-9 sm:text-[12.5px]"
          />
          {query && (
            <button
              type="button"
              onClick={() => onQueryChange?.("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Dropdown filter buttons */}
        <div className="hidden flex-wrap items-center gap-1.5 sm:flex">
          {/* Status Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpenDropdown(openDropdown === "status" ? null : "status")}
              className={cn(
                "flex h-9 items-center gap-1 rounded-lg border px-2.5 text-[12px] font-medium transition shadow-sm",
                filterState.status && filterState.status !== "ALL"
                  ? "border-blue-300 bg-blue-50/70 text-blue-700 dark:border-blue-600 dark:bg-blue-500/20 dark:text-blue-200"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
              )}
            >
              <span>Status</span>
              <ChevronDown size={13} className="text-slate-400" />
            </button>
            {openDropdown === "status" && (
              <div className="absolute left-0 top-full z-30 mt-1 w-44 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-800">
                {["ALL", "TRANSFER", "INTERESTED", "NEW", "CONTACTED", "FOLLOW_UP_1", "FOLLOW_UP_2", "FOLLOW_UP_3", "REQUESTED", "SITE_VISIT", "CLOSED", "LOST"].map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => {
                      onFilterChange?.({ ...filterState, status: st });
                      setOpenDropdown(null);
                    }}
                    className={cn(
                      "flex w-full items-center rounded-lg px-2.5 py-1.5 text-left text-[12px] font-medium transition",
                      filterState.status === st
                        ? "bg-blue-50 font-semibold text-blue-700 dark:bg-blue-500/20 dark:text-blue-300"
                        : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700",
                    )}
                  >
                    {st === "ALL" ? "All statuses" : st.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Source Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpenDropdown(openDropdown === "source" ? null : "source")}
              className={cn(
                "flex h-9 items-center gap-1 rounded-lg border px-2.5 text-[12px] font-medium transition shadow-sm",
                filterState.source
                  ? "border-blue-300 bg-blue-50/70 text-blue-700 dark:border-blue-600 dark:bg-blue-500/20 dark:text-blue-200"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
              )}
            >
              <span>Source</span>
              <ChevronDown size={13} className="text-slate-400" />
            </button>
            {openDropdown === "source" && (
              <div className="absolute left-0 top-full z-30 mt-1 w-40 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-800">
                {["", "MANUAL", "META"].map((src) => (
                  <button
                    key={src}
                    type="button"
                    onClick={() => {
                      onFilterChange?.({ ...filterState, source: src });
                      setOpenDropdown(null);
                    }}
                    className={cn(
                      "flex w-full items-center rounded-lg px-2.5 py-1.5 text-left text-[12px] font-medium transition",
                      filterState.source === src
                        ? "bg-blue-50 font-semibold text-blue-700 dark:bg-blue-500/20 dark:text-blue-300"
                        : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700",
                    )}
                  >
                    {src === "" ? "All sources" : src}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Assigned Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpenDropdown(openDropdown === "assigned" ? null : "assigned")}
              className={cn(
                "flex h-9 items-center gap-1 rounded-lg border px-2.5 text-[12px] font-medium transition shadow-sm",
                filterState.assignedTo
                  ? "border-blue-300 bg-blue-50/70 text-blue-700 dark:border-blue-600 dark:bg-blue-500/20 dark:text-blue-200"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
              )}
            >
              <span>Assigned</span>
              <ChevronDown size={13} className="text-slate-400" />
            </button>
            {openDropdown === "assigned" && (
              <div className="absolute left-0 top-full z-30 mt-1 max-h-60 w-48 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    onFilterChange?.({ ...filterState, assignedTo: "" });
                    setOpenDropdown(null);
                  }}
                  className={cn(
                    "flex w-full items-center rounded-lg px-2.5 py-1.5 text-left text-[12px] font-medium transition",
                    !filterState.assignedTo
                      ? "bg-blue-50 font-semibold text-blue-700 dark:bg-blue-500/20 dark:text-blue-300"
                      : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700",
                  )}
                >
                  All employees
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onFilterChange?.({ ...filterState, assignedTo: "UNASSIGNED" });
                    setOpenDropdown(null);
                  }}
                  className={cn(
                    "flex w-full items-center rounded-lg px-2.5 py-1.5 text-left text-[12px] font-medium transition",
                    filterState.assignedTo === "UNASSIGNED"
                      ? "bg-blue-50 font-semibold text-blue-700 dark:bg-blue-500/20 dark:text-blue-300"
                      : "text-amber-600 hover:bg-slate-100 dark:text-amber-400 dark:hover:bg-slate-700",
                  )}
                >
                  Unassigned
                </button>
                {employees.map((emp) => (
                  <button
                    key={emp._id || emp.id}
                    type="button"
                    onClick={() => {
                      onFilterChange?.({ ...filterState, assignedTo: emp._id || emp.id });
                      setOpenDropdown(null);
                    }}
                    className={cn(
                      "flex w-full items-center rounded-lg px-2.5 py-1.5 text-left text-[12px] font-medium transition",
                      filterState.assignedTo === (emp._id || emp.id)
                        ? "bg-blue-50 font-semibold text-blue-700 dark:bg-blue-500/20 dark:text-blue-300"
                        : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700",
                    )}
                  >
                    {emp.name || emp.fullName}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Property type Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpenDropdown(openDropdown === "property" ? null : "property")}
              className={cn(
                "flex h-9 items-center gap-1 rounded-lg border px-2.5 text-[12px] font-medium transition shadow-sm",
                filterState.propertyType
                  ? "border-blue-300 bg-blue-50/70 text-blue-700 dark:border-blue-600 dark:bg-blue-500/20 dark:text-blue-200"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
              )}
            >
              <span>Property type</span>
              <ChevronDown size={13} className="text-slate-400" />
            </button>
            {openDropdown === "property" && (
              <div className="absolute left-0 top-full z-30 mt-1 w-44 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-800">
                {[
                  { value: "", label: "All property types" },
                  ...(propertySubtypes.length ? propertySubtypes : [
                    { value: "OFFICE", label: "Office" },
                    { value: "COWORKING", label: "Coworking" },
                    { value: "MANAGED_OFFICE", label: "Managed Office" },
                    { value: "RESIDENTIAL", label: "Residential" },
                  ]),
                ].map((option) => {
                  const pt = option.value;
                  return (
                  <button
                    key={pt}
                    type="button"
                    onClick={() => {
                      onFilterChange?.({ ...filterState, propertyType: pt });
                      setOpenDropdown(null);
                    }}
                    className={cn(
                      "flex w-full items-center rounded-lg px-2.5 py-1.5 text-left text-[12px] font-medium transition",
                      filterState.propertyType === pt
                        ? "bg-blue-50 font-semibold text-blue-700 dark:bg-blue-500/20 dark:text-blue-300"
                        : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700",
                    )}
                  >
                    {option.label || pt.replace(/_/g, " ")}
                  </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Budget Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpenDropdown(openDropdown === "budget" ? null : "budget")}
              className={cn(
                "flex h-9 items-center gap-1 rounded-lg border px-2.5 text-[12px] font-medium transition shadow-sm",
                filterState.budgetRange
                  ? "border-blue-300 bg-blue-50/70 text-blue-700 dark:border-blue-600 dark:bg-blue-500/20 dark:text-blue-200"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
              )}
            >
              <span>Budget</span>
              <ChevronDown size={13} className="text-slate-400" />
            </button>
            {openDropdown === "budget" && (
              <div className="absolute left-0 top-full z-30 mt-1 w-44 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-800">
                {[
                  { value: "", label: "Any budget" },
                  { value: "UNDER_50L", label: "< ₹50 L" },
                  { value: "50L_1CR", label: "₹50 L - ₹1 Cr" },
                  { value: "1CR_3CR", label: "₹1 Cr - ₹3 Cr" },
                  { value: "3CR_5CR", label: "₹3 Cr - ₹5 Cr" },
                  { value: "ABOVE_5CR", label: "> ₹5 Cr" },
                ].map((b) => (
                  <button
                    key={b.value}
                    type="button"
                    onClick={() => {
                      onFilterChange?.({ ...filterState, budgetRange: b.value });
                      setOpenDropdown(null);
                    }}
                    className={cn(
                      "flex w-full items-center rounded-lg px-2.5 py-1.5 text-left text-[12px] font-medium transition",
                      filterState.budgetRange === b.value
                        ? "bg-blue-50 font-semibold text-blue-700 dark:bg-blue-500/20 dark:text-blue-300"
                        : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700",
                    )}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Follow-up Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpenDropdown(openDropdown === "followup" ? null : "followup")}
              className={cn(
                "flex h-9 items-center gap-1 rounded-lg border px-2.5 text-[12px] font-medium transition shadow-sm",
                filterState.followUpDate
                  ? "border-blue-300 bg-blue-50/70 text-blue-700 dark:border-blue-600 dark:bg-blue-500/20 dark:text-blue-200"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
              )}
            >
              <span>Follow-up</span>
              <ChevronDown size={13} className="text-slate-400" />
            </button>
            {openDropdown === "followup" && (
              <div className="absolute left-0 top-full z-30 mt-1 w-40 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-800">
                {["", "TODAY", "OVERDUE", "TOMORROW", "THIS_WEEK", "NEXT_WEEK"].map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => {
                      onFilterChange?.({ ...filterState, followUpDate: f });
                      setOpenDropdown(null);
                    }}
                    className={cn(
                      "flex w-full items-center rounded-lg px-2.5 py-1.5 text-left text-[12px] font-medium transition",
                      filterState.followUpDate === f
                        ? "bg-blue-50 font-semibold text-blue-700 dark:bg-blue-500/20 dark:text-blue-300"
                        : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700",
                    )}
                  >
                    {f === "" ? "Any date" : f.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Created date Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpenDropdown(openDropdown === "created" ? null : "created")}
              className={cn(
                "flex h-9 items-center gap-1 rounded-lg border px-2.5 text-[12px] font-medium transition shadow-sm",
                filterState.createdDate
                  ? "border-blue-300 bg-blue-50/70 text-blue-700 dark:border-blue-600 dark:bg-blue-500/20 dark:text-blue-200"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
              )}
            >
              <span>Created date</span>
              <ChevronDown size={13} className="text-slate-400" />
            </button>
            {openDropdown === "created" && (
              <div className="absolute left-0 top-full z-30 mt-1 w-40 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-800">
                {["", "TODAY", "YESTERDAY", "THIS_WEEK", "THIS_MONTH", "LAST_30_DAYS"].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      onFilterChange?.({ ...filterState, createdDate: c });
                      setOpenDropdown(null);
                    }}
                    className={cn(
                      "flex w-full items-center rounded-lg px-2.5 py-1.5 text-left text-[12px] font-medium transition",
                      filterState.createdDate === c
                        ? "bg-blue-50 font-semibold text-blue-700 dark:bg-blue-500/20 dark:text-blue-300"
                        : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700",
                    )}
                  >
                    {c === "" ? "Any date" : c.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (x) => x.toUpperCase())}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex w-full gap-2 sm:contents">
        {/* Filters flyout button on right */}
        <button
          type="button"
          onClick={onOpenFiltersFlyout}
          className={cn(
            "flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border px-3 text-[15px] font-semibold transition shadow-sm sm:ml-auto sm:h-9 sm:flex-none sm:justify-start sm:gap-1.5 sm:rounded-lg sm:text-[12.5px]",
            activeFiltersCount > 0
              ? "border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-500/15 dark:text-blue-300"
              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
          )}
        >
          <Filter size={19} className={cn(activeFiltersCount > 0 ? "text-blue-600 dark:text-blue-400" : "text-slate-500", "sm:h-3.5 sm:w-3.5")} />
          <span>Filters</span>
          {activeFiltersCount > 0 && (
            <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold text-white">
              {activeFiltersCount}
            </span>
          )}
        </button>

        <div className="relative flex-1 sm:flex-none">
          <button
            type="button"
            onClick={() => setOpenDropdown(openDropdown === "sort" ? null : "sort")}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[15px] font-semibold text-slate-800 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:h-9 sm:w-auto sm:rounded-lg sm:text-[12.5px]"
          >
            <ArrowDownUp size={21} className="text-slate-700 sm:h-[15px] sm:w-[15px] dark:text-slate-200" />
            <span>Sort</span>
            <ChevronDown size={16} className="text-slate-400" />
          </button>
          {openDropdown === "sort" && (
            <div className="absolute right-0 top-full z-30 mt-1 w-44 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-800">
              {[{ value: "FOLLOW_UP", label: "Follow-up" }, { value: "RECENT", label: "Recent" }, { value: "NAME", label: "Name" }].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onSortByChange?.(option.value);
                    setOpenDropdown(null);
                  }}
                  className={cn(
                    "flex w-full items-center rounded-lg px-2.5 py-1.5 text-left text-[12px] font-medium transition",
                    sortBy === option.value
                      ? "bg-blue-50 font-semibold text-blue-700 dark:bg-blue-500/20 dark:text-blue-300"
                      : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
        </div>
      </div>

      {/* 3. Third Row: Quick Filters */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[16px] font-semibold text-slate-700 dark:text-slate-300 sm:text-[12px] sm:text-slate-500">
          Quick filters:
        </span>
        <span className="text-[14px] text-slate-500 sm:hidden">Scroll for more <span aria-hidden="true">→</span></span>
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:gap-1.5">
          <button
            type="button"
            onClick={() => toggleQuickFilter(QUICK_FILTER_KEYS.NEEDS_FOLLOW_UP_TODAY)}
            className={cn(
              "flex min-h-14 items-center justify-center gap-1.5 rounded-xl border px-2 text-[13px] font-medium transition sm:min-h-0 sm:justify-start sm:rounded-lg sm:px-2.5 sm:py-1 sm:text-[11.5px]",
              filterState.quickFilter === QUICK_FILTER_KEYS.NEEDS_FOLLOW_UP_TODAY
                ? "border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-500/20 dark:text-blue-200"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
            )}
          >
            <Zap size={13} className="text-amber-500" />
            <span>Needs follow-up today</span>
          </button>

          <button
            type="button"
            onClick={() => toggleQuickFilter(QUICK_FILTER_KEYS.OVERDUE_FOLLOW_UPS)}
            className={cn(
              "flex min-h-14 items-center justify-center gap-1.5 rounded-xl border px-2 text-[13px] font-medium transition sm:min-h-0 sm:justify-start sm:rounded-lg sm:px-2.5 sm:py-1 sm:text-[11.5px]",
              filterState.quickFilter === QUICK_FILTER_KEYS.OVERDUE_FOLLOW_UPS
                ? "border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-500/20 dark:text-blue-200"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
            )}
          >
            <Clock size={13} className="text-rose-500" />
            <span>Overdue follow-ups</span>
          </button>

          <button
            type="button"
            onClick={() => toggleQuickFilter(QUICK_FILTER_KEYS.UNASSIGNED_LEADS)}
            className={cn(
              "flex min-h-14 items-center justify-center gap-1.5 rounded-xl border px-2 text-[13px] font-medium transition sm:min-h-0 sm:justify-start sm:rounded-lg sm:px-2.5 sm:py-1 sm:text-[11.5px]",
              filterState.quickFilter === QUICK_FILTER_KEYS.UNASSIGNED_LEADS
                ? "border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-500/20 dark:text-blue-200"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
            )}
          >
            <UsersIcon size={13} className="text-blue-500" />
            <span>Unassigned leads</span>
          </button>

          <button
            type="button"
            onClick={() => toggleQuickFilter(QUICK_FILTER_KEYS.NEW_THIS_WEEK)}
            className={cn(
              "flex min-h-14 items-center justify-center gap-1.5 rounded-xl border px-2 text-[13px] font-medium transition sm:min-h-0 sm:justify-start sm:rounded-lg sm:px-2.5 sm:py-1 sm:text-[11.5px]",
              filterState.quickFilter === QUICK_FILTER_KEYS.NEW_THIS_WEEK
                ? "border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-500/20 dark:text-blue-200"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
            )}
          >
            <Calendar size={13} className="text-sky-500" />
            <span>New this week</span>
          </button>
        </div>
      </div>

      {/* 4. Fourth Row: Active Filter Chips */}
      {activeFiltersCount > 0 && (
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between">
            <span className="text-[16px] font-semibold text-slate-700 dark:text-slate-300 sm:text-[12px] sm:text-slate-500">Active filters ({activeFiltersCount})</span>
            <button
              type="button"
              onClick={onResetFilters}
              className="text-[14px] font-semibold text-blue-600 hover:underline dark:text-blue-400 sm:text-[12px]"
            >
              Clear all
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {activeChips.map((chip) => (
              <span
                key={chip.key}
                className="inline-flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-[13px] font-medium text-blue-800 dark:border-blue-800 dark:bg-blue-900/40 dark:text-blue-200 sm:rounded-lg sm:px-2.5 sm:py-1 sm:text-[11.5px]"
              >
                <span>{chip.label}</span>
                <button
                  type="button"
                  onClick={chip.onRemove}
                  className="rounded p-0.5 hover:bg-blue-200/60 dark:hover:bg-blue-800/60"
                  aria-label={`Remove ${chip.label}`}
                >
                  <X size={15} className="sm:h-3 sm:w-3" />
                </button>
              </span>
            ))}
            {filterState.quickFilter ? (
              <span className="inline-flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-[13px] font-medium text-blue-800 dark:border-blue-800 dark:bg-blue-900/40 dark:text-blue-200 sm:rounded-lg sm:px-2.5 sm:py-1 sm:text-[11.5px]">
                {filterState.quickFilter.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (character) => character.toUpperCase())}
                <button type="button" onClick={() => toggleQuickFilter(filterState.quickFilter)} className="rounded p-0.5 hover:bg-blue-200/60" aria-label="Remove quick filter"><X size={15} className="sm:h-3 sm:w-3" /></button>
              </span>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};

export default PipelineToolbar;
