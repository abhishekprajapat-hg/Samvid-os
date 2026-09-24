import React from "react";
import { FLOOR_PLAN_ROOMS } from "../../../../constants/coworkingFloorPlan";
import { PASSAGE_BAND, PLANTS, SHARED_ROOMS } from "../cabinData";

/*
 * The building itself: slab, walls, doors and fittings, drawn under the cabin
 * tiles.
 *
 * Every wall here is derived from the cabin geometry rather than traced by
 * hand. Cabins that share an x-range are one structural block, so grouping the
 * boxes by their left/right edges reproduces the real partition layout and
 * guarantees the walls land exactly on the tiles - a hand-drawn wall would
 * drift the moment a cabin box was corrected.
 *
 * That grouping also finds the corridors for free: the gaps between blocks are
 * the vertical aisles, which is where each cabin's door has to swing.
 */

const PLAN_W = 1684;
const PLAN_H = 1190;
const X = (percent) => (percent / 100) * PLAN_W;
const Y = (percent) => (percent / 100) * PLAN_H;

/** Cabins sharing an x-range form one block; that block's outline is its walls. */
const BLOCKS = Object.values(
  Object.entries(FLOOR_PLAN_ROOMS).reduce((groups, [code, box]) => {
    const key = `${box.left.toFixed(1)}|${(box.left + box.width).toFixed(1)}`;
    const group = groups[key] || { left: box.left, right: box.left + box.width, top: Infinity, bottom: -Infinity, codes: [] };
    group.top = Math.min(group.top, box.top);
    group.bottom = Math.max(group.bottom, box.top + box.height);
    group.codes.push(code);
    return { ...groups, [key]: group };
  }, {}),
);

/*
 * Which way each cabin's door swings. A block with another block hard against
 * its right edge has no corridor there, so the door goes left. Ties break to
 * the right, which is where the entrance is.
 */
const opensLeft = (block) =>
  BLOCKS.some((other) => other !== block && Math.abs(other.right - block.left) < 0.4);

const DOORS = Object.entries(FLOOR_PLAN_ROOMS).map(([code, box]) => {
  const block = BLOCKS.find((candidate) => box.left >= candidate.left - 0.4 && box.left + box.width <= candidate.right + 0.4);
  const left = block ? opensLeft(block) : false;
  const radius = Math.min(box.height * 0.55, 2.6);
  const hingeY = box.top + box.height - radius * 0.35;
  const hingeX = left ? box.left : box.left + box.width;
  return { code, hingeX, hingeY, radius, left };
});

const Door = ({ hingeX, hingeY, radius, left }) => {
  const tipX = left ? hingeX + radius : hingeX - radius;
  return (
    <g className="stroke-slate-300 dark:stroke-slate-600" strokeWidth={2} fill="none">
      <line x1={X(hingeX)} y1={Y(hingeY)} x2={X(tipX)} y2={Y(hingeY)} />
      <path
        d={`M ${X(tipX)} ${Y(hingeY)} A ${X(radius)} ${X(radius)} 0 0 ${left ? 1 : 0} ${X(hingeX)} ${Y(hingeY) - X(radius)}`}
        className="stroke-slate-200 dark:stroke-slate-700"
      />
    </g>
  );
};

/** Six seats in two rows, as drawn in the waiting area. */
const Seating = ({ room }) => (
  <g className="fill-slate-200/80 stroke-slate-300 dark:fill-slate-700/60 dark:stroke-slate-600" strokeWidth={1.5}>
    {Array.from({ length: 6 }, (_, index) => {
      const column = index % 3;
      const row = Math.floor(index / 3);
      return (
        <rect
          key={index}
          x={X(room.left + 2.4 + column * 5.8)}
          y={Y(room.top + 4.6 + row * 5)}
          width={X(4.4)}
          height={Y(3.2)}
          rx={5}
        />
      );
    })}
  </g>
);

/** Boardroom table with chairs down both long sides. */
const ConferenceTable = ({ room }) => (
  <g className="fill-slate-200/80 stroke-slate-300 dark:fill-slate-700/60 dark:stroke-slate-600" strokeWidth={1.5}>
    <rect
      x={X(room.left + room.width / 2 - 1.9)}
      y={Y(room.top + 3.4)}
      width={X(3.8)}
      height={Y(6.6)}
      rx={6}
    />
    {Array.from({ length: 8 }, (_, index) => (
      <rect
        key={index}
        x={X(room.left + room.width / 2 + (index % 2 ? 2.4 : -3.6))}
        y={Y(room.top + 4.1 + Math.floor(index / 2) * 1.6)}
        width={X(1.2)}
        height={Y(1.1)}
        rx={3}
      />
    ))}
  </g>
);

/** Flight of stairs at the entrance. */
const Stairs = ({ room }) => (
  <g className="stroke-slate-300 dark:stroke-slate-600" strokeWidth={1.5} fill="none">
    <rect x={X(room.left + 1.4)} y={Y(room.top + 3.4)} width={X(5.4)} height={Y(4.6)} />
    {Array.from({ length: 5 }, (_, index) => (
      <line
        key={index}
        x1={X(room.left + 1.4)}
        y1={Y(room.top + 4.2 + index * 0.78)}
        x2={X(room.left + 6.8)}
        y2={Y(room.top + 4.2 + index * 0.78)}
      />
    ))}
  </g>
);

/** Lift car, drawn as the crossed box the drawing uses. */
const LiftCar = ({ room }) => (
  <g className="stroke-slate-300 dark:stroke-slate-600" strokeWidth={1.5} fill="none">
    <rect x={X(room.left + 0.9)} y={Y(room.top + 3.2)} width={X(3.2)} height={Y(3.6)} />
    <line x1={X(room.left + 0.9)} y1={Y(room.top + 3.2)} x2={X(room.left + 4.1)} y2={Y(room.top + 6.8)} />
    <line x1={X(room.left + 4.1)} y1={Y(room.top + 3.2)} x2={X(room.left + 0.9)} y2={Y(room.top + 6.8)} />
  </g>
);

const Plant = ({ left, top }) => (
  <g className="fill-emerald-300/70 dark:fill-emerald-500/40">
    <circle cx={X(left)} cy={Y(top)} r={X(0.75)} />
    <circle cx={X(left + 1.05)} cy={Y(top + 0.35)} r={X(0.62)} />
    <circle cx={X(left + 0.5)} cy={Y(top + 1.2)} r={X(0.55)} />
  </g>
);

const DECOR = { seating: Seating, table: ConferenceTable, stairs: Stairs, lift: LiftCar };

const FloorPlanArchitecture = () => (
  <svg
    viewBox={`0 0 ${PLAN_W} ${PLAN_H}`}
    className="absolute inset-0 h-full w-full"
    aria-hidden="true"
    focusable="false"
  >
    {/* Slab. The chamfer is the angled elevation the drawing cuts across its
        top-right corner, and it is what makes the plan recognisable. */}
    <path
      d={`M ${X(4)} ${Y(3)} L ${X(55)} ${Y(3)} L ${X(96)} ${Y(24)} L ${X(96)} ${Y(96)} L ${X(4)} ${Y(96)} Z`}
      className="fill-white stroke-slate-400 dark:fill-slate-900 dark:stroke-slate-600"
      strokeWidth={7}
      strokeLinejoin="round"
    />

    {/* Circulation, painted before the walls so the walls sit on top of it. */}
    <rect
      x={X(PASSAGE_BAND.left)}
      y={Y(PASSAGE_BAND.top)}
      width={X(PASSAGE_BAND.width)}
      height={Y(PASSAGE_BAND.height)}
      className="fill-slate-100/80 dark:fill-slate-800/50"
    />

    {SHARED_ROOMS.map((room) => (
      <rect
        key={room.id}
        x={X(room.left)}
        y={Y(room.top)}
        width={X(room.width)}
        height={Y(room.height)}
        rx={4}
        className="fill-slate-50 stroke-slate-300 dark:fill-slate-800/40 dark:stroke-slate-700"
        strokeWidth={2.5}
      />
    ))}

    {SHARED_ROOMS.map((room) => {
      const Decor = DECOR[room.decor];
      return Decor ? <Decor key={`${room.id}-decor`} room={room} /> : null;
    })}

    {/* Cabin blocks: one outline per structural run of cabins. */}
    {BLOCKS.map((block) => (
      <rect
        key={`${block.left}-${block.top}`}
        x={X(block.left)}
        y={Y(block.top)}
        width={X(block.right - block.left)}
        height={Y(block.bottom - block.top)}
        className="fill-none stroke-slate-400 dark:stroke-slate-600"
        strokeWidth={4.5}
      />
    ))}

    {DOORS.map((door) => (
      <Door key={door.code} {...door} />
    ))}

    {PLANTS.map((plant, index) => (
      <Plant key={index} {...plant} />
    ))}
  </svg>
);

export default FloorPlanArchitecture;
