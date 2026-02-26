import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Screen } from "../../components/common/Screen";
import { getAllLeads } from "../../services/leadService";
import { toErrorMessage } from "../../utils/errorMessage";
import type { Lead } from "../../types";

const ACTIVE_STATUSES = new Set(["NEW", "CONTACTED", "INTERESTED", "SITE_VISIT"]);

const formatCurrency = (value: number) => `Rs ${Math.round(value).toLocaleString("en-IN")}`;

const formatDate = (value?: string) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
};

export const ExecutiveDashboardScreen = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [leads, setLeads] = useState<Lead[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError("");
        const rows = await getAllLeads();
        setLeads(Array.isArray(rows) ? rows : []);
      } catch (e) {
        setError(toErrorMessage(e, "Failed to load executive dashboard"));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const summary = useMemo(() => {
    const total = leads.length;
    const closed = leads.filter((lead) => lead.status === "CLOSED").length;
    const active = leads.filter((lead) => ACTIVE_STATUSES.has(String(lead.status || ""))).length;
    const dueFollowUps = leads.filter((lead) => {
      if (!lead.nextFollowUp) return false;
      return new Date(lead.nextFollowUp) <= new Date();
    }).length;
    const closeRate = total > 0 ? Math.round((closed / total) * 100) : 0;
    const commission = closed * 50000;

    return {
      total,
      closed,
      active,
      dueFollowUps,
      closeRate,
      commission,
    };
  }, [leads]);

  const urgentFollowUps = useMemo(
    () =>
      leads
        .filter((lead) => lead.nextFollowUp && ACTIVE_STATUSES.has(String(lead.status || "")))
        .sort((a, b) => new Date(a.nextFollowUp || "").getTime() - new Date(b.nextFollowUp || "").getTime())
        .slice(0, 5),
    [leads],
  );

  return (
    <Screen title="Executive Dashboard" subtitle="My Performance" loading={loading} error={error}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.heroLabel}>PERSONAL TARGET BOARD</Text>
          <Text style={styles.heroTitle}>{summary.closeRate}% Close Rate</Text>
          <Text style={styles.heroSub}>{summary.closed} deals closed from {summary.total} leads</Text>
        </View>

        <View style={styles.row}>
          <StatCard label="My Leads" value={summary.total} />
          <StatCard label="Active" value={summary.active} />
        </View>

        <View style={styles.row}>
          <StatCard label="Closed" value={summary.closed} />
          <StatCard label="Commission" value={formatCurrency(summary.commission)} />
        </View>

        <View style={styles.riskCard}>
          <Text style={styles.riskTitle}>Follow-up Risk</Text>
          <Text style={styles.riskValue}>{summary.dueFollowUps}</Text>
          <Text style={styles.riskSub}>follow-ups are overdue</Text>
        </View>

        <View style={styles.listCard}>
          <Text style={styles.listTitle}>Upcoming Follow-ups</Text>
          {urgentFollowUps.length === 0 ? (
            <Text style={styles.empty}>No scheduled follow-up right now</Text>
          ) : (
            urgentFollowUps.map((lead) => (
              <View key={lead._id} style={styles.itemRow}>
                <View>
                  <Text style={styles.itemName}>{lead.name}</Text>
                  <Text style={styles.itemMeta}>{lead.projectInterested || "-"}</Text>
                </View>
                <Text style={styles.itemDate}>{formatDate(lead.nextFollowUp)}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </Screen>
  );
};

const StatCard = ({ label, value }: { label: string; value: string | number }) => (
  <View style={styles.statCard}>
    <Text style={styles.statLabel}>{label}</Text>
    <Text style={styles.statValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    gap: 10,
    paddingBottom: 14,
  },
  hero: {
    borderWidth: 1,
    borderColor: "#c7d2fe",
    borderRadius: 14,
    backgroundColor: "#eef2ff",
    padding: 14,
  },
  heroLabel: {
    fontSize: 10,
    textTransform: "uppercase",
    fontWeight: "700",
    color: "#3730a3",
    letterSpacing: 0.8,
  },
  heroTitle: {
    marginTop: 6,
    fontSize: 24,
    fontWeight: "800",
    color: "#0f172a",
  },
  heroSub: {
    marginTop: 4,
    fontSize: 12,
    color: "#475569",
  },
  row: {
    flexDirection: "row",
    gap: 10,
  },
  statCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    backgroundColor: "#fff",
    padding: 12,
  },
  statLabel: {
    fontSize: 11,
    color: "#64748b",
    textTransform: "uppercase",
    fontWeight: "700",
  },
  statValue: {
    marginTop: 6,
    fontSize: 22,
    color: "#0f172a",
    fontWeight: "800",
  },
  riskCard: {
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 12,
    backgroundColor: "#fff1f2",
    padding: 12,
  },
  riskTitle: {
    fontSize: 12,
    color: "#be123c",
    textTransform: "uppercase",
    fontWeight: "700",
  },
  riskValue: {
    marginTop: 6,
    fontSize: 30,
    fontWeight: "800",
    color: "#9f1239",
  },
  riskSub: {
    marginTop: 2,
    fontSize: 12,
    color: "#be123c",
  },
  listCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    backgroundColor: "#fff",
    padding: 12,
  },
  listTitle: {
    fontSize: 12,
    color: "#0f172a",
    textTransform: "uppercase",
    fontWeight: "700",
    marginBottom: 8,
  },
  empty: {
    color: "#64748b",
    fontSize: 13,
  },
  itemRow: {
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  itemName: {
    color: "#0f172a",
    fontWeight: "700",
  },
  itemMeta: {
    marginTop: 2,
    color: "#64748b",
    fontSize: 12,
  },
  itemDate: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "600",
  },
});

