import React, { useState } from "react";
import {
  CheckSquare,
  Cigarette,
  Cog,
  Droplets,
  Maximize2,
  Minus,
  Plus,
  RotateCcw,
  Square,
  UtensilsCrossed,
} from "lucide-react";
import { Button, cn } from "../../../../components/ui";
import { FLOOR_PLAN_ROOMS } from "../../../../constants/coworkingFloorPlan";
import { PASSAGE_BAND, SHARED_ROOMS, STATUS_META, STATUS_ORDER } from "../cabinData";
import CabinTile from "./CabinTile";
import FloorPlanArchitecture from "./FloorPlanArchitecture";

/*
 * The floor as it is actually built - every cabin on its real footprint, traced
 * off the supplied plan and stored in constants/coworkingFloorPlan.
 *
 * Drawn rather than overlaid on the CAD export: the export is white line-work
 * that disappears in dark mode and cannot be tinted per status, and status is
 * the whole point of the board. The architecture is SVG underneath; the cabins
 * stay real HTML buttons on top, so they keep focus, hover and screen-reader
 * labels that a drawn plan could never give them.
 */

const PLAN_RATIO = 1684 / 1190;
const ROOM_ICONS = { cog: Cog, wash: Droplets, canteen: UtensilsCrossed, smoke: Cigarette };

/*
 * Where the three PASSAGE labels sit along the corridor band. C-13 is the only
 * cabin that reaches into the band, and it holds the left end (x 7.8-13.9), so
 * the labels start clear of it and spread across the rest. Spacing them evenly
 * across the whole band would bury the first one under C-13; putting them on
 * the vertical aisle centres makes them wider than the aisles they sit in.
 */
const PASSAGE_LABEL_X = [21, 33.5, 46];

const RoomLabel = ({ room }) => {
  const Icon = ROOM_ICONS[room.icon];
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute flex flex-col items-center justify-center gap-0.5 px-1 text-center"
      style={{
        left: `${room.left}%`,
        top: `${room.top}%`,
        width: `${room.width}%`,
        height: `${room.height}%`,
      }}
    >
      {room.glyph ? <span className="text-[13px] leading-none text-slate-400">{room.glyph}</span> : null}
      {Icon ? <Icon size={13} className="text-slate-400 dark:text-slate-500" /> : null}
      <span className="text-[8px] font-semibold uppercase leading-tight tracking-[0.08em] text-slate-500 dark:text-slate-400">
        {room.label}
      </span>
    </div>
  );
};

const FloorLayoutMap = ({
  cabins,
  selectedCode,
  cart = [],
  matches,
  onSelect,
  selectMode,
  onToggleSelectMode,
  className,
}) => {
  const [zoom, setZoom] = useState(1);
  const byCode = new Map(cabins.map((cabin) => [cabin.code, cabin]));

  return (
    <div className={cn("flex min-h-0 flex-col overflow-hidden", className)}>
      {/* Legend on the left, the tools that only make sense here on the right. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-slate-200 px-3 py-2 dark:border-slate-800">
        <ul className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {STATUS_ORDER.map((status) => (
            <li key={status} className="flex items-center gap-1.5 text-[11.5px] text-slate-600 dark:text-slate-300">
              <i className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_META[status].dot }} />
              {STATUS_META[status].label}
            </li>
          ))}
        </ul>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant={selectMode ? "primary" : "secondary"}
            leftIcon={selectMode ? CheckSquare : Square}
            aria-pressed={selectMode}
            onClick={onToggleSelectMode}
          >
            Select cabins
          </Button>
          <Button size="sm" variant="secondary" leftIcon={RotateCcw} onClick={() => setZoom(1)}>
            Reset view
          </Button>
          <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              aria-label="Zoom out"
              disabled={zoom <= 1}
              onClick={() => setZoom((value) => Math.max(1, value - 0.25))}
              className="rounded-l-lg px-2 py-1.5 text-slate-600 outline-none transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Minus size={14} />
            </button>
            <span className="w-11 text-center font-mono text-[11.5px] tabular-nums text-slate-600 dark:text-slate-300">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              aria-label="Zoom in"
              disabled={zoom >= 2.5}
              onClick={() => setZoom((value) => Math.min(2.5, value + 0.25))}
              className="rounded-r-lg px-2 py-1.5 text-slate-600 outline-none transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Plus size={14} />
            </button>
          </div>
          <Button size="sm" variant="secondary" leftIcon={Maximize2} onClick={() => setZoom(1)}>
            Fit
          </Button>
        </div>
      </div>

      <div className="custom-scrollbar min-h-0 flex-1 overflow-auto p-3">
        <div style={{ width: `${zoom * 100}%`, minWidth: 820 }}>
          <div className="relative" style={{ aspectRatio: PLAN_RATIO }}>
            <FloorPlanArchitecture />

            {SHARED_ROOMS.map((room) => (
              <RoomLabel key={room.id} room={room} />
            ))}

            {PASSAGE_LABEL_X.map((centre) => (
              <span
                key={centre}
                aria-hidden="true"
                className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 text-[8px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500"
                style={{ left: `${centre}%`, top: `${PASSAGE_BAND.top + PASSAGE_BAND.height / 2}%` }}
              >
                Passage
              </span>
            ))}

            {Object.entries(FLOOR_PLAN_ROOMS).map(([code, box]) => {
              const cabin = byCode.get(code);
              if (!cabin) return null;
              return (
                <div
                  key={code}
                  className="absolute p-[3px]"
                  style={{
                    left: `${box.left}%`,
                    top: `${box.top}%`,
                    width: `${box.width}%`,
                    height: `${box.height}%`,
                  }}
                >
                  <CabinTile
                    cabin={cabin}
                    variant="plan"
                    dense={zoom < 1.5}
                    selected={selectedCode === code}
                    inCart={cart.includes(code)}
                    dimmed={!matches(cabin)}
                    onSelect={onSelect}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FloorLayoutMap;
