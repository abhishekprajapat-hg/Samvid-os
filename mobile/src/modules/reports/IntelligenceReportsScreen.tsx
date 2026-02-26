import React, { useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, Share, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Screen } from "../../components/common/Screen";
import { getAllLeads } from "../../services/leadService";
import { getInventoryAssets } from "../../services/inventoryService";
import { toErrorMessage } from "../../utils/errorMessage";
import type { Lead } from "../../types";

const RANGE_OPTIONS = ["ALL", "THIS_MONTH", "30_D"] as const;
type RangeKey = (typeof RANGE_OPTIONS)[number];
const STAGES = ["NEW", "CONTACTED", "INTERESTED", "SITE_VISIT", "CLOSED", "LOST"];

const toDate = (value?: string) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const getRangeStart = (rangeKey: RangeKey) => {
  const now = new Date();

  if (rangeKey === "30_D") {
    const start = new Date(now);
    start.setDate(start.getDate() - 30);
    return start;
  }

  if (rangeKey === "THIS_MONTH") {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }

  return null;
};

export const IntelligenceReportsScreen = () => {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [rangeKey, setRangeKey] = useState<RangeKey>("ALL");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [assets, setAssets] = useState<Array<{ _id: string; status?: string; location?: string; price?: number; createdAt?: string }>>([]);

  const load = async (silent = false) => {
    try {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError("");

      const [leadRows, inventoryRows] = await Promise.all([getAllLeads(), getInventoryAssets()]);
      setLeads(Array.isArray(leadRows) ? leadRows : []);
      setAssets(Array.isArray(inventoryRows) ? inventoryRows : []);
    } catch (e) {
      setError(toErrorMessage(e, "Failed to load reports"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const scoped = useMemo(() => {
    const start = getRangeStart(rangeKey);
    if (!start) {
      return { leads, assets };
    }

    return {
      leads: leads.filter((lead) => {
        const createdAt = toDate(lead.createdAt);
        return createdAt && createdAt >= start;
      }),
      assets: assets.filter((asset) => {
        const createdAt = toDate(asset.createdAt);
        return createdAt && createdAt >= start;
      }),
    };
  }, [assets, leads, rangeKey]);

  const metrics = useMemo(() => {
    const total = scoped.leads.length;
    const closed = scoped.leads.filter((lead) => lead.status === "CLOSED").length;
    const active = scoped.leads.filter((lead) => ["NEW", "CONTACTED", "INTERESTED", "SITE_VISIT"].includes(String(lead.status))).length;
    const conversion = total ? Math.round((closed / total) * 100) : 0;

    const soldReserved = scoped.assets.filter((asset) => ["Sold", "Reserved", "Blocked"].includes(String(asset.status))).length;
    const utilization = scoped.assets.length ? Math.round((soldReserved / scoped.assets.length) * 100) : 0;

    const inventoryValue = scoped.assets.reduce((sum, asset) => sum + Number(asset.price || 0), 0);

    return [
      { id: "1", label: "Total Leads", value: total, onPress: () => navigation.navigate("Leads", { initialStatus: "ALL" }) },
      {
        id: "2",
        label: "Active Leads",
        value: active,
        onPress: () => navigation.navigate("Leads", { filterPreset: "PIPELINE", initialStatus: "ALL" }),
      },
      { id: "3", label: "Closed Leads", value: closed, onPress: () => navigation.navigate("Leads", { initialStatus: "CLOSED" }) },
      { id: "4", label: "Conversion", value: `${conversion}%`, onPress: () => navigation.navigate("Leads", { initialStatus: "CLOSED" }) },
      { id: "5", label: "Inventory Utilization", value: `${utilization}%`, onPress: () => navigation.navigate("Inventory", { initialSearch: "Sold" }) },
      { id: "6", label: "Inventory Value", value: `Rs ${inventoryValue.toLocaleString("en-IN")}`, onPress: () => navigation.navigate("Inventory") },
    ];
  }, [navigation, scoped.assets, scoped.leads]);

  const stageRows = useMemo(() => {
    const total = scoped.leads.length;
    return STAGES.map((status) => {
      const count = scoped.leads.filter((lead) => String(lead.status || "NEW") === status).length;
      const share = total ? Math.round((count / total) * 100) : 0;
      return { id: status, status, count, share };
    });
  }, [scoped.leads]);

  const topLocations = useMemo(() => {
    const map = new Map<string, { location: string; units: number }>();

    scoped.assets.forEach((asset) => {
      const key = String(asset.location || "Unspecified");
      if (!map.has(key)) {
        map.set(key, { location: key, units: 0 });
      }
      map.get(key)!.units += 1;
    });

    return [...map.values()].sort((a, b) => b.units - a.units).slice(0, 6);
  }, [scoped.assets]);

  const shareReport = async () => {
    const lines: string[] = [];
    lines.push(`Range,${rangeKey}`);
    lines.push("Section,Metric,Value");

    metrics.forEach((row) => {
      lines.push(`Summary,${row.label},${row.value}`);
    });

    stageRows.forEach((row) => {
      lines.push(`Lead Funnel,${row.status},${row.count} (${row.share}%)`);
    });

    topLocations.forEach((row) => {
      lines.push(`Locations,${row.location},${row.units} units`);
    });

    await Share.share({
      title: "Samvid Reports",
      message: lines.join("\n"),
    });
  };

  return (
    <Screen title="Intelligence Reports" subtitle="Funnel + Inventory" loading={loading} error={error}>
      <View style={styles.headerRow}>
        <View style={styles.filters}>
          {RANGE_OPTIONS.map((range) => (
            <Pressable
              key={range}
              style={[styles.rangeChip, rangeKey === range && styles.rangeChipActive]}
              onPress={() => setRangeKey(range)}
            >
              <Text style={[styles.rangeText, rangeKey === range && styles.rangeTextActive]}>{range}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable style={styles.exportBtn} onPress={shareReport}>
          <Text style={styles.exportText}>Export</Text>
        </Pressable>
      </View>

      <FlatList
        data={metrics}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={item.onPress}>
            <Text style={styles.label}>{item.label}</Text>
            <Text style={styles.value}>{item.value}</Text>
          </Pressable>
        )}
        ListFooterComponent={
          <>
            <Text style={styles.section}>Lead Funnel Stages</Text>
            {stageRows.map((row) => (
              <Pressable
                key={row.id}
                style={styles.rowCard}
                onPress={() => navigation.navigate("Leads", { initialStatus: row.status })}
              >
                <View style={styles.rowLine}>
                  <Text style={styles.rowTitle}>{row.status}</Text>
                  <Text style={styles.rowMeta}>{row.count} ({row.share}%)</Text>
                </View>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${Math.max(row.share, 4)}%` }]} />
                </View>
              </Pressable>
            ))}

            <Text style={styles.section}>Top Inventory Locations</Text>
            {topLocations.length === 0 ? (
              <Text style={styles.empty}>No location data</Text>
            ) : (
              topLocations.map((row) => (
                <Pressable
                  key={row.location}
                  style={styles.rowCard}
                  onPress={() => navigation.navigate("Inventory", { initialSearch: row.location })}
                >
                  <View style={styles.rowLine}>
                    <Text style={styles.rowTitle}>{row.location}</Text>
                    <Text style={styles.rowMeta}>{row.units} units</Text>
                  </View>
                </Pressable>
              ))
            )}
          </>
        }
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    gap: 8,
  },
  filters: {
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
  rangeChip: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#fff",
  },
  rangeChipActive: {
    borderColor: "#0f172a",
    backgroundColor: "#0f172a",
  },
  rangeText: {
    fontSize: 12,
    color: "#334155",
  },
  rangeTextActive: {
    color: "#fff",
  },
  card: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    backgroundColor: "#fff",
    padding: 12,
    marginBottom: 8,
  },
  label: {
    textTransform: "uppercase",
    fontSize: 12,
    color: "#64748b",
  },
  value: {
    marginTop: 8,
    fontSize: 22,
    fontWeight: "700",
    color: "#0f172a",
  },
  section: {
    marginTop: 12,
    marginBottom: 8,
    fontWeight: "700",
    color: "#334155",
  },
  rowCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    backgroundColor: "#fff",
    padding: 10,
    marginBottom: 8,
  },
  rowLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  rowTitle: {
    color: "#0f172a",
    fontWeight: "600",
  },
  rowMeta: {
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
  empty: {
    textAlign: "center",
    color: "#64748b",
    marginVertical: 10,
  },
});
