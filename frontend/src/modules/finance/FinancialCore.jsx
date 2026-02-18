import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  BarChart3,
  Building2,
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
  { key: "30D", label: "Last 30 Days" },
  { key: "THIS_MONTH", label: "This Month" },
  { key: "ALL", label: "All Time" },
];

const PIPELINE_STATUSES = [
  { key: "NEW", label: "New" },
  { key: "CONTACTED", label: "Contacted" },
  { key: "INTERESTED", label: "Interested" },
  { key: "SITE_VISIT", label: "Site Visit" },
  { key: "CLOSED", label: "Closed" },
  { key: "LOST", label: "Lost" },
];

const toDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getRangeStart = (rangeKey) => {
  const now = new Date();

  if (rangeKey === "30D") {
    const start = new Date(now);
    start.setDate(start.getDate() - 30);
    return start;
  }

  if (rangeKey === "THIS_MONTH") {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }

  return null;
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

const FinancialCore = () => {
  const navigate = useNavigate();
  const [rangeKey, setRangeKey] = useState("30D");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [leads, setLeads] = useState([]);

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
    const start = getRangeStart(rangeKey);
    if (!start) return leads;

    return leads.filter((lead) => {
      const createdAt = toDate(lead.createdAt);
      return createdAt && createdAt >= start;
    });
  }, [leads, rangeKey]);

  const dashboard = useMemo(() => {
    const statusCount = PIPELINE_STATUSES.reduce((acc, status) => {
      acc[status.key] = 0;
      return acc;
    }, {});

    const sourceCount = { META: 0, MANUAL: 0, OTHER: 0 };
    const activeStatuses = new Set(["NEW", "CONTACTED", "INTERESTED", "SITE_VISIT"]);

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

    const commissionPayable = closedDeals * COMMISSION_PER_DEAL;
    const avgCommissionPerClosed = closedDeals > 0 ? commissionPayable / closedDeals : 0;

    return {
      totalLeads,
      closedDeals,
      lostDeals,
      activePipeline,
      conversionRate,
      winRate,
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
        </div>

        <div className="flex flex-wrap gap-2">
          {RANGE_OPTIONS.map((range) => (
            <button
              key={range.key}
              type="button"
              onClick={() => setRangeKey(range.key)}
              className={`h-9 rounded-lg border px-3 text-xs font-semibold transition-colors ${
                rangeKey === range.key
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
              }`}
            >
              {range.label}
            </button>
          ))}

          <button
            type="button"
            onClick={() => loadFinanceData(true)}
            disabled={refreshing}
            className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:border-slate-400 disabled:opacity-60 inline-flex items-center gap-2"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          title="Leads In Scope"
          value={dashboard.totalLeads}
          helper="Filtered by selected range"
          icon={Users}
        />
        <StatCard
          title="Active Pipeline"
          value={dashboard.activePipeline}
          helper="New to Site Visit stages"
          icon={TrendingUp}
        />
        <StatCard
          title="Closed Deals"
          value={dashboard.closedDeals}
          helper={`Win rate ${dashboard.winRate}%`}
          icon={CheckCircle2}
        />
        <StatCard
          title="Conversion Rate"
          value={`${dashboard.conversionRate}%`}
          helper={`${dashboard.lostDeals} leads lost`}
          icon={BarChart3}
        />
        <StatCard
          title="Commission Payable"
          value={formatCurrency(dashboard.commissionPayable)}
          helper={`Avg ${formatCurrency(dashboard.avgCommissionPerClosed)} per closed deal`}
          icon={IndianRupee}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.5fr_1fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-600">
            Pipeline Breakdown
          </h2>
          <div className="mt-3 space-y-3">
            {statusRows.map((row) => (
              <div key={row.key} className="space-y-1.5">
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
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-600">
            Source Mix
          </h2>
          <div className="mt-4 grid grid-cols-1 gap-3">
            <SourceCard label="Meta Leads" count={dashboard.sourceCount.META} total={dashboard.totalLeads} />
            <SourceCard label="Manual Leads" count={dashboard.sourceCount.MANUAL} total={dashboard.totalLeads} />
            <SourceCard label="Other Sources" count={dashboard.sourceCount.OTHER} total={dashboard.totalLeads} />
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
              onClick={() => navigate("/leads")}
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
                    <tr key={lead._id} className="border-t border-slate-100">
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
            <span className="rounded-full bg-red-50 px-2.5 py-1 font-semibold text-red-700 border border-red-200">
              Overdue: {followUps.overdue.length}
            </span>
            <span className="rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-700 border border-amber-200">
              Next 7 days: {followUps.thisWeek.length}
            </span>
          </div>

          {followUps.all.length === 0 ? (
            <EmptyState text="No upcoming follow-ups in selected range." />
          ) : (
            <div className="mt-3 space-y-2">
              {followUps.all.slice(0, 8).map((lead) => (
                <div
                  key={lead._id}
                  className={`rounded-lg border px-3 py-2 ${
                    lead.isOverdue ? "border-red-200 bg-red-50" : "border-slate-200 bg-slate-50"
                  }`}
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
                </div>
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
            onClick={() => navigate("/leads")}
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

const StatCard = ({ title, value, helper, icon: Icon }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4">
    <div className="flex items-center justify-between gap-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{title}</p>
      <div className="rounded-lg bg-slate-100 p-2 text-slate-700">
        <Icon size={14} />
      </div>
    </div>
    <p className="mt-3 text-2xl font-semibold text-slate-900">{value}</p>
    <p className="mt-1 text-xs text-slate-500">{helper}</p>
  </div>
);

const SourceCard = ({ label, count, total }) => {
  const share = total > 0 ? Math.round((count / total) * 100) : 0;

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-slate-700">{label}</span>
        <span className="text-slate-600">
          {count} ({share}%)
        </span>
      </div>
      <div className="mt-2 h-2 w-full rounded-full bg-slate-200">
        <div className="h-full rounded-full bg-slate-700" style={{ width: `${Math.min(share, 100)}%` }} />
      </div>
    </div>
  );
};

const EmptyState = ({ text }) => (
  <div className="mt-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
    {text}
  </div>
);

export default FinancialCore;
