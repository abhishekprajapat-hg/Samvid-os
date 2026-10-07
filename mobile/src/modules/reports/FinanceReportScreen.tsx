import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Glyph, type GlyphName } from "../../components/ui/Glyph";
import { AppSheet } from "../../components/ui/Overlay";
import { brand, brandStyles, layout, round, type as t } from "../../theme/brand";
import { toErrorMessage } from "../../utils/errorMessage";
import {
  getFinanceInvoices,
  getFinanceOverview,
  getFinanceTransactions,
  type FinanceInvoice,
  type FinanceSummary,
  type FinanceTransaction,
} from "../../services/financeService";
import { getInventoryAssets } from "../../services/inventoryService";
import {
  axisMoney,
  categoryLabel,
  compactMoney,
  exactMoney,
  fullDateOf,
  monthKeyOf,
  monthLabelOf,
  statusTone,
} from "../finance/financeVocab";
import { BarList, ComboChart, Donut, Legend } from "./reportCharts";
import { MONTHS_SHORT, changeLabel, collectionRate, groupByCategory } from "./reportData";

/*
 * The finance report, drawn to the comp.
 *
 * It reads the same ledger the Finance screens do and adds the two cuts a
 * report wants and a dashboard does not: where the money came from, and where
 * it went.
 */

const Stat = ({
  label,
  value,
  icon,
  tint,
  color,
  change,
}: {
  label: string;
  value: string;
  icon: GlyphName;
  tint: string;
  color: string;
  change?: string | null;
}) => (
  <View style={styles.stat}>
    <View style={styles.statHead}>
      <Text style={styles.statLabel} numberOfLines={1}>
        {label}
      </Text>
      <View style={[styles.statIcon, { backgroundColor: tint }]}>
        <Glyph name={icon} size={15} color={color} />
      </View>
    </View>
    <Text style={[styles.statValue, { color }]} numberOfLines={1}>
      {value}
    </Text>
    {change ? (
      <View style={styles.statChange}>
        <Glyph
          name={change.startsWith("-") ? "caret-down" : "caret-up"}
          size={11}
          color={change.startsWith("-") ? brand.alertInk : brand.primary}
        />
        <Text
          style={[
            styles.statChangeText,
            { color: change.startsWith("-") ? brand.alertInk : brand.primary },
          ]}
        >
          {change}
        </Text>
      </View>
    ) : null}
  </View>
);

export const FinanceReportScreen = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const [month, setMonth] = useState(monthKeyOf(new Date()));
  const [monthOpen, setMonthOpen] = useState(false);
  const [property, setProperty] = useState("");
  const [propertyOpen, setPropertyOpen] = useState(false);

  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [previous, setPrevious] = useState<FinanceSummary | null>(null);
  const [series, setSeries] = useState<Array<{ month: string; income: number; expenses: number }>>([]);
  const [rows, setRows] = useState<FinanceTransaction[]>([]);
  const [invoices, setInvoices] = useState<FinanceInvoice[]>([]);
  const [properties, setProperties] = useState<Array<{ _id: string; label: string; image?: string }>>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const priorMonth = (() => {
        const [year, index] = month.split("-").map(Number);
        const date = new Date(year, index - 2, 1);
        return monthKeyOf(date);
      })();

      const [overview, prior, feed, bills, assets] = await Promise.all([
        getFinanceOverview({ month, months: 6 }),
        getFinanceOverview({ month: priorMonth, months: 1 }).catch(() => ({ summary: null, series: [] })),
        getFinanceTransactions({ month, limit: 300 }),
        getFinanceInvoices({ limit: 50 }).catch(() => []),
        getInventoryAssets().catch(() => []),
      ]);

      setSummary(overview.summary);
      setSeries(overview.series);
      setPrevious(prior.summary);
      setRows(feed.transactions);
      setInvoices(bills);
      setProperties(
        (Array.isArray(assets) ? assets : []).map((asset: any) => ({
          _id: String(asset._id),
          label: String(asset.projectName || asset.title || "Property"),
          image: Array.isArray(asset.images) ? asset.images[0] : undefined,
        })),
      );
    } catch (e) {
      setError(toErrorMessage(e, "Failed to load the finance report"));
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    void load();
  }, [load]);

  const revenueBreakdown = useMemo(
    () => groupByCategory(rows.filter((row) => row.amount > 0).map((row) => ({ category: row.category, amount: row.amount })), 3),
    [rows],
  );
  const expenseBreakdown = useMemo(
    () => groupByCategory(rows.filter((row) => row.amount < 0).map((row) => ({ category: row.category, amount: row.amount })), 4),
    [rows],
  );

  const outstanding = useMemo(
    () =>
      invoices
        .filter((invoice) => !["PAID", "CANCELLED"].includes(String(invoice.status || "")))
        .map((invoice) => ({
          invoice,
          balance: Math.max(0, Number(invoice.totalAmount || 0) - Number(invoice.amountPaid || 0)),
        }))
        .sort((a, b) => new Date(a.invoice.dueDate || 0).getTime() - new Date(b.invoice.dueDate || 0).getTime()),
    [invoices],
  );

  const chart = useMemo(
    () =>
      series.map((point) => ({
        label: MONTHS_SHORT[Number(point.month.split("-")[1]) - 1]?.slice(0, 3) || "",
        a: point.income,
        b: point.expenses,
        line: point.income - point.expenses,
      })),
    [series],
  );

  const rate = collectionRate(Number(summary?.collected || 0), Number(summary?.income || 0));
  const revenueChange = changeLabel(Number(summary?.income || 0), Number(previous?.income || 0));

  const insight = revenueChange
    ? `Revenue ${revenueChange.startsWith("-") ? "fell" : "increased"} ${revenueChange.replace("-", "")} against last month${revenueBreakdown[0] ? `, driven mostly by ${categoryLabel(revenueBreakdown[0].label).toLowerCase()}` : ""}.`
    : "No comparison available for the previous month.";

  const html = () => `
    <html><body style="font-family:-apple-system,Helvetica,Arial;padding:28px;color:#0b1220">
      <h2 style="margin:0">Finance Report</h2>
      <p style="color:#5a6270;margin:4px 0 18px">${monthLabelOf(month)}</p>
      <table style="width:100%;border-collapse:collapse">
        <tr><td style="padding:6px 0">Total revenue</td><td style="text-align:right">${exactMoney(summary?.income)}</td></tr>
        <tr><td style="padding:6px 0">Expenses</td><td style="text-align:right">${exactMoney(summary?.expenses)}</td></tr>
        <tr><td style="padding:6px 0">Net profit</td><td style="text-align:right">${exactMoney(summary?.net)}</td></tr>
        <tr><td style="padding:6px 0">Receivables</td><td style="text-align:right">${exactMoney(summary?.receivables)}</td></tr>
        <tr><td style="padding:6px 0">Collection rate</td><td style="text-align:right">${rate}%</td></tr>
        <tr><td style="padding:6px 0">Overdue</td><td style="text-align:right">${exactMoney(summary?.overdue)}</td></tr>
      </table>
      <h3 style="margin:22px 0 6px">Revenue breakdown</h3>
      ${revenueBreakdown.map((row) => `<div style="padding:4px 0">${categoryLabel(row.label)}: ${exactMoney(row.value)} (${row.share}%)</div>`).join("")}
      <h3 style="margin:22px 0 6px">Expense breakdown</h3>
      ${expenseBreakdown.map((row) => `<div style="padding:4px 0">${categoryLabel(row.label)}: ${exactMoney(row.value)} (${row.share}%)</div>`).join("")}
      <p style="color:#6e7686;margin-top:22px">${insight}</p>
    </body></html>`;

  const downloadPdf = async () => {
    try {
      const { uri } = await Print.printToFileAsync({ html: html() });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: "application/pdf" });
      else Alert.alert("Saved", uri);
    } catch (e) {
      Alert.alert("PDF", toErrorMessage(e, "Could not build the PDF"));
    }
  };

  const shareReport = async () => {
    await Share.share({
      message: `Finance report ${monthLabelOf(month)}: revenue ${compactMoney(summary?.income)}, expenses ${compactMoney(summary?.expenses)}, net ${compactMoney(summary?.net)}.`,
    }).catch(() => undefined);
  };

  const monthOptions = Array.from({ length: 12 }, (_, back) => {
    const date = new Date();
    date.setDate(1);
    date.setMonth(date.getMonth() - back);
    const key = monthKeyOf(date);
    return { value: key, label: monthLabelOf(key) };
  });

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
          <Glyph name="chevron-back" size={25} color={brand.text} />
        </Pressable>
        <View style={styles.grow}>
          <Text style={styles.barTitle} numberOfLines={1}>
            Finance Report
          </Text>
          <Text style={styles.barSubtitle} numberOfLines={1}>
            Office on Rent
          </Text>
        </View>
        <Pressable onPress={shareReport} hitSlop={10} accessibilityRole="button" accessibilityLabel="Share report">
          <Glyph name="share-outline" size={21} color={brand.text} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: 26 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.filterRow}>
          <Pressable style={styles.filter} onPress={() => setMonthOpen(true)} accessibilityRole="button">
            <Glyph name="calendar-outline" size={17} color={brand.text} />
            <Text style={styles.filterText} numberOfLines={1}>
              {monthLabelOf(month)}
            </Text>
            <Glyph name="chevron-down" size={15} color={brand.textSecondary} />
          </Pressable>
          <Pressable style={styles.filter} onPress={() => setPropertyOpen(true)} accessibilityRole="button">
            <Glyph name="business-outline" size={17} color={brand.text} />
            <Text style={styles.filterText} numberOfLines={1}>
              {property ? properties.find((row) => row._id === property)?.label || "Property" : "All Properties"}
            </Text>
            <Glyph name="chevron-down" size={15} color={brand.textSecondary} />
          </Pressable>
        </View>

        <View style={styles.statRow}>
          <Stat
            label="Total Revenue"
            value={compactMoney(summary?.income)}
            icon="stats-chart"
            tint={brand.tint}
            color={brand.primary}
            change={revenueChange}
          />
          <Stat
            label="Expenses"
            value={compactMoney(summary?.expenses)}
            icon="receipt-outline"
            tint={brand.alertTint}
            color={brand.alertInk}
          />
          <Stat
            label="Net Profit"
            value={compactMoney(summary?.net)}
            icon="trending-up"
            tint={brand.tint}
            color={brand.primary}
          />
        </View>
        <View style={styles.statRow}>
          <Stat
            label="Receivables"
            value={compactMoney(summary?.receivables)}
            icon="wallet-outline"
            tint={brand.tint}
            color={brand.primary}
          />
          <Stat
            label="Collection Rate"
            value={`${rate}%`}
            icon="pricetag-outline"
            tint={brand.tint}
            color={brand.primary}
          />
          <Stat
            label="Overdue"
            value={compactMoney(summary?.overdue)}
            icon="time-outline"
            tint={brand.alertTint}
            color={brand.alertInk}
          />
        </View>

        <View style={[styles.card, styles.cardGap]}>
          <View style={styles.chartHead}>
            <Text style={[styles.cardTitle, styles.grow]}>Revenue vs Expenses</Text>
          </View>
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: "#3aab77" }]} />
              <Text style={styles.legendText}>Revenue</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: "#fbb6b6" }]} />
              <Text style={styles.legendText}>Expenses</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={styles.legendLine} />
              <Text style={styles.legendText}>Net Profit</Text>
            </View>
          </View>
          <ComboChart points={chart} tickFormat={axisMoney} />
        </View>

        {/* The comp runs the two breakdowns side by side. */}
        <View style={styles.breakdownRow}>
        <View style={[styles.card, styles.half]}>
          <Text style={[styles.cardTitle, styles.halfTitle]} numberOfLines={2}>Revenue Breakdown</Text>
          <View style={styles.donutRow}>
            <Donut
              slices={revenueBreakdown.map((row) => ({ label: categoryLabel(row.label), value: row.value }))}
              centreValue={compactMoney(summary?.income)}
              centreLabel="Total"
            />
            <Legend
              slices={revenueBreakdown.map((row) => ({ label: categoryLabel(row.label), value: row.value }))}
              suffixes={revenueBreakdown.map((row) => `${row.share}%`)}
            />
          </View>
        </View>

        <View style={[styles.card, styles.half]}>
          <Text style={[styles.cardTitle, styles.halfTitle]} numberOfLines={2}>Expense Breakdown</Text>
          <View style={styles.barWrap}>
            <BarList
              rows={expenseBreakdown.map((row) => ({
                label: categoryLabel(row.label),
                value: row.value,
                display: compactMoney(row.value),
              }))}
            />
          </View>
        </View>
        </View>

        <View style={[styles.card, styles.cardGap]}>
          <View style={styles.chartHead}>
            <Text style={[styles.cardTitle, styles.grow]}>Outstanding Payments</Text>
            <Pressable
              style={styles.linkRow}
              onPress={() => navigation.navigate("Transactions", { month, type: "INCOME", status: "PENDING" })}
              accessibilityRole="button"
            >
              <Text style={styles.linkText}>View all {outstanding.length} invoices</Text>
              <Glyph name="arrow-forward" size={14} color={brand.primary} />
            </Pressable>
          </View>

          {outstanding.length === 0 ? (
            <Text style={styles.footnote}>Nothing outstanding.</Text>
          ) : (
            outstanding.slice(0, 3).map((entry, index) => {
              const tone = statusTone(entry.invoice.status);
              const asset = properties.find((row) => row._id === String(entry.invoice.inventoryId?._id || ""));
              const title =
                entry.invoice.inventoryId?.projectName
                || entry.invoice.clientId?.companyName
                || entry.invoice.invoiceNumber;
              return (
                <Pressable
                  key={entry.invoice._id}
                  style={[styles.invoiceRow, index > 0 && styles.invoiceRowDivided]}
                  onPress={() => navigation.navigate("InvoiceDetails", { invoiceId: entry.invoice._id })}
                  accessibilityRole="button"
                >
                  {asset?.image ? (
                    <Image source={{ uri: asset.image }} style={styles.thumb} />
                  ) : (
                    <View style={[styles.thumb, styles.thumbEmpty]}>
                      <Glyph name="business-outline" size={18} color={brand.placeholder} />
                    </View>
                  )}
                  <View style={styles.grow}>
                    <Text style={styles.invoiceTitle} numberOfLines={1}>
                      {title}
                    </Text>
                    <Text style={styles.invoiceDue} numberOfLines={1}>
                      {`Due ${fullDateOf(entry.invoice.dueDate)}`}
                    </Text>
                  </View>
                  <View style={[styles.invoicePill, { backgroundColor: tone.bg }]}>
                    <Text style={[styles.invoicePillText, { color: tone.fg }]}>{tone.label}</Text>
                  </View>
                  <Text style={styles.invoiceAmount} numberOfLines={1}>
                    {exactMoney(entry.balance)}
                  </Text>
                  <Glyph name="chevron-forward" size={16} color={brand.textMuted} />
                </Pressable>
              );
            })
          )}
        </View>

        <View style={styles.insight}>
          <View style={styles.insightIcon}>
            <Glyph name="bulb-outline" size={19} color={brand.deep} />
          </View>
          <Text style={styles.insightBody}>{insight}</Text>
        </View>

        <View style={styles.actionRow}>
          <Pressable style={styles.solidBtn} onPress={downloadPdf} accessibilityRole="button">
            <Glyph name="document-text-outline" size={17} color={brand.onPrimary} />
            <Text style={styles.solidBtnText}>Download PDF</Text>
          </Pressable>
          <Pressable style={styles.outlineBtn} onPress={shareReport} accessibilityRole="button">
            <Glyph name="share-outline" size={17} color={brand.primary} />
            <Text style={styles.outlineBtnText}>Share Report</Text>
          </Pressable>
        </View>
      </ScrollView>

      <AppSheet visible={monthOpen} onClose={() => setMonthOpen(false)} title="Month">
        {monthOptions.map((option) => (
          <Pressable
            key={option.value}
            style={styles.sheetRow}
            onPress={() => {
              setMonth(option.value);
              setMonthOpen(false);
            }}
            accessibilityRole="button"
          >
            <Text style={styles.sheetLabel}>{option.label}</Text>
            {option.value === month ? <Glyph name="checkmark" size={18} color={brand.primary} /> : null}
          </Pressable>
        ))}
      </AppSheet>

      <AppSheet visible={propertyOpen} onClose={() => setPropertyOpen(false)} title="Property">
        {[{ _id: "", label: "All Properties" }, ...properties].map((row) => (
          <Pressable
            key={row._id || "all"}
            style={styles.sheetRow}
            onPress={() => {
              setProperty(row._id);
              setPropertyOpen(false);
            }}
            accessibilityRole="button"
          >
            <Text style={styles.sheetLabel}>{row.label}</Text>
            {row._id === property ? <Glyph name="checkmark" size={18} color={brand.primary} /> : null}
          </Pressable>
        ))}
      </AppSheet>
    </SafeAreaView>
  );
};

const styles = brandStyles((b) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: b.bg },
    centred: { flex: 1, alignItems: "center", justifyContent: "center" },
    grow: { flex: 1, minWidth: 0 },

    bar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: layout.gutter,
      paddingTop: 6,
      paddingBottom: 12,
    },
    barTitle: {
      fontSize: t.hero,
      lineHeight: 25,
      fontWeight: "700",
      letterSpacing: -0.5,
      color: b.text,
      textAlign: "center",
    },
    barSubtitle: { fontSize: t.body, lineHeight: 16, color: b.textMuted, textAlign: "center" },

    body: { paddingHorizontal: layout.gutter },
    error: { marginBottom: 10, fontSize: t.body, color: b.alert },

    filterRow: { flexDirection: "row", gap: 9 },
    filter: {
      flex: 1,
      minWidth: 0,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      height: 46,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: b.border,
      borderRadius: round.field,
      backgroundColor: b.surface,
    },
    filterText: { flex: 1, minWidth: 0, fontSize: t.field, fontWeight: "500", color: b.text },

    statRow: { marginTop: 9, flexDirection: "row", gap: 7 },
    stat: {
      flex: 1,
      minWidth: 0,
      paddingHorizontal: 9,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: b.border,
      borderRadius: round.panel,
      backgroundColor: b.surface,
    },
    statHead: { flexDirection: "row", alignItems: "center", gap: 5 },
    statLabel: { flex: 1, minWidth: 0, fontSize: t.tagline, color: b.textSecondary },
    statIcon: {
      width: 26,
      height: 26,
      borderRadius: round.pill,
      alignItems: "center",
      justifyContent: "center",
    },
    statValue: {
      marginTop: 5,
      fontSize: t.hero,
      lineHeight: 25,
      fontWeight: "700",
      letterSpacing: -0.5,
    },
    statChange: {
      marginTop: 4,
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: round.pill,
      backgroundColor: b.tint,
    },
    statChangeText: { fontSize: t.micro, fontWeight: "700" },

    card: {
      padding: 13,
      borderWidth: 1,
      borderColor: b.border,
      borderRadius: round.panel,
      backgroundColor: b.surface,
    },
    cardGap: { marginTop: 10 },
    cardTitle: {
      fontSize: t.barTitle,
      lineHeight: 22,
      fontWeight: "700",
      letterSpacing: -0.4,
      color: b.text,
    },
    chartHead: { flexDirection: "row", alignItems: "center", gap: 10 },
    legendRow: { marginTop: 10, marginBottom: 8, flexDirection: "row", gap: 14 },
    legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
    legendDot: { width: 9, height: 9, borderRadius: round.pill },
    legendLine: { width: 14, height: 2, borderRadius: 2, backgroundColor: "#0b5d40" },
    legendText: { fontSize: t.body, color: b.textSecondary },

    donutRow: { marginTop: 12, alignItems: "center", gap: 12 },
    breakdownRow: { marginTop: 10, flexDirection: "row", gap: 9 },
    half: { flex: 1, minWidth: 0 },
    halfTitle: { fontSize: t.sectionTitle, lineHeight: 20 },
    barWrap: { marginTop: 12 },
    footnote: { marginTop: 8, fontSize: t.body, color: b.textMuted },

    linkRow: { flexDirection: "row", alignItems: "center", gap: 4 },
    linkText: { fontSize: t.body, fontWeight: "700", color: b.primary },

    invoiceRow: {
      marginTop: 10,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingTop: 10,
    },
    invoiceRowDivided: { borderTopWidth: 1, borderTopColor: b.hairline },
    thumb: { width: 52, height: 44, borderRadius: round.field, backgroundColor: b.hairline },
    thumbEmpty: { alignItems: "center", justifyContent: "center" },
    invoiceTitle: { fontSize: t.cardTitle, fontWeight: "700", color: b.text },
    invoiceDue: { marginTop: 2, fontSize: t.body, color: b.textMuted },
    invoicePill: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: round.pill,
    },
    invoicePillText: { fontSize: t.micro, fontWeight: "700" },
    invoiceAmount: { fontSize: t.cardTitle, fontWeight: "700", color: b.text },

    insight: {
      marginTop: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 13,
      borderRadius: round.panel,
      backgroundColor: b.tintSoft,
    },
    insightIcon: {
      width: 38,
      height: 38,
      borderRadius: round.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: b.tint,
    },
    insightBody: {
      flex: 1,
      minWidth: 0,
      fontSize: t.field,
      lineHeight: 20,
      fontWeight: "600",
      color: b.deep,
    },

    actionRow: { marginTop: 14, flexDirection: "row", gap: 10 },
    outlineBtn: {
      flex: 1,
      minWidth: 0,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      height: 50,
      borderWidth: 1,
      borderColor: b.greenBright,
      borderRadius: round.field,
      backgroundColor: b.surface,
    },
    outlineBtnText: { fontSize: t.cardTitle, fontWeight: "700", color: b.primary },
    solidBtn: {
      flex: 1,
      minWidth: 0,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      height: 50,
      borderRadius: round.field,
      backgroundColor: "#0b7d52",
    },
    solidBtnText: { fontSize: t.cardTitle, fontWeight: "700", color: b.onPrimary },

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

export default FinanceReportScreen;
