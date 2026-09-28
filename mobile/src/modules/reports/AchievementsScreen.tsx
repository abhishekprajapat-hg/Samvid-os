import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Glyph, type GlyphName } from "../../components/ui/Glyph";
import { useAuth } from "../../context/AuthContext";
import { brand, brandStyles, layout, round, type as t } from "../../theme/brand";
import { toErrorMessage } from "../../utils/errorMessage";
import { getAllLeads } from "../../services/leadService";
import { getTasks } from "../../services/taskService";
import { getMyAttendance } from "../../services/attendanceService";
import { compactMoney, exactMoney } from "../finance/financeVocab";
import { avatarTone, initialsOf } from "../leads/leadPipeline";
import { MONTHS_SHORT, endOfMonth, startOfMonth } from "./reportData";
import {
  LEVEL_STEP,
  POINTS,
  REWARD_TIERS,
  buildBadges,
  buildScores,
  levelCeiling,
  levelFloor,
  levelOf,
  type Badge,
  type Score,
} from "./gamification";

/*
 * Achievements, drawn to the comp.
 *
 * A badge is a threshold on a count, so it unlocks exactly when the count
 * reaches it and un-unlocks if the record behind it is corrected. Nothing is
 * stored, which is the point: a badge can always be explained.
 */

type Tab = "BADGES" | "REWARDS" | "HISTORY";

const TABS: Array<{ key: Tab; label: string }> = [
  { key: "BADGES", label: "Badges" },
  { key: "REWARDS", label: "Rewards" },
  { key: "HISTORY", label: "History" },
];

const BadgeTile = ({ badge, unlocked }: { badge: Badge; unlocked: boolean }) => (
  <View style={styles.badgeTile}>
    <View
      style={[
        styles.badgeIcon,
        badge.tone === "GOLD" ? styles.gold : badge.tone === "BLUE" ? styles.blue : styles.green,
        !unlocked && styles.badgeLocked,
      ]}
    >
      <Glyph name={badge.icon as GlyphName} size={24} color="#ffffff" />
    </View>
    <Text style={styles.badgeLabel} numberOfLines={2}>
      {badge.label}
    </Text>
    <Text style={styles.badgeReq} numberOfLines={2}>
      {badge.requirement}
    </Text>
    {unlocked ? (
      <Text style={styles.badgeNote} numberOfLines={1}>
        Unlocked
      </Text>
    ) : (
      <Text style={styles.badgeNote} numberOfLines={1}>
        {`${Math.round(badge.progress).toLocaleString("en-IN")} / ${Math.round(badge.target).toLocaleString("en-IN")}`}
      </Text>
    )}
  </View>
);

export const AchievementsScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const performerId = String(route.params?.performerId || user?._id || "");
  const isMe = performerId === String(user?._id || "");

  const [tab, setTab] = useState<Tab>("BADGES");
  const [leads, setLeads] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [presentDays, setPresentDays] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const [leadRows, taskRows, attendance] = await Promise.all([
        getAllLeads({ limit: 500 }),
        getTasks({ limit: 500 }).catch(() => []),
        /* Attendance is readable for yourself only, so the streak badges are
           counted when this is your own page and left at zero otherwise. */
        isMe ? getMyAttendance().catch(() => null) : Promise.resolve(null),
      ]);
      setLeads(Array.isArray(leadRows) ? leadRows : []);
      setTasks(Array.isArray(taskRows) ? taskRows : []);
      setPresentDays(Number(attendance?.summary?.presentDays || 0));
    } catch (e) {
      setError(toErrorMessage(e, "Failed to load achievements"));
    } finally {
      setLoading(false);
    }
  }, [isMe]);

  useEffect(() => {
    void load();
  }, [load]);

  const now = new Date();
  const board = useMemo(
    () => buildScores(leads, tasks, startOfMonth(now), endOfMonth(now)),
    [leads, tasks],
  );
  const score: Score | null = board.find((row) => row.id === performerId) || null;
  const rank = board.findIndex((row) => row.id === performerId) + 1;

  const badges = useMemo(() => buildBadges(score, presentDays), [score, presentDays]);
  const unlocked = badges.filter((badge) => badge.unlocked);
  const inProgress = badges.filter((badge) => !badge.unlocked).slice(0, 3);

  const points = score?.points || 0;
  const level = levelOf(points);
  const floor = levelFloor(points);
  const ceiling = levelCeiling(points);
  const toNext = Math.max(0, ceiling - points);
  const share = Math.min(100, Math.round(((points - floor) / LEVEL_STEP) * 100));

  /* The comp's "Recent Points" feed is the same events that scored. */
  const history = useMemo(() => {
    const rows: Array<{ icon: GlyphName; label: string; points: number; when: string }> = [];
    for (const lead of leads) {
      const owner = lead.assignedTo && typeof lead.assignedTo === "object" ? lead.assignedTo._id : "";
      if (String(owner || "") !== performerId) continue;
      const when = lead.updatedAt || lead.createdAt;
      const status = String(lead.status || "");
      if (status === "CLOSED") rows.push({ icon: "hand-left", label: "Deal closed", points: POINTS.DEAL_CLOSED, when });
      else if (status === "INTERESTED") rows.push({ icon: "people", label: "Lead converted", points: POINTS.LEAD_CONVERTED, when });
      else if (["SITE_VISIT", "SITE_VISIT_SCHEDULED"].includes(status)) {
        rows.push({ icon: "business", label: "Site visit", points: POINTS.SITE_VISIT, when });
      }
    }
    for (const task of tasks) {
      const owner = task.assignedTo && typeof task.assignedTo === "object" ? task.assignedTo._id : "";
      if (String(owner || "") !== performerId) continue;
      if (String(task.status || "") !== "COMPLETED") continue;
      rows.push({
        icon: "checkbox",
        label: "Task completed",
        points: POINTS.TASK_COMPLETED,
        when: task.updatedAt || "",
      });
    }
    return rows
      .filter((row) => row.when)
      .sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime())
      .slice(0, tab === "HISTORY" ? 20 : 4);
  }, [leads, tasks, performerId, tab]);

  const whenLabel = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const days = Math.round(
      (new Date().setHours(0, 0, 0, 0) - new Date(date).setHours(0, 0, 0, 0)) / 86400000,
    );
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    return `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]} ${date.getFullYear()}`;
  };

  const name = score?.name || (isMe ? String(user?.name || "You") : "Team member");
  const tone = avatarTone(name);

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
          Achievements
        </Text>
        <Pressable
          onPress={() =>
            Alert.alert(
              "How this works",
              `Points are counted from what you do: a closed deal is +${POINTS.DEAL_CLOSED}, a converted lead +${POINTS.LEAD_CONVERTED}, a site visit +${POINTS.SITE_VISIT} and a completed task +${POINTS.TASK_COMPLETED}. A level is every ${LEVEL_STEP} points. Badges unlock the moment their count is reached.`,
            )
          }
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="How points work"
        >
          <Glyph name="information-circle-outline" size={22} color={brand.text} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: 26 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.levelCard}>
          <View style={[styles.levelAvatar, { backgroundColor: tone.bg }]}>
            <Text style={[styles.levelInitials, { color: tone.fg }]}>{initialsOf(name)}</Text>
          </View>
          <View style={styles.levelWho}>
            <Text style={styles.levelName} numberOfLines={1}>
              {name}
            </Text>
            <View style={styles.levelRow}>
              <Glyph name="shield-checkmark" size={14} color={brand.primary} />
              <Text style={styles.levelText}>{`Level ${level}`}</Text>
            </View>
          </View>
          <View style={styles.levelRight}>
            <Text style={styles.levelPoints} numberOfLines={1}>
              <Text style={styles.levelPointsValue}>{Math.round(points).toLocaleString("en-IN")}</Text>
              {" points"}
            </Text>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${share}%` }]} />
            </View>
            <Text style={styles.levelNote} numberOfLines={1}>
              {`${Math.round(toNext).toLocaleString("en-IN")} pts to Level ${level + 1}`}
            </Text>
          </View>
        </View>

        <View style={styles.tabs}>
          {TABS.map((entry) => {
            const active = tab === entry.key;
            return (
              <Pressable
                key={entry.key}
                style={[styles.tab, active && styles.tabOn]}
                onPress={() => setTab(entry.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.tabLabel, active && styles.tabLabelOn]}>{entry.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {tab === "BADGES" ? (
          <>
            <View style={[styles.card, styles.cardGap]}>
              <View style={styles.cardHead}>
                <Text style={[styles.cardTitle, styles.grow]}>Unlocked Badges</Text>
                <Text style={styles.cardNote}>{`${unlocked.length} badges unlocked`}</Text>
              </View>
              {unlocked.length === 0 ? (
                <Text style={styles.emptyText}>Nothing unlocked yet this month.</Text>
              ) : (
                <View style={styles.badgeGrid}>
                  {unlocked.map((badge) => (
                    <BadgeTile key={badge.key} badge={badge} unlocked />
                  ))}
                </View>
              )}
            </View>

            <View style={[styles.card, styles.cardGap]}>
              <View style={styles.cardHead}>
                <Text style={[styles.cardTitle, styles.grow]}>In Progress</Text>
                <Text style={styles.cardNote}>{`${inProgress.length} in progress`}</Text>
              </View>
              <View style={styles.progressGrid}>
                {inProgress.map((badge) => {
                  const pct = Math.min(100, Math.round((badge.progress / badge.target) * 100));
                  return (
                    <View key={badge.key} style={styles.progressTile}>
                      <View
                        style={[
                          styles.progressIcon,
                          badge.tone === "GOLD" ? styles.goldSoft : badge.tone === "BLUE" ? styles.blueSoft : styles.greenSoft,
                        ]}
                      >
                        <Glyph
                          name={badge.icon as GlyphName}
                          size={19}
                          color={badge.tone === "GOLD" ? "#8a6a12" : badge.tone === "BLUE" ? "#3f6fb5" : brand.deep}
                        />
                      </View>
                      <Text style={styles.progressLabel} numberOfLines={1}>
                        {badge.label}
                      </Text>
                      <Text style={styles.progressValue} numberOfLines={1}>
                        {badge.key === "revenue-star"
                          ? `${compactMoney(badge.progress)} / ${compactMoney(badge.target)}`
                          : `${Math.round(badge.progress)} / ${Math.round(badge.target)}`}
                      </Text>
                      <View style={styles.smallTrack}>
                        <View style={[styles.smallFill, { width: `${Math.max(3, pct)}%` }]} />
                      </View>
                      <Text style={styles.progressPct}>{`${pct}%`}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </>
        ) : null}

        {tab === "BADGES" || tab === "REWARDS" ? (
          <View style={[styles.card, styles.cardGap]}>
            <View style={styles.cardHead}>
              <Text style={[styles.cardTitle, styles.grow]}>Monthly Rewards</Text>
              <Text style={styles.cardNote}>Top 3 performers get rewards</Text>
            </View>
            <View style={styles.rewardRow}>
              {REWARD_TIERS.map((amount, index) => (
                <View
                  key={amount}
                  style={[
                    styles.reward,
                    index === 0 ? styles.rewardGold : index === 1 ? styles.rewardSilver : styles.rewardBronze,
                  ]}
                >
                  <View
                    style={[
                      styles.rewardMedal,
                      { backgroundColor: index === 0 ? "#e8b528" : index === 1 ? "#b6bdc8" : "#c98b57" },
                    ]}
                  >
                    <Text style={styles.rewardPlace}>{index + 1}</Text>
                  </View>
                  <Text style={styles.rewardAmount} numberOfLines={1}>
                    {exactMoney(amount)}
                  </Text>
                  <Text style={styles.rewardNote}>Bonus</Text>
                </View>
              ))}

              <View style={styles.rewardYou}>
                <Text style={styles.rewardYouLabel}>Your Rank</Text>
                <View style={styles.rewardYouRow}>
                  <Text style={styles.rewardYouRank}>{rank > 0 ? `#${rank}` : "—"}</Text>
                  <View style={styles.rewardYouIcon}>
                    <Glyph name="arrow-up" size={15} color={brand.primary} />
                  </View>
                </View>
                <Text style={styles.rewardYouNote} numberOfLines={2}>
                  {rank > 0 && rank <= 3
                    ? `You are in line for ${exactMoney(REWARD_TIERS[rank - 1])}`
                    : rank > 3
                      ? `Move up ${rank - 3} place${rank - 3 === 1 ? "" : "s"} to unlock ${exactMoney(REWARD_TIERS[2])}`
                      : "Score this month to enter the board"}
                </Text>
              </View>
            </View>
            <Text style={styles.footnote}>
              {`1st ${exactMoney(REWARD_TIERS[0])} · 2nd ${exactMoney(REWARD_TIERS[1])} · 3rd ${exactMoney(REWARD_TIERS[2])}`}
            </Text>
          </View>
        ) : null}

        <View style={[styles.card, styles.cardGap]}>
          <View style={styles.cardHead}>
            <Text style={[styles.cardTitle, styles.grow]}>
              {tab === "HISTORY" ? "Points History" : "Recent Points"}
            </Text>
            {tab !== "HISTORY" ? (
              <Pressable onPress={() => setTab("HISTORY")} accessibilityRole="button">
                <Text style={styles.linkText}>See all</Text>
              </Pressable>
            ) : null}
          </View>

          {history.length === 0 ? (
            <Text style={styles.emptyText}>Nothing scored yet.</Text>
          ) : (
            history.map((row, index) => (
              <View key={`${row.label}-${index}`} style={[styles.pointRow, index > 0 && styles.pointRowDivided]}>
                <View style={styles.pointIcon}>
                  <Glyph name={row.icon} size={17} color={brand.deep} />
                </View>
                <Text style={styles.pointLabel} numberOfLines={1}>
                  {row.label}
                </Text>
                <Text style={styles.pointValue}>{`+${row.points}`}</Text>
                <Text style={styles.pointWhen} numberOfLines={1}>
                  {whenLabel(row.when)}
                </Text>
              </View>
            ))
          )}
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
    error: { marginBottom: 10, fontSize: t.body, color: b.alert },

    levelCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 11,
      padding: 13,
      borderWidth: 1,
      borderColor: b.border,
      borderRadius: round.panel,
      backgroundColor: b.surface,
    },
    levelAvatar: {
      width: 48,
      height: 48,
      borderRadius: round.pill,
      alignItems: "center",
      justifyContent: "center",
    },
    levelInitials: { fontSize: t.sectionTitle, fontWeight: "700" },
    levelWho: { width: 112 },
    levelName: { fontSize: t.field, fontWeight: "700", color: b.text },
    levelRow: { marginTop: 4, flexDirection: "row", alignItems: "center", gap: 5 },
    levelText: { fontSize: t.body, fontWeight: "600", color: b.text },
    levelRight: { flex: 1, minWidth: 0 },
    levelPoints: { fontSize: t.body, color: b.textSecondary, textAlign: "right" },
    levelPointsValue: { fontSize: t.sectionTitle, fontWeight: "700", color: b.primary },
    track: {
      marginTop: 6,
      height: 8,
      borderRadius: round.pill,
      overflow: "hidden",
      backgroundColor: b.hairline,
    },
    fill: { height: "100%", borderRadius: round.pill, backgroundColor: "#0b7d52" },
    levelNote: { marginTop: 5, fontSize: t.micro, color: b.textMuted, textAlign: "right" },

    tabs: {
      marginTop: 10,
      flexDirection: "row",
      padding: 4,
      borderRadius: round.field,
      backgroundColor: b.fieldMuted,
    },
    tab: {
      flex: 1,
      minWidth: 0,
      height: 40,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: round.button,
    },
    tabOn: { backgroundColor: "#d7efe3" },
    tabLabel: { fontSize: t.field, fontWeight: "500", color: b.textSecondary },
    tabLabelOn: { fontWeight: "700", color: b.text },

    card: {
      padding: 13,
      borderWidth: 1,
      borderColor: b.border,
      borderRadius: round.panel,
      backgroundColor: b.surface,
    },
    cardGap: { marginTop: 10 },
    cardHead: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
    cardTitle: {
      fontSize: t.barTitle,
      lineHeight: 22,
      fontWeight: "700",
      letterSpacing: -0.4,
      color: b.text,
    },
    cardNote: { fontSize: t.tagline, color: b.textMuted },
    linkText: { fontSize: t.cardTitle, fontWeight: "700", color: b.primary },
    footnote: { marginTop: 10, fontSize: t.micro, color: b.textMuted },
    emptyText: { fontSize: t.body, color: b.textMuted },

    badgeGrid: { flexDirection: "row", flexWrap: "wrap", rowGap: 16 },
    badgeTile: { width: "33.33%", alignItems: "center", paddingHorizontal: 4 },
    badgeIcon: {
      width: 52,
      height: 52,
      borderRadius: round.panel,
      alignItems: "center",
      justifyContent: "center",
    },
    badgeLocked: { opacity: 0.35 },
    gold: { backgroundColor: "#e8b528" },
    green: { backgroundColor: "#2ba96f" },
    blue: { backgroundColor: "#4d9ae8" },
    goldSoft: { backgroundColor: "#fbeec6" },
    greenSoft: { backgroundColor: b.tint },
    blueSoft: { backgroundColor: "#dfeafb" },
    badgeLabel: {
      marginTop: 8,
      textAlign: "center",
      fontSize: t.tagline,
      fontWeight: "700",
      color: b.text,
    },
    badgeReq: { marginTop: 2, textAlign: "center", fontSize: t.micro, color: b.textSecondary },
    badgeNote: { marginTop: 2, textAlign: "center", fontSize: t.micro, color: b.textMuted },

    progressGrid: { flexDirection: "row", gap: 7 },
    progressTile: {
      flex: 1,
      minWidth: 0,
      padding: 10,
      borderWidth: 1,
      borderColor: b.border,
      borderRadius: round.field,
      backgroundColor: b.surface,
    },
    progressIcon: {
      width: 34,
      height: 34,
      borderRadius: round.pill,
      alignItems: "center",
      justifyContent: "center",
    },
    progressLabel: { marginTop: 8, fontSize: t.tagline, fontWeight: "700", color: b.text },
    progressValue: { marginTop: 2, fontSize: t.micro, color: b.textMuted },
    smallTrack: {
      marginTop: 7,
      height: 6,
      borderRadius: round.pill,
      overflow: "hidden",
      backgroundColor: b.hairline,
    },
    smallFill: { height: "100%", borderRadius: round.pill, backgroundColor: "#0b7d52" },
    progressPct: { marginTop: 4, fontSize: t.micro, color: b.textSecondary },

    rewardRow: { flexDirection: "row", gap: 7 },
    reward: {
      flex: 1,
      minWidth: 0,
      alignItems: "center",
      paddingVertical: 12,
      borderWidth: 1,
      borderRadius: round.field,
    },
    rewardGold: { borderColor: "#efd79a", backgroundColor: "#fdf6e4" },
    rewardSilver: { borderColor: "#d8dde4", backgroundColor: "#f5f7f9" },
    rewardBronze: { borderColor: "#ecd3bf", backgroundColor: "#fdf2e9" },
    rewardMedal: {
      width: 26,
      height: 26,
      borderRadius: round.pill,
      alignItems: "center",
      justifyContent: "center",
    },
    rewardPlace: { fontSize: t.tagline, fontWeight: "700", color: "#ffffff" },
    rewardAmount: { marginTop: 7, fontSize: t.cardTitle, fontWeight: "700", color: b.text },
    rewardNote: { marginTop: 1, fontSize: t.micro, color: b.textMuted },
    rewardYou: {
      flex: 1.5,
      minWidth: 0,
      padding: 10,
      borderWidth: 1,
      borderColor: b.greenBright,
      borderRadius: round.field,
      backgroundColor: b.surface,
    },
    rewardYouLabel: { fontSize: t.tagline, color: b.textSecondary },
    rewardYouRow: { marginTop: 4, flexDirection: "row", alignItems: "center", gap: 8 },
    rewardYouRank: {
      flex: 1,
      minWidth: 0,
      fontSize: t.hero,
      lineHeight: 24,
      fontWeight: "700",
      letterSpacing: -0.5,
      color: b.text,
    },
    rewardYouIcon: {
      width: 26,
      height: 26,
      borderRadius: round.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: b.tint,
    },
    rewardYouNote: { marginTop: 5, fontSize: t.micro, lineHeight: 14, color: b.textMuted },

    pointRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
    pointRowDivided: { borderTopWidth: 1, borderTopColor: b.hairline },
    pointIcon: {
      width: 32,
      height: 32,
      borderRadius: round.field,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: b.tint,
    },
    pointLabel: { flex: 1, minWidth: 0, fontSize: t.cardTitle, color: b.text },
    pointValue: { fontSize: t.cardTitle, fontWeight: "700", color: b.primary },
    pointWhen: { width: 78, textAlign: "right", fontSize: t.tagline, color: b.textMuted },
  }),
);

export default AchievementsScreen;
