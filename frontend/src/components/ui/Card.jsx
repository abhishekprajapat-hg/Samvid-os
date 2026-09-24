import React from "react";
import { cn } from "./utils";

export const Card = React.forwardRef(({ className, interactive = false, ...props }, ref) => (
  <section
    ref={ref}
    className={cn(
      "rounded-xl border border-slate-200 bg-white text-slate-950 shadow-crm-card",
      "dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100",
      // No translate on hover - it jitters rows in dense lists.
      interactive && "transition hover:border-slate-300 hover:shadow-crm-panel dark:hover:border-slate-600",
      className,
    )}
    {...props}
  />
));

Card.displayName = "Card";

export const CardHeader = ({ className, ...props }) => (
  <div className={cn("flex flex-col gap-1.5 border-b border-slate-200 p-4 dark:border-slate-800", className)} {...props} />
);

export const CardTitle = ({ className, ...props }) => (
  <h2 className={cn("text-[13.5px] font-semibold text-slate-950 dark:text-slate-100", className)} {...props} />
);

export const CardDescription = ({ className, ...props }) => (
  <p className={cn("text-xs leading-5 text-slate-500 dark:text-slate-400", className)} {...props} />
);

export const CardContent = ({ className, ...props }) => (
  <div className={cn("p-4", className)} {...props} />
);

export const CardFooter = ({ className, ...props }) => (
  <div className={cn("flex items-center gap-2 border-t border-slate-200 p-4 dark:border-slate-800", className)} {...props} />
);

export default Card;
