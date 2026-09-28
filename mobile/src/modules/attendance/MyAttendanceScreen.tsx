import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Glyph } from "../../components/ui/Glyph";
import { brand, brandStyles, layout, round, type as t } from "../../theme/brand";
import { toErrorMessage } from "../../utils/errorMessage";
import { getMyAttendance, type AttendanceRecord } from "../../services/attendanceService";
import { statusTone } from "./attendanceShared";

/*
 * My own recent days.
 *
 * AttendanceHistory next door is the roster - it reads /attendance/daily,
 * which 403s for anyone without the manage grant - so it cannot serve as
 * everyone's history. This reads /attendance/me, the same call the hub makes,
 * and is where the per-day break and late-by figures went when the hub's card
 * became the comp's ring.
 */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const dayLabel = (value?: string) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return `${WEEKDAYS[date.getDay()]}, ${date.getDate()} ${MONTHS[date.getMonth()]}`;
};

const clock = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date
    .toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true })
    .toUpperCase();
};

const span = (minutes?: number | null) => {
  const total = Math.max(0, Math.round(Number(minutes || 0)));
  if (!total) return "0m";
  const hours = Math.floor(total / 60);
  return hours ? `${hours}h ${String(total % 60).padStart(2, "0")}m` : `${total}m`;
};

export const MyAttendanceScreen = () => {
  const navigation = useNavigation<any>();
  const [rows, setRows] = useState<AttendanceRecord[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (quiet = false) => {
    try {
      if (quiet) setRefreshing(true);
      else setLoading(true);
      setError("");
      const data = await getMyAttendance();
      setRows(data.attendance || []);
      setSummary(data.summary || {});
    } catch (err) {
      setError(toErrorMessage(err, "Failed to load your attendance"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const ordered = useMemo(
    () =>
      [...rows].sort(
        (a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime(),
      ),
    [rows],
  );

  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <Pressable
          style={styles.back}
          onPress={() => navigation.goBack()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Glyph name="arrow-back" size={24} color={brand.text} />
        </Pressable>
        <Text style={styles.pageTitle}>My attendance</Text>
        <Text style={styles.pageSubtitle}>
          {summary.presentDays != null
            ? `${summary.presentDays} present · ${Math.round(Number(summary.totalWorkedHours || 0))}h worked`
            : "Your recent days"}
        </Text>
      </View>

      {loading ? (
        <View style={styles.centred}>
          <ActivityIndicator size="large" color={brand.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={brand.primary} />
          }
        >
          {error ? <Text style={styles.error}>{error}</Text> : null}

          {ordered.length === 0 && !error ? (
            <Text style={styles.empty}>No attendance recorded yet.</Text>
          ) : null}

          {ordered.map((row, index) => {
            const tone = statusTone(String(row.status || "PENDING"));
            return (
              <View key={row._id || index} style={styles.card}>
                <View style={styles.cardHead}>
                  <Text style={styles.date}>{dayLabel(row.date)}</Text>
                  <View style={[styles.pill, { backgroundColor: tone.bg }]}>
                    <Text style={[styles.pillText, { color: tone.color }]}>{tone.label}</Text>
                  </View>
                </View>

                <View style={styles.metrics}>
                  <View style={styles.metric}>
                    <Text style={styles.metricLabel}>In</Text>
                    <Text style={styles.metricValue}>{clock(row.checkInAt)}</Text>
                  </View>
                  <View style={styles.metric}>
                    <Text style={styles.metricLabel}>Out</Text>
                    <Text style={styles.metricValue}>{clock(row.checkOutAt)}</Text>
                  </View>
                  <View style={styles.metric}>
                    <Text style={styles.metricLabel}>Worked</Text>
                    <Text style={styles.metricValue}>{span(row.workedMinutes)}</Text>
                  </View>
                  <View style={styles.metric}>
                    <Text style={styles.metricLabel}>Break</Text>
                    <Text style={styles.metricValue}>{span(row.breakMinutes)}</Text>
                  </View>
                  <View style={styles.metric}>
                    <Text style={styles.metricLabel}>Late by</Text>
                    <Text style={styles.metricValue}>{span(row.lateMinutes)}</Text>
                  </View>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
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
    header: {
      paddingHorizontal: layout.pageGutter,
      paddingTop: 8,
      paddingBottom: 12,
    },
    back: {
      marginBottom: 6,
    },
    pageTitle: {
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
    body: {
      paddingHorizontal: layout.pageGutter,
      paddingBottom: 28,
      gap: 10,
    },
    error: {
      fontSize: t.body,
      lineHeight: 17,
      color: b.alert,
    },
    empty: {
      paddingVertical: 40,
      textAlign: "center",
      fontSize: t.field,
      color: b.textMuted,
    },
    card: {
      padding: 14,
      borderWidth: 1,
      borderColor: b.border,
      borderRadius: round.panel,
      backgroundColor: b.surface,
    },
    cardHead: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    date: {
      flex: 1,
      minWidth: 0,
      fontSize: t.sectionTitle,
      fontWeight: "700",
      letterSpacing: -0.3,
      color: b.text,
    },
    pill: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: round.pill,
    },
    pillText: {
      fontSize: t.label,
      fontWeight: "600",
    },
    metrics: {
      marginTop: 12,
      flexDirection: "row",
      flexWrap: "wrap",
      rowGap: 10,
    },
    metric: {
      width: "20%",
      minWidth: 62,
    },
    metricLabel: {
      fontSize: t.tagline,
      color: b.textMuted,
    },
    metricValue: {
      marginTop: 2,
      fontSize: t.body,
      fontWeight: "600",
      color: b.text,
    },
  }),
);

export default MyAttendanceScreen;
