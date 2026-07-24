import React, { useEffect, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Screen } from "../../components/common/Screen";
import { AppCard } from "../../components/common/ui";
import api from "../../services/api";
import { toErrorMessage } from "../../utils/errorMessage";

const Metric = ({ label, value }: { label: string; value: string | number }) => (
  <View style={styles.metric}>
    <Text style={styles.metricLabel}>{label}</Text>
    <Text style={styles.metricValue}>{value}</Text>
  </View>
);

export const AdminMetaAdsScreen = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [stats, setStats] = useState<any>(null);

  const load = async (silent = false) => {
    try {
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError("");
      const response = await api.get("/leads", { params: { source: "META" } });
      const leads = Array.isArray(response.data?.leads) ? response.data.leads : [];
      setStats({
        total: leads.length,
        newLeads: leads.filter((lead: any) => String(lead.status || "").toUpperCase() === "NEW").length,
        visits: leads.filter((lead: any) => String(lead.status || "").toUpperCase() === "SITE_VISIT").length,
        closed: leads.filter((lead: any) => String(lead.status || "").toUpperCase() === "CLOSED").length,
      });
    } catch (err) {
      setError(toErrorMessage(err, "Failed to load Meta Ads"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <Screen title="Meta Ads" subtitle="Lead Intake" loading={loading} error={error}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
      >
        <AppCard style={styles.card as object}>
          <Metric label="Meta Leads" value={stats?.total || 0} />
          <Metric label="New" value={stats?.newLeads || 0} />
          <Metric label="Site Visits" value={stats?.visits || 0} />
          <Metric label="Closed" value={stats?.closed || 0} />
        </AppCard>
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  card: {
    gap: 8,
  },
  metric: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    backgroundColor: "#fff",
    padding: 12,
  },
  metricLabel: {
    color: "#64748b",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  metricValue: {
    marginTop: 5,
    color: "#0f172a",
    fontSize: 22,
    fontWeight: "700",
  },
});
