import React from "react";
import { UserPlus, X } from "lucide-react";
import { Button, cn } from "../../../../components/ui";
import { formatCurrency } from "../../../../utils/format";

/*
 * The cart, borrowed straight from seat booking: pick cabins on the map, watch
 * the total build, then check out into onboarding.
 *
 * It only ever holds vacant cabins - a booked one is not for sale - so the bar
 * doubles as the answer to "can I actually take this deal today". It stays
 * docked to the bottom of the board so the map keeps its full height.
 */

const SelectionBar = ({ cabins, onRemove, onClear, onOnboard }) => {
  if (!cabins.length) return null;

  const capacity = cabins.reduce((total, cabin) => total + cabin.seats, 0);
  const rent = cabins.reduce((total, cabin) => total + cabin.monthlyRent, 0);

  return (
    <div
      role="region"
      aria-label="Selected cabins"
      className={cn(
        // Docked: the board scrolls behind it, so the running total and the way
        // out of the selection are never scrolled off.
        "sticky bottom-0 z-30 flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3 sm:gap-y-2",
        "border-t border-slate-200 bg-white px-4 py-2.5",
        "shadow-[0_-8px_20px_-14px_rgba(16,24,40,0.35)]",
        "dark:border-slate-700 dark:bg-slate-900",
      )}
    >
      <div className="shrink-0">
        <p className="text-[13px] font-semibold text-slate-950 dark:text-slate-50">
          {cabins.length} {cabins.length === 1 ? "cabin" : "cabins"} · seats {capacity}
        </p>
        <p className="text-[11.5px] tabular-nums text-slate-500 dark:text-slate-400">
          {formatCurrency(rent)} / month
        </p>
      </div>

      <ul className="flex max-h-20 w-full flex-none flex-wrap content-start items-center gap-1.5 overflow-y-auto pr-1 sm:max-h-none sm:w-auto sm:min-w-0 sm:flex-1 sm:pr-0">
        {cabins.map((cabin) => (
          <li key={cabin.code}>
            <span className="inline-flex items-center gap-1 rounded-full border border-blue-600 bg-blue-50 py-0.5 pl-2.5 pr-1 text-[11px] font-semibold text-blue-700 dark:border-blue-400/50 dark:bg-blue-500/10 dark:text-blue-200">
              <span className="font-mono">{cabin.label}</span>
              <span className="font-normal opacity-70">{cabin.seats} seater</span>
              <button
                type="button"
                aria-label={`Remove cabin ${cabin.label} from selection`}
                onClick={() => onRemove(cabin.code)}
                className="flex h-4 w-4 items-center justify-center rounded-full outline-none transition hover:bg-blue-600 hover:text-white focus-visible:ring-2 focus-visible:ring-blue-500/50"
              >
                <X aria-hidden="true" size={10} />
              </button>
            </span>
          </li>
        ))}
      </ul>

      <div className="flex shrink-0 items-center justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onClear}>
          Clear
        </Button>
        <Button size="sm" leftIcon={UserPlus} onClick={() => onOnboard(cabins)}>
          Onboard client
        </Button>
      </div>
    </div>
  );
};

export default SelectionBar;
