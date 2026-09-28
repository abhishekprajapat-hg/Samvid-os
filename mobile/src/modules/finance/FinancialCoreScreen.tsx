import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import Svg, { Circle, Polyline, Rect } from "react-native-svg";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Glyph, type GlyphName } from "../../components/ui/Glyph";
import { AppSheet } from "../../components/ui/Overlay";
import { brand, brandStyles, layout, round, type as t } from "../../theme/brand";
import { toErrorMessage } from "../../utils/errorMessage";
import {
  getFinanceOverview,
  getFinanceTransactions,
  type FinanceSeriesPoint,
  type FinanceSummary,
  type FinanceTransaction,
} from "../../services/financeService";
import {
  axisMoney,
  categoryIcon,
  categoryLabel,
  compactMoney,
  dayShortOf,
  methodLabel,
  monthKeyOf,
  monthLabelOf,
  monthTickOf,
  signedMoney,
  statusTone,
} from "./financeVocab";

/*
 * Finance, drawn to the comp.
 *
 * Everything on this page comes from /api/finance/overview, which reads the
 * one ledger the product has - invoices, the payment ledger and expenses. The
 * old screen here derived a company's money from lead deal payments and a flat
 * commission per closed deal; that was a stand-in for a ledger, and this is
 * the ledger.
 */

/** The comp's range control. */
const RANGES: Array<{ key: string; label: string; back: number }> = [
  { key: "THIS_MONTH", label: "This Month", back: 0 },
  { key: "LAST_MONTH", label: "Last Month", back: 1 },
  { key: "TWO_BACK", label: "Two Months Ago", back: 2 },
];

const monthFor = (back: number) => {
  const date = new Date();
  date.setDate(1);
  date.setMonth(date.getMonth() - back);
  return monthKeyOf(date);
};

/* --------------------------------------------------------------- chart -- */

/*
 * Grouped income/expense bars with the income trend drawn over them, as the
 * comp does. Plain SVG: a charting dependency for one card on one screen is
 * not worth the bundle.
 */
const CashFlowChart = ({ series }: { series: FinanceSeriesPoint[] }) => {
  const width = 358;
  const height = 150;
  const padLeft = 34;
  const padBottom = 22;
  const padTop = 8;

  const peak = Math.max(1, ...series.flatMap((point) => [point.income, point.expenses]));
  /* Round the top up to a clean step so the axis reads ₹1L / ₹2L / ₹3L. */
  const step = Math.pow(10, Math.floor(Math.log10(peak)));
  const top = Math.ceil(peak / step) * step;

  const plotW = width - padLeft;
  const plotH = height - padBottom - padTop;
  const slot = plotW / Math.max(1, series.length);
  const barW = Math.min(14, slot * 0.26);
  const yOf = (value: number) => padTop + plotH - (value / top) * plotH;
  const xOf = (index: number) => padLeft + slot * index + slot / 2;

  const ticks = [top, (top / 3) * 2, top / 3, 0];

  const linePoints = series
    .map((point, index) => `${xOf(index) - barW * 0.7},${yOf(point.income)}`)
    .join(" ");

  return (
    <View>
      <Svg width={width} height={height}>
        {ticks.map((tick) => (
          <Rect
            key={`grid-${tick}`}
            x={padLeft}
            y={yOf(tick)}
            width={plotW}
            height={0.6}
            fill={brand.hairline}
          />
        ))}

        {series.map((point, index) => (
          <React.Fragment key={point.month}>
            <Rect
              x={xOf(index) - barW - 1.5}
              y={yOf(point.income)}
              width={barW}
              height={Math.max(1, padTop + plotH - yOf(point.income))}
              rx={3}
              fill="#1a9e6a"
            />
            <Rect
              x={xOf(index) + 1.5}
              y={yOf(point.expenses)}
              width={barW}
              height={Math.max(1, padTop + plotH - yOf(point.expenses))}
              rx={3}
              fill="#fbc3c6"
            />
          </React.Fragment>
        ))}

        <Polyline points={linePoints} fill="none" stroke="#0f7a55" strokeWidth={1.8} />
        {series.map((point, index) => (
          <Circle
            key={`dot-${point.month}`}
            cx={xOf(index) - barW * 0.7}
            cy={yOf(point.income)}
            r={3.4}
            fill="#0f7a55"
          />
        ))}
      </Svg>

      <View style={styles.axisY} pointerEvents="none">
        {ticks.map((tick) => (
          <Text key={`y-${tick}`} style={[styles.axisText, { top: yOf(tick) - 7 }]}>
            {tick === 0 ? "0" : axisMoney(tick)}
          </Text>
        ))}
      </View>

      <View style={[styles.axisX, { paddingLeft: padLeft }]}>
        {series.map((point) => (
          <Text key={`x-${point.month}`} style={styles.axisTick}>
            {monthTickOf(point.month)}
          </Text>
        ))}
      </View>
    </View>
  );
};

/* -------------------------------------------------------------- pieces -- */

const StatCard = ({
  icon,
  tint,
  color,
  label,
  value,
  caption,
  onPress,
}: {
  icon: GlyphName;
  tint: string;
  color: string;
  label: string;
  value: string;
  caption: string;
  onPress: () => void;
}) => (
  <Pressable style={styles.statCard} onPress={onPress} accessibilityRole="button">
    <View style={[styles.statIcon, { backgroundColor: tint }]}>
      <Glyph name={icon} size={19} color={color} />
    </View>
    <View style={styles.grow}>
      <Text style={styles.statLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[styles.statValue, { color }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.statCaption} numberOfLines={1}>
        {caption}
      </Text>
    </View>
    <Glyph name="chevron-forward" size={17} color={brand.textMuted} />
  </Pressable>
);

/* -------------------------------------------------------------- screen -- */

export const FinancialCoreScreen = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const [range, setRange] = useState(RANGES[0]);
  const [rangeOpen, setRangeOpen] = useState(false);
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [previous, setPrevious] = useState<FinanceSummary | null>(null);
  const [series, setSeries] = useState<FinanceSeriesPoint[]>([]);
  const [recent, setRecent] = useState<FinanceTransaction[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const month = monthFor(range.back);

  const load = useCallback(
    async (quiet = false) => {
      try {
        if (quiet) setRefreshing(true);
        else setLoading(true);
        setError("");

        const [overview, prior, feed] = await Promise.all([
          getFinanceOverview({ month, months: 6 }),
          getFinanceOverview({ month: monthFor(range.back + 1), months: 1 }),
          getFinanceTransactions({ month, limit: 5 }),
        ]);

        setSummary(overview.summary);
        setSeries(overview.series);
        setPrevious(prior.summary);
        setRecent(feed.transactions.slice(0, 4));
      } catch (e) {
        setError(toErrorMessage(e, "Failed to load finance"));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [month, range.back],
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

  const change = useMemo(() => {
    const now = Number(summary?.net || 0);
    const before = Number(previous?.net || 0);
    if (!before) return null;
    return ((now - before) / Math.abs(before)) * 100;
  }, [summary, previous]);

  /*
   * Export writes the month's rows to a CSV and hands it to the share sheet -
   * the backend has no report generator, and a file the accountant can open is
   * what "Export Report" is for.
   */
  const exportReport = async () => {
    try {
      const { transactions } = await getFinanceTransactions({ month, limit: 300 });
      const head = "Date,Type,Title,Party,Category,Amount,Method,Status,Reference";
      const body = transactions
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

      const path = `${FileSystem.cacheDirectory}finance-${month}.csv`;
      await FileSystem.writeAsStringAsync(path, `${head}\n${body}`);
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(path);
      else Alert.alert("Export", `Saved to ${path}`);
    } catch (e) {
      Alert.alert("Export", toErrorMessage(e, "Could not build the report"));
    }
  };

  const quickActions: Array<{ id: string; label: string; icon: GlyphName; run: () => void }> = [
    {
      id: "invoice",
      label: "Create Invoice",
      icon: "document-text-outline",
      run: () => navigation.navigate("AddEntry", { kind: "INCOME" }),
    },
    {
      id: "payment",
      label: "Record Payment",
      icon: "card-outline",
      run: () => navigation.navigate("AddEntry", { kind: "INCOME" }),
    },
    {
      id: "expense",
      label: "Add Expense",
      icon: "receipt-outline",
      run: () => navigation.navigate("AddEntry", { kind: "EXPENSE" }),
    },
    { id: "export", label: "Export Report", icon: "stats-chart", run: exportReport },
  ];

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
      <View style={styles.header}>
        <Text style={styles.pageTitle} numberOfLines={1}>
          Finance
        </Text>
        <Text style={styles.pageSubtitle}>Revenue, expenses &amp; payments</Text>

        <View style={styles.headerActions}>
          <Pressable
            style={styles.rangeBtn}
            onPress={() => setRangeOpen(true)}
            accessibilityRole="button"
          >
            <Glyph name="calendar-outline" size={16} color={brand.text} />
            <Text style={styles.rangeLabel}>{range.label}</Text>
            <Glyph name="chevron-down" size={14} color={brand.textSecondary} />
          </Pressable>
          <Pressable
            style={styles.addBtn}
            onPress={() => navigation.navigate("AddEntry")}
            accessibilityRole="button"
          >
            <Glyph name="add" size={19} color={brand.onPrimary} />
            <Text style={styles.addBtnText}>Add Entry</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: 26 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={brand.primary} />
        }
      >
        {error ? (
          <Pressable style={styles.banner} onPress={() => load()} accessibilityRole="button">
            <Text style={styles.bannerText}>{error}</Text>
          </Pressable>
        ) : null}

        {/* ---- hero ---- */}
        <View style={styles.hero}>
          <View style={styles.heroLeft}>
            <Text style={styles.heroLabel}>Net cash flow</Text>
            <Text style={styles.heroValue} numberOfLines={1}>
              {compactMoney(summary?.net)}
            </Text>
            <View style={styles.heroChangeRow}>
              {change != null ? (
                <View style={styles.heroChip}>
                  <Glyph
                    name={change >= 0 ? "arrow-up" : "arrow-down"}
                    size={12}
                    color={brand.onPrimary}
                  />
                  <Text style={styles.heroChipText}>
                    {`${change >= 0 ? "+" : ""}${change.toFixed(1)}%`}
                  </Text>
                </View>
              ) : null}
              <Text style={styles.heroNote}>vs last month</Text>
            </View>
          </View>

          <View style={styles.heroRule} />

          <View style={styles.heroRight}>
            <Text style={styles.heroSmallLabel}>Income</Text>
            <Text style={styles.heroSmallValue} numberOfLines={1}>
              {compactMoney(summary?.income)}
            </Text>
            <View style={styles.heroDivider} />
            <Text style={styles.heroSmallLabel}>Expenses</Text>
            <Text style={styles.heroSmallValue} numberOfLines={1}>
              {compactMoney(summary?.expenses)}
            </Text>
          </View>
        </View>

        {/* ---- four tiles ---- */}
        <View style={styles.statRow}>
          <StatCard
            icon="wallet-outline"
            tint={brand.tint}
            color={brand.text}
            label="Receivables"
            value={compactMoney(summary?.receivables)}
            caption={`${summary?.receivablesCount || 0} pending`}
            onPress={() => navigation.navigate("Transactions", { month, type: "INCOME", status: "PENDING" })}
          />
          <StatCard
            icon="card-outline"
            tint={brand.alertTint}
            color={brand.text}
            label="Payables"
            value={compactMoney(summary?.payables)}
            caption={`${summary?.payablesCount || 0} due`}
            onPress={() => navigation.navigate("Transactions", { month, type: "EXPENSE", status: "PENDING" })}
          />
        </View>
        <View style={styles.statRow}>
          <StatCard
            icon="checkmark-circle-outline"
            tint={brand.tint}
            color={brand.primary}
            label="Collected"
            value={compactMoney(summary?.collected)}
            caption=""
            onPress={() => navigation.navigate("Transactions", { month, type: "INCOME", status: "PAID" })}
          />
          <StatCard
            icon="alert-circle-outline"
            tint={brand.alertTint}
            color={brand.alertInk}
            label="Overdue"
            value={compactMoney(summary?.overdue)}
            caption=""
            onPress={() => navigation.navigate("Transactions", { month, status: "OVERDUE" })}
          />
        </View>

        {/* ---- chart ---- */}
        <View style={[styles.card, styles.cardGap]}>
          <View style={styles.chartHead}>
            <Text style={[styles.cardTitle, styles.chartTitle]}>Cash Flow</Text>
            <View style={styles.legend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: "#1a9e6a" }]} />
                <Text style={styles.legendText}>Income</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: "#fbc3c6" }]} />
                <Text style={styles.legendText}>Expenses</Text>
              </View>
            </View>
          </View>
          <CashFlowChart series={series} />
        </View>

        {/* ---- quick actions ---- */}
        <View style={[styles.card, styles.cardGap]}>
          <Text style={styles.cardTitle}>Quick Actions</Text>
          <View style={styles.actionRow}>
            {quickActions.map((action) => (
              <Pressable
                key={action.id}
                style={styles.action}
                onPress={action.run}
                accessibilityRole="button"
              >
                <View style={styles.actionIcon}>
                  <Glyph name={action.icon} size={21} color={brand.deep} />
                </View>
                <Text style={styles.actionLabel} numberOfLines={1}>
                  {action.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* ---- recent ---- */}
        <View style={[styles.card, styles.cardGap]}>
          <View style={styles.chartHead}>
            <Text style={[styles.cardTitle, styles.chartTitle]}>Recent Transactions</Text>
            <Pressable
              style={styles.linkRow}
              onPress={() => navigation.navigate("Transactions", { month })}
              accessibilityRole="button"
            >
              <Text style={styles.linkText}>View all transactions</Text>
              <Glyph name="arrow-forward" size={14} color={brand.primary} />
            </Pressable>
          </View>

          {recent.length === 0 ? (
            <Text style={styles.emptyText}>Nothing recorded this month.</Text>
          ) : (
            recent.map((row, index) => {
              const tone = statusTone(row.status);
              return (
                <Pressable
                  key={row.id}
                  style={[styles.txRow, index > 0 && styles.txRowDivided]}
                  onPress={() =>
                    row.invoiceId
                      ? navigation.navigate("InvoiceDetails", { invoiceId: row.invoiceId })
                      : navigation.navigate("Transactions", { month })
                  }
                  accessibilityRole="button"
                >
                  <View style={styles.txIcon}>
                    <Glyph name={categoryIcon(row.category)} size={17} color={brand.deep} />
                  </View>
                  <View style={styles.grow}>
                    <Text style={styles.txTitle} numberOfLines={1}>
                      {row.title}
                    </Text>
                    <Text style={styles.txSub} numberOfLines={1}>
                      {categoryLabel(row.category)}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.txAmount,
                      { color: row.amount < 0 ? brand.alertInk : brand.primary },
                    ]}
                    numberOfLines={1}
                  >
                    {signedMoney(row.amount)}
                  </Text>
                  <View style={[styles.txPill, { backgroundColor: tone.bg }]}>
                    <Text style={[styles.txPillText, { color: tone.fg }]}>{tone.label}</Text>
                  </View>
                  <Text style={styles.txDate} numberOfLines={1}>
                    {dayShortOf(row.date)}
                  </Text>
                  <Glyph name="chevron-forward" size={15} color={brand.textMuted} />
                </Pressable>
              );
            })
          )}
        </View>
      </ScrollView>

      <AppSheet visible={rangeOpen} onClose={() => setRangeOpen(false)} title="Period">
        {RANGES.map((entry) => (
          <Pressable
            key={entry.key}
            style={styles.sheetRow}
            onPress={() => {
              setRange(entry);
              setRangeOpen(false);
            }}
            accessibilityRole="button"
          >
            <Text style={styles.sheetLabel}>
              {entry.back === 0 ? entry.label : monthLabelOf(monthFor(entry.back))}
            </Text>
            {entry.key === range.key ? (
              <Glyph name="checkmark" size={18} color={brand.primary} />
            ) : null}
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

    header: {
      paddingHorizontal: layout.gutter,
      paddingTop: 8,
      paddingBottom: 12,
    },
    pageTitle: {
      width: "48%",
      fontSize: t.pageTitle,
      lineHeight: 31,
      fontWeight: "700",
      letterSpacing: -0.8,
      color: b.text,
    },
    pageSubtitle: {
      marginTop: 1,
      /* Kept clear of the range pill and the Add Entry button beside it. */
      width: "62%",
      fontSize: t.cardTitle,
      lineHeight: 18,
      color: b.textMuted,
    },
    headerActions: {
      position: "absolute",
      right: layout.gutter,
      top: 9,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    rangeBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      height: 36,
      paddingHorizontal: 11,
      borderWidth: 1,
      borderColor: b.border,
      borderRadius: round.field,
      backgroundColor: b.surface,
    },
    rangeLabel: {
      fontSize: t.cardTitle,
      fontWeight: "500",
      color: b.text,
    },
    addBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      height: 36,
      paddingHorizontal: 12,
      borderRadius: round.field,
      backgroundColor: "#0b7d52",
    },
    addBtnText: {
      fontSize: t.cardTitle,
      fontWeight: "700",
      color: b.onPrimary,
    },

    body: { paddingHorizontal: layout.gutter },
    banner: {
      marginBottom: 10,
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderWidth: 1,
      borderColor: b.alert,
      borderRadius: round.field,
      backgroundColor: b.surface,
    },
    bannerText: { fontSize: t.body, lineHeight: 17, color: b.alert },

    /* ---- hero ---- */
    hero: {
      flexDirection: "row",
      padding: 16,
      borderRadius: round.panel,
      backgroundColor: "#0a7b4f",
    },
    heroLeft: { flex: 1.25, minWidth: 0 },
    heroLabel: {
      fontSize: t.field,
      fontWeight: "600",
      color: "rgba(255,255,255,0.88)",
    },
    heroValue: {
      marginTop: 4,
      fontSize: 34,
      lineHeight: 42,
      fontWeight: "700",
      letterSpacing: -1.2,
      color: "#ffffff",
    },
    heroChangeRow: {
      marginTop: 6,
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
    },
    heroChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      height: 24,
      paddingHorizontal: 9,
      borderRadius: round.field,
      backgroundColor: "rgba(255,255,255,0.2)",
    },
    heroChipText: {
      fontSize: t.body,
      fontWeight: "700",
      color: "#ffffff",
    },
    heroNote: {
      fontSize: t.body,
      color: "rgba(255,255,255,0.82)",
    },
    heroRule: {
      width: 1,
      marginHorizontal: 14,
      backgroundColor: "rgba(255,255,255,0.22)",
    },
    heroRight: { flex: 1, minWidth: 0, justifyContent: "center" },
    heroSmallLabel: {
      fontSize: t.body,
      color: "rgba(255,255,255,0.82)",
    },
    heroSmallValue: {
      marginTop: 2,
      fontSize: t.hero,
      lineHeight: 25,
      fontWeight: "700",
      letterSpacing: -0.5,
      color: "#ffffff",
    },
    heroDivider: {
      height: 1,
      marginVertical: 10,
      backgroundColor: "rgba(255,255,255,0.22)",
    },

    /* ---- tiles ---- */
    statRow: {
      marginTop: 10,
      flexDirection: "row",
      gap: 10,
    },
    statCard: {
      flex: 1,
      minWidth: 0,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 11,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: b.border,
      borderRadius: round.panel,
      backgroundColor: b.surface,
    },
    statIcon: {
      width: 38,
      height: 38,
      borderRadius: round.pill,
      alignItems: "center",
      justifyContent: "center",
    },
    statLabel: {
      fontSize: t.body,
      color: b.textSecondary,
    },
    statValue: {
      marginTop: 1,
      fontSize: t.hero,
      lineHeight: 24,
      fontWeight: "700",
      letterSpacing: -0.5,
    },
    statCaption: {
      fontSize: t.tagline,
      color: b.textMuted,
    },

    /* ---- cards ---- */
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
    chartHead: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginBottom: 12,
    },
    chartTitle: {
      flex: 1,
      minWidth: 0,
    },
    legend: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    legendItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    legendDot: {
      width: 9,
      height: 9,
      borderRadius: round.pill,
    },
    legendText: {
      fontSize: t.body,
      color: b.textSecondary,
    },

    axisY: { ...StyleSheet.absoluteFillObject },
    axisText: {
      position: "absolute",
      left: 0,
      width: 30,
      textAlign: "right",
      fontSize: t.micro,
      color: b.textMuted,
    },
    axisX: {
      flexDirection: "row",
      marginTop: -14,
    },
    axisTick: {
      flex: 1,
      textAlign: "center",
      fontSize: t.tagline,
      color: b.textSecondary,
    },

    /* ---- quick actions ---- */
    actionRow: {
      marginTop: 12,
      flexDirection: "row",
      gap: 6,
    },
    action: {
      flex: 1,
      minWidth: 0,
      alignItems: "center",
      gap: 8,
    },
    actionIcon: {
      width: 52,
      height: 52,
      borderRadius: round.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: b.tint,
    },
    actionLabel: {
      fontSize: t.tagline,
      color: b.text,
    },

    /* ---- recent ---- */
    linkRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    linkText: {
      fontSize: t.body,
      fontWeight: "700",
      color: b.primary,
    },
    emptyText: {
      paddingVertical: 14,
      fontSize: t.body,
      color: b.textMuted,
    },
    txRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingVertical: 10,
    },
    txRowDivided: {
      borderTopWidth: 1,
      borderTopColor: b.hairline,
    },
    txIcon: {
      width: 34,
      height: 34,
      borderRadius: round.field,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: b.tint,
    },
    txTitle: {
      fontSize: t.cardTitle,
      fontWeight: "700",
      color: b.text,
    },
    txSub: {
      marginTop: 1,
      fontSize: t.tagline,
      color: b.textMuted,
    },
    txAmount: {
      fontSize: t.cardTitle,
      fontWeight: "700",
    },
    txPill: {
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: round.pill,
    },
    txPillText: {
      fontSize: t.micro,
      fontWeight: "700",
    },
    txDate: {
      fontSize: t.tagline,
      color: b.textMuted,
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

export default FinancialCoreScreen;
