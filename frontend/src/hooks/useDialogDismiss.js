import { useEffect, useRef } from "react";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

/*
 * Escape-to-close and focus management for the hand-rolled dialogs and bottom
 * sheets that do not go through components/ui/Modal.
 *
 * The audit found that none of them closed on Escape and most never moved
 * focus inside, which leaves keyboard and screen-reader users stranded behind
 * an open overlay. Attach the returned ref to the dialog element:
 *
 *   const dialogRef = useDialogDismiss(isOpen, onClose);
 *   ...
 *   <div ref={dialogRef} role="dialog" aria-modal="true"> ... </div>
 */
const useDialogDismiss = (isOpen, onClose) => {
  const dialogRef = useRef(null);
  // Held in a ref so a new onClose identity each render does not tear down and
  // re-arm the key listener (which would also re-steal focus).
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const previouslyFocused = document.activeElement;

    const focusables = () =>
      Array.from(dialogRef.current?.querySelectorAll(FOCUSABLE) || [])
        .filter((element) => element.offsetParent !== null);

    // Let the dialog paint before moving focus into it.
    const focusTimer = setTimeout(() => {
      const target = focusables()[0] || dialogRef.current;
      target?.focus?.();
    }, 0);

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        closeRef.current?.();
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

    document.addEventListener("keydown", onKeyDown);
    return () => {
      clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKeyDown);
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, [isOpen]);

  return dialogRef;
};

export default useDialogDismiss;
