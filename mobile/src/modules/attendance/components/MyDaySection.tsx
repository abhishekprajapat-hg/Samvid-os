import React, { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { AppButton, AppCard, AppSkeletonList } from "../../../components/ui";
import { colors, radii, spacing, typography } from "../../../theme/tokens";
import { toErrorMessage } from "../../../utils/errorMessage";
import {
  checkInAttendance,
  checkOutAttendance,
  endBreakAttendance,
  getMyAttendance,
  getMyLeaveBalance,
  startBreakAttendance,
  type AttendancePolicy,
  type AttendanceRecord,
  type LeaveBalance,
} from "../../../services/attendanceService";
import { getAttendanceLocation } from "../../../utils/location";
import { themedStyles } from "../../../theme/themedStyles";

/*
 * Attendance, phone-first.
 *
 * The web hub (modules/attendance/AttendanceHub.jsx) is a wide table of days
 * against staff, which is the right shape for a desktop. On a phone the primary
 * job is the one the desk view treats as incidental: a person marking their own
 * day. So the check-in/out control leads, and history follows it as a list.
 *
 * Check-in and check-out are geofenced by the backend when the company's
 * policy has geofenceEnabled on: it rejects a fix outside officeRadiusMeters,
 * using the reported accuracy as a buffer. So location is fetched before those
 * two calls - but only when the policy actually asks for it, because prompting
 * for location on a company that does not geofence is a permission dialog with
 * nothing behind it.
 */

const STATUS_TONE: Record<string, { bg: string; border: string; text: string }> = {
  PRESENT: { bg: colors.successBg, border: colors.successBorder, text: colors.success },
  LATE: { bg: colors.warningBg, border: colors.warning, text: colors.warning },
  HALF_DAY: { bg: colors.warningBg, border: colors.warning, text: colors.warning },
  ABSENT: { bg: colors.errorBg, border: colors.errorBorder, text: colors.error },
  LEAVE: { bg: colors.surfaceMuted, border: colors.border, text: colors.textMuted },
};

const toneFor = (status?: string) =>
  STATUS_TONE[String(status || "").toUpperCase()] || {
    bg: colors.surfaceMuted,
    border: colors.border,
    text: colors.textMuted,
  };

const formatClock = (value?: string | null) => {
  if (!value) return "--:--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--:--";
  return date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
};

const formatDay = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", weekday: "short" });
};

const formatDuration = (minutes?: number | null) => {
  const total = Math.max(0, Math.round(Number(minutes || 0)));
  if (!total) return "0m";
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (!hours) return `${mins}m`;
  return mins ? `${hours}h ${mins}m` : `${hours}h`;
};

const StatusPill = ({ status }: { status?: string }) => {
  const tone = toneFor(status);
  const label = String(status || "—").replace(/_/g, " ");
  return (
    <View style={[styles.pill, { backgroundColor: tone.bg, borderColor: tone.border }]}>
      <Text style={[styles.pillText, { color: tone.text }]}>{label}</Text>
    </View>
  );
};

const Metric = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.metric}>
    <Text style={styles.metricValue}>{value}</Text>
    <Text style={styles.metricLabel}>{label}</Text>
  </View>
);

export const MyDaySection = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [today, setToday] = useState<AttendanceRecord | null>(null);
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [leave, setLeave] = useState<LeaveBalance | null>(null);
  const [policy, setPolicy] = useState<AttendancePolicy | null>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      // Leave balance is supporting information - if that endpoint is not
      // available to this role, the day-marking flow should still work.
      const [mine, balance] = await Promise.all([
        getMyAttendance(),
        getMyLeaveBalance().catch(() => null),
      ]);

      setToday(mine.today);
      setHistory(mine.attendance);
      setSummary(mine.summary || {});
      setLeave(balance);
      setPolicy(mine.policy);
    } catch (err) {
      setError(toErrorMessage(err, "Could not load attendance"));
    }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      await load();
      if (alive) setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const geofenced = Boolean((policy as { geofenceEnabled?: boolean } | null)?.geofenceEnabled);

  const run = useCallback(
    async (
      action: (
        payload: Record<string, unknown>,
      ) => Promise<{ message: string; attendance: AttendanceRecord | null }>,
      { needsLocation = false }: { needsLocation?: boolean } = {},
    ) => {
      if (busy) return;
      setBusy(true);
      try {
        const payload: Record<string, unknown> = { source: "MOBILE" };

        if (needsLocation && geofenced) {
          const fix = await getAttendanceLocation();
          if (!fix.ok) {
            Alert.alert("Location needed", fix.message);
            return;
          }
          payload.location = fix.location;
        }

        const result = await action(payload);
        if (result.attendance) setToday(result.attendance);
        // Re-read rather than trusting the local patch: the server recomputes
        // worked minutes and status, and the history row needs to agree.
        await load();
      } catch (err) {
        Alert.alert("Attendance", toErrorMessage(err, "That did not go through"));
      } finally {
        setBusy(false);
      }
    },
    [busy, geofenced, load],
  );

  const checkedIn = Boolean(today?.checkInAt);
  const checkedOut = Boolean(today?.checkOutAt);
  const onBreak = Boolean(today?.onBreak);

  if (loading) {
    return <AppSkeletonList rows={3} />;
  }

  return (
    <>
      {error ? <Text style={styles.sectionError}>{error}</Text> : null}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <AppCard style={styles.todayCard as object}>
          <View style={styles.todayHead}>
            <Text style={styles.cardTitle}>Today</Text>
            <StatusPill status={today?.status} />
          </View>

          <View style={styles.clockRow}>
            <View style={styles.clockBlock}>
              <Text style={styles.clockLabel}>Check in</Text>
              <Text style={styles.clockValue}>{formatClock(today?.checkInAt)}</Text>
            </View>
            <View style={styles.clockDivider} />
            <View style={styles.clockBlock}>
              <Text style={styles.clockLabel}>Check out</Text>
              <Text style={styles.clockValue}>{formatClock(today?.checkOutAt)}</Text>
            </View>
          </View>

          <View style={styles.metricRow}>
            <Metric label="Worked" value={formatDuration(today?.workedMinutes)} />
            <Metric label="Break" value={formatDuration(today?.breakMinutes)} />
            <Metric label="Late by" value={formatDuration(today?.lateMinutes)} />
          </View>

          <View style={styles.actions}>
            {!checkedIn ? (
              <AppButton
                title={busy ? "Checking in..." : "Check in"}
                disabled={busy}
                onPress={() => run(checkInAttendance, { needsLocation: true })}
                style={styles.actionButton as object}
              />
            ) : null}

            {checkedIn && !checkedOut ? (
              <>
                <AppButton
                  title={onBreak ? "End break" : "Start break"}
                  variant="ghost"
                  disabled={busy}
                  onPress={() => run(onBreak ? endBreakAttendance : startBreakAttendance)}
                  style={styles.actionButton as object}
                />
                <AppButton
                  title={busy ? "Checking out..." : "Check out"}
                  disabled={busy || onBreak}
                  onPress={() =>
                    Alert.alert("Check out", "End your working day?", [
                      { text: "Cancel", style: "cancel" },
                      { text: "Check out", onPress: () => run(checkOutAttendance, { needsLocation: true }) },
                    ])
                  }
                  style={styles.actionButton as object}
                />
              </>
            ) : null}

            {checkedOut ? <Text style={styles.doneNote}>Day complete. See you tomorrow.</Text> : null}
          </View>

          {onBreak ? <Text style={styles.breakNote}>You are on a break — check out is paused.</Text> : null}
          {geofenced && !checkedOut ? (
            <Text style={styles.geofenceNote}>Your location is checked against the office when you clock in and out.</Text>
          ) : null}
        </AppCard>

        {leave ? (
          <AppCard style={styles.card as object}>
            <Text style={styles.cardTitle}>Leave balance</Text>
            <View style={styles.metricRow}>
              <Metric label="Available" value={String(leave.available)} />
              <Metric label="Used" value={String(leave.used)} />
              <Metric label="Pending" value={String(leave.pending)} />
            </View>
          </AppCard>
        ) : null}

        {Object.keys(summary).length ? (
          <AppCard style={styles.card as object}>
            <Text style={styles.cardTitle}>This period</Text>
            <View style={styles.summaryWrap}>
              {Object.entries(summary).map(([key, value]) => (
                <View key={key} style={styles.summaryChip}>
                  <Text style={styles.summaryChipValue}>{String(value)}</Text>
                  <Text style={styles.summaryChipLabel}>{key.replace(/_/g, " ")}</Text>
                </View>
              ))}
            </View>
          </AppCard>
        ) : null}

        <Text style={styles.sectionHeading}>Recent days</Text>

        {history.length === 0 ? (
          <AppCard style={styles.card as object}>
            <Text style={styles.emptyText}>No attendance recorded yet.</Text>
          </AppCard>
        ) : (
          history.map((record, index) => (
            <AppCard key={record._id || record.date || String(index)} style={styles.historyCard as object}>
              <View style={styles.historyHead}>
                <Text style={styles.historyDate}>{formatDay(record.date)}</Text>
                <StatusPill status={record.status} />
              </View>
              <View style={styles.historyRow}>
                <Text style={styles.historyMeta}>
                  {formatClock(record.checkInAt)} → {formatClock(record.checkOutAt)}
                </Text>
                <Text style={styles.historyMeta}>{formatDuration(record.workedMinutes)}</Text>
              </View>
            </AppCard>
          ))
        )}
      </ScrollView>
    </>
  );
};

const styles = themedStyles((c) => StyleSheet.create({
  card: {
    marginBottom: spacing.md,
  },
  todayCard: {
    marginBottom: spacing.md,
  },
  todayHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  cardTitle: {
    fontSize: typography.section,
    fontWeight: "700",
    color: colors.text,
  },
  clockRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceMuted,
    paddingVertical: spacing.md,
  },
  clockBlock: {
    flex: 1,
    alignItems: "center",
  },
  clockDivider: {
    width: 1,
    alignSelf: "stretch",
    backgroundColor: colors.border,
  },
  clockLabel: {
    fontSize: typography.label,
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  clockValue: {
    marginTop: 2,
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
  },
  metricRow: {
    flexDirection: "row",
    marginTop: spacing.md,
  },
  metric: {
    flex: 1,
    alignItems: "center",
  },
  metricValue: {
    fontSize: typography.section,
    fontWeight: "700",
    color: colors.text,
  },
  metricLabel: {
    marginTop: 2,
    fontSize: typography.label,
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  actions: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  actionButton: {
    width: "100%",
  },
  doneNote: {
    textAlign: "center",
    fontSize: typography.body,
    color: colors.textMuted,
    paddingVertical: spacing.sm,
  },
  geofenceNote: {
    marginTop: spacing.md,
    fontSize: typography.label,
    color: colors.textMuted,
    textAlign: "center",
  },
  breakNote: {
    marginTop: spacing.sm,
    fontSize: typography.body,
    color: colors.warning,
    textAlign: "center",
  },
  summaryWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  summaryChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minWidth: 82,
  },
  summaryChipValue: {
    fontSize: typography.section,
    fontWeight: "700",
    color: colors.text,
  },
  summaryChipLabel: {
    fontSize: typography.label,
    color: colors.textMuted,
    textTransform: "capitalize",
  },
  sectionHeading: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    fontSize: typography.label,
    fontWeight: "700",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  historyCard: {
    marginBottom: spacing.sm,
  },
  historyHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  historyDate: {
    fontSize: typography.body,
    fontWeight: "700",
    color: colors.text,
  },
  historyRow: {
    marginTop: spacing.sm,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  historyMeta: {
    fontSize: typography.body,
    color: colors.textMuted,
  },
  pill: {
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  pillText: {
    fontSize: typography.label,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  sectionError: {
    marginBottom: spacing.lg,
    fontSize: typography.label,
    color: colors.error,
  },
  emptyText: {
    fontSize: typography.body,
    color: colors.textMuted,
    textAlign: "center",
    paddingVertical: spacing.lg,
  },
}));
