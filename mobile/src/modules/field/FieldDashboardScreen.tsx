import React, { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Screen } from "../../components/common/Screen";
import api from "../../services/api";
import { toErrorMessage } from "../../utils/errorMessage";

type FieldTask = {
  id: string;
  title: string;
  detail: string;
  status: "Pending" | "Done";
};

const DEFAULT_TASKS: FieldTask[] = [
  {
    id: "visit-1",
    title: "Site Visit",
    detail: "Skyline Towers - 10:00 AM",
    status: "Pending",
  },
  {
    id: "visit-2",
    title: "Client Follow Up",
    detail: "Call after visit completion",
    status: "Pending",
  },
  {
    id: "visit-3",
    title: "Document Sync",
    detail: "Upload photos and unit notes",
    status: "Pending",
  },
];

export const FieldDashboardScreen = () => {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [inventoryCount, setInventoryCount] = useState(0);
  const [tasks, setTasks] = useState<FieldTask[]>(DEFAULT_TASKS);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError("");
        const res = await api.get("/inventory");
        const rows = res.data?.assets || [];
        setInventoryCount(Array.isArray(rows) ? rows.length : 0);
      } catch (e) {
        setError(toErrorMessage(e, "Failed to load field data"));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const pendingCount = useMemo(
    () => tasks.filter((task) => task.status !== "Done").length,
    [tasks],
  );

  const completeTask = (taskId: string) => {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === taskId ? { ...task, status: "Done" } : task,
      ),
    );
  };

  return (
    <Screen title="Field Dashboard" subtitle="Daily Execution" loading={loading} error={error}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.metricsGrid}>
          <StatCard title="Pending Tasks" value={pendingCount} helper="Today route actions" />
          <StatCard title="Completed" value={tasks.length - pendingCount} helper="Marked done" />
          <StatCard title="Inventory Access" value={inventoryCount} helper="Company units visible" />
          <StatCard title="Live Navigation" value="On" helper="Map tracking available" />
        </View>

        <View style={styles.tasksCard}>
          <Text style={styles.sectionTitle}>Today Tasks</Text>
          {tasks.map((task) => (
            <View
              key={task.id}
              style={[
                styles.taskRow,
                task.status === "Done" ? styles.taskDone : styles.taskPending,
              ]}
            >
              <View style={styles.taskTextWrap}>
                <Text style={styles.taskTitle}>{task.title}</Text>
                <Text style={styles.taskDetail}>{task.detail}</Text>
              </View>

              {task.status === "Done" ? (
                <View style={styles.donePill}>
                  <Text style={styles.doneText}>Done</Text>
                </View>
              ) : (
                <Pressable style={styles.checkBtn} onPress={() => completeTask(task.id)}>
                  <Text style={styles.checkBtnText}>Check In</Text>
                </Pressable>
              )}
            </View>
          ))}
        </View>

        <View style={styles.quickWrap}>
          <QuickAction
            title="Field Ops Map"
            subtitle="Open live map and visit panel"
            onPress={() => navigation.navigate("Field Ops")}
          />
          <QuickAction
            title="Inventory"
            subtitle="View all inventory units"
            onPress={() => navigation.navigate("Inventory")}
          />
          <QuickAction
            title="Chat"
            subtitle="Connect with manager/admin"
            onPress={() => navigation.navigate("Chat")}
          />
          <QuickAction
            title="Schedule"
            subtitle="Check route and follow-ups"
            onPress={() => navigation.navigate("Calendar")}
          />
        </View>
      </ScrollView>
    </Screen>
  );
};

const StatCard = ({ title, value, helper }: { title: string; value: string | number; helper: string }) => (
  <View style={styles.statCard}>
    <Text style={styles.statTitle}>{title}</Text>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statHelper}>{helper}</Text>
  </View>
);

const QuickAction = ({
  title,
  subtitle,
  onPress,
}: {
  title: string;
  subtitle: string;
  onPress: () => void;
}) => (
  <Pressable style={styles.quickCard} onPress={onPress}>
    <Text style={styles.quickTitle}>{title}</Text>
    <Text style={styles.quickSubtitle}>{subtitle}</Text>
  </Pressable>
);

const styles = StyleSheet.create({
  container: {
    gap: 12,
    paddingBottom: 16,
  },
  metricsGrid: {
    gap: 10,
  },
  statCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    backgroundColor: "#fff",
    padding: 12,
  },
  statTitle: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    color: "#64748b",
    letterSpacing: 0.7,
  },
  statValue: {
    marginTop: 6,
    fontSize: 26,
    fontWeight: "800",
    color: "#0f172a",
  },
  statHelper: {
    marginTop: 2,
    fontSize: 12,
    color: "#64748b",
  },
  tasksCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    backgroundColor: "#fff",
    padding: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    color: "#334155",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  taskRow: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  taskPending: {
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
  },
  taskDone: {
    borderColor: "#bbf7d0",
    backgroundColor: "#f0fdf4",
  },
  taskTextWrap: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 14,
    color: "#0f172a",
    fontWeight: "700",
  },
  taskDetail: {
    marginTop: 2,
    fontSize: 12,
    color: "#64748b",
  },
  checkBtn: {
    borderRadius: 8,
    backgroundColor: "#0f172a",
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  checkBtnText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  donePill: {
    borderRadius: 999,
    backgroundColor: "#dcfce7",
    borderWidth: 1,
    borderColor: "#86efac",
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  doneText: {
    color: "#166534",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  quickWrap: {
    gap: 8,
  },
  quickCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    backgroundColor: "#fff",
    padding: 12,
  },
  quickTitle: {
    color: "#0f172a",
    fontWeight: "700",
    fontSize: 14,
  },
  quickSubtitle: {
    marginTop: 3,
    fontSize: 12,
    color: "#64748b",
  },
});

