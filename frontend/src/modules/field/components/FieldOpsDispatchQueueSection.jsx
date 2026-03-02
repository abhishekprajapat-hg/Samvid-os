import React from "react";
import { EmptyState, StatusBadge } from "./FieldOpsShared";

const FieldOpsDispatchQueueSection = ({
  unassignedQueue,
  formatDateTime,
  getLeadLocationLabel,
}) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-4">
    <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-600">
      Dispatch Queue (Unassigned)
    </h2>
    {unassignedQueue.length === 0 ? (
      <EmptyState text="No unassigned active leads in queue." />
    ) : (
      <div className="mt-3 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-slate-500">
              <th className="py-2 pr-3">Lead</th>
              <th className="py-2 pr-3">Project</th>
              <th className="py-2 pr-3">Location</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2">Follow-up</th>
            </tr>
          </thead>
          <tbody>
            {unassignedQueue.slice(0, 12).map((lead) => (
              <tr key={lead._id} className="border-t border-slate-100">
                <td className="py-2 pr-3 text-slate-800">
                  <p className="font-medium">{lead.name || "-"}</p>
                  <p className="text-xs text-slate-500">{lead.phone || "-"}</p>
                </td>
                <td className="py-2 pr-3 text-slate-700">{lead.projectInterested || "-"}</td>
                <td className="py-2 pr-3 text-slate-700">{getLeadLocationLabel(lead)}</td>
                <td className="py-2 pr-3">
                  <StatusBadge status={lead.status} />
                </td>
                <td className="py-2 text-slate-600">{formatDateTime(lead.nextFollowUp)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </section>
);

export default FieldOpsDispatchQueueSection;

