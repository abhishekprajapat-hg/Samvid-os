import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import Svg, { Circle } from "react-native-svg";
import { Glyph, type GlyphName } from "../../components/ui/Glyph";
import { AppSheet } from "../../components/ui/Overlay";
import { useAuth } from "../../context/AuthContext";
import { usePermissions } from "../../context/PermissionContext";
import { brand, brandStyles, layout, round, type as t } from "../../theme/brand";
import { toErrorMessage } from "../../utils/errorMessage";
import { getAttendanceLocation } from "../../utils/location";
import {
  checkInAttendance,
  checkOutAttendance,
  endBreakAttendance,
  getDailyAttendanceForAdmin,
  getMyAttendance,
  startBreakAttendance,
  type AttendancePolicy,
  type AttendanceRecord,
} from "../../services/attendanceService";
import { dayKeyOf, initialsOf, liveStatusOf, type RosterRow } from "./attendanceShared";
import { PhotoOverlay, profilePhotoOf } from "../../components/common/PhotoOverlay";

/*
 * Attendance, drawn to the comp.
 *
 * The comp puts my own day and the team's on one page, where this used to be
 * an "Admin view" toggle between two. The team card is only fetched when the
 * account can actually read the roster - /attendance/daily runs through
 * ensureManageAttendanceRole and 403s for everyone else - so a non-manager
 * simply does not see it.
 *
 * What the comp has no room for moved to pages of its own, reached from the
 * single icon button it draws in the header: my own recent days, leave, and the
 * three management pages. Managing someone else's day is still
 * AttendanceDetails, which each roster row's chevron opens.
 */

const MANAGE_ROLES = new Set(["ADMIN", "MANAGER"]);

const MONTHS = ["January", "February", "March", "April", "May", "June", "July",
  "August", "September", "October", "November", "December"];
const WEEKDAYS_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type MenuLink = { route: string; label: string; icon: GlyphName; manage?: boolean };

const MENU_LINKS: MenuLink[] = [
  { route: "MyAttendance", label: "My attendance", icon: "person-outline" },
  { route: "AttendanceLeave", label: "Leave & requests", icon: "airplane-outline" },
  { route: "AttendanceHistory", label: "Team roster by day", icon: "calendar-outline", manage: true },
  { route: "AttendanceApprovals", label: "Approvals", icon: "checkmark-circle-outline", manage: true },
  { route: "AttendanceViolations", label: "Monthly violations", icon: "alert-circle-outline", manage: true },
  { route: "AttendancePolicy", label: "Policy & geofence", icon: "location-outline", manage: true },
];

/** The comp writes "9:36 AM", and a missing time as an em dash. */
const clock = (value?: string | null): string => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date
    .toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true })
    .toUpperCase();
};

/** "06h 24m" inside the ring, "8h 12m" in a week cell. */
const duration = (minutes?: number | null, pad = false): string => {
  const total = Math.max(0, Math.round(Number(minutes || 0)));
  const hours = Math.floor(total / 60);
  return `${pad ? String(hours).padStart(2, "0") : hours}h ${String(total % 60).padStart(2, "0")}m`;
};

const startOfMondayWeek = (date: Date) => {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  result.setDate(result.getDate() - ((result.getDay() + 6) % 7));
  return result;
};

type Tone = { label: string; bg: string; fg: string; dot: string };

/*
 * Reads `brand` rather than closing over the stylesheet's tokens, because the
 * pill colours are inline styles and have to follow the scheme at render time.
 */
const toneOf = (status: string): Tone => {
  const b = brand;
  switch (status) {
    case "WORKING":
      return { label: "Working", bg: b.tint, fg: b.primary, dot: "#12a06a" };
    case "PRESENT":
      return { label: "Present", bg: b.tint, fg: b.primary, dot: "#12a06a" };
    case "BREAK":
      return { label: "On Break", bg: b.warnTint, fg: b.warnInk, dot: "#e8a92a" };
    case "LATE":
      return { label: "Late", bg: b.warnTint, fg: b.warnInk, dot: "#e8a92a" };
    case "HALF_DAY":
      return { label: "Half day", bg: b.warnTint, fg: b.warnInk, dot: "#e8a92a" };
    case "MISSED_CHECK_OUT":
      return { label: "No check out", bg: b.warnTint, fg: b.warnInk, dot: "#e8a92a" };
    case "LEAVE":
      return { label: "On Leave", bg: b.alertTint, fg: b.alertInk, dot: "#e8433e" };
    case "ABSENT":
      return { label: "Absent", bg: b.alertTint, fg: b.alertInk, dot: "#e8433e" };
    default:
      return { label: "Not started", bg: b.neutralBadge, fg: b.textSecondary, dot: b.placeholder };
  }
};

/* ------------------------------------------------------------- pieces -- */

/** 132pt across, an 8pt stroke, filled clockwise from twelve o'clock. */
const Ring = ({ minutes, target }: { minutes: number; target: number }) => {
  const size = 132;
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const share = Math.max(0, Math.min(1, target > 0 ? minutes / target : 0));

  return (
    <View style={styles.ringWrap}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={brand.tintSoft} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#039f78"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${circumference * share} ${circumference}`}
          fill="none"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={styles.ringCentre} pointerEvents="none">
        <Text style={styles.ringValue}>{duration(minutes, true)}</Text>
        <Text style={styles.ringCaption}>Working hours today</Text>
      </View>
    </View>
  );
};

const StampTile = ({ label, value, on }: { label: string; value: string; on?: boolean }) => (
  <View style={styles.stamp}>
    <View style={[styles.stampIcon, on && styles.stampIconOn]}>
      <Glyph name="time-outline" size={17} color={on ? brand.deep : brand.textSecondary} />
    </View>
    <View style={styles.grow}>
      <Text style={styles.stampLabel}>{label}</Text>
      <Text style={styles.stampValue}>{value}</Text>
    </View>
  </View>
);

const StatTile = ({
  icon,
  tint,
  color,
  label,
  value,
  caption,
}: {
  icon: GlyphName;
  tint: string;
  color: string;
  label: string;
  value: string;
  caption: string;
}) => (
  <View style={styles.statTile}>
    {/*
     * The badge is a column of its own, not the first cell of the label's row:
     * the comp lets the three lines run past it, which is the only way the
     * longest label ("Total Hours") fits a quarter of the gutter width.
     */}
    <View style={[styles.statIcon, { backgroundColor: tint }]}>
      <Glyph name={icon} size={13} color={color} />
    </View>
    <View style={styles.grow}>
      <Text style={styles.statLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text style={styles.statValue} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.statCaption} numberOfLines={1}>
        {caption}
      </Text>
    </View>
  </View>
);

const CountPill = ({
  label,
  count,
  bg,
  fg,
  chip,
}: {
  label: string;
  count: number;
  bg: string;
  fg: string;
  chip: string;
}) => (
  <View style={[styles.teamPill, { backgroundColor: bg }]}>
    <Text style={[styles.teamPillText, { color: fg }]}>{label}</Text>
    <View style={[styles.teamPillCount, { backgroundColor: chip }]}>
      <Text style={[styles.teamPillCountText, { color: fg }]}>{count}</Text>
    </View>
  </View>
);

/* ------------------------------------------------------------- screen -- */

export const AttendanceScreen = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { user, role } = useAuth();
  const { canPageAction } = usePermissions();
  const canManage = Boolean(role && MANAGE_ROLES.has(role) && canPageAction("attendance", "approve"));

  const [today, setToday] = useState<AttendanceRecord | null>(null);
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [policy, setPolicy] = useState<AttendancePolicy | null>(null);
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [teamSummary, setTeamSummary] = useState<Record<string, number>>({});

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [rangeOpen, setRangeOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dayOffset, setDayOffset] = useState(0);

  const rosterDate = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() - dayOffset);
    return dayKeyOf(date);
  }, [dayOffset]);

  const load = useCallback(
    async (quiet = false) => {
      try {
        if (quiet) setRefreshing(true);
        else setLoading(true);
        setError("");

        const [mine, team] = await Promise.allSettled([
          getMyAttendance(),
          canManage ? getDailyAttendanceForAdmin({ date: rosterDate }) : Promise.resolve(null),
        ]);

        if (mine.status === "fulfilled") {
          setToday(mine.value.today);
          setHistory(mine.value.attendance || []);
          setSummary(mine.value.summary || {});
          setPolicy(mine.value.policy);
        } else {
          setError(toErrorMessage(mine.reason, "Failed to load attendance"));
        }

        /* A roster the account may not read is not an error worth a banner. */
        if (team.status === "fulfilled" && team.value) {
          setRoster((team.value.attendance || []) as RosterRow[]);
          setTeamSummary(team.value.summary || {});
        }
      } catch (err) {
        setError(toErrorMessage(err, "Failed to load attendance"));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [canManage, rosterDate],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      void load(true);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const geofenced = Boolean((policy as { geofenceEnabled?: boolean } | null)?.geofenceEnabled);
  const radiusMeters = Number((policy as { officeRadiusMeters?: number } | null)?.officeRadiusMeters || 0);

  const run = useCallback(
    async (
      action: (payload: Record<string, unknown>) => Promise<{ attendance: AttendanceRecord | null }>,
      needsLocation = false,
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
        /* Re-read rather than trusting the patch: the server recomputes the
           worked minutes and the status the ring and the pill both show. */
        await load(true);
      } catch (err) {
        Alert.alert("Attendance", toErrorMessage(err, "That did not go through"));
      } finally {
        setBusy(false);
      }
    },
    [busy, geofenced, load],
  );

  /* ------------------------------------------------------------ derived -- */

  const checkedIn = Boolean(today?.checkInAt);
  const checkedOut = Boolean(today?.checkOutAt);
  const onBreak = Boolean(today?.onBreak);
  const liveStatus = onBreak
    ? "BREAK"
    : checkedIn && !checkedOut
      ? "WORKING"
      : String(today?.status || "PENDING").toUpperCase();
  const tone = toneOf(liveStatus);

  const fullDayMinutes = Number(
    (policy as { minimumFullDayMinutes?: number } | null)?.minimumFullDayMinutes || 480,
  );

  const now = new Date();
  const dateLine = `${WEEKDAYS_LONG[now.getDay()]}, ${now.getDate()} ${MONTHS[now.getMonth()]}`;

  const week = useMemo(() => {
    const start = startOfMondayWeek(new Date());
    const todayKey = dayKeyOf(new Date());
    return [0, 1, 2, 3, 4].map((offset) => {
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + offset);
      const key = dayKeyOf(date);
      const row = history.find((entry) => String(entry.date || "").slice(0, 10) === key);
      return {
        key,
        label: WEEKDAYS_SHORT[date.getDay()],
        minutes: Number(row?.workedMinutes || 0),
        isToday: key === todayKey,
      };
    });
  }, [history]);

  const teamRows = useMemo(() => roster.filter((row) => row.user?.name).slice(0, 6), [roster]);

  const presentCount = Number(
    teamSummary.checkedIn ??
      teamRows.filter((row) => ["WORKING", "PRESENT", "LATE", "BREAK"].includes(liveStatusOf(row))).length,
  );
  const leaveCount = Number(teamSummary.leave ?? 0);
  const absentCount = Number(teamSummary.absent ?? 0);

  const bottomPad = 24 + Math.max(insets.bottom, Platform.OS === "android" ? 16 : 0);

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
      <View style={styles.header}>
        {/*
         * The comp draws no back control - it shows Attendance with the tab bar
         * under it, as though it sat in the bar. It is pushed over that bar, so
         * without this there is no way out.
         */}
        {navigation.canGoBack() ? (
          <Pressable
            style={styles.back}
            onPress={() => navigation.goBack()}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Glyph name="arrow-back" size={24} color={brand.text} />
          </Pressable>
        ) : null}
        <Text style={styles.pageTitle} numberOfLines={1}>
          Attendance
        </Text>
        <Text style={styles.pageSubtitle}>Track your workday</Text>

        <View style={styles.headerActions}>
          {/*
           * One icon, as the comp draws it, carrying everything the hub's old
           * tabs did: history, leave, and for a manager approvals, violations
           * and the geofence policy. None of them has another way in.
           */}
          <Pressable
            style={styles.iconBtn}
            onPress={() => setMenuOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Attendance menu"
          >
            <Glyph name="calendar-outline" size={18} color={brand.text} />
          </Pressable>
          <View style={styles.headerAvatar}>
            <Text style={styles.headerAvatarText}>{initialsOf(user?.name)}</Text>
            <PhotoOverlay uri={profilePhotoOf(user)} />
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={brand.primary} />
        }
      >
        {error ? (
          <Pressable style={styles.banner} onPress={() => load()} accessibilityRole="button">
            <Text style={styles.bannerText}>{error}</Text>
          </Pressable>
        ) : null}

        {/* ---- today ---- */}
        <View style={styles.card}>
          <View style={styles.todayHead}>
            <Text style={styles.todayDate} numberOfLines={1}>
              {dateLine}
            </Text>
            <View style={[styles.statePill, { backgroundColor: tone.bg }]}>
              <View style={[styles.stateDot, { backgroundColor: tone.dot }]} />
              <Text style={[styles.statePillText, { color: tone.fg }]}>{tone.label}</Text>
            </View>
          </View>

          <Ring minutes={Number(today?.workedMinutes || 0)} target={fullDayMinutes} />

          <View style={styles.stampRow}>
            <StampTile label="Check in" value={clock(today?.checkInAt)} on={checkedIn} />
            <StampTile label="Check out" value={clock(today?.checkOutAt)} on={checkedOut} />
          </View>

          <Pressable
            style={[styles.primaryBtn, (busy || checkedOut || onBreak) && styles.btnOff]}
            onPress={() => {
              if (!checkedIn) {
                void run(checkInAttendance, true);
                return;
              }
              Alert.alert("Check out", "End your working day?", [
                { text: "Cancel", style: "cancel" },
                { text: "Check out", onPress: () => void run(checkOutAttendance, true) },
              ]);
            }}
            disabled={busy || checkedOut || onBreak}
            accessibilityRole="button"
          >
            <Text style={styles.primaryBtnText}>
              {checkedOut ? "Day complete" : checkedIn ? "Check out" : "Check in"}
            </Text>
          </Pressable>

          <Pressable
            style={[styles.outlineBtn, (busy || !checkedIn || checkedOut) && styles.btnOff]}
            onPress={() => run(onBreak ? endBreakAttendance : startBreakAttendance)}
            disabled={busy || !checkedIn || checkedOut}
            accessibilityRole="button"
          >
            <Text style={styles.outlineBtnText}>{onBreak ? "End break" : "Start break"}</Text>
          </Pressable>

          {/*
           * The comp names the office ("Office - Vijay Nagar"). The policy
           * carries a coordinate and a radius but no label, so this states the
           * rule rather than inventing a place name.
           */}
          <View style={styles.locStrip}>
            <View style={styles.locIcon}>
              <Glyph name="location" size={16} color={brand.primary} />
            </View>
            <View style={styles.grow}>
              <Text style={styles.locTitle}>Office</Text>
              <Text style={styles.locNote} numberOfLines={1}>
                {geofenced
                  ? `Check in within ${radiusMeters || 0} m of the office`
                  : "Location check is off for your company"}
              </Text>
            </View>
          </View>
        </View>

        {/* ---- this month ---- */}
        <View style={styles.statRow}>
          <StatTile
            icon="calendar-outline"
            tint={brand.tintSoft}
            color={brand.deep}
            label="This Month"
            value={String(summary.presentDays ?? 0)}
            caption="Present"
          />
          <StatTile
            icon="time-outline"
            tint={brand.tintSoft}
            color={brand.deep}
            label="On Time"
            value={String(Math.max(0, Number(summary.presentDays || 0) - Number(summary.lateDays || 0)))}
            caption="Days"
          />
          <StatTile
            icon="alert-circle-outline"
            tint={brand.alertTint}
            color={brand.alertInk}
            label="Late"
            value={String(summary.lateDays ?? 0)}
            caption="Days"
          />
          <StatTile
            icon="stats-chart"
            tint={brand.tintSoft}
            color={brand.deep}
            label="Total Hours"
            value={`${Math.round(Number(summary.totalWorkedHours || 0))}h`}
            caption="Worked"
          />
        </View>

        {/* ---- this week ---- */}
        <View style={[styles.card, styles.cardGap]}>
          <Text style={styles.cardTitle}>This week</Text>
          <View style={styles.weekRow}>
            {week.map((day) => (
              <View key={day.key} style={[styles.dayCell, day.isToday && styles.dayCellOn]}>
                <Text style={styles.dayLabel}>{day.label}</Text>
                <Text style={styles.dayValue}>{day.minutes ? duration(day.minutes) : "—"}</Text>
                <View style={styles.dayTrack}>
                  <View
                    style={[styles.dayFill, { width: `${Math.min(100, (day.minutes / fullDayMinutes) * 100)}%` }]}
                  />
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* ---- team ---- */}
        {canManage ? (
          <View style={[styles.card, styles.cardGap]}>
            <View style={styles.teamHead}>
              <Text style={styles.cardTitle}>Team attendance</Text>
              <Pressable style={styles.rangeBtn} onPress={() => setRangeOpen(true)} accessibilityRole="button">
                <Text style={styles.rangeLabel}>
                  {dayOffset === 0 ? "Today" : dayOffset === 1 ? "Yesterday" : `${dayOffset} days ago`}
                </Text>
                <Glyph name="chevron-down" size={14} color={brand.textSecondary} />
              </Pressable>
            </View>

            <View style={styles.teamPills}>
              <CountPill label="Present" count={presentCount} bg={brand.tint} fg={brand.primary} chip={brand.tintBar} />
              <CountPill label="Leave" count={leaveCount} bg={brand.warnTint} fg={brand.warnInk} chip={brand.warnChip} />
              <CountPill label="Absent" count={absentCount} bg={brand.alertTint} fg={brand.alertInk} chip={brand.alertChip} />
            </View>

            {teamRows.map((row, index) => {
              const status = liveStatusOf(row);
              const rowTone = toneOf(status);
              const stamp =
                status === "BREAK"
                  ? clock(row.breaks?.[row.breaks.length - 1]?.startedAt)
                  : clock(row.checkInAt);

              return (
                <Pressable
                  key={String(row.user?._id || index)}
                  style={[styles.teamRow, index > 0 && styles.teamRowDivided]}
                  onPress={() =>
                    navigation.navigate("AttendanceDetails", {
                      userId: String(row.user?._id || ""),
                      date: rosterDate,
                    })
                  }
                  accessibilityRole="button"
                >
                  <View style={styles.teamAvatar}>
                    <Text style={styles.teamAvatarText}>{initialsOf(row.user?.name)}</Text>
                    <PhotoOverlay uri={profilePhotoOf(row.user)} />
                  </View>
                  <Text style={styles.teamName} numberOfLines={1}>
                    {row.user?.name}
                  </Text>
                  <View style={[styles.stateDot, { backgroundColor: rowTone.dot }]} />
                  <Text style={styles.teamStatus} numberOfLines={1}>
                    {rowTone.label}
                    {stamp !== "—" ? ` · ${stamp}` : ""}
                  </Text>
                  <Glyph name="chevron-forward" size={17} color={brand.textMuted} />
                </Pressable>
              );
            })}

            {teamRows.length === 0 ? (
              <Text style={styles.emptyText}>No one on the roster for this day</Text>
            ) : null}

            <Pressable
              style={styles.historyLink}
              onPress={() => navigation.navigate("AttendanceHistory", { date: rosterDate })}
              accessibilityRole="button"
            >
              <Text style={styles.historyLinkText}>View attendance history</Text>
              <Glyph name="arrow-forward" size={16} color={brand.primary} />
            </Pressable>
          </View>
        ) : (
          <Pressable
            style={[styles.card, styles.cardGap, styles.historyCard]}
            onPress={() => navigation.navigate("MyAttendance")}
            accessibilityRole="button"
          >
            <Text style={styles.historyLinkText}>View attendance history</Text>
            <Glyph name="arrow-forward" size={16} color={brand.primary} />
          </Pressable>
        )}
      </ScrollView>

      <AppSheet visible={menuOpen} onClose={() => setMenuOpen(false)} title="Attendance">
        {MENU_LINKS.filter((entry) => !entry.manage || canManage).map((entry) => (
          <Pressable
            key={entry.route}
            style={styles.sheetRow}
            onPress={() => {
              setMenuOpen(false);
              navigation.navigate(entry.route, { date: rosterDate });
            }}
            accessibilityRole="button"
          >
            <View style={styles.sheetLead}>
              <Glyph name={entry.icon} size={18} color={brand.textSecondary} />
              <Text style={styles.sheetLabel}>{entry.label}</Text>
            </View>
            <Glyph name="chevron-forward" size={17} color={brand.textMuted} />
          </Pressable>
        ))}
      </AppSheet>

      <AppSheet visible={rangeOpen} onClose={() => setRangeOpen(false)} title="Roster day">
        {[0, 1, 2, 3, 4, 5, 6].map((offset) => {
          const date = new Date();
          date.setDate(date.getDate() - offset);
          return (
            <Pressable
              key={offset}
              style={styles.sheetRow}
              onPress={() => {
                setDayOffset(offset);
                setRangeOpen(false);
              }}
              accessibilityRole="button"
            >
              <Text style={styles.sheetLabel}>
                {offset === 0
                  ? "Today"
                  : offset === 1
                    ? "Yesterday"
                    : `${WEEKDAYS_LONG[date.getDay()]}, ${date.getDate()} ${MONTHS[date.getMonth()].slice(0, 3)}`}
              </Text>
              {dayOffset === offset ? <Glyph name="checkmark" size={18} color={brand.primary} /> : null}
            </Pressable>
          );
        })}
      </AppSheet>
    </SafeAreaView>
  );
};

const styles = brandStyles((b) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: b.bg,
    },
    centred: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    grow: {
      flex: 1,
      minWidth: 0,
    },

    /* ---- page header ---- */
    header: {
      paddingHorizontal: layout.gutter,
      paddingTop: 8,
      paddingBottom: 11,
    },
    back: {
      marginBottom: 6,
    },
    pageTitle: {
      width: "62%",
      fontSize: t.pageTitle,
      lineHeight: 30,
      fontWeight: "700",
      letterSpacing: -0.8,
      color: b.text,
    },
    pageSubtitle: {
      marginTop: 2,
      fontSize: t.cardTitle,
      lineHeight: 18,
      color: b.textMuted,
    },
    headerActions: {
      position: "absolute",
      right: layout.gutter,
      top: 8,
      flexDirection: "row",
      alignItems: "center",
      gap: 11,
    },
    iconBtn: {
      width: 34,
      height: 34,
      borderRadius: round.panel,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: b.border,
      backgroundColor: b.surface,
    },
    headerAvatar: {
      width: 34,
      height: 34,
      borderRadius: round.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: b.tint,
    },
    headerAvatarText: {
      fontSize: t.body,
      fontWeight: "700",
      color: b.deep,
    },

    body: {
      paddingHorizontal: layout.gutter,
    },
    banner: {
      marginBottom: 10,
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderWidth: 1,
      borderColor: b.alert,
      borderRadius: round.field,
      backgroundColor: b.surface,
    },
    bannerText: {
      fontSize: t.body,
      lineHeight: 17,
      color: b.alert,
    },

    card: {
      padding: 12,
      borderWidth: 1,
      borderColor: b.border,
      borderRadius: round.panel,
      backgroundColor: b.surface,
    },
    cardGap: {
      marginTop: 8,
    },
    cardTitle: {
      fontSize: t.barTitle,
      lineHeight: 22,
      fontWeight: "700",
      letterSpacing: -0.4,
      color: b.text,
    },

    /* ---- today ---- */
    todayHead: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      height: 23,
    },
    todayDate: {
      flex: 1,
      minWidth: 0,
      fontSize: t.barTitle,
      lineHeight: 22,
      fontWeight: "700",
      letterSpacing: -0.4,
      color: b.text,
    },
    statePill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      height: 23,
      paddingHorizontal: 9,
      borderRadius: round.pill,
    },
    stateDot: {
      width: 8,
      height: 8,
      borderRadius: round.pill,
    },
    statePillText: {
      fontSize: t.fieldLabel,
      fontWeight: "600",
    },

    ringWrap: {
      alignSelf: "center",
      /* The comp starts the ring level with the status pill, not below it. */
      marginTop: -4,
      marginBottom: 2,
      width: 132,
      height: 132,
      alignItems: "center",
      justifyContent: "center",
    },
    ringCentre: {
      ...StyleSheet.absoluteFillObject,
      alignItems: "center",
      justifyContent: "center",
    },
    ringValue: {
      fontSize: 22,
      lineHeight: 27,
      fontWeight: "700",
      letterSpacing: -0.5,
      color: b.primary,
    },
    ringCaption: {
      fontSize: t.micro,
      lineHeight: 13,
      color: b.textMuted,
    },

    stampRow: {
      flexDirection: "row",
      gap: 9,
    },
    stamp: {
      flex: 1,
      minWidth: 0,
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
      height: 45,
      paddingHorizontal: 9,
      borderWidth: 1,
      borderColor: b.border,
      borderRadius: round.field,
      backgroundColor: b.surface,
    },
    stampIcon: {
      width: 27,
      height: 27,
      borderRadius: round.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: b.hairline,
    },
    stampIconOn: {
      backgroundColor: b.tint,
    },
    stampLabel: {
      fontSize: t.tagline,
      lineHeight: 13,
      color: b.textMuted,
    },
    stampValue: {
      fontSize: t.cardTitle,
      lineHeight: 17,
      fontWeight: "700",
      color: b.text,
    },

    primaryBtn: {
      marginTop: 8,
      height: 33,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: round.field,
      backgroundColor: "#058968",
    },
    primaryBtnText: {
      fontSize: t.cardTitle,
      fontWeight: "700",
      color: b.onPrimary,
    },
    outlineBtn: {
      marginTop: 6,
      height: 33,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: round.field,
      borderWidth: 1,
      borderColor: "#37ab8e",
      backgroundColor: b.surface,
    },
    outlineBtnText: {
      fontSize: t.cardTitle,
      fontWeight: "700",
      color: b.primary,
    },
    btnOff: {
      opacity: 0.5,
    },

    locStrip: {
      marginTop: 8,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      height: 39,
      paddingHorizontal: 9,
      borderRadius: round.field,
      backgroundColor: b.fieldMuted,
    },
    locIcon: {
      width: 30,
      height: 30,
      borderRadius: round.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: b.tint,
    },
    locTitle: {
      fontSize: t.fieldLabel,
      lineHeight: 15,
      fontWeight: "600",
      color: b.text,
    },
    locNote: {
      fontSize: t.tagline,
      lineHeight: 13,
      color: b.textMuted,
    },

    /* ---- this month ---- */
    statRow: {
      marginTop: 8,
      flexDirection: "row",
      gap: 5,
    },
    statTile: {
      flex: 1,
      minWidth: 0,
      flexDirection: "row",
      /* 7 and 5, not the comp's 9: a quarter of the gutter width leaves
         "Total Hours" 50pt of Inter and nothing to spare. */
      gap: 5,
      paddingHorizontal: 7,
      paddingVertical: 9,
      borderWidth: 1,
      borderColor: b.border,
      borderRadius: round.panel,
      backgroundColor: b.surface,
    },
    statIcon: {
      width: 22,
      height: 22,
      borderRadius: 7,
      alignItems: "center",
      justifyContent: "center",
    },
    statLabel: {
      fontSize: t.micro,
      lineHeight: 12,
      fontWeight: "500",
      color: b.textSecondary,
    },
    statValue: {
      fontSize: t.sectionTitle,
      lineHeight: 19,
      fontWeight: "700",
      letterSpacing: -0.4,
      color: b.text,
    },
    statCaption: {
      fontSize: t.micro,
      lineHeight: 12,
      color: b.textMuted,
    },

    /* ---- this week ---- */
    weekRow: {
      marginTop: 6,
      flexDirection: "row",
      gap: 8,
    },
    dayCell: {
      flex: 1,
      minWidth: 0,
      height: 57,
      alignItems: "center",
      paddingTop: 7,
      paddingHorizontal: 7,
      borderWidth: 1,
      borderColor: b.border,
      borderRadius: round.field,
      backgroundColor: b.surface,
    },
    dayCellOn: {
      borderColor: b.greenBright,
      backgroundColor: b.tint,
    },
    dayLabel: {
      fontSize: t.fieldLabel,
      lineHeight: 14,
      color: b.textSecondary,
    },
    dayValue: {
      marginTop: 2,
      fontSize: t.cardTitle,
      lineHeight: 17,
      fontWeight: "700",
      color: b.text,
    },
    dayTrack: {
      marginTop: 6,
      alignSelf: "stretch",
      height: 5,
      borderRadius: round.pill,
      overflow: "hidden",
      backgroundColor: b.hairline,
    },
    dayFill: {
      height: "100%",
      borderRadius: round.pill,
      backgroundColor: "#048c65",
    },

    /* ---- team ---- */
    teamHead: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      height: 30,
    },
    rangeBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      height: 30,
      paddingHorizontal: 11,
      borderWidth: 1,
      borderColor: b.border,
      borderRadius: round.field,
      backgroundColor: b.surface,
    },
    rangeLabel: {
      fontSize: t.cardTitle,
      fontWeight: "500",
      color: b.text,
    },
    teamPills: {
      marginTop: 9,
      flexDirection: "row",
      gap: 7,
    },
    teamPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      height: 27,
      paddingHorizontal: 10,
      borderRadius: round.pill,
    },
    teamPillText: {
      fontSize: t.fieldLabel,
      fontWeight: "600",
    },
    teamPillCount: {
      minWidth: 18,
      height: 18,
      paddingHorizontal: 4,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: round.pill,
    },
    teamPillCountText: {
      fontSize: t.tagline,
      fontWeight: "700",
    },
    teamRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
      paddingVertical: 11,
    },
    teamRowDivided: {
      borderTopWidth: 1,
      borderTopColor: b.hairline,
    },
    teamAvatar: {
      width: 34,
      height: 34,
      borderRadius: round.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: b.tint,
    },
    teamAvatarText: {
      fontSize: t.fieldLabel,
      fontWeight: "700",
      color: b.deep,
    },
    teamName: {
      flexShrink: 1,
      fontSize: t.rowTitle,
      fontWeight: "600",
      color: b.text,
    },
    teamStatus: {
      flex: 1,
      minWidth: 0,
      fontSize: t.body,
      color: b.textSecondary,
    },
    emptyText: {
      paddingVertical: 20,
      textAlign: "center",
      fontSize: t.field,
      color: b.textMuted,
    },
    historyLink: {
      marginTop: 4,
      paddingTop: 13,
      borderTopWidth: 1,
      borderTopColor: b.hairline,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    historyCard: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    historyLinkText: {
      fontSize: t.cardTitle,
      fontWeight: "700",
      color: b.primary,
    },

    sheetRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: b.hairline,
    },
    sheetLead: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    sheetLabel: {
      fontSize: t.field,
      color: b.text,
    },
  }),
);

export default AttendanceScreen;
