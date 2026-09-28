import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Glyph } from "../ui/Glyph";
import { useAuth } from "../../context/AuthContext";
import { usePermissions } from "../../context/PermissionContext";
import { getVisibleGroups } from "../../navigation/access";
import type { NavGroup, NavItem } from "../../navigation/navigationCatalogue";
import { brand, brandStyles, layout, round, type } from "../../theme/brand";

type SearchRow = NavItem & { group: string };

export const filterPageSearchRows = (groups: NavGroup[], query: string): SearchRow[] => {
  const term = String(query || "").trim().toLowerCase();
  const seen = new Set<string>();

  return groups.flatMap((group) =>
    group.items
      .filter((item) => {
        const key = `${item.screen}:${item.page}`;
        if (seen.has(key)) return false;
        seen.add(key);
        if (!term) return true;
        return [item.label, item.path, item.page, group.group]
          .join(" ")
          .toLowerCase()
          .includes(term);
      })
      .map((item) => ({ ...item, group: group.group })),
  );
};

export const GlobalPageSearch = ({
  visible,
  onClose,
  navigation,
}: {
  visible: boolean;
  onClose: () => void;
  navigation: any;
}) => {
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const { role, user } = useAuth();
  const { permissions, enforcePageAccess } = usePermissions();
  const [query, setQuery] = useState("");

  const groups = useMemo(
    () =>
      getVisibleGroups(role, {
        permissions,
        enforcePageAccess,
        canViewInventory: user?.canViewInventory,
      }),
    [enforcePageAccess, permissions, role, user?.canViewInventory],
  );
  const rows = useMemo(() => filterPageSearchRows(groups, query), [groups, query]);

  useEffect(() => {
    if (!visible) {
      setQuery("");
      return;
    }
    const timer = setTimeout(() => inputRef.current?.focus(), 120);
    return () => clearTimeout(timer);
  }, [visible]);

  const open = (item: SearchRow) => {
    Keyboard.dismiss();
    onClose();
    navigation.navigate(item.screen);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close search" />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View style={styles.handle} />
          <View style={styles.headingRow}>
            <View>
              <Text style={styles.title}>Search pages</Text>
              <Text style={styles.subtitle}>Jump anywhere your account can access</Text>
            </View>
            <Pressable style={styles.closeButton} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close search">
              <Glyph name="close" size={21} color={brand.text} />
            </Pressable>
          </View>

          <View style={styles.searchBox}>
            <Glyph name="search" size={19} color={brand.textSecondary} />
            <TextInput
              ref={inputRef}
              value={query}
              onChangeText={setQuery}
              placeholder="Search pages..."
              placeholderTextColor={brand.textMuted}
              returnKeyType="search"
              autoCorrect={false}
              style={styles.input}
            />
            {query ? (
              <Pressable onPress={() => setQuery("")} accessibilityRole="button" accessibilityLabel="Clear search">
                <Glyph name="close-circle" size={19} color={brand.textMuted} />
              </Pressable>
            ) : null}
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.results}>
            {rows.length ? (
              rows.map((item) => (
                <Pressable
                  key={`${item.screen}:${item.page}`}
                  style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                  onPress={() => open(item)}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${item.label}`}
                >
                  <View style={styles.iconBadge}>
                    <Glyph name="arrow-forward" size={16} color={brand.green} />
                  </View>
                  <View style={styles.rowCopy}>
                    <Text style={styles.rowLabel}>{item.label}</Text>
                    <Text style={styles.rowMeta}>{item.group}</Text>
                  </View>
                  <Glyph name="chevron-forward" size={17} color={brand.textMuted} />
                </Pressable>
              ))
            ) : (
              <View style={styles.empty}>
                <Glyph name="search" size={28} color={brand.textMuted} />
                <Text style={styles.emptyTitle}>No matching pages</Text>
                <Text style={styles.emptyText}>Try a page name such as Leads, Reports, Team, or Finance.</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = brandStyles((b) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      justifyContent: "flex-end",
      backgroundColor: "rgba(9, 17, 29, 0.48)",
    },
    sheet: {
      maxHeight: "82%",
      minHeight: "54%",
      paddingHorizontal: layout.gutter,
      paddingTop: 8,
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      backgroundColor: b.bg,
    },
    handle: {
      alignSelf: "center",
      width: 38,
      height: 4,
      marginBottom: 16,
      borderRadius: round.pill,
      backgroundColor: b.hairline,
    },
    headingRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 14,
    },
    title: {
      fontSize: type.pageTitle,
      fontWeight: "800",
      color: b.ink,
    },
    subtitle: {
      marginTop: 2,
      fontSize: type.label,
      color: b.textMuted,
    },
    closeButton: {
      width: 36,
      height: 36,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: round.pill,
      backgroundColor: b.surface,
      borderWidth: 1,
      borderColor: b.hairline,
    },
    searchBox: {
      minHeight: 46,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 13,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: b.hairline,
      backgroundColor: b.surface,
    },
    input: {
      flex: 1,
      paddingVertical: 10,
      fontSize: type.body,
      color: b.ink,
    },
    results: {
      paddingTop: 12,
      paddingBottom: 18,
    },
    row: {
      minHeight: 56,
      flexDirection: "row",
      alignItems: "center",
      gap: 11,
      paddingHorizontal: 10,
      borderBottomWidth: 1,
      borderBottomColor: b.hairline,
    },
    rowPressed: {
      backgroundColor: b.tintSoft,
    },
    iconBadge: {
      width: 32,
      height: 32,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 9,
      backgroundColor: b.tintSoft,
    },
    rowCopy: {
      flex: 1,
    },
    rowLabel: {
      fontSize: type.body,
      fontWeight: "700",
      color: b.ink,
    },
    rowMeta: {
      marginTop: 2,
      fontSize: type.tagline,
      fontWeight: "600",
      color: b.textMuted,
      letterSpacing: 0.35,
    },
    empty: {
      alignItems: "center",
      paddingHorizontal: 26,
      paddingVertical: 44,
    },
    emptyTitle: {
      marginTop: 10,
      fontSize: type.body,
      fontWeight: "700",
      color: b.ink,
    },
    emptyText: {
      marginTop: 5,
      textAlign: "center",
      fontSize: type.label,
      lineHeight: 18,
      color: b.textMuted,
    },
  }),
);

export default GlobalPageSearch;
