/*
 * Cabin catalogue for the booking board, transcribed from the supplied plan
 * (Office_on_Rent_Renamed_Cabins_Reversed): 65 cabins across four wings, plus
 * the shared rooms that give the map its orientation.
 *
 * This module contains the shared cabin labels, capacities, wing grouping, and
 * booking statuses used across the coworking experience.
 */

/** Seats printed under each cabin label on the plan. */
export const CABIN_SEATS = {
  A1: 4, A2: 4, A3: 4, A4: 2, A5: 6, A6: 4, A7: 6, A8: 4, A9: 6,
  A10: 6, A11: 6, A12: 4, A13: 8, A14: 8, A15: 4, A16: 4, A17: 4, A18: 4,
  B1: 4, B2: 4, B3: 4, B4: 4, B5: 4, B6: 4, B7: 10, B8: 4, B9: 4, B10: 4, B11: 4,
  B12: 6, B13: 6, B14: 6, B15: 4, B16: 8, B17: 8, B18: 4, B19: 4, B20: 4, B21: 4, B22: 4,
  C1: 4, C2: 4, C3: 4, C4: 4, C5: 4, C6: 6, C7: 4, C8: 4, C9: 4, C10: 4, C11: 4, C12: 4,
  C13: 6, C14: 4, C15: 4, C16: 5, C17: 4, C18: 8, C19: 4, C20: 4, C21: 4, C22: 4, C23: 4,
  // D1/D2 sit beside the conference room and carry no seat label on the plan.
  D1: 4, D2: 4,
};

export const WINGS = [
  { id: "A", label: "Wing A", hint: "Entrance side" },
  { id: "B", label: "Wing B", hint: "Centre" },
  { id: "C", label: "Wing C", hint: "Temple side" },
  { id: "D", label: "Wing D", hint: "By conference" },
];

/*
 * Shared rooms, laid out to the drawing. The cabin columns occupy left
 * 7.8-53.8% and D sits at 61.9%, so everything right of ~54% is circulation and
 * amenity. These are drawn, labelled and never selectable - they are what tells
 * a reader which way up the floor is.
 */
export const SHARED_ROOMS = [
  { id: "temple", label: "Temple / Pooja", glyph: "ॐ", left: 7.8, top: 3.4, width: 15.5, height: 4.2 },
  { id: "machine", label: "Machine Room", icon: "cog", left: 57, top: 13, width: 17, height: 10 },
  { id: "waiting", label: "Waiting Area", decor: "seating", left: 55, top: 26, width: 22, height: 15 },
  { id: "entrance", label: "Entrance", decor: "stairs", left: 60, top: 44, width: 14, height: 9 },
  { id: "lift", label: "Lift", decor: "lift", left: 55, top: 55, width: 5, height: 8 },
  { id: "conference", label: "Conference Room", decor: "table", left: 62, top: 55, width: 12, height: 12 },
  { id: "wash", label: "Wash Area", icon: "wash", left: 76, top: 55, width: 9, height: 10 },
  { id: "canteen", label: "Canteen", icon: "canteen", left: 76, top: 69, width: 13, height: 14 },
  { id: "smoke-a", label: "Smoking Zone", icon: "smoke", left: 28, top: 90.5, width: 13, height: 4 },
  { id: "smoke-b", label: "Smoking Zone", icon: "smoke", left: 44, top: 90.5, width: 13, height: 4 },
];

/** Potted greenery, as on the drawing. Purely decorative. */
export const PLANTS = [
  { left: 54.6, top: 34.5 }, { left: 54.6, top: 45.5 }, { left: 57.5, top: 66 },
  { left: 74.5, top: 62 }, { left: 74.5, top: 84 }, { left: 44.6, top: 86.5 },
  { left: 26.5, top: 86.5 }, { left: 90, top: 88 },
];

/*
 * The horizontal passage that splits every cabin column. Measured off the
 * geometry: exactly one cabin box crosses 48-52%, so the band is real, not
 * decorative - it is what tells you the upper and lower blocks apart.
 */
export const PASSAGE_BAND = { left: 7.8, top: 47.8, width: 46.0, height: 5.0 };

/*
 * Status colours, read from the landlord's side of the desk rather than the
 * guest's: red is an empty cabin earning nothing, green is one that is let.
 * That inverts the usual "green means available" ticketing convention, so the
 * legend sits above both views and every status is spelled out next to its dot.
 *
 * Blocked moved to violet when vacant took red. Two different reds - one for
 * "nobody in it" and one for "deliberately off the market" - would be the one
 * pair on this board a manager could actually act on wrongly.
 */
export const STATUS_META = {
  VACANT: {
    label: "Vacant",
    short: "Vacant",
    dot: "#b83232",
    tile: "border-rose-200 bg-rose-50 text-rose-950 hover:border-rose-400 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100",
    badge: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/30 dark:bg-rose-500/10 dark:text-rose-300",
  },
  BOOKED: {
    label: "Booked",
    short: "Booked",
    dot: "#0d8055",
    tile: "border-emerald-200 bg-emerald-50/70 text-emerald-950 hover:border-emerald-400 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100",
    badge: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300",
  },
  RESERVED: {
    label: "Reserved",
    short: "Held",
    dot: "#a26f06",
    tile: "border-amber-200 bg-amber-50 text-amber-950 hover:border-amber-400 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100",
    badge: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-300",
  },
  BLOCKED: {
    label: "Blocked",
    short: "Blocked",
    dot: "#6d28d9",
    tile: "border-violet-200 bg-violet-50 text-violet-950 hover:border-violet-400 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-100",
    badge: "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-400/30 dark:bg-violet-500/10 dark:text-violet-300",
  },
  MAINTENANCE: {
    label: "Maintenance",
    short: "Upkeep",
    dot: "#6c7789",
    tile: "border-slate-200 bg-slate-100 text-slate-600 hover:border-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300",
    badge: "border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300",
  },
};

export const STATUS_ORDER = ["VACANT", "BOOKED", "RESERVED", "BLOCKED", "MAINTENANCE"];
