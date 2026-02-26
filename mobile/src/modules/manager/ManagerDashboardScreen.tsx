import React, { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Screen } from "../../components/common/Screen";
import { getAllLeads } from "../../services/leadService";
import { getInventoryAssets } from "../../services/inventoryService";
import { toErrorMessage } from "../../utils/errorMessage";
import type { Lead, InventoryAsset } from "../../types";

const PIPELINE_STATUSES = new Set(["CONTACTED", "INTERESTED", "SITE_VISIT"]);

const formatCurrency = (value: number) => `Rs ${Math.round(value).toLocaleString("en-IN")}`;

const toPercent = (value: number) => `${Math.round(value)}%`;

export const ManagerDashboardScreen = () => {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [assets, setAssets] = useState<InventoryAsset[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError("");

        const [leadRows, inventoryRows] = await Promise.all([getAllLeads(), getInventoryAssets()]);
        setLeads(Array.isArray(leadRows) ? leadRows : []);
        setAssets(Array.isArray(inventoryRows) ? inventoryRows : []);
      } catch (e) {
        setError(toErrorMessage(e, "Failed to load manager dashboard"));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const summary = useMemo(() => {
    const totalLeads = leads.length;
    const closed = leads.filter((lead) => lead.status === "CLOSED").length;
    const siteVisits = leads.filter((lead) => lead.status === "SITE_VISIT").length;
    const negotiation = leads.filter((lead) => PIPELINE_STATUSES.has(String(lead.status || ""))).length;
    const activePipeline = Math.max(totalLeads - closed, 0);
    const conversion = totalLeads > 0 ? (closed / totalLeads) * 100 : 0;
    const estimatedRevenue = closed * 75000;
    const avgTicket = closed > 0 ? estimatedRevenue / closed : 0;

    return {
      totalLeads,
      closed,
      siteVisits,
      negotiation,
      activePipeline,
      conversion,
      estimatedRevenue,
      avgTicket,
      inventoryAssets: assets.length,
    };
  }, [assets.length, leads]);

  const funnelRows = useMemo(
    () => [
      {
        label: "Negotiation",
        value: summary.negotiation,
        progress: summary.totalLeads > 0 ? (summary.negotiation / summary.totalLeads) * 100 : 0,
      },
      {
        label: "Site Visits",
        value: summary.siteVisits,
        progress: summary.totalLeads > 0 ? (summary.siteVisits / summary.totalLeads) * 100 : 0,
      },
      {
        label: "Closed Deals",
        value: summary.closed,
        progress: summary.conversion,
      },
    ],
    [summary.closed, summary.conversion, summary.negotiation, summary.siteVisits, summary.totalLeads],
  );

  const openLeads = ({ status, preset, query }: { status?: string; preset?: string; query?: string }) => {
    navigation.navigate("Leads", {
      initialStatus: status || "ALL",
      filterPreset: preset || "",
      initialQuery: query || "",
    });
  };

  const openClosedDealsFromRevenue = () => {
    navigation.navigate("Leads", {
      initialStatus: "CLOSED",
      filterPreset: "",
      initialQuery: "",
      highlightMetric: "ESTIMATED_REVENUE",
      estimatedRevenue: summary.estimatedRevenue,
      closedDeals: summary.closed,
    });
  };

  const openInventory = () => {
    navigation.navigate("Inventory");
  };

  return (
    <Screen title="Manager Dashboard" subtitle="Command Deck" loading={loading} error={error}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.heroLabel}>CONTROL HOME</Text>
          <Text style={styles.heroTitle}>Live Snapshot</Text>
          <View style={styles.heroRow}>
            <HeroChip
              label="Active Pipeline"
              value={summary.activePipeline}
              clickable={summary.activePipeline > 0}
              onPress={() => openLeads({ preset: "PIPELINE" })}
            />
            <HeroChip
              label="Conversion"
              value={toPercent(summary.conversion)}
              clickable={summary.totalLeads > 0}
              onPress={() => openLeads({ status: "CLOSED" })}
            />
            <HeroChip
              label="Avg Ticket"
              value={formatCurrency(summary.avgTicket)}
              clickable={summary.closed > 0}
              onPress={() => openLeads({ status: "CLOSED" })}
            />
          </View>
        </View>

        <View style={styles.grid}>
          <MetricCard
            label="Estimated Revenue"
            value={formatCurrency(summary.estimatedRevenue)}
            helper={`${summary.closed} closed x 75,000`}
            clickable
            onPress={openClosedDealsFromRevenue}
          />
          <MetricCard
            label="Total Leads"
            value={summary.totalLeads}
            helper={`${summary.activePipeline} in pipeline`}
            clickable={summary.activePipeline > 0}
            onPress={() => openLeads({ preset: "PIPELINE" })}
          />
          <MetricCard
            label="Inventory Assets"
            value={summary.inventoryAssets}
            helper="Current stock visible"
            clickable={summary.inventoryAssets > 0}
            onPress={openInventory}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pipeline Snapshot</Text>
          {funnelRows.map((row) => (
            <Pressable
              key={row.label}
              style={[styles.progressCard, row.value > 0 && styles.cardClickable]}
              disabled={row.value <= 0}
              onPress={() => {
                if (row.label === "Site Visits") {
                  openLeads({ status: "SITE_VISIT" });
                  return;
                }
                if (row.label === "Closed Deals") {
                  openLeads({ status: "CLOSED" });
                  return;
                }
                openLeads({ preset: "PIPELINE" });
              }}
            >
              <View style={styles.progressHead}>
                <Text style={styles.progressLabel}>{row.label}</Text>
                <Text style={styles.progressMeta}>
                  {row.value} ({toPercent(row.progress)})
                </Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${Math.max(4, Math.min(100, row.progress))}%` }]} />
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
};

const HeroChip = ({
  label,
  value,
  clickable = false,
  onPress,
}: {
  label: string;
  value: string | number;
  clickable?: boolean;
  onPress?: () => void;
}) => (
  <Pressable
    style={[styles.heroChip, clickable && styles.cardClickable]}
    disabled={!clickable}
    onPress={onPress}
  >
    <Text style={styles.heroChipLabel}>{label}</Text>
    <Text style={styles.heroChipValue}>{value}</Text>
  </Pressable>
);

const MetricCard = ({
  label,
  value,
  helper,
  clickable = false,
  onPress,
}: {
  label: string;
  value: string | number;
  helper: string;
  clickable?: boolean;
  onPress?: () => void;
}) => (
  <Pressable
    style={[styles.metricCard, clickable && styles.cardClickable]}
    disabled={!clickable}
    onPress={onPress}
  >
    <Text style={styles.metricLabel}>{label}</Text>
    <Text style={styles.metricValue}>{value}</Text>
    <Text style={styles.metricHelper}>{helper}</Text>
  </Pressable>
);

const styles = StyleSheet.create({
  container: {
    gap: 12,
    paddingBottom: 14,
  },
  hero: {
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: 16,
    backgroundColor: "#eff6ff",
    padding: 14,
  },
  heroLabel: {
    fontSize: 10,
    color: "#1d4ed8",
    letterSpacing: 1,
    fontWeight: "700",
  },
  heroTitle: {
    marginTop: 4,
    fontSize: 24,
    fontWeight: "800",
    color: "#0f172a",
  },
  heroRow: {
    marginTop: 10,
    flexDirection: "row",
    gap: 8,
  },
  heroChip: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: 10,
    backgroundColor: "#ffffff",
    padding: 8,
  },
  heroChipLabel: {
    fontSize: 10,
    textTransform: "uppercase",
    color: "#64748b",
  },
  heroChipValue: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
  },
  grid: {
    gap: 10,
  },
  metricCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    backgroundColor: "#fff",
    padding: 12,
  },
  metricLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    color: "#64748b",
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  metricValue: {
    marginTop: 8,
    fontSize: 24,
    fontWeight: "800",
    color: "#0f172a",
  },
  metricHelper: {
    marginTop: 4,
    fontSize: 12,
    color: "#64748b",
  },
  section: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    backgroundColor: "#fff",
    padding: 12,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0f172a",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  progressCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    backgroundColor: "#f8fafc",
    padding: 10,
  },
  progressHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  progressLabel: {
    color: "#0f172a",
    fontWeight: "600",
    fontSize: 12,
  },
  progressMeta: {
    color: "#475569",
    fontSize: 12,
  },
  progressTrack: {
    marginTop: 8,
    height: 8,
    borderRadius: 6,
    backgroundColor: "#dbeafe",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#1d4ed8",
  },
  cardClickable: {
    opacity: 0.96,
  },
});
