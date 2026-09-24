import React from "react";
import { AlertOctagon, RefreshCw } from "lucide-react";
import Button from "./Button";
import { cn } from "./utils";

const ErrorState = ({
  title = "Something went wrong",
  description = "We couldn't load this data. Please try again.",
  actionLabel = "Retry",
  onAction,
  className,
}) => (
  <div
    className={cn(
      "rounded-xl border border-rose-200 bg-rose-50 px-5 py-10 text-center",
      "dark:border-rose-500/30 dark:bg-rose-500/10",
      className,
    )}
  >
    <div className="mx-auto mb-3 flex h-[42px] w-[42px] items-center justify-center rounded-xl bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-300">
      <AlertOctagon aria-hidden="true" size={19} />
    </div>
    <p className="text-[14.5px] font-semibold text-rose-700 dark:text-rose-200">{title}</p>
    {description ? (
      <p className="mx-auto mt-1.5 max-w-sm text-[13px] leading-5 text-rose-700/90 dark:text-rose-200/90">{description}</p>
    ) : null}
    {actionLabel && onAction ? (
      <Button className="mt-4" size="sm" variant="danger" leftIcon={RefreshCw} onClick={onAction}>
        {actionLabel}
      </Button>
    ) : null}
  </div>
);

export default ErrorState;
