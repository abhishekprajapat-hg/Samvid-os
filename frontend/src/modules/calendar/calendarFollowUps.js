const normalize = (value) => String(value || "").trim().toUpperCase();

export const toCalendarDateKey = (dateValue) => {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

export const buildMonthCalendarCells = (monthValue) => {
  const monthDate = new Date(monthValue);
  if (Number.isNaN(monthDate.getTime())) return [];

  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const occupiedCells = first.getDay() + last.getDate();
  const cellCount = occupiedCells <= 35 ? 35 : 42;
  const start = new Date(year, month, 1 - first.getDay());

  return Array.from({ length: cellCount }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
};

export const isUnpaidCollectionLead = (lead) =>
  normalize(lead?.status) === "CLOSED"
  && normalize(lead?.dealPayment?.paymentType) === "PARTIAL"
  && Number(lead?.dealPayment?.remainingAmount) > 0;

export const canScheduleLeadFollowUp = (lead) => {
  const status = normalize(lead?.status);
  return status !== "LOST"
    && status !== "INVALID"
    && (status !== "CLOSED" || isUnpaidCollectionLead(lead));
};

export const isPendingCalendarFollowUp = (lead) =>
  Boolean(lead?.nextFollowUp) && canScheduleLeadFollowUp(lead);

export const digitsOf = (value) => String(value || "").replace(/\D/g, "");

// Lead search for the calendar picker: name (any part) or phone (digits only,
// so "98765 43210" and "+91 98765-43210" both find 9876543210).
export const matchesLeadQuery = (lead, query) => {
  const text = String(query || "").trim().toLowerCase();
  if (!text) return true;
  const digits = digitsOf(text);
  const name = String(lead?.name || "").toLowerCase();
  if (name.includes(text)) return true;
  if (digits.length >= 3 && digitsOf(lead?.phone).includes(digits)) return true;
  return String(lead?.phone || "").toLowerCase().includes(text);
};
