import { X } from "lucide-react";
import { IconButton, Select, cn } from "../ui";

const FilterBar = ({ filters = [], onClear, className }) => {
  const hasActiveFilter = filters.some((filter) => filter.value !== undefined && filter.value !== "" && filter.value !== "all");

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {filters.map((filter) => (
        <label key={filter.name} className="flex min-w-[9rem] flex-col gap-1">
          {filter.label ? (
            <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">{filter.label}</span>
          ) : null}
          <Select
            value={filter.value}
            onChange={(event) => filter.onChange?.(event.target.value)}
            aria-label={filter.label || filter.name}
          >
            {filter.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </label>
      ))}
      {onClear && hasActiveFilter ? (
        <IconButton icon={X} label="Clear filters" size="sm" className="self-end" onClick={onClear} />
      ) : null}
    </div>
  );
};

export default FilterBar;
