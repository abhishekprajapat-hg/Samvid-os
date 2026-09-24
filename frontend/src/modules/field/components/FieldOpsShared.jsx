import { CalendarClock } from "lucide-react";
import { MetricCard, StatusBadge as CrmStatusBadge } from "../../../components/crm";
import { EmptyState as SharedEmptyState } from "../../../components/ui";

export const StatCard = ({ title, value, helper, icon, className = "" }) => (
  <MetricCard title={title} value={value} helper={helper} icon={icon} className={className} />
);

export const MiniStat = ({ label, value }) => (
  <div className="crm-muted-surface px-2.5 py-2">
    <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">{label}</p>
    <p className="mt-0.5 text-sm font-semibold text-slate-900">{value}</p>
  </div>
);

export const StatusBadge = ({ status }) => <CrmStatusBadge status={status} />;

export const EmptyState = ({ text }) => (
  <SharedEmptyState className="mt-3" icon={CalendarClock} text={text} />
);
