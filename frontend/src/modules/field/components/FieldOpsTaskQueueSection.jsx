import React from "react";
import { EmptyState, MiniStat, StatusBadge } from "./FieldOpsShared";

const FieldOpsTaskQueueSection = ({
  selectedExecutive,
  formatDateTime,
  getLeadLocationLabel,
  getLiveCoordinates,
}) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-600">
        Executive Task Queue
      </h2>
      {selectedExecutive ? (
        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-700">
          {selectedExecutive.assignedRows.length} Active
        </span>
      ) : null}
    </div>

    {!selectedExecutive ? (
      <EmptyState text="Select an executive from coverage grid to inspect assignments." />
    ) : (
      <>
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                {selectedExecutive.executive.name || "Unnamed executive"}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                {selectedExecutive.executive.email || selectedExecutive.executive.phone || "-"}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                {getLiveCoordinates(selectedExecutive.executive)
                  ? `Live location ${selectedExecutive.executive.isLocationFresh === false ? "stale" : "active"} | Updated ${formatDateTime(selectedExecutive.executive.liveLocation?.updatedAt)}`
                  : "Live location unavailable"}
              </p>
            </div>
            <span className="inline-flex w-fit rounded-full border border-slate-300 bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-700">
              FIELD_EXECUTIVE
            </span>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <MiniStat label="Active" value={selectedExecutive.activeAssigned} />
            <MiniStat label="Visits" value={selectedExecutive.siteVisits} />
            <MiniStat label="Overdue" value={selectedExecutive.overdue} />
          </div>
        </div>

        <div className="mt-3 space-y-2">
          {selectedExecutive.assignedRows.length === 0 ? (
            <EmptyState text="No active leads assigned to this executive." />
          ) : (
            selectedExecutive.assignedRows.slice(0, 8).map((lead) => (
              <div key={lead._id} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{lead.name || "-"}</p>
                    <p className="text-xs text-slate-500">
                      {lead.projectInterested || "Project not set"}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Location: {getLeadLocationLabel(lead)}
                    </p>
                  </div>
                  <StatusBadge status={lead.status} />
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Next follow-up: {formatDateTime(lead.nextFollowUp)}
                </p>
              </div>
            ))
          )}
        </div>
      </>
    )}
  </section>
);

export default FieldOpsTaskQueueSection;
