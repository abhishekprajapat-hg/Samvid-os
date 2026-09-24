import React from "react";
import { AlertTriangle, CalendarClock, DoorOpen, IndianRupee } from "lucide-react";
import { cn } from "../../../../components/ui";
import { formatCurrency } from "../../../../utils/format";
import { STATUS_META, STATUS_ORDER } from "../cabinData";

/*
 * The standing summary, as three cards rather than one long one. They answer
 * different questions - how full, what mix, what is about to change - and a
 * reader scanning for one of them should not have to scroll past the others.
 *
 * The status list doubles as the filter: reading it and acting on it are the
 * same gesture, so there is no separate panel of checkboxes anywhere.
 */

const Card = ({ children, className }) => (
  <div
    className={cn(
      "rounded-xl border border-slate-200 bg-white p-4 shadow-crm-soft dark:border-slate-700 dark:bg-slate-900",
      className,
    )}
  >
    {children}
  </div>
);

const StatBox = ({ icon: Icon, value, label, hint }) => (
  <div className="rounded-lg border border-slate-200 p-2.5 dark:border-slate-700">
    <span className="mb-1.5 flex h-6 w-6 items-center justify-center rounded-md bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
      {Icon ? <Icon aria-hidden="true" size={13} /> : null}
    </span>
    <p className="text-[15px] font-semibold tabular-nums text-slate-950 dark:text-slate-50">{value}</p>
    <p className="text-[11px] text-slate-500 dark:text-slate-400">{label}</p>
    {hint ? <p className="mt-0.5 text-[10.5px] leading-tight text-slate-400 dark:text-slate-500">{hint}</p> : null}
  </div>
);

/*
 * On a phone these three cards do not belong in one run. The occupancy figure
 * is the headline and goes above the cabins; the status filter and the renewal
 * list are follow-up reading and go below. `sections` lets the page place them
 * separately without this component knowing anything about breakpoints.
 */
const SpaceSummaryPanel = ({
  cabins,
  counts,
  statusFilter,
  onStatusFilter,
  sections = ["occupancy", "status", "freeing"],
}) => {
  const shows = (name) => sections.includes(name);
  /*
   * Occupancy is cabins let over cabins, not seats filled over seats. Cabins go
   * whole here, so a seat-based rate would just be a weighted restatement of the
   * same thing - and it would read as though half-empty rooms existed.
   */
  const letCabins = cabins.filter((cabin) => cabin.status === "BOOKED" || cabin.status === "RESERVED").length;
  const percent = cabins.length ? Math.round((letCabins / cabins.length) * 100) : 0;
  const vacantCapacity = cabins
    .filter((cabin) => cabin.status === "VACANT")
    .reduce((total, cabin) => total + cabin.seats, 0);

  const monthlyRevenue = cabins
    .filter((cabin) => cabin.status === "BOOKED")
    .reduce((total, cabin) => total + cabin.monthlyRent, 0);

  const freeingSoon = cabins
    .filter((cabin) => cabin.status === "BOOKED" && cabin.contract?.endsInDays <= 45)
    .sort((a, b) => a.contract.endsInDays - b.contract.endsInDays);

  const overdue = cabins.filter((cabin) => cabin.contract?.duesAmount > 0);

  return (
    <>
      {shows("occupancy") ? (
      <Card>
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-[13px] font-semibold text-slate-900 dark:text-slate-100">Occupancy</h2>
          <span className="text-[24px] font-semibold leading-none tracking-tight text-slate-950 dark:text-slate-50">
            {percent}%
          </span>
        </div>
        <p className="mt-1 text-[12px] tabular-nums text-slate-500 dark:text-slate-400">
          {letCabins} of {cabins.length} cabins let
        </p>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
          <div className="h-full rounded-full bg-blue-600" style={{ width: `${percent}%` }} />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <StatBox icon={IndianRupee} value={formatCurrency(monthlyRevenue)} label="per month" />
          <StatBox
            icon={DoorOpen}
            value={counts.VACANT}
            label="vacant cabins"
            hint={`seating ${vacantCapacity} between them`}
          />
        </div>
      </Card>
      ) : null}

      {shows("status") ? (
      <Card>
        <h3 className="mb-1 text-[13px] font-semibold text-slate-900 dark:text-slate-100">Cabins by status</h3>
        <ul>
          {STATUS_ORDER.map((status) => {
            const meta = STATUS_META[status];
            const active = statusFilter === status;
            return (
              <li key={status}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => onStatusFilter(active ? "all" : status)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left outline-none transition",
                    "focus-visible:ring-2 focus-visible:ring-blue-500/40",
                    active ? "bg-slate-100 dark:bg-slate-800" : "hover:bg-slate-50 dark:hover:bg-slate-800/50",
                  )}
                >
                  <i className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: meta.dot }} />
                  <span className="text-[12.5px] text-slate-700 dark:text-slate-300">{meta.label}</span>
                  <span className="ml-auto text-[12.5px] font-semibold tabular-nums text-slate-950 dark:text-slate-100">
                    {counts[status] || 0}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </Card>
      ) : null}

      {shows("freeing") && (freeingSoon.length || overdue.length) ? (
        <Card>
          <h3 className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-slate-900 dark:text-slate-100">
            <CalendarClock aria-hidden="true" size={14} className="text-slate-400" />
            Freeing up in 45 days
          </h3>

          {freeingSoon.length ? (
            <ul className="space-y-0.5">
              {freeingSoon.slice(0, 6).map((cabin) => (
                <li key={cabin.code} className="flex items-center gap-2 px-1 py-1">
                  <span className="shrink-0 text-[11.5px] font-semibold text-slate-900 dark:text-slate-100">
                    {cabin.label}
                  </span>
                  <span className="truncate text-[11.5px] text-slate-500 dark:text-slate-400">{cabin.client.name}</span>
                  <span className="ml-auto shrink-0 text-[11.5px] tabular-nums text-amber-700 dark:text-amber-400">
                    {cabin.contract.endsInDays}d
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-1 text-[11.5px] text-slate-500 dark:text-slate-400">
              Nothing ends in the next 45 days.
            </p>
          )}

          {freeingSoon.length > 6 ? (
            <p className="mt-1 px-1 text-[11px] text-slate-400 dark:text-slate-500">
              +{freeingSoon.length - 6} more ending within 45 days
            </p>
          ) : null}

          {overdue.length ? (
            <p className="mt-3 flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-2 text-[11.5px] font-medium text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
              <AlertTriangle aria-hidden="true" size={13} className="shrink-0" />
              {formatCurrency(overdue.reduce((total, cabin) => total + cabin.contract.duesAmount, 0))} overdue across{" "}
              {overdue.length} {overdue.length === 1 ? "cabin" : "cabins"}.
            </p>
          ) : null}
        </Card>
      ) : null}
    </>
  );
};

export default SpaceSummaryPanel;
