import React from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "../ui";

/**
 * Headline figure. One number, what it counts, and optionally how it moved.
 *
 * @param {string} label     Small caps label above the value.
 * @param {node}   value     The figure itself.
 * @param {node}   helper    One line of context under the value.
 * @param {object} delta     { direction: "up"|"down"|"neutral", label } comparison.
 * @param {string} tone      "default" | "alert". Alert adds a rose left bar and border,
 *                           for the tile that represents work that is already late.
 * @param {Function} onClick Makes the whole tile a button, routed to the list behind it.
 * @param {Function} icon    Optional lucide icon component.
 * @param {string} className Merged onto the tile.
 */
const StatCard = ({
  label,
  value,
  helper,
  delta,
  tone = "default",
  onClick,
  icon: Icon,
  className,
}) => {
  const Component = onClick ? "button" : "div";
  const direction = delta?.direction === "up" || delta?.direction === "down" ? delta.direction : "neutral";
  const DeltaIcon = direction === "down" ? ArrowDownRight : ArrowUpRight;

  return (
    <Component
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "relative w-full overflow-hidden rounded-xl border bg-white p-4 text-left shadow-crm-soft outline-none transition",
        "dark:bg-slate-900",
        tone === "alert"
          ? "border-rose-100 dark:border-rose-500/30"
          : "border-slate-200 dark:border-slate-700",
        onClick &&
          "cursor-pointer hover:border-slate-300 hover:shadow-crm-card focus-visible:ring-2 focus-visible:ring-blue-500/50 dark:hover:border-slate-600",
        className,
      )}
    >
      {/* The alert bar carries the same meaning as the border colour, for anyone
          who cannot separate the two. */}
      {tone === "alert" ? (
        <span aria-hidden="true" className="absolute inset-y-0 left-0 w-[3px] bg-rose-500" />
      ) : null}

      <div className="flex items-start justify-between gap-3">
        <p className="truncate text-[11px] font-semibold uppercase tracking-[0.04em] text-slate-500 dark:text-slate-400">
          {label}
        </p>
        {Icon ? (
          <Icon aria-hidden="true" size={16} className="shrink-0 text-slate-400 dark:text-slate-500" />
        ) : null}
      </div>

      <p className="mt-2 text-[25px] font-bold leading-none tracking-[-0.03em] tabular-nums text-slate-900 dark:text-slate-50">
        {value}
      </p>

      {delta?.label || helper ? (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[11.5px] text-slate-500 dark:text-slate-400">
          {delta?.label ? (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 font-semibold",
                direction === "up" && "text-emerald-600 dark:text-emerald-400",
                direction === "down" && "text-rose-600 dark:text-rose-400",
                direction === "neutral" && "text-slate-600 dark:text-slate-300",
              )}
            >
              {direction === "neutral" ? null : <DeltaIcon aria-hidden="true" size={12} />}
              {delta.label}
            </span>
          ) : null}
          {helper ? <span className="min-w-0">{helper}</span> : null}
        </div>
      ) : null}
    </Component>
  );
};

export default StatCard;
