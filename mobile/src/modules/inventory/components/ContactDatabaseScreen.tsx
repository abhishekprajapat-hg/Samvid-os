import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Download, Plus, ShieldAlert, Trash2, Upload } from "lucide-react-native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as XLSX from "xlsx";
import { Screen } from "../../../components/common/Screen";
import {
  AppBadge,
  AppButton,
  AppCard,
  AppEmptyState,
  AppInput,
  AppSearchInput,
  AppSheet,
  AppSkeletonList,
} from "../../../components/ui";
import { usePermissions } from "../../../context/PermissionContext";
import { palette, spacing, typography } from "../../../theme/tokens";
import { toErrorMessage } from "../../../utils/errorMessage";
import { shareTextFile } from "../../../utils/shareFile";
import {
  CONTACT_TEMPLATE_CSV,
  parseContactCsv,
  rowsFromMatrix,
  validateContact,
  type ContactRow,
} from "../contactBulkImport";
import {
  CONTACT_FIELDS,
  EMPTY_CONTACT,
  bulkImportContacts,
  deleteContact,
  getBlockedLeads,
  getContacts,
  saveContact,
  type ContactKind,
  type CrmContact,
} from "../../../services/crmContactService";
import { themedStyles, themeColor, themePalette } from "../../../theme/themedStyles";

/*
 * One implementation behind both the Owner and the Broker screen, the way
 * ContactDatabasePage.jsx serves both web pages.
 *
 * The two differ in what the records mean, not in how they are kept: same
 * fields, same phone-as-key rule. Only the broker screen carries the
 * blocked-lead count, because only brokers gate lead intake.
 */

const FIELD_LABELS: Record<string, string> = {
  name: "Name",
  phone: "Phone",
  email: "Email",
  company: "Company",
  city: "City",
  propertyDetails: "Property details",
  notes: "Notes",
};

const MULTILINE_FIELDS = new Set(["propertyDetails", "notes"]);

export const ContactDatabaseScreen = ({
  kind,
  title,
  blurb,
  above,
}: {
  kind: ContactKind;
  title: string;
  blurb: string;
  /* Rendered directly under the page header - the Contacts tab puts its
     Owners/Brokers switch here rather than wrapping the whole screen. */
  above?: React.ReactNode;
}) => {
  const { canPageAction } = usePermissions();
  const canWrite = canPageAction("inventory", "create");
  const isBroker = kind === "BROKER";

  const [rows, setRows] = useState<CrmContact[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    fileName: string;
    createdCount?: number;
    updatedCount?: number;
    failedCount?: number;
    failures?: Array<{ row: number; message: string }>;
  } | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // null when closed; the contact being edited, or a blank one when adding.
  const [editing, setEditing] = useState<Record<string, string> | null>(null);
  const [saving, setSaving] = useState(false);

  const [blocked, setBlocked] = useState<{ name: string; entries: any[]; loading: boolean } | null>(
    null,
  );

  const load = useCallback(async () => {
    try {
      const data = await getContacts({ kind, search, page: 1 });
      setRows(data.contacts);
      setTotal(data.total);
      setPage(1);
      setError("");
    } catch (err) {
      setError(toErrorMessage(err, "Unable to load contacts"));
    } finally {
      setLoading(false);
    }
  }, [kind, search]);

  // Debounced, as web is - a request per keystroke is worse on a phone.
  useEffect(() => {
    const timer = setTimeout(() => void load(), 250);
    return () => clearTimeout(timer);
  }, [load]);

  /* Web pages the directory 50 at a time; the phone loads the next 50 on demand. */
  const loadMore = useCallback(async () => {
    if (loadingMore || rows.length >= total) return;
    setLoadingMore(true);
    try {
      const data = await getContacts({ kind, search, page: page + 1 });
      setRows((prev) => [...prev, ...data.contacts]);
      setTotal(data.total);
      setPage((value) => value + 1);
    } catch (err) {
      setError(toErrorMessage(err, "Unable to load contacts"));
    } finally {
      setLoadingMore(false);
    }
  }, [kind, loadingMore, page, rows.length, search, total]);

  /* Bulk upload - web's handleFile: CSV as text, a workbook's first sheet through SheetJS. */
  const importFile = useCallback(async () => {
    setError("");
    setNotice("");
    setImportResult(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["text/csv", "text/comma-separated-values", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-excel", "*/*"],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      setImporting(true);
      const extension = String(asset.name || "").split(".").pop()?.toLowerCase();
      let parsed: ContactRow[];
      if (extension === "xlsx" || extension === "xls") {
        const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
        const workbook = XLSX.read(base64, { type: "base64", raw: false });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        if (!sheet) throw new Error("The workbook has no sheets.");
        parsed = rowsFromMatrix(XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", blankrows: false, raw: false }));
      } else {
        parsed = parseContactCsv(await FileSystem.readAsStringAsync(asset.uri));
      }
      if (!parsed.length) throw new Error("No rows found in the file.");
      const data = await bulkImportContacts(kind, parsed);
      setImportResult({ ...data, fileName: String(asset.name || "file") });
      await load();
    } catch (err) {
      setError(toErrorMessage(err, "Unable to import the file"));
    } finally {
      setImporting(false);
    }
  }, [kind, load]);

  const shareTemplate = useCallback(async () => {
    try {
      await shareTextFile(`${kind.toLowerCase()}-import-template.csv`, CONTACT_TEMPLATE_CSV);
    } catch (err) {
      setError(toErrorMessage(err, "Could not share the template"));
    }
  }, [kind]);

  const submit = useCallback(async () => {
    if (!editing) return;
    const found = validateContact(editing);
    setErrors(found);
    if (Object.keys(found).length) return;

    setSaving(true);
    try {
      await saveContact(editing, kind);
      setNotice(editing._id ? `${editing.name} updated` : `${editing.name} added to the ${title}`);
      setEditing(null);
      await load();
    } catch (err) {
      Alert.alert(title, toErrorMessage(err, "Unable to save contact"));
    } finally {
      setSaving(false);
    }
  }, [editing, kind, load, title]);

  const remove = useCallback(
    (contact: CrmContact) => {
      Alert.alert(
        `Remove ${contact.name}?`,
        `Any leads already linked to them stay as they are.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Remove",
            style: "destructive",
            onPress: async () => {
              try {
                await deleteContact(String(contact._id || ""));
                setNotice(`${contact.name} removed`);
                await load();
              } catch (err) {
                Alert.alert(title, toErrorMessage(err, "Unable to remove contact"));
              }
            },
          },
        ],
      );
    },
    [load, title],
  );

  const openBlocked = useCallback(async (contact: CrmContact) => {
    setBlocked({ name: String(contact.name || ""), entries: [], loading: true });
    try {
      const entries = await getBlockedLeads(String(contact._id || ""));
      setBlocked({ name: String(contact.name || ""), entries, loading: false });
    } catch {
      setBlocked({ name: String(contact.name || ""), entries: [], loading: false });
    }
  }, []);

  const subtitle = useMemo(
    () => (total ? `${total} on file` : "Contacts"),
    [total],
  );

  return (
    <Screen title={title} subtitle={subtitle} error={error} onRetry={load}>
      {above}

      <AppSearchInput
        value={search}
        onChangeText={setSearch}
        placeholder={`Search ${isBroker ? "brokers" : "owners"}`}
        style={styles.search}
      />

      {notice ? (
        <Pressable onPress={() => setNotice("")}>
          <Text style={styles.notice}>{notice}</Text>
        </Pressable>
      ) : null}
      {importResult ? (
        <View style={styles.importBox}>
          <Text style={styles.importTitle}>
            {importResult.fileName}: {importResult.createdCount || 0} added, {importResult.updatedCount || 0} updated,{" "}
            {importResult.failedCount || 0} skipped
          </Text>
          {(importResult.failures || []).map((failure) => (
            <Text key={failure.row} style={styles.meta}>Row {failure.row}: {failure.message}</Text>
          ))}
        </View>
      ) : null}
      {canWrite ? (
        <>
          <AppButton
            title={`Add ${isBroker ? "broker" : "owner"}`}
            onPress={() => {
              setErrors({});
              setEditing({ ...EMPTY_CONTACT });
            }}
            leftIcon={<Plus size={16} color={themeColor("#ffffff")} />}
            fullWidth
            style={styles.addButton}
          />
          <View style={styles.toolRow}>
            <AppButton
              title={importing ? "Importing…" : "Bulk upload"}
              variant="secondary"
              onPress={importFile}
              disabled={importing}
              leftIcon={<Upload size={15} color={themePalette.slate[700]} />}
              style={styles.toolButton}
            />
            <AppButton
              title="Template"
              variant="secondary"
              onPress={shareTemplate}
              leftIcon={<Download size={15} color={themePalette.slate[700]} />}
              style={styles.toolButton}
            />
          </View>
        </>
      ) : null}

      {loading ? (
        <AppSkeletonList rows={4} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item, index) => String(item._id || index)}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
          ListHeaderComponent={<Text style={styles.blurb}>{blurb}</Text>}
          onEndReached={() => void loadMore()}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            rows.length < total ? (
              <AppButton
                title={loadingMore ? "Loading…" : `Load more (${rows.length} of ${total})`}
                variant="ghost"
                onPress={() => void loadMore()}
                disabled={loadingMore}
              />
            ) : null
          }
          ListEmptyComponent={
            <AppEmptyState
              title={search ? "No matches" : `No ${isBroker ? "brokers" : "owners"} yet`}
              description={
                search
                  ? "Try a different name or number."
                  : `Contacts you add appear here. Phone number is the key, so saving a number twice updates the same record.`
              }
            />
          }
          renderItem={({ item }) => (
            <AppCard style={styles.card}>
              <Pressable
                onPress={() => {
                  if (!canWrite) return;
                  setErrors({});
                  setEditing({ ...EMPTY_CONTACT, ...(item as any) });
                }}
                disabled={!canWrite}
              >
                <View style={styles.cardHead}>
                  <Text style={styles.name} numberOfLines={1}>
                    {item.name || "Unnamed"}
                  </Text>
                  {isBroker && Number(item.blockedLeadCount || 0) > 0 ? (
                    <Pressable onPress={() => openBlocked(item)} hitSlop={8}>
                      <AppBadge variant="rose" dot>
                        {`${item.blockedLeadCount} blocked`}
                      </AppBadge>
                    </Pressable>
                  ) : null}
                </View>

                <Text style={styles.phone}>{item.phone || "—"}</Text>
                {item.email ? <Text style={styles.meta} numberOfLines={1}>{item.email}</Text> : null}
                {item.company || item.city ? (
                  <Text style={styles.meta} numberOfLines={1}>
                    {[item.company, item.city].filter(Boolean).join(" · ")}
                  </Text>
                ) : null}
                {item.propertyDetails ? (
                  <Text style={styles.meta} numberOfLines={2}>
                    {item.propertyDetails}
                  </Text>
                ) : null}
              </Pressable>

              {canWrite ? (
                <Pressable onPress={() => remove(item)} hitSlop={8} style={styles.deleteButton}>
                  <Trash2 size={15} color={themePalette.rose[600]} />
                  <Text style={styles.deleteLabel}>Remove</Text>
                </Pressable>
              ) : null}
            </AppCard>
          )}
        />
      )}

      <AppSheet
        visible={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing?._id ? `Edit ${isBroker ? "broker" : "owner"}` : `Add ${isBroker ? "broker" : "owner"}`}
        subtitle={
          isBroker && !editing?._id
            ? "Saved brokers are excluded from lead intake — any enquiry on this number is refused before it becomes a lead."
            : "Phone number is the key. Saving against a number already on file updates that record instead of creating a second one."
        }
        footer={
          <View style={styles.sheetActions}>
            <AppButton
              title="Cancel"
              variant="secondary"
              onPress={() => setEditing(null)}
              disabled={saving}
              style={styles.sheetButton}
            />
            <AppButton title="Save" onPress={submit} loading={saving} style={styles.sheetButton} />
          </View>
        }
      >
        {CONTACT_FIELDS.map((field) => (
          <AppInput
            key={field}
            label={FIELD_LABELS[field] || field}
            value={String(editing?.[field] || "")}
            onChangeText={(value) => {
              setEditing((prev) => (prev ? { ...prev, [field]: value } : prev));
              if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }));
            }}
            error={errors[field] || undefined}
            helperText={
              field === "phone" && editing?._id
                ? "Changing this creates a separate record rather than renaming this one"
                : field === "propertyDetails"
                  ? "Which units or properties this contact is tied to"
                  : undefined
            }
            multiline={MULTILINE_FIELDS.has(field)}
            keyboardType={field === "phone" ? "phone-pad" : field === "email" ? "email-address" : "default"}
            autoCapitalize={field === "email" ? "none" : "sentences"}
          />
        ))}
        {isBroker && !editing?._id ? (
          <View style={styles.brokerWarn}>
            <ShieldAlert size={14} color={themePalette.amber[700]} />
            <Text style={styles.brokerWarnText}>
              If this number has an open enquiry you still want to work, close it before saving — existing leads stay, but
              no new ones will come through.
            </Text>
          </View>
        ) : null}
      </AppSheet>

      <AppSheet
        visible={Boolean(blocked)}
        onClose={() => setBlocked(null)}
        title="Blocked enquiries"
        subtitle={blocked ? `Enquiries refused from ${blocked.name}` : undefined}
      >
        {blocked?.loading ? (
          <AppSkeletonList rows={2} />
        ) : blocked?.entries.length ? (
          blocked.entries.map((entry: any, index: number) => (
            <View key={entry?._id || index} style={styles.blockedRow}>
              <Text style={styles.blockedName}>{entry?.name || "Unnamed enquiry"}</Text>
              <Text style={styles.meta}>
                {[entry?.phone, entry?.origin].filter(Boolean).join(" · ")}
              </Text>
            </View>
          ))
        ) : (
          <Text style={styles.meta}>Nothing has been blocked from this number yet.</Text>
        )}
      </AppSheet>
    </Screen>
  );
};

const styles = themedStyles((c) => StyleSheet.create({
  notice: {
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: c.emerald[50],
    color: c.emerald[800],
    fontSize: typography.label,
    fontWeight: "600",
  },
  importBox: { marginBottom: spacing.md, padding: spacing.md, gap: 3, borderRadius: 10, backgroundColor: c.blue[50] },
  importTitle: { fontSize: typography.label, fontWeight: "700", color: c.blue[800] },
  toolRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  toolButton: { flex: 1 },
  brokerWarn: { flexDirection: "row", gap: 8, marginTop: spacing.sm, padding: spacing.md, borderRadius: 10, backgroundColor: c.amber[50] },
  brokerWarnText: { flex: 1, fontSize: typography.label, lineHeight: 16, color: c.amber[800] },
  search: { marginBottom: spacing.md },
  addButton: { marginBottom: spacing.lg },
  list: { paddingBottom: spacing.xxl },
  blurb: {
    fontSize: typography.label,
    lineHeight: 18,
    color: themePalette.slate[500],
    marginBottom: spacing.lg,
  },
  card: { marginBottom: spacing.md },
  cardHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  name: { flex: 1, fontSize: typography.body, fontWeight: "600", color: themePalette.slate[900] },
  phone: { marginTop: 2, fontSize: typography.body, color: themePalette.slate[700] },
  meta: { marginTop: 2, fontSize: typography.label, color: themePalette.slate[500] },
  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: themePalette.slate[200],
  },
  deleteLabel: { fontSize: typography.label, fontWeight: "600", color: themePalette.rose[600] },
  blockedRow: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: themePalette.slate[200],
  },
  blockedName: { fontSize: typography.body, fontWeight: "600", color: themePalette.slate[800] },
  sheetActions: { flexDirection: "row", gap: spacing.md },
  sheetButton: { flex: 1 },
}));
