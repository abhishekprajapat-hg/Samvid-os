import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { getAllLeads } from "../../services/leadService";
import { getUsers } from "../../services/userService";
import { compactMoney } from "../finance/financeVocab";
import { avatarTone, initialsOf } from "../leads/leadPipeline";
import { Donut, Funnel, Legend, MultiLineChart, RAMP } from "./reportCharts";
import {
  buildSalesReport,
  changeLabel,
  endOfMonth,
  minutesLabel,
  rangeLabel,
  startOfMonth,
} from "./reportData";

/*
 * The sales report, drawn to the comp.
 *
 * Counted from the leads themselves - see reportData.ts - so the funnel here
 * and the stage chips on the pipeline can never drift apart.
 */

const RANGES = [
  { key: "THIS_MONTH", label: "This month", back: 0 },
  { key: "LAST_MONTH", label: "Last month", back: 1 },
];

const Stat = ({
  label,
  value,
  icon,
  change,
}: {
  label: string;
  value: string;
  icon: GlyphName;
  change?: string | null;
}) => (
  <View style={styles.stat}>
    <View style={styles.statHead}>
      <Text style={styles.statLabel} numberOfLines={1}>
        {label}
      </Text>
      <View style={styles.statIcon}>
        <Glyph name={icon} size={16} color={brand.deep} />
      </View>
    </View>
    <View style={styles.statValueRow}>
      <Text style={styles.statValue} numberOfLines={1}>
        {value}
      </Text>
      {change ? (
        <View style={styles.statChange}>
          <Glyph
            name={change.startsWith("-") ? "trending-down" : "trending-up"}
            size={12}
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
  </View>
);

export const SalesReportScreen = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const [range, setRange] = useState(RANGES[0]);
  const [rangeOpen, setRangeOpen] = useState(false);
  const [team, setTeam] = useState("");
  const [teamOpen, setTeamOpen] = useState(false);
  const [grain, setGrain] = useState<"DAILY" | "WEEKLY">("WEEKLY");

  const [leads, setLeads] = useState<any[]>([]);
  const [users, setUsers] = useState<Array<{ _id?: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const bounds = useMemo(() => {
    const anchor = new Date();
    anchor.setDate(1);
    anchor.setMonth(anchor.getMonth() - range.back);
    const from = startOfMonth(anchor);
    const to = range.back === 0 ? new Date() : endOfMonth(anchor);
    return { from, to };
  }, [range.back]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const [rows, payload] = await Promise.all([
        getAllLeads({ limit: 500 }),
        getUsers().catch(() => ({ users: [] })),
      ]);
      setLeads(Array.isArray(rows) ? rows : []);
      setUsers(payload?.users || []);
    } catch (e) {
      setError(toErrorMessage(e, "Failed to load the sales report"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const scoped = useMemo(() => {
    if (!team) return leads;
    return leads.filter((lead) => {
      const owner = lead.assignedTo && typeof lead.assignedTo === "object" ? lead.assignedTo._id : "";
      return String(owner || "") === team;
    });
  }, [leads, team]);

  const report = useMemo(
    () => buildSalesReport(scoped as any, bounds.from, bounds.to),
    [scoped, bounds],
  );

  const prior = useMemo(() => {
    const from = new Date(bounds.from.getFullYear(), bounds.from.getMonth() - 1, 1);
    return buildSalesReport(scoped as any, from, endOfMonth(from));
  }, [scoped, bounds]);

  /*
   * Daily is the same count over days rather than weeks; anything longer than
   * a fortnight would be unreadable at this width, so it caps at 14 points.
   */
  const growth = useMemo(() => {
    if (grain === "WEEKLY") return report.growth;
    const days = Math.min(
      14,
      Math.max(1, Math.ceil((bounds.to.getTime() - bounds.from.getTime()) / 86400000)),
    );
    return Array.from({ length: days }, (_, index) => {
      const start = new Date(bounds.to.getTime() - (days - 1 - index) * 86400000);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setHours(23, 59, 59, 999);
      const bucket = buildSalesReport(scoped as any, start, end);
      return { label: String(start.getDate()), sub: "", a: bucket.total, b: bucket.qualified };
    });
  }, [grain, report.growth, bounds, scoped]);

  const bestSource = report.sources[0];
  const insight = bestSource
    ? `${bestSource.label} generated the most leads at ${bestSource.share}% of the total, from ${report.total} new leads in this period.`
    : "No leads arrived in this period.";

  const html = () => `
    <html><body style="font-family:-apple-system,Helvetica,Arial;padding:28px;color:#0b1220">
      <h2 style="margin:0">Sales Report</h2>
      <p style="color:#5a6270;margin:4px 0 18px">${rangeLabel(bounds.from, bounds.to)}</p>
      <table style="width:100%;border-collapse:collapse">
        <tr><td style="padding:6px 0">Total leads</td><td style="text-align:right">${report.total}</td></tr>
        <tr><td style="padding:6px 0">Qualified</td><td style="text-align:right">${report.qualified}</td></tr>
        <tr><td style="padding:6px 0">Site visits</td><td style="text-align:right">${report.siteVisits}</td></tr>
        <tr><td style="padding:6px 0">Closed deals</td><td style="text-align:right">${report.closed}</td></tr>
        <tr><td style="padding:6px 0">Conversion</td><td style="text-align:right">${report.conversion}%</td></tr>
        <tr><td style="padding:6px 0">Average response</td><td style="text-align:right">${minutesLabel(report.avgResponseMinutes)}</td></tr>
      </table>
      <h3 style="margin:22px 0 6px">Pipeline</h3>
      ${report.funnel.map((stage) => `<div style="padding:4px 0">${stage.label}: ${stage.value} (${stage.share}%)</div>`).join("")}
      <h3 style="margin:22px 0 6px">Sources</h3>
      ${report.sources.map((source) => `<div style="padding:4px 0">${source.label}: ${source.value} (${source.share}%)</div>`).join("")}
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
      message: `Sales report ${rangeLabel(bounds.from, bounds.to)}: ${report.total} leads, ${report.qualified} qualified, ${report.closed} closed, ${report.conversion}% conversion.`,
    }).catch(() => undefined);
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
      <View style={styles.bar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back">
          <Glyph name="chevron-back" size={25} color={brand.text} />
        </Pressable>
        <View style={styles.grow}>
          <Text style={styles.barTitle} numberOfLines={1}>
            Sales Report
          </Text>
          <Text style={styles.barSubtitle} numberOfLines={1}>
            Office on Rent
          </Text>
        </View>
        <Pressable style={styles.shareBtn} onPress={shareReport} accessibilityRole="button" accessibilityLabel="Share report">
          <Glyph name="share-outline" size={19} color={brand.deep} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: 26 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.filterRow}>
          <Pressable style={styles.filter} onPress={() => setRangeOpen(true)} accessibilityRole="button">
            <Glyph name="calendar-outline" size={16} color={brand.text} />
            <Text style={styles.filterText} numberOfLines={1}>
              {rangeLabel(bounds.from, bounds.to)}
            </Text>
            <Glyph name="chevron-down" size={14} color={brand.textSecondary} />
          </Pressable>
          <Pressable style={styles.filter} onPress={() => setTeamOpen(true)} accessibilityRole="button">
            <Glyph name="people-outline" size={16} color={brand.text} />
            <Text style={styles.filterText} numberOfLines={1}>
              {team ? users.find((user) => user._id === team)?.name || "Team" : "All Team"}
            </Text>
            <Glyph name="chevron-down" size={14} color={brand.textSecondary} />
          </Pressable>
        </View>

        <View style={styles.statRow}>
          <Stat
            label="Total Leads"
            value={String(report.total)}
            icon="people"
            change={changeLabel(report.total, prior.total)}
          />
          <Stat label="Qualified" value={String(report.qualified)} icon="funnel" />
          <Stat label="Site Visits" value={String(report.siteVisits)} icon="calendar" />
        </View>
        <View style={styles.statRow}>
          <Stat label="Closed Deals" value={String(report.closed)} icon="hand-left" />
          <Stat label="Conversion" value={`${report.conversion}%`} icon="stats-chart" />
          <Stat label="Avg Response" value={minutesLabel(report.avgResponseMinutes)} icon="time-outline" />
        </View>

        <View style={styles.splitRow}>
          <View style={[styles.card, styles.half]}>
            <View style={styles.cardHead}>
              <Text style={[styles.cardTitle, styles.grow]} numberOfLines={1}>Lead Growth</Text>
              <View style={styles.grainTabs}>
                {(["DAILY", "WEEKLY"] as const).map((key) => {
                  const active = grain === key;
                  return (
                    <Pressable
                      key={key}
                      style={[styles.grainTab, active && styles.grainTabOn]}
                      onPress={() => setGrain(key)}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: active }}
                    >
                      <Text style={[styles.grainLabel, active && styles.grainLabelOn]}>
                        {key === "DAILY" ? "Daily" : "Weekly"}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: "#0f7a52" }]} />
                <Text style={styles.legendText}>New Leads</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: "#8ed6b4" }]} />
                <Text style={styles.legendText}>Qualified</Text>
              </View>
            </View>

            <MultiLineChart points={growth} width={158} height={150} />
          </View>

          <View style={[styles.card, styles.half]}>
            <Text style={styles.cardTitle}>Pipeline Funnel</Text>
            <View style={styles.funnelWrap}>
              <Funnel stages={report.funnel} />
            </View>
            <Text style={styles.footnote}>% shown as stage conversion from previous stage</Text>
          </View>
        </View>

        <View style={styles.splitRow}>
          <View style={[styles.card, styles.half]}>
            <Text style={styles.cardTitle}>Lead Sources</Text>
            <View style={styles.donutRow}>
              <Donut
                slices={report.sources.map((source) => ({ label: source.label, value: source.value }))}
                size={92}
                thickness={18}
                centreValue={String(report.total)}
                centreLabel="Total Leads"
              />
              <Legend
                slices={report.sources.map((source) => ({ label: source.label, value: source.value }))}
                suffixes={report.sources.map((source) => `${source.share}%`)}
              />
            </View>
          </View>

          <View style={[styles.card, styles.half]}>
            <Text style={styles.cardTitle}>Top Performers</Text>
            {report.performers.length === 0 ? (
              <Text style={styles.footnote}>Nobody has a closed deal in this period.</Text>
            ) : (
              report.performers.map((person, index) => (
                <View key={person.name} style={[styles.performer, index > 0 && styles.performerGap]}>
                  <View style={[styles.performerAvatar, { backgroundColor: avatarTone(person.name).bg }]}>
                    <Text style={[styles.performerInitials, { color: avatarTone(person.name).fg }]}>
                      {initialsOf(person.name)}
                    </Text>
                  </View>
                  <View style={styles.grow}>
                    <Text style={styles.performerName} numberOfLines={1}>
                      {person.name}
                    </Text>
                    <Text style={styles.performerMeta} numberOfLines={1}>
                      {`${person.leads} leads · ${person.deals} deals`}
                    </Text>
                  </View>
                  <Text style={styles.performerValue} numberOfLines={1}>
                    {compactMoney(person.value)}
                  </Text>
                </View>
              ))
            )}
          </View>
        </View>

        <View style={styles.insight}>
          <View style={styles.insightIcon}>
            <Glyph name="bulb-outline" size={22} color={brand.deep} />
          </View>
          <View style={styles.grow}>
            <Text style={styles.insightTitle}>Key Insight</Text>
            <Text style={styles.insightBody}>{insight}</Text>
          </View>
        </View>

        <View style={styles.actionRow}>
          <Pressable style={styles.outlineBtn} onPress={downloadPdf} accessibilityRole="button">
            <Glyph name="document-text-outline" size={17} color={brand.primary} />
            <Text style={styles.outlineBtnText}>Download PDF</Text>
          </Pressable>
          <Pressable style={styles.solidBtn} onPress={shareReport} accessibilityRole="button">
            <Glyph name="share-outline" size={17} color={brand.onPrimary} />
            <Text style={styles.solidBtnText}>Share Report</Text>
          </Pressable>
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
            <Text style={styles.sheetLabel}>{entry.label}</Text>
            {entry.key === range.key ? <Glyph name="checkmark" size={18} color={brand.primary} /> : null}
          </Pressable>
        ))}
      </AppSheet>

      <AppSheet visible={teamOpen} onClose={() => setTeamOpen(false)} title="Team">
        {[{ _id: "", name: "All Team" }, ...users].map((user) => (
          <Pressable
            key={user._id || "all"}
            style={styles.sheetRow}
            onPress={() => {
              setTeam(String(user._id || ""));
              setTeamOpen(false);
            }}
            accessibilityRole="button"
          >
            <Text style={styles.sheetLabel}>{user.name}</Text>
            {String(user._id || "") === team ? (
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
    },
    barSubtitle: { fontSize: t.body, lineHeight: 16, color: b.textMuted },
    shareBtn: {
      width: 38,
      height: 38,
      borderRadius: round.field,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: b.tint,
    },

    body: { paddingHorizontal: layout.gutter },
    error: { marginBottom: 10, fontSize: t.body, color: b.alert },

    filterRow: { flexDirection: "row", gap: 8 },
    filter: {
      flex: 1,
      minWidth: 0,
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      height: 40,
      paddingHorizontal: 11,
      borderWidth: 1,
      borderColor: b.border,
      borderRadius: round.field,
      backgroundColor: b.surface,
    },
    filterText: { flex: 1, minWidth: 0, fontSize: t.body, fontWeight: "500", color: b.text },

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
      backgroundColor: b.tint,
    },
    statValueRow: { marginTop: 6, flexDirection: "row", alignItems: "center", gap: 5 },
    statValue: {
      fontSize: t.hero,
      lineHeight: 25,
      fontWeight: "700",
      letterSpacing: -0.5,
      color: b.text,
    },
    statChange: { flexDirection: "row", alignItems: "center", gap: 2 },
    statChangeText: { fontSize: t.micro, fontWeight: "700" },

    /* The comp runs these two cards side by side, not stacked. */
    splitRow: { marginTop: 10, flexDirection: "row", gap: 9 },
    half: { flex: 1, minWidth: 0 },
    card: {
      padding: 13,
      borderWidth: 1,
      borderColor: b.border,
      borderRadius: round.panel,
      backgroundColor: b.surface,
    },
    cardHead: { flexDirection: "row", alignItems: "center", gap: 10 },
    cardTitle: {
      /* These cards are half the width, so the title sits a step down. */
      fontSize: t.sectionTitle,
      lineHeight: 22,
      fontWeight: "700",
      letterSpacing: -0.4,
      color: b.text,
    },
    grainTabs: {
      flexDirection: "row",
      padding: 3,
      borderRadius: round.field,
      backgroundColor: b.fieldMuted,
    },
    grainTab: { paddingHorizontal: 6, height: 24, justifyContent: "center", borderRadius: round.button },
    grainTabOn: { backgroundColor: "#0b7d52" },
    grainLabel: { fontSize: t.micro, fontWeight: "500", color: b.textSecondary },
    grainLabelOn: { fontWeight: "700", color: b.onPrimary },

    legendRow: { marginTop: 10, marginBottom: 6, flexDirection: "row", flexWrap: "wrap", gap: 9 },
    legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
    legendDot: { width: 9, height: 9, borderRadius: round.pill },
    legendText: { fontSize: t.tagline, color: b.textSecondary },

    funnelWrap: { marginTop: 12 },
    footnote: { marginTop: 10, fontSize: t.tagline, color: b.textMuted },

    donutRow: { marginTop: 12, alignItems: "center", gap: 12 },

    performer: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 12 },
    performerGap: { marginTop: 14 },
    performerAvatar: {
      width: 30,
      height: 30,
      borderRadius: round.pill,
      alignItems: "center",
      justifyContent: "center",
    },
    performerInitials: { fontSize: t.tagline, fontWeight: "700" },
    performerName: { fontSize: t.body, fontWeight: "700", color: b.text },
    performerMeta: { marginTop: 1, fontSize: t.micro, color: b.textMuted },
    performerValue: { fontSize: t.tagline, fontWeight: "700", color: b.primary },

    insight: {
      marginTop: 12,
      flexDirection: "row",
      gap: 13,
      padding: 14,
      borderRadius: round.panel,
      backgroundColor: b.tintSoft,
    },
    insightIcon: {
      width: 44,
      height: 44,
      borderRadius: round.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: b.tint,
    },
    insightTitle: { fontSize: t.barTitle, fontWeight: "700", color: b.primary },
    insightBody: { marginTop: 4, fontSize: t.field, lineHeight: 20, color: b.text },

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

export default SalesReportScreen;
