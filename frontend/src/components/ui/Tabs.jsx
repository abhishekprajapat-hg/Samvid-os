import { cn } from "./utils";

export const Tabs = ({ className, ...props }) => (
  <div className={cn("flex flex-wrap items-center gap-4 border-b border-slate-200 dark:border-slate-800", className)} {...props} />
);

export const TabButton = ({ active = false, className, children, ...props }) => (
  <button
    type="button"
    aria-pressed={active}
    className={cn(
      "-mb-px inline-flex items-center justify-center border-b-2 py-2.5 text-[12.5px] font-semibold outline-none transition",
      "focus-visible:ring-2 focus-visible:ring-blue-500/50",
      active
        ? "border-blue-600 text-slate-900 dark:border-blue-400 dark:text-slate-50"
        : "border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100",
      className,
    )}
    {...props}
  >
    {children}
  </button>
);

export default Tabs;
