import React from "react";
import { UserRound } from "lucide-react";
import { EmptyState } from "./FieldOpsShared";

const FieldOpsWorkloadSection = ({
  executiveStats,
  selectedExecutiveId,
  onExecutiveSelect,
  formatDateTime,
}) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-4">
    <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-600">
      Field Executive Workload
    </h2>
    {executiveStats.length === 0 ? (
      <EmptyState text="No executive workload data available." />
    ) : (
      <div className="mt-3 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-slate-500">
              <th className="py-2 pr-3">Executive</th>
              <th className="py-2 pr-3">Active Leads</th>
              <th className="py-2 pr-3">Site Visits</th>
              <th className="py-2 pr-3">Today Visits</th>
              <th className="py-2 pr-3">Overdue</th>
              <th className="py-2">Last Assigned</th>
            </tr>
          </thead>
          <tbody>
            {executiveStats.map((row) => (
              <tr
                key={row.executive._id}
                className={`border-t border-slate-100 ${
                  String(row.executive._id) === String(selectedExecutiveId) ? "bg-slate-50" : ""
                }`}
              >
                <td className="py-2 pr-3 text-slate-800">
                  <button
                    type="button"
                    onClick={() => onExecutiveSelect(row)}
                    className="inline-flex items-center gap-2 text-left hover:text-slate-900"
                  >
                    <UserRound size={14} />
                    <span className="font-medium">{row.executive.name || "-"}</span>
                  </button>
                </td>
                <td className="py-2 pr-3 text-slate-700">{row.activeAssigned}</td>
                <td className="py-2 pr-3 text-slate-700">{row.siteVisits}</td>
                <td className="py-2 pr-3 text-slate-700">{row.todaysVisits}</td>
                <td className="py-2 pr-3 text-slate-700">{row.overdue}</td>
                <td className="py-2 text-slate-600">{formatDateTime(row.executive.lastAssignedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </section>
);

export default FieldOpsWorkloadSection;

