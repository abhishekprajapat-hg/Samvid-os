import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as DocumentPicker from "expo-document-picker";
import * as MailComposer from "expo-mail-composer";
import { Glyph, type GlyphName } from "../../components/ui/Glyph";
import {
  FieldCol,
  FieldLabel,
  FieldRow,
  PrefixField,
  SectionCard,
  SelectField,
  TextField,
  Toggle,
} from "../../components/ui/form";
import { brand, brandStyles, layout, round, type as t } from "../../theme/brand";
import { toErrorMessage } from "../../utils/errorMessage";
import { createFinanceEntry, getFinanceInvoices } from "../../services/financeService";
import { getInventoryAssets } from "../../services/inventoryService";
import { getAllLeads } from "../../services/leadService";
import { uploadChatFile } from "../../services/chatService";
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  MONTHS_SHORT,
  PAYMENT_METHODS,
  categoryLabel,
  exactMoney,
  methodLabel,
} from "./financeVocab";

/*
 * Add Entry, drawn to the comp.
 *
 * Income becomes a payment-ledger entry and expense becomes an expense - the
 * two collections the product already keeps - so nothing recorded here lives
 * anywhere the coworking billing screens cannot see it.
 */

const DRAFT_KEY = "finance.addEntry.draft";

const STATUSES: Array<{ key: "PAID" | "PENDING" | "OVERDUE"; label: string }> = [
  { key: "PAID", label: "Paid" },
  { key: "PENDING", label: "Pending" },
  { key: "OVERDUE", label: "Overdue" },
];

const RELATION_TYPES = [
  { value: "PROPERTY", label: "Property" },
  { value: "LEAD", label: "Lead" },
  { value: "NONE", label: "Not linked" },
];

const dayOptions = () =>
  Array.from({ length: 60 }, (_, back) => {
    const date = new Date();
    date.setDate(date.getDate() - back + 7);
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    return { value, label: `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]} ${date.getFullYear()}` };
  });

const digitsOnly = (value: string) => value.replace(/[^\d]/g, "");

const groupedAmount = (value: string) => {
  const digits = digitsOnly(value);
  return digits ? Number(digits).toLocaleString("en-IN") : "";
};

export const AddEntryScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();

  const [kind, setKind] = useState<"INCOME" | "EXPENSE">(
    (route.params?.kind as "INCOME" | "EXPENSE") || "INCOME",
  );

  const [amount, setAmount] = useState(
    route.params?.amount ? String(Math.round(Number(route.params.amount))) : "",
  );
  const [category, setCategory] = useState("");
  const [date, setDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  });
  const [status, setStatus] = useState<"PAID" | "PENDING" | "OVERDUE">("PAID");
  const [method, setMethod] = useState("BANK_TRANSFER");
  const [reference, setReference] = useState("");

  const [relationType, setRelationType] = useState("PROPERTY");
  const [relationId, setRelationId] = useState("");
  const [party, setParty] = useState(String(route.params?.party || ""));
  const [invoiceId, setInvoiceId] = useState(String(route.params?.invoiceId || ""));

  const [notes, setNotes] = useState("");
  const [receipt, setReceipt] = useState<{ name: string; fileUrl: string; fileType: string; size: number } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");

  const [properties, setProperties] = useState<Array<{ _id: string; label: string }>>([]);
  const [leads, setLeads] = useState<Array<{ _id: string; label: string }>>([]);
  const [invoices, setInvoices] = useState<Array<{ value: string; label: string }>>([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const assets = await getInventoryAssets();
        setProperties(
          (Array.isArray(assets) ? assets : []).map((asset: any) => ({
            _id: String(asset._id),
            label: String(asset.projectName || asset.title || "Property"),
          })),
        );
      } catch {
        /* The picker is a convenience; an entry can be saved unlinked. */
      }
      try {
        const rows = await getAllLeads({ limit: 100 });
        setLeads(
          (Array.isArray(rows) ? rows : []).map((row) => ({
            _id: String(row._id),
            label: String(row.name || row.phone || "Lead"),
          })),
        );
      } catch {
        /* Same. */
      }
      try {
        const rows = await getFinanceInvoices({ limit: 50 });
        setInvoices(
          rows.map((row) => ({
            value: String(row._id),
            /* The comp shows the number alone; the amount would truncate it. */
            label: row.invoiceNumber,
          })),
        );
      } catch {
        /* Invoices are optional on the form. */
      }
    })();
  }, []);

  /* ------------------------------------------------------------- draft -- */

  const snapshot = useMemo(
    () => ({ kind, amount, category, date, status, method, reference, relationType, relationId, party, invoiceId, notes, confirm, confirmEmail }),
    [kind, amount, category, date, status, method, reference, relationType, relationId, party, invoiceId, notes, confirm, confirmEmail],
  );

  useEffect(() => {
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(DRAFT_KEY);
        if (!raw || route.params?.invoiceId) return;
        const draft = JSON.parse(raw);
        setKind(draft.kind || "INCOME");
        setAmount(draft.amount || "");
        setCategory(draft.category || "");
        if (draft.date) setDate(draft.date);
        setStatus(draft.status || "PAID");
        setMethod(draft.method || "BANK_TRANSFER");
        setReference(draft.reference || "");
        setRelationType(draft.relationType || "PROPERTY");
        setRelationId(draft.relationId || "");
        setParty(draft.party || "");
        setInvoiceId(draft.invoiceId || "");
        setNotes(draft.notes || "");
        setConfirm(Boolean(draft.confirm));
        setConfirmEmail(draft.confirmEmail || "");
      } catch {
        /* A draft that will not parse is not worth blocking an entry over. */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveDraft = useCallback(async () => {
    try {
      await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(snapshot));
      Alert.alert("Draft saved", "It will be here when you come back.");
    } catch {
      Alert.alert("Draft", "Could not save the draft on this device.");
    }
  }, [snapshot]);

  /* ------------------------------------------------------------ upload -- */

  const pickReceipt = async () => {
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/jpeg", "image/png"],
        copyToCacheDirectory: true,
      });
      if (picked.canceled || !picked.assets?.length) return;
      const asset = picked.assets[0];
      if (Number(asset.size || 0) > 10 * 1024 * 1024) {
        Alert.alert("Too large", "Receipts can be up to 10 MB.");
        return;
      }

      setUploading(true);
      const uploaded = await uploadChatFile({
        uri: asset.uri,
        name: asset.name || "receipt",
        mimeType: asset.mimeType || undefined,
        file: (asset as any).file,
      });
      if (!uploaded.fileUrl) throw new Error("Upload failed");
      setReceipt({
        name: uploaded.fileName,
        fileUrl: uploaded.fileUrl,
        fileType: uploaded.mimeType,
        size: uploaded.size || Number(asset.size || 0),
      });
    } catch (e) {
      Alert.alert("Upload", toErrorMessage(e, "Could not upload that file"));
    } finally {
      setUploading(false);
    }
  };

  /* ------------------------------------------------------------ submit -- */

  const categories = kind === "INCOME" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const records = relationType === "LEAD" ? leads : properties;

  const submit = async () => {
    const value = Number(digitsOnly(amount));
    if (!value) {
      setError("Amount is required");
      return;
    }
    if (!category) {
      setError("Category is required");
      return;
    }
    if (relationType !== "NONE" && !relationId) {
      setError(relationType === "LEAD" ? "Pick a lead" : "Pick a property");
      return;
    }
    if (!party.trim()) {
      setError(kind === "INCOME" ? "Payer is required" : "Payee is required");
      return;
    }
    if (confirm && !confirmEmail.trim()) {
      setError("An email address is needed to send the confirmation");
      return;
    }

    setError("");
    setSaving(true);
    try {
      await createFinanceEntry({
        kind,
        amount: value,
        category,
        date: new Date(`${date}T09:00:00`).toISOString(),
        method,
        /*
         * The comp offers Overdue, which is a state a row falls into once its
         * date passes rather than one you choose - it saves as pending, and
         * the list shows it as late on its own.
         */
        status: status === "PAID" ? "PAID" : "PENDING",
        reference: reference.trim(),
        title: `${categoryLabel(category)}${party.trim() ? ` — ${party.trim()}` : ""}`,
        party: party.trim(),
        notes: notes.trim(),
        invoiceId: invoiceId || undefined,
        inventoryId: relationType === "PROPERTY" ? relationId || undefined : undefined,
        leadId: relationType === "LEAD" ? relationId || undefined : undefined,
        receipts: receipt ? [{ name: receipt.name, fileUrl: receipt.fileUrl, fileType: receipt.fileType }] : [],
      });

      /*
       * There is no mail transport on the server, so the confirmation is
       * composed here and sent from the person's own account.
       */
      if (confirm && confirmEmail.trim()) {
        const body = `Payment of ${exactMoney(value)} recorded on ${date} by ${methodLabel(method)}${reference.trim() ? ` (ref ${reference.trim()})` : ""}.${notes.trim() ? `\n\n${notes.trim()}` : ""}`;
        if (await MailComposer.isAvailableAsync()) {
          await MailComposer.composeAsync({
            recipients: [confirmEmail.trim()],
            subject: "Payment confirmation",
            body,
          }).catch(() => undefined);
        }
      }

      await AsyncStorage.removeItem(DRAFT_KEY).catch(() => undefined);
      navigation.goBack();
    } catch (e) {
      setError(toErrorMessage(e, "Failed to save the entry"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right"]}>
      <View style={styles.bar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back">
          <Glyph name="arrow-back" size={24} color={brand.text} />
        </Pressable>
        <Text style={styles.barTitle}>Add Entry</Text>
        <Pressable onPress={saveDraft} hitSlop={10} accessibilityRole="button">
          <Text style={styles.barAction}>Save draft</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={styles.grow}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={8}
      >
        <ScrollView
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.kindRow}>
            {(["INCOME", "EXPENSE"] as const).map((entry) => {
              const active = kind === entry;
              return (
                <Pressable
                  key={entry}
                  style={[styles.kindItem, active && styles.kindItemOn]}
                  onPress={() => {
                    setKind(entry);
                    setCategory("");
                  }}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[styles.kindLabel, active && styles.kindLabelOn]}>
                    {entry === "INCOME" ? "Income" : "Expense"}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <SectionCard title="Entry Details">
            <FieldRow>
              <FieldCol>
                <PrefixField
                  label="Amount"
                  required
                  prefix={"₹"}
                  value={groupedAmount(amount)}
                  onChangeText={(next) => setAmount(digitsOnly(next))}
                  placeholder="0"
                />
              </FieldCol>
              <FieldCol>
                <SelectField
                  label="Category"
                  required
                  icon="pricetag-outline"
                  value={category}
                  options={categories.map((key) => ({ value: key, label: categoryLabel(key) }))}
                  onChange={setCategory}
                  placeholder="Select"
                />
              </FieldCol>
            </FieldRow>

            <FieldRow>
              <FieldCol>
                <SelectField
                  label="Date"
                  required
                  icon="calendar-outline"
                  value={date}
                  options={dayOptions()}
                  onChange={setDate}
                />
              </FieldCol>
              <FieldCol>
                {/* Wrapped so it keeps the same rhythm as the fields beside it. */}
                <View style={styles.group}>
                <FieldLabel label="Payment status" required />
                <View style={styles.statusRow}>
                  {STATUSES.map((entry) => {
                    const active = status === entry.key;
                    return (
                      <Pressable
                        key={entry.key}
                        style={[styles.statusItem, active && styles.statusItemOn]}
                        onPress={() => setStatus(entry.key)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                      >
                        <Text style={[styles.statusLabel, active && styles.statusLabelOn]} numberOfLines={1}>
                          {entry.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                </View>
              </FieldCol>
            </FieldRow>

            <FieldRow>
              <FieldCol>
                <SelectField
                  label="Payment mode"
                  required
                  icon="card-outline"
                  value={method}
                  options={PAYMENT_METHODS.map((key) => ({ value: key, label: methodLabel(key) }))}
                  onChange={setMethod}
                />
              </FieldCol>
              <FieldCol>
                <PrefixField
                  label="Reference number"
                  prefix="#"
                  value={reference}
                  onChangeText={setReference}
                  placeholder="UTR / txn id"
                />
              </FieldCol>
            </FieldRow>
          </SectionCard>

          <SectionCard title="Related To">
            <FieldRow>
              <FieldCol>
                <SelectField
                  label="Type"
                  required
                  icon="business-outline"
                  value={relationType}
                  options={RELATION_TYPES}
                  onChange={(next) => {
                    setRelationType(next);
                    setRelationId("");
                  }}
                />
              </FieldCol>
              <FieldCol>
                <SelectField
                  label={relationType === "LEAD" ? "Lead" : "Property / Record"}
                  required={relationType !== "NONE"}
                  icon={relationType === "LEAD" ? "person-outline" : "business-outline"}
                  value={relationId}
                  options={records.map((row) => ({ value: row._id, label: row.label }))}
                  onChange={setRelationId}
                  placeholder={relationType === "NONE" ? "Not linked" : "Select"}
                />
              </FieldCol>
            </FieldRow>

            <FieldRow>
              <FieldCol>
                <TextField
                  label="Payer / Payee"
                  required
                  icon="person-outline"
                  value={party}
                  onChangeText={setParty}
                  placeholder="Who paid or was paid"
                  autoCapitalize="words"
                />
              </FieldCol>
              <FieldCol>
                <SelectField
                  label="Invoice (Optional)"
                  icon="document-text-outline"
                  value={invoiceId}
                  options={[{ value: "", label: "Not against an invoice" }, ...invoices]}
                  onChange={setInvoiceId}
                  placeholder="Select"
                />
              </FieldCol>
            </FieldRow>
          </SectionCard>

          <SectionCard title="Notes &amp; Proof">
            <TextField
              label="Notes"
              value={notes}
              onChangeText={setNotes}
              placeholder="What was this for?"
              multiline
            />

            <FieldLabel label="Receipt / Document" />
            <Pressable
              style={styles.upload}
              onPress={pickReceipt}
              disabled={uploading}
              accessibilityRole="button"
            >
              <View style={styles.uploadIcon}>
                <Glyph name="cloud-upload-outline" size={20} color={brand.primary} />
              </View>
              <View style={styles.grow}>
                <Text style={styles.uploadTitle}>
                  {uploading ? "Uploading…" : "Upload receipt or document"}
                </Text>
                <Text style={styles.uploadNote}>PDF, JPG or PNG · Up to 10 MB</Text>
              </View>
            </Pressable>

            {receipt ? (
              <View style={styles.fileRow}>
                <View style={styles.fileIcon}>
                  <Glyph name="image-outline" size={18} color={brand.textSecondary} />
                </View>
                <View style={styles.grow}>
                  <Text style={styles.fileName} numberOfLines={1}>
                    {receipt.name}
                  </Text>
                  <Text style={styles.fileSize}>
                    {`${(receipt.size / (1024 * 1024)).toFixed(1)} MB`}
                  </Text>
                </View>
                <Pressable onPress={() => setReceipt(null)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Remove file">
                  <Glyph name="close" size={19} color={brand.textSecondary} />
                </Pressable>
              </View>
            ) : null}

            <View style={styles.confirmRow}>
              <Toggle value={confirm} onValueChange={setConfirm} />
              <View style={styles.grow}>
                <Text style={styles.confirmTitle}>Send payment confirmation</Text>
                <Text style={styles.confirmNote}>An email with payment details will be sent.</Text>
              </View>
            </View>

            {confirm ? (
              <>
                <TextField
                  label="Send to (email)"
                  required
                  icon="mail-outline"
                  value={confirmEmail}
                  onChangeText={setConfirmEmail}
                  placeholder="name@email.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                {/*
                 * The server sends no mail, so the confirmation opens in the
                 * phone's mail app ready to send rather than silently going
                 * nowhere.
                 */}
                <Text style={styles.confirmNote}>Opens in your mail app, ready to send.</Text>
              </>
            ) : null}
          </SectionCard>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          <Pressable
            style={[styles.submit, saving && styles.submitOff]}
            onPress={submit}
            disabled={saving}
            accessibilityRole="button"
          >
            <Text style={styles.submitText}>{saving ? "Saving…" : "Save entry"}</Text>
            {!saving ? <Glyph name="arrow-forward" size={18} color={brand.onPrimary} /> : null}
          </Pressable>
          <Pressable style={styles.cancel} onPress={() => navigation.goBack()} accessibilityRole="button">
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = brandStyles((b) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: b.bg },
    grow: { flex: 1, minWidth: 0 },
    group: { marginBottom: layout.fieldGap },

    bar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      paddingHorizontal: layout.gutter,
      paddingTop: 6,
      paddingBottom: 12,
    },
    barTitle: {
      flex: 1,
      minWidth: 0,
      fontSize: t.hero,
      lineHeight: 25,
      fontWeight: "700",
      letterSpacing: -0.5,
      color: b.text,
    },
    barAction: { fontSize: t.field, fontWeight: "700", color: b.primary },

    body: {
      paddingHorizontal: layout.gutter,
      paddingBottom: 24,
      gap: 12,
    },
    error: { fontSize: t.body, lineHeight: 17, color: b.alert },

    kindRow: {
      flexDirection: "row",
      gap: 4,
      padding: 4,
      borderRadius: round.field,
      backgroundColor: b.fieldMuted,
    },
    kindItem: {
      flex: 1,
      minWidth: 0,
      height: 42,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: round.button,
    },
    kindItemOn: { backgroundColor: "#0b7d52" },
    kindLabel: { fontSize: t.sectionTitle, fontWeight: "600", color: b.textSecondary },
    kindLabelOn: { fontWeight: "700", color: b.onPrimary },

    statusRow: {
      flexDirection: "row",
      gap: 3,
      padding: 3,
      height: layout.fieldHeight,
      borderRadius: round.field,
      backgroundColor: b.fieldMuted,
    },
    statusItem: {
      flex: 1,
      minWidth: 0,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: round.button,
    },
    statusItemOn: { backgroundColor: "#0b7d52" },
    statusLabel: { fontSize: t.body, fontWeight: "500", color: b.textSecondary },
    statusLabelOn: { fontWeight: "700", color: b.onPrimary },

    upload: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 13,
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: b.greenBright,
      borderRadius: round.field,
      backgroundColor: b.uploadTint,
    },
    uploadIcon: {
      width: 38,
      height: 38,
      borderRadius: round.field,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: b.surface,
    },
    uploadTitle: { fontSize: t.field, fontWeight: "700", color: b.primary },
    uploadNote: { marginTop: 2, fontSize: t.body, color: b.textMuted },

    fileRow: {
      marginTop: 9,
      flexDirection: "row",
      alignItems: "center",
      gap: 11,
      padding: 10,
      borderRadius: round.field,
      backgroundColor: b.fieldMuted,
    },
    fileIcon: {
      width: 38,
      height: 38,
      borderRadius: round.field,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: b.surface,
    },
    fileName: { fontSize: t.cardTitle, fontWeight: "600", color: b.text },
    fileSize: { marginTop: 1, fontSize: t.tagline, color: b.textMuted },

    confirmRow: {
      marginTop: 16,
      marginBottom: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    confirmTitle: { fontSize: t.field, fontWeight: "600", color: b.text },
    confirmNote: { marginTop: 1, fontSize: t.body, color: b.textMuted },

    footer: {
      paddingHorizontal: layout.gutter,
      paddingTop: 10,
      gap: 4,
      borderTopWidth: 1,
      borderTopColor: b.hairline,
      backgroundColor: b.bg,
    },
    submit: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 9,
      height: 50,
      borderRadius: round.field,
      backgroundColor: "#0b7d52",
    },
    submitOff: { opacity: 0.6 },
    submitText: { fontSize: t.sectionTitle, fontWeight: "700", color: b.onPrimary },
    cancel: { height: 40, alignItems: "center", justifyContent: "center" },
    cancelText: { fontSize: t.field, fontWeight: "700", color: b.primary },
  }),
);

export default AddEntryScreen;
