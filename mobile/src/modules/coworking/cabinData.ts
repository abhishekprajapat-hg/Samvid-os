/*
 * The cabin catalogue for the booking board - a port of
 * frontend/src/modules/coworking/booking/cabinData.js.
 *
 * 65 cabins across four wings, transcribed from the supplied plan, plus the
 * shared rooms that give the floor plan its orientation. The data literals are
 * web's, unchanged, so a diff against that file is the drift check.
 */

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

export const WINGS = [
  { id: "A", label: "Wing A", hint: "Entrance side" },
  { id: "B", label: "Wing B", hint: "Centre" },
  { id: "C", label: "Wing C", hint: "Temple side" },
  { id: "D", label: "Wing D", hint: "By conference" },
] as const;

export type SharedRoom = {
  id: string;
  label: string;
  left: number;
  top: number;
  width: number;
  height: number;
  glyph?: string;
  icon?: "cog" | "wash" | "canteen" | "smoke";
  decor?: "seating" | "stairs" | "lift" | "table";
};

export const SHARED_ROOMS: SharedRoom[] = [
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

/** The horizontal passage that splits every cabin column. */
export const PASSAGE_BAND = { left: 7.8, top: 47.8, width: 46.0, height: 5.0 };

export type CabinStatus = "VACANT" | "BOOKED" | "RESERVED" | "BLOCKED" | "MAINTENANCE";

export const STATUS_ORDER: CabinStatus[] = ["VACANT", "BOOKED", "RESERVED", "BLOCKED", "MAINTENANCE"];

/*
 * Status colours, read from the landlord's side of the desk: red is an empty
 * cabin earning nothing, green is one that is let. That inverts the usual
 * "green means available" convention, so the legend is always on screen.
 *
 * Each status carries a light and a dark tile, the RN counterpart of web's
 * Tailwind `tile` / `badge` classes (rose / emerald / amber / violet / slate).
 */
export type StatusTone = { bg: string; border: string; ink: string };

export const STATUS_META: Record<
  CabinStatus,
  { label: string; short: string; dot: string; light: StatusTone; dark: StatusTone }
> = {
  VACANT: {
    label: "Vacant",
    short: "Vacant",
    dot: "#b83232",
    light: { bg: "#fff1f2", border: "#fecdd3", ink: "#881337" },
    dark: { bg: "rgba(244, 63, 94, 0.10)", border: "rgba(244, 63, 94, 0.30)", ink: "#ffe4e6" },
  },
  BOOKED: {
    label: "Booked",
    short: "Booked",
    dot: "#0d8055",
    light: { bg: "#ecfdf5", border: "#a7f3d0", ink: "#064e3b" },
    dark: { bg: "rgba(16, 185, 129, 0.10)", border: "rgba(16, 185, 129, 0.30)", ink: "#d1fae5" },
  },
  RESERVED: {
    label: "Reserved",
    short: "Held",
    dot: "#a26f06",
    light: { bg: "#fffbeb", border: "#fde68a", ink: "#78350f" },
    dark: { bg: "rgba(245, 158, 11, 0.10)", border: "rgba(245, 158, 11, 0.30)", ink: "#fef3c7" },
  },
  BLOCKED: {
    label: "Blocked",
    short: "Blocked",
    dot: "#6d28d9",
    light: { bg: "#f5f3ff", border: "#ddd6fe", ink: "#4c1d95" },
    dark: { bg: "rgba(139, 92, 246, 0.10)", border: "rgba(139, 92, 246, 0.30)", ink: "#ede9fe" },
  },
  MAINTENANCE: {
    label: "Maintenance",
    short: "Upkeep",
    dot: "#6c7789",
    light: { bg: "#f1f5f9", border: "#e2e8f0", ink: "#475569" },
    dark: { bg: "#1e293b", border: "#475569", ink: "#cbd5e1" },
  },
};

export const statusTone = (status: CabinStatus, scheme: "light" | "dark") =>
  (STATUS_META[status] || STATUS_META.VACANT)[scheme];

/** "C12" -> "C-12", the label form the board prints. */
export const cabinLabel = (code: string) => String(code || "").replace(/^([A-D])/, "$1-");

export const SEAT_BANDS = [
  { id: "small", label: "Up to 4", test: (seats: number) => seats <= 4 },
  { id: "medium", label: "5 to 6", test: (seats: number) => seats >= 5 && seats <= 6 },
  { id: "large", label: "8+", test: (seats: number) => seats >= 8 },
];
