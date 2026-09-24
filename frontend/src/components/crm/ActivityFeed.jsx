import React from "react";
import { EmptyState, cn } from "../ui";

/**
 * Diary and audit trail. Entries render React nodes, so a status change can
 * embed the badges it moved between rather than describing them in words.
 *
 * @param {Array} items       [{ id, body, meta, timestamp, highlight }].
 *                            `body` and `meta` accept nodes. `highlight` marks the
 *                            entry that matters most, usually the newest.
 * @param {node}  emptyState  Rendered when there are no items.
 * @param {string} className  Merged onto the wrapper.
 */
const ActivityFeed = ({ items = [], emptyState, className }) => {
  if (!items.length) {
    return emptyState || <EmptyState title="No activity yet" description="Entries appear here as work is logged." />;
  }

  return (
    <ol className={cn("relative m-0 list-none py-1 pl-[22px] pr-0", className)}>
      {/* Connector rail, drawn behind the dots. */}
      <span
        aria-hidden="true"
        className="absolute bottom-1.5 left-[6px] top-1.5 w-[2px] rounded-full bg-slate-200 dark:bg-slate-700"
      />

      {items.map((item, index) => (
        <li key={item.id ?? index} className={cn("relative", index === items.length - 1 ? "pb-0" : "pb-3.5")}>
          <span
            aria-hidden="true"
            className={cn(
              "absolute -left-[19px] top-[5px] h-[9px] w-[9px] rounded-full border-2",
              item.highlight
                ? "border-blue-600 bg-blue-600 dark:border-blue-400 dark:bg-blue-400"
                : "border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900",
            )}
          />
          <div className="text-[12.8px] leading-5 text-slate-700 dark:text-slate-300">{item.body}</div>
          {item.timestamp || item.meta ? (
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
              {item.timestamp ? <time>{item.timestamp}</time> : null}
              {item.timestamp && item.meta ? <span aria-hidden="true">·</span> : null}
              {item.meta ? <span>{item.meta}</span> : null}
            </div>
          ) : null}
        </li>
      ))}
    </ol>
  );
};

export default ActivityFeed;
