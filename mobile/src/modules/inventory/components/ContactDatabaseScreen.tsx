import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Plus, ShieldAlert, Trash2 } from "lucide-react-native";
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
import {
  CONTACT_FIELDS,
  EMPTY_CONTACT,
  deleteContact,
  getBlockedLeads,
  getContacts,
  saveContact,
  type ContactKind,
  type CrmContact,
} from "../../../services/crmContactService";

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
}: {
  kind: ContactKind;
  title: string;
  blurb: string;
}) => {
  const { canPageAction } = usePermissions();
  const canWrite = canPageAction("inventory", "create");
  const isBroker = kind === "BROKER";

  const [rows, setRows] = useState<CrmContact[]>([]);
  const [total, setTotal] = useState(0);
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

  const submit = useCallback(async () => {
    if (!editing) return;
    if (!String(editing.name || "").trim() || !String(editing.phone || "").trim()) {
      Alert.alert(title, "Name and phone are both required.");
      return;
    }

    setSaving(true);
    try {
      await saveContact(editing, kind);
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
      <AppSearchInput
        value={search}
        onChangeText={setSearch}
        placeholder={`Search ${isBroker ? "brokers" : "owners"}`}
        style={styles.search}
      />

      {canWrite ? (
        <AppButton
          title={`Add ${isBroker ? "broker" : "owner"}`}
          onPress={() => setEditing({ ...EMPTY_CONTACT })}
          leftIcon={<Plus size={16} color="#ffffff" />}
          fullWidth
          style={styles.addButton}
        />
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
                onPress={() => canWrite && setEditing({ ...EMPTY_CONTACT, ...(item as any) })}
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
                  <Trash2 size={15} color={palette.rose[600]} />
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
        title={editing?._id ? "Edit contact" : `Add ${isBroker ? "broker" : "owner"}`}
        subtitle="Phone number is the key — saving an existing number updates that record."
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
            onChangeText={(value) => setEditing((prev) => (prev ? { ...prev, [field]: value } : prev))}
            multiline={MULTILINE_FIELDS.has(field)}
            keyboardType={field === "phone" ? "phone-pad" : field === "email" ? "email-address" : "default"}
            autoCapitalize={field === "email" ? "none" : "sentences"}
          />
        ))}
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

const styles = StyleSheet.create({
  search: { marginBottom: spacing.md },
  addButton: { marginBottom: spacing.lg },
  list: { paddingBottom: spacing.xxl },
  blurb: {
    fontSize: typography.label,
    lineHeight: 18,
    color: palette.slate[500],
    marginBottom: spacing.lg,
  },
  card: { marginBottom: spacing.md },
  cardHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  name: { flex: 1, fontSize: typography.body, fontWeight: "600", color: palette.slate[900] },
  phone: { marginTop: 2, fontSize: typography.body, color: palette.slate[700] },
  meta: { marginTop: 2, fontSize: typography.label, color: palette.slate[500] },
  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: palette.slate[200],
  },
  deleteLabel: { fontSize: typography.label, fontWeight: "600", color: palette.rose[600] },
  blockedRow: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: palette.slate[200],
  },
  blockedName: { fontSize: typography.body, fontWeight: "600", color: palette.slate[800] },
  sheetActions: { flexDirection: "row", gap: spacing.md },
  sheetButton: { flex: 1 },
});
