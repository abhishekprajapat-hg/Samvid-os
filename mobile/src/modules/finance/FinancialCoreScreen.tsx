import React, { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Screen } from "../../components/common/Screen";
import { getAllLeads } from "../../services/leadService";
import { toErrorMessage } from "../../utils/errorMessage";
import type { Lead } from "../../types";

const COMMISSION_PER_DEAL = 50000;
const RANGE_OPTIONS = ["ALL", "THIS_MONTH", "30_D"] as const;
const PIPELINE_STATUSES = [
  { key: "NEW", label: "New" },
  { key: "CONTACTED", label: "Contacted" },
  { key: "INTERESTED", label: "Interested" },
  { key: "SITE_VISIT", label: "Site Visit" },
  { key: "CLOSED", label: "Closed" },
  { key: "LOST", label: "Lost" },
];

type RangeKey = (typeof RANGE_OPTIONS)[number];

const toDate = (value?: string) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
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

const formatCurrency = (value: number) => `Rs ${Math.round(value || 0).toLocaleString("en-IN")}`;

const formatDateTime = (value?: string) => {
  const parsed = toDate(value);
  if (!parsed) return "-";
  return parsed.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getAssigneeName = (assignedTo?: Lead["assignedTo"]) => {
  if (!assignedTo) return "Unassigned";
  if (typeof assignedTo === "string") return "Unassigned";
  return assignedTo.name || "Unassigned";
};

export const FinancialCoreScreen = () => {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [rangeKey, setRangeKey] = useState<RangeKey>("ALL");
  const [leads, setLeads] = useState<Lead[]>([]);

  const load = async (silent = false) => {
    try {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError("");
      const rows = await getAllLeads();
      setLeads(Array.isArray(rows) ? rows : []);
    } catch (e) {
      setError(toErrorMessage(e, "Failed to load finance data"));
      setLeads([]);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    load(false);
  }, []);

  const scopedLeads = useMemo(() => {
    const start = getRangeStart(rangeKey);
    if (!start) return leads;
    return leads.filter((lead) => {
      const createdAt = toDate(lead.createdAt);
      return createdAt && createdAt >= start;
    });
  }, [leads, rangeKey]);

  const dashboard = useMemo(() => {
    const statusCount: Record<string, number> = {};
    PIPELINE_STATUSES.forEach((status) => {
      statusCount[status.key] = 0;
    });

    const sourceCount = { META: 0, MANUAL: 0, OTHER: 0 };
    const activeStatuses = new Set(["NEW", "CONTACTED", "INTERESTED", "SITE_VISIT"]);

    scopedLeads.forEach((lead) => {
      const status = String(lead.status || "NEW");
      const source = String(lead.source || "");
      if (Object.prototype.hasOwnProperty.call(statusCount, status)) {
        statusCount[status] += 1;
      }
      if (source === "META") sourceCount.META += 1;
      else if (source === "MANUAL") sourceCount.MANUAL += 1;
      else sourceCount.OTHER += 1;
    });

    const totalLeads = scopedLeads.length;
    const closedDeals = statusCount.CLOSED || 0;
    const lostDeals = statusCount.LOST || 0;
    const activePipeline = [...activeStatuses].reduce((sum, status) => sum + (statusCount[status] || 0), 0);
    const conversionRate = totalLeads > 0 ? Math.round((closedDeals / totalLeads) * 100) : 0;
    const winRate = closedDeals + lostDeals > 0 ? Math.round((closedDeals / (closedDeals + lostDeals)) * 100) : 0;
    const commissionPayable = closedDeals * COMMISSION_PER_DEAL;
    const avgCommissionPerClosed = closedDeals > 0 ? commissionPayable / closedDeals : 0;

    return {
      totalLeads,
      closedDeals,
      lostDeals,
      activePipeline,
      conversionRate,
      winRate,
      commissionPayable,
      avgCommissionPerClosed,
      statusCount,
      sourceCount,
    };
  }, [scopedLeads]);

  const statusRows = useMemo(
    () =>
      PIPELINE_STATUSES.map((status) => {
        const count = dashboard.statusCount[status.key] || 0;
        const share = dashboard.totalLeads > 0 ? Math.round((count / dashboard.totalLeads) * 100) : 0;
        return { ...status, count, share };
      }),
    [dashboard.statusCount, dashboard.totalLeads],
  );

  const followUps = useMemo(() => {
    const now = new Date();
    const next7Days = new Date(now);
    next7Days.setDate(next7Days.getDate() + 7);

    const upcoming = scopedLeads
      .filter((lead) => !["CLOSED", "LOST"].includes(String(lead.status || "")))
      .filter((lead) => toDate(lead.nextFollowUp))
      .map((lead) => {
        const followUpDate = toDate(lead.nextFollowUp);
        return {
          ...lead,
          followUpDate,
          isOverdue: followUpDate ? followUpDate < now : false,
        };
      })
      .sort((a, b) => (a.followUpDate?.getTime() || 0) - (b.followUpDate?.getTime() || 0));

    return {
      overdue: upcoming.filter((lead) => lead.isOverdue),
      thisWeek: upcoming.filter(
        (lead) => (lead.followUpDate?.getTime() || 0) >= now.getTime() && (lead.followUpDate?.getTime() || 0) <= next7Days.getTime(),
      ),
      all: upcoming,
    };
  }, [scopedLeads]);

  const recentClosures = useMemo(
    () =>
      scopedLeads
        .filter((lead) => String(lead.status || "") === "CLOSED")
        .sort((a, b) => (toDate(b.updatedAt || b.createdAt)?.getTime() || 0) - (toDate(a.updatedAt || a.createdAt)?.getTime() || 0))
        .slice(0, 8),
    [scopedLeads],
  );

  return (
    <Screen title="Financial Core" subtitle="Finance Dashboard" loading={loading} error={error}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.rangeRow}>
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

        <View style={styles.metricsGrid}>
          <MetricCard
            title="Leads In Scope"
            value={dashboard.totalLeads}
            helper="Filtered by selected range"
            onPress={() => navigation.navigate("Leads", { initialStatus: "ALL" })}
          />
          <MetricCard
            title="Active Pipeline"
            value={dashboard.activePipeline}
            helper="New to Site Visit stages"
            onPress={() => navigation.navigate("Leads", { filterPreset: "PIPELINE", initialStatus: "ALL" })}
          />
          <MetricCard
            title="Closed Deals"
            value={dashboard.closedDeals}
            helper={`Win rate ${dashboard.winRate}%`}
            onPress={() => navigation.navigate("Leads", { initialStatus: "CLOSED" })}
          />
          <MetricCard
            title="Conversion Rate"
            value={`${dashboard.conversionRate}%`}
            helper={`${dashboard.lostDeals} leads lost`}
            onPress={() => navigation.navigate("Leads", { initialStatus: "CLOSED" })}
          />
          <MetricCard
            title="Commission Payable"
            value={formatCurrency(dashboard.commissionPayable)}
            helper={`Avg ${formatCurrency(dashboard.avgCommissionPerClosed)} per closed`}
            onPress={() => navigation.navigate("Leads", { initialStatus: "CLOSED" })}
          />
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Pipeline Breakdown</Text>
          {statusRows.map((row) => (
            <Pressable
              key={row.key}
              style={styles.progressBlock}
              onPress={() => navigation.navigate("Leads", { initialStatus: row.key })}
            >
              <View style={styles.progressHead}>
                <Text style={styles.progressLabel}>{row.label}</Text>
                <Text style={styles.progressMeta}>{row.count} ({row.share}%)</Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${Math.max(3, Math.min(100, row.share))}%` }]} />
              </View>
            </Pressable>
          ))}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Source Mix</Text>
          <SourceRow
            label="Meta Leads"
            count={dashboard.sourceCount.META}
            total={dashboard.totalLeads}
            onPress={() => navigation.navigate("Leads", { initialStatus: "ALL", initialQuery: "META" })}
          />
          <SourceRow
            label="Manual Leads"
            count={dashboard.sourceCount.MANUAL}
            total={dashboard.totalLeads}
            onPress={() => navigation.navigate("Leads", { initialStatus: "ALL", initialQuery: "MANUAL" })}
          />
          <SourceRow
            label="Other Sources"
            count={dashboard.sourceCount.OTHER}
            total={dashboard.totalLeads}
            onPress={() => navigation.navigate("Leads", { initialStatus: "ALL", initialQuery: "OTHER" })}
          />
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Recent Closed Deals</Text>
          {recentClosures.length === 0 ? (
            <Text style={styles.empty}>No closed deals in selected range.</Text>
          ) : (
            recentClosures.map((lead) => (
              <Pressable key={lead._id} style={styles.listRow} onPress={() => navigation.navigate("LeadDetails", { leadId: lead._id })}>
                <View style={styles.listMain}>
                  <Text style={styles.listTitle}>{lead.name || "-"}</Text>
                  <Text style={styles.listMeta}>{lead.projectInterested || "-"} | {lead.phone || "-"}</Text>
                </View>
                <View style={styles.listRight}>
                  <Text style={styles.listMeta}>{getAssigneeName(lead.assignedTo)}</Text>
                  <Text style={styles.listDate}>{formatDateTime(lead.updatedAt || lead.createdAt)}</Text>
                </View>
              </Pressable>
            ))
          )}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Follow-up Watchlist</Text>
          <View style={styles.badgeRow}>
            <Pressable style={styles.badgeDanger} onPress={() => navigation.navigate("Leads", { filterPreset: "DUE_FOLLOWUP" })}>
              <Text style={styles.badgeDangerText}>Overdue: {followUps.overdue.length}</Text>
            </Pressable>
            <Pressable style={styles.badgeWarn} onPress={() => navigation.navigate("Leads", { filterPreset: "DUE_FOLLOWUP" })}>
              <Text style={styles.badgeWarnText}>Next 7 days: {followUps.thisWeek.length}</Text>
            </Pressable>
          </View>

          {followUps.all.length === 0 ? (
            <Text style={styles.empty}>No upcoming follow-ups in selected range.</Text>
          ) : (
            <FlatList
              scrollEnabled={false}
              data={followUps.all.slice(0, 8)}
              keyExtractor={(item) => item._id}
              renderItem={({ item }) => (
                <Pressable
                  style={[styles.watchRow, item.isOverdue ? styles.watchOverdue : styles.watchNormal]}
                  onPress={() => navigation.navigate("LeadDetails", { leadId: item._id })}
                >
                  <View style={styles.listMain}>
                    <Text style={styles.listTitle}>{item.name || "-"}</Text>
                    <Text style={styles.listMeta}>{item.projectInterested || "-"}</Text>
                  </View>
                  <Text style={[styles.watchDate, item.isOverdue && styles.watchDateOverdue]}>
                    {formatDateTime(item.nextFollowUp)}
                  </Text>
                </Pressable>
              )}
            />
          )}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionRow}>
            <Pressable style={styles.actionBtn} onPress={() => navigation.navigate("Leads")}>
              <Text style={styles.actionBtnText}>Open Leads</Text>
            </Pressable>
            <Pressable style={styles.actionBtn} onPress={() => navigation.navigate("Inventory")}>
              <Text style={styles.actionBtnText}>Open Inventory</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
};

const MetricCard = ({
  title,
  value,
  helper,
  onPress,
}: {
  title: string;
  value: string | number;
  helper: string;
  onPress: () => void;
}) => (
  <Pressable style={styles.metricCard} onPress={onPress}>
    <Text style={styles.metricTitle}>{title}</Text>
    <Text style={styles.metricValue}>{value}</Text>
    <Text style={styles.metricHelper}>{helper}</Text>
  </Pressable>
);

const SourceRow = ({
  label,
  count,
  total,
  onPress,
}: {
  label: string;
  count: number;
  total: number;
  onPress: () => void;
}) => {
  const share = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <Pressable style={styles.sourceRow} onPress={onPress}>
      <View style={styles.progressHead}>
        <Text style={styles.progressLabel}>{label}</Text>
        <Text style={styles.progressMeta}>{count} ({share}%)</Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFillDark, { width: `${Math.max(3, Math.min(100, share))}%` }]} />
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 12,
    paddingBottom: 16,
  },
  rangeRow: {
    flexDirection: "row",
    gap: 8,
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
    fontWeight: "600",
  },
  rangeTextActive: {
    color: "#fff",
  },
  metricsGrid: {
    gap: 10,
  },
  metricCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    backgroundColor: "#fff",
    padding: 12,
  },
  metricTitle: {
    fontSize: 11,
    textTransform: "uppercase",
    color: "#64748b",
    fontWeight: "700",
    letterSpacing: 0.7,
  },
  metricValue: {
    marginTop: 7,
    fontSize: 24,
    fontWeight: "800",
    color: "#0f172a",
  },
  metricHelper: {
    marginTop: 3,
    fontSize: 12,
    color: "#64748b",
  },
  sectionCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    backgroundColor: "#fff",
    padding: 12,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 12,
    textTransform: "uppercase",
    color: "#334155",
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  progressBlock: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    backgroundColor: "#f8fafc",
    padding: 8,
  },
  progressHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  progressLabel: {
    color: "#0f172a",
    fontSize: 12,
    fontWeight: "600",
  },
  progressMeta: {
    color: "#475569",
    fontSize: 12,
  },
  progressTrack: {
    marginTop: 7,
    height: 8,
    borderRadius: 6,
    backgroundColor: "#e2e8f0",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#0f172a",
  },
  progressFillDark: {
    height: "100%",
    backgroundColor: "#334155",
  },
  sourceRow: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    backgroundColor: "#f8fafc",
    padding: 8,
  },
  listRow: {
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    paddingVertical: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  listMain: {
    flex: 1,
  },
  listTitle: {
    color: "#0f172a",
    fontWeight: "700",
    fontSize: 13,
  },
  listMeta: {
    marginTop: 2,
    color: "#64748b",
    fontSize: 12,
  },
  listRight: {
    alignItems: "flex-end",
  },
  listDate: {
    marginTop: 2,
    color: "#475569",
    fontSize: 11,
  },
  empty: {
    color: "#64748b",
    fontSize: 12,
    marginTop: 4,
  },
  badgeRow: {
    flexDirection: "row",
    gap: 8,
  },
  badgeDanger: {
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: "#fef2f2",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeDangerText: {
    color: "#b91c1c",
    fontSize: 11,
    fontWeight: "700",
  },
  badgeWarn: {
    borderWidth: 1,
    borderColor: "#fde68a",
    backgroundColor: "#fffbeb",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeWarnText: {
    color: "#92400e",
    fontSize: 11,
    fontWeight: "700",
  },
  watchRow: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 9,
    marginBottom: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  watchOverdue: {
    borderColor: "#fecaca",
    backgroundColor: "#fef2f2",
  },
  watchNormal: {
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
  },
  watchDate: {
    color: "#475569",
    fontSize: 11,
    fontWeight: "600",
    width: 122,
    textAlign: "right",
  },
  watchDateOverdue: {
    color: "#b91c1c",
  },
  actionRow: {
    flexDirection: "row",
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    backgroundColor: "#fff",
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnText: {
    color: "#334155",
    fontWeight: "700",
    fontSize: 12,
  },
});
