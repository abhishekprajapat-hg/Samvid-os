import React from "react";
import { EmptyState } from "./FieldOpsShared";

const FieldOpsVisitsSection = ({
  visitsTimeline,
  formatDateTime,
  getLeadLocationLabel,
}) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-4">
    <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-600">
      Upcoming Site Visits
    </h2>
    {visitsTimeline.length === 0 ? (
      <EmptyState text="No site-visit leads in current active pipeline." />
    ) : (
      <div className="mt-3 space-y-2">
        {visitsTimeline.map((lead) => (
          <div key={lead._id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-slate-800">{lead.name || "-"}</p>
                <p className="text-xs text-slate-500">
                  {lead.assignedTo?.name || "Unassigned"} | {lead.projectInterested || "Project not set"}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Location: {getLeadLocationLabel(lead)}
                </p>
              </div>
              <span className="text-xs font-semibold text-slate-600">
                {formatDateTime(lead.nextFollowUp || lead.createdAt)}
              </span>
            </div>
          </div>
        ))}
      </div>
    )}
  </section>
);

export default FieldOpsVisitsSection;

