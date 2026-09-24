import React from "react";
import { MessageCircle, NotebookPen, Phone } from "lucide-react";
import { DataTable, StatusBadge } from "../../../components/crm";
import { EmptyState, IconButton } from "../../../components/ui";
import { formatBudgetRange } from "./pipelineViews";

const initialsOf = (name) => {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "??";
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : parts[0].slice(0, 2)).toUpperCase();
};

const titleCase = (value) =>
  String(value || "")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());

const FOLLOW_UP_TONES = {
  overdue: "font-semibold text-rose-600 dark:text-rose-400",
  today: "font-semibold text-amber-600 dark:text-amber-400",
  future: "text-slate-700 dark:text-slate-300",
  none: "text-slate-400 dark:text-slate-500",
};

/**
 * The pipeline list. Presentation only - every action is a callback, so the
 * container keeps ownership of the service calls.
 *
 * @param {Array}    leads          Rows to render.
 * @param {boolean}  loading        Skeleton rows.
 * @param {number}   nowMs          Clock used to colour follow-up dates.
 * @param {boolean}  showAssigned   Render the Assigned column (ADMIN/MANAGER).
 * @param {Array}    selectedKeys   Selected lead ids.
 * @param {Function} onSelectionChange (keys) => void.
 * @param {Function} onOpenLead     (lead) => void.
 * @param {Function} onCall         (lead) => void.
 * @param {Function} onWhatsApp     (lead) => void.
 * @param {Function} onLog          (lead) => void.
 * @param {node}     emptyState     Rendered when there are no rows.
 */
const PipelineTable = ({
  leads = [],
  loading = false,
  selectedKeys = [],
  onSelectionChange,
  onOpenLead,
  onCall,
  onWhatsApp,
  onLog,
  statusOptions = [],
  onStatusChange,
  updatingStatusId = "",
  emptyState,
  className,
}) => {
  const columns = [
    {
      key: "name",
      header: "LEAD",
      render: (lead) => (
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[11px] font-bold text-blue-700 dark:bg-blue-500/20 dark:text-blue-200">
            {initialsOf(lead?.name)}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-bold text-slate-900 dark:text-slate-100">
              {lead?.name || "Unnamed lead"}
            </span>
            <span className="block truncate font-mono text-[11.5px] text-slate-500 dark:text-slate-400">
              {lead?.phone || "—"}
            </span>
          </span>
        </div>
      ),
    },
    {
      key: "status",
      header: "STATUS",
      render: (lead) => (
        <span className="relative inline-flex" onClick={(event) => event.stopPropagation()}>
          <StatusBadge status={lead?.status} className="pointer-events-none" />
          {onStatusChange ? (
            <select
              aria-label={`Change status for ${lead?.name || "lead"}`}
              value={lead?.status || "NEW"}
              disabled={updatingStatusId === String(lead?._id || "")}
              onChange={(event) => onStatusChange(lead, event.target.value)}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-wait"
            >
              {statusOptions.map((status) => <option key={status} value={status}>{status.replace(/_/g, " ")}</option>)}
            </select>
          ) : null}
        </span>
      ),
    },
    {
      key: "requirement",
      header: "REQUIREMENT",
      render: (lead) => {
        const requirements = lead?.requirements || {};
        const lead1 = [
          requirements.inventoryType ? titleCase(requirements.inventoryType) : null,
          requirements.transactionType ? titleCase(requirements.transactionType) : null,
        ]
          .filter(Boolean)
          .join(" · ");

        const lead2 = [
          requirements.propertySubtype ? titleCase(requirements.propertySubtype) : null,
          requirements.areaMin || requirements.areaMax
            ? `${requirements.areaMax || requirements.areaMin} Sq Ft`
            : null,
        ]
          .filter(Boolean)
          .join(" · ");

        if (!lead1 && !lead2) {
          return <span className="text-slate-400 dark:text-slate-500">Commercial · Rent</span>;
        }

        return (
          <span className="block min-w-0 text-[12.5px]">
            <span className="block truncate font-medium text-slate-800 dark:text-slate-200">
              {lead1 || titleCase(requirements.propertySubtype) || "Commercial · Rent"}
            </span>
            {lead2 ? (
              <span className="block truncate text-[11.5px] text-slate-500 dark:text-slate-400">
                {lead2}
              </span>
            ) : null}
          </span>
        );
      },
    },
    {
      key: "budget",
      header: "BUDGET",
      render: (lead) => (
        <span className="text-[12.5px] font-semibold text-slate-900 dark:text-slate-100">
          {formatBudgetRange(lead?.requirements)}
        </span>
      ),
    },
    {
      key: "source",
      header: "SOURCE",
      render: (lead) => {
        const src = lead?.source ? titleCase(lead.source) : "Manual";
        return (
          <span className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {src}
          </span>
        );
      },
    },
    {
      key: "assigned",
      header: "ASSIGNED",
      render: (lead) =>
        lead?.assignedTo?.name ? (
          <span className="text-[12.5px] font-medium text-slate-700 dark:text-slate-300">
            {lead.assignedTo.name}
          </span>
        ) : (
          <span className="text-[12px] font-semibold text-amber-600 dark:text-amber-400">
            Unassigned
          </span>
        ),
    },
  ];

  return (
    <DataTable
      className={className}
      columns={columns}
      rows={leads}
      rowKey={(lead) => lead?._id}
      loading={loading}
      selectable
      selectedKeys={selectedKeys}
      onSelectionChange={onSelectionChange}
      onRowClick={onOpenLead}
      emptyState={
        emptyState || (
          <EmptyState
            title="Nothing needs action"
            description="Every live lead here has a follow-up in the future. Switch to All to see the rest."
          />
        )
      }
      rowActions={(lead) => (
        <>
          <IconButton
            icon={Phone}
            label={`Call ${lead?.name || "lead"}`}
            size="sm"
            onClick={() => onCall?.(lead)}
          />
          <IconButton
            icon={MessageCircle}
            label={`WhatsApp ${lead?.name || "lead"}`}
            size="sm"
            onClick={() => onWhatsApp?.(lead)}
          />
          <IconButton
            icon={NotebookPen}
            label={`Log an outcome for ${lead?.name || "lead"}`}
            size="sm"
            onClick={() => onLog?.(lead)}
          />
        </>
      )}
    />
  );
};

export default PipelineTable;
