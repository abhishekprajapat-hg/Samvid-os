import { brand } from "../../theme/brand";
import type { Lead } from "../../types";

/*
 * The vocabulary the pipeline comps speak, and the translation to what the
 * Lead model actually stores.
 *
 * The comps draw six stages; the backend enum has seventeen statuses. Rather
 * than shrink the enum - the web app, the filters and the status-request flow
 * all use the long list - each comp stage owns a set of them, and a seventh
 * "Other" stage catches the four that no comp stage claims so no lead can
 * become unreachable by browsing.
 */

export type StageKey = "NEW" | "CONTACTED" | "INTERESTED" | "VISIT" | "REQUESTED" | "CLOSED" | "OTHER";

export type Stage = { key: StageKey; label: string; statuses: string[] };

export const STAGES: Stage[] = [
  { key: "NEW", label: "New", statuses: ["NEW"] },
  {
    key: "CONTACTED",
    label: "Contacted",
    statuses: ["CONTACTED", "FOLLOW_UP_1", "FOLLOW_UP_2", "FOLLOW_UP_3", "NOT_PICKING_CALLS"],
  },
  { key: "INTERESTED", label: "Interested", statuses: ["INTERESTED"] },
  { key: "VISIT", label: "Visit", statuses: ["SITE_VISIT_SCHEDULED", "SITE_VISIT", "SITE_VISIT_OVERDUE"] },
  { key: "REQUESTED", label: "Requested", statuses: ["REQUESTED"] },
  { key: "CLOSED", label: "Closed", statuses: ["CLOSED", "LOST"] },
  { key: "OTHER", label: "Other", statuses: ["MISSING_IN_ACTION", "INVALID", "OWNER", "BROKER"] },
];

/** The six the comp's stepper draws, in order. "Other" is browsing only. */
export const STEPPER_STAGES = STAGES.filter((stage) => stage.key !== "OTHER");

const STATUS_TO_STAGE = new Map<string, StageKey>();
for (const stage of STAGES) for (const status of stage.statuses) STATUS_TO_STAGE.set(status, stage.key);

export const stageOf = (lead: Pick<Lead, "status">): StageKey =>
  STATUS_TO_STAGE.get(String(lead.status || "").toUpperCase()) || "NEW";

export const stageIndexOf = (lead: Pick<Lead, "status">): number =>
  STEPPER_STAGES.findIndex((stage) => stage.key === stageOf(lead));

/** The status a stage writes when the stepper moves a lead onto it. */
export const primaryStatusOf = (key: StageKey): string =>
  (STAGES.find((stage) => stage.key === key) || STAGES[0]).statuses[0];

/* ------------------------------------------------------- temperature -- */

export type Temperature = "" | "COLD" | "WARM" | "HOT";

/*
 * `temperature` is the three-step field; `hotClient` is the boolean that came
 * first and that the web flame toggle still writes. "" means nobody has said
 * yet, which the comp draws as a blue "New" badge - so it is a state worth
 * keeping rather than defaulting away.
 */
export const temperatureOf = (lead: Pick<Lead, "temperature" | "hotClient">): Temperature => {
  const raw = String(lead.temperature || "").toUpperCase();
  if (raw === "COLD" || raw === "WARM" || raw === "HOT") return raw;
  return lead.hotClient ? "HOT" : "";
};

export type Tone = { label: string; bg: string; fg: string };

export const temperatureTone = (value: Temperature): Tone => {
  const b = brand;
  switch (value) {
    case "HOT":
      return { label: "Hot", bg: b.alertTint, fg: "#e02d2d" };
    case "WARM":
      return { label: "Warm", bg: b.warnTint, fg: "#d08303" };
    case "COLD":
      return { label: "Cold", bg: "#e7effa", fg: "#3f6fb5" };
    default:
      return { label: "New", bg: "#e7effa", fg: "#3f6fb5" };
  }
};

export const TEMPERATURE_CHOICES: Array<{ key: Exclude<Temperature, "">; label: string; icon: string }> = [
  { key: "COLD", label: "Cold", icon: "snow-outline" },
  { key: "WARM", label: "Warm", icon: "sunny-outline" },
  { key: "HOT", label: "Hot", icon: "flame" },
];

/* ------------------------------------------------------------ source -- */

/*
 * `sourceChannel` is where the enquiry came from; `source` is how it reached
 * the CRM (the Meta webhook, or somebody typing it in). A lead from before the
 * channel field falls back to the latter so the pill is never blank.
 */
const CHANNEL_LABELS: Record<string, string> = {
  META: "Meta Ads",
  JUSTDIAL: "JustDial",
  OLX: "OLX",
  MYBRICKS: "MyBricks",
  "99ACRES": "99acres",
  WEBSITE: "Website",
  REFERENCE: "Referral",
  BROKER: "Broker",
  DIRECT_CALL: "Direct call",
  DIRECT_VISIT: "Walk-in",
};

export const SOURCE_CHANNELS = Object.keys(CHANNEL_LABELS);

export const sourceLabel = (lead: Pick<Lead, "sourceChannel" | "source">): string => {
  const channel = String(lead.sourceChannel || "").toUpperCase();
  if (CHANNEL_LABELS[channel]) return CHANNEL_LABELS[channel];
  return String(lead.source || "").toUpperCase() === "META" ? "Meta Ads" : "Manual";
};

export const channelLabel = (channel: string): string =>
  CHANNEL_LABELS[String(channel || "").toUpperCase()] || "Manual";

export const sourceTone = (lead: Pick<Lead, "sourceChannel" | "source">): Tone & { icon: string } => {
  const channel = String(lead.sourceChannel || "").toUpperCase()
    || (String(lead.source || "").toUpperCase() === "META" ? "META" : "");
  switch (channel) {
    case "META":
      return { label: "Meta Ads", bg: "#e4eeff", fg: "#2f6fe4", icon: "logo-facebook" };
    case "REFERENCE":
      return { label: "Referral", bg: "#efe9fd", fg: "#6d4fc7", icon: "person-outline" };
    case "BROKER":
      return { label: "Broker", bg: "#efe9fd", fg: "#6d4fc7", icon: "briefcase-outline" };
    case "WEBSITE":
    case "JUSTDIAL":
    case "OLX":
    case "MYBRICKS":
    case "99ACRES":
      return { label: channelLabel(channel), bg: brand.tint, fg: brand.deep, icon: "globe-outline" };
    case "DIRECT_CALL":
      return { label: "Direct call", bg: brand.tint, fg: brand.deep, icon: "call-outline" };
    case "DIRECT_VISIT":
      return { label: "Walk-in", bg: brand.tint, fg: brand.deep, icon: "walk-outline" };
    default:
      return { label: "Manual", bg: brand.neutralBadge, fg: brand.textSecondary, icon: "create-outline" };
  }
};

/* -------------------------------------------------------- formatting -- */

const RUPEE = "₹";

/** 60000 -> "60K", 7500000 -> "75L", 120000000 -> "12Cr" - Indian steps. */
export const compactAmount = (value?: number | null): string => {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount <= 0) return "";
  if (amount >= 1e7) return `${RUPEE}${trimZero(amount / 1e7)}Cr`;
  if (amount >= 1e5) return `${RUPEE}${trimZero(amount / 1e5)}L`;
  if (amount >= 1000) return `${RUPEE}${trimZero(amount / 1000)}K`;
  return `${RUPEE}${Math.round(amount)}`;
};

const trimZero = (value: number) => {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
};

/*
 * The lead card draws a range tight ("₹60K–₹80K/month") and Lead Details
 * draws it spaced ("₹60K – ₹80K/month"). Both are what the comps show, so
 * the dash is a parameter rather than a choice between them.
 */
const dashOf = (spaced?: boolean) => (spaced ? " – " : "–");

/** "₹60K–₹80K/month" for a rental, "₹75L" for a sale. */
export const budgetLabel = (lead: Pick<Lead, "requirements">, spaced = false): string => {
  const req = lead.requirements || {};
  const min = compactAmount(req.budgetMin);
  const max = compactAmount(req.budgetMax);
  if (!min && !max) return "";
  const span = min && max ? (min === max ? min : `${min}${dashOf(spaced)}${max}`) : min || max;
  const recurring = ["RENT", "LEASE"].includes(String(req.transactionType || "").toUpperCase());
  return recurring ? `${span}/month` : span;
};

export const areaLabel = (lead: Pick<Lead, "requirements">, spaced = false): string => {
  const req = lead.requirements || {};
  const unit = String(req.areaUnit || "SQ_FT") === "SQ_M" ? "sq m" : "sq ft";
  const min = Number(req.areaMin || 0);
  const max = Number(req.areaMax || 0);
  if (!min && !max) return "";
  const fmt = (value: number) => value.toLocaleString("en-IN");
  const span = min && max
    ? (min === max ? fmt(min) : `${fmt(min)}${dashOf(spaced)}${fmt(max)}`)
    : fmt(min || max);
  return `${span} ${unit}`;
};

/*
 * A coworking enquiry is counted in seats, not square feet - the comp's second
 * card reads "Coworking · 12 seats". `requirements.commercial.seats` is where
 * that number already lives.
 */
export const seatsLabel = (lead: Pick<Lead, "requirements">): string => {
  const seats = Number(lead.requirements?.commercial?.seats || 0);
  if (!seats) return "";
  return `${seats} ${seats === 1 ? "seat" : "seats"}`;
};

const prettify = (value?: string) =>
  String(value || "")
    .replaceAll("_", " ")
    .trim()
    .toLowerCase()
    .replace(/(^|\s)\S/g, (ch) => ch.toUpperCase());

/*
 * "Commercial Office", the way the comps write it - the inventory type and the
 * subtype together, minus the repetition when they are the same word.
 */
export const propertyLabel = (lead: Pick<Lead, "requirements">): string => {
  const req = lead.requirements || {};
  const kind = prettify(req.inventoryType);
  const subtype = prettify(req.propertySubtype);
  if (!subtype) return kind;
  if (!kind || subtype === kind) return subtype;
  /* The comp writes "Coworking", not "Commercial Coworking" - it reads as its
     own category, which is how the inventory type list treats it too. */
  if (subtype === "Coworking") return subtype;
  return `${kind} ${subtype}`;
};

/** "Commercial Office · 1,000–1,500 sq ft", or seats for a coworking enquiry. */
export const propertyLine = (lead: Pick<Lead, "requirements">, spaced = false): string => {
  const size = seatsLabel(lead) || areaLabel(lead, spaced);
  return [propertyLabel(lead), size].filter(Boolean).join(" · ");
};

export const transactionLabel = (lead: Pick<Lead, "requirements">): string => {
  const value = String(lead.requirements?.transactionType || "").toUpperCase();
  if (value === "RENT") return "For Rent";
  if (value === "LEASE") return "For Lease";
  if (value === "SALE") return "For Sale";
  return "";
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const clockLabel = (value?: string | null): string => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date
    .toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true })
    .toUpperCase();
};

/** "Today 2:30 PM", "Tomorrow", "25 Sep" - the comp's follow-up line. */
export const followUpLabel = (value?: string | null): string => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const startOfDay = (input: Date) => new Date(input.getFullYear(), input.getMonth(), input.getDate()).getTime();
  const days = Math.round((startOfDay(date) - startOfDay(new Date())) / 86400000);

  if (days === 0) return `Today ${clockLabel(value)}`;
  if (days === 1) return "Tomorrow";
  if (days === -1) return `Yesterday ${clockLabel(value)}`;
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
};

export const isOverdue = (value?: string | null): boolean => {
  if (!value) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.getTime() < Date.now();
};

/** "+91 98765 43210" - how the comps print a ten-digit Indian number. */
export const displayPhone = (value?: string): string => {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  if (digits.length === 12 && digits.startsWith("91")) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  return `+${digits}`;
};

export const initialsOf = (name?: string): string =>
  String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "?";

/*
 * The comp gives each assignee a different avatar wash - lavender, blue, pink.
 * Deriving it from the name keeps one person the same colour everywhere
 * without needing a colour on the user record.
 */
const AVATAR_TONES = [
  { bg: "#e8e2fb", fg: "#5b45a8" },
  { bg: "#dbe7fb", fg: "#2f60a8" },
  { bg: "#fbe0ec", fg: "#a83f6d" },
  { bg: "#fdeacd", fg: "#9a6612" },
  { bg: "#d8efe6", fg: "#1f7a58" },
];

export const avatarTone = (name?: string) => {
  const key = String(name || "").trim();
  let hash = 0;
  for (let index = 0; index < key.length; index += 1) hash = (hash * 31 + key.charCodeAt(index)) >>> 0;
  return AVATAR_TONES[hash % AVATAR_TONES.length];
};

export const assigneeOf = (lead: Lead): { id: string; name: string; photo: string } => {
  const value = lead.assignedTo;
  if (value && typeof value === "object") {
    const row = value as { _id?: unknown; name?: unknown; profileImageUrl?: unknown };
    return { id: String(row._id || ""), name: String(row.name || ""), photo: String(row.profileImageUrl || "") };
  }
  return { id: "", name: "", photo: "" };
};
