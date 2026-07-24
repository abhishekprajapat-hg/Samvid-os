import React, { useEffect, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Screen } from "../../components/common/Screen";
import { AppCard } from "../../components/common/ui";
import api from "../../services/api";
import { toErrorMessage } from "../../utils/errorMessage";

const formatDateTime = (value?: string) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
};

const Field = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    <Text style={styles.value}>{value}</Text>
  </View>
);

export const AttendanceScreen = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [attendance, setAttendance] = useState<any>(null);
  const [leaveBalance, setLeaveBalance] = useState<any>(null);

  const load = async (silent = false) => {
    try {
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError("");
      const [attendanceRes, balanceRes] = await Promise.all([
        api.get("/attendance/me"),
        api.get("/attendance/leave-balance/my"),
      ]);
      setAttendance(attendanceRes.data?.attendance || attendanceRes.data || null);
      setLeaveBalance(balanceRes.data?.balance || balanceRes.data || null);
    } catch (err) {
      setError(toErrorMessage(err, "Failed to load attendance"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const today = Array.isArray(attendance?.records)
    ? attendance.records[0]
    : attendance?.today || attendance?.attendance || attendance;

  return (
    <Screen title="Attendance" subtitle="Today" loading={loading} error={error}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
      >
        <AppCard style={styles.card as object}>
          <Text style={styles.cardTitle}>Current Status</Text>
          <Field label="Status" value={String(today?.status || "Not marked")} />
          <Field label="Check In" value={formatDateTime(today?.checkInTime || today?.checkInAt)} />
          <Field label="Check Out" value={formatDateTime(today?.checkOutTime || today?.checkOutAt)} />
          <Field label="Working Minutes" value={String(today?.workingMinutes || today?.totalWorkingMinutes || 0)} />
        </AppCard>

        <AppCard style={styles.card as object}>
          <Text style={styles.cardTitle}>Leave Balance</Text>
          <Field label="Paid Leave" value={String(leaveBalance?.paidLeave || leaveBalance?.paid || 0)} />
          <Field label="Sick Leave" value={String(leaveBalance?.sickLeave || leaveBalance?.sick || 0)} />
          <Field label="Casual Leave" value={String(leaveBalance?.casualLeave || leaveBalance?.casual || 0)} />
        </AppCard>
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: 12,
  },
  cardTitle: {
    color: "#0f172a",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 10,
  },
  field: {
    minHeight: 42,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    justifyContent: "center",
  },
  label: {
    color: "#64748b",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  value: {
    marginTop: 3,
    color: "#0f172a",
    fontSize: 13,
    fontWeight: "600",
  },
});
