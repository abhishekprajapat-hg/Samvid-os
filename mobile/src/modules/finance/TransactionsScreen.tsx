import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Glyph, type GlyphName } from "../../components/ui/Glyph";
import { AppSheet } from "../../components/ui/Overlay";
import { brand, brandStyles, layout, round, type as t } from "../../theme/brand";
import { toErrorMessage } from "../../utils/errorMessage";
import { getFinanceTransactions, type FinanceTransaction } from "../../services/financeService";
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  PAYMENT_METHODS,
  categoryIcon,
  categoryLabel,
  compactMoney,
  dayHeadingOf,
  methodLabel,
  monthKeyOf,
  monthLabelOf,
  signedMoney,
  statusTone,
} from "./financeVocab";

/*
 * Every movement in the month, grouped by day - the comp's list view of the
 * same feed the dashboard shows the top of.
 */

const TYPES: Array<{ key: "ALL" | "INCOME" | "EXPENSE"; label: string }> = [
  { key: "ALL", label: "All" },
  { key: "INCOME", label: "Income" },
  { key: "EXPENSE", label: "Expenses" },
];

const STATUSES = [
  { value: "", label: "All Status" },
  { value: "PAID", label: "Paid" },
  { value: "PENDING", label: "Pending" },
  { value: "CANCELLED", label: "Cancelled" },
];

const monthOptions = () =>
  Array.from({ length: 12 }, (_, back) => {
    const date = new Date();
    date.setDate(1);
    date.setMonth(date.getMonth() - back);
    const key = monthKeyOf(date);
    return { value: key, label: monthLabelOf(key) };
  });

const Picker = ({
  value,
  label,
  options,
  onChange,
  icon,
  wide,
}: {
  value: string;
  label: string;
  options: Array<{ value: string; label: string }>;
  onChange: (next: string) => void;
  icon?: GlyphName;
  wide?: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  return (
    <>
      <Pressable
        style={[styles.picker, wide && styles.pickerWide]}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
      >
        {icon ? <Glyph name={icon} size={16} color={brand.text} /> : null}
        <Text style={styles.pickerText} numberOfLines={1}>
          {selected?.label || label}
        </Text>
        <Glyph name="chevron-down" size={14} color={brand.textSecondary} />
      </Pressable>

      <AppSheet visible={open} onClose={() => setOpen(false)} title={label}>
        {options.map((option) => (
          <Pressable
            key={option.value || "all"}
            style={styles.sheetRow}
            onPress={() => {
              onChange(option.value);
              setOpen(false);
            }}
            accessibilityRole="button"
          >
            <Text style={styles.sheetLabel}>{option.label}</Text>
            {option.value === value ? (
              <Glyph name="checkmark" size={18} color={brand.primary} />
            ) : null}
          </Pressable>
        ))}
      </AppSheet>
    </>
  );
};

export const TransactionsScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();

  const [query, setQuery] = useState("");
  const [type, setType] = useState<"ALL" | "INCOME" | "EXPENSE">(
    (route.params?.type as "ALL" | "INCOME" | "EXPENSE") || "ALL",
  );
  const [month, setMonth] = useState<string>(route.params?.month || monthKeyOf(new Date()));
  const [status, setStatus] = useState<string>(route.params?.status || "");
  const [category, setCategory] = useState("");
  const [method, setMethod] = useState("");

  const [rows, setRows] = useState<FinanceTransaction[]>([]);
  const [totals, setTotals] = useState({ in: 0, out: 0, net: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(
    async (quiet = false) => {
      try {
        if (quiet) setRefreshing(true);
        else setLoading(true);
        setError("");

        const result = await getFinanceTransactions({
          month,
          type,
          status: status || undefined,
          category: category || undefined,
          method: method || undefined,
          q: query.trim() || undefined,
          limit: 300,
        });
        setRows(result.transactions);
        setTotals(result.totals);
      } catch (e) {
        setError(toErrorMessage(e, "Failed to load transactions"));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [month, type, status, category, method, query],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      void load(true);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  /* The comp groups the list under a heading per day. */
  const groups = useMemo(() => {
    const byDay = new Map<string, FinanceTransaction[]>();
    for (const row of rows) {
      const key = String(row.date || "").slice(0, 10);
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key)!.push(row);
    }
    return [...byDay.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, items]) => ({ key, heading: dayHeadingOf(items[0]?.date), items }));
  }, [rows]);

  const categories = useMemo(() => {
    const pool = type === "INCOME"
      ? INCOME_CATEGORIES
      : type === "EXPENSE"
        ? EXPENSE_CATEGORIES
        : [...new Set([...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES])];
    return [{ value: "", label: "Category" }, ...pool.map((key) => ({ value: key, label: categoryLabel(key) }))];
  }, [type]);

  const exportCsv = async () => {
    try {
      const head = "Date,Type,Title,Party,Category,Amount,Method,Status,Reference";
      const body = rows
        .map((row) =>
          [
            new Date(row.date).toISOString().slice(0, 10),
            row.kind,
            row.title,
            row.party,
            row.category,
            row.amount,
            row.method,
            row.status,
            row.reference,
          ]
            .map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`)
            .join(","),
        )
        .join("\n");
      const path = `${FileSystem.cacheDirectory}transactions-${month}.csv`;
      await FileSystem.writeAsStringAsync(path, `${head}\n${body}`);
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(path);
      else Alert.alert("Export", `Saved to ${path}`);
    } catch (e) {
      Alert.alert("Export", toErrorMessage(e, "Could not export"));
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right"]}>
      <View style={styles.bar}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Glyph name="arrow-back" size={24} color={brand.text} />
        </Pressable>
        <Text style={styles.barTitle} numberOfLines={1}>
          Transactions
        </Text>
        <Pressable onPress={exportCsv} hitSlop={10} accessibilityRole="button" accessibilityLabel="Export">
          <Glyph name="share-outline" size={22} color={brand.text} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: 96 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={brand.primary} />
        }
      >
        <View style={styles.searchBox}>
          <Glyph name="search" size={18} color={brand.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search transactions..."
            placeholderTextColor={brand.placeholder}
            returnKeyType="search"
          />
          {query ? (
            <Pressable onPress={() => setQuery("")} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear">
              <Glyph name="close-circle" size={17} color={brand.placeholder} />
            </Pressable>
          ) : null}
        </View>

        <View style={styles.typeRow}>
          {TYPES.map((entry) => {
            const active = type === entry.key;
            return (
              <Pressable
                key={entry.key}
                style={[styles.typeChip, active && styles.typeChipOn]}
                onPress={() => setType(entry.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.typeLabel, active && styles.typeLabelOn]}>{entry.label}</Text>
              </Pressable>
            );
          })}
          <Picker
            value={month}
            label="Month"
            options={monthOptions()}
            onChange={setMonth}
            icon="calendar-outline"
            wide
          />
        </View>

        <View style={styles.totalRow}>
          <View style={styles.totalCard}>
            <View style={styles.totalHead}>
              <Text style={styles.totalLabel}>Total In</Text>
              <View style={[styles.totalIcon, { backgroundColor: brand.tint }]}>
                <Glyph name="arrow-up" size={15} color={brand.primary} />
              </View>
            </View>
            <Text style={[styles.totalValue, { color: brand.primary }]} numberOfLines={1}>
              {compactMoney(totals.in)}
            </Text>
          </View>
          <View style={styles.totalCard}>
            <View style={styles.totalHead}>
              <Text style={styles.totalLabel}>Total Out</Text>
              <View style={[styles.totalIcon, { backgroundColor: brand.alertTint }]}>
                <Glyph name="arrow-down" size={15} color={brand.alertInk} />
              </View>
            </View>
            <Text style={[styles.totalValue, { color: brand.alertInk }]} numberOfLines={1}>
              {compactMoney(totals.out)}
            </Text>
          </View>
          <View style={styles.totalCard}>
            <View style={styles.totalHead}>
              <Text style={styles.totalLabel}>Net</Text>
              <View style={[styles.totalIcon, { backgroundColor: brand.tint }]}>
                <Glyph name="stats-chart" size={14} color={brand.deep} />
              </View>
            </View>
            <Text style={[styles.totalValue, { color: brand.primary }]} numberOfLines={1}>
              {compactMoney(totals.net)}
            </Text>
          </View>
        </View>

        <View style={styles.filterRow}>
          <Picker value={status} label="All Status" options={STATUSES} onChange={setStatus} />
          <Picker value={category} label="Category" options={categories} onChange={setCategory} />
          <Picker
            value={method}
            label="Payment Mode"
            options={[
              { value: "", label: "Payment Mode" },
              ...PAYMENT_METHODS.map((key) => ({ value: key, label: methodLabel(key) })),
            ]}
            onChange={setMethod}
          />
        </View>

        {error ? (
          <Pressable style={styles.banner} onPress={() => load()} accessibilityRole="button">
            <Text style={styles.bannerText}>{error}</Text>
          </Pressable>
        ) : null}

        {loading ? (
          <View style={styles.centredPad}>
            <ActivityIndicator size="large" color={brand.primary} />
          </View>
        ) : groups.length === 0 ? (
          <View style={styles.empty}>
            <Glyph name="receipt-outline" size={30} color={brand.placeholder} />
            <Text style={styles.emptyText}>Nothing matches these filters</Text>
          </View>
        ) : (
          groups.map((group) => (
            <View key={group.key}>
              <Text style={styles.groupHeading}>{group.heading}</Text>
              <View style={styles.groupCard}>
                {group.items.map((row, index) => {
                  const tone = statusTone(row.status);
                  const expense = row.amount < 0;
                  return (
                    <Pressable
                      key={row.id}
                      style={[styles.row, index > 0 && styles.rowDivided]}
                      onPress={() =>
                        row.invoiceId
                          ? navigation.navigate("InvoiceDetails", { invoiceId: row.invoiceId })
                          : undefined
                      }
                      accessibilityRole="button"
                    >
                      <View
                        style={[
                          styles.rowIcon,
                          { backgroundColor: expense ? brand.alertTint : brand.tint },
                        ]}
                      >
                        <Glyph
                          name={categoryIcon(row.category)}
                          size={18}
                          color={expense ? brand.alertInk : brand.deep}
                        />
                      </View>

                      <View style={styles.grow}>
                        <Text style={styles.rowTitle} numberOfLines={1}>
                          {row.title}
                        </Text>
                        <Text style={styles.rowSub} numberOfLines={1}>
                          {[row.party, methodLabel(row.method)].filter(Boolean).join(" • ")}
                        </Text>
                      </View>

                      <View style={styles.rowRight}>
                        <Text
                          style={[
                            styles.rowAmount,
                            { color: expense ? brand.alertInk : brand.primary },
                          ]}
                          numberOfLines={1}
                        >
                          {signedMoney(row.amount)}
                        </Text>
                        <View style={[styles.rowPill, { backgroundColor: tone.bg }]}>
                          <View style={[styles.rowDot, { backgroundColor: tone.fg }]} />
                          <Text style={[styles.rowPillText, { color: tone.fg }]}>{tone.label}</Text>
                        </View>
                      </View>

                      <Glyph name="chevron-forward" size={17} color={brand.textMuted} />
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <Pressable
        style={[styles.fab, { bottom: 18 + insets.bottom }]}
        onPress={() => navigation.navigate("AddEntry")}
        accessibilityRole="button"
      >
        <Glyph name="add" size={20} color={brand.onPrimary} />
        <Text style={styles.fabText}>Add Entry</Text>
      </Pressable>
    </SafeAreaView>
  );
};

const styles = brandStyles((b) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: b.bg },
    grow: { flex: 1, minWidth: 0 },
    centredPad: { paddingVertical: 48, alignItems: "center" },

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

    body: { paddingHorizontal: layout.gutter },

    searchBox: {
      height: 40,
      flexDirection: "row",
      alignItems: "center",
      gap: 11,
      paddingHorizontal: 14,
      borderWidth: 1,
      borderColor: b.border,
      borderRadius: round.field,
      backgroundColor: b.surface,
    },
    searchInput: {
      flex: 1,
      minWidth: 0,
      paddingVertical: 0,
      fontSize: t.cardTitle,
      color: b.text,
    },

    typeRow: {
      marginTop: 10,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    typeChip: {
      flex: 0.85,
      minWidth: 0,
      height: 38,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: b.border,
      borderRadius: round.field,
      backgroundColor: b.surface,
    },
    typeChipOn: {
      borderColor: b.greenBright,
      backgroundColor: "#dff2e8",
    },
    typeLabel: {
      fontSize: t.cardTitle,
      fontWeight: "500",
      color: b.text,
    },
    typeLabelOn: { fontWeight: "700" },

    picker: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      flex: 1,
      minWidth: 0,
      height: 38,
      paddingHorizontal: 8,
      borderWidth: 1,
      borderColor: b.border,
      borderRadius: round.field,
      backgroundColor: b.surface,
    },
    pickerWide: { flex: 2.4 },
    pickerText: {
      flexShrink: 1,
      fontSize: t.body,
      fontWeight: "500",
      color: b.text,
    },

    totalRow: {
      marginTop: 10,
      flexDirection: "row",
      gap: 8,
    },
    totalCard: {
      flex: 1,
      minWidth: 0,
      paddingHorizontal: 11,
      paddingVertical: 11,
      borderWidth: 1,
      borderColor: b.border,
      borderRadius: round.panel,
      backgroundColor: b.surface,
    },
    totalHead: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    totalLabel: {
      flex: 1,
      minWidth: 0,
      fontSize: t.body,
      color: b.textSecondary,
    },
    totalIcon: {
      width: 26,
      height: 26,
      borderRadius: round.pill,
      alignItems: "center",
      justifyContent: "center",
    },
    totalValue: {
      marginTop: 7,
      fontSize: t.sectionTitle,
      lineHeight: 20,
      fontWeight: "700",
      letterSpacing: -0.4,
    },

    filterRow: {
      marginTop: 10,
      flexDirection: "row",
      gap: 8,
    },

    banner: {
      marginTop: 12,
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderWidth: 1,
      borderColor: b.alert,
      borderRadius: round.field,
      backgroundColor: b.surface,
    },
    bannerText: { fontSize: t.body, lineHeight: 17, color: b.alert },

    groupHeading: {
      marginTop: 16,
      marginBottom: 8,
      fontSize: t.cardTitle,
      fontWeight: "500",
      color: b.textSecondary,
    },
    groupCard: {
      borderWidth: 1,
      borderColor: b.border,
      borderRadius: round.panel,
      backgroundColor: b.surface,
      overflow: "hidden",
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 11,
      paddingHorizontal: 12,
      paddingVertical: 12,
    },
    rowDivided: {
      borderTopWidth: 1,
      borderTopColor: b.hairline,
    },
    rowIcon: {
      width: 40,
      height: 40,
      borderRadius: round.field,
      alignItems: "center",
      justifyContent: "center",
    },
    rowTitle: {
      fontSize: t.rowTitle,
      fontWeight: "700",
      color: b.text,
    },
    rowSub: {
      marginTop: 2,
      fontSize: t.body,
      color: b.textMuted,
    },
    rowRight: { alignItems: "flex-end", gap: 5 },
    rowAmount: {
      fontSize: t.sectionTitle,
      fontWeight: "700",
    },
    rowPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: round.pill,
    },
    rowDot: {
      width: 6,
      height: 6,
      borderRadius: round.pill,
    },
    rowPillText: {
      fontSize: t.tagline,
      fontWeight: "700",
    },

    empty: {
      alignItems: "center",
      gap: 10,
      paddingVertical: 48,
    },
    emptyText: { fontSize: t.field, color: b.textMuted },

    fab: {
      position: "absolute",
      right: layout.gutter,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      height: 52,
      paddingHorizontal: 20,
      borderRadius: round.pill,
      backgroundColor: "#0b7d52",
    },
    fabText: {
      fontSize: t.sectionTitle,
      fontWeight: "700",
      color: b.onPrimary,
    },

    sheetRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: b.hairline,
    },
    sheetLabel: { fontSize: t.field, color: b.text },
  }),
);

export default TransactionsScreen;
