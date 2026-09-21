import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { AppBadge, AppButton, AppCard, AppEmptyState } from "../../../components/ui";
import { palette, spacing, typography } from "../../../theme/tokens";
import { toErrorMessage } from "../../../utils/errorMessage";
import {
  getAdminLeaveRequests,
  getDailyAttendanceForAdmin,
  reviewLeaveRequest,
  type AttendanceRecord,
  type LeaveRequest,
} from "../../../services/attendanceService";

/*
 * Management's view: today's roster plus the leave queue.
 *
 * Web draws this as a wide table of staff against days. A phone gets one card
 * per person for the selected day, and a date stepper instead of a calendar
 * header - the same data, reachable with a thumb.
 */

const shiftDate = (key: string, days: number) => {
  const date = new Date(`${key}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const todayKey = () => new Date().toISOString().slice(0, 10);

const formatClock = (value?: string | null) => {
  if (!value) return "--:--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--:--";
  return date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
};

const statusVariant = (status?: string) => {
  const value = String(status || "").toUpperCase();
  if (value === "PRESENT") return "emerald" as const;
  if (value === "LATE" || value === "HALF_DAY") return "amber" as const;
  if (value === "ABSENT") return "rose" as const;
  return "slate" as const;
};

type RosterRow = AttendanceRecord & {
  user?: { _id?: string; name?: string; role?: string } | null;
  onBreak?: boolean;
};

export const TeamSection = () => {
  const [date, setDate] = useState(todayKey());
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [leave, setLeave] = useState<LeaveRequest[]>([]);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const [daily, requests] = await Promise.all([
        getDailyAttendanceForAdmin({ date }),
        // Pending approvals are the actionable half; a failure here should not
        // take the roster down with it.
        getAdminLeaveRequests({ status: "PENDING" }).catch(() => []),
      ]);
      setRoster(daily.attendance as RosterRow[]);
      setSummary(daily.summary || {});
      setLeave(requests);
    } catch (err) {
      setError(toErrorMessage(err, "Could not load the team roster"));
    }
  }, [date]);

  useEffect(() => {
    void load();
  }, [load]);

  const review = useCallback(
    async (request: LeaveRequest, action: "APPROVED" | "REJECTED") => {
      const id = String(request._id || "");
      if (!id) return;

      setBusyId(id);
      try {
        await reviewLeaveRequest(id, { status: action });
        await load();
      } catch (err) {
        Alert.alert("Leave", toErrorMessage(err, "Could not record that decision"));
      } finally {
        setBusyId(null);
      }
    },
    [load],
  );

  const dateLabel = useMemo(() => {
    const parsed = new Date(`${date}T12:00:00Z`);
    if (Number.isNaN(parsed.getTime())) return date;
    return parsed.toLocaleDateString("en-IN", { day: "2-digit", month: "short", weekday: "short" });
  }, [date]);

  const isToday = date === todayKey();

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.stepper}>
        <AppButton title="‹" variant="secondary" size="sm" onPress={() => setDate(shiftDate(date, -1))} />
        <Text style={styles.stepperLabel}>{isToday ? `Today · ${dateLabel}` : dateLabel}</Text>
        <AppButton
          title="›"
          variant="secondary"
          size="sm"
          disabled={isToday}
          onPress={() => setDate(shiftDate(date, 1))}
        />
      </View>

      {Object.keys(summary).length ? (
        <AppCard style={styles.card}>
          <View style={styles.summaryWrap}>
            {Object.entries(summary).map(([key, value]) => (
              <View key={key} style={styles.summaryChip}>
                <Text style={styles.summaryValue}>{String(value)}</Text>
                <Text style={styles.summaryLabel}>{key.replace(/([A-Z])/g, " $1").trim()}</Text>
              </View>
            ))}
          </View>
        </AppCard>
      ) : null}

      {leave.length > 0 ? (
        <>
          <Text style={styles.heading}>PENDING LEAVE ({leave.length})</Text>
          {leave.map((request, index) => (
            <AppCard key={request._id || index} style={styles.card}>
              <Text style={styles.name}>{request.user?.name || "Unknown"}</Text>
              <Text style={styles.meta}>
                {request.fromDate} → {request.toDate}
                {request.days ? ` · ${request.days} day(s)` : ""}
              </Text>
              {request.reason ? <Text style={styles.reason}>{request.reason}</Text> : null}
              <View style={styles.actions}>
                <AppButton
                  title="Reject"
                  variant="danger"
                  size="sm"
                  disabled={busyId === request._id}
                  onPress={() => review(request, "REJECTED")}
                  style={styles.action}
                />
                <AppButton
                  title="Approve"
                  variant="success"
                  size="sm"
                  loading={busyId === request._id}
                  onPress={() => review(request, "APPROVED")}
                  style={styles.action}
                />
              </View>
            </AppCard>
          ))}
        </>
      ) : null}

      <Text style={styles.heading}>ROSTER</Text>

      {roster.length === 0 ? (
        <AppEmptyState title="No attendance for this day" description="Nobody has clocked in yet." />
      ) : (
        roster.map((row, index) => (
          <AppCard key={row._id || `${row.user?._id}-${index}`} style={styles.card}>
            <View style={styles.rowHead}>
              <View style={styles.identity}>
                <Text style={styles.name} numberOfLines={1}>
                  {row.user?.name || "Unknown"}
                </Text>
                {row.user?.role ? (
                  <Text style={styles.role}>{String(row.user.role).replace(/_/g, " ")}</Text>
                ) : null}
              </View>
              <AppBadge variant={statusVariant(row.status)}>{String(row.status || "—").replace(/_/g, " ")}</AppBadge>
            </View>

            <View style={styles.rowMeta}>
              <Text style={styles.meta}>
                {formatClock(row.checkInAt)} → {formatClock(row.checkOutAt)}
              </Text>
              {row.onBreak ? <AppBadge variant="amber" dot>On break</AppBadge> : null}
            </View>
          </AppCard>
        ))
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  body: { paddingBottom: spacing.xxl },
  card: { marginBottom: spacing.md },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.lg,
  },
  stepperLabel: { fontSize: typography.body, fontWeight: "600", color: palette.slate[900] },
  heading: {
    fontSize: typography.caption,
    fontWeight: "700",
    color: palette.slate[500],
    letterSpacing: 0.8,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  summaryWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  summaryChip: { minWidth: 72 },
  summaryValue: { fontSize: typography.title, fontWeight: "700", color: palette.slate[900] },
  summaryLabel: {
    fontSize: typography.caption,
    color: palette.slate[500],
    textTransform: "capitalize",
  },
  rowHead: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  identity: { flex: 1 },
  name: { fontSize: typography.body, fontWeight: "600", color: palette.slate[900] },
  role: {
    marginTop: 1,
    fontSize: typography.caption,
    color: palette.slate[500],
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  rowMeta: {
    marginTop: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  meta: { fontSize: typography.label, color: palette.slate[500] },
  reason: { marginTop: spacing.md, fontSize: typography.body, color: palette.slate[600] },
  actions: { flexDirection: "row", gap: spacing.md, marginTop: spacing.lg },
  action: { flex: 1 },
  error: { marginBottom: spacing.lg, fontSize: typography.label, color: palette.rose[700] },
});
