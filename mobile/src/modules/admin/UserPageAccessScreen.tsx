import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Glyph } from "../../components/ui/Glyph";
import {
  getUserPageAccess,
  updateUserPageAccess,
  type PageCatalogueEntry,
  type PageGrant,
} from "../../services/accessService";
import { toErrorMessage } from "../../utils/errorMessage";
import { brand, brandStyles, layout, round, type as t } from "../../theme/brand";

const ACTION_LABELS: Record<string, string> = {
  view: "View",
  create: "Create",
  edit: "Edit",
  delete: "Delete",
  export: "Export",
  approve: "Approve",
  assign: "Assign",
  follow_up: "Follow up",
};

export const UserPageAccessScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const userId = String(route.params?.userId || "");
  const memberName = String(route.params?.memberName || "Member");
  const memberRole = String(route.params?.memberRole || "").toUpperCase();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [catalogue, setCatalogue] = useState<PageCatalogueEntry[]>([]);
  const [draft, setDraft] = useState<PageGrant[]>([]);
  const [usesRoleDefaults, setUsesRoleDefaults] = useState(false);

  const load = useCallback(async () => {
    if (!userId) {
      setError("No member was chosen");
      setLoading(false);
      return;
    }
    try {
      setError("");
      const payload = await getUserPageAccess(userId);
      setCatalogue(payload.catalogue);
      setDraft(payload.pageAccess.map((grant) => ({ ...grant, actions: [...grant.actions] })));
      setUsesRoleDefaults(payload.usesRoleDefaults);
    } catch (e) {
      setError(toErrorMessage(e, "Could not load page access"));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const groups = useMemo(() => {
    const map = new Map<string, PageCatalogueEntry[]>();
    for (const page of catalogue) {
      const group = String(page.group || "Other");
      if (!map.has(group)) map.set(group, []);
      map.get(group)!.push(page);
    }
    return [...map.entries()];
  }, [catalogue]);

  const actionsFor = (pageKey: string) =>
    draft.find((entry) => entry.pageKey === pageKey)?.actions || [];

  const toggle = (page: PageCatalogueEntry, action: string) => {
    if (page.alwaysAccessible || memberRole === "ADMIN") return;
    setUsesRoleDefaults(false);
    setDraft((current) => {
      const next = current.map((entry) => ({ ...entry, actions: [...entry.actions] }));
      let row = next.find((entry) => entry.pageKey === page.key);
      if (!row) {
        row = { pageKey: page.key, actions: [] };
        next.push(row);
      }
      if (row.actions.includes(action)) {
        row.actions = row.actions.filter((value) => value !== action);
        if (action === "view") row.actions = [];
      } else {
        row.actions.push(action);
        if (action !== "view" && !row.actions.includes("view")) row.actions.unshift("view");
      }
      return next.filter((entry) => entry.actions.length > 0);
    });
  };

  const save = async () => {
    if (memberRole === "ADMIN") return;
    setSaving(true);
    try {
      const payload = await updateUserPageAccess(userId, { pageAccess: draft, enforcePageAccess: true });
      setDraft(payload.pageAccess);
      setUsesRoleDefaults(payload.usesRoleDefaults);
      Alert.alert("Saved", payload.message);
    } catch (e) {
      Alert.alert("Could not save", toErrorMessage(e, "Failed to update page access"));
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    if (memberRole === "ADMIN") return;
    Alert.alert(
      "Use role defaults",
      `${memberName} will inherit pages and actions from the assigned role again.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          onPress: async () => {
            setSaving(true);
            try {
              await updateUserPageAccess(userId, { pageAccess: null, enforcePageAccess: false });
              await load();
            } catch (e) {
              Alert.alert("Could not reset", toErrorMessage(e, "Failed to restore role defaults"));
            } finally {
              setSaving(false);
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.root} edges={["top", "left", "right"]}>
        <View style={styles.centred}><ActivityIndicator size="large" color={brand.primary} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right"]}>
      <View style={styles.bar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back">
          <Glyph name="arrow-back" size={24} color={brand.text} />
        </Pressable>
        <View style={styles.barCopy}>
          <Text style={styles.barTitle}>Page access</Text>
          <Text style={styles.barSubtitle} numberOfLines={1}>{memberName}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.notice}>
          <Glyph name={usesRoleDefaults ? "git-branch-outline" : "person-outline"} size={18} color={brand.primary} />
          <View style={styles.noticeCopy}>
            <Text style={styles.noticeTitle}>{usesRoleDefaults ? "Using role defaults" : "Employee-specific access"}</Text>
            <Text style={styles.noticeText}>
              {memberRole === "ADMIN"
                ? "Admins always reach every page and cannot be narrowed."
                : usesRoleDefaults
                  ? "Changing any control creates an override for this member."
                  : "These choices override the assigned role until reset."}
            </Text>
          </View>
        </View>

        {error ? (
          <Pressable style={styles.error} onPress={load}><Text style={styles.errorText}>{error}</Text></Pressable>
        ) : null}

        {groups.map(([group, pages]) => (
          <View key={group} style={styles.group}>
            <Text style={styles.groupTitle}>{group}</Text>
            <View style={styles.card}>
              {pages.map((page) => {
                const granted = actionsFor(page.key);
                return (
                  <View key={page.key} style={styles.pageRow}>
                    <View style={styles.pageHead}>
                      <View style={styles.pageCopy}>
                        <Text style={styles.pageLabel}>{page.label}</Text>
                        <Text style={styles.pagePath}>{page.path}</Text>
                      </View>
                      {page.alwaysAccessible ? <Text style={styles.fixed}>Always on</Text> : null}
                    </View>
                    <View style={styles.actions}>
                      {(page.actions || []).map((action) => {
                        const on = page.alwaysAccessible || memberRole === "ADMIN" || granted.includes(action);
                        return (
                          <Pressable
                            key={action}
                            style={[styles.action, on && styles.actionOn]}
                            onPress={() => toggle(page, action)}
                            disabled={page.alwaysAccessible || memberRole === "ADMIN" || saving}
                            accessibilityRole="checkbox"
                            accessibilityState={{ checked: on }}
                          >
                            <Glyph name={on ? "checkmark-circle" : "ellipse-outline"} size={14} color={on ? brand.primary : brand.placeholder} />
                            <Text style={[styles.actionText, on && styles.actionTextOn]}>{ACTION_LABELS[action] || action}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        ))}

        {memberRole !== "ADMIN" ? (
          <View style={styles.footer}>
            <Pressable style={styles.resetBtn} onPress={reset} disabled={saving} accessibilityRole="button">
              <Text style={styles.resetText}>Use role defaults</Text>
            </Pressable>
            <Pressable style={[styles.saveBtn, saving && styles.disabled]} onPress={save} disabled={saving} accessibilityRole="button">
              <Text style={styles.saveText}>{saving ? "Saving…" : "Save access"}</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = brandStyles((b) => StyleSheet.create({
  root: { flex: 1, backgroundColor: b.bg },
  centred: { flex: 1, alignItems: "center", justifyContent: "center" },
  bar: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: layout.pageGutter, paddingTop: 6, paddingBottom: 12 },
  barCopy: { flex: 1, minWidth: 0 },
  barTitle: { fontSize: t.barTitle, lineHeight: 22, fontWeight: "700", color: b.text },
  barSubtitle: { fontSize: t.tagline, color: b.textMuted },
  body: { paddingHorizontal: layout.pageGutter },
  notice: { flexDirection: "row", gap: 10, padding: 12, borderWidth: 1, borderColor: b.greenBright, borderRadius: round.panel, backgroundColor: b.tintSoft, marginBottom: 14 },
  noticeCopy: { flex: 1 },
  noticeTitle: { fontSize: t.cardTitle, fontWeight: "700", color: b.text },
  noticeText: { marginTop: 3, fontSize: t.tagline, lineHeight: 15, color: b.textSecondary },
  error: { padding: 11, borderRadius: round.field, backgroundColor: b.alertTint, marginBottom: 12 },
  errorText: { color: b.alert, fontSize: t.body, fontWeight: "600" },
  group: { marginBottom: 14 },
  groupTitle: { marginBottom: 7, fontSize: t.label, fontWeight: "800", letterSpacing: 0.6, textTransform: "uppercase", color: b.textMuted },
  card: { overflow: "hidden", borderWidth: 1, borderColor: b.hairline, borderRadius: round.panel, backgroundColor: b.surface },
  pageRow: { padding: 11, borderBottomWidth: 1, borderBottomColor: b.hairline },
  pageHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  pageCopy: { flex: 1 },
  pageLabel: { fontSize: t.cardTitle, fontWeight: "700", color: b.text },
  pagePath: { marginTop: 2, fontSize: t.micro, color: b.textMuted },
  fixed: { fontSize: t.micro, fontWeight: "700", color: b.primary },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 9 },
  action: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 5, borderWidth: 1, borderColor: b.hairline, borderRadius: round.pill, backgroundColor: b.bg },
  actionOn: { borderColor: b.greenBright, backgroundColor: b.tintSoft },
  actionText: { fontSize: t.micro, fontWeight: "600", color: b.textMuted },
  actionTextOn: { color: b.deep },
  footer: { flexDirection: "row", gap: 10, marginTop: 2 },
  resetBtn: { flex: 1, height: 46, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: b.border, borderRadius: round.field, backgroundColor: b.surface },
  resetText: { fontSize: t.body, fontWeight: "700", color: b.text },
  saveBtn: { flex: 1, height: 46, alignItems: "center", justifyContent: "center", borderRadius: round.field, backgroundColor: b.primary },
  saveText: { fontSize: t.body, fontWeight: "700", color: b.onPrimary },
  disabled: { opacity: 0.55 },
}));

export default UserPageAccessScreen;
