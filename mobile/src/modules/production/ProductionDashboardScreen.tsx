import React, { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Screen } from "../../components/common/Screen";
import { AppBadge, AppCard, AppEmptyState, AppSkeletonList } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { palette, spacing, typography } from "../../theme/tokens";
import { toErrorMessage } from "../../utils/errorMessage";
import { getTaskStats, getTasks, type Task } from "../../services/taskService";
import { getMyAttendance, type AttendanceRecord } from "../../services/attendanceService";

/*
 * Mirrors modules/production/ProductionExecutiveDashboard.jsx - the home screen
 * for PRODUCTION_EXECUTIVE and COMMUNITY_MANAGER.
 *
 * Until now those two roles had no mobile dashboard at all and were routed to
 * the task list instead. They do not work a sales pipeline; their day is tasks
 * and attendance, which is what web shows them and what this shows them.
 */

const formatClock = (value?: string | null) => {
  if (!value) return "--:--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--:--";
  return date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
};

const dueVariant = (task: Task) => {
  const due = (task as { dueDate?: string }).dueDate;
  if (!due) return "slate" as const;
  const ms = new Date(due).getTime();
  if (Number.isNaN(ms)) return "slate" as const;
  if (ms < Date.now()) return "rose" as const;
  return "amber" as const;
};

const Stat = ({ label, value }: { label: string; value: string | number }) => (
  <View style={styles.stat}>
    <Text style={styles.statValue}>{String(value)}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

export const ProductionDashboardScreen = () => {
  const navigation = useNavigation<any>();
  const { user } = useAuth();

  const [stats, setStats] = useState<Record<string, number>>({});
  const [tasks, setTasks] = useState<Task[]>([]);
  const [today, setToday] = useState<AttendanceRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      // Each piece is independent - a failing stats call should not take the
      // task list down with it.
      const [statsResult, tasksResult, attendanceResult] = await Promise.allSettled([
        getTaskStats(),
        getTasks({ limit: 10 }),
        getMyAttendance(),
      ]);

      setStats(statsResult.status === "fulfilled" ? statsResult.value || {} : {});
      setTasks(tasksResult.status === "fulfilled" ? tasksResult.value || [] : []);
      setToday(attendanceResult.status === "fulfilled" ? attendanceResult.value.today : null);

      const allFailed = [statsResult, tasksResult, attendanceResult].every(
        (result) => result.status === "rejected",
      );
      setError(allFailed ? "Could not load your dashboard" : "");
    } catch (err) {
      setError(toErrorMessage(err, "Could not load your dashboard"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const firstName = String(user?.name || "").split(" ")[0] || "there";

  if (loading) {
    return (
      <Screen title="Dashboard" subtitle="Today">
        <AppSkeletonList rows={4} />
      </Screen>
    );
  }

  return (
    <Screen title={`Hello, ${firstName}`} subtitle="Today" error={error} onRetry={load}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.body}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load();
            }}
          />
        }
      >
        <Pressable onPress={() => navigation.navigate("Attendance")}>
          <AppCard style={styles.card} interactive>
            <Text style={styles.cardTitle}>Attendance</Text>
            <View style={styles.clockRow}>
              <Stat label="Check in" value={formatClock(today?.checkInAt)} />
              <Stat label="Check out" value={formatClock(today?.checkOutAt)} />
              <Stat label="Status" value={String(today?.status || "—").replace(/_/g, " ")} />
            </View>
          </AppCard>
        </Pressable>

        {Object.keys(stats).length > 0 ? (
          <AppCard style={styles.card}>
            <Text style={styles.cardTitle}>Tasks</Text>
            <View style={styles.statRow}>
              {Object.entries(stats)
                .filter(([, value]) => typeof value === "number")
                .slice(0, 4)
                .map(([key, value]) => (
                  <Stat key={key} label={key.replace(/([A-Z])/g, " $1").trim()} value={value} />
                ))}
            </View>
          </AppCard>
        ) : null}

        <View style={styles.headingRow}>
          <Text style={styles.heading}>MY TASKS</Text>
          <Pressable onPress={() => navigation.navigate("Tasks")} hitSlop={8}>
            <Text style={styles.link}>See all</Text>
          </Pressable>
        </View>

        {tasks.length === 0 ? (
          <AppEmptyState title="Nothing assigned" description="Tasks assigned to you appear here." />
        ) : (
          tasks.map((task, index) => (
            <Pressable
              key={(task as any)._id || index}
              onPress={() => navigation.navigate("Tasks")}
            >
              <AppCard style={styles.taskCard} interactive>
                <View style={styles.taskHead}>
                  <Text style={styles.taskTitle} numberOfLines={1}>
                    {(task as any).title || "Untitled task"}
                  </Text>
                  <AppBadge variant={dueVariant(task)}>
                    {String((task as any).status || "OPEN").replace(/_/g, " ")}
                  </AppBadge>
                </View>
                {(task as any).description ? (
                  <Text style={styles.taskMeta} numberOfLines={2}>
                    {(task as any).description}
                  </Text>
                ) : null}
              </AppCard>
            </Pressable>
          ))
        )}
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  body: { paddingBottom: spacing.xxl },
  card: { marginBottom: spacing.md },
  cardTitle: {
    fontSize: typography.cardTitle,
    fontWeight: "600",
    color: palette.slate[900],
    marginBottom: spacing.lg,
  },
  clockRow: { flexDirection: "row" },
  statRow: { flexDirection: "row", flexWrap: "wrap" },
  stat: { flex: 1, minWidth: 80, alignItems: "center" },
  statValue: { fontSize: typography.title, fontWeight: "700", color: palette.slate[900] },
  statLabel: {
    marginTop: 2,
    fontSize: typography.caption,
    color: palette.slate[500],
    textTransform: "uppercase",
    letterSpacing: 0.5,
    textAlign: "center",
  },
  headingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  heading: {
    fontSize: typography.caption,
    fontWeight: "700",
    color: palette.slate[500],
    letterSpacing: 0.8,
  },
  link: { fontSize: typography.label, fontWeight: "600", color: palette.blue[600] },
  taskCard: { marginBottom: spacing.md },
  taskHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  taskTitle: { flex: 1, fontSize: typography.body, fontWeight: "600", color: palette.slate[900] },
  taskMeta: { marginTop: spacing.sm, fontSize: typography.label, color: palette.slate[500] },
});
