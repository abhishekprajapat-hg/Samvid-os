import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  BarChart3,
  Building2,
  ChevronRight,
  CheckCircle2,
  Clock3,
  IndianRupee,
  RefreshCw,
  TrendingUp,
  Users,
} from "lucide-react";
import { getAllLeads } from "../../services/leadService";
import { toErrorMessage } from "../../utils/errorMessage";

const COMMISSION_PER_DEAL = 50000;

const RANGE_OPTIONS = [
  { key: "TODAY", label: "Today" },
  { key: "30D", label: "Last 30 Days" },
  { key: "THIS_MONTH", label: "This Month" },
  { key: "CUSTOM", label: "Custom" },
  { key: "ALL", label: "All Time" },
];

const PIPELINE_STATUSES = [
  { key: "NEW", label: "New" },
  { key: "CONTACTED", label: "Contacted" },
  { key: "INTERESTED", label: "Interested" },
  { key: "SITE_VISIT", label: "Site Visit" },
  { key: "REQUESTED", label: "Requested" },
  { key: "CLOSED", label: "Closed" },
  { key: "LOST", label: "Lost" },
];
const LEAD_STATUS_SET = new Set(["ALL", ...PIPELINE_STATUSES.map((status) => status.key)]);
const EXECUTIVE_ROLE_SET = new Set(["EXECUTIVE", "FIELD_EXECUTIVE"]);

const parseLocalDateInput = (value) => {
  const raw = String(value || "").trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (
    Number.isNaN(date.getTime())
    || date.getFullYear() !== year
    || date.getMonth() !== month - 1
    || date.getDate() !== day
  ) {
    return null;
  }

  return date;
};

const toDate = (value) => {
  const localDate = parseLocalDateInput(value);
  if (localDate) return localDate;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const toDateInputValue = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getDayStart = (value) => {
  const date = toDate(value);
  if (!date) return null;
  date.setHours(0, 0, 0, 0);
  return date;
};

const getDayEnd = (value) => {
  const date = toDate(value);
  if (!date) return null;
  date.setHours(23, 59, 59, 999);
  return date;
};

const resolveRangeBounds = ({ rangeKey, customRange }) => {
  const now = new Date();

  if (rangeKey === "TODAY") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  if (rangeKey === "30D") {
    const start = new Date(now);
    start.setDate(start.getDate() - 29);
    start.setHours(0, 0, 0, 0);

    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  if (rangeKey === "THIS_MONTH") {
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);

    return {
      start: new Date(now.getFullYear(), now.getMonth(), 1),
      end,
    };
  }

  if (rangeKey === "CUSTOM") {
    return {
      start: getDayStart(customRange.startDate),
      end: getDayEnd(customRange.endDate),
    };
  }

  return { start: null, end: null };
};

const getLeadRangeDate = (lead) => {
  const status = String(lead?.status || "").toUpperCase();
  if (status === "CLOSED" || status === "LOST") {
    return toDate(lead?.updatedAt || lead?.createdAt);
  }
  return toDate(lead?.createdAt);
};

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

const formatDateTime = (value) => {
  const parsed = toDate(value);
  if (!parsed) return "-";
  return parsed.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const toObjectIdString = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && value._id) return String(value._id);
  return String(value);
};

const toAmountNumber = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const getLeadRelatedInventories = (lead = {}) => {
  const merged = [];
  const seen = new Set();
  const pushUnique = (value) => {
    const id = toObjectIdString(value);
    if (!id || seen.has(id)) return;
    seen.add(id);
    merged.push(value);
  };

  pushUnique(lead?.inventoryId);
  if (Array.isArray(lead?.relatedInventoryIds)) {
    lead.relatedInventoryIds.forEach((row) => pushUnique(row));
  }

  return merged;
};

const getLeadSaleEntries = (lead = {}) => {
  const leadId = toObjectIdString(lead?._id) || "lead";
  const leadStatus = String(lead?.status || "").trim().toUpperCase();
  const isClosedContext = ["CLOSED", "REQUESTED"].includes(leadStatus);
  const linkedInventories = getLeadRelatedInventories(lead);
  const saleEntries = [];

  linkedInventories.forEach((inventory, index) => {
    if (!inventory || typeof inventory !== "object") return;

    const saleTotalAmount = toAmountNumber(inventory?.saleDetails?.totalAmount);
    const inventoryPrice = toAmountNumber(inventory?.price);
    const totalAmount =
      saleTotalAmount !== null && saleTotalAmount > 0
        ? saleTotalAmount
        : inventoryPrice;

    if (totalAmount === null || totalAmount <= 0) return;

    const inventoryStatus = String(inventory?.status || "").trim().toUpperCase();
    const hasSaleDetails = saleTotalAmount !== null && saleTotalAmount > 0;
    const isSoldInventory = inventoryStatus === "SOLD" || hasSaleDetails;

    if (!isClosedContext && !isSoldInventory) return;

    const remainingRaw = toAmountNumber(inventory?.saleDetails?.remainingAmount);
    const remainingAmount =
      remainingRaw === null
        ? 0
        : Math.max(0, Math.min(remainingRaw, totalAmount));
    const entryKey = toObjectIdString(inventory) || `${leadId}:${index}`;

    saleEntries.push({
      entryKey,
      totalAmount,
      remainingAmount,
    });
  });

  if (saleEntries.length > 0 || !isClosedContext) return saleEntries;

  const fallbackInventory = linkedInventories.find((inventory) => {
    if (!inventory || typeof inventory !== "object") return false;
    const amount = toAmountNumber(inventory?.price);
    return amount !== null && amount > 0;
  });
  const fallbackTotalAmount = toAmountNumber(fallbackInventory?.price);
  if (fallbackTotalAmount === null || fallbackTotalAmount <= 0) return saleEntries;

  const paymentType = String(lead?.dealPayment?.paymentType || "").trim().toUpperCase();
  const dealRemainingRaw = toAmountNumber(lead?.dealPayment?.remainingAmount);
  const fallbackRemainingAmount =
    paymentType === "PARTIAL" && dealRemainingRaw !== null
      ? Math.max(0, Math.min(dealRemainingRaw, fallbackTotalAmount))
      : 0;

  saleEntries.push({
    entryKey: `${leadId}:fallback`,
    totalAmount: fallbackTotalAmount,
    remainingAmount: fallbackRemainingAmount,
  });

  return saleEntries;
};

const FinancialCore = () => {
  const navigate = useNavigate();
  const [leadWorkspaceBasePath, setLeadWorkspaceBasePath] = useState("/leads");
  const [rangeKey, setRangeKey] = useState("30D");
  const [customRange, setCustomRange] = useState(() => {
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - 9);
    return {
      startDate: toDateInputValue(start),
      endDate: toDateInputValue(now),
    };
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [leads, setLeads] = useState([]);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const role = String(window.localStorage.getItem("role") || "")
      .trim()
      .toUpperCase();
    setLeadWorkspaceBasePath(EXECUTIVE_ROLE_SET.has(role) ? "/my-leads" : "/leads");
  }, []);

  const loadFinanceData = useCallback(async (silent = false) => {
    try {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");
      const rows = await getAllLeads();
      setLeads(Array.isArray(rows) ? rows : []);
      setLastUpdatedAt(new Date());
    } catch (fetchError) {
      setError(toErrorMessage(fetchError, "Failed to load finance data"));
      setLeads([]);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFinanceData(false);
  }, [loadFinanceData]);

  const scopedLeads = useMemo(() => {
    const { start, end } = resolveRangeBounds({ rangeKey, customRange });
    if (!start && !end) return leads;

    return leads.filter((lead) => {
      const rangeDate = getLeadRangeDate(lead);
      if (!rangeDate) return false;
      if (start && rangeDate < start) return false;
      if (end && rangeDate > end) return false;
      return true;
    });
  }, [customRange, leads, rangeKey]);

  const dashboard = useMemo(() => {
    const statusCount = PIPELINE_STATUSES.reduce((acc, status) => {
      acc[status.key] = 0;
      return acc;
    }, {});

    const sourceCount = { META: 0, MANUAL: 0, OTHER: 0 };
    const activeStatuses = new Set(["NEW", "CONTACTED", "INTERESTED", "SITE_VISIT"]);
    const countedSaleKeys = new Set();
    let totalSellAmount = 0;
    let pendingSellCollection = 0;

    scopedLeads.forEach((lead) => {
      const status = String(lead.status || "NEW");
      const source = String(lead.source || "");

      if (Object.prototype.hasOwnProperty.call(statusCount, status)) {
        statusCount[status] += 1;
      }

      if (source === "META") {
        sourceCount.META += 1;
      } else if (source === "MANUAL") {
        sourceCount.MANUAL += 1;
      } else {
        sourceCount.OTHER += 1;
      }

      getLeadSaleEntries(lead).forEach((entry) => {
        if (countedSaleKeys.has(entry.entryKey)) return;
        countedSaleKeys.add(entry.entryKey);
        totalSellAmount += entry.totalAmount;
        pendingSellCollection += entry.remainingAmount;
      });
    });

    const totalLeads = scopedLeads.length;
    const closedDeals = statusCount.CLOSED;
    const lostDeals = statusCount.LOST;
    const activePipeline = [...activeStatuses].reduce(
      (sum, status) => sum + (statusCount[status] || 0),
      0,
    );

    const conversionRate = totalLeads > 0 ? Math.round((closedDeals / totalLeads) * 100) : 0;
    const winRate =
      closedDeals + lostDeals > 0
        ? Math.round((closedDeals / (closedDeals + lostDeals)) * 100)
        : 0;

    const collectedSellValue = Math.max(0, totalSellAmount - pendingSellCollection);
    const commissionPayable = closedDeals * COMMISSION_PER_DEAL;
    const avgCommissionPerClosed = closedDeals > 0 ? commissionPayable / closedDeals : 0;

    return {
      totalLeads,
      closedDeals,
      lostDeals,
      activePipeline,
      conversionRate,
      winRate,
      totalSellAmount,
      pendingSellCollection,
      collectedSellValue,
      commissionPayable,
      avgCommissionPerClosed,
      statusCount,
      sourceCount,
    };
  }, [scopedLeads]);

  const followUps = useMemo(() => {
    const now = new Date();
    const next7Days = new Date(now);
    next7Days.setDate(next7Days.getDate() + 7);

    const upcoming = scopedLeads
      .filter((lead) => !["CLOSED", "LOST"].includes(String(lead.status || "")))
      .filter((lead) => toDate(lead.nextFollowUp))
      .map((lead) => {
        const followUpDate = toDate(lead.nextFollowUp);
        return {
          ...lead,
          followUpDate,
          isOverdue: followUpDate ? followUpDate < now : false,
        };
      })
      .sort((a, b) => a.followUpDate - b.followUpDate);

    return {
      overdue: upcoming.filter((lead) => lead.isOverdue),
      thisWeek: upcoming.filter(
        (lead) => lead.followUpDate >= now && lead.followUpDate <= next7Days,
      ),
      all: upcoming,
    };
  }, [scopedLeads]);

  const recentClosures = useMemo(
    () =>
      scopedLeads
        .filter((lead) => String(lead.status || "") === "CLOSED")
        .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
        .slice(0, 8),
    [scopedLeads],
  );

  const statusRows = useMemo(
    () =>
      PIPELINE_STATUSES.map((status) => {
        const count = dashboard.statusCount[status.key] || 0;
        const share = dashboard.totalLeads > 0 ? Math.round((count / dashboard.totalLeads) * 100) : 0;
        return { ...status, count, share };
      }),
    [dashboard.statusCount, dashboard.totalLeads],
  );

  const openLeadWorkspace = useCallback(
    ({ status = "", query = "", dueOnly = false, leadId = "" } = {}) => {
      const normalizedStatus = String(status || "").trim().toUpperCase();
      const normalizedQuery = String(query || "").trim();
      const normalizedLeadId = String(leadId || "").trim();
      const searchParams = new URLSearchParams();

      if (normalizedStatus && LEAD_STATUS_SET.has(normalizedStatus)) {
        searchParams.set("status", normalizedStatus);
      }

      if (normalizedQuery) {
        searchParams.set("q", normalizedQuery);
      }

      if (dueOnly) {
        searchParams.set("due", "1");
      }

      const targetPath = normalizedLeadId
        ? `${leadWorkspaceBasePath}/${normalizedLeadId}`
        : leadWorkspaceBasePath;
      const search = searchParams.toString();
      navigate(search ? `${targetPath}?${search}` : targetPath);
    },
    [leadWorkspaceBasePath, navigate],
  );

  const statCards = useMemo(
    () => [
      {
        title: "Leads In Scope",
        value: dashboard.totalLeads,
        helper: "Filtered by selected range",
        icon: Users,
        onClick: () => openLeadWorkspace({ status: "ALL" }),
      },
      {
        title: "Active Pipeline",
        value: dashboard.activePipeline,
        helper: "New to Site Visit stages",
        icon: TrendingUp,
        onClick: () => openLeadWorkspace({ status: "INTERESTED" }),
      },
      {
        title: "Closed Deals",
        value: dashboard.closedDeals,
        helper: `Win rate ${dashboard.winRate}%`,
        icon: CheckCircle2,
        onClick: () => openLeadWorkspace({ status: "CLOSED" }),
      },
      {
        title: "Total Sell Value",
        value: formatCurrency(dashboard.totalSellAmount),
        helper: `Collected ${formatCurrency(dashboard.collectedSellValue)} | Pending ${formatCurrency(dashboard.pendingSellCollection)}`,
        icon: IndianRupee,
        onClick: () => openLeadWorkspace({ status: "CLOSED" }),
      },
      {
        title: "Remaining Amount",
        value: formatCurrency(dashboard.pendingSellCollection),
        helper: "Pending collection on partial closures",
        icon: Clock3,
        onClick: () => openLeadWorkspace({ status: "CLOSED" }),
      },
      {
        title: "Conversion Rate",
        value: `${dashboard.conversionRate}%`,
        helper: `${dashboard.lostDeals} leads lost`,
        icon: BarChart3,
        onClick: () => openLeadWorkspace({ status: "CLOSED" }),
      },
      {
        title: "Commission Payable",
        value: formatCurrency(dashboard.commissionPayable),
        helper: `Avg ${formatCurrency(dashboard.avgCommissionPerClosed)} per closed deal`,
        icon: IndianRupee,
        onClick: () => openLeadWorkspace({ status: "CLOSED" }),
      },
    ],
    [dashboard, openLeadWorkspace],
  );

  if (loading) {
    return (
      <div className="w-full h-full px-4 sm:px-6 lg:px-10 pt-20 md:pt-24 pb-8 flex items-center justify-center text-slate-500 gap-2">
        <RefreshCw size={18} className="animate-spin" />
        Loading finance dashboard...
      </div>
    );
  }

  return (
    <div className="w-full h-full px-4 sm:px-6 lg:px-10 pt-20 md:pt-24 pb-8 space-y-6 overflow-y-auto custom-scrollbar">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">Finance Dashboard</h1>
          <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">
            Real-time view from lead pipeline and closures
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Click any card or row to drill down into lead workspace.
            {lastUpdatedAt ? ` Updated ${formatDateTime(lastUpdatedAt)}.` : ""}
          </p>
        </div>

        <div className="flex flex-col items-start gap-2 sm:items-end">
          <div className="inline-flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
            <div className="inline-flex flex-wrap items-center gap-1 rounded-xl bg-slate-100 p-1">
              {RANGE_OPTIONS.map((range) => (
                <button
                  key={range.key}
                  type="button"
                  onClick={() => setRangeKey(range.key)}
                  className={`h-9 rounded-lg px-3 text-xs font-semibold transition-all ${
                    rangeKey === range.key
                      ? "bg-slate-900 text-white shadow-sm"
                      : "bg-transparent text-slate-700 hover:bg-white hover:text-slate-900"
                  }`}
                >
                  {range.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => loadFinanceData(true)}
              disabled={refreshing}
              className="h-9 rounded-xl border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:border-slate-400 disabled:opacity-60 inline-flex items-center gap-2"
            >
              <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>

          {rangeKey === "CUSTOM" ? (
            <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
              <label className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-600">
                From
                <input
                  type="date"
                  value={customRange.startDate}
                  onChange={(event) => {
                    const nextStart = event.target.value;
                    setCustomRange((prev) => ({
                      startDate: nextStart,
                      endDate:
                        prev.endDate && nextStart && prev.endDate < nextStart
                          ? nextStart
                          : prev.endDate,
                    }));
                  }}
                  className="h-9 bg-transparent text-slate-700 outline-none"
                />
              </label>
              <label className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-600">
                To
                <input
                  type="date"
                  value={customRange.endDate}
                  onChange={(event) => {
                    const nextEnd = event.target.value;
                    setCustomRange((prev) => ({
                      startDate:
                        prev.startDate && nextEnd && prev.startDate > nextEnd
                          ? nextEnd
                          : prev.startDate,
                      endDate: nextEnd,
                    }));
                  }}
                  className="h-9 bg-transparent text-slate-700 outline-none"
                />
              </label>
            </div>
          ) : null}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-7">
        {statCards.map((card) => (
          <StatCard
            key={card.title}
            title={card.title}
            value={card.value}
            helper={card.helper}
            icon={card.icon}
            onClick={card.onClick}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.5fr_1fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-600">
            Pipeline Breakdown
          </h2>
          <div className="mt-3 space-y-3">
            {statusRows.map((row) => (
              <button
                key={row.key}
                type="button"
                onClick={() => openLeadWorkspace({ status: row.key })}
                className="w-full space-y-1.5 rounded-lg px-2 py-1 text-left transition-colors hover:bg-slate-50"
              >
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-700">{row.label}</span>
                  <span className="text-slate-500">
                    {row.count} ({row.share}%)
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-slate-900"
                    style={{ width: `${Math.min(row.share, 100)}%` }}
                  />
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-600">
            Source Mix
          </h2>
          <div className="mt-4 grid grid-cols-1 gap-3">
            <SourceCard
              label="Meta Leads"
              count={dashboard.sourceCount.META}
              total={dashboard.totalLeads}
              onClick={() => openLeadWorkspace({ query: "META" })}
            />
            <SourceCard
              label="Manual Leads"
              count={dashboard.sourceCount.MANUAL}
              total={dashboard.totalLeads}
              onClick={() => openLeadWorkspace({ query: "MANUAL" })}
            />
            <SourceCard
              label="Other Sources"
              count={dashboard.sourceCount.OTHER}
              total={dashboard.totalLeads}
              onClick={() => openLeadWorkspace({ query: "OTHER" })}
            />
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-600">
              Recent Closed Deals
            </h2>
            <button
              type="button"
              onClick={() => openLeadWorkspace({ status: "CLOSED" })}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900"
            >
              Open Leads
            </button>
          </div>

          {recentClosures.length === 0 ? (
            <EmptyState text="No closed deals in selected range." />
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-slate-500">
                    <th className="py-2 pr-3">Lead</th>
                    <th className="py-2 pr-3">Project</th>
                    <th className="py-2 pr-3">Assigned</th>
                    <th className="py-2">Closed On</th>
                  </tr>
                </thead>
                <tbody>
                  {recentClosures.map((lead) => (
                    <tr
                      key={lead._id}
                      className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
                      onClick={() => openLeadWorkspace({ leadId: lead._id })}
                    >
                      <td className="py-2 pr-3 text-slate-800">
                        <div className="font-medium">{lead.name || "-"}</div>
                        <div className="text-xs text-slate-500">{lead.phone || "-"}</div>
                      </td>
                      <td className="py-2 pr-3 text-slate-700">{lead.projectInterested || "-"}</td>
                      <td className="py-2 pr-3 text-slate-700">{lead.assignedTo?.name || "Unassigned"}</td>
                      <td className="py-2 text-slate-600">{formatDateTime(lead.updatedAt || lead.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-600">
              Follow-up Watchlist
            </h2>
            <Clock3 size={15} className="text-slate-500" />
          </div>

          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <button
              type="button"
              onClick={() => openLeadWorkspace({ dueOnly: true })}
              className="rounded-full bg-red-50 px-2.5 py-1 font-semibold text-red-700 border border-red-200 hover:border-red-300"
            >
              Overdue: {followUps.overdue.length}
            </button>
            <button
              type="button"
              onClick={() => openLeadWorkspace({ status: "ALL" })}
              className="rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-700 border border-amber-200 hover:border-amber-300"
            >
              Next 7 days: {followUps.thisWeek.length}
            </button>
          </div>

          {followUps.all.length === 0 ? (
            <EmptyState text="No upcoming follow-ups in selected range." />
          ) : (
            <div className="mt-3 space-y-2">
              {followUps.all.slice(0, 8).map((lead) => (
                <button
                  key={lead._id}
                  type="button"
                  onClick={() => openLeadWorkspace({ leadId: lead._id })}
                  className={`rounded-lg border px-3 py-2 ${
                    lead.isOverdue ? "border-red-200 bg-red-50" : "border-slate-200 bg-slate-50"
                  } w-full text-left`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{lead.name || "-"}</p>
                      <p className="text-xs text-slate-500">{lead.projectInterested || "-"}</p>
                    </div>
                    <p className={`text-xs font-semibold ${lead.isOverdue ? "text-red-700" : "text-slate-600"}`}>
                      {formatDateTime(lead.nextFollowUp)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-600">
          Quick Actions
        </h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => openLeadWorkspace({ status: "ALL" })}
            className="h-11 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:border-slate-500 inline-flex items-center justify-center gap-2"
          >
            <Users size={15} />
            Open Leads Management
          </button>
          <button
            type="button"
            onClick={() => navigate("/inventory")}
            className="h-11 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:border-slate-500 inline-flex items-center justify-center gap-2"
          >
            <Building2 size={15} />
            Open Inventory
          </button>
        </div>
      </section>
    </div>
  );
};

const StatCard = ({ title, value, helper, icon: Icon, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="group rounded-2xl border border-slate-200 bg-white p-4 text-left transition-all hover:border-slate-300 hover:shadow-sm"
  >
    <div className="flex items-center justify-between gap-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{title}</p>
      <div className="rounded-lg bg-slate-100 p-2 text-slate-700">
        <Icon size={14} />
      </div>
    </div>
    <p className="mt-3 text-2xl font-semibold text-slate-900">{value}</p>
    <div className="mt-1 flex items-center justify-between gap-2">
      <p className="text-xs text-slate-500">{helper}</p>
      <ChevronRight size={14} className="text-slate-400 transition-transform group-hover:translate-x-0.5" />
    </div>
  </button>
);

const SourceCard = ({ label, count, total, onClick }) => {
  const share = total > 0 ? Math.round((count / total) * 100) : 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-left transition-colors hover:border-slate-300 hover:bg-slate-100/70"
    >
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-slate-700">{label}</span>
        <span className="text-slate-600">
          {count} ({share}%)
        </span>
      </div>
      <div className="mt-2 h-2 w-full rounded-full bg-slate-200">
        <div className="h-full rounded-full bg-slate-700" style={{ width: `${Math.min(share, 100)}%` }} />
      </div>
    </button>
  );
};

const EmptyState = ({ text }) => (
  <div className="mt-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
    {text}
  </div>
);

export default FinancialCore;
