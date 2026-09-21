import React, { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Screen } from "../../components/common/Screen";
import { AppCard, AppChip } from "../../components/common/ui";
import { colors, radii, spacing, typography } from "../../theme/tokens";
import { toErrorMessage } from "../../utils/errorMessage";
import { getRoleLeaderboard, type LeaderboardEntry } from "../../services/userService";
import { useAuth } from "../../context/AuthContext";

/*
 * Mirrors modules/reports/RoleLeaderboard.jsx. The web version renders a ranked
 * table; here each rank is a card, because a five-column table at 390px is
 * unreadable. Same data, same ordering, same role filters.
 */

const RANK_TONE = [
  { bg: "#fdf4e3", border: "#eebf51", text: "#7d5605" }, // 1st
  { bg: "#edf0f5", border: "#c8d0dd", text: "#39424f" }, // 2nd
  { bg: "#fdedec", border: "#ee908c", text: "#942626" }, // 3rd
];

const formatNumber = (value: unknown) => {
  const parsed = Number(value || 0);
  if (!Number.isFinite(parsed)) return "0";
  return parsed.toLocaleString("en-IN");
};

const formatCurrency = (value: unknown) => {
  const parsed = Number(value || 0);
  if (!Number.isFinite(parsed) || parsed === 0) return "₹0";
  if (parsed >= 10000000) return `₹${(parsed / 10000000).toFixed(2)} Cr`;
  if (parsed >= 100000) return `₹${(parsed / 100000).toFixed(2)} L`;
  return `₹${parsed.toLocaleString("en-IN")}`;
};

const roleLabel = (role: string) =>
  String(role || "")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());

const Stat = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.stat}>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

export const RoleLeaderboardScreen = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [filters, setFilters] = useState<string[]>([]);
  const [activeRole, setActiveRole] = useState("");
  const [label, setLabel] = useState("");
  const [windowDays, setWindowDays] = useState(30);

  const load = useCallback(async (role: string) => {
    setError("");
    try {
      const data = await getRoleLeaderboard(role ? { role } : {});
      setEntries(data.leaderboard);
      setFilters(data.allowedRoleFilters);
      setLabel(data.roleLabel || roleLabel(data.role));
      setWindowDays(data.windowDays || 30);
      if (!role && data.role) setActiveRole(data.role);
    } catch (err) {
      setError(toErrorMessage(err, "Could not load the leaderboard"));
    }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      await load(activeRole);
      if (alive) setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [load, activeRole]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load(activeRole);
    setRefreshing(false);
  }, [load, activeRole]);

  const myId = String(user?._id || user?.id || "");

  return (
    <Screen
      title="Leaderboard"
      subtitle={label ? `${label} · last ${windowDays} days` : `Last ${windowDays} days`}
      loading={loading}
      error={error}
    >
      {filters.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {filters.map((role) => (
            <AppChip
              key={role}
              label={roleLabel(role)}
              active={role === activeRole}
              onPress={() => setActiveRole(role)}
              style={styles.filterChip as object}
            />
          ))}
        </ScrollView>
      ) : null}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {entries.length === 0 ? (
          <AppCard>
            <Text style={styles.emptyText}>
              No ranked activity in the last {windowDays} days.
            </Text>
          </AppCard>
        ) : (
          entries.map((entry, index) => {
            const rank = Number(entry.rank || index + 1);
            const tone = RANK_TONE[rank - 1];
            const isMe = myId && String(entry._id || "") === myId;

            return (
              <AppCard
                key={entry._id || `${entry.name}-${index}`}
                style={[styles.card, isMe && styles.cardMe] as object}
              >
                <View style={styles.head}>
                  <View
                    style={[
                      styles.rank,
                      tone
                        ? { backgroundColor: tone.bg, borderColor: tone.border }
                        : { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
                    ]}
                  >
                    <Text style={[styles.rankText, tone ? { color: tone.text } : null]}>{rank}</Text>
                  </View>

                  <View style={styles.identity}>
                    <Text style={styles.name} numberOfLines={1}>
                      {entry.name || "Unnamed"}
                      {isMe ? "  ·  You" : ""}
                    </Text>
                    <Text style={styles.role}>{roleLabel(String(entry.role || ""))}</Text>
                  </View>
                </View>

                <View style={styles.statRow}>
                  <Stat label="Leads" value={formatNumber(entry.leads)} />
                  <Stat label="Converted" value={formatNumber(entry.converted)} />
                  <Stat label="Visits" value={formatNumber(entry.siteVisits)} />
                  <Stat label="Revenue" value={formatCurrency(entry.revenue)} />
                </View>
              </AppCard>
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  filterRow: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  filterChip: {
    marginRight: 0,
  },
  card: {
    marginBottom: spacing.sm,
  },
  cardMe: {
    borderColor: colors.primary,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
  },
  rank: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  rankText: {
    fontSize: typography.section,
    fontWeight: "700",
    color: colors.text,
  },
  identity: {
    flex: 1,
    marginLeft: spacing.md,
  },
  name: {
    fontSize: typography.section,
    fontWeight: "700",
    color: colors.text,
  },
  role: {
    marginTop: 1,
    fontSize: typography.label,
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  statRow: {
    flexDirection: "row",
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  stat: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    fontSize: typography.body,
    fontWeight: "700",
    color: colors.text,
  },
  statLabel: {
    marginTop: 2,
    fontSize: typography.label,
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  emptyText: {
    fontSize: typography.body,
    color: colors.textMuted,
    textAlign: "center",
    paddingVertical: spacing.lg,
  },
});
