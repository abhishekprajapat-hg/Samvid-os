import React from "react";
import StatusBadge from "./StatusBadge";
import { LEAD_STEPS } from "./leadStatusSteps";
import { cn } from "../ui";

/**
 * Where a lead sits in the pipeline, as equal-width bars.
 *
 * @param {Array}  steps      Defaults to LEAD_STEPS. [{ key, label }]
 * @param {string} currentKey Step key to mark as current. Everything before it is done.
 * @param {string} sideState  When set, the stepper is replaced by a single badge -
 *                            LOST, INVALID, OWNER and BROKER are not forward motion.
 * @param {string} className  Merged onto the wrapper.
 *
 * Use `statusToStep(status)` from ./leadStatusSteps to derive currentKey and
 * sideState from a raw API status.
 */
const StatusStepper = ({ steps = LEAD_STEPS, currentKey, sideState, className }) => {
  if (sideState) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <StatusBadge status={sideState} />
        <span className="text-[11.5px] text-slate-500 dark:text-slate-400">Not in the pipeline</span>
      </div>
    );
  }

  const currentIndex = steps.findIndex((step) => step.key === currentKey);

  return (
    <div className={cn("flex items-end gap-1.5", className)}>
      {steps.map((step, index) => {
        const done = currentIndex > -1 && index < currentIndex;
        const current = index === currentIndex;

        return (
          <div key={step.key} className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span
              className={cn(
                "truncate text-[10.5px] font-semibold uppercase tracking-[0.06em]",
                current
                  ? "text-blue-700 dark:text-blue-300"
                  : done
                    ? "text-slate-600 dark:text-slate-300"
                    : "text-slate-400 dark:text-slate-500",
              )}
            >
              {step.label}
            </span>
            <span
              aria-hidden="true"
              className={cn(
                "h-[3px] rounded-full",
                done && "bg-emerald-500",
                current && "bg-blue-600 dark:bg-blue-400",
                !done && !current && "bg-slate-200 dark:bg-slate-700",
              )}
            />
          </div>
        );
      })}
    </div>
  );
};

export default StatusStepper;
