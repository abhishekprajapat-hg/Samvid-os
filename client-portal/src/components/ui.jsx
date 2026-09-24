import { cn } from "./utils";

export const Card = ({ className, ...props }) => (
  <div className={cn("rounded-2xl border border-slate-200 bg-white p-4 shadow-card", className)} {...props} />
);

export const Button = ({ variant = "primary", className, ...props }) => (
  <button
    type="button"
    className={cn(
      "inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
      variant === "primary" && "border-brand-600 bg-brand-600 text-white hover:bg-brand-700",
      variant === "secondary" && "border-slate-300 bg-white text-slate-800 hover:bg-slate-50",
      className,
    )}
    {...props}
  />
);

const STATUS_TONES = {
  PENDING: "border-amber-200 bg-amber-50 text-amber-700",
  PARTIALLY_PAID: "border-amber-200 bg-amber-50 text-amber-700",
  PAID: "border-emerald-200 bg-emerald-50 text-emerald-700",
  OVERDUE: "border-rose-200 bg-rose-50 text-rose-700",
  CANCELLED: "border-slate-200 bg-slate-100 text-slate-600",
  DRAFT: "border-slate-200 bg-slate-100 text-slate-600",
  ACTIVE: "border-emerald-200 bg-emerald-50 text-emerald-700",
  EXPIRING: "border-amber-200 bg-amber-50 text-amber-700",
  EXPIRED: "border-rose-200 bg-rose-50 text-rose-700",
  TERMINATED: "border-rose-200 bg-rose-50 text-rose-700",
  CONFIRMED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  COMPLETED: "border-slate-200 bg-slate-100 text-slate-600",
  NO_SHOW: "border-rose-200 bg-rose-50 text-rose-700",
};

export const StatusBadge = ({ status }) => (
  <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide", STATUS_TONES[status] || "border-slate-200 bg-slate-100 text-slate-600")}>
    {String(status || "").replace(/_/g, " ")}
  </span>
);

export const EmptyState = ({ title, description }) => (
  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
    <p className="font-semibold text-slate-700">{title}</p>
    {description ? <p className="mt-1 text-xs">{description}</p> : null}
  </div>
);

export const Skeleton = ({ className }) => <div className={cn("animate-pulse rounded-xl bg-slate-200", className)} />;
