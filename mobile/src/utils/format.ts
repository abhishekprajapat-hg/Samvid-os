/*
 * The formatters web renders every amount and date through -
 * frontend/src/utils/format.js - so a figure reads the same on both apps.
 */

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export const formatCurrency = (value: unknown) => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "-";
  return currencyFormatter.format(amount);
};

const toDate = (value: unknown) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value as string);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const formatDate = (value: unknown) => {
  const date = toDate(value);
  return date ? dateFormatter.format(date) : "-";
};

export const formatDateTime = (value: unknown) => {
  const date = toDate(value);
  return date ? dateTimeFormatter.format(date) : "-";
};

/** YYYY-MM-DD in local time, the value a date field holds. */
export const toDateKey = (value: Date = new Date()) => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
};
