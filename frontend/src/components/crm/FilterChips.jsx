import React from "react";
import { Plus, X } from "lucide-react";
import { cn } from "../ui";

/**
 * Filters as removable chips. An active chip states the filter and carries its
 * own dismiss; an inactive one is a dashed "+ Label" affordance.
 *
 * @param {Array}    filters   [{ id, label, value, active }]. `value` is appended
 *                             to the label when present, e.g. "Budget: under 2L".
 * @param {Function} onToggle  (filter) => void. Fired when an inactive chip is clicked.
 * @param {Function} onRemove  (filter) => void. Fired by the x on an active chip.
 *                             Without it, an active chip falls back to onToggle.
 * @param {Function} onAdd     () => void. Renders a trailing "Add filter" button.
 * @param {string}   className Merged onto the wrapper.
 */
const FilterChips = ({ filters = [], onToggle, onRemove, onAdd, className }) => (
  <div className={cn("flex flex-wrap items-center gap-2", className)}>
    {filters.map((filter) => {
      const label = filter.value ? `${filter.label}: ${filter.value}` : filter.label;

      if (filter.active) {
        return (
          <span
            key={filter.id}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border border-blue-600 bg-blue-50 py-1 pl-3 pr-1.5",
              "text-xs font-semibold text-blue-700",
              "dark:border-blue-400/50 dark:bg-blue-500/10 dark:text-blue-200",
            )}
          >
            {label}
            <button
              type="button"
              aria-label={`Remove filter ${filter.label}`}
              onClick={() => (onRemove ? onRemove(filter) : onToggle?.(filter))}
              className={cn(
                "flex h-4 w-4 items-center justify-center rounded-full outline-none transition",
                "hover:bg-blue-600 hover:text-white focus-visible:ring-2 focus-visible:ring-blue-500/50",
              )}
            >
              <X aria-hidden="true" size={11} />
            </button>
          </span>
        );
      }

      return (
        <button
          key={filter.id}
          type="button"
          onClick={() => onToggle?.(filter)}
          className={cn(
            "inline-flex items-center gap-1 rounded-full border border-dashed border-slate-300 bg-white px-3 py-1",
            "text-xs font-medium text-slate-600 outline-none transition",
            "hover:border-slate-400 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-blue-500/50",
            "dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-slate-100",
          )}
        >
          <Plus aria-hidden="true" size={11} />
          {label}
        </button>
      );
    })}

    {onAdd ? (
      <button
        type="button"
        onClick={onAdd}
        className={cn(
          "inline-flex items-center gap-1 rounded-full border border-dashed border-slate-300 bg-white px-3 py-1",
          "text-xs font-medium text-slate-600 outline-none transition",
          "hover:border-slate-400 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-blue-500/50",
          "dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-slate-100",
        )}
      >
        <Plus aria-hidden="true" size={11} />
        Add filter
      </button>
    ) : null}
  </div>
);

export default FilterChips;
