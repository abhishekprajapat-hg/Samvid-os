import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Glyph } from "../../components/ui/Glyph";
import {
  FieldCol,
  FieldRow,
  SectionCard,
  SelectField,
  Segmented,
  TextField,
} from "../../components/ui/form";
import { Avatar, Banner, BrandButton, BrandPage, Chip, ChipRow, KeyValue } from "../../components/brand/kit";
import { brand, brandStyles, round, type as t } from "../../theme/brand";
import { formatCurrency, formatDate, toDateKey } from "../../utils/format";
import { useBoard } from "./boardStore";
import { clientsFrom, type BoardClient, type ClientDocument, type OnboardTerms } from "./boardReducer";
import { CLIENT_KINDS, ENTITY_TYPES, kycStatusOf } from "./kycDocuments";
import { DocumentChecklist } from "./components/DocumentChecklist";

/*
 * Checkout for the cabins in the cart - web's OnboardClientDialog.jsx, given a
 * page because four steps and an order summary do not fit a sheet.
 *
 * Client, documents, agreement, review: that is where the natural seams are,
 * and nobody should sign a 12-month agreement off a screen they have not
 * re-read. The same page edits an onboarded client (`clientId` param), exactly
 * as web reuses its dialog in edit mode.
 *
 * One deliberate difference: web draws a "New client / Existing client" switch
 * whose search never returns anything (its match list is a hard-coded empty
 * array), so the Existing path cannot be completed there. Here it searches the
 * clients already on the board, and picking one books the cabins onto that same
 * client record - which is what the switch was drawn to do.
 */

const STEPS = ["Client", "Documents", "Agreement", "Review"];
const TERM_OPTIONS = [3, 6, 12, 24];
const INDUSTRIES = [
  "Data & AI", "Consulting", "Financial services", "Healthcare", "Legal",
  "Logistics", "Media & content", "Product design", "Retail tech", "Other",
];

const addMonths = (iso: string, months: number) => {
  const date = new Date(iso);
  date.setMonth(date.getMonth() + months);
  return date;
};

type Cheque = {
  number: string;
  bank: string;
  amount: string;
  date: string;
  notes: string;
  // Cheque copy uploaded from web; carried through so an edit here keeps it.
  file?: { url?: string; fileName?: string; size?: number; type?: string; uploadedAt?: string } | null;
};

// "Other" opens a free-text box; what is typed is the saved work profile (as on web).
const splitIndustry = (value: unknown) => {
  const text = String(value || "").trim();
  if (!text) return { industryChoice: INDUSTRIES[0], industryCustom: "" };
  if (INDUSTRIES.includes(text) && text !== "Other") return { industryChoice: text, industryCustom: "" };
  return { industryChoice: "Other", industryCustom: text === "Other" ? "" : text };
};
const resolveIndustry = (choice: string, custom: string) => (choice === "Other" ? custom.trim() || "Other" : choice);

export const OnboardClientScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const [board, dispatch] = useBoard();
  const cabinCodes: string[] = route.params?.cabinCodes || [];
  const editClientId: string = route.params?.clientId || "";
  const editMode = Boolean(editClientId);

  const cabins = useMemo(
    () =>
      editMode
        ? board.cabins.filter((cabin) => cabin.client?.id === editClientId)
        : board.cabins.filter((cabin) => cabinCodes.includes(cabin.code)),
    [board.cabins, cabinCodes, editClientId, editMode],
  );
  const initialClient = editMode ? cabins[0]?.client || null : null;
  const initialContract = editMode ? cabins[0]?.contract || null : null;

  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [clientQuery, setClientQuery] = useState("");
  const [existingClientId, setExistingClientId] = useState("");
  const [form, setForm] = useState(() => ({
    kind: String(initialClient?.kind || "company"),
    entityType: String(initialClient?.entityType || ENTITY_TYPES[0]),
    companyName: String(initialClient?.name || initialClient?.companyName || ""),
    contactPerson: String(initialClient?.contactPerson || ""),
    dateOfBirth: String(initialClient?.dateOfBirth || "").slice(0, 10),
    phone: String(initialClient?.phone || ""),
    email: String(initialClient?.email || ""),
    ...splitIndustry(initialClient?.industry),
    signingAuthority2: String(initialClient?.signingAuthority2 || ""),
    secondPersonName: String(initialClient?.secondPersonName || ""),
    gstin: String(initialClient?.gstin || ""),
    pan: String(initialClient?.pan || ""),
    documents: (Array.isArray(initialClient?.documents) ? initialClient?.documents : []) as ClientDocument[],
  }));

  const [terms, setTerms] = useState(() => {
    const months = initialContract
      ? Math.max(
          1,
          Math.round(
            (new Date(initialContract.endDate).getTime() - new Date(initialContract.startDate).getTime())
              / (30 * 24 * 60 * 60 * 1000),
          ),
        )
      : 12;
    const editRent = cabins.reduce((sum, cabin) => sum + (cabin.contract?.monthlyRent || 0), 0);
    const cheque = (initialContract?.securityCheque || {}) as Partial<Cheque> & { amount?: number | string };
    return {
      startDate: String(initialContract?.startDate || "").slice(0, 10) || toDateKey(),
      termMonths: months,
      lockInMonths: initialContract?.lockInMonths ?? 6,
      rentOverride: editMode ? String(editRent) : "",
      depositMonths:
        initialContract?.depositMonths
        || (initialContract && initialContract.monthlyRent
          ? Math.max(1, Math.round(initialContract.deposit / initialContract.monthlyRent))
          : 2),
      depositMode: (initialContract?.depositMode === "custom" ? "custom" : "months") as "months" | "custom",
      depositAmount: initialContract?.depositMode === "custom"
        ? String(cabins.reduce((sum, cabin) => sum + Number(cabin.contract?.deposit || 0), 0))
        : "",
      noticePeriodDays: String(initialContract?.noticePeriodDays ?? 30),
      tokenAmount: String(
        editMode ? cabins.reduce((sum, cabin) => sum + Number(cabin.contract?.tokenAmount || 0), 0) : 0,
      ),
      securityCheque: {
        number: String(cheque.number || ""),
        bank: String(cheque.bank || ""),
        amount: String(cheque.amount ?? 0),
        date: String(cheque.date || ""),
        notes: String(cheque.notes || ""),
        file: cheque.file || null,
      } as Cheque,
      notes: String(initialContract?.notes || ""),
    };
  });

  const existingClients = useMemo(() => clientsFrom(board.cabins), [board.cabins]);
  const matchingClients = useMemo(() => {
    const query = clientQuery.trim().toLowerCase();
    if (!query) return existingClients.slice(0, 20);
    return existingClients.filter((client) =>
      `${client.name} ${client.contactPerson || ""} ${client.industry || ""}`.toLowerCase().includes(query),
    );
  }, [clientQuery, existingClients]);
  const selectedClient = existingClients.find((client) => client.id === existingClientId) || null;

  const listRent = cabins.reduce((sum, cabin) => sum + cabin.monthlyRent, 0);
  const rent = terms.rentOverride === "" ? listRent : Number(terms.rentOverride) || 0;
  const isCustomDeposit = terms.depositMode === "custom";
  const customDeposit = Number(terms.depositAmount);
  const deposit = isCustomDeposit ? (Number.isFinite(customDeposit) ? customDeposit : 0) : rent * terms.depositMonths;
  const capacity = cabins.reduce((sum, cabin) => sum + cabin.seats, 0);
  const discount = listRent - rent;

  const isCompany = form.kind === "company";
  const kyc = kycStatusOf({ kind: mode === "existing" ? selectedClient?.entityKind : form.kind, documents: mode === "existing" ? selectedClient?.documents : form.documents });
  const clientName = mode === "new" ? form.companyName.trim() : selectedClient?.name || "";
  const validDeposit = !isCustomDeposit || (terms.depositAmount.trim() !== "" && Number.isFinite(customDeposit) && customDeposit >= 0);
  const validTerms = validDeposit && [terms.noticePeriodDays, terms.tokenAmount, terms.securityCheque.amount].every(
    (value) => Number.isFinite(Number(value)) && Number(value) >= 0,
  );
  const today = toDateKey();
  const validBirthDate =
    !form.dateOfBirth || (/^\d{4}-\d{2}-\d{2}$/.test(form.dateOfBirth) && form.dateOfBirth >= "1900-01-01" && form.dateOfBirth <= today);
  const validStart = /^\d{4}-\d{2}-\d{2}$/.test(terms.startDate) && !Number.isNaN(new Date(terms.startDate).getTime());
  const validWorkProfile = form.industryChoice !== "Other" || Boolean(form.industryCustom.trim());
  const canAdvance = step === 0 ? Boolean(clientName) && validWorkProfile : validTerms && validBirthDate && validStart;

  const set = (key: keyof typeof form) => (value: string) => setForm((current) => ({ ...current, [key]: value }));

  const clientPayload = (() => {
    const { industryChoice, industryCustom, ...rest } = form;
    return { ...rest, industry: resolveIndustry(industryChoice, industryCustom), name: clientName };
  })();

  const confirm = () => {
    const termsPayload: OnboardTerms = {
      startDate: terms.startDate,
      termMonths: terms.termMonths,
      lockInMonths: terms.lockInMonths,
      rent,
      depositMonths: terms.depositMonths,
      depositMode: terms.depositMode,
      depositAmount: isCustomDeposit ? customDeposit : null,
      noticePeriodDays: terms.noticePeriodDays,
      tokenAmount: terms.tokenAmount,
      securityCheque: { ...terms.securityCheque },
      notes: terms.notes,
    };
    if (editMode) {
      dispatch({
        type: "UPDATE_CLIENT",
        clientId: editClientId,
        client: clientPayload as Partial<BoardClient>,
        terms: termsPayload,
      });
    } else {
      const client =
        mode === "existing" && selectedClient
          ? ({
              id: selectedClient.id,
              name: selectedClient.name,
              kind: selectedClient.entityKind,
              entityType: selectedClient.entityType,
              industry: selectedClient.industry,
              contactPerson: selectedClient.contactPerson,
              phone: selectedClient.phone,
              email: selectedClient.email,
              gstin: selectedClient.gstin,
              pan: selectedClient.pan,
              dateOfBirth: selectedClient.dateOfBirth,
              documents: selectedClient.documents,
            } as BoardClient)
          : (clientPayload as unknown as BoardClient);
      dispatch({ type: "ONBOARD", cabinCodes: cabins.map((cabin) => cabin.code), client, terms: termsPayload });
    }
    navigation.navigate("CoworkingBooking", {
      notice: editMode
        ? `${clientName} updated.`
        : `${clientName} onboarded into ${cabins.map((cabin) => cabin.label).join(", ")}.`,
    });
  };

  if (!cabins.length) {
    return (
      <BrandPage title={editMode ? "Edit onboarded client" : "Onboard client"} onBack={() => navigation.goBack()}>
        <Banner tone="warn" message="Those cabins are no longer on the board. Go back and pick again." />
      </BrandPage>
    );
  }

  const footer = (
    <View style={styles.footerRow}>
      <BrandButton
        title="Back"
        icon="arrow-back"
        variant="ghost"
        disabled={step === 0}
        onPress={() => setStep((value) => Math.max(0, value - 1))}
      />
      <View style={styles.flex} />
      {step < STEPS.length - 1 ? (
        <BrandButton title="Continue" icon="arrow-forward" disabled={!canAdvance} onPress={() => setStep((value) => value + 1)} />
      ) : (
        <BrandButton
          title={editMode ? "Save client and agreement" : "Confirm and allot"}
          icon="person-add"
          disabled={!validTerms || !validBirthDate || !validStart || !clientName}
          onPress={confirm}
        />
      )}
    </View>
  );

  return (
    <BrandPage
      title={editMode ? "Edit onboarded client" : "Onboard client"}
      subtitle={`${cabins.length} ${cabins.length === 1 ? "cabin" : "cabins"} · seats ${capacity} · ${cabins.map((cabin) => cabin.label).join(", ")}`}
      onBack={() => navigation.goBack()}
      footer={footer}
    >
      <View style={styles.stepper}>
        {STEPS.map((label, index) => {
          const done = index < step;
          const active = index === step;
          return (
            <View key={label} style={styles.step}>
              <View style={[styles.stepDot, done && styles.stepDone, active && styles.stepActive]}>
                {done ? (
                  <Glyph name="checkmark" size={11} color={brand.onPrimary} />
                ) : (
                  <Text style={[styles.stepNumber, active && styles.stepNumberActive]}>{index + 1}</Text>
                )}
              </View>
              <Text style={[styles.stepLabel, active && styles.stepLabelActive]}>{label}</Text>
            </View>
          );
        })}
      </View>

      {step === 0 ? (
        <SectionCard>
          {!editMode ? (
            <View style={styles.gapBottom}>
              <Segmented
                options={[
                  { label: "New client", value: "new" },
                  { label: "Existing client", value: "existing" },
                ]}
                value={mode}
                onChange={(value) => setMode(value as "new" | "existing")}
              />
            </View>
          ) : null}

          {mode === "new" ? (
            <>
              <Text style={styles.fieldLabel}>Client type</Text>
              <ChipRow wrap>
                {CLIENT_KINDS.map((option) => (
                  <Chip
                    key={option.id}
                    label={option.label}
                    active={form.kind === option.id}
                    onPress={() => setForm((value) => ({ ...value, kind: option.id }))}
                  />
                ))}
              </ChipRow>
              <Text style={styles.hint}>This decides which documents are asked for</Text>

              {isCompany ? (
                <>
                  <TextField label="Company name" value={form.companyName} onChangeText={set("companyName")} placeholder="Nexbridge Analytics" required />
                  <SelectField
                    label="Entity type"
                    value={form.entityType}
                    options={ENTITY_TYPES.map((type) => ({ label: type, value: type }))}
                    onChange={set("entityType")}
                  />
                  <TextField label="Signing authority 1" value={form.contactPerson} onChangeText={set("contactPerson")} placeholder="Rohit Ambekar" />
                  <TextField label="Signing authority 2 (optional)" value={form.signingAuthority2} onChangeText={set("signingAuthority2")} placeholder="Second signatory name" />
                </>
              ) : (
                <>
                  <TextField label="Full name" value={form.companyName} onChangeText={set("companyName")} placeholder="Rohit Ambekar" required />
                  <TextField label="PAN" value={form.pan} onChangeText={set("pan")} placeholder="ABCDE1234F" autoCapitalize="characters" />
                  <SelectField
                    label="Work profile"
                    value={form.industryChoice}
                    options={INDUSTRIES.map((item) => ({ label: item, value: item }))}
                    onChange={set("industryChoice")}
                  />
                  {form.industryChoice === "Other" ? (
                    <TextField label="Specify work profile" value={form.industryCustom} onChangeText={set("industryCustom")} placeholder="e.g. Cybersecurity" required />
                  ) : null}
                  <TextField label="Person 2 name (optional)" value={form.secondPersonName} onChangeText={set("secondPersonName")} placeholder="Second person's full name" />
                </>
              )}
              <FieldRow>
                <FieldCol>
                  <TextField label="Phone" value={form.phone} onChangeText={set("phone")} placeholder="+91 98200 00000" keyboardType="phone-pad" />
                </FieldCol>
                <FieldCol>
                  <TextField label="Email" value={form.email} onChangeText={set("email")} placeholder="rohit@nexbridge.in" keyboardType="email-address" autoCapitalize="none" />
                </FieldCol>
              </FieldRow>
              {isCompany ? (
                <>
                  <SelectField
                    label="Work profile / industry"
                    value={form.industryChoice}
                    options={INDUSTRIES.map((item) => ({ label: item, value: item }))}
                    onChange={set("industryChoice")}
                  />
                  {form.industryChoice === "Other" ? (
                    <TextField label="Specify work profile" value={form.industryCustom} onChangeText={set("industryCustom")} placeholder="e.g. Cybersecurity" required />
                  ) : null}
                  <TextField label="GSTIN" value={form.gstin} onChangeText={set("gstin")} placeholder="27ABCDE1234K1Z5" autoCapitalize="characters" />
                  <Text style={styles.hintTight}>Optional. Needed before the first invoice.</Text>
                </>
              ) : null}
            </>
          ) : (
            <>
              <TextField
                value={clientQuery}
                onChangeText={setClientQuery}
                placeholder="Search clients already in this coworking space"
                icon="search"
              />
              {matchingClients.length ? (
                matchingClients.map((client) => (
                  <Pressable
                    key={client.id}
                    onPress={() => setExistingClientId(client.id)}
                    style={[styles.clientOption, existingClientId === client.id && styles.clientOptionActive]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: existingClientId === client.id }}
                  >
                    <Avatar name={client.name} size={30} />
                    <View style={styles.flex}>
                      <Text style={styles.optionName} numberOfLines={1}>
                        {client.name}
                      </Text>
                      <Text style={styles.optionMeta} numberOfLines={1}>
                        {client.industry || "Client"} · already in {client.cabins.map((cabin) => cabin.label).join(", ")}
                      </Text>
                    </View>
                    {existingClientId === client.id ? <Glyph name="checkmark" size={16} color={brand.primary} /> : null}
                  </Pressable>
                ))
              ) : (
                <Banner tone="neutral" message="No client matches that. Switch to New client to add them." />
              )}
            </>
          )}
        </SectionCard>
      ) : null}

      {step === 1 ? (
        <SectionCard>
          {mode === "existing" && selectedClient ? (
            <>
              <Text style={styles.body}>
                {selectedClient.name}'s documents are already on file with their other cabins. Manage them from their
                client profile.
              </Text>
              <DocumentChecklist kind={selectedClient.entityKind} documents={selectedClient.documents || []} readOnly />
            </>
          ) : (
            <>
              <Text style={styles.body}>
                {isCompany
                  ? "A company signs through someone, so there are two identities to establish - the entity and the person authorised to bind it - plus the authorisation joining them."
                  : "An individual signs for themselves, so their identity is the whole of it."}
              </Text>
              <TextField
                label="Contact date of birth"
                value={form.dateOfBirth}
                onChangeText={set("dateOfBirth")}
                placeholder="YYYY-MM-DD"
                keyboardType="numbers-and-punctuation"
              />
              {!validBirthDate ? <Text style={styles.error}>Enter a date between 1900-01-01 and today, as YYYY-MM-DD.</Text> : null}
              <DocumentChecklist
                kind={form.kind}
                documents={form.documents}
                onChange={(documents) => setForm((value) => ({ ...value, documents }))}
              />
              <Text style={styles.hintTight}>
                You can onboard before every document is in. Whatever is outstanding stays flagged on the client so it
                can be chased rather than forgotten.
              </Text>
            </>
          )}
        </SectionCard>
      ) : null}

      {step === 2 ? (
        <SectionCard>
          <TextField
            label="Start date"
            value={terms.startDate}
            onChangeText={(value) => setTerms((current) => ({ ...current, startDate: value }))}
            placeholder="YYYY-MM-DD"
            keyboardType="numbers-and-punctuation"
          />
          {!validStart ? <Text style={styles.error}>Enter the start date as YYYY-MM-DD.</Text> : null}
          <Text style={styles.fieldLabel}>Term</Text>
          <Segmented
            options={TERM_OPTIONS.map((months) => ({ label: `${months}m`, value: String(months) }))}
            value={String(terms.termMonths)}
            onChange={(value) => setTerms((current) => ({ ...current, termMonths: Number(value) }))}
          />
          <View style={styles.gapTop}>
            <TextField
              label="Monthly rent"
              value={terms.rentOverride}
              onChangeText={(value) => setTerms((current) => ({ ...current, rentOverride: value.replace(/[^\d.]/g, "") }))}
              placeholder={String(listRent)}
              keyboardType="number-pad"
            />
            <Text style={styles.hintTight}>
              {discount > 0
                ? `${formatCurrency(discount)} below the ${formatCurrency(listRent)} list rate`
                : `List rate ${formatCurrency(listRent)} for these cabins`}
            </Text>
          </View>
          <FieldRow>
            <FieldCol>
              <SelectField
                label={`Deposit · ${formatCurrency(deposit)}`}
                value={isCustomDeposit ? "custom" : String(terms.depositMonths)}
                options={[
                  ...[1, 2, 3, 6].map((months) => ({
                    label: `${months} ${months === 1 ? "month" : "months"} of rent`,
                    value: String(months),
                  })),
                  { label: "Custom amount", value: "custom" },
                ]}
                onChange={(value) => setTerms((current) => (value === "custom"
                  ? { ...current, depositMode: "custom" as const, depositAmount: current.depositAmount || String(deposit || "") }
                  : { ...current, depositMode: "months" as const, depositMonths: Number(value) }))}
              />
              {isCustomDeposit ? (
                <TextField
                  label="Deposit amount (₹)"
                  value={terms.depositAmount}
                  onChangeText={(value) => setTerms((current) => ({ ...current, depositAmount: value.replace(/[^\d.]/g, "") }))}
                  keyboardType="number-pad"
                  placeholder="e.g. 75000"
                  required
                />
              ) : null}
            </FieldCol>
            <FieldCol>
              <SelectField
                label="Lock-in"
                value={String(terms.lockInMonths)}
                options={[0, 3, 6, 12].map((months) => ({
                  label: months ? `${months} months` : "No lock-in",
                  value: String(months),
                }))}
                onChange={(value) => setTerms((current) => ({ ...current, lockInMonths: Number(value) }))}
              />
            </FieldCol>
          </FieldRow>
          <FieldRow>
            <FieldCol>
              <TextField
                label="Notice period (days)"
                value={terms.noticePeriodDays}
                onChangeText={(value) => setTerms((current) => ({ ...current, noticePeriodDays: value.replace(/[^\d]/g, "") }))}
                keyboardType="number-pad"
              />
            </FieldCol>
            <FieldCol>
              <TextField
                label="Token amount paid"
                value={terms.tokenAmount}
                onChangeText={(value) => setTerms((current) => ({ ...current, tokenAmount: value.replace(/[^\d.]/g, "") }))}
                keyboardType="number-pad"
              />
            </FieldCol>
          </FieldRow>
          <Text style={styles.hintTight}>The token is recorded separately from rent and deposit.</Text>

          <Text style={styles.subHead}>Security cheque</Text>
          <FieldRow>
            <FieldCol>
              <TextField
                label="Cheque number"
                value={terms.securityCheque.number}
                onChangeText={(value) => setTerms((current) => ({ ...current, securityCheque: { ...current.securityCheque, number: value } }))}
              />
            </FieldCol>
            <FieldCol>
              <TextField
                label="Bank"
                value={terms.securityCheque.bank}
                onChangeText={(value) => setTerms((current) => ({ ...current, securityCheque: { ...current.securityCheque, bank: value } }))}
              />
            </FieldCol>
          </FieldRow>
          <FieldRow>
            <FieldCol>
              <TextField
                label="Amount"
                value={terms.securityCheque.amount}
                keyboardType="number-pad"
                onChangeText={(value) =>
                  setTerms((current) => ({ ...current, securityCheque: { ...current.securityCheque, amount: value.replace(/[^\d.]/g, "") } }))
                }
              />
            </FieldCol>
            <FieldCol>
              <TextField
                label="Date"
                value={terms.securityCheque.date}
                placeholder="YYYY-MM-DD"
                keyboardType="numbers-and-punctuation"
                onChangeText={(value) => setTerms((current) => ({ ...current, securityCheque: { ...current.securityCheque, date: value } }))}
              />
            </FieldCol>
          </FieldRow>
          <TextField
            label="Cheque notes"
            value={terms.securityCheque.notes}
            onChangeText={(value) => setTerms((current) => ({ ...current, securityCheque: { ...current.securityCheque, notes: value } }))}
          />
          <TextField label="Total capacity" value={`${capacity} seater`} editable={false} />
          <Text style={styles.hintTight}>Cabins are let whole, not by the seat.</Text>
          <TextField
            label="Notes"
            value={terms.notes}
            onChangeText={(value) => setTerms((current) => ({ ...current, notes: value }))}
            placeholder="Anything the community manager should know on day one"
            multiline
          />
          {!validTerms ? <Text style={styles.error}>Notice period, token and cheque amount must be zero or more.</Text> : null}
        </SectionCard>
      ) : null}

      {step === 3 ? (
        <>
          <SectionCard title="Client">
            <Text style={styles.reviewName}>{clientName || "Not named yet"}</Text>
            <Text style={styles.body}>
              {mode === "new"
                ? [form.contactPerson, form.signingAuthority2 || form.secondPersonName, form.phone, clientPayload.industry].filter(Boolean).join(" · ") || "New client record"
                : [selectedClient?.contactPerson, selectedClient?.phone, "existing client"].filter(Boolean).join(" · ")}
            </Text>
          </SectionCard>
          <Banner
            tone={kyc.complete ? "success" : "warn"}
            title="Documents"
            message={
              kyc.complete
                ? `KYC complete - all ${kyc.required} required documents on file`
                : `${kyc.uploaded} of ${kyc.required} required documents on file. Outstanding: ${kyc.missing.map((doc) => doc.label).join(", ")}.`
            }
          />
          <SectionCard title="What changes on confirm">
            {[
              `${cabins.length} ${cabins.length === 1 ? "cabin flips" : "cabins flip"} to Booked on the board`,
              `Seating for ${capacity} goes to ${clientName || "the client"}`,
              `A ${terms.termMonths}-month agreement is raised from ${formatDate(terms.startDate)}`,
              `First invoice of ${formatCurrency(rent + deposit)} is scheduled, rent plus deposit`,
            ].map((line) => (
              <View key={line} style={styles.changeRow}>
                <Glyph name="checkmark" size={14} color={brand.primary} />
                <Text style={styles.body}>{line}</Text>
              </View>
            ))}
          </SectionCard>
          {terms.notes ? (
            <SectionCard>
              <Text style={styles.body}>{terms.notes}</Text>
            </SectionCard>
          ) : null}
        </>
      ) : null}

      {/* The number being agreed to never leaves the screen. */}
      <SectionCard title="Cabins selected">
        {cabins.map((cabin) => (
          <View key={cabin.code} style={styles.summaryRow}>
            <Text style={styles.summaryCode}>{cabin.label}</Text>
            <Text style={styles.summaryMeta}>{cabin.seats} seater</Text>
            <Text style={styles.summaryRent}>{formatCurrency(cabin.monthlyRent)}</Text>
          </View>
        ))}
        <View style={styles.summaryTotals}>
          <KeyValue label="Monthly rent" value={formatCurrency(rent)} />
          <KeyValue label="Security deposit" value={formatCurrency(deposit)} />
          <KeyValue label="Term" value={`${terms.termMonths} months`} />
          <KeyValue label="Due on signing" value={formatCurrency(rent + deposit)} />
        </View>
        {validStart ? (
          <Text style={styles.hintTight}>
            Starts {formatDate(terms.startDate)}, ends {formatDate(addMonths(terms.startDate, terms.termMonths))}
          </Text>
        ) : null}
      </SectionCard>
    </BrandPage>
  );
};

const styles = brandStyles((b) =>
  StyleSheet.create({
    flex: { flex: 1, minWidth: 0 },
    footerRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    gapBottom: { marginBottom: 14 },
    gapTop: { marginTop: 14 },
    stepper: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
    step: { alignItems: "center", gap: 4, flex: 1 },
    stepDot: {
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: b.fieldMuted,
    },
    stepDone: { backgroundColor: b.deep },
    stepActive: { backgroundColor: b.primary },
    stepNumber: { fontSize: t.label, fontWeight: "700", color: b.textMuted },
    stepNumberActive: { color: b.onPrimary },
    stepLabel: { fontSize: t.label, color: b.textMuted },
    stepLabelActive: { fontWeight: "700", color: b.text },
    fieldLabel: { marginBottom: 8, fontSize: t.fieldLabel, fontWeight: "500", color: b.text },
    hint: { marginTop: 6, marginBottom: 14, fontSize: t.label, color: b.textMuted },
    hintTight: { marginTop: -8, marginBottom: 14, fontSize: t.label, lineHeight: 15, color: b.textMuted },
    body: { flexShrink: 1, fontSize: t.body, lineHeight: 18, color: b.textSecondary },
    error: { marginTop: -8, marginBottom: 12, fontSize: t.label, color: b.alertInk },
    subHead: { marginBottom: 10, fontSize: t.cardTitle, fontWeight: "700", color: b.text },
    clientOption: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      padding: 10,
      marginBottom: 7,
      borderWidth: 1,
      borderColor: b.border,
      borderRadius: round.field,
    },
    clientOptionActive: { borderColor: b.primary, backgroundColor: b.tintSoft },
    optionName: { fontSize: t.body, fontWeight: "700", color: b.text },
    optionMeta: { fontSize: t.label, color: b.textMuted },
    reviewName: { fontSize: t.rowTitle, fontWeight: "700", color: b.text, marginBottom: 2 },
    changeRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 6 },
    summaryRow: { flexDirection: "row", alignItems: "baseline", gap: 8, paddingVertical: 3 },
    summaryCode: { fontSize: t.body, fontWeight: "700", color: b.text },
    summaryMeta: { fontSize: t.label, color: b.textMuted },
    summaryRent: { marginLeft: "auto", fontSize: t.body, fontWeight: "600", color: b.textSecondary },
    summaryTotals: { marginTop: 8, paddingTop: 6, borderTopWidth: 1, borderTopColor: b.hairline },
  }),
);

export default OnboardClientScreen;
