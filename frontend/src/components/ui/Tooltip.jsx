import { cn } from "./utils";

const positions = {
  bottom:
    "left-1/2 top-[calc(100%+0.5rem)] -translate-x-1/2",
  right:
    "left-[calc(100%+0.5rem)] top-1/2 -translate-y-1/2",
};

const Tooltip = ({ label, children, className, side = "bottom" }) => (
  <span className={cn("group/tooltip relative inline-flex", className)}>
    {children}
    <span
      className={cn(
        "pointer-events-none absolute z-50 hidden whitespace-nowrap rounded-lg bg-slate-900 px-2 py-1 text-[11.5px] font-semibold text-white opacity-0 shadow-crm-panel transition",
        "group-hover/tooltip:block group-hover/tooltip:opacity-100 dark:bg-slate-700 dark:text-slate-50",
        positions[side] || positions.bottom,
      )}
    >
      {label}
    </span>
  </span>
);

export default Tooltip;
