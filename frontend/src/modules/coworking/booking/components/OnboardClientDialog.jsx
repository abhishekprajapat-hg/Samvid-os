import React, { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Building2, Check, Search, UserPlus } from "lucide-react";
import { Button, Input, Modal, Select, cn } from "../../../../components/ui";
import { formatCurrency, formatDate } from "../../../../utils/format";
import { CLIENT_KINDS, ENTITY_TYPES, kycStatusOf } from "../kycDocuments";
import DocumentChecklist from "./DocumentChecklist";

/*
 * Checkout for the cabins in the cart: who is taking them, on what terms, then
 * a review before anything is committed.
 *
 * Three steps, because that is where the natural seams are - the client is
 * often already on file, the commercials are a different conversation, and
 * nobody should sign a 12-month agreement off a screen they have not re-read.
 * The order summary stays pinned on the right through all three so the number
 * being agreed to never leaves the screen.
 *
 * DESIGN SCREEN: state is local and Confirm resolves to the caller. No writes.
 */

const STEPS = [
  { id: "client", label: "Client" },
  { id: "documents", label: "Documents" },
  { id: "terms", label: "Agreement" },
  { id: "review", label: "Review" },
];

const TERM_OPTIONS = [3, 6, 12, 24];
const INDUSTRIES = [
  "Data & AI", "Consulting", "Financial services", "Healthcare", "Legal",
  "Logistics", "Media & content", "Product design", "Retail tech", "Other",
];

const today = () => new Date().toISOString().slice(0, 10);
const addMonths = (iso, months) => {
  const date = new Date(iso);
  date.setMonth(date.getMonth() + months);
  return date;
};

const Field = ({ label, children, hint, className }) => (
  <label className={cn("block", className)}>
    <span className="mb-1 block text-[11.5px] font-medium text-slate-600 dark:text-slate-300">{label}</span>
    {children}
    {hint ? <span className="mt-1 block text-[11px] text-slate-400 dark:text-slate-500">{hint}</span> : null}
  </label>
);

const Stepper = ({ index }) => (
  <ol className="mb-4 flex items-center gap-2">
    {STEPS.map((step, stepIndex) => {
      const done = stepIndex < index;
      const active = stepIndex === index;
      return (
        <li key={step.id} className="flex items-center gap-2">
          <span
            className={cn(
              "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold transition",
              done && "bg-emerald-600 text-white",
              active && "bg-blue-600 text-white",
              !done && !active && "bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
            )}
          >
            {done ? <Check aria-hidden="true" size={11} strokeWidth={3} /> : stepIndex + 1}
          </span>
          <span
            className={cn(
              "text-[12px]",
              active
                ? "font-semibold text-slate-950 dark:text-slate-50"
                : "text-slate-500 dark:text-slate-400",
            )}
          >
            {step.label}
          </span>
          {stepIndex < STEPS.length - 1 ? (
            <span aria-hidden="true" className="mx-1 h-px w-6 bg-slate-200 dark:bg-slate-700" />
          ) : null}
        </li>
      );
    })}
  </ol>
);

const OrderSummary = ({ cabins, rent, deposit, term, startDate }) => (
  <aside className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900">
    <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
      Cabins selected
    </h3>
    <ul className="mt-2 space-y-1">
      {cabins.map((cabin) => (
        <li key={cabin.code} className="flex items-baseline gap-2 text-[12px]">
          <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">{cabin.label}</span>
          <span className="text-slate-500 dark:text-slate-400">{cabin.seats} seater</span>
          <span className="ml-auto tabular-nums text-slate-700 dark:text-slate-300">
            {formatCurrency(cabin.monthlyRent)}
          </span>
        </li>
      ))}
    </ul>

    <dl className="mt-3 space-y-1 border-t border-slate-200 pt-2 text-[12px] dark:border-slate-700">
      <div className="flex justify-between">
        <dt className="text-slate-500 dark:text-slate-400">Monthly rent</dt>
        <dd className="font-semibold tabular-nums text-slate-950 dark:text-slate-50">{formatCurrency(rent)}</dd>
      </div>
      <div className="flex justify-between">
        <dt className="text-slate-500 dark:text-slate-400">Security deposit</dt>
        <dd className="tabular-nums text-slate-700 dark:text-slate-300">{formatCurrency(deposit)}</dd>
      </div>
      <div className="flex justify-between">
        <dt className="text-slate-500 dark:text-slate-400">Term</dt>
        <dd className="tabular-nums text-slate-700 dark:text-slate-300">{term} months</dd>
      </div>
      <div className="flex justify-between border-t border-slate-200 pt-1.5 dark:border-slate-700">
        <dt className="text-slate-500 dark:text-slate-400">Due on signing</dt>
        <dd className="font-semibold tabular-nums text-slate-950 dark:text-slate-50">
          {formatCurrency(rent + deposit)}
        </dd>
      </div>
    </dl>

    <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">
      Starts {formatDate(startDate)}, ends {formatDate(addMonths(startDate, term))}
    </p>
  </aside>
);

const OnboardClientDialog = ({ open, cabins = [], onClose, onConfirm, initialClient = null, initialTerms = null, editMode = false }) => {
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState("new");
  const [clientQuery, setClientQuery] = useState("");
  const [existingClientId, setExistingClientId] = useState("");
  const [form, setForm] = useState(() => ({
    // Company is the default because most cabins go to one; an individual
    // taking a private cabin is the rarer case, not the assumed one.
    kind: initialClient?.kind || "company",
    entityType: initialClient?.entityType || ENTITY_TYPES[0],
    companyName: initialClient?.name || initialClient?.companyName || "",
    contactPerson: initialClient?.contactPerson || "",
    dateOfBirth: initialClient?.dateOfBirth?.slice(0, 10) || "",
    phone: initialClient?.phone || "",
    email: initialClient?.email || "",
    industry: initialClient?.industry || INDUSTRIES[0],
    gstin: initialClient?.gstin || "",
    pan: initialClient?.pan || "",
    documents: Array.isArray(initialClient?.documents) ? initialClient.documents : [],
  }));
  const [terms, setTerms] = useState(() => ({
    startDate: initialTerms?.startDate?.slice(0, 10) || today(),
    termMonths: initialTerms?.termMonths || 12,
    lockInMonths: initialTerms?.lockInMonths ?? 6,
    rentOverride: initialTerms?.rent ?? "",
    depositMonths: initialTerms?.depositMonths ?? 2,
    noticePeriodDays: initialTerms?.noticePeriodDays ?? 30,
    tokenAmount: initialTerms?.tokenAmount ?? 0,
    securityCheque: initialTerms?.securityCheque || { number: "", bank: "", amount: 0, date: "", notes: "" },
    notes: initialTerms?.notes || "",
  }));

  const listRent = cabins.reduce((total, cabin) => total + cabin.monthlyRent, 0);
  const rent = terms.rentOverride === "" ? listRent : Number(terms.rentOverride) || 0;
  const deposit = rent * terms.depositMonths;
  const capacity = cabins.reduce((total, cabin) => total + cabin.seats, 0);

  const matchingClients = useMemo(() => {
    const query = clientQuery.trim().toLowerCase();
    if (!query) return [];
    return [].filter((client) =>
      `${client.name} ${client.contactPerson} ${client.industry}`.toLowerCase().includes(query),
    );
  }, [clientQuery]);

  const isCompany = form.kind === "company";
  const kyc = kycStatusOf(form);
  const selectedClient = null;
  const clientName = mode === "new" ? form.companyName.trim() : selectedClient?.name || "";
  const validTerms = [terms.noticePeriodDays, terms.tokenAmount, terms.securityCheque.amount].every(value => Number.isFinite(Number(value)) && Number(value) >= 0);
  const validBirthDate = !form.dateOfBirth || (form.dateOfBirth >= "1900-01-01" && form.dateOfBirth <= today());
  const canAdvance = step === 0 ? Boolean(clientName) : validTerms && validBirthDate;

  const set = (key) => (event) => setForm((value) => ({ ...value, [key]: event.target.value }));
  const setTerm = (key) => (event) => setTerms((value) => ({ ...value, [key]: event.target.value }));

  const discount = listRent - rent;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={editMode ? "Edit onboarded client" : "Onboard client"}
      description={`${cabins.length} ${cabins.length === 1 ? "cabin" : "cabins"} · seats ${capacity} · ${cabins
        .map((cabin) => cabin.label)
        .join(", ")}`}
      footer={
        <>
          <Button
            variant="ghost"
            leftIcon={ArrowLeft}
            disabled={step === 0}
            onClick={() => setStep((value) => Math.max(0, value - 1))}
          >
            Back
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          {step < STEPS.length - 1 ? (
            <Button rightIcon={ArrowRight} disabled={!canAdvance} onClick={() => setStep((value) => value + 1)}>
              Continue
            </Button>
          ) : (
            <Button
              leftIcon={UserPlus}
              disabled={!validTerms || !validBirthDate}
              onClick={() =>
                onConfirm({
                  clientName,
                  // An existing client keeps their record; a new one is built
                  // from the form. Either way the board gets one client shape.
                  client:
                    mode === "existing" && selectedClient
                      ? selectedClient
                      : { ...form, name: clientName },
                  cabins,
                  terms: { ...terms, rent },
                })
              }
            >
              {editMode ? "Save client and agreement" : "Confirm and allot"}
            </Button>
          )}
        </>
      }
    >
      <Stepper index={step} />

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_224px]">
        <div className="min-w-0">
          {step === 0 ? (
            <div className="space-y-3">
              {!editMode ? <div className="flex gap-0.5 rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-950">
                {[
                  { value: "new", label: "New client" },
                  { value: "existing", label: "Existing client" },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={mode === option.value}
                    onClick={() => setMode(option.value)}
                    className={cn(
                      "flex-1 rounded-md px-3 py-1.5 text-[12.5px] font-medium outline-none transition",
                      "focus-visible:ring-2 focus-visible:ring-blue-500/40",
                      mode === option.value
                        ? "bg-white font-semibold text-slate-900 shadow-crm-soft dark:bg-slate-800 dark:text-slate-50"
                        : "text-slate-500 hover:text-slate-900 dark:text-slate-400",
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div> : null}

              {mode === "new" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field
                    label="Client type"
                    hint="This decides which documents are asked for"
                    className="sm:col-span-2"
                  >
                    <div className="flex gap-0.5 rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-950">
                      {CLIENT_KINDS.map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          aria-pressed={form.kind === option.id}
                          onClick={() => setForm((value) => ({ ...value, kind: option.id }))}
                          className={cn(
                            "flex-1 rounded-md px-3 py-1.5 text-[12.5px] outline-none transition",
                            "focus-visible:ring-2 focus-visible:ring-blue-500/40",
                            form.kind === option.id
                              ? "bg-white font-semibold text-slate-900 shadow-crm-soft dark:bg-slate-800 dark:text-slate-50"
                              : "font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400",
                          )}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </Field>

                  {isCompany ? (
                    <>
                      <Field label="Company name" className="sm:col-span-2">
                        <Input value={form.companyName} onChange={set("companyName")} placeholder="Nexbridge Analytics" />
                      </Field>
                      <Field label="Entity type">
                        <Select value={form.entityType} onChange={set("entityType")}>
                          {ENTITY_TYPES.map((type) => (
                            <option key={type}>{type}</option>
                          ))}
                        </Select>
                      </Field>
                      <Field label="Authorised signatory" hint="The person who signs the agreement">
                        <Input value={form.contactPerson} onChange={set("contactPerson")} placeholder="Rohit Ambekar" />
                      </Field>
                    </>
                  ) : (
                    <>
                      <Field label="Full name" className="sm:col-span-2">
                        <Input value={form.companyName} onChange={set("companyName")} placeholder="Rohit Ambekar" />
                      </Field>
                      <Field label="PAN" hint="As printed on the card">
                        <Input value={form.pan} onChange={set("pan")} placeholder="ABCDE1234F" />
                      </Field>
                      <Field label="Occupation">
                        <Select value={form.industry} onChange={set("industry")}>
                          {INDUSTRIES.map((industry) => (
                            <option key={industry}>{industry}</option>
                          ))}
                        </Select>
                      </Field>
                    </>
                  )}

                  <Field label="Phone">
                    <Input value={form.phone} onChange={set("phone")} placeholder="+91 98200 00000" />
                  </Field>
                  <Field label="Email">
                    <Input type="email" value={form.email} onChange={set("email")} placeholder="rohit@nexbridge.in" />
                  </Field>

                  {isCompany ? (
                    <>
                      <Field label="Industry">
                        <Select value={form.industry} onChange={set("industry")}>
                          {INDUSTRIES.map((industry) => (
                            <option key={industry}>{industry}</option>
                          ))}
                        </Select>
                      </Field>
                      <Field label="GSTIN" hint="Optional. Needed before the first invoice.">
                        <Input value={form.gstin} onChange={set("gstin")} placeholder="27ABCDE1234K1Z5" />
                      </Field>
                    </>
                  ) : null}
                </div>
              ) : (
                <div>
                  <Input
                    leftIcon={Search}
                    value={clientQuery}
                    onChange={(event) => setClientQuery(event.target.value)}
                    placeholder="Search clients already in this coworking space"
                  />
                  <ul className="custom-scrollbar mt-2 max-h-[260px] space-y-1 overflow-y-auto">
                    {matchingClients.map((client) => (
                      <li key={client.id}>
                        <button
                          type="button"
                          aria-pressed={existingClientId === client.id}
                          onClick={() => setExistingClientId(client.id)}
                          className={cn(
                            "flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left outline-none transition",
                            "focus-visible:ring-2 focus-visible:ring-blue-500/40",
                            existingClientId === client.id
                              ? "border-blue-600 bg-blue-50 dark:bg-blue-500/10"
                              : "border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900",
                          )}
                        >
                          <Building2 aria-hidden="true" size={15} className="shrink-0 text-slate-400" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[12.5px] font-medium text-slate-900 dark:text-slate-100">
                              {client.name}
                            </span>
                            <span className="block truncate text-[11px] text-slate-500 dark:text-slate-400">
                              {client.industry} · already in {client.cabinLabel}
                            </span>
                          </span>
                          {existingClientId === client.id ? (
                            <Check aria-hidden="true" size={14} className="shrink-0 text-blue-600" />
                          ) : null}
                        </button>
                      </li>
                    ))}
                    {!matchingClients.length ? (
                      <li className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-[12px] text-slate-500 dark:border-slate-600 dark:text-slate-400">
                        No client matches that. Switch to New client to add them.
                      </li>
                    ) : null}
                  </ul>
                </div>
              )}
            </div>
          ) : null}

          {step === 1 ? (
            <>
              <p className="mb-3 text-[12.5px] text-slate-600 dark:text-slate-300">
                {isCompany
                  ? "A company signs through someone, so there are two identities to establish - the entity and the person authorised to bind it - plus the authorisation joining them."
                  : "An individual signs for themselves, so their identity is the whole of it."}
              </p>
              <Field label="Contact date of birth" hint="Extracted dates must be checked against the document"><Input type="date" value={form.dateOfBirth} max={today()} onChange={set("dateOfBirth")} /></Field>
              <DocumentChecklist
                onDateOfBirth={date => setForm(old => ({ ...old, dateOfBirth: old.dateOfBirth || date }))}
                kind={form.kind}
                documents={form.documents}
                onChange={(documents) => setForm((value) => ({ ...value, documents }))}
              />
              <p className="mt-3 text-[11.5px] text-slate-500 dark:text-slate-400">
                You can onboard before every document is in. Whatever is outstanding stays flagged on the client so it
                can be chased rather than forgotten.
              </p>
            </>
          ) : null}

          {step === 2 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Start date">
                <Input type="date" value={terms.startDate} onChange={setTerm("startDate")} />
              </Field>
              <Field label="Term">
                <div className="flex gap-0.5 rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-950">
                  {TERM_OPTIONS.map((months) => (
                    <button
                      key={months}
                      type="button"
                      aria-pressed={terms.termMonths === months}
                      onClick={() => setTerms((value) => ({ ...value, termMonths: months }))}
                      className={cn(
                        "flex-1 rounded-md py-1.5 text-[12px] font-medium tabular-nums outline-none transition",
                        "focus-visible:ring-2 focus-visible:ring-blue-500/40",
                        terms.termMonths === months
                          ? "bg-white font-semibold text-slate-900 shadow-crm-soft dark:bg-slate-800 dark:text-slate-50"
                          : "text-slate-500 hover:text-slate-900 dark:text-slate-400",
                      )}
                    >
                      {months}m
                    </button>
                  ))}
                </div>
              </Field>

              <Field
                label="Monthly rent"
                hint={
                  discount > 0
                    ? `${formatCurrency(discount)} below the ${formatCurrency(listRent)} list rate`
                    : `List rate ${formatCurrency(listRent)} for these cabins`
                }
              >
                <Input
                  type="number"
                  value={terms.rentOverride}
                  onChange={setTerm("rentOverride")}
                  placeholder={String(listRent)}
                />
              </Field>
              <Field label="Deposit" hint={formatCurrency(deposit)}>
                <Select
                  value={terms.depositMonths}
                  onChange={(event) => setTerms((value) => ({ ...value, depositMonths: Number(event.target.value) }))}
                >
                  {[1, 2, 3, 6].map((months) => (
                    <option key={months} value={months}>
                      {months} {months === 1 ? "month" : "months"} of rent
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Lock-in">
                <Select
                  value={terms.lockInMonths}
                  onChange={(event) => setTerms((value) => ({ ...value, lockInMonths: Number(event.target.value) }))}
                >
                  {[0, 3, 6, 12].map((months) => (
                    <option key={months} value={months}>
                      {months ? `${months} months` : "No lock-in"}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Notice period (days)"><Input type="number" min="0" value={terms.noticePeriodDays} onChange={setTerm("noticePeriodDays")} /></Field>
              <Field label="Token amount paid" hint="Recorded separately from rent and deposit"><Input type="number" min="0" value={terms.tokenAmount} onChange={setTerm("tokenAmount")} /></Field>
              <fieldset className="rounded-lg border p-3 sm:col-span-2"><legend className="px-2 text-sm font-semibold">Security Cheque</legend><div className="grid gap-3 sm:grid-cols-2">{["number", "bank", "amount", "date", "notes"].map(key => <Field key={key} label={key === "number" ? "Cheque number" : key.charAt(0).toUpperCase() + key.slice(1)}><Input type={key === "amount" ? "number" : key === "date" ? "date" : "text"} min={key === "amount" ? "0" : undefined} value={terms.securityCheque[key]} onChange={e => setTerms(old => ({ ...old, securityCheque: { ...old.securityCheque, [key]: e.target.value } }))}/></Field>)}</div></fieldset>
              <Field label="Total capacity" hint="Cabins are let whole, not by the seat">
                <Input value={`${capacity} seater`} readOnly disabled />
              </Field>

              <Field label="Notes" className="sm:col-span-2">
                <Input
                  value={terms.notes}
                  onChange={setTerm("notes")}
                  placeholder="Anything the community manager should know on day one"
                />
              </Field>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-3">
              <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Client
                </h3>
                <p className="mt-1 text-[14px] font-semibold text-slate-950 dark:text-slate-50">
                  {clientName || "Not named yet"}
                </p>
                <p className="text-[12px] text-slate-500 dark:text-slate-400">
                  {mode === "new"
                    ? [form.contactPerson, form.phone, form.industry].filter(Boolean).join(" · ") || "New client record"
                    : `${selectedClient?.contactPerson} · ${selectedClient?.phone} · existing client`}
                </p>
              </div>

              <div
                className={cn(
                  "rounded-lg border p-3",
                  kyc.complete
                    ? "border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10"
                    : "border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10",
                )}
              >
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Documents
                </h3>
                <p
                  className={cn(
                    "mt-1 text-[12.5px] font-semibold",
                    kyc.complete ? "text-emerald-800 dark:text-emerald-300" : "text-amber-800 dark:text-amber-300",
                  )}
                >
                  {kyc.complete
                    ? `KYC complete - all ${kyc.required} required documents on file`
                    : `${kyc.uploaded} of ${kyc.required} required documents on file`}
                </p>
                {!kyc.complete ? (
                  <p className="mt-0.5 text-[11.5px] text-amber-700 dark:text-amber-300/80">
                    Outstanding: {kyc.missing.map((doc) => doc.label).join(", ")}.
                  </p>
                ) : null}
              </div>

              <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  What changes on confirm
                </h3>
                <ul className="mt-2 space-y-1 text-[12.5px] text-slate-700 dark:text-slate-300">
                  {[
                    `${cabins.length} ${cabins.length === 1 ? "cabin flips" : "cabins flip"} to Booked on the board`,
                    `Seating for ${capacity} goes to ${clientName || "the client"}`,
                    `A ${terms.termMonths}-month agreement is raised from ${formatDate(terms.startDate)}`,
                    `First invoice of ${formatCurrency(rent + deposit)} is scheduled, rent plus deposit`,
                  ].map((line) => (
                    <li key={line} className="flex items-start gap-2">
                      <Check aria-hidden="true" size={13} className="mt-0.5 shrink-0 text-emerald-600" />
                      {line}
                    </li>
                  ))}
                </ul>
              </div>

              {terms.notes ? (
                <p className="rounded-lg border border-slate-200 p-3 text-[12.5px] text-slate-600 dark:border-slate-700 dark:text-slate-300">
                  {terms.notes}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <OrderSummary
          cabins={cabins}
          rent={rent}
          deposit={deposit}
          term={terms.termMonths}
          startDate={terms.startDate}
        />
      </div>
    </Modal>
  );
};

export default OnboardClientDialog;
