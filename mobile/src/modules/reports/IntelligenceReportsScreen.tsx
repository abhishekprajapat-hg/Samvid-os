import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Glyph, type GlyphName } from "../../components/ui/Glyph";
import { AppSheet } from "../../components/ui/Overlay";
import { brand, brandStyles, layout, round, type as t } from "../../theme/brand";
import { toErrorMessage } from "../../utils/errorMessage";
import { getAllLeads } from "../../services/leadService";
import { getInventoryAssets } from "../../services/inventoryService";
import { getTaskStats } from "../../services/taskService";
import { getFinanceOverview } from "../../services/financeService";
import { getSavedReports, type SavedReport } from "../../services/reportService";
import { compactMoney, axisMoney, monthKeyOf } from "../finance/financeVocab";
import { AreaChart } from "./reportCharts";
import {
  MONTHS_SHORT,
  buildSalesReport,
  changeLabel,
  endOfMonth,
  monthLabel,
  startOfMonth,
} from "./reportData";

/*
 * The reports hub, drawn to the comp.
 *
 * There is no reporting endpoint. Every figure here is counted from the
 * records the app already reads - leads, the finance ledger, inventory and the
 * task stats - so a report can never disagree with the screen it summarises.
 */

type Tab = "REVENUE" | "LEADS" | "DEALS";

const RANGES = [
  { key: "THIS_MONTH", label: "This Month", back: 0 },
  { key: "LAST_MONTH", label: "Last Month", back: 1 },
  { key: "QUARTER", label: "Last 3 Months", back: 2 },
];

const Metric = ({
  icon,
  label,
  value,
  change,
}: {
  icon: GlyphName;
  label: string;
  value: string;
  change: string | null;
}) => (
  <View style={styles.metric}>
    <View style={styles.metricIcon}>
      <Glyph name={icon} size={18} color={brand.deep} />
    </View>
    <Text style={styles.metricLabel} numberOfLines={1}>
      {label}
    </Text>
    <Text style={styles.metricValue} numberOfLines={1}>
      {value}
    </Text>
    {change ? (
      <View style={styles.metricChange}>
        <Glyph
          name={change.startsWith("-") ? "trending-down" : "trending-up"}
          size={13}
          color={change.startsWith("-") ? brand.alertInk : brand.primary}
        />
        <Text
          style={[
            styles.metricChangeText,
            { color: change.startsWith("-") ? brand.alertInk : brand.primary },
          ]}
        >
          {change}
        </Text>
      </View>
    ) : null}
  </View>
);

export const IntelligenceReportsScreen = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const [range, setRange] = useState(RANGES[0]);
  const [rangeOpen, setRangeOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("REVENUE");

  const [leads, setLeads] = useState<any[]>([]);
  const [properties, setProperties] = useState(0);
  const [taskPct, setTaskPct] = useState(0);
  const [series, setSeries] = useState<Array<{ month: string; income: number; expenses: number }>>([]);
  const [summary, setSummary] = useState<{ income: number; net: number } | null>(null);
  const [previous, setPrevious] = useState<{ income: number; net: number } | null>(null);
  const [recent, setRecent] = useState<SavedReport[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const bounds = useMemo(() => {
    const anchor = new Date();
    anchor.setDate(1);
    anchor.setMonth(anchor.getMonth() - range.back);
    const to = range.back === 2 ? endOfMonth(new Date()) : endOfMonth(anchor);
    return { from: startOfMonth(anchor), to };
  }, [range.back]);

  const load = useCallback(
    async (quiet = false) => {
      try {
        if (quiet) setRefreshing(true);
        else setLoading(true);
        setError("");

        const month = monthKeyOf(bounds.from);
        const priorMonth = monthKeyOf(new Date(bounds.from.getFullYear(), bounds.from.getMonth() - 1, 1));

        const [leadRows, assets, stats, overview, prior, saved] = await Promise.all([
          getAllLeads({ limit: 500 }),
          getInventoryAssets().catch(() => []),
          getTaskStats().catch(() => null),
          getFinanceOverview({ month, months: 6 }),
          getFinanceOverview({ month: priorMonth, months: 1 }).catch(() => ({ summary: null, series: [] })),
          getSavedReports({ limit: 5 }).catch(() => []),
        ]);

        setLeads(Array.isArray(leadRows) ? leadRows : []);
        setProperties(Array.isArray(assets) ? assets.length : 0);

        const done = Number((stats as any)?.completed ?? (stats as any)?.done ?? 0);
        const all = Number((stats as any)?.total ?? 0);
        setTaskPct(all > 0 ? Math.round((done / all) * 100) : 0);

        setSeries(overview.series);
        setSummary(overview.summary ? { income: overview.summary.income, net: overview.summary.net } : null);
        setPrevious(prior.summary ? { income: prior.summary.income, net: prior.summary.net } : null);
        setRecent(saved);
      } catch (e) {
        setError(toErrorMessage(e, "Failed to load reports"));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [bounds],
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

  const sales = useMemo(
    () => buildSalesReport(leads as any, bounds.from, bounds.to),
    [leads, bounds],
  );

  const priorSales = useMemo(() => {
    const from = new Date(bounds.from.getFullYear(), bounds.from.getMonth() - 1, 1);
    return buildSalesReport(leads as any, from, endOfMonth(from));
  }, [leads, bounds]);

  /* The comp's three chart tabs read the same six months, three ways. */
  const chart = useMemo(() => {
    if (tab === "REVENUE") {
      return series.map((point) => ({
        label: MONTHS_SHORT[Number(point.month.split("-")[1]) - 1]?.slice(0, 3) || "",
        value: point.income,
      }));
    }
    const months = series.length || 6;
    return Array.from({ length: months }, (_, index) => {
      const date = new Date();
      date.setDate(1);
      date.setMonth(date.getMonth() - (months - 1) + index);
      const bucket = buildSalesReport(leads as any, startOfMonth(date), endOfMonth(date));
      return {
        label: MONTHS_SHORT[date.getMonth()].slice(0, 3),
        value: tab === "LEADS" ? bucket.total : bucket.closed,
      };
    });
  }, [tab, series, leads]);

  const categories: Array<{
    id: string;
    icon: GlyphName;
    tint: string;
    color: string;
    title: string;
    subtitle: string;
    value: string;
    go: () => void;
  }> = [
    {
      id: "sales",
      icon: "stats-chart",
      tint: brand.tint,
      color: brand.deep,
      title: "Sales & Pipeline",
      subtitle: "Leads, stages and conversion",
      value: `${sales.total} leads`,
      go: () => navigation.navigate("SalesReport"),
    },
    {
      /* Web's Intelligence Reports figures, which the comps left out. */
      id: "intelligence",
      icon: "analytics-outline",
      tint: "#e6f4f0",
      color: "#0a6b4a",
      title: "Pipeline Intelligence",
      subtitle: "Executives, losses and CSV export",
      value: `${sales.conversion}% conv.`,
      go: () => navigation.navigate("PipelineIntelligence"),
    },
    {
      id: "finance",
      icon: "server-outline",
      tint: "#e2ecfb",
      color: "#2f60a8",
      title: "Finance",
      subtitle: "Revenue, expenses and payments",
      value: `${compactMoney(summary?.net)} net`,
      go: () => navigation.navigate("FinanceReport"),
    },
    {
      id: "inventory",
      icon: "business",
      tint: "#ece6fb",
      color: "#6d4fc7",
      title: "Inventory",
      subtitle: "Properties, occupancy and status",
      value: `${properties} properties`,
      go: () => navigation.navigate("Inventory"),
    },
    {
      id: "team",
      icon: "people",
      tint: "#fdeade",
      color: "#c36a2b",
      title: "Team & Tasks",
      subtitle: "Productivity and completion",
      value: `${taskPct}% complete`,
      go: () => navigation.navigate("Tasks"),
    },
  ];

  const shareSummary = async () => {
    await Share.share({
      message: `${monthLabel(bounds.from)} — revenue ${compactMoney(summary?.income)}, ${sales.total} new leads, ${properties} properties, ${sales.conversion}% conversion.`,
    }).catch(() => undefined);
  };

  const whenLabel = (report: SavedReport) => {
    const date = new Date(report.generatedAt);
    if (Number.isNaN(date.getTime())) return "";
    const days = Math.round(
      (new Date().setHours(0, 0, 0, 0) - new Date(date).setHours(0, 0, 0, 0)) / 86400000,
    );
    if (days === 0) return "Generated today";
    if (days === 1) return "Yesterday";
    return `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}`;
  };

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
          Reports
        </Text>
        <Text style={styles.pageSubtitle}>Insights across your business</Text>

        <View style={styles.headerActions}>
          <Pressable style={styles.rangeBtn} onPress={() => setRangeOpen(true)} accessibilityRole="button">
            <Glyph name="calendar-outline" size={16} color={brand.text} />
            <Text style={styles.rangeLabel}>{range.label}</Text>
            <Glyph name="chevron-down" size={14} color={brand.textSecondary} />
          </Pressable>
          <Pressable style={styles.iconBtn} onPress={shareSummary} accessibilityRole="button" accessibilityLabel="Share summary">
            <Glyph name="share-outline" size={18} color={brand.text} />
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

        <View style={styles.metricRow}>
          <Metric
            icon="cash-outline"
            label="Revenue"
            value={compactMoney(summary?.income)}
            change={changeLabel(Number(summary?.income || 0), Number(previous?.income || 0))}
          />
          <Metric
            icon="person-outline"
            label="New Leads"
            value={String(sales.total)}
            change={changeLabel(sales.total, priorSales.total)}
          />
          <Metric icon="business-outline" label="Properties" value={String(properties)} change={null} />
          <Metric
            icon="stats-chart"
            label="Conversion"
            value={`${sales.conversion}%`}
            change={changeLabel(sales.conversion, priorSales.conversion)}
          />
        </View>

        <View style={[styles.card, styles.cardGap]}>
          <View style={styles.chartHead}>
            <Text style={styles.cardTitle}>Performance Overview</Text>
            <View style={styles.tabs}>
              {(["REVENUE", "LEADS", "DEALS"] as Tab[]).map((key) => {
                const active = tab === key;
                return (
                  <Pressable
                    key={key}
                    style={[styles.tab, active && styles.tabOn]}
                    onPress={() => setTab(key)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={[styles.tabLabel, active && styles.tabLabelOn]}>
                      {key === "REVENUE" ? "Revenue" : key === "LEADS" ? "Leads" : "Deals"}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <AreaChart
            points={chart}
            tickFormat={(value) => (tab === "REVENUE" ? axisMoney(value) : String(Math.round(value)))}
            calloutLabel={
              chart.length
                ? tab === "REVENUE"
                  ? compactMoney(chart[chart.length - 1].value)
                  : String(chart[chart.length - 1].value)
                : undefined
            }
          />
        </View>

        <Text style={styles.sectionTitle}>Report Categories</Text>
        <View style={styles.categoryCard}>
          {categories.map((entry, index) => (
            <Pressable
              key={entry.id}
              style={[styles.categoryRow, index > 0 && styles.categoryRowDivided]}
              onPress={entry.go}
              accessibilityRole="button"
            >
              <View style={[styles.categoryIcon, { backgroundColor: entry.tint }]}>
                <Glyph name={entry.icon} size={20} color={entry.color} />
              </View>
              <View style={styles.grow}>
                <Text style={styles.categoryTitle} numberOfLines={1}>
                  {entry.title}
                </Text>
                <Text style={styles.categorySub} numberOfLines={1}>
                  {entry.subtitle}
                </Text>
              </View>
              <Text style={styles.categoryValue} numberOfLines={1}>
                {entry.value}
              </Text>
              <Glyph name="chevron-forward" size={17} color={brand.textMuted} />
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Recent Reports</Text>
        <View style={styles.categoryCard}>
          {recent.length === 0 ? (
            <Text style={styles.emptyText}>Nothing generated yet.</Text>
          ) : (
            recent.map((report, index) => (
              <Pressable
                key={report._id}
                style={[styles.categoryRow, index > 0 && styles.categoryRowDivided]}
                onPress={() => navigation.navigate("CustomReport", { report })}
                accessibilityRole="button"
              >
                <View style={[styles.categoryIcon, { backgroundColor: brand.tint }]}>
                  <Glyph name="document-text-outline" size={19} color={brand.deep} />
                </View>
                <View style={styles.grow}>
                  <Text style={styles.categoryTitle} numberOfLines={1}>
                    {report.name}
                  </Text>
                  <Text style={styles.categorySub} numberOfLines={1}>
                    {report.summary || monthLabel(new Date(report.generatedAt))}
                  </Text>
                </View>
                <Text style={styles.categorySub} numberOfLines={1}>
                  {whenLabel(report)}
                </Text>
                <Glyph name="chevron-forward" size={17} color={brand.textMuted} />
              </Pressable>
            ))
          )}
        </View>

        <Pressable
          style={styles.cta}
          onPress={() => navigation.navigate("CustomReport")}
          accessibilityRole="button"
        >
          <Text style={styles.ctaText}>Create custom report</Text>
        </Pressable>
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
            <Text style={styles.sheetLabel}>{entry.label}</Text>
            {entry.key === range.key ? <Glyph name="checkmark" size={18} color={brand.primary} /> : null}
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
      width: "50%",
      fontSize: t.pageTitle,
      lineHeight: 31,
      fontWeight: "700",
      letterSpacing: -0.8,
      color: b.text,
    },
    pageSubtitle: {
      marginTop: 1,
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
    rangeLabel: { fontSize: t.cardTitle, fontWeight: "500", color: b.text },
    iconBtn: {
      width: 36,
      height: 36,
      borderRadius: round.field,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: b.border,
      backgroundColor: b.surface,
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

    metricRow: { flexDirection: "row", gap: 6 },
    metric: {
      flex: 1,
      minWidth: 0,
      paddingHorizontal: 8,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: b.border,
      borderRadius: round.panel,
      backgroundColor: b.surface,
    },
    metricIcon: {
      width: 32,
      height: 32,
      borderRadius: round.field,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: b.tint,
    },
    metricLabel: { marginTop: 8, fontSize: t.tagline, color: b.textSecondary },
    metricValue: {
      marginTop: 2,
      fontSize: t.sectionTitle,
      lineHeight: 20,
      fontWeight: "700",
      letterSpacing: -0.4,
      color: b.text,
    },
    metricChange: {
      marginTop: 3,
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
    },
    metricChangeText: { fontSize: t.micro, fontWeight: "700" },

    card: {
      padding: 13,
      borderWidth: 1,
      borderColor: b.border,
      borderRadius: round.panel,
      backgroundColor: b.surface,
    },
    cardGap: { marginTop: 10 },
    cardTitle: {
      flex: 1,
      minWidth: 0,
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
      marginBottom: 14,
    },
    tabs: {
      flexDirection: "row",
      padding: 3,
      borderRadius: round.field,
      backgroundColor: b.fieldMuted,
    },
    tab: {
      paddingHorizontal: 9,
      height: 28,
      justifyContent: "center",
      borderRadius: round.button,
    },
    tabOn: { backgroundColor: "#d7efe3" },
    tabLabel: { fontSize: t.tagline, fontWeight: "500", color: b.textSecondary },
    tabLabelOn: { fontWeight: "700", color: b.text },

    sectionTitle: {
      marginTop: 18,
      marginBottom: 9,
      fontSize: t.barTitle,
      lineHeight: 23,
      fontWeight: "700",
      letterSpacing: -0.5,
      color: b.text,
    },
    categoryCard: {
      borderWidth: 1,
      borderColor: b.border,
      borderRadius: round.panel,
      backgroundColor: b.surface,
      overflow: "hidden",
    },
    categoryRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 11,
      paddingHorizontal: 12,
      paddingVertical: 13,
    },
    categoryRowDivided: { borderTopWidth: 1, borderTopColor: b.hairline },
    categoryIcon: {
      width: 42,
      height: 42,
      borderRadius: round.field,
      alignItems: "center",
      justifyContent: "center",
    },
    categoryTitle: { fontSize: t.rowTitle, fontWeight: "700", color: b.text },
    categorySub: { marginTop: 2, fontSize: t.tagline, color: b.textMuted },
    categoryValue: { fontSize: t.body, fontWeight: "500", color: b.textSecondary },
    emptyText: { padding: 16, fontSize: t.body, color: b.textMuted },

    cta: {
      marginTop: 16,
      height: 52,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: round.field,
      backgroundColor: "#0b7d52",
    },
    ctaText: { fontSize: t.sectionTitle, fontWeight: "700", color: b.onPrimary },

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

export default IntelligenceReportsScreen;
