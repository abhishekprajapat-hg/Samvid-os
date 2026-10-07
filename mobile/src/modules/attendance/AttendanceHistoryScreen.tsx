import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Icon } from "../../components/ui/Icon";
import { Screen } from "../../components/common/Screen";
import { AppSheet } from "../../components/ui";
import { radii, spacing, typography } from "../../theme/tokens";
import { themedStyles, themePalette } from "../../theme/themedStyles";
import { toErrorMessage } from "../../utils/errorMessage";
import {
  getDailyAttendanceForAdmin,
  manageUserBreak,
  updateUserAttendanceStatus,
} from "../../services/attendanceService";
import {
  SetStatusSheet,
  STATUS_CHOICES,
  TeamRow,
  dayKeyOf,
  liveStatusOf,
  type RosterRow,
} from "./attendanceShared";

/*
 * Comp 2: the roster on its own page, with the day and the status filter
 * promoted out of the card header and up to the top of the screen.
 *
 * Same endpoint and same row as the hub - this is the hub's list given room
 * to breathe and a date you can move, not a second implementation of it.
 */

const STATUS_FILTERS = [
  { id: "", label: "All Statuses" },
  { id: "WORKING", label: "Working" },
  { id: "BREAK", label: "On Break" },
  { id: "PRESENT", label: "Present" },
  { id: "LATE", label: "Late" },
  { id: "ABSENT", label: "Absent" },
  { id: "LEAVE", label: "Leave" },
];

export const AttendanceHistoryScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  const [date, setDate] = useState<string>(route.params?.date || dayKeyOf(new Date()));
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [sheet, setSheet] = useState<"filter" | null>(null);
  const [picker, setPicker] = useState(false);
  const [statusRow, setStatusRow] = useState<RosterRow | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(
    async (quiet = false) => {
      try {
        if (quiet) setRefreshing(true);
        else setLoading(true);
        setError("");
        const daily = await getDailyAttendanceForAdmin({ date });
        setRoster((daily.attendance || []) as RosterRow[]);
      } catch (err) {
        setError(toErrorMessage(err, "Could not load attendance history"));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [date],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    const rows = statusFilter ? roster.filter((row) => liveStatusOf(row) === statusFilter) : roster;
    return [...rows].sort((a, b) => String(a.user?.name || "").localeCompare(String(b.user?.name || "")));
  }, [roster, statusFilter]);

  const selectedDate = useMemo(() => new Date(`${date}T12:00:00`), [date]);
  const filterLabel = STATUS_FILTERS.find((row) => row.id === statusFilter)?.label || "All Statuses";

  const applyStatus = async (choiceId: string, note: string, effectiveTime: string, breakType = "UTILITY") => {
    const userId = String(statusRow?.user?._id || "");
    const choice = STATUS_CHOICES.find((option) => option.id === choiceId);
    if (!userId || !choice) return;
    setSaving(true);
    try {
      if (choice.kind === "live") {
        await manageUserBreak(
          userId,
          choiceId === "BREAK" ? { action: "START", breakType } : { action: "END" },
        );
      } else {
        const composed = [effectiveTime.trim() ? `Effective ${effectiveTime.trim()}` : "", note.trim()]
          .filter(Boolean)
          .join(" — ");
        await updateUserAttendanceStatus(userId, date, { status: choiceId, note: composed });
      }
      setStatusRow(null);
      await load(true);
    } catch (err) {
      setError(toErrorMessage(err, "Could not update the status"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen
      title="Attendance History"
      description="Daily check-in, work-hour tracking and team attendance visibility"
      loading={loading}
      error={error}
      onRetry={() => load()}
      back={() => navigation.goBack()}
    >
      <ScrollView
        contentContainerStyle={styles.page}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
      >
        <View style={styles.controls}>
          <Pressable style={styles.control} onPress={() => setPicker(true)} accessibilityRole="button">
            <Icon name="calendarDays" size={17} color={themePalette.blue[600]} />
            <Text style={styles.controlText} numberOfLines={1}>
              {selectedDate.toLocaleDateString("en-IN", {
                weekday: "short",
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </Text>
            <Icon name="chevron-down" size={15} color={themePalette.slate[500]} />
          </Pressable>

          <Pressable style={styles.control} onPress={() => setSheet("filter")} accessibilityRole="button">
            <Icon name="funnel-outline" size={16} color={themePalette.slate[600]} />
            <Text style={styles.controlText} numberOfLines={1}>{filterLabel}</Text>
            <Icon name="chevron-down" size={15} color={themePalette.slate[500]} />
          </Pressable>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHead}>
            <View style={styles.cardIcon}>
              <Icon name="people" size={18} color={themePalette.blue[600]} />
            </View>
            <Text style={styles.cardTitle}>Team Attendance · {roster.length} users</Text>
            <View style={styles.spacer} />
            <Pressable style={styles.refresh} onPress={() => load(true)} accessibilityRole="button">
              <Icon name="refresh" size={15} color={themePalette.slate[700]} />
              <Text style={styles.refreshText}>Refresh</Text>
            </Pressable>
          </View>

          {visible.length === 0 ? (
            <Text style={styles.empty}>No attendance rows for this day.</Text>
          ) : (
            visible.map((row) => (
              <TeamRow
                key={String(row.user?._id || row._id)}
                row={row}
                onPress={() =>
                  navigation.navigate("AttendanceDetails", { userId: String(row.user?._id || ""), date })
                }
                onMenu={() =>
                  navigation.navigate("AttendanceDetails", { userId: String(row.user?._id || ""), date })
                }
                onAction={() => setStatusRow(row)}
              />
            ))
          )}
        </View>
      </ScrollView>

      {picker ? (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display="default"
          onChange={(_, next) => {
            setPicker(false);
            if (next) setDate(dayKeyOf(next));
          }}
        />
      ) : null}

      <AppSheet visible={sheet === "filter"} onClose={() => setSheet(null)} title="Filter by status">
        {STATUS_FILTERS.map((option) => (
          <Pressable
            key={option.id || "all"}
            style={styles.option}
            onPress={() => {
              setStatusFilter(option.id);
              setSheet(null);
            }}
            accessibilityRole="button"
          >
            <Text style={[styles.optionText, option.id === statusFilter && styles.optionTextActive]}>
              {option.label}
            </Text>
            {option.id === statusFilter ? (
              <Icon name="checkmark" size={16} color={themePalette.blue[600]} />
            ) : null}
          </Pressable>
        ))}
      </AppSheet>

      <SetStatusSheet
        visible={!!statusRow}
        row={statusRow}
        saving={saving}
        onClose={() => setStatusRow(null)}
        onSubmit={applyStatus}
      />
    </Screen>
  );
};

const styles = themedStyles((c) => StyleSheet.create({
  page: { gap: spacing.lg, paddingBottom: 96 },
  controls: { flexDirection: "row", gap: spacing.md },
  control: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    height: 52,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  controlText: { flex: 1, fontSize: typography.label, fontWeight: "600", color: c.text },

  card: {
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radii.lg,
    backgroundColor: c.surface,
    overflow: "hidden",
  },
  cardHead: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg },
  cardIcon: {
    width: 38,
    height: 38,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.blue[50],
  },
  cardTitle: { fontSize: typography.title, fontWeight: "700", color: c.text, flexShrink: 1 },
  spacer: { flex: 1 },
  refresh: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    height: 36,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.border,
  },
  refreshText: { fontSize: typography.label, fontWeight: "600", color: c.text },

  empty: { padding: spacing.xxl, textAlign: "center", fontSize: typography.label, color: c.slate[400] },

  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  optionText: { fontSize: typography.body, color: c.slate[700] },
  optionTextActive: { fontWeight: "700", color: c.blue[600] },
}));

export default AttendanceHistoryScreen;
