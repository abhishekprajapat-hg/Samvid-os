import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Icon } from "../../components/ui/Icon";
import { Screen } from "../../components/common/Screen";
import { AppSegmentedTabs, AppSheet } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { usePermissions } from "../../context/PermissionContext";
import { radii, spacing, typography } from "../../theme/tokens";
import { themedStyles, themePalette } from "../../theme/themedStyles";
import { toErrorMessage } from "../../utils/errorMessage";
import {
  getDailyAttendanceForAdmin,
  manageUserBreak,
  updateUserAttendanceStatus,
} from "../../services/attendanceService";
import { MyDaySection } from "./components/MyDaySection";
import { LeaveSection } from "./components/LeaveSection";
import {
  SetStatusSheet,
  StatPairGrid,
  TeamRow,
  dayKeyOf,
  liveStatusOf,
  STATUS_CHOICES,
  type AttendanceStat,
  type RosterRow,
} from "./attendanceShared";

/*
 * The Attendance hub.
 *
 * The comps draw this as management's screen - team counts, today's roster,
 * everyone's status. That is only half the module: most people open Attendance
 * to mark their own day, and non-managers cannot call the roster endpoint at
 * all (it runs through ensureManageAttendanceRole and 403s). So the "Admin
 * view" pill the comp puts in the header is a real toggle between the two, and
 * anyone without the grant only ever sees their own day, with no pill.
 */

const MANAGE_ROLES = new Set(["ADMIN", "MANAGER"]);

const STATUS_FILTERS = [
  { id: "", label: "All Statuses" },
  { id: "WORKING", label: "Working" },
  { id: "BREAK", label: "On Break" },
  { id: "PRESENT", label: "Present" },
  { id: "LATE", label: "Late" },
  { id: "ABSENT", label: "Absent" },
  { id: "LEAVE", label: "Leave" },
];

export const AttendanceScreen = () => {
  const navigation = useNavigation<any>();
  const { role } = useAuth();
  const { canPageAction } = usePermissions();
  const canManage = Boolean(role && MANAGE_ROLES.has(role) && canPageAction("attendance", "approve"));

  const [adminView, setAdminView] = useState(canManage);
  const [date, setDate] = useState(() => dayKeyOf(new Date()));
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(canManage);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [statusRow, setStatusRow] = useState<RosterRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [sheet, setSheet] = useState<"filter" | "more" | null>(null);
  /*
   * The comps only draw management's view, but requesting leave and seeing
   * your own balance live in this module too and are the only route to them
   * on a phone. They stay, as the personal side of the same screen.
   */
  const [personalTab, setPersonalTab] = useState<"day" | "leave">("day");

  /* A grant revoked mid-session must not leave someone on a view that 403s. */
  useEffect(() => {
    if (!canManage && adminView) setAdminView(false);
  }, [canManage, adminView]);

  const load = useCallback(
    async (quiet = false) => {
      if (!canManage) {
        setLoading(false);
        return;
      }
      try {
        if (quiet) setRefreshing(true);
        else setLoading(true);
        setError("");
        const daily = await getDailyAttendanceForAdmin({ date });
        setRoster((daily.attendance || []) as RosterRow[]);
      } catch (err) {
        setError(toErrorMessage(err, "Could not load the team roster"));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [canManage, date],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      if (canManage) void load(true);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [canManage, date]),
  );

  /* ------------------------------------------------------------- derived -- */

  const stats: AttendanceStat[] = useMemo(() => {
    const c = themePalette;
    const total = roster.length;
    const live = roster.map(liveStatusOf);
    const present = live.filter((s) => s === "WORKING" || s === "PRESENT" || s === "BREAK" || s === "LATE").length;
    const late = live.filter((s) => s === "LATE").length;
    const onBreak = live.filter((s) => s === "BREAK").length;
    const leave = live.filter((s) => s === "LEAVE").length;
    const absent = live.filter((s) => s === "ABSENT" || s === "PENDING").length;
    const worked = roster.reduce((sum, row) => sum + Number(row.workedMinutes || 0), 0);
    const average = total ? worked / total / 60 : 0;

    return [
      {
        label: "Present",
        value: String(present),
        helper: `of ${total} users`,
        icon: "people",
        tint: c.emerald[50],
        color: c.emerald[600],
      },
      {
        label: "Late",
        value: String(late),
        helper: onBreak ? `${onBreak} on break now` : "On break now",
        icon: "time-outline",
        tint: c.amber[50],
        color: c.amber[600],
      },
      {
        label: "Leave taken",
        value: String(leave),
        helper: `${absent} absent today`,
        icon: "calendarDays",
        tint: c.rose[50],
        color: c.rose[600],
      },
      {
        label: "Avg. hours",
        value: average.toFixed(1),
        helper: "Visible team rows",
        icon: "barChart",
        tint: c.violet[50],
        color: c.violet[600],
      },
    ];
  }, [roster]);

  const visibleRoster = useMemo(() => {
    const rows = statusFilter
      ? roster.filter((row) => liveStatusOf(row) === statusFilter)
      : roster;
    return [...rows].sort((a, b) =>
      String(a.user?.name || "").localeCompare(String(b.user?.name || "")),
    );
  }, [roster, statusFilter]);

  const selectedDate = useMemo(() => new Date(`${date}T12:00:00`), [date]);
  const filterLabel = STATUS_FILTERS.find((row) => row.id === statusFilter)?.label || "All Statuses";

  /* ------------------------------------------------------------- actions -- */

  const applyStatus = async (choiceId: string, note: string, effectiveTime: string) => {
    const row = statusRow;
    const userId = String(row?.user?._id || "");
    if (!row || !userId) return;

    const choice = STATUS_CHOICES.find((option) => option.id === choiceId);
    if (!choice) return;

    setSaving(true);
    try {
      if (choice.kind === "live") {
        await manageUserBreak(userId, { action: choiceId === "BREAK" ? "START" : "END" });
      } else {
        /*
         * The status endpoint takes `status` and `note` only - there is no
         * effective-time field - so the time rides along in the note rather
         * than being silently discarded.
         */
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

  const openDetails = (row: RosterRow) =>
    navigation.navigate("AttendanceDetails", {
      userId: String(row.user?._id || ""),
      date,
    });

  /* -------------------------------------------------------------- render -- */

  if (!adminView) {
    return (
      <Screen
        title="Attendance"
        description="Daily check-in, work-hour tracking and team attendance visibility"
        right={
          canManage ? (
            <Pressable style={styles.viewPill} onPress={() => setAdminView(true)} accessibilityRole="button">
              <Icon name="people" size={15} color={themePalette.violet[600]} />
              <Text style={styles.viewPillText}>Admin view</Text>
            </Pressable>
          ) : undefined
        }
      >
        <AppSegmentedTabs
          tabs={[
            { key: "day", label: "My day" },
            { key: "leave", label: "Leave" },
          ]}
          activeKey={personalTab}
          onChange={(key) => setPersonalTab(key as "day" | "leave")}
          style={styles.personalTabs}
        />
        {personalTab === "day" ? <MyDaySection /> : <LeaveSection />}
      </Screen>
    );
  }

  return (
    <Screen
      title="Attendance"
      description="Daily check-in, work-hour tracking and team attendance visibility"
      loading={loading}
      error={error}
      onRetry={() => load()}
      right={
        <Pressable style={styles.viewPill} onPress={() => setAdminView(false)} accessibilityRole="button">
          <Icon name="people" size={15} color={themePalette.violet[600]} />
          <Text style={styles.viewPillText}>Admin view</Text>
        </Pressable>
      }
    >
      <ScrollView
        contentContainerStyle={styles.page}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
      >
        <StatPairGrid stats={stats} />

        <View style={styles.todayCard}>
          <View style={styles.todayIcon}>
            <Icon name="calendarDays" size={20} color={themePalette.blue[600]} />
          </View>
          <View style={styles.todayCopy}>
            <Text style={styles.todayEyebrow}>
              Today · {new Date().toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
            </Text>
            <Text style={styles.todayTitle}>
              {selectedDate.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
            </Text>
            <View style={styles.todayMetaRow}>
              <Icon name="people" size={13} color={themePalette.slate[500]} />
              <Text style={styles.todayMeta}>Team attendance · {roster.length} users</Text>
            </View>
          </View>
          <View style={styles.todayRight}>
            <View style={styles.livePill}>
              <View style={styles.liveDot} />
              <Text style={styles.livePillText}>Admin view</Text>
            </View>
            <Pressable
              style={styles.dateButton}
              onPress={() => navigation.navigate("AttendanceHistory", { date })}
              accessibilityRole="button"
              accessibilityLabel="Open attendance history"
            >
              <Icon name="calendarDays" size={16} color={themePalette.slate[700]} />
              <Icon name="chevron-down" size={14} color={themePalette.slate[500]} />
            </Pressable>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHead}>
            <View style={styles.cardIcon}>
              <Icon name="calendarDays" size={18} color={themePalette.blue[600]} />
            </View>
            <View style={styles.cardHeadCopy}>
              <Text style={styles.cardTitle}>Team Daily Attendance History</Text>
              <Text style={styles.cardSubtitle}>Check-in, hours and status for your team</Text>
            </View>
            <View style={styles.cardHeadControls}>
              <Pressable
                style={styles.control}
                onPress={() => navigation.navigate("AttendanceHistory", { date })}
                accessibilityRole="button"
              >
                <Text style={styles.controlText}>
                  {selectedDate.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).replaceAll("/", "/")}
                </Text>
                <Icon name="calendarDays" size={14} color={themePalette.slate[600]} />
              </Pressable>
              <Pressable
                style={styles.control}
                onPress={() => setSheet("filter")}
                accessibilityRole="button"
              >
                <Text style={styles.controlText} numberOfLines={1}>{filterLabel}</Text>
                <Icon name="chevron-down" size={14} color={themePalette.slate[600]} />
              </Pressable>
            </View>
          </View>

          {visibleRoster.length === 0 ? (
            <Text style={styles.empty}>No attendance rows for this day.</Text>
          ) : (
            visibleRoster.map((row) => (
              <TeamRow
                key={String(row.user?._id || row._id)}
                row={row}
                onPress={() => openDetails(row)}
                onMenu={() => openDetails(row)}
                onAction={() => setStatusRow(row)}
              />
            ))
          )}
        </View>
      </ScrollView>

      <Pressable
        style={styles.fab}
        onPress={() => setSheet("more")}
        accessibilityRole="button"
        accessibilityLabel="Attendance management"
      >
        <Icon name="add" size={26} color="#ffffff" />
      </Pressable>

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

      <AppSheet
        visible={sheet === "more"}
        onClose={() => setSheet(null)}
        title="Attendance management"
      >
        {[
          { id: "AttendanceHistory", label: "Attendance history", icon: "calendarDays" },
          { id: "AttendanceApprovals", label: "Approvals", icon: "checkmark-circle-outline" },
          { id: "AttendanceViolations", label: "Monthly violations", icon: "alert-circle-outline" },
          { id: "AttendancePolicy", label: "Policy & geofence", icon: "location-outline" },
        ].map((entry) => (
          <Pressable
            key={entry.id}
            style={styles.option}
            onPress={() => {
              setSheet(null);
              navigation.navigate(entry.id, { date });
            }}
            accessibilityRole="button"
          >
            <View style={styles.optionLead}>
              <Icon name={entry.icon} size={17} color={themePalette.slate[600]} />
              <Text style={styles.optionText}>{entry.label}</Text>
            </View>
            <Icon name="chevron-forward" size={16} color={themePalette.slate[400]} />
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
  personalTabs: { marginBottom: spacing.lg },

  viewPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    height: 38,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    backgroundColor: c.violet[50],
  },
  viewPillText: { fontSize: typography.label, fontWeight: "700", color: c.violet[600] },

  todayCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radii.lg,
    backgroundColor: c.surface,
  },
  todayIcon: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.blue[50],
  },
  todayCopy: { flex: 1, minWidth: 0 },
  todayEyebrow: { fontSize: typography.label, color: c.slate[600] },
  todayTitle: { marginTop: 1, fontSize: 22, fontWeight: "800", color: c.text, letterSpacing: -0.4 },
  todayMetaRow: { marginTop: 3, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  todayMeta: { fontSize: typography.label, color: c.slate[500] },
  todayRight: { alignItems: "flex-end", gap: spacing.md },
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: 5,
    borderRadius: radii.pill,
    backgroundColor: c.rose[50],
  },
  liveDot: { width: 7, height: 7, borderRadius: radii.pill, backgroundColor: c.rose[500] },
  livePillText: { fontSize: typography.label, fontWeight: "600", color: c.rose[600] },
  dateButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    height: 40,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },

  card: {
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radii.lg,
    backgroundColor: c.surface,
    overflow: "hidden",
  },
  cardHead: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md, padding: spacing.lg },
  cardIcon: {
    width: 38,
    height: 38,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.blue[50],
  },
  cardHeadCopy: { flex: 1, minWidth: 0 },
  cardTitle: { fontSize: typography.title, fontWeight: "700", color: c.text },
  cardSubtitle: { marginTop: 1, fontSize: typography.label, color: c.slate[500] },
  cardHeadControls: { gap: spacing.sm, alignItems: "flex-end" },
  control: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    height: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
    maxWidth: 148,
  },
  controlText: { fontSize: typography.label, fontWeight: "600", color: c.slate[700], flexShrink: 1 },

  empty: { padding: spacing.xxl, textAlign: "center", fontSize: typography.label, color: c.slate[400] },

  fab: {
    position: "absolute",
    right: spacing.xl,
    bottom: spacing.xl,
    width: 60,
    height: 60,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.blue[600],
    shadowColor: c.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 6,
  },

  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  optionLead: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  optionText: { fontSize: typography.body, color: c.slate[700] },
  optionTextActive: { fontWeight: "700", color: c.blue[600] },
}));

export default AttendanceScreen;
