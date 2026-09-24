import React from "react";
import { ArrowRight, CalendarDays, Mail, MessageCircle, MoreVertical, NotebookPen, Phone } from "lucide-react";
import { StatusBadge } from "../../../components/crm";
import { EmptyState, IconButton, Skeleton, cn } from "../../../components/ui";
import { describeFollowUp } from "./pipelineViews";

/*
 * The pipeline as cards, for phones.
 *
 * A seven-column table on a 390px screen is either a sideways scroll or a
 * column of unreadable stubs. The card keeps the four things a salesperson
 * acts on - who, what they want, whose lead it is, and how late the follow-up
 * is - and puts call / WhatsApp / log within thumb reach at the bottom.
 *
 * Presentation only: every action is a callback, so the container keeps
 * ownership of the service calls, exactly as PipelineTable does. The two are
 * deliberately fed the same props by the page.
 */

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

const requirementOf = (lead) => {
  const requirements = lead?.requirements || {};
  const line = [requirements.inventoryType, requirements.transactionType, requirements.propertySubtype]
    .filter(Boolean)
    .map(titleCase)
    .join(" · ");
  return line || "Not captured yet";
};

/** Label above value, the three facts that decide whether this lead is next. */
const Fact = ({ label, children, className }) => (
  <div className={cn("min-w-0", className)}>
    <p className="truncate text-[14px] text-slate-500 dark:text-slate-400 sm:text-[11.5px]">{label}</p>
    <p className="mt-1 truncate text-[17px] text-slate-800 dark:text-slate-200 sm:mt-0.5 sm:text-[12.5px]">{children}</p>
  </div>
);

const LeadCard = ({ lead, nowMs, showAssigned, selected, onToggleSelect, onOpen, onCall, onEmail, onCalendar, onWhatsApp, onLog, statusOptions, onStatusChange, updatingStatusId }) => {
  const followUp = describeFollowUp(lead?.nextFollowUp, nowMs);

  return (
    <li className="rounded-2xl border border-slate-200 bg-white shadow-crm-soft dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-start gap-3 p-4 sm:gap-2.5 sm:p-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelect?.(lead)}
          aria-label={`Select ${lead?.name || "lead"}`}
          className="mt-2 h-5 w-5 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 sm:mt-1 sm:h-4 sm:w-4"
        />

        {/*
          The whole identity block opens the lead. The checkbox stays outside it
          so selecting for a bulk action never navigates away by accident.
        */}
        <button
          type="button"
          onClick={() => onOpen?.(lead)}
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-[16px] font-bold text-blue-700 dark:bg-blue-500/20 dark:text-blue-200 sm:h-9 sm:w-9 sm:text-[11px]">
            {initialsOf(lead?.name)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[16px] font-semibold text-slate-900 dark:text-slate-100 sm:text-[14px]">
              {lead?.name || "Unnamed lead"}
            </span>
            <span className="block truncate font-mono text-[15px] text-slate-500 dark:text-slate-400 sm:text-[12.5px]">
              {lead?.phone || "—"}
            </span>
          </span>
        </button>

        <span className="relative inline-flex max-w-[86px] shrink-0" onClick={(event) => event.stopPropagation()}>
          <StatusBadge status={lead?.status} className="pointer-events-none max-w-[86px] overflow-hidden px-1.5 py-1 text-[10px] sm:max-w-none sm:px-2.5 sm:py-1 sm:text-[11.5px]" />
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
        <button type="button" onClick={() => onOpen?.(lead)} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label={`More actions for ${lead?.name || "lead"}`}>
          <MoreVertical size={18} />
        </button>
      </div>

      <div
        className={cn(
          "grid gap-x-3 border-t border-slate-100 px-4 py-3 dark:border-slate-800 sm:px-3 sm:py-2.5",
          showAssigned ? "grid-cols-3" : "grid-cols-2",
        )}
      >
        <Fact label="Requirement">{requirementOf(lead)}</Fact>
        {showAssigned ? (
          <Fact label="Assigned" className="border-l border-slate-100 pl-3 dark:border-slate-800">
            {lead?.assignedTo?.name || (
              <span className="font-semibold text-amber-600 dark:text-amber-400">Unassigned</span>
            )}
          </Fact>
        ) : null}
        <Fact label="Next follow-up" className="border-l border-slate-100 pl-3 dark:border-slate-800">
          <span className={FOLLOW_UP_TONES[followUp.tone]}>{followUp.text}</span>
        </Fact>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-4 py-3 dark:border-slate-800 sm:px-3 sm:py-2">
        <div className="flex items-center gap-2">
          <IconButton icon={Phone} label={`Call ${lead?.name || "lead"}`} size="sm" onClick={() => onCall?.(lead)} />
          <IconButton icon={Mail} label={`Email ${lead?.name || "lead"}`} size="sm" onClick={() => onEmail?.(lead)} />
          <IconButton icon={CalendarDays} label={`Schedule follow-up for ${lead?.name || "lead"}`} size="sm" onClick={() => onCalendar?.(lead)} />
          <IconButton icon={NotebookPen} label={`Log an outcome for ${lead?.name || "lead"}`} size="sm" onClick={() => onLog?.(lead)} />
          <IconButton icon={MessageCircle} label={`WhatsApp ${lead?.name || "lead"}`} size="sm" onClick={() => onWhatsApp?.(lead)} className="hidden sm:inline-flex" />
        </div>
        <button type="button" onClick={() => onOpen?.(lead)} className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-[14px] font-semibold text-blue-700 shadow-sm dark:border-slate-700 dark:text-blue-300 sm:hidden">
          View details <ArrowRight size={17} />
        </button>
      </div>
    </li>
  );
};

const PipelineCards = ({
  leads = [],
  loading = false,
  nowMs = 0,
  showAssigned = false,
  selectedKeys = [],
  onSelectionChange,
  onOpenLead,
  onCall,
  onEmail,
  onCalendar,
  onWhatsApp,
  onLog,
  statusOptions = [],
  onStatusChange,
  updatingStatusId = "",
  emptyState,
  className,
}) => {
  if (loading) {
    return (
      <ul className={cn("space-y-2 p-3", className)}>
        {[0, 1, 2, 3].map((row) => (
          <li key={row} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="mt-2 h-8 w-full" />
          </li>
        ))}
      </ul>
    );
  }

  if (!leads.length) {
    return (
      <div className={cn("p-3", className)}>
        {emptyState || (
          <EmptyState
            title="Nothing needs action"
            description="Every live lead here has a follow-up in the future. Switch to All to see the rest."
          />
        )}
      </div>
    );
  }

  const toggle = (lead) => {
    const key = lead?._id;
    if (!key) return;
    onSelectionChange?.(
      selectedKeys.includes(key) ? selectedKeys.filter((item) => item !== key) : [...selectedKeys, key],
    );
  };

  return (
    <ul className={cn("space-y-2 p-3", className)}>
      {leads.map((lead) => (
        <LeadCard
          key={lead?._id}
          lead={lead}
          nowMs={nowMs}
          showAssigned={showAssigned}
          selected={selectedKeys.includes(lead?._id)}
          onToggleSelect={toggle}
          onOpen={onOpenLead}
          onCall={onCall}
          onEmail={onEmail}
          onCalendar={onCalendar}
          onWhatsApp={onWhatsApp}
          onLog={onLog}
          statusOptions={statusOptions}
          onStatusChange={onStatusChange}
          updatingStatusId={updatingStatusId}
        />
      ))}
    </ul>
  );
};

export default PipelineCards;
