import React from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  Building2,
  CalendarClock,
  FileText,
  History,
  IndianRupee,
  Mail,
  Phone,
  Repeat2,
} from "lucide-react";
import { Button, cn } from "../../../../components/ui";
import { formatCurrency, formatDate } from "../../../../utils/format";
import DocumentChecklist from "../../booking/components/DocumentChecklist";
import { STATUS_META } from "../../booking/cabinData";
import { CLIENT_KINDS, kycStatusOf } from "../../booking/kycDocuments";

/*
 * One client, current or former.
 *
 * Both use the same profile because they are the same relationship at
 * different points: a former client is a lead you already know everything
 * about. Splitting them into two screens would hide exactly the thing worth
 * knowing when they call back - how long they stayed, in which cabin, and why
 * the room suited them.
 */

const initials = (name = "") =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

const Stat = ({ label, value, tone }) => (
  <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
    <p className="text-[11px] text-slate-500 dark:text-slate-400">{label}</p>
    <p className={cn("mt-0.5 text-[15px] font-semibold tabular-nums text-slate-950 dark:text-slate-50", tone)}>
      {value}
    </p>
  </div>
);

const Row = ({ label, value, icon: Icon, mono }) => (
  <div className="flex items-baseline gap-3 py-1">
    <dt className="flex w-[104px] shrink-0 items-center gap-1.5 text-[11.5px] text-slate-500 dark:text-slate-400">
      {Icon ? <Icon aria-hidden="true" size={12} /> : null}
      {label}
    </dt>
    <dd className={cn("min-w-0 flex-1 break-words text-[12.5px] text-slate-800 dark:text-slate-200", mono && "font-mono text-[12px]")}>
      {value || <span className="text-slate-400 dark:text-slate-500">Not recorded</span>}
    </dd>
  </div>
);

const Section = ({ title, count, icon: Icon, children }) => (
  <section className="border-t border-slate-200 pt-4 dark:border-slate-800">
    <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
      {Icon ? <Icon aria-hidden="true" size={13} /> : null}
      {title}
      {count !== undefined ? (
        <span className="rounded-full bg-slate-100 px-1.5 py-px text-[10.5px] font-semibold tabular-nums text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {count}
        </span>
      ) : null}
    </h3>
    {children}
  </section>
);

const ClientProfile = ({ client, onOpenCabin, onRecordPayment, onDocumentsChange }) => {
  const isActive = client.kind === "active";
  const kyc = kycStatusOf({ kind: client.entityKind, documents: client.documents });
  const kindLabel = CLIENT_KINDS.find((option) => option.id === client.entityKind)?.label;
  const tenureLabel = client.totalMonths
    ? `${client.totalMonths} ${client.totalMonths === 1 ? "month" : "months"} of earlier tenancy`
    : "No earlier tenancy on record";

  return (
    <div className="custom-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
      <header className="flex items-start gap-3">
        <span
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-[15px] font-semibold text-white",
            isActive ? "bg-blue-600" : "bg-slate-400 dark:bg-slate-600",
          )}
        >
          {initials(client.name)}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[19px] font-semibold leading-tight tracking-tight text-slate-950 dark:text-slate-50">
            {client.name}
          </h2>
          <p className="mt-0.5 text-[12.5px] text-slate-500 dark:text-slate-400">
            {client.industry || "Industry not recorded"}
            {isActive && client.since ? ` · with us since ${formatDate(client.since)}` : ""}
            {!isActive && client.lastLeft ? ` · left ${formatDate(client.lastLeft)}` : ""}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                isActive
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
                  : "border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300",
              )}
            >
              {isActive ? "Current client" : "Former client"}
            </span>
            {kindLabel ? (
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {kindLabel}
                {client.entityType ? ` · ${client.entityType}` : ""}
              </span>
            ) : null}
            {kyc ? (
              <span
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                  kyc.complete
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
                    : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300",
                )}
              >
                {kyc.complete ? "KYC complete" : `KYC ${kyc.uploaded}/${kyc.required}`}
              </span>
            ) : null}
            {client.returning ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:border-blue-400/30 dark:bg-blue-500/10 dark:text-blue-300">
                <Repeat2 aria-hidden="true" size={11} />
                Returning
              </span>
            ) : null}
          </div>
        </div>
      </header>

      {isActive ? (
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Monthly rent" value={formatCurrency(client.monthlyRent)} />
          <Stat label="Cabins" value={client.cabins.length} />
          <Stat label="Seats" value={client.capacity} />
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Cabins held" value={client.stays.length} />
          <Stat label="Total tenancy" value={`${client.totalMonths} mo`} />
          <Stat label="Last seen" value={formatDate(client.lastLeft)} />
        </div>
      )}

      <Row label="Date of birth" value={client.dateOfBirth || client.documents?.find(doc => doc.extractedDateOfBirth)?.extractedDateOfBirth} />
      {client.duesAmount > 0 ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 dark:border-rose-500/30 dark:bg-rose-500/10">
          <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-rose-800 dark:text-rose-300">
            <AlertTriangle aria-hidden="true" size={13} />
            {formatCurrency(client.duesAmount)} overdue
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {client.cabins
              .filter((cabin) => cabin.contract?.duesAmount > 0)
              .map((cabin) => (
                <Button
                  key={cabin.code}
                  size="sm"
                  variant="secondary"
                  leftIcon={IndianRupee}
                  onClick={() => onRecordPayment(cabin.code)}
                >
                  Record payment for {cabin.label}
                </Button>
              ))}
          </div>
        </div>
      ) : null}

      <Section title="Contact">
        <dl>
          <Row label="Contact" value={client.contactPerson} />
          <Row label="Phone" value={client.phone} icon={Phone} mono />
          <Row label="Email" value={client.email} icon={Mail} />
          <Row label="GSTIN" value={client.gstin} mono />
        </dl>
      </Section>

      {isActive ? (
        <Section title="Cabins held" count={client.cabins.length} icon={Building2}>
          <ul className="space-y-1.5">
            {client.cabins.map((cabin) => {
              const meta = STATUS_META[cabin.status];
              const expiring = cabin.contract?.endsInDays <= 45;
              return (
                <li key={cabin.code}>
                  <button
                    type="button"
                    onClick={() => onOpenCabin(cabin.code)}
                    className="flex w-full items-center gap-3 rounded-lg border border-slate-200 px-3 py-2.5 text-left outline-none transition hover:border-blue-500 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-500/40 dark:border-slate-700 dark:hover:bg-slate-900"
                  >
                    <span className="flex items-center gap-2">
                      <i aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: meta.dot }} />
                      <span className="text-[13px] font-semibold text-slate-900 dark:text-slate-100">{cabin.label}</span>
                    </span>
                    <span className="text-[11.5px] text-slate-500 dark:text-slate-400">{cabin.seats} seater</span>
                    <span className="ml-auto shrink-0 text-right">
                      <span className="block text-[12.5px] font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                        {formatCurrency(cabin.contract?.monthlyRent ?? cabin.monthlyRent)}
                      </span>
                      <span
                        className={cn(
                          "block text-[11px] tabular-nums",
                          expiring ? "font-semibold text-amber-700 dark:text-amber-400" : "text-slate-500 dark:text-slate-400",
                        )}
                      >
                        {cabin.contract ? `${cabin.contract.endsInDays}d left` : "—"}
                      </span>
                    </span>
                    <ArrowUpRight aria-hidden="true" size={14} className="shrink-0 text-slate-400" />
                  </button>
                </li>
              );
            })}
          </ul>
          {client.earliestEnd ? (
            <p className="mt-2 flex items-center gap-1.5 text-[11.5px] text-slate-500 dark:text-slate-400">
              <CalendarClock aria-hidden="true" size={12} />
              Next renewal {formatDate(client.earliestEnd)}
            </p>
          ) : null}
        </Section>
      ) : null}

      <Section title="Documents" count={`${kyc.totalUploaded}/${kyc.total}`} icon={FileText}>
        <DocumentChecklist
          kind={client.entityKind || "company"}
          documents={client.documents || []}
          onChange={(documents) => onDocumentsChange(client.id, documents)}
        />
      </Section>

      <Section title="Tenancy history" count={client.stays.length} icon={History}>
        {client.stays.length ? (
          <>
            <ol className="space-y-1.5">
              {client.stays.map((stay) => (
                <li
                  key={stay.id}
                  className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700"
                >
                  <button
                    type="button"
                    onClick={() => onOpenCabin(stay.cabinCode)}
                    className="text-[12.5px] font-semibold text-slate-900 outline-none transition hover:text-blue-700 focus-visible:ring-2 focus-visible:ring-blue-500/40 dark:text-slate-100"
                  >
                    {stay.cabinLabel}
                  </button>
                  <span className="text-[11.5px] text-slate-500 dark:text-slate-400">{stay.seats} seater</span>
                  <span className="ml-auto text-[11.5px] text-slate-600 dark:text-slate-300">
                    {formatDate(stay.from)} – {formatDate(stay.to)}
                  </span>
                  <span className="w-16 shrink-0 text-right text-[11.5px] tabular-nums text-slate-500 dark:text-slate-400">
                    {stay.months} mo
                  </span>
                </li>
              ))}
            </ol>
            <p className="mt-2 text-[11.5px] text-slate-500 dark:text-slate-400">{tenureLabel}.</p>
          </>
        ) : (
          <p className="text-[12.5px] text-slate-500 dark:text-slate-400">
            This is their first tenancy in this coworking space.
          </p>
        )}
      </Section>
    </div>
  );
};

export default ClientProfile;
