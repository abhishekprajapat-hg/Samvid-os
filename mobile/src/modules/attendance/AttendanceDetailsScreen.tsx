import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Icon } from "../../components/ui/Icon";
import { Screen } from "../../components/common/Screen";
import { radii, spacing, typography } from "../../theme/tokens";
import { themedStyles, themePalette } from "../../theme/themedStyles";
import { toErrorMessage } from "../../utils/errorMessage";
import {
  getAttendancePolicy,
  getUserAttendanceForAdmin,
  manageUserBreak,
  updateUserAttendanceStatus,
  type AttendancePolicy,
} from "../../services/attendanceService";
import {
  SetStatusSheet,
  SolidAvatar,
  STATUS_CHOICES,
  StatusChip,
  formatClock,
  formatDuration,
  liveStatusOf,
  prettyRole,
  statusTone,
  type RosterRow,
} from "./attendanceShared";
import { BreakCorrectionSheet } from "./components/BreakCorrectionSheet";

/*
 * Comp 3: one person, one day.
 *
 * The timeline is assembled from the record rather than from an event log -
 * there is no attendance audit endpoint. Check-in, every break in `breaks`,
 * the return from each break, check-out and the live tail are all facts the
 * record already carries, so the rail is accurate; it just cannot show
 * anything the record does not store, such as a status edit.
 */

type TimelineEntry = {
  id: string;
  at: string | null;
  title: string;
  subtitle: string;
  icon: string;
  tone: "emerald" | "amber" | "blue" | "slate";
  chip?: string;
  open?: boolean;
};

const buildTimeline = (record: RosterRow | null, policy: AttendancePolicy | null): TimelineEntry[] => {
  if (!record) return [];
  const entries: TimelineEntry[] = [];
  const graceMinutes = Number(policy?.graceMinutes ?? 0);
  const late = Number(record.lateMinutes || 0);

  if (record.checkInAt) {
    entries.push({
      id: "in",
      at: record.checkInAt,
      title: "Checked In",
      subtitle: "Office location verified",
      icon: "arrow-redo-outline",
      tone: "emerald",
      chip: late > graceMinutes ? `${late}m late` : "On time",
    });
  }

  (record.breaks || []).forEach((slot, index) => {
    if (slot.startedAt) {
      entries.push({
        id: `break-${index}`,
        at: slot.startedAt,
        title: "Went on Break",
        subtitle: slot.reason || "Break",
        icon: "time-outline",
        tone: "amber",
        chip: slot.minutes ? `${Math.round(Number(slot.minutes))}m` : undefined,
        open: !slot.endedAt,
      });
    }
    if (slot.endedAt) {
      entries.push({
        id: `resume-${index}`,
        at: slot.endedAt,
        title: "Resumed Work",
        subtitle: "Back from break",
        icon: "play",
        tone: "emerald",
      });
    }
  });

  if (record.checkOutAt) {
    entries.push({
      id: "out",
      at: record.checkOutAt,
      title: "Checked Out",
      subtitle: `Worked ${formatDuration(record.workedMinutes)}`,
      icon: "arrow-redo-outline",
      tone: "slate",
    });
  } else if (record.checkInAt) {
    const live = liveStatusOf(record);
    entries.push({
      id: "live",
      at: null,
      title: live === "BREAK" ? "On Break" : "Working",
      subtitle: `Active for ${formatDuration(record.workedMinutes)}`,
      icon: "ellipse",
      tone: "blue",
      chip: "In Progress",
      open: true,
    });
  }

  return entries;
};

export const AttendanceDetailsScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const userId = String(route.params?.userId || "");
  const date = String(route.params?.date || "");

  const [record, setRecord] = useState<RosterRow | null>(null);
  const [person, setPerson] = useState<{ name?: string; role?: string } | null>(null);
  const [policy, setPolicy] = useState<AttendancePolicy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [breaksOpen, setBreaksOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!userId || !date) {
      setError("This attendance record could not be opened.");
      setLoading(false);
      return;
    }
    try {
      setError("");
      const [result, policyRow] = await Promise.allSettled([
        getUserAttendanceForAdmin(userId, { from: date, to: date }),
        getAttendancePolicy(),
      ]);
      if (result.status === "fulfilled") {
        setPerson(result.value.user || null);
        setRecord(((result.value.attendance || [])[0] || null) as RosterRow | null);
      } else {
        setError(toErrorMessage(result.reason, "Could not load this attendance record"));
      }
      if (policyRow.status === "fulfilled") setPolicy(policyRow.value);
    } finally {
      setLoading(false);
    }
  }, [userId, date]);

  useEffect(() => {
    void load();
  }, [load]);

  const rowForSheet: RosterRow | null = useMemo(
    () => (record ? { ...record, user: { _id: userId, ...(person || {}) } } : null),
    [record, person, userId],
  );

  const timeline = useMemo(() => buildTimeline(record, policy), [record, policy]);
  const live = record ? liveStatusOf(record) : "PENDING";
  const name = String(person?.name || "Team member");
  const firstName = name.split(/\s+/)[0];
  const targetMinutes = Number(policy?.fullDayMinutes ?? 540);
  const radius = Number((policy as any)?.officeRadiusMeters ?? 200);
  const geofenced = Boolean((policy as any)?.geofenceEnabled);
  const lat = (policy as any)?.officeLatitude;
  const lng = (policy as any)?.officeLongitude;

  const applyStatus = async (choiceId: string, note: string, effectiveTime: string, breakType = "UTILITY") => {
    const choice = STATUS_CHOICES.find((option) => option.id === choiceId);
    if (!choice) return;
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
      setSheetOpen(false);
      await load();
    } catch (err) {
      setError(toErrorMessage(err, "Could not update the status"));
    } finally {
      setSaving(false);
    }
  };

  const markAbsent = async () => {
    setSaving(true);
    try {
      await updateUserAttendanceStatus(userId, date, { status: "ABSENT", note: "" });
      await load();
    } catch (err) {
      setError(toErrorMessage(err, "Could not mark absent"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen
      title="Attendance Details"
      description="View detailed attendance information for team members"
      back={() => navigation.goBack()}
      loading={loading}
      error={error}
      onRetry={() => load()}
    >
      <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.personRow}>
            <SolidAvatar name={name} size={52} photo={String((person as { profileImageUrl?: string } | null | undefined)?.profileImageUrl || "")} />
            <View style={styles.personCopy}>
              <Text style={styles.personName} numberOfLines={1}>{name}</Text>
              <Text style={styles.personRole} numberOfLines={1}>{prettyRole(person?.role)}</Text>
            </View>
            <StatusChip status={live} />
          </View>

          <View style={styles.factStrip}>
            {[
              { label: "Date", value: new Date(`${date}T12:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" }), icon: "calendarDays", tint: themePalette.blue[50], color: themePalette.blue[600] },
              { label: "Check In", value: formatClock(record?.checkInAt), icon: "time-outline", tint: themePalette.emerald[50], color: themePalette.emerald[600] },
              { label: "Check Out", value: record?.checkOutAt ? formatClock(record.checkOutAt) : "-", icon: "arrow-redo-outline", tint: themePalette.rose[50], color: themePalette.rose[600] },
              { label: "Total Hours", value: formatDuration(record?.workedMinutes), icon: "barChart", tint: themePalette.violet[50], color: themePalette.violet[600] },
            ].map((fact) => (
              <View key={fact.label} style={styles.fact}>
                <View style={[styles.factIcon, { backgroundColor: fact.tint }]}>
                  <Icon name={fact.icon} size={15} color={fact.color} />
                </View>
                <View style={styles.factCopy}>
                  <Text style={styles.factLabel} numberOfLines={1}>{fact.label}</Text>
                  <Text style={styles.factValue} numberOfLines={1}>{fact.value}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={[styles.banner, { backgroundColor: statusTone(live).bg }]}>
          <View style={[styles.bannerDot, { backgroundColor: statusTone(live).color }]} />
          <View style={styles.bannerCopy}>
            <Text style={[styles.bannerTitle, { color: statusTone(live).color }]}>
              {live === "WORKING" ? "Currently Working" : statusTone(live).label}
            </Text>
            <Text style={styles.bannerText}>
              {live === "WORKING"
                ? `${firstName} is currently checked in and working.`
                : live === "BREAK"
                  ? `${firstName} is on a break right now.`
                  : `${firstName} is marked ${statusTone(live).label.toLowerCase()} for this day.`}
            </Text>
          </View>
        </View>

        <View style={styles.tileRow}>
          {[
            { label: "Work Duration", value: formatDuration(record?.workedMinutes), helper: `Out of ${Math.round(targetMinutes / 60)}h target`, icon: "barChart", tint: themePalette.violet[50], color: themePalette.violet[600] },
            { label: "Break Duration", value: formatDuration(record?.breakMinutes), helper: `${(record?.breaks || []).length} breaks today`, icon: "time-outline", tint: themePalette.amber[50], color: themePalette.amber[600] },
            { label: "Location Status", value: geofenced ? "In Office" : "Not tracked", helper: geofenced ? "Within allowed radius" : "Geofence is off", icon: "location-outline", tint: themePalette.blue[50], color: themePalette.blue[600] },
          ].map((tile) => (
            <View key={tile.label} style={styles.tile}>
              <View style={[styles.tileIcon, { backgroundColor: tile.tint }]}>
                <Icon name={tile.icon} size={17} color={tile.color} />
              </View>
              <Text style={styles.tileLabel} numberOfLines={1}>{tile.label}</Text>
              <Text style={styles.tileValue} numberOfLines={1}>{tile.value}</Text>
              <Text style={styles.tileHelper} numberOfLines={2}>{tile.helper}</Text>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHead}>
            <View style={styles.sectionIcon}>
              <Icon name="arrow-redo-outline" size={17} color={themePalette.blue[600]} />
            </View>
            <Text style={styles.sectionTitle}>Attendance Timeline</Text>
            <View style={styles.spacer} />
            {!record?.checkOutAt && record?.checkInAt ? (
              <View style={styles.livePill}>
                <View style={styles.liveDot} />
                <Text style={styles.livePillText}>Live Updates</Text>
              </View>
            ) : null}
          </View>

          {timeline.length === 0 ? (
            <Text style={styles.empty}>Nothing recorded for this day yet.</Text>
          ) : (
            <View style={styles.timeline}>
              {timeline.map((entry, index) => {
                const tone = themePalette[entry.tone === "slate" ? "slate" : entry.tone];
                return (
                  <View key={entry.id} style={styles.timelineRow}>
                    <View style={styles.rail}>
                      <View style={[styles.railDot, entry.open ? { borderColor: tone[500] } : { backgroundColor: tone[500], borderColor: tone[500] }]} />
                      {index < timeline.length - 1 ? <View style={styles.railLine} /> : null}
                    </View>
                    <View style={[styles.timelineIcon, { backgroundColor: tone[50] }]}>
                      <Icon name={entry.icon} size={15} color={tone[600]} />
                    </View>
                    <Text style={styles.timelineTime}>{entry.at ? formatClock(entry.at) : "Currently"}</Text>
                    <View style={styles.timelineCopy}>
                      <Text style={styles.timelineTitle} numberOfLines={1}>{entry.title}</Text>
                      <Text style={styles.timelineSub} numberOfLines={1}>{entry.subtitle}</Text>
                    </View>
                    {entry.chip ? (
                      <View style={[styles.timelineChip, { backgroundColor: tone[50] }]}>
                        <Text style={[styles.timelineChipText, { color: tone[700] }]}>{entry.chip}</Text>
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHead}>
            <View style={styles.sectionIcon}>
              <Icon name="alert-circle-outline" size={17} color={themePalette.blue[600]} />
            </View>
            <Text style={styles.sectionTitle}>Additional Information</Text>
          </View>
          <View style={styles.infoRow}>
            <View style={styles.info}>
              <View style={[styles.factIcon, { backgroundColor: themePalette.blue[50] }]}>
                <Icon name="location-outline" size={15} color={themePalette.blue[600]} />
              </View>
              <View style={styles.factCopy}>
                <Text style={styles.factLabel}>Office Location</Text>
                <Text style={styles.factValue} numberOfLines={1}>
                  {lat != null && lng != null ? `${lat}, ${lng}` : "Not set"}
                </Text>
                <Text style={styles.factHelper}>Within {radius} meters</Text>
              </View>
            </View>
            <View style={styles.info}>
              <View style={[styles.factIcon, { backgroundColor: themePalette.rose[50] }]}>
                <Icon name="targets" size={15} color={themePalette.rose[600]} />
              </View>
              <View style={styles.factCopy}>
                <Text style={styles.factLabel}>Allowed Radius</Text>
                <Text style={styles.factValue}>{radius} meters</Text>
                <View style={styles.rangeRow}>
                  <Icon
                    name={geofenced ? "checkmark-circle-outline" : "close-circle"}
                    size={13}
                    color={geofenced ? themePalette.emerald[600] : themePalette.slate[400]}
                  />
                  <Text style={[styles.factHelper, geofenced && { color: themePalette.emerald[600] }]}>
                    {geofenced ? "Within range" : "Geofence off"}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.footer}>
          <Pressable style={styles.absent} onPress={markAbsent} disabled={saving} accessibilityRole="button">
            <Icon name="close-circle" size={17} color={themePalette.rose[600]} />
            <Text style={styles.absentText}>Mark Absent</Text>
          </Pressable>
          <Pressable style={styles.setStatus} onPress={() => setSheetOpen(true)} accessibilityRole="button">
            <Icon name="create-outline" size={17} color={themePalette.blue[600]} />
            <Text style={styles.setStatusText}>Set Status</Text>
          </Pressable>
        </View>
        {record?.checkInAt ? (
          <Pressable style={styles.manageBreaks} onPress={() => setBreaksOpen(true)} accessibilityRole="button">
            <Icon name="time-outline" size={17} color={themePalette.amber[700]} />
            <Text style={styles.manageBreaksText}>Manage breaks</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      <BreakCorrectionSheet
        visible={breaksOpen}
        userId={userId}
        userName={name}
        date={date}
        attendance={record}
        onClose={() => setBreaksOpen(false)}
        onSaved={() => {
          setBreaksOpen(false);
          void load();
        }}
      />

      <SetStatusSheet
        visible={sheetOpen}
        row={rowForSheet}
        saving={saving}
        onClose={() => setSheetOpen(false)}
        onSubmit={applyStatus}
      />
    </Screen>
  );
};

const styles = themedStyles((c) => StyleSheet.create({
  page: { gap: spacing.lg, paddingBottom: spacing.xxl },
  card: {
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radii.lg,
    backgroundColor: c.surface,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  spacer: { flex: 1 },

  personRow: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  personCopy: { flex: 1, minWidth: 0 },
  personName: { fontSize: 19, fontWeight: "800", color: c.text, letterSpacing: -0.3 },
  personRole: { marginTop: 1, fontSize: typography.label, color: c.slate[500] },

  factStrip: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: c.border,
    paddingTop: spacing.lg,
  },
  fact: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm, minWidth: 0 },
  factIcon: { width: 30, height: 30, borderRadius: radii.sm, alignItems: "center", justifyContent: "center" },
  factCopy: { flex: 1, minWidth: 0 },
  factLabel: { fontSize: typography.caption, color: c.slate[500] },
  factValue: { fontSize: typography.label, fontWeight: "700", color: c.text },
  factHelper: { fontSize: typography.caption, color: c.slate[500] },

  banner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.lg,
  },
  bannerDot: { marginTop: 5, width: 10, height: 10, borderRadius: radii.pill },
  bannerCopy: { flex: 1, minWidth: 0 },
  bannerTitle: { fontSize: typography.title, fontWeight: "700" },
  bannerText: { marginTop: 2, fontSize: typography.label, color: c.slate[600] },

  tileRow: { flexDirection: "row", gap: spacing.md },
  tile: {
    flex: 1,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radii.lg,
    backgroundColor: c.surface,
    gap: 2,
  },
  tileIcon: {
    width: 34,
    height: 34,
    borderRadius: radii.sm,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  tileLabel: { fontSize: typography.caption, color: c.slate[500] },
  tileValue: { fontSize: typography.title, fontWeight: "800", color: c.text },
  tileHelper: { fontSize: typography.caption, color: c.slate[500] },

  sectionHead: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  sectionIcon: {
    width: 34,
    height: 34,
    borderRadius: radii.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.blue[50],
  },
  sectionTitle: { fontSize: typography.title, fontWeight: "700", color: c.text },
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: 5,
    borderRadius: radii.pill,
    backgroundColor: c.emerald[50],
  },
  liveDot: { width: 7, height: 7, borderRadius: radii.pill, backgroundColor: c.emerald[500] },
  livePillText: { fontSize: typography.caption, fontWeight: "700", color: c.emerald[700] },

  timeline: { gap: spacing.lg },
  timelineRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  rail: { width: 12, alignSelf: "stretch", alignItems: "center" },
  railDot: { marginTop: 12, width: 11, height: 11, borderRadius: radii.pill, borderWidth: 2 },
  railLine: { flex: 1, width: 1.5, marginTop: 3, backgroundColor: c.border },
  timelineIcon: { width: 36, height: 36, borderRadius: radii.pill, alignItems: "center", justifyContent: "center" },
  timelineTime: { width: 62, fontSize: typography.label, color: c.slate[600] },
  timelineCopy: { flex: 1, minWidth: 0 },
  timelineTitle: { fontSize: typography.section, fontWeight: "700", color: c.text },
  timelineSub: { marginTop: 1, fontSize: typography.caption, color: c.slate[500] },
  timelineChip: { paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radii.pill },
  timelineChipText: { fontSize: typography.caption, fontWeight: "700" },

  infoRow: { flexDirection: "row", gap: spacing.lg },
  info: { flex: 1, flexDirection: "row", gap: spacing.md, minWidth: 0 },
  rangeRow: { flexDirection: "row", alignItems: "center", gap: 4 },

  empty: { paddingVertical: spacing.xxl, textAlign: "center", fontSize: typography.label, color: c.slate[400] },

  footer: { flexDirection: "row", gap: spacing.md },
  manageBreaks: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 46,
    borderWidth: 1,
    borderColor: c.amber[200],
    borderRadius: radii.md,
    backgroundColor: c.amber[50],
  },
  manageBreaksText: { fontSize: 14, fontWeight: "700", color: c.amber[800] },
  absent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    height: 54,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.rose[200],
    backgroundColor: c.rose[50],
  },
  absentText: { fontSize: typography.title, fontWeight: "700", color: c.rose[600] },
  setStatus: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    height: 54,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.blue[200],
    backgroundColor: c.blue[50],
  },
  setStatusText: { fontSize: typography.title, fontWeight: "700", color: c.blue[600] },
}));

export default AttendanceDetailsScreen;
