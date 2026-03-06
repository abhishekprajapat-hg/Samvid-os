import React from "react";
import {
  Download,
  RefreshCw,
  ShieldCheck,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";

export const ReportsHeader = ({
  rangeOptions,
  rangeKey,
  onRangeChange,
  customRange,
  onCustomRangeChange,
  refreshing,
  onRefresh,
  onExport,
}) => (
  <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
    <div>
      <h1 className="text-3xl font-semibold text-slate-900">Reports Dashboard</h1>
      <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">
        Funnel, quality, team and inventory reporting
      </p>
      <p className="mt-2 text-xs text-slate-500">
        Use filters to scope report windows and export current insights.
      </p>
    </div>

    <div className="flex flex-col items-start gap-2 sm:items-end">
      <div className="inline-flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        <div className="inline-flex flex-wrap items-center gap-1 rounded-xl bg-slate-100 p-1">
          {rangeOptions.map((range) => (
            <button
              key={range.key}
              type="button"
              onClick={() => onRangeChange(range.key)}
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
          onClick={onRefresh}
          disabled={refreshing}
          className="h-9 rounded-xl border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:border-slate-400 disabled:opacity-60 inline-flex items-center gap-2"
        >
          <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          Refresh
        </button>

        <button
          type="button"
          onClick={onExport}
          className="h-9 rounded-xl border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:border-slate-400 inline-flex items-center gap-2"
        >
          <Download size={14} />
          Export CSV
        </button>
      </div>

      {rangeKey === "CUSTOM" ? (
        <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
          <label className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-600">
            From
            <input
              type="date"
              value={customRange.startDate}
              onChange={(event) =>
                onCustomRangeChange((prev) => {
                  const nextStart = event.target.value;
                  return {
                    startDate: nextStart,
                    endDate:
                      prev.endDate && nextStart && prev.endDate < nextStart
                        ? nextStart
                        : prev.endDate,
                  };
                })
              }
              className="h-9 bg-transparent text-slate-700 outline-none"
            />
          </label>
          <label className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-600">
            To
            <input
              type="date"
              value={customRange.endDate}
              onChange={(event) =>
                onCustomRangeChange((prev) => {
                  const nextEnd = event.target.value;
                  return {
                    startDate:
                      prev.startDate && nextEnd && prev.startDate > nextEnd
                        ? nextEnd
                        : prev.startDate,
                    endDate: nextEnd,
                  };
                })
              }
              className="h-9 bg-transparent text-slate-700 outline-none"
            />
          </label>
        </div>
      ) : null}
    </div>
  </div>
);

export const ReportSummaryCards = ({ topMetrics, formatPercent }) => (
  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
    <StatCard
      title="Total Leads"
      value={topMetrics.totalLeads}
      helper="Lead generation volume"
      icon={Users}
    />
    <StatCard
      title="Qualified Leads"
      value={topMetrics.qualified}
      helper="Interested + site visit + closed"
      icon={Target}
    />
    <StatCard
      title="Lead Conversion"
      value={formatPercent(topMetrics.conversion)}
      helper={`${topMetrics.closed} closed leads`}
      icon={TrendingUp}
    />
    <StatCard
      title="Avg Days To Close"
      value={topMetrics.avgDaysToClose.toFixed(1)}
      helper="Cycle time for closed leads"
      icon={ShieldCheck}
    />
    <StatCard
      title="Inventory Utilization"
      value={formatPercent(topMetrics.inventoryUtilization)}
      helper="Reserved + sold / total inventory"
      icon={ShieldCheck}
    />
  </div>
);

export const LeadFunnelSection = ({ leadStageRows, formatPercent }) => (
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
            <div
              className="h-full rounded-full bg-slate-900"
              style={{ width: `${Math.min(row.share, 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  </section>
);

export const LeadAgingSection = ({ agingBuckets }) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-4">
    <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-600">
      Lead Aging (Active Pipeline)
    </h2>
    <div className="mt-3 space-y-3">
      {agingBuckets.map((row) => (
        <div key={row.label} className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-slate-700">{row.label}</span>
            <span className="text-slate-500">{row.count}</span>
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
);

export const SourceEffectivenessSection = ({ sourcePerformance, formatPercent }) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-4">
    <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-600">
      Source Effectiveness
    </h2>
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
);

export const ProjectDemandSection = ({ projectDemand }) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-4">
    <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-600">
      Project Demand
    </h2>
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
);

export const ExecutivePerformanceSection = ({ executivePerformance, formatPercent }) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-4">
    <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-600">
      Executive Performance
    </h2>
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
);

export const FollowUpRiskSection = ({ followUpRisk, formatDateTime }) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-4">
    <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-600">
      Follow-up Risk Monitor
    </h2>
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
);

export const InventoryInsightsSection = ({ inventoryInsights, formatCurrency }) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-4">
    <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-600">
      Inventory Insights
    </h2>
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
);

const StatCard = ({ title, value, helper, icon: Icon }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4">
    <div className="flex items-center justify-between gap-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{title}</p>
      <div className="rounded-lg bg-slate-100 p-2 text-slate-700">
        {React.createElement(Icon, { size: 14 })}
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
