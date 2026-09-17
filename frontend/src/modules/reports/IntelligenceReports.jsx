import React, { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import ToastNotice from "../../components/ui/ToastNotice";
import { getAllLeads } from "../../services/leadService";
import { toErrorMessage } from "../../utils/errorMessage";

const RANGE_OPTIONS = [
  { key: "THIS_MONTH", label: "This month" },
  { key: "QUARTER", label: "Quarter" },
  { key: "YEAR", label: "Year" },
  { key: "CUSTOM", label: "Custom" },
];

const SITE_VISIT_STATUSES = new Set(["SITE_VISIT", "SITE_VISIT_SCHEDULED", "SITE_VISIT_OVERDUE"]);
const LOST_REASON_LABELS = {
  NOT_PICKING_CALLS: "Not picking calls",
  MISSING_IN_ACTION: "Missing in action",
  SITE_VISIT_OVERDUE: "Visit no-show",
  INVALID: "Invalid number",
  LOST: "Lost",
};

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
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
};

const startOfDay = (date) => {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const endOfDay = (date) => {
  const copy = new Date(date);
  copy.setHours(23, 59, 59, 999);
  return copy;
};

const resolveRangeBounds = ({ rangeKey, customRange, offset = 0 }) => {
  const now = new Date();

  if (rangeKey === "THIS_MONTH") {
    return {
      start: new Date(now.getFullYear(), now.getMonth() + offset, 1),
      end: endOfDay(new Date(now.getFullYear(), now.getMonth() + offset + 1, 0)),
    };
  }

  if (rangeKey === "QUARTER") {
    const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3 + offset * 3;
    return {
      start: new Date(now.getFullYear(), quarterStartMonth, 1),
      end: endOfDay(new Date(now.getFullYear(), quarterStartMonth + 3, 0)),
    };
  }

  if (rangeKey === "YEAR") {
    return {
      start: new Date(now.getFullYear() + offset, 0, 1),
      end: endOfDay(new Date(now.getFullYear() + offset, 11, 31)),
    };
  }

  if (rangeKey === "CUSTOM") {
    const start = parseLocalDateInput(customRange.startDate);
    const end = parseLocalDateInput(customRange.endDate);
    return {
      start: start ? startOfDay(start) : null,
      end: end ? endOfDay(end) : null,
    };
  }

  return { start: null, end: null };
};

const getLeadRangeDate = (lead) => {
  const status = String(lead?.status || "").toUpperCase();
  if (status === "CLOSED" || status === "LOST" || status === "INVALID") {
    return toDate(lead?.updatedAt || lead?.createdAt);
  }
  return toDate(lead?.createdAt);
};

const isInRange = (date, bounds) => {
  if (!date) return false;
  if (bounds.start && date < bounds.start) return false;
  if (bounds.end && date > bounds.end) return false;
  return true;
};

const formatPercent = (value, digits = 0) =>
  `${(Number(value) || 0).toFixed(digits).replace(/\.0+$/, "")}%`;

const formatCurrencyCompact = (value) => {
  const amount = Number(value) || 0;
  if (Math.abs(amount) >= 100000) {
    const lakhs = amount / 100000;
    return `₹${lakhs.toFixed(lakhs >= 10 ? 1 : 2).replace(/\.0+$/, "")} L`;
  }
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
};

const formatSignedDelta = (current, previous, { suffix = "%", inverse = false } = {}) => {
  if (!Number.isFinite(previous) || previous <= 0) return { text: "No previous data", tone: "" };
  const change = current - previous;
  const tone = inverse ? (change <= 0 ? "up" : "down") : (change >= 0 ? "up" : "down");
  const symbol = change >= 0 ? "▲" : "▼";
  const absolute = Math.abs(change);
  const value = suffix === "pt"
    ? `${absolute.toFixed(1).replace(/\.0$/, "")}pt`
    : `${Math.round(absolute)}${suffix}`;
  return { text: `${symbol} ${value}`, tone };
};

const getLeadRevenue = (lead = {}) => {
  const direct = Number(lead.brokerageReceived);
  if (Number.isFinite(direct) && direct > 0) return direct;

  const inventories = [
    ...(lead.inventoryId ? [lead.inventoryId] : []),
    ...(Array.isArray(lead.relatedInventoryIds) ? lead.relatedInventoryIds : []),
  ];
  return inventories.reduce((sum, inventory) => {
    const saleDetails = inventory && typeof inventory === "object" ? inventory.saleDetails : null;
    const total = Number(saleDetails?.totalAmount || inventory?.price || 0);
    const remaining = Number(saleDetails?.remainingAmount || 0);
    return sum + Math.max(0, total - remaining);
  }, 0);
};

const getInitials = (name = "") =>
  String(name || "Unassigned")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "UN";

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

const buildSummary = (leadRows) => {
  const received = leadRows.length;
  const closedRows = leadRows.filter((lead) => String(lead.status || "").toUpperCase() === "CLOSED");
  const visits = leadRows.filter((lead) => SITE_VISIT_STATUSES.has(String(lead.status || "").toUpperCase())).length;
  const closeAges = closedRows
    .map((lead) => {
      const created = toDate(lead.createdAt);
      const updated = toDate(lead.updatedAt || lead.createdAt);
      if (!created || !updated) return null;
      return Math.max(0, (updated - created) / (1000 * 60 * 60 * 24));
    })
    .filter((days) => Number.isFinite(days));
  const revenue = closedRows.reduce((sum, lead) => sum + getLeadRevenue(lead), 0);
  const metaRows = leadRows.filter((lead) => String(lead.source || "").toUpperCase() === "META");
  const metaSpend = metaRows.reduce((sum, lead) => sum + Number(lead.adSpend || lead.campaignSpend || 0), 0);

  return {
    received,
    closed: closedRows.length,
    visits,
    conversion: received > 0 ? (closedRows.length / received) * 100 : 0,
    avgDaysToClose: closeAges.length
      ? closeAges.reduce((sum, days) => sum + days, 0) / closeAges.length
      : 0,
    costPerLead: metaSpend > 0 && metaRows.length > 0 ? metaSpend / metaRows.length : null,
    revenue,
  };
};

const IntelligenceReports = () => {
  const [rangeKey, setRangeKey] = useState("THIS_MONTH");
  const [customRange, setCustomRange] = useState(() => {
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - 29);
    return {
      startDate: toDateInputValue(start),
      endDate: toDateInputValue(now),
    };
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [leads, setLeads] = useState([]);

  const loadReports = useCallback(async (silent = false) => {
    try {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");
      const leadRows = await getAllLeads();
      setLeads(Array.isArray(leadRows) ? leadRows : []);
    } catch (fetchError) {
      setError(toErrorMessage(fetchError, "Failed to load reports"));
      setLeads([]);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReports(false);
  }, [loadReports]);

  const currentBounds = useMemo(
    () => resolveRangeBounds({ rangeKey, customRange }),
    [customRange, rangeKey],
  );
  const previousBounds = useMemo(
    () => resolveRangeBounds({ rangeKey, customRange, offset: -1 }),
    [customRange, rangeKey],
  );

  const scopedLeads = useMemo(
    () => leads.filter((lead) => isInRange(getLeadRangeDate(lead), currentBounds)),
    [currentBounds, leads],
  );
  const previousLeads = useMemo(
    () => rangeKey === "CUSTOM"
      ? []
      : leads.filter((lead) => isInRange(getLeadRangeDate(lead), previousBounds)),
    [leads, previousBounds, rangeKey],
  );

  // Transfers stay countable after the lead moves on, so they read off the
  // assignment history rather than the current stage.
  const transferredLeadCount = useMemo(
    () => scopedLeads.filter((lead) => lead.assignmentHistory?.some((entry) => entry.action === "MANUAL_TRANSFER")).length,
    [scopedLeads],
  );

  const summary = useMemo(() => buildSummary(scopedLeads), [scopedLeads]);
  const previousSummary = useMemo(() => buildSummary(previousLeads), [previousLeads]);

  const statRows = useMemo(() => {
    const leadsDelta = formatSignedDelta(summary.received, previousSummary.received);
    const conversionDelta = formatSignedDelta(summary.conversion, previousSummary.conversion, { suffix: "pt" });
    const daysDelta = formatSignedDelta(summary.avgDaysToClose, previousSummary.avgDaysToClose, {
      suffix: " days",
      inverse: true,
    });
    const revenueDelta = formatSignedDelta(summary.revenue, previousSummary.revenue);

    return [
      { key: "Leads received", value: summary.received, delta: leadsDelta, detail: "vs previous period" },
      { key: "Conversion", value: formatPercent(summary.conversion, 1), delta: conversionDelta, detail: "vs previous period" },
      { key: "Avg. days to close", value: Math.round(summary.avgDaysToClose), delta: daysDelta, detail: daysDelta.tone === "down" ? "slower" : "faster" },
      {
        key: "Cost per lead",
        value: summary.costPerLead === null ? "-" : formatCurrencyCompact(summary.costPerLead),
        detail: "Meta campaigns only",
      },
      { key: "Revenue", value: formatCurrencyCompact(summary.revenue), delta: revenueDelta, detail: "vs previous period" },
    ];
  }, [previousSummary, summary]);

  const monthlyBars = useMemo(() => {
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, index) =>
      new Date(now.getFullYear(), now.getMonth() - 5 + index, 1),
    );
    const rows = months.map((month) => {
      const start = new Date(month.getFullYear(), month.getMonth(), 1);
      const end = endOfDay(new Date(month.getFullYear(), month.getMonth() + 1, 0));
      const rowsInMonth = leads.filter((lead) => isInRange(getLeadRangeDate(lead), { start, end }));
      const closed = rowsInMonth.filter((lead) => String(lead.status || "").toUpperCase() === "CLOSED").length;
      return {
        label: month.toLocaleString("en-IN", { month: "short" }),
        leads: rowsInMonth.length,
        closed,
      };
    });
    const max = Math.max(...rows.map((row) => row.leads), 1);
    return rows.map((row) => ({
      ...row,
      leadHeight: Math.max(8, Math.round((row.leads / max) * 100)),
      closedHeight: Math.max(6, Math.round((row.closed / max) * 100)),
    }));
  }, [leads]);

  const sourceMix = useMemo(() => {
    const rows = new Map();
    scopedLeads.forEach((lead) => {
      const source = String(lead.source || "OTHER").trim().toUpperCase();
      const label = source === "META" ? "Meta ads" : source === "MANUAL" ? "Manual entry" : source || "Other";
      rows.set(label, (rows.get(label) || 0) + 1);
    });

    const total = [...rows.values()].reduce((sum, value) => sum + value, 0);
    const colors = ["var(--b500)", "var(--vi500)", "var(--ok500)", "var(--wa500)", "var(--muted)"];
    let cursor = 0;
    const list = [...rows.entries()].map(([label, count], index) => {
      const share = total > 0 ? Math.round((count / total) * 100) : 0;
      const start = cursor;
      cursor += share;
      return { label, count, color: colors[index % colors.length], start, end: cursor };
    });

    return {
      rows: list,
      gradient: list.length
        ? `conic-gradient(${list.map((row) => `${row.color} ${row.start}% ${row.end}%`).join(", ")})`
        : "conic-gradient(var(--line) 0 100%)",
    };
  }, [scopedLeads]);

  const executiveRows = useMemo(() => {
    const rows = new Map();
    scopedLeads.forEach((lead) => {
      const assignee = lead.assignedTo || lead.assignedExecutive || lead.createdBy;
      const key = String(assignee?._id || assignee?.email || "unassigned");
      const name = assignee?.name || "Unassigned";
      const current = rows.get(key) || { key, name, leads: 0, visits: 0, closed: 0 };
      const status = String(lead.status || "").toUpperCase();
      current.leads += 1;
      if (SITE_VISIT_STATUSES.has(status)) current.visits += 1;
      if (status === "CLOSED") current.closed += 1;
      rows.set(key, current);
    });

    return [...rows.values()]
      .map((row) => ({
        ...row,
        conversion: row.leads > 0 ? (row.closed / row.leads) * 100 : 0,
      }))
      .sort((left, right) => right.closed - left.closed || right.visits - left.visits || right.leads - left.leads)
      .slice(0, 5);
  }, [scopedLeads]);

  const lostRows = useMemo(() => {
    const rows = new Map();
    scopedLeads.forEach((lead) => {
      const status = String(lead.status || "").toUpperCase();
      const label = LOST_REASON_LABELS[status];
      if (!label) return;
      rows.set(label, (rows.get(label) || 0) + 1);
    });

    const list = [...rows.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((left, right) => right.count - left.count)
      .slice(0, 5);
    const max = Math.max(...list.map((row) => row.count), 1);
    return list.map((row) => ({ ...row, width: Math.max(8, Math.round((row.count / max) * 100)) }));
  }, [scopedLeads]);

  const handleExportCsv = () => {
    const rows = [
      ["Section", "Metric", "Value"],
      ["Summary", "Leads received", summary.received],
      ["Summary", "Transferred leads", transferredLeadCount],
      ["Summary", "Conversion", formatPercent(summary.conversion, 1)],
      ["Summary", "Avg. days to close", Math.round(summary.avgDaysToClose)],
      ["Summary", "Cost per lead", summary.costPerLead === null ? "" : Math.round(summary.costPerLead)],
      ["Summary", "Revenue", summary.revenue],
      ...executiveRows.map((row) => [
        "Executive performance",
        row.name,
        `${row.leads} leads, ${row.visits} visits, ${row.closed} closed, ${formatPercent(row.conversion, 1)}`,
      ]),
      ...lostRows.map((row) => ["Where leads are lost", row.label, row.count]),
    ];
    downloadCsv(`reports_${rangeKey.toLowerCase()}.csv`, rows);
  };

  if (loading) {
    return (
      <div className="ui-page-shell custom-scrollbar flex items-center justify-center gap-2 text-slate-500">
        <RefreshCw size={18} className="animate-spin" />
        Loading reports...
      </div>
    );
  }

  return (
    <div className="reports-doc-screen ui-page-shell custom-scrollbar">
      <ToastNotice message={error} type="error" />

      <section className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
        <strong>{transferredLeadCount} transferred leads</strong> in this period. Transfer history is retained separately from the current lead stage.
      </section>
      <div className="reports-toolbar">
        <div className="reports-seg">
          {RANGE_OPTIONS.map((range) => (
            <button
              key={range.key}
              type="button"
              className={rangeKey === range.key ? "on" : ""}
              onClick={() => setRangeKey(range.key)}
            >
              {range.label}
            </button>
          ))}
        </div>
        <button type="button" className="reports-chip">+ Branch</button>
        <button type="button" className="reports-chip">+ Executive</button>
        <button type="button" className="reports-chip">+ Source</button>
        <button type="button" className="reports-btn reports-btn-sec reports-btn-sm reports-push" onClick={handleExportCsv}>
          Export CSV
        </button>
        <button type="button" className="reports-btn reports-btn-sec reports-btn-sm">
          Schedule email
        </button>
      </div>

      {rangeKey === "CUSTOM" ? (
        <div className="reports-toolbar reports-custom-range">
          <label>
            From
            <input
              type="date"
              value={customRange.startDate}
              onChange={(event) => setCustomRange((prev) => ({ ...prev, startDate: event.target.value }))}
            />
          </label>
          <label>
            To
            <input
              type="date"
              value={customRange.endDate}
              onChange={(event) => setCustomRange((prev) => ({ ...prev, endDate: event.target.value }))}
            />
          </label>
          <button
            type="button"
            className="reports-btn reports-btn-sec reports-btn-sm"
            disabled={refreshing}
            onClick={() => loadReports(true)}
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      ) : null}

      <div className="reports-statgrid">
        {statRows.map((stat) => (
          <div key={stat.key} className="reports-stat">
            <div className="reports-k">{stat.key}</div>
            <div className="reports-v">{stat.value}</div>
            <div className="reports-d">
              {stat.delta ? <span className={`reports-delta ${stat.delta.tone}`}>{stat.delta.text}</span> : null}
              {stat.detail}
            </div>
          </div>
        ))}
      </div>

      <div className="reports-split">
        <div className="reports-card">
          <div className="reports-card-h"><h4>Leads and closures by month</h4></div>
          <div className="reports-card-b">
            <div className="reports-bars reports-bars-tall">
              {monthlyBars.map((bar) => (
                <div key={bar.label} title={`${bar.leads} leads, ${bar.closed} closed`}>
                  <i style={{ height: `${bar.leadHeight}%` }} />
                  <i className="closed" style={{ height: `${bar.closedHeight}%` }} />
                  <span>{bar.label}</span>
                </div>
              ))}
            </div>
            <div className="reports-legend reports-inline-legend">
              <div><i style={{ background: "var(--b500)" }} />Leads received</div>
              <div><i style={{ background: "var(--ok500)" }} />Closed</div>
            </div>
          </div>
        </div>

        <div className="reports-card">
          <div className="reports-card-h"><h4>Source mix</h4></div>
          <div className="reports-card-b reports-source-mix">
            <div className="reports-donut" style={{ background: sourceMix.gradient }} />
            <div className="reports-legend">
              {sourceMix.rows.length === 0 ? (
                <div><i style={{ background: "var(--line)" }} />No sources<b>0</b></div>
              ) : null}
              {sourceMix.rows.map((row) => (
                <div key={row.label}><i style={{ background: row.color }} />{row.label}<b>{row.count}</b></div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="reports-split-even">
        <div className="reports-card">
          <div className="reports-card-h"><h4>Executive performance</h4></div>
          <div className="reports-table-wrap">
            <table className="reports-tbl">
              <thead>
                <tr>
                  <th>Executive</th>
                  <th>Leads</th>
                  <th>Visits</th>
                  <th>Closed</th>
                  <th>Conv.</th>
                </tr>
              </thead>
              <tbody>
                {executiveRows.length === 0 ? (
                  <tr><td colSpan={5} className="reports-empty-row">No executive data in this period.</td></tr>
                ) : null}
                {executiveRows.map((row) => (
                  <tr key={row.key}>
                    <td>
                      <div className="reports-cellname">
                        <div className="reports-avatar reports-avatar-sm">{getInitials(row.name)}</div>
                        <b>{row.name}</b>
                      </div>
                    </td>
                    <td className="reports-num">{row.leads}</td>
                    <td className="reports-num">{row.visits}</td>
                    <td className="reports-num">{row.closed}</td>
                    <td className={`reports-num reports-conv ${row.conversion >= summary.conversion ? "good" : "risk"}`}>
                      {formatPercent(row.conversion, 1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="reports-card">
          <div className="reports-card-h"><h4>Where leads are lost</h4></div>
          <div className="reports-card-b">
            <div className="reports-rowlist">
              {lostRows.length === 0 ? (
                <div className="reports-empty-row">No lost lead reasons in this period.</div>
              ) : null}
              {lostRows.map((row) => (
                <div key={row.label}>
                  <span className="reports-reason">{row.label}</span>
                  <span className="reports-bar-mini"><i style={{ width: `${row.width}%` }} /></span>
                  <span className="reports-num reports-muted">{row.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IntelligenceReports;
