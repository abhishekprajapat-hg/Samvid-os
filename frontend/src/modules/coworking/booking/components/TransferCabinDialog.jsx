import React, { useState } from "react";
import { ArrowRight, MoveRight } from "lucide-react";
import { Button, Modal, cn } from "../../../../components/ui";
import { formatCurrency } from "../../../../utils/format";

/*
 * Move a sitting client into a different cabin.
 *
 * This is the routine one nobody designs for and everybody needs: a team grows
 * out of a 4-seater, or wants to be nearer the entrance. Releasing and
 * re-onboarding would lose the agreement, so the transfer keeps the agreement
 * id and dates and only the room changes. The old cabin gets the client in its
 * history, which is what keeps the churn count honest.
 */

const TransferCabinDialog = ({ open, cabin, cabins, onClose, onConfirm }) => {
  const [target, setTarget] = useState("");

  if (!cabin) return null;

  const options = cabins
    .filter((item) => item.status === "VACANT" && item.code !== cabin.code)
    .sort((a, b) => a.seats - b.seats || a.code.localeCompare(b.code));
  const chosen = options.find((item) => item.code === target);
  const difference = chosen ? chosen.monthlyRent - cabin.monthlyRent : 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={`Move ${cabin.client?.name || "client"} out of ${cabin.label}`}
      description="The agreement carries over. Only the room and its rent change."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            leftIcon={MoveRight}
            disabled={!chosen}
            onClick={() => onConfirm({ fromCode: cabin.code, toCode: chosen.code })}
          >
            Move to {chosen?.label || "…"}
          </Button>
        </>
      }
    >
      {chosen ? (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-slate-500 dark:text-slate-400">From</p>
            <p className="text-[13px] font-semibold text-slate-900 dark:text-slate-100">
              {cabin.label} · {cabin.seats} seater
            </p>
            <p className="text-[11.5px] tabular-nums text-slate-500 dark:text-slate-400">
              {formatCurrency(cabin.contract?.monthlyRent ?? cabin.monthlyRent)}/mo
            </p>
          </div>
          <ArrowRight aria-hidden="true" size={16} className="shrink-0 text-slate-400" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-slate-500 dark:text-slate-400">To</p>
            <p className="text-[13px] font-semibold text-slate-900 dark:text-slate-100">
              {chosen.label} · {chosen.seats} seater
            </p>
            <p
              className={cn(
                "text-[11.5px] tabular-nums",
                difference > 0
                  ? "text-emerald-700 dark:text-emerald-400"
                  : difference < 0
                    ? "text-amber-700 dark:text-amber-400"
                    : "text-slate-500 dark:text-slate-400",
              )}
            >
              {formatCurrency(chosen.monthlyRent)}/mo
              {difference !== 0 ? ` (${difference > 0 ? "+" : ""}${formatCurrency(difference)})` : " (same rent)"}
            </p>
          </div>
        </div>
      ) : null}

      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Vacant cabins ({options.length})
      </h3>

      {options.length ? (
        <ul className="custom-scrollbar grid max-h-[320px] gap-2 overflow-y-auto sm:grid-cols-2">
          {options.map((option) => (
            <li key={option.code}>
              <button
                type="button"
                aria-pressed={target === option.code}
                onClick={() => setTarget(option.code)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left outline-none transition",
                  "focus-visible:ring-2 focus-visible:ring-blue-500/40",
                  target === option.code
                    ? "border-blue-600 bg-blue-50 dark:bg-blue-500/10"
                    : "border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900",
                )}
              >
                <span className="text-[13px] font-semibold text-slate-900 dark:text-slate-100">{option.label}</span>
                <span className="text-[11.5px] text-slate-500 dark:text-slate-400">{option.seats} seater</span>
                <span className="ml-auto text-[11.5px] tabular-nums text-slate-600 dark:text-slate-300">
                  {formatCurrency(option.monthlyRent)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-[12.5px] text-slate-500 dark:border-slate-600 dark:text-slate-400">
          No vacant cabin to move into. Release one first, or drop a hold.
        </p>
      )}
    </Modal>
  );
};

export default TransferCabinDialog;
