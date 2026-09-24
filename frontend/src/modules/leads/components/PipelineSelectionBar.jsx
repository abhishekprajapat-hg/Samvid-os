import React from "react";
import { Download, X } from "lucide-react";
import { Button, cn } from "../../../components/ui";

/**
 * Footer bar that appears once at least one row is selected.
 *
 * Note: the pipeline had no bulk assign or bulk status change before this
 * phase, so there was nothing of that kind to move here. Export works entirely
 * off the rows already in the browser - it calls no service.
 *
 * @param {number}   count      Selected row count. Zero renders nothing.
 * @param {Function} onClear    () => void.
 * @param {Function} onExport   () => void.
 * @param {node}     children   Extra actions, e.g. bulk assign when it exists.
 */
const PipelineSelectionBar = ({ count = 0, onClear, onExport, children, className }) => {
  if (!count) return null;

  return (
    <div
      role="region"
      aria-label="Bulk actions"
      className={cn(
        "sticky bottom-0 z-20 flex flex-wrap items-center gap-3 border-t border-slate-200 bg-white px-4 py-2.5",
        "shadow-crm-panel dark:border-slate-800 dark:bg-slate-900",
        className,
      )}
    >
      <span className="text-[13px] font-semibold tabular-nums text-slate-900 dark:text-slate-100">
        {count} selected
      </span>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        {children}
        {onExport ? <Button size="sm" variant="secondary" leftIcon={Download} onClick={onExport}>
          Export CSV
        </Button> : null}
        <Button size="sm" variant="ghost" leftIcon={X} onClick={onClear}>
          Clear
        </Button>
      </div>
    </div>
  );
};

export default PipelineSelectionBar;
