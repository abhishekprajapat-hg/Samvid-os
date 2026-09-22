import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Icon } from "../../components/ui/Icon";
import { Screen } from "../../components/common/Screen";
import { AppSheet } from "../../components/ui";
import { radii, spacing, typography } from "../../theme/tokens";
import { themedStyles, themePalette } from "../../theme/themedStyles";
import { toErrorMessage } from "../../utils/errorMessage";
import {
  getAttendanceViolations,
  reviewAttendanceViolation,
  type AttendanceViolation,
  type ViolationSummary,
  type ViolationAction,
} from "../../services/attendanceService";
import { SolidAvatar, prettyRole } from "./attendanceShared";

/*
 * Comp 7: the month's policy violations, per person.
 *
 * The endpoint reconciles a whole month at once and answers with a summary
 * per employee plus the individual violations behind them, so the month is
 * the unit of navigation here rather than a date range.
 *
 * Reviewing one requires a management note - the backend rejects an empty
 * one - so the action sheet asks for it rather than sending a blank and
 * surfacing a 400.
 */

const levelTone = (level?: string) => {
  const c = themePalette;
  switch (String(level || "").toUpperCase()) {
    case "MANAGEMENT_REVIEW":
      return { label: "Management Review", color: c.rose[600], bg: c.rose[50] };
    case "WARNING":
      return { label: "Warning", color: c.amber[700], bg: c.amber[50] };
    default:
      return { label: "Recorded", color: c.slate[600], bg: c.slate[100] };
  }
};

const monthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const shiftMonth = (key: string, step: number) => {
  const [year, month] = key.split("-").map(Number);
  const next = new Date(year, (month || 1) - 1 + step, 1);
  return monthKey(next);
};

const ACTIONS: Array<{ id: ViolationAction; label: string }> = [
  { id: "WARNING_ISSUED", label: "Issue a warning" },
  { id: "MANAGEMENT_REVIEW", label: "Escalate to management review" },
  { id: "EXCUSED", label: "Excuse this violation" },
];

export const AttendanceViolationsScreen = () => {
  const navigation = useNavigation<any>();
  const [month, setMonth] = useState(() => monthKey(new Date()));
  const [summaries, setSummaries] = useState<ViolationSummary[]>([]);
  const [violations, setViolations] = useState<AttendanceViolation[]>([]);
  const [policyNote, setPolicyNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [target, setTarget] = useState<ViolationSummary | null>(null);
  const [action, setAction] = useState<ViolationAction>("MANAGEMENT_REVIEW");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(
    async (quiet = false) => {
      try {
        if (quiet) setRefreshing(true);
        else setLoading(true);
        setError("");
        const result = await getAttendanceViolations({ month });
        setSummaries(result.summaries || []);
        setViolations(result.violations || []);
        setPolicyNote(result.policyNote || "");
      } catch (err) {
        setError(toErrorMessage(err, "Could not load attendance violations"));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [month],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const totals = useMemo(() => {
    const employees = summaries.filter(
      (row) => Number(row.rejectedLeave || 0) + Number(row.uninformed || 0) > 0,
    ).length;
    const count = summaries.reduce(
      (sum, row) => sum + Number(row.rejectedLeave || 0) + Number(row.uninformed || 0),
      0,
    );
    const rate = summaries.length ? Math.round((employees / summaries.length) * 100) : 0;
    return { employees, count, rate };
  }, [summaries]);

  /* The most serious open violation for a person is the one a review acts on. */
  const violationFor = (userId?: string) =>
    violations.find((row) => {
      const id = typeof row.userId === "object" ? String(row.userId?._id || "") : String(row.userId || "");
      return id === String(userId || "") && row.active !== false && !row.excused;
    });

  const submitReview = async () => {
    if (!target) return;
    const violation = violationFor(target.userId);
    if (!violation?._id) {
      setError("There is no open violation to review for this person.");
      setTarget(null);
      return;
    }
    if (!note.trim()) {
      setError("A management note is required to review a violation.");
      return;
    }
    setSaving(true);
    try {
      await reviewAttendanceViolation(String(violation._id), { action, note: note.trim() });
      setTarget(null);
      setNote("");
      await load(true);
    } catch (err) {
      setError(toErrorMessage(err, "Could not review the violation"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen
      title={`Monthly Attendance Violations — ${month}`}
      description="Track policy violations and attendance insights"
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
      <ScrollView
        contentContainerStyle={styles.page}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
      >
        <View style={styles.monthRow}>
          <Pressable style={styles.monthButton} onPress={() => setMonth(shiftMonth(month, -1))} accessibilityRole="button" accessibilityLabel="Previous month">
            <Icon name="chevron-back" size={17} color={themePalette.slate[700]} />
          </Pressable>
          <Text style={styles.monthLabel}>
            {new Date(`${month}-01T12:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
          </Text>
          <Pressable style={styles.monthButton} onPress={() => setMonth(shiftMonth(month, 1))} accessibilityRole="button" accessibilityLabel="Next month">
            <Icon name="chevron-forward" size={17} color={themePalette.slate[700]} />
          </Pressable>
        </View>

        <View style={styles.statRow}>
          {[
            { value: String(totals.employees), label: "Total Employees", helper: "with violations", icon: "admin", tint: themePalette.rose[50], color: themePalette.rose[600] },
            { value: String(totals.count), label: "Total Violations", helper: "this month", icon: "calendarDays", tint: themePalette.violet[50], color: themePalette.violet[600] },
            { value: `${totals.rate}%`, label: "Violation Rate", helper: "of active team", icon: "people", tint: themePalette.emerald[50], color: themePalette.emerald[600] },
          ].map((stat) => (
            <View key={stat.label} style={styles.statTile}>
              <View style={[styles.statIcon, { backgroundColor: stat.tint }]}>
                <Icon name={stat.icon} size={17} color={stat.color} />
              </View>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel} numberOfLines={1}>{stat.label}</Text>
              <Text style={styles.statHelper} numberOfLines={1}>{stat.helper}</Text>
            </View>
          ))}
        </View>

        {policyNote ? (
          <View style={styles.notice}>
            <Icon name="alert-circle-outline" size={18} color={themePalette.amber[700]} />
            <Text style={styles.noticeText}>{policyNote}</Text>
          </View>
        ) : null}

        {summaries.length === 0 ? (
          <Text style={styles.empty}>No violations recorded this month.</Text>
        ) : (
          summaries.map((row) => {
            const tone = levelTone(row.level);
            const name = String(row.name || "Team member");
            return (
              <Pressable
                key={String(row.userId)}
                style={styles.card}
                onPress={() => {
                  setTarget(row);
                  setAction("MANAGEMENT_REVIEW");
                  setNote("");
                }}
                accessibilityRole="button"
              >
                <View style={styles.cardHead}>
                  <SolidAvatar name={name} />
                  <View style={styles.cardCopy}>
                    <Text style={styles.name} numberOfLines={1}>{name}</Text>
                    <Text style={styles.role} numberOfLines={1}>{prettyRole(row.role)}</Text>
                  </View>
                  <View style={styles.cardRight}>
                    <View style={styles.levelChip}>
                      <View style={styles.levelDot} />
                      <Text style={styles.levelChipText}>Recorded</Text>
                    </View>
                    {String(row.level || "").toUpperCase() === "MANAGEMENT_REVIEW" ? (
                      <View style={[styles.levelChip, { backgroundColor: tone.bg }]}>
                        <View style={[styles.levelDot, { backgroundColor: tone.color }]} />
                        <Text style={[styles.levelChipText, { color: tone.color }]}>{tone.label}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Pressable
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={`Review ${name}`}
                    onPress={() => {
                      setTarget(row);
                      setAction("MANAGEMENT_REVIEW");
                      setNote("");
                    }}
                    style={styles.kebab}
                  >
                    <Icon name="ellipsis-vertical" size={16} color={themePalette.slate[500]} />
                  </Pressable>
                </View>

                <View style={styles.countRow}>
                  <View style={styles.count}>
                    <Text style={styles.countValue}>{Number(row.rejectedLeave || 0)}</Text>
                    <Text style={styles.countLabel}>Rejected leave</Text>
                  </View>
                  <View style={styles.countDivider} />
                  <View style={styles.count}>
                    <Text style={styles.countValue}>{Number(row.uninformed || 0)}</Text>
                    <Text style={styles.countLabel}>Uninformed</Text>
                  </View>
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>

      <AppSheet
        visible={!!target}
        onClose={() => setTarget(null)}
        title={target ? `Review ${target.name}` : undefined}
        subtitle="A management note is required"
      >
        {ACTIONS.map((option) => (
          <Pressable
            key={option.id}
            style={styles.option}
            onPress={() => setAction(option.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: action === option.id }}
          >
            <Text style={[styles.optionText, action === option.id && styles.optionTextActive]}>
              {option.label}
            </Text>
            {action === option.id ? (
              <Icon name="checkmark" size={16} color={themePalette.blue[600]} />
            ) : null}
          </Pressable>
        ))}

        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Why is this being recorded?"
          placeholderTextColor={themePalette.slate[400]}
          style={styles.noteInput}
          multiline
          textAlignVertical="top"
        />

        <Pressable
          style={[styles.submit, saving && styles.busy]}
          onPress={submitReview}
          disabled={saving}
          accessibilityRole="button"
        >
          <Icon name="checkmark" size={17} color="#ffffff" />
          <Text style={styles.submitText}>Save review</Text>
        </Pressable>
      </AppSheet>
    </Screen>
  );
};

const styles = themedStyles((c) => StyleSheet.create({
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

  monthRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  monthButton: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.surface,
  },
  monthLabel: { flex: 1, textAlign: "center", fontSize: typography.title, fontWeight: "700", color: c.text },

  statRow: { flexDirection: "row", gap: spacing.md },
  statTile: {
    flex: 1,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radii.lg,
    backgroundColor: c.surface,
  },
  statIcon: {
    width: 34,
    height: 34,
    borderRadius: radii.sm,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  statValue: { fontSize: 22, fontWeight: "800", color: c.text, letterSpacing: -0.4 },
  statLabel: { fontSize: typography.caption, fontWeight: "600", color: c.slate[700] },
  statHelper: { fontSize: typography.caption, color: c.slate[500] },

  notice: {
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.amber[200],
    backgroundColor: c.amber[50],
  },
  noticeText: { flex: 1, fontSize: typography.label, lineHeight: 19, color: c.amber[900] },

  card: {
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radii.lg,
    backgroundColor: c.surface,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  cardHead: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  cardCopy: { flex: 1, minWidth: 0 },
  name: { fontSize: typography.title, fontWeight: "700", color: c.text },
  role: { marginTop: 1, fontSize: typography.label, color: c.slate[500] },
  cardRight: { alignItems: "flex-end", gap: spacing.sm },
  levelChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: 5,
    borderRadius: radii.pill,
    backgroundColor: c.slate[100],
  },
  levelDot: { width: 7, height: 7, borderRadius: radii.pill, backgroundColor: c.slate[500] },
  levelChipText: { fontSize: typography.caption, fontWeight: "600", color: c.slate[600] },
  kebab: {
    width: 30,
    height: 30,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: "center",
    justifyContent: "center",
  },

  countRow: { flexDirection: "row", alignItems: "center" },
  count: { flex: 1 },
  countDivider: { width: 1, height: 30, backgroundColor: c.border },
  countValue: { fontSize: typography.displayMd, fontWeight: "800", color: c.text },
  countLabel: { fontSize: typography.caption, color: c.slate[500] },

  empty: { paddingVertical: 60, textAlign: "center", fontSize: typography.label, color: c.slate[400] },

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
  noteInput: {
    marginTop: spacing.lg,
    minHeight: 84,
    padding: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
    color: c.text,
    fontSize: typography.body,
  },
  submit: {
    marginTop: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    height: 52,
    borderRadius: radii.md,
    backgroundColor: c.blue[600],
  },
  busy: { opacity: 0.7 },
  submitText: { fontSize: typography.title, fontWeight: "700", color: "#ffffff" },
}));

export default AttendanceViolationsScreen;
