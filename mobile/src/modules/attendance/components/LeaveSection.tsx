import React, { useCallback, useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { AppBadge, AppButton, AppCard, AppEmptyState, AppInput, AppSheet } from "../../../components/ui";
import { palette, spacing, typography } from "../../../theme/tokens";
import { toErrorMessage } from "../../../utils/errorMessage";
import {
  createLeaveRequest,
  getMyLeaveBalance,
  getMyLeaveRequests,
  type LeaveBalance,
  type LeaveRequest,
} from "../../../services/attendanceService";
import { themedStyles, themePalette } from "../../../theme/themedStyles";

/*
 * The employee half of leave: balance, history, and a new request.
 * Approval lives in the Team tab, which only management sees.
 */

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const statusVariant = (status?: string) => {
  const value = String(status || "").toUpperCase();
  if (value === "APPROVED") return "emerald" as const;
  if (value === "REJECTED") return "rose" as const;
  return "amber" as const;
};

const formatDate = (value?: string) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

const todayKey = () => new Date().toISOString().slice(0, 10);

const Metric = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.metric}>
    <Text style={styles.metricValue}>{value}</Text>
    <Text style={styles.metricLabel}>{label}</Text>
  </View>
);

export const LeaveSection = () => {
  const [balance, setBalance] = useState<LeaveBalance | null>(null);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [error, setError] = useState("");

  const [composing, setComposing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fromDate, setFromDate] = useState(todayKey());
  const [toDate, setToDate] = useState(todayKey());
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const [nextBalance, nextRequests] = await Promise.all([
        getMyLeaveBalance().catch(() => null),
        getMyLeaveRequests(),
      ]);
      setBalance(nextBalance);
      setRequests(nextRequests);
    } catch (err) {
      setError(toErrorMessage(err, "Could not load leave"));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = useCallback(async () => {
    if (!DATE_PATTERN.test(fromDate) || !DATE_PATTERN.test(toDate)) {
      Alert.alert("Leave request", "Enter both dates as YYYY-MM-DD.");
      return;
    }
    if (toDate < fromDate) {
      Alert.alert("Leave request", "The end date cannot be before the start date.");
      return;
    }
    if (!reason.trim()) {
      Alert.alert("Leave request", "Add a reason so your manager can review it.");
      return;
    }

    setSaving(true);
    try {
      await createLeaveRequest({ fromDate, toDate, reason: reason.trim() });
      setComposing(false);
      setReason("");
      await load();
    } catch (err) {
      Alert.alert("Leave request", toErrorMessage(err, "Could not submit that request"));
    } finally {
      setSaving(false);
    }
  }, [fromDate, toDate, reason, load]);

  return (
    <>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {balance ? (
          <AppCard style={styles.card}>
            <Text style={styles.cardTitle}>Balance</Text>
            <View style={styles.metricRow}>
              <Metric label="Available" value={String(balance.available)} />
              <Metric label="Used" value={String(balance.used)} />
              <Metric label="Pending" value={String(balance.pending)} />
              <Metric label="Accrued" value={String(balance.accrued)} />
            </View>
          </AppCard>
        ) : null}

        <AppButton
          title="Request leave"
          onPress={() => setComposing(true)}
          fullWidth
          style={styles.cta}
        />

        <Text style={styles.heading}>My requests</Text>

        {requests.length === 0 ? (
          <AppEmptyState title="No leave requests" description="Requests you submit will appear here." />
        ) : (
          requests.map((request, index) => (
            <AppCard key={request._id || index} style={styles.card}>
              <View style={styles.rowHead}>
                <Text style={styles.dates}>
                  {formatDate(request.fromDate)} → {formatDate(request.toDate)}
                </Text>
                <AppBadge variant={statusVariant(request.status)}>
                  {String(request.status || "PENDING")}
                </AppBadge>
              </View>
              {request.days ? <Text style={styles.meta}>{request.days} day(s)</Text> : null}
              {request.reason ? <Text style={styles.reason}>{request.reason}</Text> : null}
              {request.reviewNote ? (
                <Text style={styles.reviewNote}>Manager: {request.reviewNote}</Text>
              ) : null}
            </AppCard>
          ))
        )}
      </ScrollView>

      <AppSheet
        visible={composing}
        onClose={() => setComposing(false)}
        title="Request leave"
        subtitle="Your manager reviews this before it counts against your balance."
        footer={
          <View style={styles.sheetActions}>
            <AppButton
              title="Cancel"
              variant="secondary"
              onPress={() => setComposing(false)}
              disabled={saving}
              style={styles.sheetButton}
            />
            <AppButton title="Submit" onPress={submit} loading={saving} style={styles.sheetButton} />
          </View>
        }
      >
        {/*
         * Typed dates rather than a picker: @react-native-community/datetimepicker
         * is already a dependency but renders very differently across Android
         * versions, and a range needs two of them. A validated YYYY-MM-DD field
         * is predictable now; a proper range picker is a Phase 8 polish item.
         */}
        <AppInput label="From" value={fromDate} onChangeText={setFromDate} placeholder="YYYY-MM-DD" autoCapitalize="none" />
        <AppInput label="To" value={toDate} onChangeText={setToDate} placeholder="YYYY-MM-DD" autoCapitalize="none" />
        <AppInput
          label="Reason"
          value={reason}
          onChangeText={setReason}
          placeholder="Why are you taking leave?"
          multiline
        />
      </AppSheet>
    </>
  );
};

const styles = themedStyles((c) => StyleSheet.create({
  body: { paddingBottom: spacing.xxl },
  card: { marginBottom: spacing.md },
  cta: { marginBottom: spacing.xl },
  cardTitle: {
    fontSize: typography.cardTitle,
    fontWeight: "600",
    color: themePalette.slate[900],
    marginBottom: spacing.lg,
  },
  heading: {
    fontSize: typography.caption,
    fontWeight: "700",
    color: themePalette.slate[500],
    letterSpacing: 0.8,
    marginBottom: spacing.md,
  },
  metricRow: { flexDirection: "row" },
  metric: { flex: 1, alignItems: "center" },
  metricValue: { fontSize: typography.title, fontWeight: "700", color: themePalette.slate[900] },
  metricLabel: {
    marginTop: 2,
    fontSize: typography.caption,
    color: themePalette.slate[500],
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  rowHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  dates: { flex: 1, fontSize: typography.body, fontWeight: "600", color: themePalette.slate[900] },
  meta: { marginTop: 4, fontSize: typography.label, color: themePalette.slate[500] },
  reason: { marginTop: spacing.md, fontSize: typography.body, color: themePalette.slate[600] },
  reviewNote: { marginTop: spacing.md, fontSize: typography.label, color: themePalette.slate[500], fontStyle: "italic" },
  error: { marginBottom: spacing.lg, fontSize: typography.label, color: themePalette.rose[700] },
  sheetActions: { flexDirection: "row", gap: spacing.md },
  sheetButton: { flex: 1 },
}));
