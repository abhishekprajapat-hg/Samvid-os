import React from "react";
import { Clock3 } from "lucide-react";

const formatTimestamp = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const formatTimestampCompact = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
};

const AppPageHeader = ({
  title,
  scopeLabel,
  roleLabel,
  updatedAt = new Date(),
}) => (
  <section className="px-2.5 pt-2 sm:px-6 sm:pt-6 lg:px-8">
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm sm:rounded-2xl">
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-cyan-900 px-2.5 py-2.5 sm:px-6 sm:py-5">
        <div className="flex flex-col gap-2 sm:gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h1 className="text-base font-semibold leading-tight text-white sm:text-2xl">{title}</h1>
          </div>

          <div className="flex items-center gap-1 overflow-x-auto pb-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] custom-scrollbar sm:flex-wrap sm:gap-2 sm:text-[11px] sm:tracking-[0.12em]">
            {scopeLabel ? (
              <span className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full border border-white/30 bg-white/10 px-1.5 py-0.5 text-cyan-100 sm:px-2.5 sm:py-1">
                {scopeLabel}
              </span>
            ) : null}
            {roleLabel ? (
              <span className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full border border-white/30 bg-white/10 px-1.5 py-0.5 text-cyan-100 sm:px-2.5 sm:py-1">
                <span className="sm:hidden">{roleLabel}</span>
                <span className="hidden sm:inline">Role: {roleLabel}</span>
              </span>
            ) : null}
            <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-white/30 bg-white/10 px-1.5 py-0.5 text-cyan-100 sm:px-2.5 sm:py-1">
              <Clock3 size={11} />
              <span className="sm:hidden">{formatTimestampCompact(updatedAt)}</span>
              <span className="hidden sm:inline">{formatTimestamp(updatedAt)}</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  </section>
);

export default AppPageHeader;
