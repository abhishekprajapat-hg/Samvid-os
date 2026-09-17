import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { cn } from "../../../../components/ui";

/*
 * The cabin surface: a bottom sheet on a phone, a centred dialog from `sm` up.
 *
 * Not the shared Modal, because the difference is in the outer container -
 * where the panel sits and which corners it rounds - and Modal only exposes the
 * panel's own classes. Adding a mode to a component used on every screen in the
 * app to serve one screen is the worse trade.
 *
 * A sheet rises from the thumb, which is where a cabin tile was just tapped;
 * a dialog dropped in the middle of a phone screen puts its actions where no
 * thumb reaches. The drag handle is the affordance that says "this dismisses",
 * and the whole header row stays put while the body scrolls.
 */

const CabinSheet = ({ open, onClose, children, labelledBy }) => {
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  return createPortal((
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Close cabin details"
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={cn(
          "relative flex w-full flex-col border border-slate-200 bg-white shadow-crm-panel outline-none",
          "dark:border-slate-700 dark:bg-slate-950",
          // Phone: a sheet across the full width, capped so the map stays visible.
          "max-h-[88vh] rounded-t-2xl",
          // Desktop: the familiar centred dialog.
          "sm:max-h-[90vh] sm:max-w-2xl sm:rounded-xl",
        )}
      >
        <div aria-hidden="true" className="flex justify-center pb-1 pt-2.5 sm:hidden">
          <span className="h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-600" />
        </div>

        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-4">
          {children}
        </div>
      </div>
    </div>
  ), document.body);
};

export default CabinSheet;
