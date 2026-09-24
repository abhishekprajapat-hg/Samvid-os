import React from "react";
import { cn } from "../../../../components/ui";

/*
 * Segmented control: a small set of mutually exclusive views or filters, with
 * an optional count on each.
 *
 * This is the same control InventoryToolbar defines privately. Both should
 * collapse into components/crm once the booking board is more than a design -
 * doing it now would mean editing a screen this change has no business touching.
 */

const Segmented = ({ options, value, onChange, className, size = "md" }) => (
  <div
    className={cn(
      "flex flex-wrap gap-0.5 rounded-lg border border-slate-200 bg-slate-50 p-0.5",
      "dark:border-slate-700 dark:bg-slate-950",
      className,
    )}
  >
    {options.map((option) => {
      const active = option.value === value;
      const Icon = option.icon;
      return (
        <button
          key={option.value}
          type="button"
          aria-pressed={active}
          onClick={() => onChange?.(option.value)}
          className={cn(
            "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md outline-none transition",
            "focus-visible:ring-2 focus-visible:ring-blue-500/40",
            size === "sm" ? "px-2 py-1 text-[11.5px]" : "px-2.5 py-[5px] text-[12.5px]",
            active
              ? "bg-white font-semibold text-slate-900 shadow-crm-soft dark:bg-slate-800 dark:text-slate-50"
              : "font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100",
          )}
        >
          {Icon ? <Icon aria-hidden="true" size={14} /> : null}
          {option.dot ? (
            <i aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: option.dot }} />
          ) : null}
          {option.label}
          {option.count !== undefined && option.count !== null ? (
            <span className="tabular-nums text-slate-400 dark:text-slate-500">{option.count}</span>
          ) : null}
        </button>
      );
    })}
  </div>
);

export default Segmented;
