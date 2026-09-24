import React, { useState } from "react";
import { ChevronUp } from "lucide-react";
import { cn } from "../../../../components/ui";
import { WINGS } from "../cabinData";
import CabinTile from "./CabinTile";

/*
 * The 65 cabins straightened out into wings.
 *
 * The plan view answers "which cabin, and where"; this one answers "what is
 * still free" without making anyone read a drawing. Cabins run in plan order
 * inside each wing, and every wing header states its own vacancy so the floor
 * total never has to be recomputed by eye. Wings collapse, because on a floor
 * this size you are usually only working one of them.
 *
 * Counts are of cabins, not seats: cabins let whole, so "11 vacant" is the
 * number a manager can actually offer. Capacity follows as a second figure,
 * because the question after "what is free" is "how many will it seat".
 */

const numberOf = (code) => Number(code.slice(1));

const WingSection = ({ wing, cabins, selectedCode, cart, matches, onSelect }) => {
  const [open, setOpen] = useState(true);

  const vacant = cabins.filter((cabin) => cabin.status === "VACANT").length;
  const capacity = cabins.reduce((total, cabin) => total + cabin.seats, 0);
  const vacantCapacity = cabins
    .filter((cabin) => cabin.status === "VACANT")
    .reduce((total, cabin) => total + cabin.seats, 0);

  return (
    <section className="rounded-xl border border-slate-200 dark:border-slate-700">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-xl px-3 py-2.5 text-left outline-none transition",
          "hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-500/40 dark:hover:bg-slate-800/50",
        )}
      >
        <h3 className="text-[14px] font-semibold text-slate-900 dark:text-slate-100">{wing.label}</h3>
        <span className="text-[12px] text-slate-400 dark:text-slate-500">{wing.hint}</span>

        <span className="ml-auto text-[12px] tabular-nums text-slate-500 dark:text-slate-400">
          <strong
            className={cn(
              "font-semibold",
              // Red, matching the vacant tiles: an empty cabin is the thing
              // to act on, not the thing to feel good about.
              vacant ? "text-rose-700 dark:text-rose-400" : "text-slate-400 dark:text-slate-500",
            )}
          >
            {vacant} vacant
          </strong>
          {" · "}
          {cabins.length} cabins · {vacantCapacity} of {capacity} seats free
        </span>
        <ChevronUp
          aria-hidden="true"
          size={15}
          className={cn("shrink-0 text-slate-400 transition-transform", !open && "rotate-180")}
        />
      </button>

      {open ? (
        <div
          className="grid gap-2 px-3 pb-3"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(124px, 1fr))" }}
        >
          {cabins.map((cabin) => (
            <div key={cabin.code} className="h-[92px]">
              <CabinTile
                cabin={cabin}
                selected={selectedCode === cabin.code}
                inCart={cart.includes(cabin.code)}
                dimmed={!matches(cabin)}
                onSelect={onSelect}
              />
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
};

const WingSeatMap = ({ cabins, selectedCode, cart = [], matches, onSelect, className }) => (
  <div className={cn("space-y-3", className)}>
    {WINGS.map((wing) => {
      const wingCabins = cabins
        .filter((cabin) => cabin.wing === wing.id)
        .sort((a, b) => numberOf(a.code) - numberOf(b.code));
      if (!wingCabins.length) return null;

      return (
        <WingSection
          key={wing.id}
          wing={wing}
          cabins={wingCabins}
          selectedCode={selectedCode}
          cart={cart}
          matches={matches}
          onSelect={onSelect}
        />
      );
    })}
  </div>
);

export default WingSeatMap;
