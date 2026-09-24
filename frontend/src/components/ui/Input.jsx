import React from "react";
import { cn } from "./utils";

const Input = React.forwardRef(({ className, leftIcon: LeftIcon, rightSlot, ...props }, ref) => (
  <div className="relative w-full">
    {LeftIcon ? (
      <LeftIcon
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400"
        size={16}
      />
    ) : null}
    <input
      ref={ref}
      className={cn(
        "h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-[13px] text-slate-900 outline-none transition",
        "placeholder:text-slate-500 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20",
        "disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500",
        "dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-400",
        LeftIcon && "pl-9",
        rightSlot && "pr-10",
        className,
      )}
      {...props}
    />
    {rightSlot ? <div className="absolute right-2 top-1/2 -translate-y-1/2">{rightSlot}</div> : null}
  </div>
));

Input.displayName = "Input";

export default Input;
