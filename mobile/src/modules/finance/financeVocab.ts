import { brand } from "../../theme/brand";
import type { GlyphName } from "../../components/ui/Glyph";

/*
 * How the Finance comps write money, dates and states.
 *
 * The amount helpers are deliberately two: the hero and the tiles round to
 * lakhs ("₹8.42 L") because that is what the comp draws, while a single
 * transaction prints in full ("+₹75,000") because rounding a receipt would be
 * wrong.
 */

const RUPEE = "₹";
/* The comps use a true minus, not a hyphen, on a debit. */
const MINUS = "−";

/** "₹8.42 L", "₹1.20 Cr", "₹85,000" - the comp's tile format. */
export const compactMoney = (value?: number | null): string => {
  const amount = Math.abs(Number(value) || 0);
  const sign = Number(value) < 0 ? MINUS : "";
  if (amount >= 1e7) return `${sign}${RUPEE}${(amount / 1e7).toFixed(2)} Cr`;
  if (amount >= 1e5) return `${sign}${RUPEE}${(amount / 1e5).toFixed(2)} L`;
  return `${sign}${RUPEE}${Math.round(amount).toLocaleString("en-IN")}`;
};

/** "₹75,000" - every rupee, for a single row. */
export const exactMoney = (value?: number | null): string =>
  `${RUPEE}${Math.round(Math.abs(Number(value) || 0)).toLocaleString("en-IN")}`;

/** "+₹75,000" / "−₹18,500", as the transaction rows read. */
export const signedMoney = (value?: number | null): string => {
  const amount = Number(value) || 0;
  return `${amount < 0 ? MINUS : "+"}${exactMoney(amount)}`;
};

/** "₹3 L" for a chart axis. */
export const axisMoney = (value: number): string => {
  if (value >= 1e7) return `${RUPEE}${Math.round(value / 1e7)} Cr`;
  if (value >= 1e5) return `${RUPEE}${Math.round(value / 1e5)} L`;
  if (value >= 1000) return `${RUPEE}${Math.round(value / 1000)}K`;
  return String(value);
};

/* ------------------------------------------------------------- dates -- */

/* The comps write September as "Sept". */
export const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"];
export const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July",
  "August", "September", "October", "November", "December"];

export const monthKeyOf = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

export const monthLabelOf = (key: string): string => {
  const [year, month] = String(key || "").split("-");
  const index = Number(month) - 1;
  if (!MONTHS_LONG[index]) return key;
  return `${MONTHS_LONG[index]} ${year}`;
};

/** "Apr" for a chart tick. */
export const monthTickOf = (key: string): string => {
  const index = Number(String(key || "").split("-")[1]) - 1;
  return MONTHS_SHORT[index]?.slice(0, 3) || "";
};

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

/** "Today", "Yesterday", "21 September" - the list's day headings. */
export const dayHeadingOf = (value?: string): string => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const days = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${date.getDate()} ${MONTHS_LONG[date.getMonth()]}`;
};

/** "Today", "21 Sept" - the dashboard's tighter form. */
export const dayShortOf = (value?: string): string => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const days = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}`;
};

/** "01 Sept 2026" - an invoice date. */
export const fullDateOf = (value?: string): string => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${String(date.getDate()).padStart(2, "0")} ${MONTHS_SHORT[date.getMonth()]} ${date.getFullYear()}`;
};

/* ------------------------------------------------------------ states -- */

export type Tone = { label: string; bg: string; fg: string };

export const statusTone = (status?: string): Tone => {
  const b = brand;
  switch (String(status || "").toUpperCase()) {
    case "PAID":
      return { label: "Paid", bg: b.tint, fg: b.primary };
    case "PARTIALLY_PAID":
      return { label: "Partially Paid", bg: b.warnTint, fg: b.warnInk };
    case "PENDING":
      return { label: "Pending", bg: b.warnTint, fg: b.warnInk };
    case "OVERDUE":
      return { label: "Overdue", bg: b.alertTint, fg: b.alertInk };
    case "CANCELLED":
      return { label: "Cancelled", bg: b.neutralBadge, fg: b.textSecondary };
    default:
      return { label: "Pending", bg: b.warnTint, fg: b.warnInk };
  }
};

/* ------------------------------------------------------- categories -- */

const CATEGORY_ICONS: Record<string, GlyphName> = {
  RENT: "business-outline",
  UTILITIES: "flash",
  MAINTENANCE: "construct-outline",
  SALARY: "people-outline",
  MARKETING: "megaphone",
  SUPPLIES: "cube-outline",
  REPAIRS: "hammer-outline",
  DEPOSIT: "shield-checkmark",
  BOOKING: "calendar",
  BROKERAGE: "people",
  PAYMENT: "card-outline",
  REFUND: "return-down-back-outline",
  OTHER: "ellipsis-horizontal",
};

export const categoryIcon = (category?: string): GlyphName =>
  CATEGORY_ICONS[String(category || "").toUpperCase()] || "receipt-outline";

export const categoryLabel = (category?: string): string => {
  const raw = String(category || "").replaceAll("_", " ").trim().toLowerCase();
  if (!raw) return "Other";
  return raw.replace(/(^|\s)\S/g, (ch) => ch.toUpperCase());
};

/* The expense category enum, as the backend defines it. */
export const EXPENSE_CATEGORIES = [
  "RENT", "UTILITIES", "MAINTENANCE", "SALARY", "MARKETING", "SUPPLIES", "REPAIRS", "OTHER",
];

/* Income is not an enum on the ledger, so these are the comps' own words. */
export const INCOME_CATEGORIES = [
  "RENT", "DEPOSIT", "BOOKING", "BROKERAGE", "MAINTENANCE", "PAYMENT", "OTHER",
];

/* ----------------------------------------------------- payment modes -- */

const METHOD_LABELS: Record<string, string> = {
  CASH: "Cash",
  UPI: "UPI",
  BANK_TRANSFER: "Bank Transfer",
  CARD: "Card",
  CHEQUE: "Cheque",
  OTHER: "Other",
};

export const PAYMENT_METHODS = Object.keys(METHOD_LABELS);

export const methodLabel = (method?: string): string =>
  METHOD_LABELS[String(method || "").toUpperCase()] || "";

export const methodIcon = (method?: string): GlyphName => {
  switch (String(method || "").toUpperCase()) {
    case "CASH":
      return "cash-outline";
    case "UPI":
      return "phone-portrait-outline";
    case "BANK_TRANSFER":
      return "business-outline";
    case "CARD":
      return "card-outline";
    case "CHEQUE":
      return "document-text-outline";
    default:
      return "wallet-outline";
  }
};
