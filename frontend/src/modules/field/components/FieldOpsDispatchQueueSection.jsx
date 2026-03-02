import React from "react";
import { EmptyState, StatusBadge } from "./FieldOpsShared";

const FieldOpsDispatchQueueSection = ({
  unassignedQueue,
  formatDateTime,
  getLeadLocationLabel,
}) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-600">
        Dispatch Queue (Unassigned)
      </h2>
      <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-700">
        {unassignedQueue.length} Waiting
      </span>
    </div>
    {unassignedQueue.length === 0 ? (
      <EmptyState text="No unassigned active leads in queue." />
    ) : (
      <>
        <div className="mt-3 space-y-2 md:hidden">
          {unassignedQueue.slice(0, 12).map((lead) => (
            <div key={lead._id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">{lead.name || "-"}</p>
                  <p className="mt-0.5 truncate text-xs text-slate-500">{lead.phone || "-"}</p>
                </div>
                <StatusBadge status={lead.status} />
              </div>

              <div className="mt-2 space-y-1 text-xs text-slate-600">
                <p className="truncate">
                  <span className="font-semibold text-slate-700">Project:</span> {lead.projectInterested || "-"}
                </p>
                <p className="truncate">
                  <span className="font-semibold text-slate-700">Location:</span> {getLeadLocationLabel(lead)}
                </p>
                <p className="truncate">
                  <span className="font-semibold text-slate-700">Follow-up:</span> {formatDateTime(lead.nextFollowUp)}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 hidden overflow-x-auto rounded-xl border border-slate-200 md:block">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr className="text-left text-[10px] uppercase tracking-[0.16em] text-slate-500">
              <th className="py-2.5 pl-3 pr-3">Lead</th>
              <th className="py-2.5 pr-3">Project</th>
              <th className="py-2.5 pr-3">Location</th>
              <th className="py-2.5 pr-3">Status</th>
              <th className="py-2.5 pr-3">Follow-up</th>
            </tr>
          </thead>
          <tbody>
            {unassignedQueue.slice(0, 12).map((lead) => (
              <tr key={lead._id} className="border-t border-slate-100">
                <td className="py-2.5 pl-3 pr-3 text-slate-800">
                  <p className="font-medium">{lead.name || "-"}</p>
                  <p className="text-xs text-slate-500">{lead.phone || "-"}</p>
                </td>
                <td className="py-2.5 pr-3 text-slate-700">{lead.projectInterested || "-"}</td>
                <td className="py-2.5 pr-3 text-slate-700">{getLeadLocationLabel(lead)}</td>
                <td className="py-2.5 pr-3">
                  <StatusBadge status={lead.status} />
                </td>
                <td className="py-2.5 pr-3 text-slate-600">{formatDateTime(lead.nextFollowUp)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </>
    )}
  </section>
);

export default FieldOpsDispatchQueueSection;
