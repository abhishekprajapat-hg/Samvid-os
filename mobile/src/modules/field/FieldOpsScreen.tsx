import React, { useEffect, useMemo, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { Screen } from "../../components/common/Screen";
import { getAllLeads } from "../../services/leadService";
import { getUsers } from "../../services/userService";
import { toErrorMessage } from "../../utils/errorMessage";

export const FieldOpsScreen = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [leads, setLeads] = useState<Array<{ _id: string; name: string; status?: string; assignedTo?: { name?: string } }>>([]);
  const [users, setUsers] = useState<Array<{ _id?: string; role?: string; name?: string }>>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const [leadRows, userPayload] = await Promise.all([getAllLeads(), getUsers()]);
        setLeads(leadRows);
        setUsers(userPayload?.users || []);
      } catch (e) {
        setError(toErrorMessage(e, "Failed to load field ops"));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const dashboard = useMemo(() => {
    const fieldExec = users.filter((user) => user.role === "FIELD_EXECUTIVE");
    const active = leads.filter((lead) => ["NEW", "CONTACTED", "INTERESTED", "SITE_VISIT"].includes(String(lead.status)));
    const siteVisits = active.filter((lead) => lead.status === "SITE_VISIT");
    const unassigned = active.filter((lead) => !lead.assignedTo);

    return { fieldExec, active, siteVisits, unassigned };
  }, [leads, users]);

  return (
    <Screen title="Field Operations" subtitle="Dispatch + Workload" loading={loading} error={error}>
      <View style={styles.kpis}>
        <Kpi label="Field Executives" value={dashboard.fieldExec.length} />
        <Kpi label="Active Leads" value={dashboard.active.length} />
        <Kpi label="Site Visits" value={dashboard.siteVisits.length} />
        <Kpi label="Unassigned" value={dashboard.unassigned.length} />
      </View>

      <FlatList
        data={dashboard.unassigned}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.title}>{item.name}</Text>
            <Text style={styles.meta}>Status: {item.status || "NEW"}</Text>
          </View>
        )}
        ListHeaderComponent={<Text style={styles.section}>Dispatch Queue</Text>}
      />
    </Screen>
  );
};

const Kpi = ({ label, value }: { label: string; value: number }) => (
  <View style={styles.kpiCard}>
    <Text style={styles.meta}>{label}</Text>
    <Text style={styles.value}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  kpis: {
    gap: 8,
    marginBottom: 10,
  },
  kpiCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    backgroundColor: "#fff",
    padding: 10,
  },
  value: {
    fontSize: 22,
    fontWeight: "700",
    color: "#0f172a",
  },
  section: {
    marginBottom: 8,
    fontWeight: "700",
    color: "#334155",
  },
  card: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    backgroundColor: "#fff",
    padding: 10,
    marginBottom: 8,
  },
  title: {
    fontWeight: "700",
    color: "#0f172a",
  },
  meta: {
    marginTop: 2,
    color: "#64748b",
    fontSize: 12,
  },
});