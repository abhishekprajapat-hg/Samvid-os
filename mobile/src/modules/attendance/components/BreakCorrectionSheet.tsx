import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { AppButton } from "../../../components/common/ui";
import { AppSheet } from "../../../components/ui/Overlay";
import { correctUserBreak } from "../../../services/attendanceService";
import { toErrorMessage } from "../../../utils/errorMessage";
import { themedStyles, themePalette } from "../../../theme/themedStyles";

/*
 * Manage breaks - web's BreakCorrectionDialog.
 *
 * Add a break someone forgot to start, or correct one already recorded. Every
 * correction carries a reason, and the server records who made it and when;
 * the history is listed underneath, newest first. The save carries the record's
 * `updatedAt`, so a change made elsewhere meanwhile is refused (409) rather
 * than overwritten.
 *
 * Web uses datetime-local inputs. A break sits inside one working day, so the
 * phone asks for the times alone, as 24-hour HH:MM on the attendance date.
 */

type Session = { startAt?: string; endAt?: string | null; breakType?: string };

const pad = (value: number) => String(value).padStart(2, "0");
const toClock = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : `${pad(date.getHours())}:${pad(date.getMinutes())}`;
};
const toIso = (date: string, clock: string) => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(clock.trim());
  if (!match) return null;
  const [y, m, d] = date.split("-").map(Number);
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return new Date(y, m - 1, d, hours, minutes).toISOString();
};

export const BreakCorrectionSheet = ({
  visible,
  userId,
  userName,
  date,
  attendance,
  onClose,
  onSaved,
}: {
  visible: boolean;
  userId: string;
  userName: string;
  date: string;
  attendance: any;
  onClose: () => void;
  onSaved: () => void;
}) => {
  const sessions: Session[] = Array.isArray(attendance?.breakSessions) ? attendance.breakSessions : [];
  const audit: any[] = Array.isArray(attendance?.breakAudit) ? attendance.breakAudit : [];
  const [index, setIndex] = useState<number | null>(null);
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!visible) return;
    setIndex(null);
    setStartAt("");
    setEndAt("");
    setReason("");
    setError("");
  }, [visible]);

  const selectSession = (value: number | null) => {
    setIndex(value);
    const session = value === null ? null : sessions[value];
    setStartAt(toClock(session?.startAt));
    setEndAt(toClock(session?.endAt));
    setReason("");
    setError("");
  };

  const submit = async () => {
    const start = toIso(date, startAt);
    const end = endAt.trim() ? toIso(date, endAt) : null;
    if (!start) return setError("Enter the start time as HH:MM.");
    if (endAt.trim() && !end) return setError("Enter the end time as HH:MM.");
    if (attendance?.checkOutAt && !end) return setError("An end time is required once the day is checked out.");
    if (end && new Date(end) <= new Date(start)) return setError("The end time must be after the start time.");
    setSaving(true);
    setError("");
    try {
      await correctUserBreak(userId, date, {
        sessionIndex: index,
        startAt: start,
        endAt: end,
        reason: reason.trim(),
        expectedUpdatedAt: attendance?.updatedAt,
      });
      onSaved();
    } catch (err) {
      setError(toErrorMessage(err, "Failed to save break"));
    } finally {
      setSaving(false);
    }
  };

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <AppSheet
      visible={visible}
      onClose={onClose}
      title={`Manage breaks · ${userName}`}
      subtitle={`Attendance: ${date}. Times are in ${timezone}. Every correction records your name, role, time, and reason.`}
      footer={
        <AppButton
          title={saving ? "Saving…" : index === null ? "Add break" : "Save correction"}
          onPress={submit}
          disabled={saving || !reason.trim()}
        />
      }
    >
      <Text style={styles.label}>Break session</Text>
      <Pressable style={[styles.option, index === null && styles.optionOn]} onPress={() => selectSession(null)}>
        <Text style={[styles.optionText, index === null && styles.optionTextOn]}>Add missed break</Text>
      </Pressable>
      {sessions.map((session, i) => (
        <Pressable key={i} style={[styles.option, index === i && styles.optionOn]} onPress={() => selectSession(i)}>
          <Text style={[styles.optionText, index === i && styles.optionTextOn]}>
            Break {i + 1}: {toClock(session.startAt) || "--"} — {session.endAt ? toClock(session.endAt) : "Ongoing"}
          </Text>
        </Pressable>
      ))}

      <View style={styles.row}>
        <View style={styles.col}>
          <Text style={styles.label}>Start time</Text>
          <TextInput style={styles.input} value={startAt} onChangeText={setStartAt} placeholder="13:30" placeholderTextColor={themePalette.slate[400]} keyboardType="numbers-and-punctuation" />
        </View>
        <View style={styles.col}>
          <Text style={styles.label}>End time{attendance?.checkOutAt ? "" : " (blank = ongoing)"}</Text>
          <TextInput style={styles.input} value={endAt} onChangeText={setEndAt} placeholder="14:00" placeholderTextColor={themePalette.slate[400]} keyboardType="numbers-and-punctuation" />
        </View>
      </View>

      <Text style={styles.label}>Reason for correction</Text>
      <TextInput
        style={[styles.input, styles.area]}
        value={reason}
        onChangeText={(value) => setReason(value.slice(0, 240))}
        placeholder="Explain why this break needs to be added or corrected"
        placeholderTextColor={themePalette.slate[400]}
        multiline
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {audit.length ? (
        <View style={styles.history}>
          <Text style={styles.historyTitle}>Correction history</Text>
          {[...audit].reverse().map((entry, i) => (
            <Text key={i} style={styles.historyRow}>
              <Text style={styles.historyWho}>{entry.actorName || "Manager/Admin"} ({entry.actorRole})</Text>
              {" · "}
              {new Date(entry.changedAt).toLocaleString("en-IN")}
              {"\n"}Break {Number(entry.sessionIndex) + 1}: {entry.reason}
            </Text>
          ))}
        </View>
      ) : null}
    </AppSheet>
  );
};

const styles = themedStyles((c) =>
  StyleSheet.create({
    label: { marginTop: 10, marginBottom: 6, fontSize: 12, fontWeight: "600", color: c.slate[700] },
    option: { paddingVertical: 10, paddingHorizontal: 12, marginBottom: 6, borderRadius: 8, borderWidth: 1, borderColor: c.border },
    optionOn: { borderColor: c.blue[500], backgroundColor: c.blue[50] },
    optionText: { fontSize: 13, color: c.text },
    optionTextOn: { fontWeight: "700", color: c.blue[700] },
    row: { flexDirection: "row", gap: 10 },
    col: { flex: 1 },
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
    area: { height: 84, paddingTop: 10, textAlignVertical: "top" },
    error: { marginTop: 8, fontSize: 12, fontWeight: "600", color: c.rose[700] },
    history: { marginTop: 14, padding: 10, gap: 6, borderRadius: 8, backgroundColor: c.surfaceMuted },
    historyTitle: { fontSize: 12, fontWeight: "700", color: c.text },
    historyRow: { fontSize: 11.5, lineHeight: 16, color: c.slate[600] },
    historyWho: { fontWeight: "700", color: c.slate[700] },
  }),
);
