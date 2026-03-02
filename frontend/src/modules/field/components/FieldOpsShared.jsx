import React from "react";
import { CalendarClock } from "lucide-react";

const getLeadStatusLabel = (status) => {
  switch (String(status || "")) {
    case "NEW":
      return "New";
    case "CONTACTED":
      return "Contacted";
    case "INTERESTED":
      return "Interested";
    case "SITE_VISIT":
      return "Site Visit";
    case "CLOSED":
      return "Closed";
    case "LOST":
      return "Lost";
    default:
      return "Unknown";
  }
};

export const StatCard = ({ title, value, helper, icon }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4">
    <div className="flex items-center justify-between gap-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{title}</p>
      <div className="rounded-lg bg-slate-100 p-2 text-slate-700">
        {icon ? React.createElement(icon, { size: 14 }) : null}
      </div>
    </div>
    <p className="mt-3 text-2xl font-semibold text-slate-900">{value}</p>
    <p className="mt-1 text-xs text-slate-500">{helper}</p>
  </div>
);

export const MiniStat = ({ label, value }) => (
  <div className="rounded-md border border-slate-200 bg-white px-2 py-1.5">
    <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">{label}</p>
    <p className="mt-0.5 text-sm font-semibold text-slate-900">{value}</p>
  </div>
);

export const StatusBadge = ({ status }) => {
  const normalized = String(status || "");
  const label = getLeadStatusLabel(normalized);

  let classes = "border-slate-300 bg-slate-100 text-slate-700";
  if (normalized === "SITE_VISIT") classes = "border-indigo-200 bg-indigo-50 text-indigo-700";
  else if (normalized === "INTERESTED") classes = "border-amber-200 bg-amber-50 text-amber-700";
  else if (normalized === "CONTACTED") classes = "border-sky-200 bg-sky-50 text-sky-700";
  else if (normalized === "NEW") classes = "border-slate-300 bg-slate-100 text-slate-700";
  else if (normalized === "CLOSED") classes = "border-emerald-200 bg-emerald-50 text-emerald-700";
  else if (normalized === "LOST") classes = "border-rose-200 bg-rose-50 text-rose-700";

  return (
    <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold uppercase ${classes}`}>
      {label}
    </span>
  );
};

export const EmptyState = ({ text }) => (
  <div className="mt-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
    <CalendarClock size={16} className="mx-auto mb-2 text-slate-400" />
    {text}
  </div>
);
