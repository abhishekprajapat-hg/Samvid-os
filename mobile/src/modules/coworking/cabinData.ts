import { themePalette } from "../../theme/themedStyles";

/*
 * Cabin status model for the booking board, ported from
 * frontend/src/modules/coworking/booking/cabinData.js.
 *
 * The Tailwind class strings there become RN style objects here; the colours,
 * labels and ordering are unchanged, and that matters more than usual:
 *
 *   Status colours are read from the landlord's side of the desk rather than
 *   the guest's: RED is an empty cabin earning nothing, GREEN is one that is
 *   let. That inverts the usual "green means available" ticketing convention,
 *   so the legend sits above the board and every status is spelled out next to
 *   its dot.
 *
 * Getting this backwards on mobile would have a manager reading the board
 * inside out, so the legend is not optional here either.
 *
 * The floor-plan geometry (SHARED_ROOMS, PASSAGE_BAND, per-cabin coordinates)
 * is deliberately not ported - see BookingBoardScreen for why a phone gets a
 * wing-grouped grid instead of a scaled drawing.
 */

export type CabinStatus = "VACANT" | "BOOKED" | "RESERVED" | "BLOCKED" | "MAINTENANCE";

export type StatusMeta = {
  label: string;
  short: string;
  dot: string;
  tileBackground: string;
  tileBorder: string;
  tileText: string;
};

/*
 * Built per call rather than held as a constant. themePalette resolves against
 * whichever scheme is active when it is read, and a module-level table reads it
 * once at import - while the scheme is still the default light - which left the
 * whole booking board in light colours after a switch to dark.
 */
export const statusMetaTable = (): Record<CabinStatus, StatusMeta> => ({
  VACANT: {
    label: "Vacant",
    short: "Vacant",
    dot: themePalette.rose[600],
    tileBackground: themePalette.rose[50],
    tileBorder: themePalette.rose[200],
    tileText: themePalette.rose[900],
  },
  BOOKED: {
    label: "Booked",
    short: "Booked",
    dot: themePalette.emerald[600],
    tileBackground: themePalette.emerald[50],
    tileBorder: themePalette.emerald[200],
    tileText: themePalette.emerald[900],
  },
  RESERVED: {
    label: "Reserved",
    short: "Held",
    dot: themePalette.amber[600],
    tileBackground: themePalette.amber[50],
    tileBorder: themePalette.amber[200],
    tileText: themePalette.amber[900],
  },
  BLOCKED: {
    // Violet, not a second red: two different reds - "nobody in it" and
    // "deliberately off the market" - would be the one pair on this board a
    // manager could actually act on wrongly.
    label: "Blocked",
    short: "Blocked",
    dot: themePalette.violet[700],
    tileBackground: themePalette.violet[50],
    tileBorder: themePalette.violet[200],
    tileText: themePalette.violet[900],
  },
  MAINTENANCE: {
    label: "Maintenance",
    short: "Upkeep",
    dot: themePalette.slate[500],
    tileBackground: themePalette.slate[100],
    tileBorder: themePalette.slate[200],
    tileText: themePalette.slate[600],
  },
});

export const STATUS_ORDER: CabinStatus[] = [
  "VACANT",
  "BOOKED",
  "RESERVED",
  "BLOCKED",
  "MAINTENANCE",
];

export const WINGS = [
  { id: "A", label: "Wing A", hint: "Entrance side" },
  { id: "B", label: "Wing B", hint: "Centre" },
  { id: "C", label: "Wing C", hint: "Temple side" },
  { id: "D", label: "Wing D", hint: "By conference" },
];

/** Seats printed under each cabin label on the plan. */
export const CABIN_SEATS: Record<string, number> = {
  A1: 4, A2: 4, A3: 4, A4: 2, A5: 6, A6: 4, A7: 6, A8: 4, A9: 6,
  A10: 6, A11: 6, A12: 4, A13: 8, A14: 8, A15: 4, A16: 4, A17: 4, A18: 4,
  B1: 4, B2: 4, B3: 4, B4: 4, B5: 4, B6: 4, B7: 10, B8: 4, B9: 4, B10: 4, B11: 4,
  B12: 6, B13: 6, B14: 6, B15: 4, B16: 8, B17: 8, B18: 4, B19: 4, B20: 4, B21: 4, B22: 4,
  C1: 4, C2: 4, C3: 4, C4: 4, C5: 4, C6: 6, C7: 4, C8: 4, C9: 4, C10: 4, C11: 4, C12: 4,
  C13: 6, C14: 4, C15: 4, C16: 5, C17: 4, C18: 8, C19: 4, C20: 4, C21: 4, C22: 4, C23: 4,
  // D1/D2 sit beside the conference room and carry no seat label on the plan.
  D1: 4, D2: 4,
};

export const statusMetaFor = (status?: string): StatusMeta => {
  const table = statusMetaTable();
  return table[String(status || "").toUpperCase() as CabinStatus] || table.MAINTENANCE;
};

/** The wing a cabin code belongs to - "B12" → "B". */
export const wingOf = (code?: string) => String(code || "").trim().charAt(0).toUpperCase();

export const seatsFor = (code?: string, fallback?: number | null) => {
  const known = CABIN_SEATS[String(code || "").toUpperCase()];
  if (Number.isFinite(known)) return known;
  return Number.isFinite(Number(fallback)) ? Number(fallback) : 0;
};

/** Counts per status, for the board summary. */
export const summariseByStatus = (cabins: Array<{ status?: string }>) => {
  const counts: Record<string, number> = {};
  for (const status of STATUS_ORDER) counts[status] = 0;
  for (const cabin of cabins) {
    const key = String(cabin?.status || "").toUpperCase();
    if (key in counts) counts[key] += 1;
  }
  return counts;
};
