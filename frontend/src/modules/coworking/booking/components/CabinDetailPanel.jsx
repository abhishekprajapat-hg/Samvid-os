import React from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  Ban,
  CalendarPlus,
  FileText,
  History,
  IndianRupee,
  LogOut,
  Mail,
  MoveRight,
  Pencil,
  Phone,
  RotateCcw,
  Timer,
  UserPlus,
  Users,
  Wrench,
  X,
} from "lucide-react";
import { Button, cn } from "../../../../components/ui";
import { formatCurrency, formatDate } from "../../../../utils/format";
import { STATUS_META } from "../cabinData";
import DocumentChecklist from "./DocumentChecklist";

/*
 * Everything known about one cabin, in the order a manager asks for it:
 * who is in it now, on what terms, and who was in it before.
 *
 * The previous-client count is a first-class number here rather than a footnote.
 * It is what tells you whether a cabin churns - a cabin on its fifth tenant in
 * two years is a different proposition to one on its first, and that only shows
 * up if the count is on the screen.
 */

const DAY = 24 * 60 * 60 * 1000;
const daysBetween = (from, to) => Math.max(0, Math.round((new Date(to) - new Date(from)) / DAY));
const monthsBetween = (from, to) => Math.max(1, Math.round(daysBetween(from, to) / 30));

const initials = (name = "") =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

const Row = ({ label, value, icon: Icon, mono }) => (
  <div className="flex items-baseline gap-3 py-1">
    <dt className="flex w-[104px] shrink-0 items-center gap-1.5 text-[11.5px] text-slate-500 dark:text-slate-400">
      {Icon ? <Icon aria-hidden="true" size={12} /> : null}
      {label}
    </dt>
    <dd
      className={cn(
        "min-w-0 flex-1 break-words text-[12.5px] text-slate-800 dark:text-slate-200",
        mono && "font-mono text-[12px]",
      )}
    >
      {value}
    </dd>
  </div>
);

const Section = ({ title, count, icon: Icon, children, className }) => (
  <section className={cn("border-t border-slate-200 pt-3 dark:border-slate-800", className)}>
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

/** Capacity and rate, the two facts that describe the room itself. */
const CabinFacts = ({ cabin }) => (
  <div className="grid grid-cols-2 gap-2">
    <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
      <p className="text-[11px] text-slate-500 dark:text-slate-400">Capacity</p>
      <p className="mt-0.5 text-[15px] font-semibold text-slate-950 dark:text-slate-50">{cabin.seats} seater</p>
    </div>
    <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
      <p className="text-[11px] text-slate-500 dark:text-slate-400">Monthly rent</p>
      <p className="mt-0.5 text-[15px] font-semibold tabular-nums text-slate-950 dark:text-slate-50">
        {formatCurrency(cabin.monthlyRent)}
      </p>
    </div>
  </div>
);

const CabinDetailPanel = ({ cabin, onClose, onAction, onOnboard, onHold, onTransfer, onOpenClient, onEditClient, propertyLabel }) => {
  const meta = STATUS_META[cabin.status];
  const contract = cabin.contract;
  const isLet = cabin.status === "BOOKED" || cabin.status === "RESERVED";
  const unavailable = cabin.status === "BLOCKED" || cabin.status === "MAINTENANCE";

  // Term progress comes off the agreement itself. Reading the clock here would
  // be impure, and the numbers already say everything needed.
  const termDays = contract ? daysBetween(contract.startDate, contract.endDate) : 0;
  const elapsed = contract ? Math.max(0, termDays - contract.endsInDays) : 0;

  // A stored birth date wins; otherwise fall back to one read off an uploaded document.
  const clientDateOfBirth =
    cabin.client?.dateOfBirth
    || cabin.client?.documents?.find((doc) => doc.extractedDateOfBirth)?.extractedDateOfBirth
    || "";

  // Rendered inside a Modal, which owns the padding and the scroll. The panel
  // keeps its own header because the dialog is opened without one.
  return (
    <div className="space-y-4">
      <header className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-mono text-[19px] font-semibold leading-none tracking-tight text-slate-950 dark:text-slate-50">
              {cabin.label}
            </h2>
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                meta.badge,
              )}
            >
              {meta.label}
            </span>
          </div>
          <p className="mt-1.5 text-[11.5px] text-slate-500 dark:text-slate-400">
            {cabin.seats} seater · Wing {cabin.wing} · {propertyLabel}
          </p>
        </div>
        <button
          type="button"
          aria-label="Close cabin details"
          onClick={onClose}
          className="rounded-lg p-1.5 text-slate-400 outline-none transition hover:bg-slate-100 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-blue-500/40 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          <X size={15} />
        </button>
      </header>

      <CabinFacts cabin={cabin} />

      {isLet && cabin.client ? (
        <>
          <Section title={cabin.status === "RESERVED" ? "Held for" : "Current client"} icon={Users}>
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[12px] font-semibold text-white">
                {initials(cabin.client.name)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[13.5px] font-semibold text-slate-950 dark:text-slate-50">
                  {cabin.client.name}
                </p>
                <p className="truncate text-[11.5px] text-slate-500 dark:text-slate-400">
                  {cabin.client.industry} · with us since {formatDate(cabin.client.since)}
                </p>
              </div>
            </div>

            <dl className="mt-3">
              <Row label="Contact" value={cabin.client.contactPerson} />
              <Row label="Phone" value={cabin.client.phone} icon={Phone} mono />
              <Row label="Email" value={cabin.client.email} icon={Mail} />
              <Row label="GSTIN" value={cabin.client.gstin} mono />
            </dl>

            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Button size="sm" variant="secondary" leftIcon={Pencil} onClick={onEditClient}>
                Edit client
              </Button>
              <Button size="sm" variant="secondary" rightIcon={ArrowUpRight} onClick={onOpenClient}>
                Open client record
              </Button>
            </div>
          </Section>

          <Section title="Agreement" count={contract.id}>
            <p className="text-[12.5px] text-slate-800 dark:text-slate-200">
              {formatDate(contract.startDate)} – {formatDate(contract.endDate)}
            </p>
            {cabin.status === "BOOKED" ? (
              <>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      contract.endsInDays <= 45 ? "bg-amber-500" : "bg-blue-600",
                    )}
                    style={{ width: `${termDays ? Math.round((elapsed / termDays) * 100) : 0}%` }}
                  />
                </div>
                <p
                  className={cn(
                    "mt-1.5 text-[11.5px]",
                    contract.endsInDays <= 45
                      ? "font-semibold text-amber-700 dark:text-amber-400"
                      : "text-slate-500 dark:text-slate-400",
                  )}
                >
                  {contract.endsInDays} days left · lock-in {contract.lockInMonths} months
                </p>
              </>
            ) : (
              <p className="mt-1.5 flex items-center gap-1.5 text-[11.5px] font-semibold text-amber-700 dark:text-amber-400">
                <Timer aria-hidden="true" size={12} />
                Hold expires {formatDate(cabin.holdExpiresAt)} · moves in {formatDate(contract.startDate)}
              </p>
            )}

            <dl className="mt-2">
              <Row label="Monthly rent" value={formatCurrency(contract.monthlyRent)} />
              <Row label="Deposit" value={formatCurrency(contract.deposit)} />
              <Row label="Token paid" value={formatCurrency(contract.tokenAmount || 0)} />
              <Row label="Notice period" value={`${contract.noticePeriodDays ?? 30} days`} />
              <Row label="Date of birth" value={formatDate(clientDateOfBirth) || "-"} />
              <div className="mt-3 border-t pt-2"><h4 className="text-xs font-semibold">Security Cheque</h4><Row label="Cheque number" value={contract.securityCheque?.number} /><Row label="Bank" value={contract.securityCheque?.bank} /><Row label="Amount" value={formatCurrency(contract.securityCheque?.amount || 0)} /><Row label="Cheque date" value={contract.securityCheque?.date} /></div>
              <Row
                label="Payment status"
                value={
                  <span
                    className={cn(
                      "inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                      contract.duesAmount > 0
                        ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
                        : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300",
                    )}
                  >
                    {contract.duesAmount > 0 ? "Overdue" : "Paid"}
                  </span>
                }
              />
              <Row label="Next due date" value={formatDate(contract.nextInvoiceDate)} />
              <Row label="Next invoice" value={formatCurrency(contract.nextInvoiceAmount)} />
            </dl>

            {contract.duesAmount > 0 ? (
              <div className="mt-2 rounded-lg border border-rose-200 bg-rose-50 p-2.5 dark:border-rose-500/30 dark:bg-rose-500/10">
                <p className="flex items-start gap-1.5 text-[11.5px] text-rose-800 dark:text-rose-300">
                  <AlertTriangle aria-hidden="true" size={13} className="mt-px shrink-0" />
                  {formatCurrency(contract.duesAmount)} overdue. Settle before renewing.
                </p>
                <Button
                  size="sm"
                  variant="secondary"
                  leftIcon={IndianRupee}
                  className="mt-2 w-full"
                  onClick={() => onAction({ type: "RECORD_PAYMENT", cabinCode: cabin.code })}
                >
                  Record payment
                </Button>
              </div>
            ) : null}

            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {cabin.status === "BOOKED" ? (
                <>
                  <Button
                    size="sm"
                    variant="secondary"
                    leftIcon={CalendarPlus}
                    onClick={() => onAction({ type: "RENEW", cabinCode: cabin.code, months: 12 })}
                  >
                    Renew 12m
                  </Button>
                  <Button size="sm" variant="secondary" leftIcon={MoveRight} onClick={() => onTransfer(cabin)}>
                    Move cabin
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    leftIcon={LogOut}
                    className="col-span-2"
                    onClick={() => onAction({ type: "RELEASE", cabinCode: cabin.code })}
                  >
                    Release cabin
                  </Button>
                </>
              ) : (
                <>
                  <Button size="sm" onClick={() => onAction({ type: "CONFIRM_HOLD", cabinCode: cabin.code })}>
                    Confirm booking
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => onAction({ type: "DROP_HOLD", cabinCode: cabin.code })}
                  >
                    Drop hold
                  </Button>
                </>
              )}
            </div>
          </Section>

          <Section title="Client documents" count={cabin.client.documents?.length || 0} icon={FileText}>
            <DocumentChecklist
              kind={cabin.client.kind || "company"}
              documents={cabin.client.documents || []}
              readOnly
            />
            <Button
              size="sm"
              variant="secondary"
              rightIcon={ArrowUpRight}
              className="mt-2 w-full"
              onClick={onOpenClient}
            >
              Manage documents in client profile
            </Button>
          </Section>
        </>
      ) : null}

      {cabin.status === "VACANT" ? (
        <Section title="Available to let">
          <p className="text-[12.5px] text-slate-600 dark:text-slate-300">
            Free since {formatDate(cabin.vacantSince)} ·{" "}
            <strong className="font-semibold tabular-nums">{cabin.vacantDays} days</strong> idle
          </p>

          <dl className="mt-2">
            <Row label="Deposit" value={`${formatCurrency(cabin.deposit)} (2 months)`} />
            <Row label="Includes" value={(cabin.amenities || []).join(", ") || "Not configured"} />
          </dl>

          <Button leftIcon={UserPlus} className="mt-3 w-full" onClick={() => onOnboard([cabin])}>
            Onboard client
          </Button>
          <Button size="sm" variant="secondary" className="mt-2 w-full" onClick={() => onHold(cabin)}>
            Hold for a lead
          </Button>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button
              size="sm"
              variant="ghost"
              leftIcon={Ban}
              onClick={() =>
                onAction({
                  type: "SET_UNAVAILABLE",
                  cabinCode: cabin.code,
                  status: "BLOCKED",
                  reason: "Blocked from the board.",
                })
              }
            >
              Block
            </Button>
            <Button
              size="sm"
              variant="ghost"
              leftIcon={Wrench}
              onClick={() =>
                onAction({
                  type: "SET_UNAVAILABLE",
                  cabinCode: cabin.code,
                  status: "MAINTENANCE",
                  reason: "Sent for upkeep from the board.",
                })
              }
            >
              Upkeep
            </Button>
          </div>
        </Section>
      ) : null}

      {unavailable ? (
        <Section title="Off the market">
          <p className="text-[12.5px] text-slate-600 dark:text-slate-300">{cabin.unavailableReason}</p>
          <Button
            size="sm"
            variant="secondary"
            leftIcon={RotateCcw}
            className="mt-3 w-full"
            onClick={() => onAction({ type: "RETURN_TO_INVENTORY", cabinCode: cabin.code })}
          >
            Return to inventory
          </Button>
        </Section>
      ) : null}

      {/* The ex-client count, and the stays behind it. */}
      <Section title="Previous clients" count={cabin.previousClientCount} icon={History}>
        {cabin.previousClients.length ? (
          <ol className="space-y-1.5">
            {cabin.previousClients.map((stay) => (
              // A departed tenant has no live record to open, so these are read
              // only. Making them look clickable would promise a screen that
              // cannot exist.
              <li key={stay.id}>
                <div className="flex w-full items-center gap-2.5 rounded-lg border border-slate-200 px-2.5 py-2 text-left dark:border-slate-700">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {initials(stay.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-medium text-slate-800 dark:text-slate-200">
                      {stay.name}
                    </span>
                    <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                      {formatDate(stay.from)} – {formatDate(stay.to)} · {monthsBetween(stay.from, stay.to)} months
                    </span>
                  </span>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-[12px] text-slate-500 dark:text-slate-400">
            No earlier tenant on record. This cabin has only ever had its current occupant.
          </p>
        )}
      </Section>
    </div>
  );
};

export default CabinDetailPanel;
