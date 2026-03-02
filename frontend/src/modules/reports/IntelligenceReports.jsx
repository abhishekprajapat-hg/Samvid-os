import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { getAllLeads } from "../../services/leadService";
import { getInventoryAssets } from "../../services/inventoryService";
import { toErrorMessage } from "../../utils/errorMessage";
import {
  ExecutivePerformanceSection,
  FollowUpRiskSection,
  InventoryInsightsSection,
  LeadAgingSection,
  LeadFunnelSection,
  ProjectDemandSection,
  ReportsHeader,
  ReportSummaryCards,
  SourceEffectivenessSection,
} from "./components/IntelligenceReportSections";

const RANGE_OPTIONS = [
  { key: "30D", label: "Last 30 Days" },
  { key: "THIS_MONTH", label: "This Month" },
  { key: "CUSTOM", label: "Custom" },
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
    const { start, end } = resolveRangeBounds({ rangeKey, customRange });
    if (!start && !end) {
      return { leads, inventory };
    }

    return {
      leads: leads.filter((lead) => {
        const rangeDate = getLeadRangeDate(lead);
        if (!rangeDate) return false;
        if (start && rangeDate < start) return false;
        if (end && rangeDate > end) return false;
        return true;
      }),
      inventory: inventory.filter((asset) => {
        const createdAt = toDate(asset.createdAt);
        if (!createdAt) return false;
        if (start && createdAt < start) return false;
        if (end && createdAt > end) return false;
        return true;
      }),
    };
  }, [customRange, inventory, leads, rangeKey]);

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
      <ReportsHeader
        rangeOptions={RANGE_OPTIONS}
        rangeKey={rangeKey}
        onRangeChange={setRangeKey}
        customRange={customRange}
        onCustomRangeChange={setCustomRange}
        refreshing={refreshing}
        onRefresh={() => loadReports(true)}
        onExport={handleExportCsv}
      />

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      <ReportSummaryCards topMetrics={topMetrics} formatPercent={formatPercent} />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <LeadFunnelSection leadStageRows={leadStageRows} formatPercent={formatPercent} />
        <LeadAgingSection agingBuckets={agingBuckets} />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <SourceEffectivenessSection
          sourcePerformance={sourcePerformance}
          formatPercent={formatPercent}
        />
        <ProjectDemandSection projectDemand={projectDemand} />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <ExecutivePerformanceSection
          executivePerformance={executivePerformance}
          formatPercent={formatPercent}
        />
        <FollowUpRiskSection
          followUpRisk={followUpRisk}
          formatDateTime={formatDateTime}
        />
      </div>

      <InventoryInsightsSection
        inventoryInsights={inventoryInsights}
        formatCurrency={formatCurrency}
      />
    </div>
  );
};

export default IntelligenceReports;
