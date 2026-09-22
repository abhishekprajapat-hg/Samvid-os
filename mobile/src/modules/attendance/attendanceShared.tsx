import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type ViewStyle } from "react-native";
import { Icon } from "../../components/ui/Icon";
import { AppSheet } from "../../components/ui";
import { radii, spacing, typography } from "../../theme/tokens";
import { themedStyles, themePalette } from "../../theme/themedStyles";
import type { AttendanceRecord } from "../../services/attendanceService";

/*
 * The vocabulary and the repeated furniture of the Attendance module.
 *
 * Two status systems meet on this screen and it matters which is which.
 * `Attendance.status` is persisted and holds PENDING / PRESENT / LATE /
 * HALF_DAY / LEAVE / MISSED_CHECK_OUT / ABSENT. WORKING and BREAK are not
 * stored at all - the API derives them from whether someone is checked in and
 * whether a break is open. So a row reads its live state first and falls back
 * to the stored one, and the status sheet routes the two kinds to different
 * endpoints. Setting "On Break" is a break call; setting "Absent" is a status
 * patch.
 */

export type RosterRow = AttendanceRecord & {
  user?: { _id?: string; name?: string; role?: string } | null;
  onBreak?: boolean;
};

export type StatusTone = { label: string; color: string; bg: string; caps?: boolean };

/** The live state a row should show, which is not always the stored one. */
export const liveStatusOf = (row: RosterRow): string => {
  if (row.onBreak) return "BREAK";
  if (row.checkInAt && !row.checkOutAt) return "WORKING";
  return String(row.status || "PENDING").toUpperCase();
};

export const statusTone = (status?: string): StatusTone => {
  const c = themePalette;
  switch (String(status || "").toUpperCase()) {
    case "WORKING":
      return { label: "Working", color: c.emerald[700], bg: c.emerald[50] };
    case "BREAK":
    case "ON_BREAK":
      return { label: "On Break", color: c.amber[700], bg: c.amber[50] };
    case "PRESENT":
      return { label: "Present", color: c.emerald[700], bg: c.emerald[50] };
    case "LATE":
      return { label: "Late", color: c.amber[700], bg: c.amber[50] };
    case "HALF_DAY":
      return { label: "Half Day", color: c.amber[700], bg: c.amber[50] };
    case "LEAVE":
      return { label: "Leave", color: c.violet[700], bg: c.violet[50] };
    case "MISSED_CHECK_OUT":
      return { label: "No Check-out", color: c.rose[600], bg: c.rose[50] };
    case "ABSENT":
      return { label: "ABSENT", color: c.rose[600], bg: c.rose[50], caps: true };
    default:
      return { label: "Pending", color: c.slate[600], bg: c.slate[100] };
  }
};

/*
 * The six the comp's status sheet offers. `kind` is what routes the call:
 * "live" goes to the break endpoint, "status" to the status patch.
 */
export const STATUS_CHOICES: Array<{
  id: string;
  label: string;
  icon: string;
  kind: "live" | "status";
}> = [
  { id: "WORKING", label: "Working", icon: "ellipse", kind: "live" },
  { id: "BREAK", label: "On Break", icon: "time-outline", kind: "live" },
  { id: "LATE", label: "Late", icon: "alert-circle-outline", kind: "status" },
  { id: "PRESENT", label: "Present", icon: "people", kind: "status" },
  { id: "ABSENT", label: "Absent", icon: "close-circle", kind: "status" },
  { id: "LEAVE", label: "Leave", icon: "calendarDays", kind: "status" },
];

/* ------------------------------------------------------------- formatting -- */

export const formatClock = (value?: string | null): string => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date
    .toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })
    .toLowerCase();
};

export const formatDuration = (minutes?: number | null): string => {
  const total = Math.max(0, Math.round(Number(minutes || 0)));
  return `${Math.floor(total / 60)}h ${total % 60}m`;
};

export const dayKeyOf = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export const prettyRole = (role?: string): string =>
  String(role || "")
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (ch) => ch.toUpperCase()) || "Team Member";

export const initialsOf = (name = ""): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "NA";

/* ----------------------------------------------------------------- pieces -- */

/*
 * The comp's avatars are solid fills with white letters, unlike the tinted
 * ones the Tasks roster uses. Colour is derived from the name so the same
 * person keeps the same disc everywhere in the module.
 */
export const SolidAvatar = ({ name, size = 48 }: { name: string; size?: number }) => {
  const c = themePalette;
  const fills = [c.amber[600], c.violet[600], c.emerald[600], c.rose[600], c.cyan[600], c.blue[600]];
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: fills[hash % fills.length] },
      ]}
    >
      <Text style={[styles.avatarText, { fontSize: size * 0.34 }]}>{initialsOf(name)}</Text>
    </View>
  );
};

export const StatusChip = ({ status }: { status?: string }) => {
  const tone = statusTone(status);
  return (
    <View style={[styles.chip, { backgroundColor: tone.bg }]}>
      <View style={[styles.chipDot, { backgroundColor: tone.color }]} />
      <Text style={[styles.chipText, { color: tone.color }, tone.caps && styles.chipTextCaps]}>
        {tone.label}
      </Text>
    </View>
  );
};

export type AttendanceStat = {
  label: string;
  value: string;
  helper: string;
  icon: string;
  tint: string;
  color: string;
};

/** Two across, as every comp in this module draws them. */
export const StatPairGrid = ({ stats }: { stats: AttendanceStat[] }) => (
  <View style={styles.statGrid}>
    {stats.map((stat) => (
      <View key={stat.label} style={styles.statTile}>
        <View style={[styles.statIcon, { backgroundColor: stat.tint }]}>
          <Icon name={stat.icon} size={20} color={stat.color} />
        </View>
        <View style={styles.statCopy}>
          <Text style={styles.statLabel} numberOfLines={2}>
            {stat.label}
          </Text>
          <Text style={styles.statValue}>{stat.value}</Text>
          <Text style={styles.statHelper} numberOfLines={2}>
            {stat.helper}
          </Text>
        </View>
      </View>
    ))}
  </View>
);

export const SectionCard = ({
  icon,
  title,
  subtitle,
  action,
  children,
  style,
}: {
  icon?: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) => (
  <View style={[styles.card, style]}>
    <View style={styles.cardHead}>
      {icon ? (
        <View style={styles.cardIcon}>
          <Icon name={icon} size={18} color={themePalette.blue[600]} />
        </View>
      ) : null}
      <View style={styles.cardHeadCopy}>
        <Text style={styles.cardTitle}>{title}</Text>
        {subtitle ? <Text style={styles.cardSubtitle}>{subtitle}</Text> : null}
      </View>
      {action}
    </View>
    {children}
  </View>
);

/** One person on the roster, as comps 1 and 2 draw them. */
export const TeamRow = ({
  row,
  onPress,
  onMenu,
  onAction,
}: {
  row: RosterRow;
  onPress: () => void;
  onMenu: () => void;
  onAction: () => void;
}) => {
  const name = String(row.user?.name || "Team member");
  const live = liveStatusOf(row);
  // An absent row's action is to reverse that; anything else opens the sheet.
  const absent = live === "ABSENT" || live === "PENDING";

  return (
    <Pressable style={styles.row} onPress={onPress} accessibilityRole="button">
      <SolidAvatar name={name} />

      <View style={styles.rowBody}>
        <Text style={styles.rowName} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.rowRole} numberOfLines={1}>
          {prettyRole(row.user?.role)}
        </Text>
        <Text style={styles.rowTime} numberOfLines={1}>
          {row.checkInAt ? formatClock(row.checkInAt) : "–"} {"  ·  "}
          {formatDuration(row.workedMinutes)}
        </Text>
      </View>

      <View style={styles.rowRight}>
        <View style={styles.rowRightTop}>
          <StatusChip status={live} />
          <Pressable
            onPress={onMenu}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`More actions for ${name}`}
            style={styles.kebab}
          >
            <Icon name="ellipsis-vertical" size={16} color={themePalette.slate[500]} />
          </Pressable>
        </View>
        <Pressable style={styles.rowAction} onPress={onAction} accessibilityRole="button">
          <Text style={styles.rowActionText}>{absent ? "Mark Present" : "Set Status"}</Text>
        </Pressable>
      </View>
    </Pressable>
  );
};

/* ------------------------------------------------------------ status sheet -- */

/*
 * Comp 4. The effective time is kept even though the status endpoint has no
 * field for it: the backend takes `status` and `note` only, so the time is
 * prefixed onto the note rather than dropped on the floor. That way what the
 * person typed is actually recorded and readable, instead of a control that
 * looks like it did something.
 */
export const SetStatusSheet = ({
  visible,
  row,
  saving,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  row: RosterRow | null;
  saving?: boolean;
  onClose: () => void;
  onSubmit: (choiceId: string, note: string, effectiveTime: string) => void;
}) => {
  const [choice, setChoice] = useState("");
  const [note, setNote] = useState("");
  const [time, setTime] = useState("");

  useEffect(() => {
    if (!visible || !row) return;
    setChoice(liveStatusOf(row));
    setNote("");
    setTime(row.checkInAt ? formatClock(row.checkInAt).toUpperCase() : "");
  }, [visible, row]);

  if (!row) return null;
  const name = String(row.user?.name || "Team member");

  return (
    <AppSheet visible={visible} onClose={onClose} title={`Set Status for ${name}`}>
      <View style={styles.sheetLead}>
        <Text style={styles.sheetLeadText}>
          {prettyRole(row.user?.role)} · Currently
        </Text>
        <StatusChip status={liveStatusOf(row)} />
      </View>

      <Text style={styles.sheetLabel}>Attendance Status</Text>
      <View style={styles.choiceGrid}>
        {STATUS_CHOICES.map((option) => {
          const active = choice === option.id;
          const tone = statusTone(option.id);
          return (
            <Pressable
              key={option.id}
              onPress={() => setChoice(option.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[styles.choice, active && { borderColor: tone.color, backgroundColor: tone.bg }]}
            >
              <View style={[styles.choiceIcon, { backgroundColor: tone.bg }]}>
                <Icon name={option.icon} size={15} color={tone.color} />
              </View>
              <Text style={[styles.choiceText, active && { color: tone.color }]} numberOfLines={1}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.sheetFieldHead}>
        <Icon name="time-outline" size={14} color={themePalette.slate[600]} />
        <Text style={styles.sheetLabel}>Effective Time</Text>
        <Text style={styles.optional}>(Optional)</Text>
      </View>
      <View style={styles.timeField}>
        <Icon name="time-outline" size={16} color={themePalette.slate[500]} />
        <TextInput
          value={time}
          onChangeText={setTime}
          placeholder="10:50 AM"
          placeholderTextColor={themePalette.slate[400]}
          style={styles.timeInput}
        />
        {time ? (
          <Pressable onPress={() => setTime("")} hitSlop={8} accessibilityLabel="Clear time">
            <Icon name="close" size={15} color={themePalette.slate[400]} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.sheetFieldHead}>
        <Icon name="document-text-outline" size={14} color={themePalette.slate[600]} />
        <Text style={styles.sheetLabel}>Add a Note</Text>
        <Text style={styles.optional}>(Optional)</Text>
      </View>
      <TextInput
        value={note}
        onChangeText={(next) => setNote(next.slice(0, 200))}
        placeholder="Add a note (e.g. working from client site)..."
        placeholderTextColor={themePalette.slate[400]}
        style={styles.noteInput}
        multiline
        textAlignVertical="top"
      />
      <Text style={styles.counter}>{note.length}/200</Text>

      <View style={styles.sheetFooter}>
        <Pressable style={styles.cancel} onPress={onClose} accessibilityRole="button">
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <Pressable
          style={[styles.submit, saving && styles.submitBusy]}
          onPress={() => onSubmit(choice, note, time)}
          disabled={saving}
          accessibilityRole="button"
        >
          <Icon name="checkmark-circle-outline" size={17} color="#ffffff" />
          <Text style={styles.submitText}>Update Status</Text>
        </Pressable>
      </View>
    </AppSheet>
  );
};

const styles = themedStyles((c) => StyleSheet.create({
  avatar: { alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#ffffff", fontWeight: "700" },

  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: 5,
    borderRadius: radii.pill,
  },
  chipDot: { width: 7, height: 7, borderRadius: radii.pill },
  chipText: { fontSize: typography.label, fontWeight: "600" },
  chipTextCaps: { letterSpacing: 0.4 },

  statGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: spacing.md },
  statTile: {
    width: "48.5%",
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radii.lg,
    backgroundColor: c.surface,
  },
  statIcon: { width: 40, height: 40, borderRadius: radii.md, alignItems: "center", justifyContent: "center" },
  statCopy: { flex: 1, minWidth: 0 },
  statLabel: { fontSize: typography.label, color: c.slate[600] },
  statValue: { marginTop: 1, fontSize: 22, fontWeight: "800", color: c.text, letterSpacing: -0.4 },
  statHelper: { marginTop: 1, fontSize: typography.caption, color: c.slate[500] },

  card: {
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radii.lg,
    backgroundColor: c.surface,
    overflow: "hidden",
  },
  cardHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
  },
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

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: c.border,
  },
  rowBody: { flex: 1, minWidth: 0, gap: 1 },
  rowName: { fontSize: typography.title, fontWeight: "700", color: c.text },
  rowRole: { fontSize: typography.label, color: c.slate[500] },
  rowTime: { marginTop: 2, fontSize: typography.label, color: c.slate[600] },
  rowRight: { alignItems: "flex-end", gap: spacing.md },
  rowRightTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  kebab: {
    width: 30,
    height: 30,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: "center",
    justifyContent: "center",
  },
  rowAction: {
    paddingHorizontal: spacing.lg,
    height: 34,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.surface,
  },
  rowActionText: { fontSize: typography.label, fontWeight: "600", color: c.text },

  sheetLead: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.lg },
  sheetLeadText: { fontSize: typography.label, color: c.slate[500] },
  sheetLabel: { fontSize: typography.label, fontWeight: "700", color: c.slate[700] },
  sheetFieldHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  optional: { fontSize: typography.label, color: c.slate[500] },
  choiceGrid: {
    marginTop: spacing.md,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: spacing.md,
  },
  choice: {
    width: "31.5%",
    minHeight: 58,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 4,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  choiceIcon: { width: 24, height: 24, borderRadius: radii.pill, alignItems: "center", justifyContent: "center" },
  choiceText: { fontSize: typography.caption, fontWeight: "600", color: c.slate[700] },

  timeField: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    height: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  timeInput: { flex: 1, fontSize: typography.body, color: c.text },
  noteInput: {
    minHeight: 76,
    padding: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
    color: c.text,
    fontSize: typography.body,
  },
  counter: { marginTop: 4, textAlign: "right", fontSize: typography.caption, color: c.slate[400] },

  sheetFooter: { flexDirection: "row", gap: spacing.md, marginTop: spacing.xl },
  cancel: {
    flex: 1,
    height: 52,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surfaceMuted,
  },
  cancelText: { fontSize: typography.title, fontWeight: "600", color: c.slate[700] },
  submit: {
    flex: 1.5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    height: 52,
    borderRadius: radii.md,
    backgroundColor: c.blue[600],
  },
  submitBusy: { opacity: 0.7 },
  submitText: { fontSize: typography.title, fontWeight: "700", color: "#ffffff" },
}));
