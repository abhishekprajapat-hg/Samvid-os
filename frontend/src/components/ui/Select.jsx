import React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "./utils";

const Select = React.forwardRef(({ className, children, ...props }, ref) => (
  <div className="relative w-full">
    <select
      ref={ref}
      className={cn(
        "h-9 w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 pr-9 text-[13px] font-semibold text-slate-800 outline-none transition",
        "focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 disabled:cursor-not-allowed disabled:opacity-60",
        "dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100",
        className,
      )}
      {...props}
    >
      {children}
    </select>
    <ChevronDown
      aria-hidden="true"
      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400"
      size={15}
    />
  </div>
));

Select.displayName = "Select";

export default Select;
