import React from "react";
import { cn } from "../../../components/ui";

/*
 * The two spec primitives from docs/CRM_SCREENS.html.
 *
 *   .sectitle  11px / 700 / .08em uppercase, muted, 9px below
 *   .kv        grid 118px 1fr, 7px row gap / 12px column gap, 12.8px
 *              dt muted, dd weight 550
 */

export const SectionTitle = ({ children, className }) => (
  <div
    className={cn(
      "mb-[9px] text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400",
      className,
    )}
  >
    {children}
  </div>
);

/**
 * @param {Array}  rows       [{ label, value, mono }]. Falsy values render as an em dash.
 * @param {string} labelWidth Grid column for the term. Reference uses 118px, 100px
 *                            inside the four spec blocks and 96px on the owner card.
 */
export const KeyValue = ({ rows = [], labelWidth = "118px", className }) => (
  <dl
    className={cn("grid gap-x-3 gap-y-[7px] text-[12.8px]", className)}
    style={{ gridTemplateColumns: `${labelWidth} 1fr` }}
  >
    {rows.map((row) => (
      <React.Fragment key={row.label}>
        <dt className="text-slate-500 dark:text-slate-400">{row.label}</dt>
        <dd
          className={cn(
            "m-0 min-w-0 font-medium text-slate-800 dark:text-slate-200",
            row.mono && "font-mono",
          )}
        >
          {row.value === null || row.value === undefined || row.value === "" ? (
            <span className="text-slate-400 dark:text-slate-500">—</span>
          ) : (
            row.value
          )}
        </dd>
      </React.Fragment>
    ))}
  </dl>
);

/** Amenity pills - the reference renders these as dashed chips. */
export const AmenityChips = ({ items = [], className }) => {
  if (!items.length) return null;
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {items.map((item) => (
        <span
          key={item}
          className={cn(
            "inline-flex items-center rounded-full border border-dashed border-slate-300 bg-white px-2.5 py-1",
            "text-xs font-medium text-slate-600",
            "dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300",
          )}
        >
          {item}
        </span>
      ))}
    </div>
  );
};
