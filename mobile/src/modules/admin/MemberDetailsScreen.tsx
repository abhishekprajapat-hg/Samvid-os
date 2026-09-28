import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Glyph, type GlyphName } from "../../components/ui/Glyph";
import { AppSheet } from "../../components/ui/Overlay";
import { useAuth } from "../../context/AuthContext";
import { getUserPageAccess } from "../../services/accessService";
import { getUserAttendanceForAdmin } from "../../services/attendanceService";
import { getTasks } from "../../services/taskService";
import { createUserDeleteRequest, deleteUser, getUserProfileById, updateUserById } from "../../services/userService";
import { toErrorMessage } from "../../utils/errorMessage";
import { brand, brandStyles, layout, round, type as t } from "../../theme/brand";
import {
  PERMISSION_ACTIONS,
  PERMISSION_ROWS,
  STATUS_LABELS,
  activityStampOf,
  avatarTone,
  dayMonthYear,
  initialsOf,
  roleLabelOf,
  statusOf,
  statusTone,
  tileMoney,
  type MemberStatus,
} from "./teamVocab";

/*
 * Member Details, drawn to the comp.
 *
 * Everything on the page is counted from records the app already keeps, and
 * nothing is stored twice. Leads, deals and the target come from the profile
 * route's own performance block, active tasks from the task list, and the
 * month's attendance from the attendance route - so correcting a lead or a
 * check-in corrects this page too.
 *
 * Revenue is the one figure that is not counted: there is no per-deal value on
 * a lead, so a closed deal is priced at the same flat figure the leaderboard
 * uses. Change it in one place and both follow.
 */

/** Matches `dealValue` in modules/reports/gamification.ts. */
const DEAL_VALUE = 80000;

const TABS = [
  { key: "OVERVIEW", label: "Overview" },
  { key: "ACTIVITY", label: "Activity" },
  { key: "PERMISSIONS", label: "Permissions" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const idOf = (value: unknown): string => {
  if (!value) return "";
  if (typeof value === "string") return value;
  return String((value as { _id?: string })._id || "");
};

const startOfMonth = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
};

const toIso = (value: Date) =>
  `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;

/* --------------------------------------------------------------- pieces -- */

const StatTile = ({ icon, label, value }: { icon: GlyphName; label: string; value: string }) => (
  <View style={styles.statTile}>
    <View style={styles.statIcon}>
      <Glyph name={icon} size={16} color={brand.deep} />
    </View>
    <View style={styles.statBody}>
      <Text style={styles.statLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text style={styles.statValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  </View>
);

const FactRow = ({ icon, label, value }: { icon: GlyphName; label: string; value: string }) => (
  <View style={styles.factRow}>
    <Glyph name={icon} size={15} color={brand.textSecondary} />
    <Text style={styles.factLabel} numberOfLines={1}>
      {label}
    </Text>
    <Text style={styles.factValue} numberOfLines={1}>
      {value}
    </Text>
  </View>
);

const LoadBar = ({
  label,
  caption,
  fraction,
}: {
  label: string;
  caption: string;
  fraction: number;
}) => (
  <View style={styles.loadBlock}>
    <View style={styles.loadHead}>
      <Text style={styles.loadLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text style={styles.loadCaption} numberOfLines={1}>
        {caption}
      </Text>
    </View>
    <View style={styles.loadTrack}>
      <View style={[styles.loadFill, { width: `${Math.max(3, Math.min(100, fraction * 100))}%` }]} />
    </View>
  </View>
);

/* --------------------------------------------------------------- screen -- */

export const MemberDetailsScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { role: myRole, user } = useAuth();
  const isAdmin = String(myRole || "").toUpperCase() === "ADMIN";
  const myId = String(user?._id || (user as any)?.id || "");

  const userId = String(route.params?.userId || "");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<TabKey>("OVERVIEW");
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const [profile, setProfile] = useState<any>(null);
  const [performance, setPerformance] = useState<Record<string, any>>({});
  const [tasks, setTasks] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<{
    summary: Record<string, number>;
    rows: Array<{ date?: string; status?: string; workedMinutes?: number | null }>;
  }>({ summary: {}, rows: [] });
  const [grants, setGrants] = useState<Array<{ pageKey: string; actions: string[] }> | null>(null);

  const load = useCallback(async () => {
    if (!userId) {
      setError("No member was chosen");
      setLoading(false);
      return;
    }
    try {
      setError("");
      const from = toIso(startOfMonth());
      const to = toIso(new Date());

      const [profilePayload, taskRows, attendancePayload, access] = await Promise.all([
        getUserProfileById(userId),
        getTasks().catch(() => []),
        getUserAttendanceForAdmin(userId, { from, to }).catch(() => null),
        /* Admin only; the tab says so rather than showing an empty matrix. */
        isAdmin ? getUserPageAccess(userId).catch(() => null) : Promise.resolve(null),
      ]);

      setProfile(profilePayload?.profile || null);
      setPerformance(profilePayload?.performance || {});
      setTasks(
        (Array.isArray(taskRows) ? taskRows : []).filter(
          (task: any) => idOf(task?.assignedTo) === userId,
        ),
      );
      setAttendance({
        summary: attendancePayload?.summary || {},
        rows: (attendancePayload?.attendance || []) as any[],
      });
      setGrants(access ? access.pageAccess : null);
    } catch (e) {
      setError(toErrorMessage(e, "Could not load this member"));
    } finally {
      setLoading(false);
    }
  }, [userId, isAdmin]);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      void load();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId]),
  );

  /* ----------------------------------------------------------- derived -- */

  const status: MemberStatus = useMemo(
    () => (profile ? statusOf(profile, null) : "ACTIVE"),
    [profile],
  );

  const activeTasks = useMemo(
    () => tasks.filter((task) => String(task?.status || "") !== "COMPLETED").length,
    [tasks],
  );

  const totals = useMemo(() => {
    const leads = Number(performance.totalLeads || 0);
    const closed = Number(performance.closedLeads || 0);
    const target = Number(profile?.monthlyTarget || 0);
    const achieved = Number(performance.achievedTarget || 0);
    const present = Number(attendance.summary.presentDays || 0);
    const late = Number(attendance.summary.lateDays || 0);
    const leave = Number(attendance.summary.leaveDays || 0);
    const workedDays = present + late;
    const totalDays = Number(attendance.summary.totalDays || 0);

    return {
      leads,
      closed,
      revenue: closed * DEAL_VALUE,
      target,
      targetPct: target ? Math.round((achieved / target) * 100) : 0,
      present,
      late,
      leave,
      hours: Math.round(Number(attendance.summary.totalWorkedHours || 0)),
      attendancePct: totalDays ? Math.round((workedDays / totalDays) * 100) : 0,
    };
  }, [performance, profile, attendance]);

  /* Mon..Sun of the current week, in hours worked. */
  const week = useMemo(() => {
    const now = new Date();
    const monday = new Date(now);
    const offset = (now.getDay() + 6) % 7;
    monday.setDate(now.getDate() - offset);
    monday.setHours(0, 0, 0, 0);

    const byDay = new Map<string, number>();
    for (const row of attendance.rows) {
      const key = String(row.date || "").slice(0, 10);
      if (key) byDay.set(key, Number(row.workedMinutes || 0) / 60);
    }

    return WEEKDAYS.map((label, index) => {
      const day = new Date(monday);
      day.setDate(monday.getDate() + index);
      return { label, hours: byDay.get(toIso(day)) || 0, weekend: index >= 5 };
    });
  }, [attendance.rows]);

  const peak = Math.max(1, ...week.map((day) => day.hours));

  /*
   * The recent activity feed: the leads this person last touched, and the
   * tasks they finished, interleaved by when they happened. Both are already
   * loaded, so nothing is fetched for the feed itself.
   */
  const activity = useMemo(() => {
    const rows: Array<{ key: string; icon: GlyphName; tint: string; ink: string; title: string; at: string }> = [];

    for (const lead of (performance.recentLeads || []) as any[]) {
      const closed = String(lead?.status || "") === "CLOSED";
      const visited = String(lead?.status || "").startsWith("SITE_VISIT");
      rows.push({
        key: `lead-${lead?._id}`,
        icon: closed ? "ribbon-outline" : visited ? "location-outline" : "person-outline",
        tint: closed ? brand.tint : visited ? brand.infoTint : brand.tintSoft,
        ink: closed ? brand.deep : visited ? brand.infoInk : brand.textSecondary,
        title: closed
          ? `Closed ${lead?.name || "a lead"}`
          : visited
            ? `Site visit with ${lead?.name || "a lead"}`
            : `Worked ${lead?.name || "a lead"}`,
        at: String(lead?.updatedAt || ""),
      });
    }

    for (const task of tasks) {
      if (String(task?.status || "") !== "COMPLETED") continue;
      rows.push({
        key: `task-${task?._id}`,
        icon: "checkmark-circle-outline",
        tint: brand.warnTint,
        ink: brand.warnInk,
        title: `Completed ${task?.title || "a task"}`,
        at: String(task?.updatedAt || ""),
      });
    }

    return rows
      .filter((row) => row.at)
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [performance.recentLeads, tasks]);

  /* ----------------------------------------------------------- actions -- */

  const dial = async () => {
    const digits = String(profile?.phone || "").replace(/\D/g, "").slice(-10);
    if (digits.length < 10) {
      Alert.alert("No number", "This member has no phone number on their record.");
      return;
    }
    await Linking.openURL(`tel:${digits}`).catch(() =>
      Alert.alert("Dial failed", "Could not open the dialer."),
    );
  };

  const message = () => {
    const id = String(profile?._id || "");
    if (!id) return;
    navigation.navigate("ChatConversation", { userId: id, name: profile?.name });
  };

  const setActive = async (next: boolean) => {
    setBusy(true);
    try {
      await updateUserById(userId, { isActive: next });
      setMenuOpen(false);
      await load();
    } catch (e) {
      Alert.alert("Could not save", toErrorMessage(e, "Failed to update the member"));
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    Alert.alert(
      isAdmin ? "Remove member" : "Request removal",
      isAdmin
        ? `${profile?.name} will lose access immediately.`
        : `An admin will be asked to remove ${profile?.name}.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: isAdmin ? "Remove" : "Request",
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            try {
              if (isAdmin) await deleteUser(userId);
              else await createUserDeleteRequest(userId, { reason: "Removed from the member page" });
              setMenuOpen(false);
              navigation.goBack();
            } catch (e) {
              Alert.alert("Could not remove", toErrorMessage(e, "Failed to remove the member"));
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  /* ------------------------------------------------------------ render -- */

  if (loading) {
    return (
      <SafeAreaView style={styles.root} edges={["top", "left", "right"]}>
        <View style={styles.centred}>
          <ActivityIndicator size="large" color={brand.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.root} edges={["top", "left", "right"]}>
        <View style={styles.bar}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back">
            <Glyph name="arrow-back" size={24} color={brand.text} />
          </Pressable>
          <Text style={styles.barTitle}>Member Details</Text>
        </View>
        <View style={styles.centred}>
          <Text style={styles.error}>{error || "This member could not be found."}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const tone = avatarTone(profile.name);
  const photo = String(profile.profileImageUrl || "").trim();
  const pillTone = statusTone(status);

  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right"]}>
      <View style={styles.bar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back">
          <Glyph name="arrow-back" size={24} color={brand.text} />
        </Pressable>
        <Text style={styles.barTitle}>Member Details</Text>
        <Pressable
          onPress={() => navigation.navigate("UserDetails", { userId })}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Edit member"
        >
          <Glyph name="create-outline" size={21} color={brand.text} />
        </Pressable>
        <Pressable onPress={() => setMenuOpen(true)} hitSlop={10} accessibilityRole="button" accessibilityLabel="More">
          <Glyph name="ellipsis-horizontal" size={21} color={brand.text} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ---- the profile card ---- */}
        <View style={styles.profileCard}>
          <View style={styles.profileHead}>
            {photo ? (
              <Image source={{ uri: photo }} style={styles.portrait} />
            ) : (
              <View style={[styles.portrait, { backgroundColor: tone.bg }]}>
                <Text style={[styles.portraitText, { color: tone.fg }]}>{initialsOf(profile.name)}</Text>
              </View>
            )}

            <View style={styles.profileBody}>
              <View style={styles.nameRow}>
                <Text style={styles.name} numberOfLines={1}>
                  {profile.name}
                </Text>
                <View style={[styles.statusPill, { backgroundColor: pillTone.bg }]}>
                  <Text style={[styles.statusText, { color: pillTone.fg }]}>{STATUS_LABELS[status]}</Text>
                </View>
              </View>

              <Text style={styles.roleLine} numberOfLines={1}>
                {`${roleLabelOf(profile)}${profile.department ? `   |   ${profile.department} Team` : ""}`}
              </Text>

              <View style={styles.contactRow}>
                <Glyph name="id-card-outline" size={16} color={brand.textSecondary} />
                <Text style={styles.contactLabel}>Employee ID</Text>
                <Text style={styles.contactValue} numberOfLines={1}>
                  {profile.employeeId || "—"}
                </Text>
              </View>
              <View style={styles.contactRow}>
                <Glyph name="mail-outline" size={16} color={brand.textSecondary} />
                <Text style={styles.contactValue} numberOfLines={1}>
                  {profile.email || "—"}
                </Text>
              </View>
              <View style={styles.contactRow}>
                <Glyph name="call-outline" size={16} color={brand.textSecondary} />
                <Text style={styles.contactValue} numberOfLines={1}>
                  {profile.phone || "—"}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.contactActions}>
            <Pressable style={styles.contactBtn} onPress={message} accessibilityRole="button">
              <Glyph name="chatbubble-outline" size={17} color={brand.deep} />
              <Text style={styles.contactBtnText}>Message</Text>
            </Pressable>
            <Pressable style={styles.contactBtn} onPress={dial} accessibilityRole="button">
              <Glyph name="call-outline" size={17} color={brand.deep} />
              <Text style={styles.contactBtnText}>Call</Text>
            </Pressable>
          </View>
        </View>

        {/* ---- six tiles ---- */}
        <View style={styles.tileGrid}>
          <StatTile icon="people-outline" label="Leads" value={String(totals.leads)} />
          <StatTile icon="checkbox-outline" label="Active Tasks" value={String(activeTasks)} />
          <StatTile icon="ribbon-outline" label="Deals Closed" value={String(totals.closed)} />
          <StatTile icon="bar-chart-outline" label="Revenue" value={tileMoney(totals.revenue)} />
          <StatTile icon="calendar-outline" label="Attendance" value={`${totals.attendancePct}%`} />
          <StatTile icon="disc-outline" label="Target" value={`${totals.targetPct}%`} />
        </View>

        {/* ---- tabs ---- */}
        <View style={styles.tabBar}>
          {TABS.map((entry) => {
            const active = tab === entry.key;
            return (
              <Pressable
                key={entry.key}
                style={[styles.tab, active && styles.tabOn]}
                onPress={() => setTab(entry.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.tabLabel, active && styles.tabLabelOn]}>{entry.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {tab === "OVERVIEW" ? (
          <>
            <View style={styles.pairRow}>
              <View style={styles.pairCol}>
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Work Details</Text>
                  <FactRow
                    icon="person-outline"
                    label="Reporting Manager"
                    value={profile.manager?.name || "—"}
                  />
                  <FactRow icon="calendar-outline" label="Joining Date" value={dayMonthYear(profile.joiningDate)} />
                  <FactRow icon="people-outline" label="Team" value={profile.department || "—"} />
                  <FactRow icon="briefcase-outline" label="Role" value={roleLabelOf(profile)} />
                  <FactRow icon="location-outline" label="Office" value={profile.branch || "—"} />
                </View>
              </View>

              <View style={styles.pairCol}>
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Current Workload</Text>
                  <LoadBar
                    label="Leads"
                    caption={`${totals.leads} / ${profile.leadCapacity ?? 25}`}
                    fraction={totals.leads / Math.max(1, profile.leadCapacity ?? 25)}
                  />
                  <LoadBar
                    label="Tasks"
                    caption={`${activeTasks} / ${profile.taskCapacity ?? 10}`}
                    fraction={activeTasks / Math.max(1, profile.taskCapacity ?? 10)}
                  />
                  <LoadBar
                    label="Follow-ups"
                    caption={`${Number(performance.dueFollowUpsToday || 0)} today`}
                    fraction={Number(performance.dueFollowUpsToday || 0) / 10}
                  />
                  <LoadBar
                    label="Site Visits"
                    caption={`${Number(performance.siteVisits || 0)} open`}
                    fraction={Number(performance.siteVisits || 0) / 10}
                  />
                </View>
              </View>
            </View>

            <View style={styles.pairRow}>
              <View style={styles.pairCol}>
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Recent Activity</Text>
                  {activity.length === 0 ? (
                    <Text style={styles.empty}>Nothing recorded yet.</Text>
                  ) : (
                    activity.slice(0, 4).map((row) => (
                      <View key={row.key} style={styles.activityRow}>
                        <View style={[styles.activityIcon, { backgroundColor: row.tint }]}>
                          <Glyph name={row.icon} size={15} color={row.ink} />
                        </View>
                        <View style={styles.activityBody}>
                          <Text style={styles.activityTitle} numberOfLines={2}>
                            {row.title}
                          </Text>
                          <Text style={styles.activityStamp}>{activityStampOf(row.at)}</Text>
                        </View>
                      </View>
                    ))
                  )}
                </View>
              </View>

              <View style={styles.pairCol}>
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Attendance This Month</Text>
                  <View style={styles.attendRow}>
                    <View style={styles.attendCell}>
                      <Text style={[styles.attendValue, { color: brand.deep }]}>{totals.present}</Text>
                      <Text style={styles.attendLabel}>Present</Text>
                    </View>
                    <View style={styles.attendDivider} />
                    <View style={styles.attendCell}>
                      <Text style={[styles.attendValue, { color: "#d67912" }]}>{totals.late}</Text>
                      <Text style={styles.attendLabel}>Late</Text>
                    </View>
                    <View style={styles.attendDivider} />
                    <View style={styles.attendCell}>
                      <Text style={[styles.attendValue, { color: brand.alert }]}>{totals.leave}</Text>
                      <Text style={styles.attendLabel}>Leave</Text>
                    </View>
                    <View style={styles.attendDivider} />
                    <View style={styles.attendCell}>
                      <Text style={styles.attendValue}>{`${totals.hours}h`}</Text>
                      <Text style={styles.attendLabel}>Total hours</Text>
                    </View>
                  </View>

                  <View style={styles.chart}>
                    {week.map((day) => (
                      <View key={day.label} style={styles.chartCol}>
                        <View
                          style={[
                            styles.chartBar,
                            {
                              height: Math.max(6, (day.hours / peak) * 76),
                              backgroundColor: day.weekend || day.hours === 0 ? brand.neutralBadge : "#2f9e6f",
                            },
                          ]}
                        />
                        <Text style={styles.chartLabel}>{day.label}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            </View>
          </>
        ) : null}

        {tab === "ACTIVITY" ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Activity</Text>
            {activity.length === 0 ? (
              <Text style={styles.empty}>Nothing recorded yet.</Text>
            ) : (
              activity.map((row) => (
                <View key={row.key} style={styles.activityRow}>
                  <View style={[styles.activityIcon, { backgroundColor: row.tint }]}>
                    <Glyph name={row.icon} size={15} color={row.ink} />
                  </View>
                  <View style={styles.activityBody}>
                    <Text style={styles.activityTitle}>{row.title}</Text>
                    <Text style={styles.activityStamp}>{activityStampOf(row.at)}</Text>
                  </View>
                </View>
              ))
            )}
          </View>
        ) : null}

        {tab === "PERMISSIONS" ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Permissions</Text>
            <Text style={styles.cardSubtitle}>
              {grants
                ? `What ${profile.name?.split(" ")[0] || "this member"} can reach today.`
                : "Only an admin can see a member's page access."}
            </Text>

            {grants
              ? PERMISSION_ROWS.map((row) => {
                const granted = grants.find((entry) => entry.pageKey === row.pageKey);
                return (
                  <View key={row.pageKey} style={styles.permRow}>
                    <Glyph name={row.icon} size={16} color={brand.textSecondary} />
                    <Text style={styles.permLabel} numberOfLines={1}>
                      {row.label}
                    </Text>
                    <View style={styles.permChips}>
                      {PERMISSION_ACTIONS.filter((action) =>
                        granted?.actions?.includes(action.action)).map((action) => (
                          <View key={action.action} style={styles.permChip}>
                            <Text style={styles.permChipText}>{action.label}</Text>
                          </View>
                      ))}
                      {!granted?.actions?.length ? <Text style={styles.permNone}>No access</Text> : null}
                    </View>
                  </View>
                );
              })
              : null}

            {isAdmin ? (
              <Pressable
                style={styles.permLink}
                onPress={() => navigation.navigate("UserPageAccess", {
                  userId,
                  memberName: profile.name,
                  memberRole: profile.role,
                })}
                accessibilityRole="button"
              >
                <Text style={styles.permLinkText}>Edit this member&apos;s page access</Text>
                <Glyph name="arrow-forward" size={15} color={brand.primary} />
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <View style={styles.footer}>
          <Pressable
            style={styles.primaryBtn}
            onPress={() => navigation.navigate("NewTask", { assigneeId: userId })}
            accessibilityRole="button"
          >
            <Glyph name="add" size={19} color={brand.onPrimary} />
            <Text style={styles.primaryBtnText}>Assign task</Text>
          </Pressable>

          <Pressable
            style={styles.ghostBtn}
            onPress={() => navigation.navigate("Performer", { performerId: userId })}
            accessibilityRole="button"
          >
            <Glyph name="bar-chart-outline" size={17} color={brand.primary} />
            <Text style={styles.ghostBtnText}>View performance</Text>
          </Pressable>
        </View>
      </ScrollView>

      <AppSheet visible={menuOpen} onClose={() => setMenuOpen(false)} title={profile.name}>
        <Pressable
          style={styles.sheetRow}
          onPress={() => {
            setMenuOpen(false);
            navigation.navigate("UserDetails", { userId });
          }}
          accessibilityRole="button"
        >
          <Glyph name="create-outline" size={19} color={brand.textSecondary} />
          <Text style={styles.sheetLabel}>Edit details</Text>
        </Pressable>

        {userId !== myId ? (
          <>
            <Pressable
              style={styles.sheetRow}
              onPress={() => setActive(profile.isActive === false)}
              disabled={busy}
              accessibilityRole="button"
            >
              <Glyph
                name={profile.isActive === false ? "play-circle-outline" : "pause-circle-outline"}
                size={19}
                color={brand.textSecondary}
              />
              <Text style={styles.sheetLabel}>
                {profile.isActive === false ? "Reactivate" : "Deactivate"}
              </Text>
            </Pressable>

            <Pressable style={styles.sheetRow} onPress={remove} disabled={busy} accessibilityRole="button">
              <Glyph name="trash-outline" size={19} color={brand.alert} />
              <Text style={[styles.sheetLabel, { color: brand.alert }]}>
                {isAdmin ? "Remove from company" : "Request removal"}
              </Text>
            </Pressable>
          </>
        ) : null}
      </AppSheet>
    </SafeAreaView>
  );
};

export default MemberDetailsScreen;

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
      paddingHorizontal: layout.pageGutter,
    },

    bar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 16,
      paddingHorizontal: layout.pageGutter,
      paddingTop: 6,
      paddingBottom: 10,
    },
    barTitle: {
      flex: 1,
      minWidth: 0,
      fontSize: t.barTitle,
      lineHeight: 23,
      fontWeight: "700",
      letterSpacing: -0.5,
      color: b.text,
    },

    body: {
      paddingHorizontal: layout.pageGutter,
      gap: 11,
    },
    error: {
      fontSize: t.body,
      lineHeight: 17,
      color: b.alert,
    },
    empty: {
      paddingVertical: 10,
      fontSize: t.body,
      color: b.textMuted,
    },

    /* ---- profile card ---- */
    profileCard: {
      padding: 12,
      borderWidth: 1,
      borderColor: b.border,
      borderRadius: round.panel,
      backgroundColor: b.surface,
    },
    profileHead: {
      flexDirection: "row",
      gap: 12,
    },
    portrait: {
      width: 92,
      height: 100,
      borderRadius: round.field,
      alignItems: "center",
      justifyContent: "center",
    },
    portraitText: {
      fontSize: 26,
      fontWeight: "700",
    },
    profileBody: {
      flex: 1,
      minWidth: 0,
      gap: 3,
    },
    nameRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    name: {
      flexShrink: 1,
      minWidth: 0,
      fontSize: 16,
      lineHeight: 21,
      fontWeight: "700",
      letterSpacing: -0.4,
      color: b.text,
    },
    statusPill: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: round.pill,
    },
    statusText: {
      fontSize: 10.5,
      fontWeight: "700",
    },
    roleLine: {
      fontSize: 10.5,
      lineHeight: 15,
      color: b.textMuted,
    },
    contactRow: {
      marginTop: 3,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    contactLabel: {
      fontSize: 10.5,
      color: b.textMuted,
    },
    contactValue: {
      flexShrink: 1,
      minWidth: 0,
      fontSize: 10.5,
      color: b.text,
    },
    contactActions: {
      marginTop: 12,
      flexDirection: "row",
      gap: 11,
    },
    contactBtn: {
      flex: 1,
      minWidth: 0,
      height: 40,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      borderRadius: round.field,
      backgroundColor: b.tintBar,
    },
    contactBtnText: {
      fontSize: 11.5,
      fontWeight: "700",
      color: b.deep,
    },

    /* ---- six tiles ---- */
    tileGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    statTile: {
      width: "31.5%",
      flexGrow: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 9,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: b.border,
      borderRadius: round.panel,
      backgroundColor: b.surface,
    },
    statIcon: {
      width: 30,
      height: 30,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: b.tintSoft,
    },
    statBody: {
      flex: 1,
      minWidth: 0,
    },
    statLabel: {
      fontSize: 9,
      lineHeight: 12,
      color: b.textSecondary,
    },
    statValue: {
      marginTop: 1,
      fontSize: t.barTitle,
      lineHeight: 21,
      fontWeight: "700",
      letterSpacing: -0.4,
      color: b.text,
    },

    /* ---- tabs ---- */
    tabBar: {
      marginTop: 3,
      flexDirection: "row",
      padding: 4,
      borderRadius: round.pill,
      backgroundColor: b.fieldMuted,
    },
    tab: {
      flex: 1,
      minWidth: 0,
      height: 36,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: round.pill,
    },
    tabOn: {
      backgroundColor: "#0a7a52",
    },
    tabLabel: {
      fontSize: 11.5,
      fontWeight: "600",
      color: b.textSecondary,
    },
    tabLabelOn: {
      fontWeight: "700",
      color: b.onPrimary,
    },

    /* ---- the two-up cards ---- */
    pairRow: {
      flexDirection: "row",
      alignItems: "stretch",
      gap: 11,
    },
    pairCol: {
      flex: 1,
      minWidth: 0,
    },
    card: {
      flex: 1,
      padding: 12,
      borderWidth: 1,
      borderColor: b.border,
      borderRadius: round.panel,
      backgroundColor: b.surface,
    },
    cardTitle: {
      marginBottom: 10,
      fontSize: 13,
      lineHeight: 18,
      fontWeight: "700",
      letterSpacing: -0.3,
      color: b.text,
    },
    cardSubtitle: {
      marginTop: -6,
      marginBottom: 10,
      fontSize: 9,
      lineHeight: 13,
      color: b.textMuted,
    },

    factRow: {
      marginBottom: 9,
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
    },
    factLabel: {
      flexShrink: 1,
      minWidth: 0,
      fontSize: 9,
      color: b.textMuted,
    },
    factValue: {
      flex: 1,
      minWidth: 0,
      textAlign: "right",
      fontSize: 9.5,
      fontWeight: "600",
      color: b.text,
    },

    loadBlock: {
      marginBottom: 11,
    },
    loadHead: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    loadLabel: {
      flex: 1,
      minWidth: 0,
      fontSize: 9.5,
      fontWeight: "600",
      color: b.text,
    },
    loadCaption: {
      fontSize: 8.5,
      color: b.textMuted,
    },
    loadTrack: {
      marginTop: 5,
      height: 7,
      borderRadius: round.pill,
      overflow: "hidden",
      backgroundColor: b.tintBar,
    },
    loadFill: {
      height: "100%",
      borderRadius: round.pill,
      backgroundColor: "#0b7d52",
    },

    activityRow: {
      marginBottom: 11,
      flexDirection: "row",
      gap: 9,
    },
    activityIcon: {
      width: 28,
      height: 28,
      borderRadius: round.pill,
      alignItems: "center",
      justifyContent: "center",
    },
    activityBody: {
      flex: 1,
      minWidth: 0,
    },
    activityTitle: {
      fontSize: 9.5,
      lineHeight: 13,
      fontWeight: "600",
      color: b.text,
    },
    activityStamp: {
      marginTop: 2,
      fontSize: 8.5,
      color: b.textMuted,
    },

    /* Spaced rather than four equal columns: "Total hours" needs about twice
       the room of "Late", and splitting evenly wrapped it onto two lines. */
    attendRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    attendCell: {
      alignItems: "center",
    },
    attendDivider: {
      width: 1,
      height: 26,
      marginHorizontal: 6,
      backgroundColor: b.hairline,
    },
    attendValue: {
      fontSize: 16,
      lineHeight: 20,
      fontWeight: "700",
      color: b.text,
    },
    attendLabel: {
      marginTop: 1,
      fontSize: 8,
      color: b.textMuted,
    },
    chart: {
      marginTop: 14,
      height: 96,
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 4,
    },
    chartCol: {
      flex: 1,
      minWidth: 0,
      alignItems: "center",
      gap: 5,
    },
    chartBar: {
      width: "72%",
      borderRadius: 3,
    },
    chartLabel: {
      fontSize: 8,
      color: b.textMuted,
    },

    /* ---- permissions tab ---- */
    permRow: {
      paddingVertical: 9,
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
      borderTopWidth: 1,
      borderTopColor: b.hairline,
    },
    permLabel: {
      width: 84,
      fontSize: 9.5,
      fontWeight: "600",
      color: b.text,
    },
    permChips: {
      flex: 1,
      minWidth: 0,
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 5,
    },
    permChip: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: round.pill,
      backgroundColor: b.tintBadge,
    },
    permChipText: {
      fontSize: 9.5,
      fontWeight: "600",
      color: b.deep,
    },
    permNone: {
      fontSize: t.tagline,
      color: b.textMuted,
    },
    permLink: {
      marginTop: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    permLinkText: {
      fontSize: t.field,
      fontWeight: "700",
      color: b.primary,
    },

    /* ---- footer ---- */
    footer: {
      marginTop: 3,
      flexDirection: "row",
      gap: 11,
    },
    primaryBtn: {
      flex: 1,
      minWidth: 0,
      height: 46,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      borderRadius: round.field,
      backgroundColor: "#0b7d52",
    },
    primaryBtnText: {
      fontSize: 14,
      fontWeight: "700",
      color: b.onPrimary,
    },
    ghostBtn: {
      flex: 1,
      minWidth: 0,
      height: 46,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      borderWidth: 1,
      borderColor: b.greenBright,
      borderRadius: round.field,
      backgroundColor: b.surface,
    },
    ghostBtnText: {
      fontSize: 14,
      fontWeight: "700",
      color: b.primary,
    },

    sheetRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 13,
      borderBottomWidth: 1,
      borderBottomColor: b.hairline,
    },
    sheetLabel: {
      flex: 1,
      minWidth: 0,
      fontSize: t.field,
      color: b.text,
    },
  }),
);
