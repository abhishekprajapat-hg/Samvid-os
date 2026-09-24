import React, { useState } from "react";
import { Timer } from "lucide-react";
import { Button, Input, Modal } from "../../../../components/ui";
import { formatCurrency } from "../../../../utils/format";

/*
 * Put a cabin on hold for a lead who has not signed yet.
 *
 * A hold has to expire on its own. A cabin quietly held for a prospect who went
 * cold is the most expensive thing on a coworking floor, so the expiry is a
 * required field, not an option, and the board sweeps lapsed holds on load.
 */

const HOLD_DAYS = [3, 7, 14, 30];

const HoldCabinDialog = ({ open, cabin, onClose, onConfirm }) => {
  const [name, setName] = useState("");
  const [days, setDays] = useState(7);

  if (!cabin) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={`Hold cabin ${cabin.label}`}
      description={`${cabin.seats} seater · ${formatCurrency(cabin.monthlyRent)} per month`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            leftIcon={Timer}
            disabled={!name.trim()}
            onClick={() => onConfirm({ cabinCode: cabin.code, name: name.trim(), days })}
          >
            Hold for {days} days
          </Button>
        </>
      }
    >
      <label className="block">
        <span className="mb-1 block text-[11.5px] font-medium text-slate-600 dark:text-slate-300">
          Lead or company name
        </span>
        <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Who is this held for?" />
      </label>

      <fieldset className="mt-4">
        <legend className="mb-1.5 text-[11.5px] font-medium text-slate-600 dark:text-slate-300">Hold expires in</legend>
        <div className="flex flex-wrap gap-2">
          {HOLD_DAYS.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={days === option}
              onClick={() => setDays(option)}
              className={
                days === option
                  ? "rounded-lg border border-blue-600 bg-blue-50 px-3 py-1.5 text-[12.5px] font-semibold text-blue-700 outline-none dark:bg-blue-500/10 dark:text-blue-300"
                  : "rounded-lg border border-slate-200 px-3 py-1.5 text-[12.5px] font-medium text-slate-600 outline-none transition hover:border-slate-300 focus-visible:ring-2 focus-visible:ring-blue-500/40 dark:border-slate-700 dark:text-slate-300"
              }
            >
              {option} days
            </button>
          ))}
        </div>
      </fieldset>

      <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[11.5px] text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
        The cabin shows as Reserved and cannot be onboarded to anyone else. If the hold lapses, the board releases it
        automatically and logs it.
      </p>
    </Modal>
  );
};

export default HoldCabinDialog;
