import React from "react";
import { Check } from "lucide-react";
import { cn } from "../../../../components/ui";
import { STATUS_META } from "../cabinData";

/*
 * One cabin, in one of two forms.
 *
 * Cabins let as whole rooms here, not by the chair, so a cabin has a capacity
 * and a status - never a count of filled seats. "4 seater" is a property of the
 * room; it does not change when a client moves in. That is why there is no pip
 * row and no occupied-of-total anywhere on this tile.
 *
 * "wing" is the roomy form: cabin number, capacity, and whoever holds it.
 * "plan" is the floor plate, and carries the cabin number alone - the plan
 * hands each tile the cabin's real footprint, as little as 32px tall, and
 * anything stacked under the number clips or shrinks past reading. Colour
 * carries status in both, and the legend above the plan names the colours.
 */

const CabinTile = React.memo(
  ({
    cabin,
    variant = "wing",
    dense = true,
    selected = false,
    inCart = false,
    dimmed = false,
    onSelect,
    className,
    style,
  }) => {
    const meta = STATUS_META[cabin.status];
    const isPlan = variant === "plan";
    const isLet = cabin.status === "BOOKED" || cabin.status === "RESERVED";
    const holder = isLet ? cabin.client.name : meta.label;

    const description = isLet
      ? `${cabin.seats} seater, ${cabin.status === "RESERVED" ? "held for" : "let to"} ${cabin.client.name}`
      : `${cabin.seats} seater, ${meta.label.toLowerCase()}`;

    return (
      <button
        type="button"
        onClick={() => onSelect?.(cabin)}
        aria-pressed={selected}
        aria-label={`Cabin ${cabin.label}, ${description}`}
        title={`${cabin.label} · ${cabin.seats} seater · ${cabin.client?.name || meta.label}`}
        style={style}
        className={cn(
          "group/tile relative flex h-full w-full flex-col items-center justify-center",
          "overflow-hidden rounded-lg border outline-none transition",
          "focus-visible:z-20 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1",
          "dark:focus-visible:ring-offset-slate-950",
          isPlan ? "px-0.5" : "gap-1 px-2 py-2.5",
          meta.tile,
          dimmed && "opacity-30 saturate-50",
          selected && "z-10 border-blue-600 ring-2 ring-blue-600 dark:border-blue-400 dark:ring-blue-400",
          inCart && !selected && "z-10 border-blue-600 ring-1 ring-blue-600",
          className,
        )}
      >
        {inCart ? (
          <span
            aria-hidden="true"
            className="absolute right-0 top-0 flex h-4 w-4 items-center justify-center rounded-bl-lg bg-blue-600 text-white"
          >
            <Check size={10} strokeWidth={3.5} />
          </span>
        ) : null}

        <span
          className={cn(
            "truncate font-semibold leading-none tracking-tight",
            // On the plan the number is the whole tile, so it grows with zoom.
            isPlan ? (dense ? "text-[10px]" : "text-[13px]") : "text-[18px]",
          )}
        >
          {cabin.label}
        </span>

        {isPlan ? null : (
          <>
            <span className="rounded-full bg-black/5 px-2 py-0.5 text-[11px] font-semibold leading-none dark:bg-white/10">
              {cabin.seats} seater
            </span>
            <span className="w-full truncate text-center text-[11.5px] font-medium leading-tight opacity-80">
              {holder}
            </span>
          </>
        )}
      </button>
    );
  },
);

CabinTile.displayName = "CabinTile";

export default CabinTile;
