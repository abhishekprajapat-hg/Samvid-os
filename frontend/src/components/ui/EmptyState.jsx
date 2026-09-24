import React from "react";
import { Inbox } from "lucide-react";
import Button from "./Button";
import { cn } from "./utils";

const EmptyState = ({
  title = "Nothing here yet",
  description,
  text,
  icon: Icon = Inbox,
  actionLabel,
  onAction,
  className,
}) => (
  <div
    className={cn(
      "rounded-xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center",
      "dark:border-slate-700 dark:bg-slate-900",
      className,
    )}
  >
    <div className="mx-auto mb-3 flex h-[42px] w-[42px] items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
      {React.createElement(Icon, { "aria-hidden": "true", size: 19 })}
    </div>
    <p className="text-[14.5px] font-semibold text-slate-900 dark:text-slate-100">{text || title}</p>
    {description ? (
      <p className="mx-auto mt-1.5 max-w-sm text-[13px] leading-5 text-slate-600 dark:text-slate-400">{description}</p>
    ) : null}
    {actionLabel && onAction ? (
      <Button className="mt-4" size="sm" variant="secondary" onClick={onAction}>
        {actionLabel}
      </Button>
    ) : null}
  </div>
);

export default EmptyState;
