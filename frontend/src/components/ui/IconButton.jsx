import React from "react";
import { cn } from "./utils";

const sizes = {
  sm: "h-8 w-8 rounded-lg",
  md: "h-9 w-9 rounded-lg",
  lg: "h-10 w-10 rounded-lg",
};

const IconButton = React.forwardRef(
  ({ icon: Icon, label, size = "md", className, children, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center border border-slate-200 bg-white text-slate-500 outline-none transition",
        "hover:bg-slate-50 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-blue-500/50",
        "disabled:cursor-not-allowed disabled:opacity-60",
        "dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100",
        sizes[size] || sizes.md,
        className,
      )}
      {...props}
    >
      {Icon ? <Icon aria-hidden="true" size={16} /> : children}
    </button>
  ),
);

IconButton.displayName = "IconButton";

export default IconButton;
