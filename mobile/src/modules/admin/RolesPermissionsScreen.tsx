import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Glyph, type GlyphName } from "../../components/ui/Glyph";
import { AppSheet } from "../../components/ui/Overlay";
import { Toggle } from "../../components/ui/form";
import { createCustomRole, deleteCustomRole, updateCustomRole } from "../../services/roleService";
import {
  getRolesWithPermissions,
  saveRolePermissions,
  type CustomRoleRow,
  type PageCatalogueRow,
  type RoleRow,
} from "../../services/teamService";
import { toErrorMessage } from "../../utils/errorMessage";
import { brand, brandStyles, layout, round, type as t } from "../../theme/brand";
import {
  PERMISSION_ACTIONS,
  PERMISSION_ROWS,
  ROLE_LABELS,
  SECURITY_TOGGLES,
  avatarTone,
  initialsOf,
  toPagePermission,
} from "./teamVocab";
import { PhotoOverlay, profilePhotoOf } from "../../components/common/PhotoOverlay";

/*
 * Roles & Permissions, drawn to the comp.
 *
 * What is edited here is a role's permission list, which is where this app has
 * always kept role-level access - the same record the coworking access screen
 * writes, with the same audit entry behind it. Nothing new is stored.
 *
 * Two things worth knowing while reading the screen:
 *
 * - A company-defined role is a preset over a built-in one rather than a role
 *   of its own, so editing it edits the built-in role underneath. The card
 *   says which, and how many other people that reaches, because the blast
 *   radius is wider than the row you tapped.
 *
 * - The matrix draws seven pages; the catalogue has more. A save carries the
 *   pages it does not draw through untouched, so hiding Calendar from this
 *   list never takes Calendar away from anybody.
 */

const ROLE_ICONS: Record<string, GlyphName> = {
  ADMIN: "shield-checkmark",
  MANAGER: "people",
  INSIDE_EXECUTIVE: "call",
  EXECUTIVE: "person",
  FIELD_EXECUTIVE: "navigate",
  PRODUCTION_EXECUTIVE: "construct",
  COMMUNITY_MANAGER: "settings",
  CHANNEL_PARTNER: "git-merge",
  COWORKING_ADMIN: "business",
};

const BASE_ROLE_OPTIONS = [
  "MANAGER",
  "INSIDE_EXECUTIVE",
  "EXECUTIVE",
  "FIELD_EXECUTIVE",
  "PRODUCTION_EXECUTIVE",
  "COMMUNITY_MANAGER",
  "CHANNEL_PARTNER",
  "COWORKING_ADMIN",
];

type Grant = { pageKey: string; actions: string[] };

/** What the list shows: built-in roles and company-defined ones, side by side. */
type Entry = {
  id: string;
  label: string;
  description: string;
  baseRole: string;
  memberCount: number;
  members: Array<{ _id?: string; name?: string }>;
  /** A preset says whose list it shares; a built-in role says nothing. */
  sharesWith: string;
  customRoleId?: string;
};

/* --------------------------------------------------------------- screen -- */

export const RolesPermissionsScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [pages, setPages] = useState<PageCatalogueRow[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [customRoles, setCustomRoles] = useState<CustomRoleRow[]>([]);

  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState("");
  const [editing, setEditing] = useState(false);

  /* The working copy: only what the matrix and the security card govern. */
  const [draft, setDraft] = useState<Grant[]>([]);
  const [security, setSecurity] = useState<Record<string, boolean>>({});

  const [newRoleOpen, setNewRoleOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleBase, setNewRoleBase] = useState("EXECUTIVE");
  const [editRoleOpen, setEditRoleOpen] = useState(false);
  const [editRoleName, setEditRoleName] = useState("");

  const load = useCallback(async () => {
    try {
      setError("");
      const payload = await getRolesWithPermissions();
      setPages(payload.pages);
      setRoles(payload.roles);
      setCustomRoles(payload.customRoles);
    } catch (e) {
      setError(toErrorMessage(e, "Could not load the roles"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /* ---------------------------------------------------------- entries -- */

  const entries = useMemo<Entry[]>(() => {
    const builtIn: Entry[] = roles
      .filter((row) => row.memberCount > 0 || row.isOverridden || row.key === "ADMIN")
      .map((row) => ({
        id: row.key,
        label: row.label,
        description: row.description,
        baseRole: row.key,
        memberCount: row.memberCount,
        members: row.memberIds,
      sharesWith: "",
      customRoleId: undefined,
      }));

    const presets: Entry[] = customRoles.map((row) => ({
      id: row.key,
      label: row.label,
      description: row.description || `Behaves as ${row.baseRoleLabel}.`,
      baseRole: row.baseRole,
      memberCount: row.memberCount,
      members: row.memberIds,
      sharesWith: row.baseRoleLabel,
      customRoleId: row.customRoleId,
    }));

    return [...builtIn, ...presets];
  }, [roles, customRoles]);

  const visible = useMemo(() => {
    const key = query.trim().toLowerCase();
    if (!key) return entries;
    return entries.filter((entry) =>
      `${entry.label} ${entry.description}`.toLowerCase().includes(key));
  }, [entries, query]);

  /* Open on whichever role the caller named, else the first in the list. */
  useEffect(() => {
    if (selected || !entries.length) return;
    const asked = String(route.params?.role || "");
    const match = entries.find((entry) => entry.id === asked || entry.baseRole === asked);
    setSelected(match?.id || entries[0].id);
  }, [entries, selected, route.params]);

  const entry = entries.find((row) => row.id === selected) || null;
  const roleRow = entry ? roles.find((row) => row.key === entry.baseRole) || null : null;

  /* How many people the edit actually reaches, presets included. */
  const reach = useMemo(() => {
    if (!entry) return 0;
    const base = roles.find((row) => row.key === entry.baseRole)?.memberCount || 0;
    const shared = customRoles
      .filter((row) => row.baseRole === entry.baseRole)
      .reduce((sum, row) => sum + row.memberCount, 0);
    return base + shared;
  }, [entry, roles, customRoles]);

  /* Reset the working copy whenever the selection or the data changes. */
  useEffect(() => {
    if (!roleRow) return;
    setDraft(roleRow.pageAccess.map((grant) => ({ ...grant, actions: [...grant.actions] })));
    const next: Record<string, boolean> = {};
    for (const toggle of SECURITY_TOGGLES) {
      next[toggle.permission] = toggle.permission
        ? roleRow.permissions.includes(toggle.permission)
        : false;
    }
    setSecurity(next);
    setEditing(false);
  }, [roleRow]);

  const actionsFor = useCallback(
    (pageKey: string) => {
      const page = pages.find((row) => row.key === pageKey);
      const offered = new Set(page?.actions || []);
      return PERMISSION_ACTIONS.filter((action) => offered.has(action.action));
    },
    [pages],
  );

  const has = (pageKey: string, action: string) =>
    Boolean(draft.find((grant) => grant.pageKey === pageKey)?.actions.includes(action));

  const toggleCell = (pageKey: string, action: string) => {
    if (!editing) return;
    setDraft((prev) => {
      const next = prev.map((grant) => ({ ...grant, actions: [...grant.actions] }));
      let grant = next.find((row) => row.pageKey === pageKey);
      if (!grant) {
        grant = { pageKey, actions: [] };
        next.push(grant);
      }
      if (grant.actions.includes(action)) {
        grant.actions = grant.actions.filter((value) => value !== action);
        /* Taking away view takes away the page; anything else implies view. */
        if (action === "view") grant.actions = [];
      } else {
        grant.actions.push(action);
        if (action !== "view" && !grant.actions.includes("view")) grant.actions.push("view");
      }
      return next.filter((row) => row.actions.length);
    });
  };

  /* ------------------------------------------------------------- save -- */

  const save = async () => {
    if (!entry || !roleRow) return;
    if (roleRow.isFixed) {
      Alert.alert("Admin is fixed", "An admin reaches every page by definition.");
      return;
    }

    setSaving(true);
    try {
      const pagePermissions = new Set<string>();
      for (const grant of draft) {
        if (!grant.actions.length) continue;
        pagePermissions.add(toPagePermission(grant.pageKey, "view"));
        for (const action of grant.actions) {
          pagePermissions.add(toPagePermission(grant.pageKey, action));
        }
      }
      /* Profile and Dashboard stay reachable whatever the matrix says, and
         their presence is also how the server tells a configured role from one
         that has never been touched. */
      for (const page of pages) {
        if (page.alwaysAccessible) pagePermissions.add(toPagePermission(page.key, "view"));
      }

      const securityKeys = new Set(SECURITY_TOGGLES.map((row) => row.permission).filter(Boolean));
      const kept = roleRow.permissions.filter(
        (permission) => !permission.startsWith("page.") && !securityKeys.has(permission),
      );
      const granted = SECURITY_TOGGLES.filter(
        (row) => row.permission && security[row.permission],
      ).map((row) => row.permission);

      const payload = [...new Set([...kept, ...granted, ...pagePermissions])];
      const result = await saveRolePermissions(entry.baseRole, payload);
      await load();
      setEditing(false);
      Alert.alert("Saved", result.message);
    } catch (e) {
      Alert.alert("Could not save", toErrorMessage(e, "Failed to save the permissions"));
    } finally {
      setSaving(false);
    }
  };

  const duplicate = () => {
    if (!entry) return;
    setNewRoleName(`${entry.label} copy`);
    setNewRoleBase(entry.baseRole);
    setNewRoleOpen(true);
  };

  const createRole = async () => {
    const name = newRoleName.trim();
    if (!name) {
      Alert.alert("Name it", "A role needs a name.");
      return;
    }
    setSaving(true);
    try {
      await createCustomRole({ name, baseRole: newRoleBase });
      setNewRoleOpen(false);
      setNewRoleName("");
      await load();
    } catch (e) {
      Alert.alert("Could not create the role", toErrorMessage(e, "Failed to create the role"));
    } finally {
      setSaving(false);
    }
  };

  const renameRole = async () => {
    if (!entry?.customRoleId) return;
    const name = editRoleName.trim();
    if (!name) {
      Alert.alert("Name it", "A role needs a name.");
      return;
    }
    setSaving(true);
    try {
      const result = await updateCustomRole(entry.customRoleId, { name });
      setEditRoleOpen(false);
      await load();
      Alert.alert("Saved", String(result?.message || `${name} updated`));
    } catch (e) {
      Alert.alert("Could not update the role", toErrorMessage(e, "Failed to update the role"));
    } finally {
      setSaving(false);
    }
  };

  const removeCustomRole = () => {
    if (!entry?.customRoleId) return;
    Alert.alert(
      "Delete role",
      entry.memberCount
        ? `Move ${entry.memberCount} member${entry.memberCount === 1 ? "" : "s"} to another role before deleting ${entry.label}.`
        : `${entry.label} will be removed.`,
      entry.memberCount
        ? [{ text: "OK" }]
        : [
            { text: "Cancel", style: "cancel" },
            {
              text: "Delete",
              style: "destructive",
              onPress: async () => {
                setSaving(true);
                try {
                  const result = await deleteCustomRole(entry.customRoleId!);
                  setSelected("");
                  await load();
                  Alert.alert("Deleted", String(result?.message || `${entry.label} deleted`));
                } catch (e) {
                  Alert.alert("Could not delete the role", toErrorMessage(e, "Failed to delete the role"));
                } finally {
                  setSaving(false);
                }
              },
            },
          ],
    );
  };

  /* ----------------------------------------------------------- render -- */

  if (loading) {
    return (
      <SafeAreaView style={styles.root} edges={["top", "left", "right"]}>
        <View style={styles.centred}>
          <ActivityIndicator size="large" color={brand.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right"]}>
      <View style={styles.bar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back">
          <Glyph name="arrow-back" size={24} color={brand.text} />
        </Pressable>
        <Text style={styles.barTitle} numberOfLines={1}>
          Roles &amp; Permissions
        </Text>
        <Pressable
          style={styles.newBtn}
          onPress={() => {
            setNewRoleName("");
            setNewRoleBase("EXECUTIVE");
            setNewRoleOpen(true);
          }}
          accessibilityRole="button"
        >
          <Glyph name="add" size={18} color={brand.onPrimary} />
          <Text style={styles.newBtnText}>New Role</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 18 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.searchBox}>
          <Glyph name="search" size={18} color={brand.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search roles..."
            placeholderTextColor={brand.placeholder}
            autoCapitalize="none"
          />
        </View>

        {error ? (
          <Pressable style={styles.banner} onPress={load} accessibilityRole="button">
            <Text style={styles.bannerText}>{error}</Text>
          </Pressable>
        ) : null}

        <Text style={styles.sectionTitle}>Roles</Text>

        {visible.map((row) => {
          const active = row.id === selected;
          return (
            <Pressable
              key={row.id}
              style={[styles.roleCard, active && styles.roleCardOn]}
              onPress={() => setSelected(row.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${row.label} role`}
            >
              <View style={[styles.roleIcon, active && styles.roleIconOn]}>
                <Glyph
                  name={ROLE_ICONS[row.baseRole] || "person"}
                  size={18}
                  color={active ? brand.onPrimary : brand.textSecondary}
                />
              </View>
              <View style={styles.roleBody}>
                <Text style={styles.roleName} numberOfLines={1}>
                  {row.label}
                </Text>
                <Text style={styles.roleMeta} numberOfLines={1}>
                  {`${row.memberCount} member${row.memberCount === 1 ? "" : "s"}  •  ${row.description}`}
                </Text>
              </View>
              <Glyph name="chevron-forward" size={18} color={brand.placeholder} />
            </Pressable>
          );
        })}

        {/* ---- the matrix ---- */}
        {entry && roleRow ? (
          <View style={styles.matrixCard}>
            <View style={styles.matrixHead}>
              <View style={styles.matrixTitleCol}>
                <Text style={styles.matrixTitle} numberOfLines={1}>
                  {`${entry.label} Permissions`}
                </Text>
                <Text style={styles.matrixSubtitle}>Manage what this role can access.</Text>
              </View>

              <View style={styles.membersCol}>
                <View style={styles.avatarRow}>
                  {entry.members.slice(0, 2).map((member, index) => {
                    const tone = avatarTone(member.name);
                    return (
                      <View
                        key={String(member._id || index)}
                        style={[
                          styles.memberAvatar,
                          { backgroundColor: tone.bg },
                          index > 0 && styles.memberAvatarStacked,
                        ]}
                      >
                        <Text style={[styles.memberInitials, { color: tone.fg }]}>
                          {initialsOf(member.name)}
                        </Text>
                        <PhotoOverlay uri={profilePhotoOf(member)} />
                      </View>
                    );
                  })}
                </View>
                <Text style={styles.membersCount}>
                  {`${entry.memberCount} member${entry.memberCount === 1 ? "" : "s"}`}
                </Text>
              </View>

              <Pressable
                style={[styles.pencil, editing && styles.pencilOn]}
                onPress={() => setEditing(!editing)}
                disabled={roleRow.isFixed}
                accessibilityRole="button"
                accessibilityLabel={editing ? "Stop editing" : "Edit permissions"}
              >
                <Glyph
                  name={editing ? "checkmark" : "create-outline"}
                  size={18}
                  color={roleRow.isFixed ? brand.placeholder : editing ? brand.onPrimary : brand.text}
                />
              </Pressable>
            </View>

            {entry.sharesWith ? (
              <Text style={styles.shareNote}>
                {`Shares the ${entry.sharesWith} permission set — saving reaches ${reach} ${
                  reach === 1 ? "person" : "people"
                }.`}
              </Text>
            ) : null}

            {roleRow.isFixed ? (
              <Text style={styles.shareNote}>
                An admin reaches every page by definition, so this list is fixed.
              </Text>
            ) : null}

            {PERMISSION_ROWS.map((row) => (
              <View key={row.pageKey} style={styles.permRow}>
                <Glyph name={row.icon} size={17} color={brand.textSecondary} />
                <Text style={styles.permLabel} numberOfLines={1}>
                  {row.label}
                </Text>
                <View style={styles.permChips}>
                  {actionsFor(row.pageKey).map((action) => {
                    const on = roleRow.isFixed || has(row.pageKey, action.action);
                    return (
                      <Pressable
                        key={action.action}
                        style={[styles.chip, on ? styles.chipOn : styles.chipOff]}
                        onPress={() => toggleCell(row.pageKey, action.action)}
                        disabled={!editing || roleRow.isFixed}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: on }}
                        accessibilityLabel={`${row.label} ${action.label}`}
                      >
                        <Glyph
                          name={on ? "checkmark-circle" : "close-circle"}
                          size={14}
                          color={on ? "#0a8a5c" : brand.placeholder}
                        />
                        <Text style={[styles.chipText, on ? styles.chipTextOn : styles.chipTextOff]}>
                          {action.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {/* ---- security ---- */}
        {entry && roleRow ? (
          <View style={styles.securityCard}>
            <Text style={styles.matrixTitle}>Security Settings</Text>
            <Text style={styles.matrixSubtitle}>Additional permissions and security controls.</Text>

            {SECURITY_TOGGLES.map((row) => {
              const unavailable = !row.permission;
              const on = unavailable ? false : Boolean(security[row.permission]) || roleRow.isFixed;
              return (
                <View key={row.label} style={styles.securityRow}>
                  <Glyph
                    name={row.icon}
                    size={18}
                    color={unavailable ? brand.placeholder : brand.textSecondary}
                  />
                  <View style={styles.securityBody}>
                    <Text
                      style={[styles.securityLabel, unavailable && styles.securityLabelOff]}
                      numberOfLines={1}
                    >
                      {row.label}
                    </Text>
                    {row.note ? <Text style={styles.securityNote}>{row.note}</Text> : null}
                  </View>
                  <View style={unavailable ? styles.toggleOff : undefined} pointerEvents={unavailable ? "none" : "auto"}>
                    <Toggle
                      value={on}
                      onValueChange={(next) =>
                        setSecurity((prev) => ({ ...prev, [row.permission]: next }))
                      }
                    />
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}

        <View style={styles.footer}>
          <Pressable style={styles.ghostBtn} onPress={duplicate} accessibilityRole="button">
            <Text style={styles.ghostBtnText}>Duplicate role</Text>
          </Pressable>
          <Pressable
            style={[styles.primaryBtn, (saving || !editing) && styles.primaryBtnOff]}
            onPress={save}
            disabled={saving || !editing}
            accessibilityRole="button"
          >
            <Text style={styles.primaryBtnText}>{saving ? "Saving…" : "Save permissions"}</Text>
          </Pressable>
        </View>

        {entry?.customRoleId ? (
          <View style={styles.footer}>
            <Pressable
              style={styles.ghostBtn}
              onPress={() => {
                setEditRoleName(entry.label);
                setEditRoleOpen(true);
              }}
              accessibilityRole="button"
            >
              <Text style={styles.ghostBtnText}>Rename role</Text>
            </Pressable>
            <Pressable style={styles.dangerBtn} onPress={removeCustomRole} accessibilityRole="button">
              <Text style={styles.dangerBtnText}>Delete role</Text>
            </Pressable>
          </View>
        ) : null}

        {!editing && entry && roleRow && !roleRow.isFixed ? (
          <Text style={styles.hint}>Tap the pencil to change what this role can reach.</Text>
        ) : null}
      </ScrollView>

      <AppSheet visible={newRoleOpen} onClose={() => setNewRoleOpen(false)} title="New role">
        <Text style={styles.sheetNote}>
          A role is a name over one of the built-in roles. Its holders are treated as that role, and
          what they reach is the list you edit here.
        </Text>

        <View style={styles.sheetField}>
          <Text style={styles.sheetLabel}>Name</Text>
          <TextInput
            style={styles.sheetInput}
            value={newRoleName}
            onChangeText={setNewRoleName}
            placeholder="Client Relations"
            placeholderTextColor={brand.placeholder}
            autoCapitalize="words"
          />
        </View>

        <Text style={styles.sheetLabel}>Behaves as</Text>
        {BASE_ROLE_OPTIONS.map((value) => (
          <Pressable
            key={value}
            style={styles.sheetOption}
            onPress={() => setNewRoleBase(value)}
            accessibilityRole="button"
          >
            <Text style={styles.sheetOptionText}>{ROLE_LABELS[value] || value}</Text>
            {newRoleBase === value ? <Glyph name="checkmark" size={18} color={brand.primary} /> : null}
          </Pressable>
        ))}

        <Pressable
          style={[styles.sheetSubmit, saving && styles.primaryBtnOff]}
          onPress={createRole}
          disabled={saving}
          accessibilityRole="button"
        >
          <Text style={styles.primaryBtnText}>{saving ? "Creating…" : "Create role"}</Text>
        </Pressable>
      </AppSheet>

      <AppSheet visible={editRoleOpen} onClose={() => setEditRoleOpen(false)} title="Edit role">
        <Text style={styles.sheetNote}>
          Renaming changes the label for everyone on this role. Its underlying access stays attached to the same built-in role.
        </Text>
        <View style={styles.sheetField}>
          <Text style={styles.sheetLabel}>Name</Text>
          <TextInput
            style={styles.sheetInput}
            value={editRoleName}
            onChangeText={setEditRoleName}
            placeholder="Role name"
            placeholderTextColor={brand.placeholder}
            autoCapitalize="words"
          />
        </View>
        <Pressable
          style={[styles.primaryBtn, (saving || !editRoleName.trim()) && styles.primaryBtnOff]}
          onPress={renameRole}
          disabled={saving || !editRoleName.trim()}
          accessibilityRole="button"
        >
          <Text style={styles.primaryBtnText}>{saving ? "Saving…" : "Save role"}</Text>
        </Pressable>
      </AppSheet>
    </SafeAreaView>
  );
};

export default RolesPermissionsScreen;

const styles = brandStyles((b) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: b.bg,
    },
    centred: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },

    bar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: layout.pageGutter,
      paddingTop: 6,
      paddingBottom: 10,
    },
    barTitle: {
      flex: 1,
      minWidth: 0,
      fontSize: t.barTitle,
      lineHeight: 23,
      fontWeight: "700",
      letterSpacing: -0.5,
      color: b.text,
    },
    newBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      height: 36,
      paddingHorizontal: 13,
      borderRadius: round.field,
      backgroundColor: "#008561",
    },
    newBtnText: {
      fontSize: t.cardTitle,
      fontWeight: "700",
      color: b.onPrimary,
    },

    body: {
      paddingHorizontal: layout.pageGutter,
      gap: 8,
    },

    searchBox: {
      height: 38,
      flexDirection: "row",
      alignItems: "center",
      gap: 11,
      paddingHorizontal: 14,
      borderRadius: round.field,
      backgroundColor: b.fieldMuted,
    },
    searchInput: {
      flex: 1,
      minWidth: 0,
      paddingVertical: 0,
      fontSize: 11,
      color: b.text,
    },

    banner: {
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderWidth: 1,
      borderColor: b.alert,
      borderRadius: round.field,
      backgroundColor: b.surface,
    },
    bannerText: {
      fontSize: t.body,
      lineHeight: 17,
      color: b.alert,
    },

    sectionTitle: {
      marginTop: 6,
      fontSize: 13,
      lineHeight: 18,
      fontWeight: "700",
      letterSpacing: -0.5,
      color: b.text,
    },

    /* ---- a role row ---- */
    roleCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 12,
      paddingVertical: 11,
      borderWidth: 1,
      borderColor: b.border,
      borderRadius: round.panel,
      backgroundColor: b.surface,
    },
    roleCardOn: {
      borderColor: b.greenBright,
      backgroundColor: b.uploadTint,
    },
    roleIcon: {
      width: 38,
      height: 38,
      borderRadius: round.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: b.fieldMuted,
    },
    roleIconOn: {
      backgroundColor: "#0a7a52",
    },
    roleBody: {
      flex: 1,
      minWidth: 0,
    },
    roleName: {
      fontSize: 11.5,
      lineHeight: 16,
      fontWeight: "700",
      letterSpacing: -0.2,
      color: b.text,
    },
    roleMeta: {
      marginTop: 1,
      fontSize: 9,
      lineHeight: 13,
      color: b.textMuted,
    },

    /* ---- the matrix ---- */
    matrixCard: {
      marginTop: 8,
      paddingHorizontal: 12,
      paddingTop: 13,
      paddingBottom: 6,
      borderWidth: 1,
      borderColor: b.border,
      borderRadius: round.panel,
      backgroundColor: b.surface,
    },
    matrixHead: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    matrixTitleCol: {
      flex: 1,
      minWidth: 0,
    },
    matrixTitle: {
      fontSize: 13,
      lineHeight: 18,
      fontWeight: "700",
      letterSpacing: -0.3,
      color: b.text,
    },
    matrixSubtitle: {
      marginTop: 2,
      fontSize: 9,
      lineHeight: 13,
      color: b.textMuted,
    },
    membersCol: {
      alignItems: "center",
      gap: 4,
    },
    avatarRow: {
      flexDirection: "row",
    },
    memberAvatar: {
      width: 29,
      height: 29,
      borderRadius: round.pill,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderColor: b.surface,
    },
    memberAvatarStacked: {
      marginLeft: -9,
    },
    memberInitials: {
      fontSize: t.tagline,
      fontWeight: "700",
    },
    membersCount: {
      fontSize: 8,
      color: b.textMuted,
    },
    pencil: {
      width: 38,
      height: 38,
      borderRadius: round.field,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: b.border,
      backgroundColor: b.surface,
    },
    pencilOn: {
      borderColor: b.greenBright,
      backgroundColor: "#0a7a52",
    },
    shareNote: {
      marginTop: 10,
      fontSize: 9,
      lineHeight: 13,
      color: b.textSecondary,
    },

    permRow: {
      marginTop: 10,
      paddingTop: 9,
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
      borderTopWidth: 1,
      borderTopColor: b.hairline,
    },
    permLabel: {
      width: 74,
      fontSize: 9.5,
      fontWeight: "600",
      color: b.text,
    },
    permChips: {
      flex: 1,
      minWidth: 0,
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 5,
    },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: round.chip,
    },
    chipOn: {
      backgroundColor: b.tintBadge,
    },
    chipOff: {
      backgroundColor: b.fieldMuted,
    },
    chipText: {
      fontSize: 11,
      fontWeight: "600",
    },
    chipTextOn: {
      color: b.deep,
    },
    chipTextOff: {
      color: b.placeholder,
    },

    /* ---- security ---- */
    securityCard: {
      marginTop: 8,
      paddingHorizontal: 12,
      paddingTop: 13,
      paddingBottom: 6,
      borderWidth: 1,
      borderColor: b.border,
      borderRadius: round.panel,
      backgroundColor: b.surface,
    },
    securityRow: {
      marginTop: 12,
      paddingTop: 11,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      borderTopWidth: 1,
      borderTopColor: b.hairline,
    },
    securityBody: {
      flex: 1,
      minWidth: 0,
    },
    securityLabel: {
      fontSize: 10,
      color: b.text,
    },
    securityLabelOff: {
      color: b.placeholder,
    },
    securityNote: {
      marginTop: 2,
      fontSize: 8.5,
      lineHeight: 12,
      color: b.textMuted,
    },
    toggleOff: {
      opacity: 0.4,
    },

    /* ---- footer ---- */
    footer: {
      marginTop: 10,
      flexDirection: "row",
      gap: 11,
    },
    ghostBtn: {
      flex: 1,
      minWidth: 0,
      height: 48,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: b.border,
      borderRadius: round.field,
      backgroundColor: b.surface,
    },
    ghostBtnText: {
      fontSize: 12,
      fontWeight: "700",
      color: b.text,
    },
    dangerBtn: {
      flex: 1,
      minWidth: 0,
      height: 48,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: b.alert,
      borderRadius: round.field,
      backgroundColor: b.alertTint,
    },
    dangerBtnText: {
      fontSize: 12,
      fontWeight: "700",
      color: b.alert,
    },
    primaryBtn: {
      flex: 1.25,
      minWidth: 0,
      height: 48,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: round.field,
      backgroundColor: "#0b7d52",
    },
    primaryBtnOff: {
      opacity: 0.55,
    },
    primaryBtnText: {
      fontSize: 12.5,
      fontWeight: "700",
      color: b.onPrimary,
    },
    hint: {
      textAlign: "center",
      fontSize: 9,
      color: b.textMuted,
    },

    /* ---- new role sheet ---- */
    sheetNote: {
      paddingBottom: 12,
      fontSize: t.body,
      lineHeight: 17,
      color: b.textMuted,
    },
    sheetField: {
      marginBottom: 14,
    },
    sheetLabel: {
      marginBottom: 7,
      fontSize: t.fieldLabel,
      fontWeight: "600",
      color: b.text,
    },
    sheetInput: {
      height: layout.fieldHeight,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: b.fieldBorder,
      borderRadius: round.field,
      fontSize: t.field,
      color: b.text,
      backgroundColor: b.surface,
    },
    sheetOption: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: b.hairline,
    },
    sheetOptionText: {
      fontSize: t.field,
      color: b.text,
    },
    sheetSubmit: {
      marginTop: 16,
      height: 48,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: round.field,
      backgroundColor: "#0b7d52",
    },
  }),
);
