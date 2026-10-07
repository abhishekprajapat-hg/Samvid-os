import React, { useCallback, useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { AppBadge, AppButton, AppCard, AppEmptyState, AppInput, AppSheet } from "../../../components/ui";
import { palette, spacing, typography } from "../../../theme/tokens";
import { toErrorMessage } from "../../../utils/errorMessage";
import {
  getAttendanceViolations,
  reviewAttendanceViolation,
  type AttendanceViolation,
  type ViolationAction,
  type ViolationSummary,
} from "../../../services/attendanceService";
import { themedStyles, themePalette } from "../../../theme/themedStyles";

/*
 * Mirrors modules/attendance/AttendanceViolations.jsx.
 *
 * The endpoint reconciles a whole month at once, so this is month-scoped rather
 * than paginated. Every review action requires a management note - the backend
 * rejects an empty one - so the sheet makes the note mandatory rather than
 * letting the request fail.
 */

const ACTIONS: { value: ViolationAction; label: string; destructive?: boolean }[] = [
  { value: "EXCUSED", label: "Excuse" },
  { value: "WARNING_ISSUED", label: "Issue warning" },
  { value: "MANAGEMENT_REVIEW", label: "Escalate", destructive: true },
];

const monthKey = () => new Date().toISOString().slice(0, 7);

const shiftMonth = (key: string, months: number) => {
  const [year, month] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + months, 1));
  return date.toISOString().slice(0, 7);
};

const levelVariant = (level?: string) => {
  const value = String(level || "").toUpperCase();
  if (value === "MANAGEMENT_REVIEW") return "rose" as const;
  if (value === "WARNING") return "amber" as const;
  return "slate" as const;
};

const nameOf = (violation: AttendanceViolation) =>
  typeof violation.userId === "object" && violation.userId
    ? violation.userId.name || "Unknown"
    : "Unknown";

export const ViolationsSection = () => {
  const [month, setMonth] = useState(monthKey());
  const [violations, setViolations] = useState<AttendanceViolation[]>([]);
  const [summaries, setSummaries] = useState<ViolationSummary[]>([]);
  const [policyNote, setPolicyNote] = useState("");
  const [error, setError] = useState("");

  const [target, setTarget] = useState<AttendanceViolation | null>(null);
  const [action, setAction] = useState<ViolationAction>("EXCUSED");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const data = await getAttendanceViolations({ month });
      setViolations(data.violations);
      setSummaries(data.summaries);
      setPolicyNote(data.policyNote);
    } catch (err) {
      setError(toErrorMessage(err, "Could not load violations"));
    }
  }, [month]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = useCallback(async () => {
    if (!target?._id) return;
    if (!note.trim()) {
      Alert.alert("Review", "A management note is required.");
      return;
    }

    setSaving(true);
    try {
      await reviewAttendanceViolation(target._id, { action, note: note.trim() });
      setTarget(null);
      setNote("");
      await load();
    } catch (err) {
      Alert.alert("Review", toErrorMessage(err, "Could not record that review"));
    } finally {
      setSaving(false);
    }
  }, [target, action, note, load]);

  const isCurrentMonth = month === monthKey();

  return (
    <>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.stepper}>
          <AppButton title="‹" variant="secondary" size="sm" onPress={() => setMonth(shiftMonth(month, -1))} />
          <Text style={styles.stepperLabel}>{month}</Text>
          <AppButton
            title="›"
            variant="secondary"
            size="sm"
            disabled={isCurrentMonth}
            onPress={() => setMonth(shiftMonth(month, 1))}
          />
        </View>

        {summaries.length > 0 ? (
          <>
            <Text style={styles.heading}>BY PERSON</Text>
            {summaries.map((summary, index) => (
              <AppCard key={summary.userId || index} style={styles.card}>
                <View style={styles.rowHead}>
                  <Text style={styles.name} numberOfLines={1}>
                    {summary.name || "Unknown"}
                  </Text>
                  <AppBadge variant={levelVariant(summary.level)}>
                    {String(summary.level || "RECORDED").replace(/_/g, " ")}
                  </AppBadge>
                </View>
                <Text style={styles.meta}>
                  {Number(summary.rejectedLeave || 0)} rejected-leave · {Number(summary.uninformed || 0)} uninformed
                </Text>
              </AppCard>
            ))}
          </>
        ) : null}

        <Text style={styles.heading}>VIOLATIONS</Text>

        {violations.length === 0 ? (
          <AppEmptyState title="Nothing recorded" description={`No attendance violations for ${month}.`} />
        ) : (
          violations.map((violation, index) => (
            <AppCard key={violation._id || index} style={styles.card}>
              <View style={styles.rowHead}>
                <Text style={styles.name} numberOfLines={1}>
                  {nameOf(violation)}
                </Text>
                <AppBadge variant={levelVariant(violation.level)}>
                  {String(violation.level || "RECORDED").replace(/_/g, " ")}
                </AppBadge>
              </View>

              <Text style={styles.meta}>
                {violation.date} · {String(violation.kind || "").replace(/_/g, " ").toLowerCase()}
                {violation.ordinal ? ` · #${violation.ordinal}` : ""}
              </Text>

              {violation.excused ? (
                <AppBadge variant="emerald" style={styles.excused}>Excused</AppBadge>
              ) : (
                <AppButton
                  title="Review"
                  variant="secondary"
                  size="sm"
                  onPress={() => {
                    setTarget(violation);
                    setAction("EXCUSED");
                    setNote("");
                  }}
                  style={styles.reviewButton}
                />
              )}
            </AppCard>
          ))
        )}

        {policyNote ? <Text style={styles.policyNote}>{policyNote}</Text> : null}
      </ScrollView>

      <AppSheet
        visible={Boolean(target)}
        onClose={() => setTarget(null)}
        title="Review violation"
        subtitle={target ? `${nameOf(target)} · ${target.date}` : undefined}
        footer={
          <View style={styles.sheetActions}>
            <AppButton
              title="Cancel"
              variant="secondary"
              onPress={() => setTarget(null)}
              disabled={saving}
              style={styles.sheetButton}
            />
            <AppButton title="Record" onPress={submit} loading={saving} style={styles.sheetButton} />
          </View>
        }
      >
        <View style={styles.actionRow}>
          {ACTIONS.map((option) => (
            <AppButton
              key={option.value}
              title={option.label}
              size="sm"
              variant={action === option.value ? (option.destructive ? "danger" : "primary") : "secondary"}
              onPress={() => setAction(option.value)}
              style={styles.actionChip}
            />
          ))}
        </View>

        <AppInput
          label="Management note (required)"
          value={note}
          onChangeText={setNote}
          placeholder="What was decided, and why"
          multiline
        />
      </AppSheet>
    </>
  );
};

const styles = themedStyles((c) => StyleSheet.create({
  body: { paddingBottom: spacing.xxl },
  card: { marginBottom: spacing.md },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.lg,
  },
  stepperLabel: { fontSize: typography.body, fontWeight: "600", color: themePalette.slate[900] },
  heading: {
    fontSize: typography.caption,
    fontWeight: "700",
    color: themePalette.slate[500],
    letterSpacing: 0.8,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  rowHead: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  name: { flex: 1, fontSize: typography.body, fontWeight: "600", color: themePalette.slate[900] },
  meta: { marginTop: 4, fontSize: typography.label, color: themePalette.slate[500], textTransform: "capitalize" },
  reviewButton: { marginTop: spacing.lg, alignSelf: "flex-start" },
  excused: { marginTop: spacing.lg },
  policyNote: {
    marginTop: spacing.xl,
    fontSize: typography.caption,
    lineHeight: 17,
    color: themePalette.slate[500],
    fontStyle: "italic",
  },
  error: { marginBottom: spacing.lg, fontSize: typography.label, color: themePalette.rose[700] },
  actionRow: { flexDirection: "row", gap: spacing.md },
  actionChip: { flex: 1 },
  sheetActions: { flexDirection: "row", gap: spacing.md },
  sheetButton: { flex: 1 },
}));
