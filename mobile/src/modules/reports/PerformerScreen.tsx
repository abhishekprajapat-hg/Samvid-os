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
import { useNavigation, useRoute } from "@react-navigation/native";
import Svg, { Circle, Polygon, Polyline, Rect } from "react-native-svg";
import { Glyph, type GlyphName } from "../../components/ui/Glyph";
import { brand, brandStyles, layout, round, type as t } from "../../theme/brand";
import { toErrorMessage } from "../../utils/errorMessage";
import { getAllLeads } from "../../services/leadService";
import { getTasks } from "../../services/taskService";
import { compactMoney } from "../finance/financeVocab";
import { avatarTone, initialsOf } from "../leads/leadPipeline";
import { MONTHS_SHORT, endOfMonth, minutesLabel, startOfMonth } from "./reportData";
import {
  POINTS,
  buildBadges,
  buildScores,
  movementOf,
  pointsLabel,
  type Score,
} from "./gamification";

/*
 * One person's performance, drawn to the comp.
 *
 * Everything is recomputed from the same records the leaderboard counts, so
 * the points here and the rank there are always the same arithmetic.
 */

/* Six months of points and rank, the two lines the comp overlays. */
const TrendChart = ({
  points,
  ranks,
  width = 176,
  height = 150,
}: {
  points: Array<{ label: string; value: number }>;
  ranks: number[];
  width?: number;
  height?: number;
}) => {
  const padLeft = 34;
  const padRight = 22;
  const padBottom = 22;
  const padTop = 16;

  const peak = Math.max(1000, ...points.map((point) => point.value));
  const top = Math.ceil(peak / 1000) * 1000;
  const worstRank = Math.max(8, ...ranks);

  const plotW = width - padLeft - padRight;
  const plotH = height - padBottom - padTop;
  const xOf = (index: number) => padLeft + (plotW / Math.max(1, points.length - 1)) * index;
  const yPoints = (value: number) => padTop + plotH - (value / top) * plotH;
  /* A better rank is a higher line, so rank 1 sits at the top. */
  const yRank = (rank: number) => padTop + ((rank - 1) / Math.max(1, worstRank - 1)) * plotH;

  const line = points.map((point, index) => `${xOf(index)},${yPoints(point.value)}`).join(" ");
  const area = `${padLeft},${padTop + plotH} ${line} ${xOf(points.length - 1)},${padTop + plotH}`;
  const rankLine = ranks.map((rank, index) => `${xOf(index)},${yRank(rank)}`).join(" ");

  const ticks = [top, top * 0.75, top * 0.5, top * 0.25, 0];

  return (
    <View>
      <Svg width={width} height={height}>
        {ticks.map((tick) => (
          <Rect key={`g-${tick}`} x={padLeft} y={yPoints(tick)} width={plotW} height={0.6} fill={brand.hairline} />
        ))}
        <Polygon points={area} fill="#e2f3ea" />
        <Polyline points={line} fill="none" stroke="#0f5f42" strokeWidth={2} />
        <Polyline points={rankLine} fill="none" stroke="#7ed5ae" strokeWidth={2} />
        {points.map((point, index) => (
          <React.Fragment key={point.label}>
            <Circle cx={xOf(index)} cy={yPoints(point.value)} r={3.4} fill="#0f5f42" />
            <Circle cx={xOf(index)} cy={yRank(ranks[index])} r={3.4} fill="#7ed5ae" />
          </React.Fragment>
        ))}
      </Svg>

      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {ticks.map((tick) => (
          <Text key={`y-${tick}`} style={[styles.trendAxis, { top: yPoints(tick) - 7 }]}>
            {tick === 0 ? "0" : Math.round(tick).toLocaleString("en-IN")}
          </Text>
        ))}
        <Text style={[styles.trendRank, { top: yRank(1) - 7 }]}>1st</Text>
        <Text style={[styles.trendRank, { top: yRank(Math.ceil(worstRank / 2)) - 7 }]}>
          {`${Math.ceil(worstRank / 2)}th`}
        </Text>
        <Text style={[styles.trendRank, { top: yRank(worstRank) - 7 }]}>{`${worstRank}th`}</Text>
      </View>

      <View style={[styles.trendTicks, { paddingLeft: padLeft - 10, paddingRight: padRight - 10 }]}>
        {points.map((point) => (
          <Text key={`x-${point.label}`} style={styles.trendTick}>
            {point.label}
          </Text>
        ))}
      </View>
    </View>
  );
};

const Stat = ({ icon, label, value }: { icon: GlyphName; label: string; value: string }) => (
  <View style={styles.stat}>
    <View style={styles.statIcon}>
      <Glyph name={icon} size={18} color={brand.deep} />
    </View>
    <View style={styles.grow}>
      <Text style={styles.statLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text style={styles.statValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  </View>
);

export const PerformerScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();

  const performerId = String(route.params?.performerId || "");

  const [leads, setLeads] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const [leadRows, taskRows] = await Promise.all([
        getAllLeads({ limit: 500 }),
        getTasks({ limit: 500 }).catch(() => []),
      ]);
      setLeads(Array.isArray(leadRows) ? leadRows : []);
      setTasks(Array.isArray(taskRows) ? taskRows : []);
    } catch (e) {
      setError(toErrorMessage(e, "Failed to load performance"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const now = new Date();
  const thisMonth = useMemo(
    () => buildScores(leads, tasks, startOfMonth(now), endOfMonth(now)),
    [leads, tasks],
  );
  const lastMonth = useMemo(() => {
    const anchor = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return buildScores(leads, tasks, startOfMonth(anchor), endOfMonth(anchor));
  }, [leads, tasks]);

  const rank = thisMonth.findIndex((row) => row.id === performerId) + 1;
  const score: Score | null = thisMonth.find((row) => row.id === performerId) || null;
  const movement = useMemo(() => movementOf(thisMonth, lastMonth), [thisMonth, lastMonth]);
  const delta = movement.get(performerId) ?? null;

  /* Six months of the same arithmetic, for the trend. */
  const trend = useMemo(() => {
    const months = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1);
      const board = buildScores(leads, tasks, startOfMonth(date), endOfMonth(date));
      const mine = board.find((row) => row.id === performerId);
      const place = board.findIndex((row) => row.id === performerId) + 1;
      return {
        label: MONTHS_SHORT[date.getMonth()].slice(0, 3),
        value: mine?.points || 0,
        rank: place > 0 ? place : Math.max(1, board.length || 1),
      };
    });
    return {
      points: months.map(({ label, value }) => ({ label, value })),
      ranks: months.map((month) => month.rank),
    };
  }, [leads, tasks, performerId]);

  const badges = useMemo(() => buildBadges(score).filter((badge) => badge.unlocked).slice(0, 4), [score]);

  /* The comp's activity feed, built from what earned the points. */
  const activity = useMemo(() => {
    const rows: Array<{ icon: GlyphName; title: string; sub: string; when: string; points: number }> = [];
    for (const lead of leads) {
      const owner = lead.assignedTo && typeof lead.assignedTo === "object" ? lead.assignedTo._id : "";
      if (String(owner || "") !== performerId) continue;
      const when = lead.updatedAt || lead.createdAt;
      if (String(lead.status || "") === "CLOSED") {
        rows.push({
          icon: "hand-left",
          title: `Closed ${lead.name} deal`,
          sub: [lead.projectInterested, lead.city].filter(Boolean).join(" · "),
          when,
          points: POINTS.DEAL_CLOSED,
        });
      } else if (["SITE_VISIT", "SITE_VISIT_SCHEDULED"].includes(String(lead.status || ""))) {
        rows.push({
          icon: "location",
          title: "Completed site visit",
          sub: [lead.name, lead.city].filter(Boolean).join(" · "),
          when,
          points: POINTS.SITE_VISIT,
        });
      } else if (String(lead.status || "") === "INTERESTED") {
        rows.push({
          icon: "people",
          title: `Converted ${lead.name} lead`,
          sub: "From enquiry to interested",
          when,
          points: POINTS.LEAD_CONVERTED,
        });
      }
    }
    return rows
      .filter((row) => row.when)
      .sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime())
      .slice(0, 4);
  }, [leads, performerId]);

  const whenLabel = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const days = Math.round(
      (new Date().setHours(0, 0, 0, 0) - new Date(date).setHours(0, 0, 0, 0)) / 86400000,
    );
    const time = date
      .toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true })
      .toUpperCase();
    if (days === 0) return `Today, ${time}`;
    if (days === 1) return `Yesterday, ${time}`;
    return `${MONTHS_SHORT[date.getMonth()].slice(0, 3)} ${date.getDate()}, ${time}`;
  };

  const sendRecognition = async () => {
    if (!score) return;
    await Share.share({
      message: `Well done ${score.name} — ${pointsLabel(score.points)} this month, ${score.deals} deals closed and ${score.visits} site visits. Rank #${rank}.`,
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

  if (!score) {
    return (
      <SafeAreaView style={styles.root} edges={["top", "left", "right"]}>
        <View style={styles.bar}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back">
            <Glyph name="chevron-back" size={25} color={brand.text} />
          </Pressable>
          <Text style={styles.barTitle}>Performance</Text>
        </View>
        <View style={styles.centred}>
          <Text style={styles.emptyText}>{error || "Nothing scored for this person yet"}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const tone = avatarTone(score.name);
  const breakdownPeak = Math.max(1, ...score.breakdown.map((row) => row.points));

  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right"]}>
      <View style={styles.bar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back">
          <Glyph name="chevron-back" size={25} color={brand.text} />
        </Pressable>
        <Text style={styles.barTitle} numberOfLines={1}>
          Performance
        </Text>
        <Pressable onPress={sendRecognition} hitSlop={10} accessibilityRole="button" accessibilityLabel="Share">
          <Glyph name="share-outline" size={21} color={brand.text} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: 26 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={[styles.heroAvatar, { backgroundColor: tone.bg }]}>
            <Text style={[styles.heroInitials, { color: tone.fg }]}>{initialsOf(score.name)}</Text>
          </View>
          <View style={styles.grow}>
            <Text style={styles.heroName} numberOfLines={1}>
              {score.name}
            </Text>
            <Text style={styles.heroRole} numberOfLines={1}>
              {score.role}
            </Text>
            <View style={styles.heroBadge}>
              <Glyph name="ribbon" size={14} color="#8a6a12" />
              <Text style={styles.heroBadgeText}>{`#${rank} Overall`}</Text>
            </View>
          </View>
          <View style={styles.heroRight}>
            <Text style={styles.heroPoints} numberOfLines={1}>
              {Math.round(score.points).toLocaleString("en-IN")}
            </Text>
            <Text style={styles.heroPointsLabel}>points</Text>
            {delta != null ? (
              <View style={styles.heroDelta}>
                <Glyph
                  name={delta >= 0 ? "trending-up" : "trending-down"}
                  size={13}
                  color="#ffffff"
                />
                <Text style={styles.heroDeltaText}>
                  {`${delta >= 0 ? "+" : ""}${delta} this month`}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.statRow}>
          <Stat icon="hand-left" label="Deals Closed" value={String(score.deals)} />
          <Stat icon="cash-outline" label="Revenue" value={compactMoney(score.revenue)} />
          <Stat icon="people" label="Leads Converted" value={String(score.converted)} />
        </View>
        <View style={styles.statRow}>
          <Stat icon="location" label="Site Visits" value={String(score.visits)} />
          <Stat icon="checkbox" label="Tasks Completed" value={String(score.tasks)} />
          <Stat icon="time-outline" label="Avg Response" value={minutesLabel(score.responseMinutes)} />
        </View>

        <View style={styles.splitRow}>
          <View style={[styles.card, styles.half]}>
            <View style={styles.cardHead}>
              <Text style={[styles.cardTitle, styles.grow]} numberOfLines={1}>
                Points Breakdown
              </Text>
              <Text style={styles.cardTotal}>{pointsLabel(score.points)}</Text>
            </View>
            {score.breakdown.map((row) => (
              <View key={row.label} style={styles.breakRow}>
                <View style={styles.breakHead}>
                  <Text style={styles.breakLabel} numberOfLines={1}>
                    {row.label}
                  </Text>
                  <Text style={styles.breakValue}>{pointsLabel(row.points)}</Text>
                </View>
                <View style={styles.breakTrack}>
                  <View
                    style={[styles.breakFill, { width: `${Math.max(3, (row.points / breakdownPeak) * 100)}%` }]}
                  />
                </View>
              </View>
            ))}
          </View>

          <View style={[styles.card, styles.half]}>
            <Text style={[styles.cardTitle, styles.halfTitle]} numberOfLines={1}>
              Monthly Trend
            </Text>
            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: "#0f5f42" }]} />
                <Text style={styles.legendText}>Points</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: "#7ed5ae" }]} />
                <Text style={styles.legendText}>Rank</Text>
              </View>
            </View>
            <TrendChart points={trend.points} ranks={trend.ranks} />
          </View>
        </View>

        <View style={[styles.card, styles.cardGap]}>
          <View style={styles.cardHead}>
            <Text style={[styles.cardTitle, styles.grow]}>Recent Achievements</Text>
            <Pressable
              style={styles.linkRow}
              onPress={() => navigation.navigate("Achievements", { performerId })}
              accessibilityRole="button"
              accessibilityLabel="View all achievements"
            >
              <Text style={styles.linkText}>View all</Text>
              <Glyph name="chevron-forward" size={15} color={brand.primary} />
            </Pressable>
          </View>

          {badges.length === 0 ? (
            <Text style={styles.emptyText}>No badges unlocked yet.</Text>
          ) : (
            <View style={styles.badgeRow}>
              {badges.map((badge) => (
                <View key={badge.key} style={styles.badge}>
                  <View
                    style={[
                      styles.badgeIcon,
                      badge.tone === "GOLD"
                        ? styles.badgeGold
                        : badge.tone === "BLUE"
                          ? styles.badgeBlue
                          : styles.badgeGreen,
                    ]}
                  >
                    <Glyph name={badge.icon as GlyphName} size={22} color="#ffffff" />
                  </View>
                  <Text style={styles.badgeLabel} numberOfLines={2}>
                    {badge.label}
                  </Text>
                  <Text style={styles.badgeNote} numberOfLines={2}>
                    {badge.requirement}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={[styles.card, styles.cardGap]}>
          <View style={styles.cardHead}>
            <Text style={[styles.cardTitle, styles.grow]}>Recent Activity</Text>
            <Pressable
              style={styles.linkRow}
              onPress={() => navigation.navigate("Leads")}
              accessibilityRole="button"
            >
              <Text style={styles.linkText}>View all</Text>
              <Glyph name="chevron-forward" size={15} color={brand.primary} />
            </Pressable>
          </View>

          {activity.length === 0 ? (
            <Text style={styles.emptyText}>Nothing scored yet this month.</Text>
          ) : (
            activity.map((row, index) => (
              <View key={`${row.title}-${index}`} style={[styles.actRow, index > 0 && styles.actRowDivided]}>
                <View style={styles.actIcon}>
                  <Glyph name={row.icon} size={17} color={brand.deep} />
                </View>
                <View style={styles.grow}>
                  <Text style={styles.actTitle} numberOfLines={1}>
                    {row.title}
                  </Text>
                  {row.sub ? (
                    <Text style={styles.actSub} numberOfLines={1}>
                      {row.sub}
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.actWhen} numberOfLines={1}>
                  {whenLabel(row.when)}
                </Text>
                <Text style={styles.actPoints}>{`+${row.points}`}</Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.actionRow}>
          <Pressable
            style={styles.outlineBtn}
            onPress={() => navigation.navigate("Leads")}
            accessibilityRole="button"
          >
            <Text style={styles.outlineBtnText}>View assigned leads</Text>
          </Pressable>
          <Pressable style={styles.solidBtn} onPress={sendRecognition} accessibilityRole="button">
            <Glyph name="trophy" size={17} color={brand.onPrimary} />
            <Text style={styles.solidBtnText}>Send recognition</Text>
          </Pressable>
        </View>
      </ScrollView>
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
      gap: 14,
      paddingHorizontal: layout.gutter,
      paddingTop: 6,
      paddingBottom: 12,
    },
    barTitle: {
      flex: 1,
      minWidth: 0,
      textAlign: "center",
      fontSize: t.hero,
      lineHeight: 25,
      fontWeight: "700",
      letterSpacing: -0.5,
      color: b.text,
    },

    body: { paddingHorizontal: layout.gutter },

    hero: {
      flexDirection: "row",
      alignItems: "center",
      gap: 13,
      padding: 15,
      borderRadius: round.panel,
      backgroundColor: "#0e6b4a",
    },
    heroAvatar: {
      width: 64,
      height: 64,
      borderRadius: round.pill,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 3,
      borderColor: "#ffffff",
    },
    heroInitials: { fontSize: t.hero, fontWeight: "700" },
    heroName: {
      fontSize: t.hero,
      lineHeight: 25,
      fontWeight: "700",
      letterSpacing: -0.5,
      color: "#ffffff",
    },
    heroRole: { marginTop: 1, fontSize: t.body, color: "rgba(255,255,255,0.82)" },
    heroBadge: {
      marginTop: 7,
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      height: 26,
      paddingHorizontal: 10,
      borderRadius: round.field,
      backgroundColor: "#f6dd9a",
    },
    heroBadgeText: { fontSize: t.body, fontWeight: "700", color: "#8a6a12" },
    heroRight: { alignItems: "flex-end" },
    heroPoints: {
      fontSize: 27,
      lineHeight: 32,
      fontWeight: "700",
      letterSpacing: -1,
      color: "#ffffff",
    },
    heroPointsLabel: { fontSize: t.body, color: "rgba(255,255,255,0.82)" },
    heroDelta: {
      marginTop: 7,
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      height: 24,
      paddingHorizontal: 9,
      borderRadius: round.field,
      backgroundColor: "rgba(255,255,255,0.2)",
    },
    heroDeltaText: { fontSize: t.micro, fontWeight: "700", color: "#ffffff" },

    statRow: { marginTop: 9, flexDirection: "row", gap: 7 },
    stat: {
      flex: 1,
      minWidth: 0,
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      paddingHorizontal: 7,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: b.border,
      borderRadius: round.panel,
      backgroundColor: b.surface,
    },
    statIcon: {
      width: 30,
      height: 30,
      borderRadius: round.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: b.tint,
    },
    statLabel: { fontSize: t.micro, color: b.textSecondary },
    statValue: {
      marginTop: 2,
      fontSize: t.sectionTitle,
      lineHeight: 19,
      fontWeight: "700",
      letterSpacing: -0.4,
      color: b.text,
    },

    splitRow: { marginTop: 10, flexDirection: "row", gap: 9 },
    half: { flex: 1, minWidth: 0 },
    halfTitle: { marginBottom: 2 },
    card: {
      padding: 12,
      borderWidth: 1,
      borderColor: b.border,
      borderRadius: round.panel,
      backgroundColor: b.surface,
    },
    cardGap: { marginTop: 10 },
    cardHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
    cardTitle: {
      /* Half-width cards, so "Points Breakdown" has to sit beside its total. */
      fontSize: t.cardTitle,
      lineHeight: 18,
      fontWeight: "700",
      letterSpacing: -0.4,
      color: b.text,
    },
    cardTotal: { fontSize: t.tagline, fontWeight: "700", color: b.primary },
    linkRow: { flexDirection: "row", alignItems: "center", gap: 3 },
    linkText: { fontSize: t.body, fontWeight: "600", color: b.primary },

    breakRow: { marginTop: 9 },
    breakHead: { flexDirection: "row", alignItems: "center", gap: 6 },
    breakLabel: { flex: 1, minWidth: 0, fontSize: t.tagline, color: b.textSecondary },
    breakValue: { fontSize: t.tagline, fontWeight: "700", color: b.text },
    breakTrack: {
      marginTop: 4,
      height: 7,
      borderRadius: round.pill,
      overflow: "hidden",
      backgroundColor: b.hairline,
    },
    breakFill: { height: "100%", borderRadius: round.pill, backgroundColor: "#0b7d52" },

    legendRow: { marginTop: 4, marginBottom: 4, flexDirection: "row", flexWrap: "wrap", gap: 9 },
    legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
    legendDot: { width: 8, height: 8, borderRadius: round.pill },
    legendText: { fontSize: t.micro, color: b.textSecondary },

    trendAxis: {
      position: "absolute",
      left: 0,
      width: 30,
      textAlign: "right",
      fontSize: 8,
      color: b.textMuted,
    },
    trendRank: {
      position: "absolute",
      right: 0,
      width: 20,
      textAlign: "left",
      fontSize: 8,
      color: b.textMuted,
    },
    trendTicks: { flexDirection: "row", marginTop: -16 },
    trendTick: { flex: 1, textAlign: "center", fontSize: 8, color: b.textSecondary },

    badgeRow: { flexDirection: "row", gap: 6 },
    badge: { flex: 1, minWidth: 0, alignItems: "center" },
    badgeIcon: {
      width: 48,
      height: 48,
      borderRadius: round.panel,
      alignItems: "center",
      justifyContent: "center",
    },
    badgeGold: { backgroundColor: "#e8b528" },
    badgeGreen: { backgroundColor: "#2ba96f" },
    badgeBlue: { backgroundColor: "#4d9ae8" },
    badgeLabel: {
      marginTop: 7,
      textAlign: "center",
      fontSize: t.tagline,
      fontWeight: "700",
      color: b.text,
    },
    badgeNote: { marginTop: 2, textAlign: "center", fontSize: t.micro, color: b.textMuted },

    actRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
    actRowDivided: { borderTopWidth: 1, borderTopColor: b.hairline },
    actIcon: {
      width: 34,
      height: 34,
      borderRadius: round.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: b.tint,
    },
    actTitle: { fontSize: t.cardTitle, fontWeight: "700", color: b.text },
    actSub: { marginTop: 1, fontSize: t.tagline, color: b.textMuted },
    actWhen: { fontSize: t.micro, color: b.textMuted },
    actPoints: { fontSize: t.cardTitle, fontWeight: "700", color: b.primary },

    actionRow: { marginTop: 14, flexDirection: "row", gap: 9 },
    outlineBtn: {
      flex: 1,
      minWidth: 0,
      alignItems: "center",
      justifyContent: "center",
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

    emptyText: { fontSize: t.body, color: b.textMuted },
  }),
);

export default PerformerScreen;
