import React from "react";
import { UserRound } from "lucide-react";
import { EmptyState } from "./FieldOpsShared";

const FieldOpsWorkloadSection = ({
  executiveStats,
  selectedExecutiveId,
  onExecutiveSelect,
  formatDateTime,
}) => {
  const maxActiveLeads = executiveStats.reduce(
    (max, row) => Math.max(max, Number(row.activeAssigned || 0)),
    1,
  );

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-600">
          Field Executive Workload
        </h2>
        <span className="rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-700">
          {executiveStats.length} Executives
        </span>
      </div>

      {executiveStats.length === 0 ? (
        <EmptyState text="No executive workload data available." />
      ) : (
        <>
          <div className="mt-3 space-y-2 md:hidden">
            {executiveStats.map((row) => {
              const loadPercent = Math.round((Number(row.activeAssigned || 0) / maxActiveLeads) * 100);
              const active = String(row.executive._id) === String(selectedExecutiveId);

              return (
                <button
                  key={row.executive._id}
                  type="button"
                  onClick={() => onExecutiveSelect(row)}
                  className={`w-full rounded-xl border px-3 py-2.5 text-left ${
                    active
                      ? "border-cyan-300 bg-cyan-50"
                      : "border-slate-200 bg-slate-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-slate-800">
                      {row.executive.name || "-"}
                    </p>
                    <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                      {row.activeAssigned} active
                    </span>
                  </div>

                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-600"
                      style={{ width: `${Math.min(loadPercent, 100)}%` }}
                    />
                  </div>

                  <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] text-slate-600">
                    <p><span className="font-semibold text-slate-700">Visits:</span> {row.siteVisits}</p>
                    <p><span className="font-semibold text-slate-700">Today:</span> {row.todaysVisits}</p>
                    <p><span className="font-semibold text-slate-700">Overdue:</span> {row.overdue}</p>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Last assigned: {formatDateTime(row.executive.lastAssignedAt)}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="mt-3 hidden overflow-x-auto rounded-xl border border-slate-200 md:block">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left text-[10px] uppercase tracking-[0.16em] text-slate-500">
                <th className="py-2.5 pl-3 pr-3">Executive</th>
                <th className="py-2.5 pr-3">Load</th>
                <th className="py-2.5 pr-3">Site Visits</th>
                <th className="py-2.5 pr-3">Today</th>
                <th className="py-2.5 pr-3">Overdue</th>
                <th className="py-2.5 pr-3">Last Assigned</th>
              </tr>
            </thead>
            <tbody>
              {executiveStats.map((row) => {
                const loadPercent = Math.round((Number(row.activeAssigned || 0) / maxActiveLeads) * 100);

                return (
                  <tr
                    key={row.executive._id}
                    className={`border-t border-slate-100 ${
                      String(row.executive._id) === String(selectedExecutiveId) ? "bg-slate-50" : ""
                    }`}
                  >
                    <td className="py-2.5 pl-3 pr-3 text-slate-800">
                      <button
                        type="button"
                        onClick={() => onExecutiveSelect(row)}
                        className="inline-flex items-center gap-2 text-left hover:text-slate-900"
                      >
                        <UserRound size={14} />
                        <span className="font-medium">{row.executive.name || "-"}</span>
                      </button>
                    </td>
                    <td className="py-2.5 pr-3 text-slate-700">
                      <div className="min-w-[110px]">
                        <p className="text-xs font-semibold">{row.activeAssigned}</p>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-600"
                            style={{ width: `${Math.min(loadPercent, 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 pr-3 text-slate-700">{row.siteVisits}</td>
                    <td className="py-2.5 pr-3 text-slate-700">{row.todaysVisits}</td>
                    <td className="py-2.5 pr-3 text-slate-700">{row.overdue}</td>
                    <td className="py-2.5 pr-3 text-slate-600">{formatDateTime(row.executive.lastAssignedAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </>
      )}
    </section>
  );
};

export default FieldOpsWorkloadSection;
