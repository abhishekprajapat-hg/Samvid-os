import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Icon } from "../../components/ui/Icon";
import { Screen } from "../../components/common/Screen";
import { AppSegmentedTabs } from "../../components/ui";
import { radii, spacing, typography } from "../../theme/tokens";
import { themedStyles, themePalette } from "../../theme/themedStyles";
import { toErrorMessage } from "../../utils/errorMessage";
import {
  getAdminLeaveRequests,
  reviewLeaveRequest,
  type LeaveRequest,
} from "../../services/attendanceService";
import { SolidAvatar, prettyRole } from "./attendanceShared";

/*
 * Comp 5: the approval queue.
 *
 * The comp shows two request kinds, "Leave Request" and "Attendance
 * Correction". Only the first exists: there is one request entity on the
 * backend (LeaveRequest) and one review endpoint. Nothing raises an
 * attendance-correction request, so a tab of them would always be empty and a
 * chip saying so would be a lie about what the queue contains. Leave requests
 * are what this screen reviews; the correction kind is recorded as a gap in
 * docs/mobile/00_MOBILE_PARITY_SPEC.md rather than faked here.
 */

const relativeAge = (value?: string) => {
  if (!value) return "";
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return "";
  const minutes = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
};

const spanOf = (request: LeaveRequest) => {
  const from = request.fromDate ? new Date(request.fromDate) : null;
  const to = request.toDate ? new Date(request.toDate) : null;
  if (!from || Number.isNaN(from.getTime())) return "";
  const pretty = (date: Date) =>
    date.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  const days = Number(request.days || 1);
  const label = `${days} day${days === 1 ? "" : "s"}`;
  if (!to || Number.isNaN(to.getTime()) || pretty(from) === pretty(to)) return `${pretty(from)} (${label})`;
  return `${pretty(from)} – ${pretty(to)} (${label})`;
};

const statusTone = (status?: string) => {
  const c = themePalette;
  const value = String(status || "PENDING").toUpperCase();
  if (value === "APPROVED") return { label: "Approved", color: c.emerald[700], bg: c.emerald[50] };
  if (value === "REJECTED") return { label: "Rejected", color: c.rose[600], bg: c.rose[50] };
  return { label: "Pending", color: c.rose[600], bg: c.rose[50] };
};

export const AttendanceApprovalsScreen = () => {
  const navigation = useNavigation<any>();
  const [tab, setTab] = useState<"PENDING" | "HISTORY">("PENDING");
  const [pending, setPending] = useState<LeaveRequest[]>([]);
  const [history, setHistory] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  const load = useCallback(async (quiet = false) => {
    try {
      if (quiet) setRefreshing(true);
      else setLoading(true);
      setError("");
      const [open, reviewed] = await Promise.all([
        getAdminLeaveRequests({ status: "PENDING" }),
        getAdminLeaveRequests({}).catch(() => [] as LeaveRequest[]),
      ]);
      setPending(open);
      setHistory(reviewed.filter((row) => String(row.status || "").toUpperCase() !== "PENDING"));
    } catch (err) {
      setError(toErrorMessage(err, "Could not load approvals"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const review = async (request: LeaveRequest, status: "APPROVED" | "REJECTED") => {
    const id = String(request._id || "");
    if (!id) return;
    setBusyId(id);
    try {
      await reviewLeaveRequest(id, { status });
      await load(true);
    } catch (err) {
      setError(toErrorMessage(err, "Could not review the request"));
    } finally {
      setBusyId("");
    }
  };

  const rows = tab === "PENDING" ? pending : history;

  const tabs = useMemo(
    () => [
      { key: "PENDING", label: `Pending (${pending.length})` },
      { key: "HISTORY", label: "History" },
    ],
    [pending.length],
  );

  return (
    <Screen
      title="Attendance Approvals"
      description="Review and approve leave requests and attendance corrections from your team"
      back={() => navigation.goBack()}
      loading={loading}
      error={error}
      onRetry={() => load()}
      right={
        <View style={styles.viewPill}>
          <Icon name="people" size={15} color={themePalette.violet[600]} />
          <Text style={styles.viewPillText}>Admin view</Text>
        </View>
      }
    >
      <AppSegmentedTabs
        tabs={tabs}
        activeKey={tab}
        onChange={(key) => setTab(key as "PENDING" | "HISTORY")}
        style={styles.tabs}
      />

      <ScrollView
        contentContainerStyle={styles.page}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
      >
        {rows.length === 0 ? (
          <Text style={styles.empty}>
            {tab === "PENDING" ? "Nothing waiting on you." : "No reviewed requests yet."}
          </Text>
        ) : (
          rows.map((request) => {
            const name = String(request.user?.name || "Team member");
            const tone = statusTone(request.status);
            const busy = busyId === String(request._id);
            return (
              <View key={String(request._id)} style={styles.card}>
                <View style={styles.cardHead}>
                  <SolidAvatar name={name} photo={String((request.user as { profileImageUrl?: string } | undefined)?.profileImageUrl || "")} />
                  <View style={styles.cardHeadCopy}>
                    <Text style={styles.name} numberOfLines={1}>{name}</Text>
                    <Text style={styles.role} numberOfLines={1}>{prettyRole(request.user?.role)}</Text>
                  </View>
                  <Text style={styles.age}>{relativeAge(request.createdAt)}</Text>
                </View>

                <View style={styles.chipRow}>
                  <View style={styles.kindChip}>
                    <Icon name="calendarDays" size={13} color={themePalette.rose[600]} />
                    <Text style={styles.kindChipText}>Leave Request</Text>
                  </View>
                  <View style={styles.spacer} />
                  <View style={[styles.statusChip, { backgroundColor: tone.bg }]}>
                    <View style={[styles.statusDot, { backgroundColor: tone.color }]} />
                    <Text style={[styles.statusChipText, { color: tone.color }]}>{tone.label}</Text>
                  </View>
                </View>

                <View style={styles.dateRow}>
                  <Icon name="calendarDays" size={14} color={themePalette.slate[500]} />
                  <Text style={styles.dateText}>{spanOf(request)}</Text>
                </View>

                {request.reason ? (
                  <View>
                    <Text style={styles.reasonLabel}>Reason</Text>
                    <Text style={styles.reasonText}>{request.reason}</Text>
                  </View>
                ) : null}

                {request.reviewNote ? (
                  <View>
                    <Text style={styles.reasonLabel}>Review note</Text>
                    <Text style={styles.reasonText}>{request.reviewNote}</Text>
                  </View>
                ) : null}

                {tab === "PENDING" ? (
                  <View style={styles.actions}>
                    <Pressable
                      style={[styles.reject, busy && styles.busy]}
                      onPress={() => review(request, "REJECTED")}
                      disabled={busy}
                      accessibilityRole="button"
                    >
                      <Icon name="close" size={16} color={themePalette.rose[600]} />
                      <Text style={styles.rejectText}>Reject</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.approve, busy && styles.busy]}
                      onPress={() => review(request, "APPROVED")}
                      disabled={busy}
                      accessibilityRole="button"
                    >
                      <Icon name="checkmark" size={16} color="#ffffff" />
                      <Text style={styles.approveText}>Approve</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
};

const styles = themedStyles((c) => StyleSheet.create({
  tabs: { marginBottom: spacing.lg },
  page: { gap: spacing.lg, paddingBottom: spacing.xxl },
  viewPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    height: 36,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    backgroundColor: c.violet[50],
  },
  viewPillText: { fontSize: typography.label, fontWeight: "700", color: c.violet[600] },

  card: {
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radii.lg,
    backgroundColor: c.surface,
    padding: spacing.lg,
    gap: spacing.md,
  },
  cardHead: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  cardHeadCopy: { flex: 1, minWidth: 0 },
  name: { fontSize: typography.title, fontWeight: "700", color: c.text },
  role: { marginTop: 1, fontSize: typography.label, color: c.slate[500] },
  age: { fontSize: typography.label, color: c.slate[500] },

  chipRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  spacer: { flex: 1 },
  kindChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: 5,
    borderRadius: radii.md,
    backgroundColor: c.rose[50],
  },
  kindChipText: { fontSize: typography.label, fontWeight: "600", color: c.rose[600] },
  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: 5,
    borderRadius: radii.pill,
  },
  statusDot: { width: 7, height: 7, borderRadius: radii.pill },
  statusChipText: { fontSize: typography.label, fontWeight: "600" },

  dateRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  dateText: { fontSize: typography.label, fontWeight: "600", color: c.text },

  reasonLabel: { fontSize: typography.label, color: c.slate[500] },
  reasonText: { marginTop: 1, fontSize: typography.body, color: c.text },

  actions: { flexDirection: "row", gap: spacing.md, marginTop: spacing.sm },
  busy: { opacity: 0.6 },
  reject: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    height: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.rose[300],
    backgroundColor: c.surface,
  },
  rejectText: { fontSize: typography.title, fontWeight: "700", color: c.rose[600] },
  approve: {
    flex: 1.4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    height: 48,
    borderRadius: radii.md,
    backgroundColor: c.blue[600],
  },
  approveText: { fontSize: typography.title, fontWeight: "700", color: "#ffffff" },

  empty: { paddingVertical: 60, textAlign: "center", fontSize: typography.label, color: c.slate[400] },
}));

export default AttendanceApprovalsScreen;
