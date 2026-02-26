import React, { useEffect, useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { Screen } from "../../components/common/Screen";
import api from "../../services/api";
import { toErrorMessage } from "../../utils/errorMessage";
import type { Lead } from "../../types";

const TARGETS = {
  MONTHLY_COMMISSION: 500000,
  LEAD_TARGET: 20,
};

export const PerformanceScreen = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [range, setRange] = useState<"ALL" | "THIS_MONTH">("THIS_MONTH");
  const [leads, setLeads] = useState<Lead[]>([]);

  const load = async (silent = false) => {
    try {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const res = await api.get("/leads");
      setLeads(res.data?.leads || []);
      setError("");
    } catch (e) {
      setError(toErrorMessage(e, "Failed to load performance"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const scopedLeads = useMemo(() => {
    if (range === "ALL") return leads;

    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);

    return leads.filter((lead) => {
      const d = new Date(lead.createdAt || "");
      return !Number.isNaN(d.getTime()) && d >= start;
    });
  }, [leads, range]);

  const metrics = useMemo(() => {
    const totalLeads = scopedLeads.length;
    const closedLeads = scopedLeads.filter((lead) => lead.status === "CLOSED");
    const lostLeads = scopedLeads.filter((lead) => lead.status === "LOST").length;

    const totalCommission = closedLeads.length * 50000;
    const conversion = totalLeads > 0 ? Math.round((closedLeads.length / totalLeads) * 100) : 0;
    const closeToLost = lostLeads > 0 ? (closedLeads.length / lostLeads).toFixed(2) : "-";

    const monthlyTargetProgress = Math.min(
      Math.round((totalCommission / TARGETS.MONTHLY_COMMISSION) * 100),
      100,
    );

    const leadTargetProgress = Math.min(Math.round((totalLeads / TARGETS.LEAD_TARGET) * 100), 100);

    return {
      totalLeads,
      closed: closedLeads.length,
      lost: lostLeads,
      commission: totalCommission,
      conversion,
      closeToLost,
      monthlyTargetProgress,
      leadTargetProgress,
    };
  }, [scopedLeads]);

  const shareSnapshot = async () => {
    const text = [
      `Range: ${range}`,
      `Leads: ${metrics.totalLeads}`,
      `Closed: ${metrics.closed}`,
      `Lost: ${metrics.lost}`,
      `Conversion: ${metrics.conversion}%`,
      `Commission: Rs ${metrics.commission.toLocaleString("en-IN")}`,
      `Target Progress: ${metrics.monthlyTargetProgress}%`,
    ].join("\n");

    await Share.share({ title: "Performance Snapshot", message: text });
  };

  return (
    <Screen title="Performance" subtitle="Target Insights" loading={loading} error={error}>
      <View style={styles.topRow}>
        <View style={styles.toggleRow}>
          <Pressable
            style={[styles.toggleChip, range === "THIS_MONTH" && styles.toggleChipActive]}
            onPress={() => setRange("THIS_MONTH")}
          >
            <Text style={[styles.toggleText, range === "THIS_MONTH" && styles.toggleTextActive]}>THIS_MONTH</Text>
          </Pressable>
          <Pressable
            style={[styles.toggleChip, range === "ALL" && styles.toggleChipActive]}
            onPress={() => setRange("ALL")}
          >
            <Text style={[styles.toggleText, range === "ALL" && styles.toggleTextActive]}>ALL</Text>
          </Pressable>
        </View>
        <Pressable style={styles.exportBtn} onPress={shareSnapshot}>
          <Text style={styles.exportText}>Share</Text>
        </Pressable>
      </View>

      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}>
        <View style={styles.card}>
          <Text style={styles.label}>Commission Target</Text>
          <Text style={styles.value}>Rs {metrics.commission.toLocaleString("en-IN")}</Text>
          <Text style={styles.helper}>
            {metrics.monthlyTargetProgress}% of Rs {TARGETS.MONTHLY_COMMISSION.toLocaleString("en-IN")}
          </Text>
          <Bar progress={metrics.monthlyTargetProgress} />
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Lead Target</Text>
          <Text style={styles.value}>{metrics.totalLeads}</Text>
          <Text style={styles.helper}>{metrics.leadTargetProgress}% of {TARGETS.LEAD_TARGET} leads</Text>
          <Bar progress={metrics.leadTargetProgress} />
        </View>

        <View style={styles.grid}>
          <SmallCard label="Closed" value={metrics.closed} />
          <SmallCard label="Lost" value={metrics.lost} />
          <SmallCard label="Conversion" value={`${metrics.conversion}%`} />
          <SmallCard label="Close/Lost" value={metrics.closeToLost} />
        </View>
      </ScrollView>
    </Screen>
  );
};

const Bar = ({ progress }: { progress: number }) => (
  <View style={styles.barTrack}>
    <View style={[styles.barFill, { width: `${Math.max(progress, 2)}%` }]} />
  </View>
);

const SmallCard = ({ label, value }: { label: string; value: string | number }) => (
  <View style={styles.smallCard}>
    <Text style={styles.label}>{label}</Text>
    <Text style={styles.smallValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    gap: 8,
  },
  toggleRow: {
    flexDirection: "row",
    gap: 8,
  },
  exportBtn: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#fff",
  },
  exportText: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "600",
  },
  toggleChip: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#fff",
  },
  toggleChipActive: {
    borderColor: "#0f172a",
    backgroundColor: "#0f172a",
  },
  toggleText: {
    fontSize: 12,
    color: "#334155",
  },
  toggleTextActive: {
    color: "#fff",
  },
  card: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    backgroundColor: "#fff",
    padding: 12,
    marginBottom: 10,
  },
  label: {
    fontSize: 12,
    color: "#64748b",
    textTransform: "uppercase",
  },
  value: {
    marginTop: 8,
    fontWeight: "700",
    fontSize: 22,
    color: "#0f172a",
  },
  helper: {
    marginTop: 4,
    color: "#64748b",
    fontSize: 12,
  },
  barTrack: {
    marginTop: 8,
    height: 8,
    borderRadius: 6,
    backgroundColor: "#e2e8f0",
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    backgroundColor: "#0f172a",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  smallCard: {
    width: "48%",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    backgroundColor: "#fff",
    padding: 12,
  },
  smallValue: {
    marginTop: 8,
    fontWeight: "700",
    fontSize: 18,
    color: "#0f172a",
  },
});