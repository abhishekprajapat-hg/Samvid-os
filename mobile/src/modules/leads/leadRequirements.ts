import { getPropertySubtypeConfig } from "../../config/propertyRequirementConfig";

/*
 * A lead's requirements, read into an editable draft and written back - ported
 * from frontend/src/modules/leads/LeadsMatrix.jsx.
 *
 * Why this is its own module: the phone's lead screen used to rebuild the
 * requirements payload from a draft that had no property subtype, no subtype
 * preferences and no coworking terms. The server replaces requirements whole,
 * so every status save from the phone blanked whatever the desk had entered
 * there. Every field web round-trips is round-tripped here, and
 * test/leadRequirements.test.cjs holds it to that.
 */

export const CUSTOM_NUMBER_OPTION_VALUE = "__CUSTOM_NUMBER__";

export type CoworkingDraft = {
  cabins: Array<{ seats: number | string }>;
  workstations: number | string | null;
  depositMonths: number | string | null;
  agreedRent: number | string | null;
  noticePeriodMonths: number | string | null;
  lockInMonths: number | string | null;
};

export type RequirementsDraft = {
  inventoryType: string;
  propertySubtype: string;
  subtypeData: Record<string, unknown>;
  transactionType: string;
  furnishingStatus: string;
  budgetMin: string;
  budgetMax: string;
  areaMin: string;
  areaMax: string;
  areaUnit: string;
  coworking: CoworkingDraft;
  commercial: Record<string, any>;
  residential: { bhkType: string; floor: string; amenities: Record<string, boolean> };
};

const COMMERCIAL_FLAGS = [
  "parkingAvailable", "pantry", "receptionArea", "waitingArea", "cafeteria", "serverRoom",
  "storageRoom", "breakoutArea", "liftAvailable", "powerBackup", "centralAC", "fireSafety",
  "readyToMove", "underConstruction",
];
const COMMERCIAL_COUNTS = ["seats", "cabins", "conferenceRooms", "conferenceSeats"];
const RESIDENTIAL_AMENITIES = [
  "lift", "security", "gym", "swimmingPool", "clubhouse", "powerBackup", "parking",
  "studyRoom", "servantRoom", "modularKitchen", "electricityBackup", "gasPipeline",
];

export const toAmountNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toDraftText = (value: unknown) => (value === null || value === undefined ? "" : String(value).trim());

export const toRequirementTransactionType = (value: unknown) => {
  const normalized = String(value || "").trim().toUpperCase();
  return normalized === "RENT" || normalized === "LEASE" || normalized === "SALE" ? normalized : "";
};

/*
 * Cabins are a list of seat counts, one per cabin, because a client commonly
 * takes a four-seater and a six-seater together. Zero-seat entries are dropped
 * so a half-filled row cannot travel back to the server.
 */
export const toCoworkingDraft = (coworking: any = {}): CoworkingDraft => ({
  cabins: (Array.isArray(coworking?.cabins) ? coworking.cabins : [])
    .map((cabin: any) => ({ seats: Number(cabin?.seats) || 0 }))
    .filter((cabin: { seats: number }) => cabin.seats > 0),
  workstations: coworking?.workstations ?? null,
  depositMonths: coworking?.depositMonths ?? null,
  agreedRent: coworking?.agreedRent ?? null,
  noticePeriodMonths: coworking?.noticePeriodMonths ?? null,
  lockInMonths: coworking?.lockInMonths ?? null,
});

export const toCoworkingPayload = (draft: Partial<CoworkingDraft> = {}) => ({
  cabins: (Array.isArray(draft?.cabins) ? draft.cabins : [])
    .map((cabin) => ({ seats: toAmountNumber(cabin?.seats) }))
    .filter((cabin): cabin is { seats: number } => cabin.seats !== null && cabin.seats > 0),
  workstations: toAmountNumber(draft?.workstations),
  depositMonths: toAmountNumber(draft?.depositMonths),
  agreedRent: toAmountNumber(draft?.agreedRent),
  noticePeriodMonths: toAmountNumber(draft?.noticePeriodMonths),
  lockInMonths: toAmountNumber(draft?.lockInMonths),
});

export const createDefaultLeadRequirementsDraft = (): RequirementsDraft => ({
  inventoryType: "",
  propertySubtype: "",
  subtypeData: {},
  transactionType: "",
  furnishingStatus: "",
  budgetMin: "",
  budgetMax: "",
  areaMin: "",
  areaMax: "",
  areaUnit: "SQ_FT",
  coworking: toCoworkingDraft({}),
  commercial: {
    ...Object.fromEntries(COMMERCIAL_COUNTS.map((key) => [key, ""])),
    ...Object.fromEntries(COMMERCIAL_FLAGS.map((key) => [key, false])),
  },
  residential: {
    bhkType: "",
    floor: "",
    amenities: Object.fromEntries(RESIDENTIAL_AMENITIES.map((key) => [key, false])),
  },
});

export const mapLeadRequirementsToDraft = (requirements: any = {}): RequirementsDraft => {
  const base = createDefaultLeadRequirementsDraft();
  const commercial = requirements?.commercial || {};
  const residential = requirements?.residential || {};
  const amenities = residential?.amenities || {};
  return {
    inventoryType: toDraftText(requirements?.inventoryType).toUpperCase(),
    propertySubtype: toDraftText(requirements?.propertySubtype).toUpperCase(),
    subtypeData:
      requirements?.subtypeData && typeof requirements.subtypeData === "object" ? { ...requirements.subtypeData } : {},
    transactionType: toDraftText(requirements?.transactionType).toUpperCase(),
    furnishingStatus: toDraftText(requirements?.furnishingStatus).toUpperCase(),
    budgetMin: toDraftText(requirements?.budgetMin),
    budgetMax: toDraftText(requirements?.budgetMax),
    areaMin: "",
    areaMax: "",
    areaUnit: base.areaUnit,
    coworking: toCoworkingDraft(requirements?.coworking),
    commercial: {
      ...Object.fromEntries(COMMERCIAL_COUNTS.map((key) => [key, toDraftText(commercial?.[key])])),
      ...Object.fromEntries(COMMERCIAL_FLAGS.map((key) => [key, Boolean(commercial?.[key])])),
    },
    residential: {
      bhkType: toDraftText(residential?.bhkType).toUpperCase(),
      floor: toDraftText(residential?.floor),
      amenities: Object.fromEntries(RESIDENTIAL_AMENITIES.map((key) => [key, Boolean(amenities?.[key])])),
    },
  };
};

export const sanitizeRequirementSubtypeData = (subtypeData: Record<string, unknown> = {}) => {
  if (!subtypeData || typeof subtypeData !== "object") return {};
  return Object.fromEntries(Object.entries(subtypeData).filter(([, value]) => value !== CUSTOM_NUMBER_OPTION_VALUE));
};

export const buildLeadRequirementsPayloadFromDraft = (draft: Partial<RequirementsDraft> = {}) => {
  const propertySubtype = String(draft?.propertySubtype || "").trim().toUpperCase();
  const payload: Record<string, unknown> = {
    inventoryType: String(draft?.inventoryType || "").trim().toUpperCase(),
    propertySubtype,
    subtypeData: sanitizeRequirementSubtypeData(draft?.subtypeData as Record<string, unknown>),
    transactionType: toRequirementTransactionType(draft?.transactionType),
    furnishingStatus: String(draft?.furnishingStatus || "").trim().toUpperCase(),
    budgetMin: toAmountNumber(draft?.budgetMin),
    budgetMax: toAmountNumber(draft?.budgetMax),
    areaMin: null,
    areaMax: null,
    areaUnit: null,
  };

  if (payload.inventoryType === "COWORKING") {
    payload.coworking = toCoworkingPayload(draft?.coworking);
    return payload;
  }

  /* With a subtype, its preferences are the requirement; the legacy blocks
     are only written for a lead that has none. */
  if (propertySubtype) return payload;

  payload.commercial = {
    ...Object.fromEntries(COMMERCIAL_COUNTS.map((key) => [key, toAmountNumber(draft?.commercial?.[key])])),
    ...Object.fromEntries(COMMERCIAL_FLAGS.map((key) => [key, Boolean(draft?.commercial?.[key])])),
  };
  payload.residential = {
    bhkType: String(draft?.residential?.bhkType || "").trim().toUpperCase(),
    floor: toAmountNumber(draft?.residential?.floor),
    amenities: Object.fromEntries(RESIDENTIAL_AMENITIES.map((key) => [key, Boolean(draft?.residential?.amenities?.[key])])),
  };
  return payload;
};

export const validateLeadRequirementDraft = ({
  inventoryType,
  propertySubtype,
  budgetMin,
  budgetMax,
  subtypeData,
}: Partial<RequirementsDraft> = {}) => {
  const parsedMin = toAmountNumber(budgetMin);
  const parsedMax = toAmountNumber(budgetMax);
  const isPlot = String(propertySubtype || "").trim().toUpperCase() === "PLOT";
  const checks: Array<[string, number | null]> = [
    [isPlot ? "Budget Range minimum" : "Budget Min", parsedMin],
    [isPlot ? "Budget Range maximum" : "Budget Max", parsedMax],
  ];
  for (const [label, value] of checks) {
    if (value !== null && value < 0) return `${label} cannot be negative`;
  }
  if (parsedMin !== null && parsedMax !== null && parsedMin > parsedMax) {
    return isPlot ? "Budget Range minimum cannot be greater than maximum" : "Budget Min cannot be greater than Budget Max";
  }
  const config = getPropertySubtypeConfig(String(inventoryType || ""), String(propertySubtype || ""));
  if (!config) return "";
  for (const field of config.fields || []) {
    const value = (subtypeData as Record<string, unknown> | undefined)?.[field.key];
    if (field.type === "number") {
      const numeric = toAmountNumber(value);
      if (numeric !== null && numeric < 0) return `${field.label} cannot be negative`;
    }
    if (field.required && String(value ?? "").trim() === "") return `${field.label} is required`;
  }
  return "";
};

/* Web's plot rule: length × width fills the area, rounded to two places. */
export const withSubtypeField = (subtypeData: Record<string, unknown>, key: string, value: unknown) => {
  const next: Record<string, unknown> = { ...(subtypeData || {}), [key]: value };
  if (key === "plotLength" || key === "plotWidth") {
    /* Web's toPositivePlotMeasure, kept exact: Number("") is 0, so a blank
       side counts as zero once the other side is typed. */
    const measure = (raw: unknown) => {
      const parsed = Number(raw);
      return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
    };
    const length = measure(next.plotLength);
    const width = measure(next.plotWidth);
    if (length !== null && width !== null) {
      const area = length * width;
      next.plotArea = Number.isInteger(area) ? String(area) : String(Number(area.toFixed(2)));
    }
  }
  return next;
};

/* Web's toPreferredLocationsList: split on commas or lines, trim, dedupe
   case-insensitively, 120 characters each, twenty at most. */
export const toPreferredLocationsList = (value: unknown): string[] => {
  const source = Array.isArray(value) ? value : String(value || "").split(/[\n,]+/);
  const seen = new Set<string>();
  return source
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .map((item) => item.slice(0, 120))
    .filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 20);
};
