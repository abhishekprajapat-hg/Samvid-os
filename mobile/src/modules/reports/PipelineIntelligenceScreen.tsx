import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Glyph } from "../../components/ui/Glyph";
import { brand, brandStyles, layout, round, type as t } from "../../theme/brand";
import { toErrorMessage } from "../../utils/errorMessage";
import { getAllLeads } from "../../services/leadService";
import { shareTextFile } from "../../utils/shareFile";
import { RAMP } from "./reportCharts";
import {
  RANGE_OPTIONS,
  buildExecutiveRows,
  buildIntelligenceCsv,
  buildLostRows,
  buildMonthlyBars,
  buildSourceMix,
  buildStatRows,
  buildSummary,
  countTransferred,
  formatPercent,
  getLeadRangeDate,
  isInRange,
  parseLocalDateInput,
  resolveRangeBounds,
  toDateInputValue,
  type RangeKey,
} from "./intelligence";

/*
 * Web's Intelligence Reports, which the comp-drawn hub replaced on the phone.
 *
 * The same five headline figures with their change against the previous
 * period, leads against closures over six months, where leads come from, the
 * five executives closing most, where leads are lost, and the CSV web exports.
 * Every number is counted from the leads by ./intelligence.ts, which is web's
 * arithmetic, so the two apps cannot disagree.
 */

const initialCustom = () => {
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - 29);
  return { startDate: toDateInputValue(start), endDate: toDateInputValue(now) };
};

export const PipelineIntelligenceScreen = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [rangeKey, setRangeKey] = useState<RangeKey>("THIS_MONTH");
  const [customRange, setCustomRange] = useState(initialCustom);
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async (quiet = false) => {
    try {
      if (quiet) setRefreshing(true);
      else setLoading(true);
      setError("");
      const rows = await getAllLeads();
      setLeads(Array.isArray(rows) ? rows : []);
    } catch (err) {
      setError(toErrorMessage(err, "Failed to load reports"));
      setLeads([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const currentBounds = useMemo(() => resolveRangeBounds({ rangeKey, customRange }), [rangeKey, customRange]);
  const previousBounds = useMemo(() => resolveRangeBounds({ rangeKey, customRange, offset: -1 }), [rangeKey, customRange]);
  const scoped = useMemo(() => leads.filter((lead) => isInRange(getLeadRangeDate(lead), currentBounds)), [leads, currentBounds]);
  const previous = useMemo(
    () => (rangeKey === "CUSTOM" ? [] : leads.filter((lead) => isInRange(getLeadRangeDate(lead), previousBounds))),
    [leads, previousBounds, rangeKey],
  );

  const summary = useMemo(() => buildSummary(scoped), [scoped]);
  const statRows = useMemo(() => buildStatRows(summary, buildSummary(previous)), [summary, previous]);
  const transferred = useMemo(() => countTransferred(scoped), [scoped]);
  const bars = useMemo(() => buildMonthlyBars(leads), [leads]);
  const sources = useMemo(() => buildSourceMix(scoped), [scoped]);
  const executives = useMemo(() => buildExecutiveRows(scoped), [scoped]);
  const lost = useMemo(() => buildLostRows(scoped), [scoped]);

  const customInvalid =
    rangeKey === "CUSTOM"
    && (!parseLocalDateInput(customRange.startDate) || !parseLocalDateInput(customRange.endDate));

  const exportCsv = async () => {
    try {
      const csv = buildIntelligenceCsv({ summary, transferred, executives, lost });
      const shared = await shareTextFile(`reports_${rangeKey.toLowerCase()}.csv`, csv, "text/csv", "Export report");
      setNotice(shared ? "" : "Sharing is not available on this device");
    } catch (err) {
      setNotice(toErrorMessage(err, "Could not export the report"));
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right"]}>
      <View style={styles.bar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back">
          <Glyph name="chevron-back" size={25} color={brand.text} />
        </Pressable>
        <View style={styles.grow}>
          <Text style={styles.barTitle} numberOfLines={1}>Pipeline Intelligence</Text>
          <Text style={styles.barSubtitle} numberOfLines={1}>Leads, closures and losses</Text>
        </View>
        <Pressable style={styles.exportBtn} onPress={exportCsv} disabled={loading} accessibilityRole="button" accessibilityLabel="Export CSV">
          <Glyph name="download-outline" size={17} color={brand.deep} />
          <Text style={styles.exportText}>CSV</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: 26 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={brand.primary} />}
      >
        <View style={styles.ranges}>
          {RANGE_OPTIONS.map((option) => {
            const on = rangeKey === option.key;
            return (
              <Pressable
                key={option.key}
                style={[styles.range, on && styles.rangeOn]}
                onPress={() => setRangeKey(option.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
              >
                <Text style={[styles.rangeText, on && styles.rangeTextOn]}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {rangeKey === "CUSTOM" ? (
          <View style={styles.customRow}>
            <View style={styles.grow}>
              <Text style={styles.fieldLabel}>From</Text>
              <TextInput
                style={styles.field}
                value={customRange.startDate}
                onChangeText={(value) => setCustomRange((prev) => ({ ...prev, startDate: value.trim() }))}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={brand.placeholder}
                keyboardType="numbers-and-punctuation"
                maxLength={10}
              />
            </View>
            <View style={styles.grow}>
              <Text style={styles.fieldLabel}>To</Text>
              <TextInput
                style={styles.field}
                value={customRange.endDate}
                onChangeText={(value) => setCustomRange((prev) => ({ ...prev, endDate: value.trim() }))}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={brand.placeholder}
                keyboardType="numbers-and-punctuation"
                maxLength={10}
              />
            </View>
          </View>
        ) : null}
        {customInvalid ? <Text style={styles.error}>Enter both dates as YYYY-MM-DD.</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {notice ? <Text style={styles.error}>{notice}</Text> : null}

        {loading ? (
          <ActivityIndicator style={styles.loading} color={brand.primary} />
        ) : (
          <>
            <View style={styles.stats}>
              {statRows.map((row) => (
                <View key={row.key} style={styles.stat}>
                  <Text style={styles.statLabel} numberOfLines={1}>{row.key}</Text>
                  <Text style={styles.statValue} numberOfLines={1}>{row.value}</Text>
                  <Text
                    style={[
                      styles.statDelta,
                      row.delta?.tone === "up" && styles.deltaUp,
                      row.delta?.tone === "down" && styles.deltaDown,
                    ]}
                    numberOfLines={1}
                  >
                    {row.delta ? `${row.delta.text}${row.delta.tone ? ` ${row.detail}` : ""}` : row.detail}
                  </Text>
                </View>
              ))}
              <View style={styles.stat}>
                <Text style={styles.statLabel} numberOfLines={1}>Transferred leads</Text>
                <Text style={styles.statValue}>{transferred}</Text>
                <Text style={styles.statDelta} numberOfLines={1}>Reassigned by hand</Text>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Leads vs closures</Text>
              <Text style={styles.cardSub}>Last six months</Text>
              <View style={styles.barsRow}>
                {bars.map((row) => (
                  <View key={row.label} style={styles.barCol}>
                    <View style={styles.barTrack}>
                      <View style={[styles.barLeads, { height: `${row.leadHeight}%` }]} />
                      <View style={[styles.barClosed, { height: `${row.closedHeight}%` }]} />
                    </View>
                    <Text style={styles.barCount}>{row.leads}/{row.closed}</Text>
                    <Text style={styles.barLabel}>{row.label}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.legend}>
                <View style={[styles.legendDot, { backgroundColor: brand.tintBar }]} />
                <Text style={styles.legendText}>Leads</Text>
                <View style={[styles.legendDot, { backgroundColor: brand.primary }]} />
                <Text style={styles.legendText}>Closed</Text>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Lead sources</Text>
              {sources.length === 0 ? <Text style={styles.empty}>No leads in this period.</Text> : null}
              {sources.map((row, index) => (
                <View key={row.label} style={styles.meterRow}>
                  <View style={[styles.legendDot, { backgroundColor: RAMP[index % RAMP.length] }]} />
                  <Text style={styles.meterLabel} numberOfLines={1}>{row.label}</Text>
                  <View style={styles.meterTrack}>
                    <View style={[styles.meterFill, { width: `${Math.max(4, row.share)}%`, backgroundColor: RAMP[index % RAMP.length] }]} />
                  </View>
                  <Text style={styles.meterValue}>{row.count} · {row.share}%</Text>
                </View>
              ))}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Executive performance</Text>
              {executives.length === 0 ? <Text style={styles.empty}>No leads in this period.</Text> : null}
              {executives.map((row, index) => (
                <View key={row.key} style={[styles.execRow, index > 0 && styles.divided]}>
                  <Text style={styles.execName} numberOfLines={1}>{row.name}</Text>
                  <Text style={styles.execMeta}>
                    {row.leads} leads · {row.visits} visits · {row.closed} closed
                  </Text>
                  <Text style={styles.execRate}>{formatPercent(row.conversion, 1)}</Text>
                </View>
              ))}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Where leads are lost</Text>
              {lost.length === 0 ? <Text style={styles.empty}>No lost leads in this period.</Text> : null}
              {lost.map((row) => (
                <View key={row.label} style={styles.meterRow}>
                  <Text style={styles.meterLabel} numberOfLines={1}>{row.label}</Text>
                  <View style={styles.meterTrack}>
                    <View style={[styles.meterFill, styles.lostFill, { width: `${row.width}%` }]} />
                  </View>
                  <Text style={styles.meterValue}>{row.count}</Text>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = brandStyles((b) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: b.bg },
    grow: { flex: 1, minWidth: 0 },
    bar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: layout.gutter,
      paddingTop: 6,
      paddingBottom: 12,
    },
    barTitle: { fontSize: t.hero, lineHeight: 25, fontWeight: "700", letterSpacing: -0.5, color: b.text },
    barSubtitle: { fontSize: t.body, lineHeight: 16, color: b.textMuted },
    exportBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      height: 38,
      paddingHorizontal: 12,
      borderRadius: round.field,
      backgroundColor: b.tint,
    },
    exportText: { fontSize: t.body, fontWeight: "700", color: b.deep },
    body: { paddingHorizontal: layout.gutter },
    ranges: { flexDirection: "row", gap: 6, padding: 3, borderRadius: round.field, backgroundColor: b.fieldMuted },
    range: { flex: 1, height: 34, alignItems: "center", justifyContent: "center", borderRadius: round.field },
    rangeOn: { backgroundColor: b.surface },
    rangeText: { fontSize: t.body, fontWeight: "500", color: b.textSecondary },
    rangeTextOn: { color: b.text, fontWeight: "700" },
    customRow: { marginTop: 10, flexDirection: "row", gap: 8 },
    fieldLabel: { marginBottom: 4, fontSize: t.fieldLabel, color: b.textSecondary },
    field: {
      height: 40,
      paddingHorizontal: 10,
      borderWidth: 1,
      borderColor: b.fieldBorder,
      borderRadius: round.field,
      fontSize: t.field,
      color: b.text,
      backgroundColor: b.surface,
    },
    error: { marginTop: 10, fontSize: t.body, color: b.alert },
    loading: { marginTop: 40 },
    stats: { marginTop: 12, flexDirection: "row", flexWrap: "wrap", gap: 8 },
    stat: {
      flexGrow: 1,
      flexBasis: "46%",
      padding: 11,
      borderWidth: 1,
      borderColor: b.border,
      borderRadius: round.panel,
      backgroundColor: b.surface,
    },
    statLabel: { fontSize: t.tagline, color: b.textSecondary },
    statValue: { marginTop: 4, fontSize: t.hero, lineHeight: 25, fontWeight: "700", color: b.text },
    statDelta: { marginTop: 3, fontSize: t.tagline, color: b.textMuted },
    deltaUp: { color: b.deep },
    deltaDown: { color: b.alert },
    card: {
      marginTop: 12,
      padding: 13,
      borderWidth: 1,
      borderColor: b.border,
      borderRadius: round.panel,
      backgroundColor: b.surface,
    },
    cardTitle: { fontSize: t.sectionTitle, fontWeight: "700", color: b.text },
    cardSub: { marginTop: 2, fontSize: t.body, color: b.textMuted },
    empty: { marginTop: 10, fontSize: t.body, color: b.textMuted },
    barsRow: { marginTop: 12, flexDirection: "row", alignItems: "flex-end", gap: 6 },
    barCol: { flex: 1, alignItems: "center" },
    barTrack: { width: "100%", height: 110, flexDirection: "row", alignItems: "flex-end", justifyContent: "center", gap: 3 },
    barLeads: { width: 10, borderRadius: 4, backgroundColor: b.tintBar },
    barClosed: { width: 10, borderRadius: 4, backgroundColor: b.primary },
    barCount: { marginTop: 4, fontSize: t.micro, color: b.textSecondary },
    barLabel: { fontSize: t.tagline, color: b.textMuted },
    legend: { marginTop: 10, flexDirection: "row", alignItems: "center", gap: 6 },
    legendDot: { width: 9, height: 9, borderRadius: 5 },
    legendText: { marginRight: 10, fontSize: t.body, color: b.textSecondary },
    meterRow: { marginTop: 10, flexDirection: "row", alignItems: "center", gap: 8 },
    meterLabel: { width: 110, fontSize: t.body, color: b.text },
    meterTrack: { flex: 1, height: 8, borderRadius: 4, overflow: "hidden", backgroundColor: b.fieldMuted },
    meterFill: { height: 8, borderRadius: 4 },
    lostFill: { backgroundColor: b.alert },
    meterValue: { minWidth: 44, textAlign: "right", fontSize: t.body, fontWeight: "600", color: b.text },
    execRow: { paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
    divided: { borderTopWidth: 1, borderTopColor: b.hairline },
    execName: { flex: 1, minWidth: 110, fontSize: t.rowTitle, fontWeight: "600", color: b.text },
    execMeta: { fontSize: t.body, color: b.textSecondary },
    execRate: { minWidth: 48, textAlign: "right", fontSize: t.rowTitle, fontWeight: "700", color: b.deep },
  }),
);
