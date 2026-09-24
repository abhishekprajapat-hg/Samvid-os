import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import IconButton from "./IconButton";
import { cn } from "./utils";

const Pagination = ({
  page = 1,
  totalPages = 1,
  totalItems,
  pageSize,
  onPageChange,
  className,
}) => {
  const safeTotalPages = Math.max(1, totalPages);
  const safePage = Math.min(Math.max(1, page), safeTotalPages);
  const canPrev = safePage > 1;
  const canNext = safePage < safeTotalPages;

  const rangeStart = pageSize && totalItems ? (safePage - 1) * pageSize + 1 : null;
  const rangeEnd = pageSize && totalItems ? Math.min(safePage * pageSize, totalItems) : null;

  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3", className)}>
      <p className="text-xs font-semibold tabular-nums text-slate-500 dark:text-slate-400">
        {rangeStart && rangeEnd
          ? `Showing ${rangeStart}-${rangeEnd} of ${totalItems}`
          : `Page ${safePage} of ${safeTotalPages}`}
      </p>
      <div className="flex items-center gap-2">
        <IconButton
          icon={ChevronLeft}
          label="Previous page"
          size="sm"
          disabled={!canPrev}
          onClick={() => onPageChange?.(safePage - 1)}
        />
        <span className="min-w-[3rem] text-center text-xs font-semibold tabular-nums text-slate-700 dark:text-slate-200">
          {safePage} / {safeTotalPages}
        </span>
        <IconButton
          icon={ChevronRight}
          label="Next page"
          size="sm"
          disabled={!canNext}
          onClick={() => onPageChange?.(safePage + 1)}
        />
      </div>
    </div>
  );
};

export default Pagination;
