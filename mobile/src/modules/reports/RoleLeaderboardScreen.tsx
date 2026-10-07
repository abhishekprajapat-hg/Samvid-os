import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Glyph, type GlyphName } from "../../components/ui/Glyph";
import { AppSheet } from "../../components/ui/Overlay";
import { useAuth } from "../../context/AuthContext";
import { brand, brandStyles, layout, round, type as t } from "../../theme/brand";
import { toErrorMessage } from "../../utils/errorMessage";
import { getAllLeads } from "../../services/leadService";
import { getTasks } from "../../services/taskService";
import { compactMoney } from "../finance/financeVocab";
import { avatarTone, initialsOf } from "../leads/leadPipeline";
import { endOfMonth, minutesLabel, monthLabel, startOfMonth } from "./reportData";
import {
  POINTS,
  buildScores,
  movementLabel,
  movementOf,
  pointsLabel,
  type Score,
} from "./gamification";

/*
 * The leaderboard, drawn to the comp.
 *
 * Scores are counted, not stored - see gamification.ts. The consequence worth
 * knowing is that a correction to a lead moves the leaderboard, which is the
 * behaviour you want from a board people are paid against.
 */

type Board = "OVERALL" | "SALES" | "REVENUE" | "TASKS";

const BOARDS: Array<{ key: Board; label: string }> = [
  { key: "OVERALL", label: "Overall" },
  { key: "SALES", label: "Sales" },
  { key: "REVENUE", label: "Revenue" },
  { key: "TASKS", label: "Tasks" },
];

const Movement = ({ delta }: { delta: number | null }) => {
  const move = movementLabel(delta);
  const colour =
    move.tone === "up" ? brand.primary : move.tone === "down" ? brand.alertInk : brand.textMuted;
  const icon: GlyphName =
    move.tone === "up" ? "caret-up" : move.tone === "down" ? "caret-down" : "remove";
  return (
    <View style={styles.move}>
      <Glyph name={icon} size={12} color={colour} />
      <Text style={[styles.moveText, { color: colour }]}>{move.text}</Text>
    </View>
  );
};

const Podium = ({
  score,
  place,
  delta,
  onPress,
}: {
  score: Score;
  place: 1 | 2 | 3;
  delta: number | null;
  onPress: () => void;
}) => {
  const tone = avatarTone(score.name);
  const ring = place === 1 ? "#e8b528" : place === 2 ? "#aeb6c2" : "#c98b57";
  return (
    <Pressable
      style={[styles.podium, place === 1 && styles.podiumFirst]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${score.name} performance`}
    >
      {place === 1 ? <Glyph name="ribbon" size={22} color="#e8b528" style={styles.crown} /> : null}

      <View style={[styles.podiumAvatar, { borderColor: ring, backgroundColor: tone.bg }]}>
        <Text style={[styles.podiumInitials, { color: tone.fg }]}>{initialsOf(score.name)}</Text>
      </View>
      <View style={[styles.placeBadge, { backgroundColor: ring }]}>
        <Text style={styles.placeText}>{place}</Text>
      </View>

      <Text style={styles.podiumName} numberOfLines={1}>
        {score.name}
      </Text>
      <Text style={styles.podiumPoints} numberOfLines={1}>
        {pointsLabel(score.points)}
      </Text>
      <Movement delta={delta} />
      <View style={[styles.plinth, place === 1 ? styles.plinthTall : null]} />
    </Pressable>
  );
};

export const RoleLeaderboardScreen = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [back, setBack] = useState(0);
  const [monthOpen, setMonthOpen] = useState(false);
  const [board, setBoard] = useState<Board>("OVERALL");
  const [roleFilter, setRoleFilter] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);

  const [leads, setLeads] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const bounds = useMemo(() => {
    const anchor = new Date();
    anchor.setDate(1);
    anchor.setMonth(anchor.getMonth() - back);
    return { from: startOfMonth(anchor), to: endOfMonth(anchor), anchor };
  }, [back]);

  const load = useCallback(
    async (quiet = false) => {
      try {
        if (quiet) setRefreshing(true);
        else setLoading(true);
        setError("");
        const [leadRows, taskRows] = await Promise.all([
          getAllLeads({ limit: 500 }),
          getTasks({ limit: 500 }).catch(() => []),
        ]);
        setLeads(Array.isArray(leadRows) ? leadRows : []);
        setTasks(Array.isArray(taskRows) ? taskRows : []);
      } catch (e) {
        setError(toErrorMessage(e, "Failed to load the leaderboard"));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
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

  const scored = useMemo(
    () => buildScores(leads, tasks, bounds.from, bounds.to),
    [leads, tasks, bounds],
  );

  const priorScored = useMemo(() => {
    const anchor = new Date(bounds.anchor.getFullYear(), bounds.anchor.getMonth() - 1, 1);
    return buildScores(leads, tasks, startOfMonth(anchor), endOfMonth(anchor));
  }, [leads, tasks, bounds]);

  /* Each board is the same people ordered by the thing it is about. */
  const ranked = useMemo(() => {
    const rows = roleFilter ? scored.filter((row) => row.role === roleFilter) : [...scored];
    const by: Record<Board, (row: Score) => number> = {
      OVERALL: (row) => row.points,
      SALES: (row) => row.deals,
      REVENUE: (row) => row.revenue,
      TASKS: (row) => row.tasks,
    };
    return rows.sort((a, b) => by[board](b) - by[board](a) || b.points - a.points);
  }, [scored, board, roleFilter]);

  const movement = useMemo(() => movementOf(ranked, priorScored), [ranked, priorScored]);

  const roles = useMemo(
    () => [...new Set(scored.map((row) => row.role))].filter(Boolean).sort(),
    [scored],
  );

  const me = useMemo(() => {
    const index = ranked.findIndex((row) => row.id === String(user?._id || ""));
    return index >= 0 ? { row: ranked[index], rank: index + 1 } : null;
  }, [ranked, user]);

  const thirdPoints = ranked[2]?.points || 0;
  const toTopThree = me ? Math.max(0, thirdPoints - me.row.points) : 0;
  const share = me && thirdPoints > 0 ? Math.min(100, Math.round((me.row.points / thirdPoints) * 100)) : 0;

  const highlights = useMemo(() => {
    const byDeals = [...scored].sort((a, b) => b.deals - a.deals)[0];
    const responders = scored.filter((row) => row.responseMinutes != null);
    const fastest = responders.sort(
      (a, b) => (a.responseMinutes || 0) - (b.responseMinutes || 0),
    )[0];
    const byVisits = [...scored].sort((a, b) => b.visits - a.visits)[0];
    return { byDeals, fastest, byVisits };
  }, [scored]);

  const open = (row: Score) => navigation.navigate("Performer", { performerId: row.id });

  if (loading) {
    return (
      <SafeAreaView style={styles.root} edges={["top", "left", "right"]}>
        <View style={styles.centred}>
          <ActivityIndicator size="large" color={brand.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const [first, second, third] = ranked;
  const rest = ranked.slice(3, 7);

  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <Text style={styles.pageTitle} numberOfLines={1}>
          Leaderboard
        </Text>
        <Text style={styles.pageSubtitle}>Celebrate top performers</Text>
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

        <View style={styles.filterRow}>
          <Pressable style={styles.monthBtn} onPress={() => setMonthOpen(true)} accessibilityRole="button">
            <Glyph name="calendar-outline" size={17} color={brand.text} />
            <Text style={styles.monthLabel} numberOfLines={1}>
              {monthLabel(bounds.anchor)}
            </Text>
            <Glyph name="chevron-down" size={15} color={brand.textSecondary} />
          </Pressable>
          <Pressable
            style={[styles.filterBtn, roleFilter ? styles.filterBtnOn : null]}
            onPress={() => setFilterOpen(true)}
            accessibilityRole="button"
          >
            <Glyph name="filter" size={17} color={roleFilter ? brand.primary : brand.text} />
            <Text style={styles.filterLabel}>Filter</Text>
          </Pressable>
        </View>

        <View style={styles.boardRow}>
          {BOARDS.map((entry) => {
            const active = board === entry.key;
            return (
              <Pressable
                key={entry.key}
                style={[styles.boardTab, active && styles.boardTabOn]}
                onPress={() => setBoard(entry.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.boardLabel, active && styles.boardLabelOn]}>{entry.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {ranked.length === 0 ? (
          <View style={styles.empty}>
            <Glyph name="trophy-outline" size={30} color={brand.placeholder} />
            <Text style={styles.emptyText}>Nobody scored in this month yet</Text>
          </View>
        ) : (
          <>
            <View style={styles.stage}>
              {second ? (
                <Podium score={second} place={2} delta={movement.get(second.id) ?? null} onPress={() => open(second)} />
              ) : (
                <View style={styles.podium} />
              )}
              {first ? (
                <Podium score={first} place={1} delta={movement.get(first.id) ?? null} onPress={() => open(first)} />
              ) : null}
              {third ? (
                <Podium score={third} place={3} delta={movement.get(third.id) ?? null} onPress={() => open(third)} />
              ) : (
                <View style={styles.podium} />
              )}
            </View>

            {me ? (
              <View style={styles.yourRank}>
                <Text style={styles.cardTitle}>Your Rank</Text>
                <View style={styles.yourRow}>
                  <Text style={styles.yourPlace}>{`#${me.rank}`}</Text>
                  <View style={[styles.yourAvatar, { backgroundColor: avatarTone(me.row.name).bg }]}>
                    <Text style={[styles.yourInitials, { color: avatarTone(me.row.name).fg }]}>
                      {initialsOf(me.row.name)}
                    </Text>
                  </View>
                  <View style={styles.grow}>
                    <Text style={styles.yourName} numberOfLines={1}>
                      {me.row.name}
                    </Text>
                    <Text style={styles.yourRole} numberOfLines={1}>
                      {me.row.role}
                    </Text>
                  </View>
                  <View style={styles.yourRight}>
                    <Text style={styles.yourPoints} numberOfLines={1}>
                      {pointsLabel(me.row.points)}
                    </Text>
                    <Text style={styles.yourGap} numberOfLines={1}>
                      {me.rank <= 3 ? "In the top 3" : `${Math.round(toTopThree).toLocaleString("en-IN")} pts to Top 3`}
                    </Text>
                  </View>
                </View>
                <View style={styles.progressRow}>
                  <View style={styles.track}>
                    <View style={[styles.fill, { width: `${me.rank <= 3 ? 100 : share}%` }]} />
                  </View>
                  <Text style={styles.progressText}>{me.rank <= 3 ? 100 : share}%</Text>
                </View>
              </View>
            ) : null}

            <View style={[styles.card, styles.cardGap]}>
              <View style={styles.cardHead}>
                <Text style={[styles.cardTitle, styles.grow]}>Rankings</Text>
                <Pressable
                  style={styles.linkRow}
                  onPress={() => navigation.navigate("Reports")}
                  accessibilityRole="button"
                >
                  <Text style={styles.linkText}>See all</Text>
                  <Glyph name="chevron-forward" size={15} color={brand.primary} />
                </Pressable>
              </View>

              {rest.length === 0 ? (
                <Text style={styles.emptyText}>Only the podium so far.</Text>
              ) : (
                rest.map((row, index) => (
                  <Pressable
                    key={row.id}
                    style={[styles.rankRow, index > 0 && styles.rankRowDivided]}
                    onPress={() => open(row)}
                    accessibilityRole="button"
                    accessibilityLabel={`${row.name} performance`}
                  >
                    <Text style={styles.rankPlace}>{`#${index + 4}`}</Text>
                    <View style={[styles.rankAvatar, { backgroundColor: avatarTone(row.name).bg }]}>
                      <Text style={[styles.rankInitials, { color: avatarTone(row.name).fg }]}>
                        {initialsOf(row.name)}
                      </Text>
                    </View>
                    <View style={styles.grow}>
                      <Text style={styles.rankName} numberOfLines={1}>
                        {row.name}
                      </Text>
                      <Text style={styles.rankRole} numberOfLines={1}>
                        {row.role}
                      </Text>
                    </View>
                    <Text style={styles.rankPoints} numberOfLines={1}>
                      {pointsLabel(row.points)}
                    </Text>
                    <Movement delta={movement.get(row.id) ?? null} />
                    <Glyph name="chevron-forward" size={16} color={brand.textMuted} />
                  </Pressable>
                ))
              )}
            </View>
          </>
        )}

        <View style={[styles.card, styles.cardGap]}>
          <Text style={styles.cardTitle}>How Points Work</Text>
          <View style={styles.pointsRow}>
            {([
              { icon: "hand-left", label: "Deal Closed", value: POINTS.DEAL_CLOSED },
              { icon: "location", label: "Site Visit", value: POINTS.SITE_VISIT },
              { icon: "person-add", label: "Lead Converted", value: POINTS.LEAD_CONVERTED },
              { icon: "checkbox", label: "Task Completed", value: POINTS.TASK_COMPLETED },
            ] as Array<{ icon: GlyphName; label: string; value: number }>).map((entry, index) => (
              <React.Fragment key={entry.label}>
                {index > 0 ? <View style={styles.pointsRule} /> : null}
                <View style={styles.pointsCell}>
                  <View style={styles.pointsIcon}>
                    <Glyph name={entry.icon} size={19} color={brand.deep} />
                  </View>
                  <Text style={styles.pointsLabel} numberOfLines={2}>
                    {entry.label}
                  </Text>
                  <Text style={styles.pointsValue}>{`+${entry.value}`}</Text>
                </View>
              </React.Fragment>
            ))}
          </View>
        </View>

        <View style={[styles.card, styles.cardGap]}>
          <Text style={styles.cardTitle}>This Week&apos;s Highlights</Text>
          <View style={styles.highlightRow}>
            {([
              { label: "Most Deals", row: highlights.byDeals, value: `${highlights.byDeals?.deals || 0} deals` },
              {
                label: "Fastest Response",
                row: highlights.fastest,
                value: minutesLabel(highlights.fastest?.responseMinutes ?? null),
              },
              { label: "Most Visits", row: highlights.byVisits, value: `${highlights.byVisits?.visits || 0} visits` },
            ]).map((entry, index) => (
              <React.Fragment key={entry.label}>
                {index > 0 ? <View style={styles.pointsRule} /> : null}
                <View style={styles.highlightCell}>
                  <Text style={styles.highlightLabel} numberOfLines={1}>
                    {entry.label}
                  </Text>
                  <View style={styles.highlightWho}>
                    <View
                      style={[
                        styles.highlightAvatar,
                        { backgroundColor: avatarTone(entry.row?.name || "").bg },
                      ]}
                    >
                      <Text
                        style={[
                          styles.highlightInitials,
                          { color: avatarTone(entry.row?.name || "").fg },
                        ]}
                      >
                        {initialsOf(entry.row?.name)}
                      </Text>
                    </View>
                    <Text style={styles.highlightName} numberOfLines={1}>
                      {entry.row?.name || "—"}
                    </Text>
                  </View>
                  <Text style={styles.highlightValue} numberOfLines={1}>
                    {entry.value}
                  </Text>
                </View>
              </React.Fragment>
            ))}
          </View>
        </View>
      </ScrollView>

      <AppSheet visible={monthOpen} onClose={() => setMonthOpen(false)} title="Month">
        {Array.from({ length: 12 }, (_, index) => {
          const date = new Date();
          date.setDate(1);
          date.setMonth(date.getMonth() - index);
          return (
            <Pressable
              key={index}
              style={styles.sheetRow}
              onPress={() => {
                setBack(index);
                setMonthOpen(false);
              }}
              accessibilityRole="button"
            >
              <Text style={styles.sheetLabel}>{monthLabel(date)}</Text>
              {index === back ? <Glyph name="checkmark" size={18} color={brand.primary} /> : null}
            </Pressable>
          );
        })}
      </AppSheet>

      <AppSheet visible={filterOpen} onClose={() => setFilterOpen(false)} title="Role">
        {["", ...roles].map((role) => (
          <Pressable
            key={role || "all"}
            style={styles.sheetRow}
            onPress={() => {
              setRoleFilter(role);
              setFilterOpen(false);
            }}
            accessibilityRole="button"
          >
            <Text style={styles.sheetLabel}>{role || "Everyone"}</Text>
            {role === roleFilter ? <Glyph name="checkmark" size={18} color={brand.primary} /> : null}
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

    header: { paddingHorizontal: layout.gutter, paddingTop: 8, paddingBottom: 12 },
    pageTitle: {
      fontSize: t.pageTitle,
      lineHeight: 31,
      fontWeight: "700",
      letterSpacing: -0.8,
      color: b.text,
    },
    pageSubtitle: { marginTop: 1, fontSize: t.cardTitle, lineHeight: 18, color: b.textMuted },

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

    filterRow: { flexDirection: "row", gap: 9 },
    monthBtn: {
      flex: 1,
      minWidth: 0,
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
      height: 46,
      paddingHorizontal: 13,
      borderWidth: 1,
      borderColor: b.border,
      borderRadius: round.field,
      backgroundColor: b.surface,
    },
    monthLabel: { flex: 1, minWidth: 0, fontSize: t.field, fontWeight: "500", color: b.text },
    filterBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      height: 46,
      paddingHorizontal: 16,
      borderWidth: 1,
      borderColor: b.border,
      borderRadius: round.field,
      backgroundColor: b.surface,
    },
    filterBtnOn: { borderColor: b.greenBright, backgroundColor: b.tint },
    filterLabel: { fontSize: t.field, fontWeight: "500", color: b.text },

    boardRow: { marginTop: 10, flexDirection: "row", gap: 7 },
    boardTab: {
      flex: 1,
      minWidth: 0,
      height: 42,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: b.border,
      borderRadius: round.field,
      backgroundColor: b.surface,
    },
    boardTabOn: { borderColor: b.greenBright, backgroundColor: "#dff2e8" },
    boardLabel: { fontSize: t.cardTitle, fontWeight: "500", color: b.text },
    boardLabelOn: { fontWeight: "700" },

    /* ---- podium ---- */
    stage: {
      marginTop: 10,
      flexDirection: "row",
      /* A fixed height with every column bottom-aligned, so the three plinths
         share one baseline however tall their contents are. */
      height: 246,
      paddingTop: 16,
      paddingHorizontal: 6,
      borderRadius: round.panel,
      backgroundColor: "#d9f0e3",
      overflow: "hidden",
    },
    podium: {
      flex: 1,
      minWidth: 0,
      alignItems: "center",
      justifyContent: "flex-end",
    },
    podiumFirst: {},
    crown: { marginBottom: -4 },
    podiumAvatar: {
      width: 62,
      height: 62,
      borderRadius: round.pill,
      borderWidth: 3,
      alignItems: "center",
      justifyContent: "center",
    },
    podiumInitials: { fontSize: t.hero, fontWeight: "700" },
    placeBadge: {
      marginTop: -12,
      width: 24,
      height: 24,
      borderRadius: round.pill,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderColor: "#ffffff",
    },
    placeText: { fontSize: t.tagline, fontWeight: "700", color: "#ffffff" },
    podiumName: {
      marginTop: 6,
      fontSize: t.cardTitle,
      fontWeight: "600",
      color: b.text,
    },
    podiumPoints: {
      marginTop: 2,
      fontSize: t.sectionTitle,
      fontWeight: "700",
      color: b.primary,
    },
    plinth: {
      marginTop: 8,
      alignSelf: "stretch",
      height: 36,
      borderTopLeftRadius: round.field,
      borderTopRightRadius: round.field,
      backgroundColor: "#c2e6d3",
    },
    plinthTall: { height: 58 },

    move: { marginTop: 3, flexDirection: "row", alignItems: "center", gap: 3 },
    moveText: { fontSize: t.tagline, fontWeight: "700" },

    /* ---- your rank ---- */
    yourRank: {
      marginTop: 10,
      padding: 14,
      borderRadius: round.panel,
      backgroundColor: "#e3f3ea",
    },
    yourRow: { marginTop: 10, flexDirection: "row", alignItems: "center", gap: 11 },
    yourPlace: {
      fontSize: 27,
      lineHeight: 32,
      fontWeight: "700",
      letterSpacing: -1,
      color: b.text,
    },
    yourAvatar: {
      width: 42,
      height: 42,
      borderRadius: round.pill,
      alignItems: "center",
      justifyContent: "center",
    },
    yourInitials: { fontSize: t.cardTitle, fontWeight: "700" },
    yourName: { fontSize: t.field, fontWeight: "700", color: b.text },
    yourRole: { marginTop: 1, fontSize: t.body, color: b.textMuted },
    yourRight: { alignItems: "flex-end" },
    yourPoints: { fontSize: t.hero, fontWeight: "700", letterSpacing: -0.5, color: b.primary },
    yourGap: { marginTop: 1, fontSize: t.tagline, color: b.textMuted },
    progressRow: { marginTop: 12, flexDirection: "row", alignItems: "center", gap: 11 },
    track: {
      flex: 1,
      minWidth: 0,
      height: 9,
      borderRadius: round.pill,
      overflow: "hidden",
      backgroundColor: "#cfe4d7",
    },
    fill: { height: "100%", borderRadius: round.pill, backgroundColor: "#0b7d52" },
    progressText: { fontSize: t.body, color: b.textSecondary },

    /* ---- cards ---- */
    card: {
      padding: 13,
      borderWidth: 1,
      borderColor: b.border,
      borderRadius: round.panel,
      backgroundColor: b.surface,
    },
    cardGap: { marginTop: 10 },
    cardHead: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 },
    cardTitle: {
      fontSize: t.barTitle,
      lineHeight: 22,
      fontWeight: "700",
      letterSpacing: -0.4,
      color: b.text,
    },
    linkRow: { flexDirection: "row", alignItems: "center", gap: 3 },
    linkText: { fontSize: t.cardTitle, fontWeight: "600", color: b.primary },

    rankRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 11,
    },
    rankRowDivided: { borderTopWidth: 1, borderTopColor: b.hairline },
    rankPlace: { width: 26, fontSize: t.cardTitle, fontWeight: "600", color: b.textSecondary },
    rankAvatar: {
      width: 38,
      height: 38,
      borderRadius: round.pill,
      alignItems: "center",
      justifyContent: "center",
    },
    rankInitials: { fontSize: t.body, fontWeight: "700" },
    rankName: { fontSize: t.cardTitle, fontWeight: "700", color: b.text },
    rankRole: { marginTop: 1, fontSize: t.tagline, color: b.textMuted },
    rankPoints: { fontSize: t.cardTitle, fontWeight: "600", color: b.text },

    /* ---- points table ---- */
    pointsRow: { marginTop: 12, flexDirection: "row", alignItems: "stretch" },
    pointsRule: { width: 1, backgroundColor: b.hairline },
    pointsCell: { flex: 1, minWidth: 0, alignItems: "center", paddingHorizontal: 4 },
    pointsIcon: {
      width: 44,
      height: 44,
      borderRadius: round.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: b.tint,
    },
    pointsLabel: {
      marginTop: 8,
      textAlign: "center",
      fontSize: t.tagline,
      color: b.textSecondary,
    },
    pointsValue: { marginTop: 3, fontSize: t.sectionTitle, fontWeight: "700", color: b.primary },

    /* ---- highlights ---- */
    highlightRow: { marginTop: 12, flexDirection: "row", alignItems: "stretch" },
    highlightCell: { flex: 1, minWidth: 0, paddingHorizontal: 7 },
    highlightLabel: { fontSize: t.tagline, color: b.textSecondary },
    highlightWho: { marginTop: 8, flexDirection: "row", alignItems: "center", gap: 7 },
    highlightAvatar: {
      width: 30,
      height: 30,
      borderRadius: round.pill,
      alignItems: "center",
      justifyContent: "center",
    },
    highlightInitials: { fontSize: t.micro, fontWeight: "700" },
    highlightName: { flex: 1, minWidth: 0, fontSize: t.tagline, color: b.text },
    highlightValue: { marginTop: 5, fontSize: t.cardTitle, fontWeight: "700", color: b.primary },

    empty: { alignItems: "center", gap: 10, paddingVertical: 42 },
    emptyText: { fontSize: t.field, color: b.textMuted },

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

export default RoleLeaderboardScreen;
