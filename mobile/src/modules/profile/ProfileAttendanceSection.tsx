import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { AppButton, AppCard } from "../../components/common/ui";
import { AppSheet } from "../../components/ui/Overlay";
import { Icon } from "../../components/ui/Icon";
import {
  createLeaveRequest,
  getMyAttendance,
  getMyLeaveBalance,
  getMyLeaveRequests,
  type AttendanceRecord,
  type LeaveBalance,
  type LeaveRequest,
} from "../../services/attendanceService";
import { toErrorMessage } from "../../utils/errorMessage";
import { themedStyles, themeColor, themePalette } from "../../theme/themedStyles";

/*
 * The attendance half of web's UserProfile: a month calendar of my own days,
 * the month's totals, my leave balance and the monthly accrual rule, and
 * applying for leave by picking days on the calendar - tap one day, then
 * another to make it a range, exactly as web's calendar works.
 *
 * An admin has no leave to apply for (web hides the balance and disables the
 * day buttons for that role), so neither is offered.
 */

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const LEAVE_TYPES = [
  { value: "CASUAL", label: "Casual" },
  { value: "SICK", label: "Sick" },
  { value: "EMERGENCY", label: "Emergency" },
  { value: "UNPAID", label: "Unpaid" },
  { value: "OTHER", label: "Other" },
];

const pad = (value: number) => String(value).padStart(2, "0");
const toMonthKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
const shiftMonth = (monthKey: string, delta: number) => {
  const [year, month] = monthKey.split("-").map(Number);
  return toMonthKey(new Date(year, month - 1 + delta, 1));
};
const monthLabel = (monthKey: string) => {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
};

export const buildMonthCalendarDays = (monthKey: string) => {
  const [year, month] = monthKey.split("-").map((value) => Number.parseInt(value, 10));
  if (!Number.isFinite(year) || !Number.isFinite(month)) return [];
  const leadingEmpty = new Date(year, month - 1, 1).getDay();
  const lastDay = new Date(year, month, 0).getDate();
  const days: Array<{ key: string; dateKey: string; day: number | "" }> = [];
  for (let index = 0; index < leadingEmpty; index += 1) days.push({ key: `empty-${index}`, dateKey: "", day: "" });
  for (let day = 1; day <= lastDay; day += 1) {
    const dateKey = `${monthKey}-${pad(day)}`;
    days.push({ key: dateKey, dateKey, day });
  }
  return days;
};

export const buildDateKeysInRange = (fromDate: string, toDate: string) => {
  if (!fromDate || !toDate) return [];
  const [fy, fm, fd] = fromDate.split("-").map(Number);
  const [ty, tm, td] = toDate.split("-").map(Number);
  const fromMs = Date.UTC(fy, fm - 1, fd);
  const toMs = Date.UTC(ty, tm - 1, td);
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || toMs < fromMs) return [];
  const rows: string[] = [];
  for (let cursor = fromMs; cursor <= toMs; cursor += 86400000) {
    const date = new Date(cursor);
    rows.push(`${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`);
  }
  return rows;
};

const formatDuration = (minutes?: number | null) => {
  const safe = Math.max(0, Number(minutes || 0));
  return `${Math.floor(safe / 60)}h ${safe % 60}m`;
};

const formatTime = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
};

const statusLabel = (status?: string) => {
  const normalized = String(status || "").trim().toUpperCase();
  if (normalized === "PRESENT") return "Present";
  if (normalized === "WORKING") return "Working";
  if (normalized === "BREAK") return "Break";
  return normalized.replace(/_/g, " ");
};

const toneFor = (status?: string) => {
  const normalized = String(status || "").trim().toUpperCase();
  if (["PRESENT", "WORKING"].includes(normalized)) return { bg: themePalette.emerald[50], ink: themePalette.emerald[800] };
  if (normalized === "BREAK") return { bg: themePalette.blue[50], ink: themePalette.blue[800] };
  if (normalized === "HALF_DAY") return { bg: themePalette.blue[50], ink: themePalette.blue[800] };
  if (normalized === "ABSENT") return { bg: themePalette.rose[50], ink: themePalette.rose[800] };
  if (normalized === "LEAVE") return { bg: themePalette.emerald[50], ink: themePalette.emerald[700] };
  return { bg: themePalette.amber[50], ink: themePalette.amber[800] };
};

export const ProfileAttendanceSection = ({ role, onMessage }: { role?: string; onMessage: (text: string, error?: boolean) => void }) => {
  const isAdmin = String(role || "").toUpperCase() === "ADMIN";
  const [month, setMonth] = useState(() => toMonthKey(new Date()));
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [balance, setBalance] = useState<LeaveBalance | null>(null);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [range, setRange] = useState({ fromDate: "", toDate: "" });
  const [sheetOpen, setSheetOpen] = useState(false);
  const [leaveType, setLeaveType] = useState("CASUAL");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [attendance, leaveBalance, requests] = await Promise.all([
        getMyAttendance({ month }),
        isAdmin ? Promise.resolve(null) : getMyLeaveBalance({ month }).catch(() => null),
        isAdmin ? Promise.resolve([]) : getMyLeaveRequests().catch(() => []),
      ]);
      setRecords(attendance.attendance || []);
      setSummary(attendance.summary || {});
      setBalance(leaveBalance);
      setLeaveRequests(Array.isArray(requests) ? requests : []);
    } catch (error) {
      onMessage(toErrorMessage(error, "Failed to load attendance calendar"), true);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, month, onMessage]);

  useEffect(() => {
    void load();
  }, [load]);

  const byDate = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    records.forEach((row: any) => {
      const key = String(row?.attendanceDate || row?.date || "").slice(0, 10);
      if (key) map.set(key, row);
    });
    return map;
  }, [records]);

  const pendingLeaveByDate = useMemo(() => {
    const map = new Map<string, LeaveRequest>();
    leaveRequests
      .filter((row: any) => String(row?.status || "").toUpperCase() === "PENDING")
      .forEach((row: any) => {
        buildDateKeysInRange(String(row.fromDate || "").slice(0, 10), String(row.toDate || "").slice(0, 10)).forEach(
          (key) => map.set(key, row),
        );
      });
    return map;
  }, [leaveRequests]);

  const selected = useMemo(() => new Set(buildDateKeysInRange(range.fromDate, range.toDate)), [range]);
  const days = useMemo(() => buildMonthCalendarDays(month), [month]);

  const onDay = (dateKey: string) => {
    if (!dateKey || isAdmin) return;
    setRange((prev) => {
      if (!sheetOpen || !prev.fromDate) return { fromDate: dateKey, toDate: dateKey };
      return dateKey < prev.fromDate ? { fromDate: dateKey, toDate: prev.fromDate } : { fromDate: prev.fromDate, toDate: dateKey };
    });
    setSheetOpen(true);
  };

  const closeSheet = () => {
    setSheetOpen(false);
    setRange({ fromDate: "", toDate: "" });
    setLeaveType("CASUAL");
    setReason("");
  };

  const submit = async () => {
    const fromDate = range.fromDate.trim();
    const toDate = (range.toDate || fromDate).trim();
    if (!fromDate || !toDate) return onMessage("Please select leave dates.", true);
    if (!reason.trim()) return onMessage("Reason is required.", true);
    setSubmitting(true);
    try {
      const result = await createLeaveRequest({ fromDate, toDate, leaveType, reason: reason.trim() });
      onMessage(result.message || "Leave request created");
      closeSheet();
      await load();
    } catch (error) {
      onMessage(toErrorMessage(error, "Failed to submit leave request"), true);
    } finally {
      setSubmitting(false);
    }
  };

  const summaryCards = [
    { key: "present", label: "Present", value: summary.presentDays ?? 0, tone: toneFor("PRESENT") },
    { key: "half", label: "Half Day", value: summary.halfDays ?? 0, tone: toneFor("HALF_DAY") },
    { key: "leave", label: "Leave", value: summary.leaveDays ?? 0, tone: toneFor("LEAVE") },
    { key: "absent", label: "Absent", value: summary.absentDays ?? 0, tone: toneFor("ABSENT") },
  ];

  return (
    <AppCard style={styles.card as object}>
      <View style={styles.head}>
        <View style={styles.headText}>
          <Text style={styles.title}>Attendance Calendar</Text>
          <Text style={styles.subtitle}>{isAdmin ? "Your month at a glance" : "Tap a day to apply for leave; tap a second day for a range"}</Text>
        </View>
        {loading ? <ActivityIndicator size="small" color={themeColor("#2549d6")} /> : null}
      </View>

      <View style={styles.monthRow}>
        <Pressable onPress={() => setMonth((value) => shiftMonth(value, -1))} style={styles.monthBtn} accessibilityLabel="Previous month">
          <Icon name="chevron-back" size={16} color={themeColor("#39424f")} />
        </Pressable>
        <Text style={styles.monthText}>{monthLabel(month)}</Text>
        <Pressable onPress={() => setMonth((value) => shiftMonth(value, 1))} style={styles.monthBtn} accessibilityLabel="Next month">
          <Icon name="chevron-forward" size={16} color={themeColor("#39424f")} />
        </Pressable>
        <AppButton title="Refresh" variant="ghost" onPress={() => void load()} disabled={loading} />
      </View>

      {!isAdmin ? (
        <View style={styles.balance}>
          <View>
            <Text style={styles.balanceValue}>{balance ? balance.available : "-"}</Text>
            <Text style={styles.balanceLabel}>Total leaves available</Text>
          </View>
          <View style={styles.balanceRule}>
            <Text style={styles.ruleTitle}>Monthly Leave Rule</Text>
            <Text style={styles.ruleText}>Every month on 1st date, 1 leave is added. Unused leave carries forward.</Text>
            <Text style={styles.ruleMeta}>
              Since {balance?.accrualStartMonth || "-"} | {Number(balance?.monthlyAccrual || 1)} leave/month
            </Text>
          </View>
        </View>
      ) : null}

      <View style={styles.summaryRow}>
        {summaryCards.map((card) => (
          <View key={card.key} style={[styles.summaryTile, { backgroundColor: card.tone.bg }]}>
            <Text style={[styles.summaryValue, { color: card.tone.ink }]}>{card.value}</Text>
            <Text style={[styles.summaryLabel, { color: card.tone.ink }]}>{card.label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.weekRow}>
        {WEEKDAY_LABELS.map((label) => (
          <Text key={label} style={styles.weekLabel}>{label}</Text>
        ))}
      </View>
      <View style={styles.grid}>
        {days.map((day) => {
          const row = day.dateKey ? byDate.get(day.dateKey) : null;
          const pending = day.dateKey ? pendingLeaveByDate.get(day.dateKey) : null;
          const tone = pending ? toneFor("PENDING") : row ? toneFor(row.status) : null;
          const isSelected = day.dateKey ? selected.has(day.dateKey) : false;
          return (
            <Pressable
              key={day.key}
              onPress={() => onDay(day.dateKey)}
              disabled={!day.dateKey || isAdmin}
              style={[styles.cell, !day.dateKey && styles.cellEmpty, isSelected && styles.cellSelected]}
              accessibilityRole="button"
              accessibilityLabel={day.dateKey ? `${day.dateKey}${row ? `, ${statusLabel(row.status)}` : ""}` : undefined}
            >
              {day.dateKey ? (
                <>
                  <Text style={styles.cellDay}>{day.day}</Text>
                  {tone ? (
                    <Text style={[styles.cellStatus, { backgroundColor: tone.bg, color: tone.ink }]} numberOfLines={1}>
                      {pending ? "Pending" : statusLabel(row?.status)}
                    </Text>
                  ) : null}
                  {row && !pending ? (
                    <Text style={styles.cellMeta} numberOfLines={1}>{formatTime(row.checkInAt)}</Text>
                  ) : null}
                  {row && !pending && row.workedMinutes ? (
                    <Text style={styles.cellMeta} numberOfLines={1}>{formatDuration(row.workedMinutes)}</Text>
                  ) : null}
                </>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      <AppSheet
        visible={sheetOpen && !isAdmin}
        onClose={closeSheet}
        title="Apply Leave"
        subtitle="Select another calendar date to extend the range."
        footer={
          <AppButton title={submitting ? "Submitting..." : "Submit Leave Request"} onPress={submit} disabled={submitting} />
        }
      >
        <View style={styles.rangeRow}>
          <View style={styles.rangeCol}>
            <Text style={styles.fieldLabel}>From</Text>
            <TextInput
              style={styles.input}
              value={range.fromDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={themeColor("#98a3b5")}
              onChangeText={(value) =>
                setRange((prev) => ({ fromDate: value, toDate: prev.toDate && prev.toDate >= value ? prev.toDate : value }))
              }
            />
          </View>
          <View style={styles.rangeCol}>
            <Text style={styles.fieldLabel}>To</Text>
            <TextInput
              style={styles.input}
              value={range.toDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={themeColor("#98a3b5")}
              onChangeText={(value) =>
                setRange((prev) => ({ fromDate: prev.fromDate && prev.fromDate <= value ? prev.fromDate : value, toDate: value }))
              }
            />
          </View>
        </View>
        <Text style={styles.fieldLabel}>Leave Type</Text>
        <View style={styles.typeRow}>
          {LEAVE_TYPES.map((type) => (
            <Pressable
              key={type.value}
              onPress={() => setLeaveType(type.value)}
              style={[styles.typeChip, leaveType === type.value && styles.typeChipActive]}
            >
              <Text style={[styles.typeText, leaveType === type.value && styles.typeTextActive]}>{type.label}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.fieldLabel}>Reason</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          value={reason}
          onChangeText={setReason}
          placeholder="Reason for leave"
          placeholderTextColor={themeColor("#98a3b5")}
          multiline
          maxLength={500}
        />
      </AppSheet>
    </AppCard>
  );
};

const styles = themedStyles((c) =>
  StyleSheet.create({
    card: { marginBottom: 12, gap: 10 },
    head: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
    headText: { flex: 1 },
    title: { fontSize: 14, fontWeight: "700", color: c.text },
    subtitle: { marginTop: 2, fontSize: 12, color: c.textMuted },
    monthRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    monthBtn: {
      width: 32,
      height: 32,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: c.border,
    },
    monthText: { flex: 1, textAlign: "center", fontSize: 13, fontWeight: "700", color: c.text },
    balance: {
      flexDirection: "row",
      gap: 12,
      padding: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surfaceMuted,
    },
    balanceValue: { fontSize: 24, fontWeight: "800", color: c.text },
    balanceLabel: { fontSize: 11, color: c.textMuted },
    balanceRule: { flex: 1, gap: 2 },
    ruleTitle: { fontSize: 11, fontWeight: "700", color: c.slate[700] },
    ruleText: { fontSize: 11, lineHeight: 15, color: c.textMuted },
    ruleMeta: { fontSize: 10.5, color: c.slate[500] },
    summaryRow: { flexDirection: "row", gap: 6 },
    summaryTile: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 8 },
    summaryValue: { fontSize: 16, fontWeight: "800" },
    summaryLabel: { fontSize: 10.5, fontWeight: "600" },
    weekRow: { flexDirection: "row" },
    weekLabel: { flex: 1, textAlign: "center", fontSize: 10.5, fontWeight: "700", color: c.textMuted },
    grid: { flexDirection: "row", flexWrap: "wrap", borderTopWidth: 1, borderLeftWidth: 1, borderColor: c.border },
    cell: {
      width: `${100 / 7}%`,
      minHeight: 64,
      padding: 3,
      gap: 2,
      borderRightWidth: 1,
      borderBottomWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
    },
    cellEmpty: { backgroundColor: c.surfaceMuted },
    cellSelected: { borderWidth: 2, borderColor: c.blue[500] },
    cellDay: { fontSize: 11, fontWeight: "700", color: c.text },
    cellStatus: { fontSize: 8.5, fontWeight: "700", paddingHorizontal: 2, borderRadius: 4, overflow: "hidden" },
    cellMeta: { fontSize: 8.5, color: c.textMuted },
    rangeRow: { flexDirection: "row", gap: 10 },
    rangeCol: { flex: 1 },
    fieldLabel: { marginTop: 8, marginBottom: 5, fontSize: 12, fontWeight: "600", color: c.slate[700] },
    input: {
      height: 42,
      paddingHorizontal: 10,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 8,
      fontSize: 13,
      color: c.text,
      backgroundColor: c.surface,
    },
    textarea: { height: 90, paddingTop: 10, textAlignVertical: "top" },
    typeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    typeChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: c.border },
    typeChipActive: { borderColor: c.blue[600], backgroundColor: c.blue[50] },
    typeText: { fontSize: 12, fontWeight: "600", color: c.slate[700] },
    typeTextActive: { color: c.blue[700] },
  }),
);
