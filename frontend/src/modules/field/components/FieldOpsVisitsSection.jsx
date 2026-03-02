import React from "react";
import { EmptyState } from "./FieldOpsShared";

const FieldOpsVisitsSection = ({
  visitsTimeline,
  formatDateTime,
  getLeadLocationLabel,
}) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-600">
        Upcoming Site Visits
      </h2>
      <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-indigo-700">
        {visitsTimeline.length} Queued
      </span>
    </div>
    {visitsTimeline.length === 0 ? (
      <EmptyState text="No site-visit leads in current active pipeline." />
    ) : (
      <div className="mt-3 space-y-2">
        {visitsTimeline.map((lead) => (
          <div key={lead._id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-medium text-slate-800">{lead.name || "-"}</p>
                <p className="text-xs text-slate-500">
                  {lead.assignedTo?.name || "Unassigned"} | {lead.projectInterested || "Project not set"}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Location: {getLeadLocationLabel(lead)}
                </p>
              </div>
              <span className="inline-flex w-fit rounded-full border border-slate-300 bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">
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
