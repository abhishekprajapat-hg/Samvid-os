import React, { useState } from "react";
import { Loader2, ShieldAlert, UserPlus } from "lucide-react";
import { Button, Input, Modal, cn } from "../../../components/ui";
import { EMPTY_CONTACT } from "../contactBulkImport";

const Field = ({ label, children, hint, error, required, className }) => (
  <label className={cn("block", className)}>
    <span className="mb-1 block text-[11.5px] font-medium text-slate-600 dark:text-slate-300">
      {label}
      {required ? <span className="text-rose-500"> *</span> : null}
    </span>
    {children}
    {error ? <span className="mt-1 block text-[11px] font-medium text-rose-600">{error}</span> : null}
    {!error && hint ? <span className="mt-1 block text-[11px] text-slate-400 dark:text-slate-500">{hint}</span> : null}
  </label>
);

// Mirrors normalizePhone on the server, so the form refuses exactly what the
// API would refuse rather than letting a round trip deliver the bad news.
const normalizePhone = (value) => {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return digits.length >= 7 && digits.length <= 15 ? digits : "";
};

const validate = (draft) => {
  const errors = {};
  if (!String(draft.name || "").trim()) errors.name = "Name is required";
  if (!String(draft.phone || "").trim()) errors.phone = "Phone is required";
  else if (!normalizePhone(draft.phone)) errors.phone = "Enter a valid phone number";
  const email = String(draft.email || "").trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Enter a valid email address";
  return errors;
};

/*
 * Add or edit one owner or broker.
 *
 * The same dialog does both, because the difference is which record is already
 * loaded into it - a separate "edit" form would be the same seven fields with a
 * different title. Editing is keyed on phone server-side, so changing the
 * number on an existing record writes a new contact rather than renaming that
 * one; the hint says so instead of leaving it to be discovered.
 */
const ContactFormDialog = ({ open, kind, contact, saving, onClose, onSubmit }) => {
  const isEdit = Boolean(contact?._id);
  const label = kind === "BROKER" ? "broker" : "owner";
  const [draft, setDraft] = useState(() => ({ ...EMPTY_CONTACT, ...(contact || {}) }));
  const [errors, setErrors] = useState({});

  const set = (field) => (event) => {
    setDraft((value) => ({ ...value, [field]: event.target.value }));
    setErrors((value) => (value[field] ? { ...value, [field]: "" } : value));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const found = validate(draft);
    setErrors(found);
    if (Object.keys(found).length) return;
    onSubmit(draft);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={isEdit ? `Edit ${label}` : `Add ${label}`}
      description={
        kind === "BROKER" && !isEdit
          ? "Saved brokers are excluded from lead intake — any enquiry on this number is refused before it becomes a lead."
          : "Phone number is the key. Saving against a number already on file updates that record instead of creating a second one."
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button
            leftIcon={saving ? undefined : UserPlus}
            disabled={saving}
            onClick={handleSubmit}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : null}
            {saving ? "Saving…" : isEdit ? "Save changes" : `Add ${label}`}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-2">
        <Field label="Name" required error={errors.name}>
          <Input value={draft.name} onChange={set("name")} placeholder="Full name" autoFocus />
        </Field>
        <Field
          label="Phone"
          required
          error={errors.phone}
          hint={isEdit ? "Changing this creates a separate record rather than renaming this one" : undefined}
        >
          <Input value={draft.phone} onChange={set("phone")} placeholder="9876543210" inputMode="tel" />
        </Field>
        <Field label="Email" error={errors.email}>
          <Input value={draft.email} onChange={set("email")} placeholder="name@example.com" type="email" />
        </Field>
        <Field label="Company / firm">
          <Input value={draft.company} onChange={set("company")} placeholder={kind === "BROKER" ? "Brokerage name" : "Owning entity"} />
        </Field>
        <Field label="City">
          <Input value={draft.city} onChange={set("city")} placeholder="Indore" />
        </Field>
        <Field label="Property details" className="sm:col-span-2" hint="Which units or properties this contact is tied to">
          <textarea
            value={draft.propertyDetails}
            onChange={set("propertyDetails")}
            rows={2}
            maxLength={4000}
            placeholder="2 shops on MG Road, 1 office in Vijay Nagar"
            className="w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-[13px] text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          <textarea
            value={draft.notes}
            onChange={set("notes")}
            rows={2}
            maxLength={3000}
            placeholder="Anything worth remembering before the next call"
            className="w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-[13px] text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </Field>
        {kind === "BROKER" && !isEdit ? (
          <p className="flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[11.5px] text-amber-800 sm:col-span-2">
            <ShieldAlert size={13} className="mt-px shrink-0" />
            If this number has an open enquiry you still want to work, close it before saving — existing leads stay, but no new ones will come through.
          </p>
        ) : null}
        {/* Enter submits the form; the footer button lives outside it. */}
        <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
      </form>
    </Modal>
  );
};

export default ContactFormDialog;
