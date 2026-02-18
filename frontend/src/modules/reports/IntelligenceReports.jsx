import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Download,
  RefreshCw,
  ShieldCheck,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import { getAllLeads } from "../../services/leadService";
import { getInventoryAssets } from "../../services/inventoryService";
import { toErrorMessage } from "../../utils/errorMessage";

const RANGE_OPTIONS = [
  { key: "30D", label: "Last 30 Days" },
  { key: "THIS_MONTH", label: "This Month" },
  { key: "ALL", label: "All Time" },
];

const LEAD_STAGES = [
  { key: "NEW", label: "New" },
  { key: "CONTACTED", label: "Contacted" },
  { key: "INTERESTED", label: "Interested" },
  { key: "SITE_VISIT", label: "Site Visit" },
  { key: "CLOSED", label: "Closed" },
  { key: "LOST", label: "Lost" },
];

const ACTIVE_STATUSES = new Set(["NEW", "CONTACTED", "INTERESTED", "SITE_VISIT"]);
const QUALIFIED_STATUSES = new Set(["INTERESTED", "SITE_VISIT", "CLOSED"]);

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

const formatPercent = (value) => `${Math.round(Number(value) || 0)}%`;

const formatDateTime = (value) => {
  const parsed = toDate(value);
  if (!parsed) return "-";
  return parsed.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

const toCsvValue = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;

const downloadCsv = (filename, rows) => {
  const csv = rows.map((row) => row.map((value) => toCsvValue(value)).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
};

const IntelligenceReports = () => {
  const [rangeKey, setRangeKey] = useState("30D");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [leads, setLeads] = useState([]);
  const [inventory, setInventory] = useState([]);

  const loadReports = useCallback(async (silent = false) => {
    try {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");
      const [leadRows, inventoryRows] = await Promise.all([getAllLeads(), getInventoryAssets()]);
      setLeads(Array.isArray(leadRows) ? leadRows : []);
      setInventory(Array.isArray(inventoryRows) ? inventoryRows : []);
    } catch (fetchError) {
      setError(toErrorMessage(fetchError, "Failed to load reports"));
      setLeads([]);
      setInventory([]);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReports(false);
  }, [loadReports]);

  const scopedData = useMemo(() => {
    const start = getRangeStart(rangeKey);
    if (!start) {
      return { leads, inventory };
    }

    return {
      leads: leads.filter((lead) => {
        const createdAt = toDate(lead.createdAt);
        return createdAt && createdAt >= start;
      }),
      inventory: inventory.filter((asset) => {
        const createdAt = toDate(asset.createdAt);
        return createdAt && createdAt >= start;
      }),
    };
  }, [inventory, leads, rangeKey]);

  const leadStageRows = useMemo(() => {
    const countMap = LEAD_STAGES.reduce((acc, stage) => {
      acc[stage.key] = 0;
      return acc;
    }, {});

    scopedData.leads.forEach((lead) => {
      const status = String(lead.status || "NEW");
      if (Object.prototype.hasOwnProperty.call(countMap, status)) {
        countMap[status] += 1;
      }
    });

    const total = scopedData.leads.length;
    return LEAD_STAGES.map((stage) => {
      const count = countMap[stage.key] || 0;
      return {
        ...stage,
        count,
        share: total > 0 ? (count / total) * 100 : 0,
      };
    });
  }, [scopedData.leads]);

  const topMetrics = useMemo(() => {
    const totalLeads = scopedData.leads.length;
    const closed = scopedData.leads.filter((lead) => String(lead.status || "") === "CLOSED").length;
    const qualified = scopedData.leads.filter((lead) => QUALIFIED_STATUSES.has(String(lead.status || ""))).length;
    const active = scopedData.leads.filter((lead) => ACTIVE_STATUSES.has(String(lead.status || ""))).length;

    const conversion = totalLeads > 0 ? (closed / totalLeads) * 100 : 0;

    const closeAges = scopedData.leads
      .filter((lead) => String(lead.status || "") === "CLOSED")
      .map((lead) => {
        const created = toDate(lead.createdAt);
        const updated = toDate(lead.updatedAt || lead.createdAt);
        if (!created || !updated) return null;
        return Math.max((updated - created) / (1000 * 60 * 60 * 24), 0);
      })
      .filter((days) => Number.isFinite(days));

    const avgDaysToClose =
      closeAges.length > 0 ? closeAges.reduce((sum, days) => sum + days, 0) / closeAges.length : 0;

    const reservedOrSold = scopedData.inventory.filter((asset) =>
      ["Reserved", "Sold"].includes(String(asset.status || "")),
    ).length;
    const inventoryUtilization =
      scopedData.inventory.length > 0 ? (reservedOrSold / scopedData.inventory.length) * 100 : 0;

    return {
      totalLeads,
      qualified,
      active,
      closed,
      conversion,
      avgDaysToClose,
      inventoryUtilization,
    };
  }, [scopedData.inventory, scopedData.leads]);

  const sourcePerformance = useMemo(() => {
    const map = new Map();

    scopedData.leads.forEach((lead) => {
      const source = String(lead.source || "OTHER");
      if (!map.has(source)) {
        map.set(source, {
          source,
          total: 0,
          qualified: 0,
          closed: 0,
        });
      }

      const row = map.get(source);
      row.total += 1;

      const status = String(lead.status || "");
      if (QUALIFIED_STATUSES.has(status)) row.qualified += 1;
      if (status === "CLOSED") row.closed += 1;
    });

    return [...map.values()]
      .map((row) => ({
        ...row,
        conversion: row.total > 0 ? (row.closed / row.total) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [scopedData.leads]);

  const executivePerformance = useMemo(() => {
    const map = new Map();

    scopedData.leads.forEach((lead) => {
      const assignee = lead.assignedTo;
      const key = String(assignee?._id || "unassigned");
      const label = assignee?.name || "Unassigned";

      if (!map.has(key)) {
        map.set(key, {
          key,
          label,
          total: 0,
          active: 0,
          closed: 0,
          lost: 0,
        });
      }

      const row = map.get(key);
      row.total += 1;

      const status = String(lead.status || "");
      if (status === "CLOSED") row.closed += 1;
      else if (status === "LOST") row.lost += 1;
      else row.active += 1;
    });

    return [...map.values()]
      .map((row) => ({
        ...row,
        closeRate: row.total > 0 ? (row.closed / row.total) * 100 : 0,
      }))
      .sort((a, b) => b.closed - a.closed || b.active - a.active)
      .slice(0, 10);
  }, [scopedData.leads]);

  const projectDemand = useMemo(() => {
    const map = new Map();

    scopedData.leads.forEach((lead) => {
      const project = String(lead.projectInterested || "").trim() || "Unspecified";

      if (!map.has(project)) {
        map.set(project, {
          project,
          leads: 0,
          qualified: 0,
          closed: 0,
        });
      }

      const row = map.get(project);
      row.leads += 1;

      const status = String(lead.status || "");
      if (QUALIFIED_STATUSES.has(status)) row.qualified += 1;
      if (status === "CLOSED") row.closed += 1;
    });

    return [...map.values()].sort((a, b) => b.leads - a.leads).slice(0, 10);
  }, [scopedData.leads]);

  const agingBuckets = useMemo(() => {
    const buckets = [
      { label: "0-3 days", min: 0, max: 3, count: 0 },
      { label: "4-7 days", min: 4, max: 7, count: 0 },
      { label: "8-14 days", min: 8, max: 14, count: 0 },
      { label: "15-30 days", min: 15, max: 30, count: 0 },
      { label: "31+ days", min: 31, max: Number.POSITIVE_INFINITY, count: 0 },
    ];

    const now = new Date();
    scopedData.leads
      .filter((lead) => ACTIVE_STATUSES.has(String(lead.status || "")))
      .forEach((lead) => {
        const createdAt = toDate(lead.createdAt);
        if (!createdAt) return;

        const ageDays = Math.floor((now - createdAt) / (1000 * 60 * 60 * 24));
        const bucket = buckets.find((item) => ageDays >= item.min && ageDays <= item.max);
        if (bucket) bucket.count += 1;
      });

    const maxCount = Math.max(...buckets.map((row) => row.count), 1);
    return buckets.map((row) => ({
      ...row,
      share: (row.count / maxCount) * 100,
    }));
  }, [scopedData.leads]);

  const inventoryInsights = useMemo(() => {
    const statusMap = {
      Available: { count: 0, value: 0 },
      Reserved: { count: 0, value: 0 },
      Sold: { count: 0, value: 0 },
      Other: { count: 0, value: 0 },
    };

    const locationMap = new Map();

    scopedData.inventory.forEach((asset) => {
      const status = String(asset.status || "");
      const price = Number(asset.price) || 0;

      if (Object.prototype.hasOwnProperty.call(statusMap, status)) {
        statusMap[status].count += 1;
        statusMap[status].value += price;
      } else {
        statusMap.Other.count += 1;
        statusMap.Other.value += price;
      }

      const location = String(asset.location || "").trim() || "Unspecified";
      if (!locationMap.has(location)) {
        locationMap.set(location, { location, units: 0, value: 0 });
      }

      const row = locationMap.get(location);
      row.units += 1;
      row.value += price;
    });

    return {
      statusRows: Object.entries(statusMap).map(([label, value]) => ({ label, ...value })),
      locationRows: [...locationMap.values()].sort((a, b) => b.units - a.units).slice(0, 8),
    };
  }, [scopedData.inventory]);

  const followUpRisk = useMemo(() => {
    const now = new Date();
    const next48 = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    const rows = scopedData.leads
      .filter((lead) => ACTIVE_STATUSES.has(String(lead.status || "")))
      .map((lead) => {
        const nextFollowUp = toDate(lead.nextFollowUp);
        return {
          ...lead,
          nextFollowUp,
        };
      })
      .filter((lead) => lead.nextFollowUp)
      .sort((a, b) => a.nextFollowUp - b.nextFollowUp);

    return {
      overdue: rows.filter((lead) => lead.nextFollowUp < now),
      next48h: rows.filter((lead) => lead.nextFollowUp >= now && lead.nextFollowUp <= next48),
      list: rows.slice(0, 10),
    };
  }, [scopedData.leads]);

  const handleExportCsv = () => {
    const rows = [["Section", "Metric", "Value"]];

    rows.push(["Summary", "Total Leads", topMetrics.totalLeads]);
    rows.push(["Summary", "Qualified Leads", topMetrics.qualified]);
    rows.push(["Summary", "Active Leads", topMetrics.active]);
    rows.push(["Summary", "Closed Leads", topMetrics.closed]);
    rows.push(["Summary", "Lead Conversion", formatPercent(topMetrics.conversion)]);
    rows.push(["Summary", "Avg Days to Close", topMetrics.avgDaysToClose.toFixed(1)]);
    rows.push(["Summary", "Inventory Utilization", formatPercent(topMetrics.inventoryUtilization)]);

    LEAD_STAGES.forEach((stage) => {
      const row = leadStageRows.find((item) => item.key === stage.key);
      rows.push(["Lead Funnel", stage.label, row ? row.count : 0]);
    });

    sourcePerformance.forEach((row) => {
      rows.push([
        "Source Performance",
        row.source,
        `${row.total} leads, ${row.closed} closed, ${formatPercent(row.conversion)}`,
      ]);
    });

    executivePerformance.forEach((row) => {
      rows.push([
        "Executive Performance",
        row.label,
        `${row.total} total, ${row.closed} closed, ${formatPercent(row.closeRate)}`,
      ]);
    });

    projectDemand.forEach((row) => {
      rows.push([
        "Project Demand",
        row.project,
        `${row.leads} leads, ${row.closed} closed`,
      ]);
    });

    inventoryInsights.statusRows.forEach((row) => {
      rows.push([
        "Inventory Status",
        row.label,
        `${row.count} units, ${formatCurrency(row.value)}`,
      ]);
    });

    downloadCsv(`reports_${rangeKey.toLowerCase()}.csv`, rows);
  };

  if (loading) {
    return (
      <div className="w-full h-full px-4 sm:px-6 lg:px-10 pt-20 md:pt-24 pb-8 flex items-center justify-center text-slate-500 gap-2">
        <RefreshCw size={18} className="animate-spin" />
        Loading reports...
      </div>
    );
  }

  return (
    <div className="w-full h-full px-4 sm:px-6 lg:px-10 pt-20 md:pt-24 pb-8 space-y-6 overflow-y-auto custom-scrollbar">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">Reports Dashboard</h1>
          <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">
            Funnel, quality, team and inventory reporting
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
            onClick={() => loadReports(true)}
            disabled={refreshing}
            className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:border-slate-400 disabled:opacity-60 inline-flex items-center gap-2"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:border-slate-400 inline-flex items-center gap-2"
          >
            <Download size={14} />
            Export CSV
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
        <StatCard title="Total Leads" value={topMetrics.totalLeads} helper="Lead generation volume" icon={Users} />
        <StatCard title="Qualified Leads" value={topMetrics.qualified} helper="Interested + site visit + closed" icon={Target} />
        <StatCard title="Lead Conversion" value={formatPercent(topMetrics.conversion)} helper={`${topMetrics.closed} closed leads`} icon={TrendingUp} />
        <StatCard title="Avg Days To Close" value={topMetrics.avgDaysToClose.toFixed(1)} helper="Cycle time for closed leads" icon={ShieldCheck} />
        <StatCard title="Inventory Utilization" value={formatPercent(topMetrics.inventoryUtilization)} helper="Reserved + sold / total inventory" icon={ShieldCheck} />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-600">Lead Funnel</h2>
          <div className="mt-3 space-y-3">
            {leadStageRows.map((row) => (
              <div key={row.key} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-700">{row.label}</span>
                  <span className="text-slate-500">
                    {row.count} ({formatPercent(row.share)})
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-slate-900" style={{ width: `${Math.min(row.share, 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-600">Lead Aging (Active Pipeline)</h2>
          <div className="mt-3 space-y-3">
            {agingBuckets.map((row) => (
              <div key={row.label} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-700">{row.label}</span>
                  <span className="text-slate-500">{row.count}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-slate-900" style={{ width: `${Math.min(row.share, 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-600">Source Effectiveness</h2>
          {sourcePerformance.length === 0 ? (
            <EmptyState text="No source data in selected range." />
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-slate-500">
                    <th className="py-2 pr-3">Source</th>
                    <th className="py-2 pr-3">Leads</th>
                    <th className="py-2 pr-3">Qualified</th>
                    <th className="py-2 pr-3">Closed</th>
                    <th className="py-2">Conv.</th>
                  </tr>
                </thead>
                <tbody>
                  {sourcePerformance.map((row) => (
                    <tr key={row.source} className="border-t border-slate-100">
                      <td className="py-2 pr-3 text-slate-800">{row.source}</td>
                      <td className="py-2 pr-3 text-slate-700">{row.total}</td>
                      <td className="py-2 pr-3 text-slate-700">{row.qualified}</td>
                      <td className="py-2 pr-3 text-slate-700">{row.closed}</td>
                      <td className="py-2 text-slate-700">{formatPercent(row.conversion)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-600">Project Demand</h2>
          {projectDemand.length === 0 ? (
            <EmptyState text="No project demand data in selected range." />
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-slate-500">
                    <th className="py-2 pr-3">Project</th>
                    <th className="py-2 pr-3">Leads</th>
                    <th className="py-2 pr-3">Qualified</th>
                    <th className="py-2">Closed</th>
                  </tr>
                </thead>
                <tbody>
                  {projectDemand.map((row) => (
                    <tr key={row.project} className="border-t border-slate-100">
                      <td className="py-2 pr-3 text-slate-800">{row.project}</td>
                      <td className="py-2 pr-3 text-slate-700">{row.leads}</td>
                      <td className="py-2 pr-3 text-slate-700">{row.qualified}</td>
                      <td className="py-2 text-slate-700">{row.closed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-600">Executive Performance</h2>
          {executivePerformance.length === 0 ? (
            <EmptyState text="No executive data in selected range." />
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-slate-500">
                    <th className="py-2 pr-3">Executive</th>
                    <th className="py-2 pr-3">Total</th>
                    <th className="py-2 pr-3">Active</th>
                    <th className="py-2 pr-3">Closed</th>
                    <th className="py-2 pr-3">Lost</th>
                    <th className="py-2">Close Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {executivePerformance.map((row) => (
                    <tr key={row.key} className="border-t border-slate-100">
                      <td className="py-2 pr-3 text-slate-800">{row.label}</td>
                      <td className="py-2 pr-3 text-slate-700">{row.total}</td>
                      <td className="py-2 pr-3 text-slate-700">{row.active}</td>
                      <td className="py-2 pr-3 text-slate-700">{row.closed}</td>
                      <td className="py-2 pr-3 text-slate-700">{row.lost}</td>
                      <td className="py-2 text-slate-700">{formatPercent(row.closeRate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-600">Follow-up Risk Monitor</h2>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border border-red-200 bg-red-50 px-2.5 py-1 font-semibold text-red-700">
              Overdue: {followUpRisk.overdue.length}
            </span>
            <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 font-semibold text-amber-700">
              Next 48h: {followUpRisk.next48h.length}
            </span>
          </div>
          {followUpRisk.list.length === 0 ? (
            <EmptyState text="No scheduled follow-ups in selected range." />
          ) : (
            <div className="mt-3 space-y-2">
              {followUpRisk.list.map((lead) => (
                <div key={lead._id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{lead.name || "-"}</p>
                      <p className="text-xs text-slate-500">{lead.projectInterested || "-"}</p>
                    </div>
                    <p className="text-xs font-semibold text-slate-600">{formatDateTime(lead.nextFollowUp)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-600">Inventory Insights</h2>
        <div className="mt-3 grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="space-y-2">
            {inventoryInsights.statusRows.map((row) => (
              <div key={row.label} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-700">{row.label}</span>
                  <span className="text-slate-600">{row.count}</span>
                </div>
                <p className="mt-0.5 text-xs text-slate-500">{formatCurrency(row.value)}</p>
              </div>
            ))}
          </div>

          <div>
            {inventoryInsights.locationRows.length === 0 ? (
              <EmptyState text="No inventory location data in selected range." />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wider text-slate-500">
                      <th className="py-2 pr-3">Location</th>
                      <th className="py-2 pr-3">Units</th>
                      <th className="py-2">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventoryInsights.locationRows.map((row) => (
                      <tr key={row.location} className="border-t border-slate-100">
                        <td className="py-2 pr-3 text-slate-800">{row.location}</td>
                        <td className="py-2 pr-3 text-slate-700">{row.units}</td>
                        <td className="py-2 text-slate-700">{formatCurrency(row.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
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

const EmptyState = ({ text }) => (
  <div className="mt-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
    {text}
  </div>
);

export default IntelligenceReports;
