import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import IconButton from "./IconButton";
import { cn } from "./utils";

const FOCUSABLE = [
  "a[href]", "button:not([disabled])", "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])", "textarea:not([disabled])", "[tabindex]:not([tabindex='-1'])",
].join(",");

const sizes = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

const Modal = ({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  size = "md",
  className,
}) => {
  const dialogRef = useRef(null);

  /*
   * Escape to dismiss, plus the focus handling a dialog owes a keyboard or
   * screen-reader user: focus moves in when it opens, Tab cycles inside it
   * rather than wandering onto the page behind, and focus returns to whatever
   * opened it on close.
   */
  useEffect(() => {
    if (!open) return undefined;

    const previouslyFocused = document.activeElement;

    const focusables = () =>
      Array.from(dialogRef.current?.querySelectorAll(FOCUSABLE) || [])
        .filter((el) => el.offsetParent !== null || el === document.activeElement);

    // Prefer the first real control; fall back to the dialog itself.
    const initial = focusables()[0] || dialogRef.current;
    initial?.focus?.();

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose?.();
        return;
      }
      if (event.key !== "Tab") return;

      const items = focusables();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, [onClose, open]);

  if (!open) return null;

  return createPortal((
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        aria-labelledby={title ? "modal-title" : undefined}
        className={cn(
          "relative flex max-h-[90vh] w-full flex-col rounded-xl border border-slate-200 bg-white shadow-crm-panel outline-none dark:border-slate-700 dark:bg-slate-950",
          sizes[size] || sizes.md,
          className,
        )}
      >
        {title || description ? (
          <header className="flex items-start justify-between gap-3 border-b border-slate-200 p-4 dark:border-slate-800">
            <div className="min-w-0">
              {title ? (
                <h2 id="modal-title" className="truncate text-[15px] font-semibold text-slate-950 dark:text-slate-100">
                  {title}
                </h2>
              ) : null}
              {description ? <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">{description}</p> : null}
            </div>
            <IconButton icon={X} label="Close dialog" onClick={onClose} />
          </header>
        ) : null}
        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
        {footer ? <footer className="flex items-center justify-end gap-2 border-t border-slate-200 p-4 dark:border-slate-800">{footer}</footer> : null}
      </div>
    </div>
  ), document.body);
};

export default Modal;
