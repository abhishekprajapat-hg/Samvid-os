import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, CheckCircle2, Info, XCircle, X } from "lucide-react";

// Surface stays neutral; the tone is carried by a coloured left border and the
// icon, so a toast never fights the page for attention.
const TOAST_STYLES = {
  error: {
    icon: XCircle,
    className: "border-l-rose-600 text-rose-700 dark:text-rose-300",
  },
  success: {
    icon: CheckCircle2,
    className: "border-l-emerald-600 text-emerald-700 dark:text-emerald-300",
  },
  warning: {
    icon: AlertCircle,
    className: "border-l-amber-600 text-amber-700 dark:text-amber-300",
  },
  info: {
    icon: Info,
    className: "border-l-blue-600 text-blue-700 dark:text-blue-300",
  },
};

const ToastMessage = ({
  message,
  type = "info",
  position = "top-right",
  className = "",
  persistent = false,
  duration,
  onDismiss,
}) => {
  const [dismissed, setDismissed] = useState(false);
  const dismissRef = useRef(onDismiss);
  useEffect(() => { dismissRef.current = onDismiss; }, [onDismiss]);
  const timeout = duration ?? (type === "success" ? 2500 : 4000);
  useEffect(() => {
    if (persistent) return undefined;
    const timer = setTimeout(() => {
      setDismissed(true);
      dismissRef.current?.();
    }, timeout);
    return () => clearTimeout(timer);
  }, [persistent, timeout]);
  if (dismissed) return null;

  const config = TOAST_STYLES[type] || TOAST_STYLES.info;
  const Icon = config.icon;
  const positionClass =
    position === "bottom-right"
      ? "bottom-4"
      : "top-4";

  const toast = (
    <div
      className={`pointer-events-none fixed inset-x-3 ${positionClass} z-[9999] flex sm:inset-x-auto sm:right-4`}
      role={type === "error" ? "alert" : "status"}
      aria-live={type === "error" ? "assertive" : "polite"}
    >
      <div
        className={`pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-xl border border-slate-200 border-l-[3px] bg-white px-3 py-2.5 text-[13px] font-semibold shadow-crm-panel sm:px-4 dark:border-slate-700 dark:bg-slate-900 ${config.className} ${className}`}
      >
        <Icon size={17} className="mt-0.5 shrink-0" />
        <span className="min-w-0 break-words text-slate-900 dark:text-slate-100">{message}</span>
        <button type="button" aria-label="Dismiss notification" className="ml-auto shrink-0 rounded p-0.5" onClick={() => {
          setDismissed(true);
          dismissRef.current?.();
        }}><X size={16} /></button>
      </div>
    </div>
  );

  if (typeof document === "undefined") return toast;
  return createPortal(toast, document.body);
};

const ToastNotice = (props) => props.message
  ? <ToastMessage key={`${props.type || "info"}:${props.message}`} {...props} />
  : null;

export default ToastNotice;
