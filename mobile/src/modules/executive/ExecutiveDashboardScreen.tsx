import React, { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Screen } from "../../components/common/Screen";
import { SharedPerformancePanel } from "../../components/dashboard/SharedPerformancePanel";
import { getAllLeads, getCompanyPerformanceOverview } from "../../services/leadService";
import { toErrorMessage } from "../../utils/errorMessage";
import type { Lead } from "../../types";
import type { CompanyPerformanceOverview } from "../../services/leadService";
import { themedStyles } from "../../theme/themedStyles";

const ACTIVE_STATUSES = new Set(["NEW", "CONTACTED", "INTERESTED", "SITE_VISIT"]);

const formatCurrency = (value: number) => `Rs ${Math.round(value).toLocaleString("en-IN")}`;

const formatDate = (value?: string) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
};

const getLeadPendingPaymentRows = (lead: Lead) => {
  const merged: any[] = [];
  const seen = new Set<string>();
  const pushUnique = (row: any) => {
    const id = String(row?._id || "");
    if (!id || seen.has(id)) return;
    seen.add(id);
    merged.push(row);
  };

  if (lead.inventoryId && typeof lead.inventoryId === "object") {
    pushUnique(lead.inventoryId);
  }
  if (Array.isArray(lead.relatedInventoryIds)) {
    lead.relatedInventoryIds.forEach((row) => pushUnique(row));
  }

  return merged
    .map((row: any) => ({
      remainingAmount: Number(row?.saleMeta?.remainingAmount || 0),
      remainingDueDate: String(row?.saleMeta?.remainingDueDate || "").trim(),
    }))
    .filter((row) => Number.isFinite(row.remainingAmount) && row.remainingAmount > 0);
};

export const ExecutiveDashboardScreen = () => {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [companyPerformance, setCompanyPerformance] = useState<CompanyPerformanceOverview | null>(null);
  const [showAllFollowUps, setShowAllFollowUps] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError("");
        const [rows, overview] = await Promise.all([
          getAllLeads(),
          getCompanyPerformanceOverview().catch(() => null),
        ]);
        setLeads(Array.isArray(rows) ? rows : []);
        setCompanyPerformance(overview);
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
        .sort((a, b) => new Date(a.nextFollowUp || "").getTime() - new Date(b.nextFollowUp || "").getTime()),
    [leads],
  );
  const visibleFollowUps = useMemo(
    () => (showAllFollowUps ? urgentFollowUps : urgentFollowUps.slice(0, 5)),
    [urgentFollowUps, showAllFollowUps],
  );

  const openLeads = (params: Record<string, unknown>) => {
    navigation.navigate("Leads", params);
  };

  return (
    <Screen title="Executive Dashboard" subtitle="My Performance" loading={loading} error={error}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Pressable style={styles.hero} onPress={() => openLeads({ filterPreset: "PIPELINE" })}>
          <Text style={styles.heroLabel}>PERSONAL TARGET BOARD</Text>
          <Text style={styles.heroTitle}>{summary.closeRate}% Close Rate</Text>
          <Text style={styles.heroSub}>{summary.closed} deals closed from {summary.total} leads</Text>
        </Pressable>

        <View style={styles.row}>
          <StatCard label="My Leads" value={summary.total} onPress={() => openLeads({ initialStatus: "ALL" })} />
          <StatCard label="Active" value={summary.active} onPress={() => openLeads({ filterPreset: "PIPELINE" })} />
        </View>

        <View style={styles.row}>
          <StatCard label="Closed" value={summary.closed} onPress={() => openLeads({ initialStatus: "CLOSED" })} />
          <StatCard
            label="Commission"
            value={formatCurrency(summary.commission)}
            onPress={() =>
              openLeads({
                initialStatus: "CLOSED",
                highlightMetric: "ESTIMATED_REVENUE",
                estimatedRevenue: summary.commission,
                closedDeals: summary.closed,
              })
            }
          />
        </View>

        <Pressable style={styles.riskCard} onPress={() => openLeads({ filterPreset: "DUE_FOLLOWUP" })}>
          <Text style={styles.riskTitle}>Follow-up Risk</Text>
          <Text style={styles.riskValue}>{summary.dueFollowUps}</Text>
          <Text style={styles.riskSub}>follow-ups are overdue</Text>
        </Pressable>

        <View style={styles.listCard}>
          <Text style={styles.listTitle}>Upcoming Follow-ups</Text>
          {visibleFollowUps.length === 0 ? (
            <Text style={styles.empty}>No scheduled follow-up right now</Text>
          ) : (
            visibleFollowUps.map((lead) => (
              <Pressable
                key={lead._id}
                style={styles.itemRow}
                onPress={() => navigation.navigate("LeadDetails", { leadId: lead._id })}
              >
                <View>
                  <Text style={styles.itemName}>{lead.name}</Text>
                  <Text style={styles.itemMeta}>{lead.projectInterested || "-"}</Text>
                  {getLeadPendingPaymentRows(lead).map((pending, index) => (
                    <Text key={`${lead._id}-pending-${index}`} style={styles.itemMeta}>
                      Pending: {formatCurrency(pending.remainingAmount)} | Due: {pending.remainingDueDate || "-"}
                    </Text>
                  ))}
                </View>
                <Text style={styles.itemDate}>{formatDate(lead.nextFollowUp)}</Text>
              </Pressable>
            ))
          )}
          {urgentFollowUps.length > 5 ? (
            <View style={styles.inlineActionRow}>
              <View />
              <Pressable onPress={() => setShowAllFollowUps((prev) => !prev)}>
                <Text style={styles.linkTextCompact}>{showAllFollowUps ? "Show less" : "Show more"}</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        <SharedPerformancePanel leads={leads} overview={companyPerformance} />
      </ScrollView>
    </Screen>
  );
};

const StatCard = ({ label, value, onPress }: { label: string; value: string | number; onPress?: () => void }) => (
  <Pressable style={styles.statCard} onPress={onPress} disabled={!onPress}>
    <Text style={styles.statLabel}>{label}</Text>
    <Text style={styles.statValue}>{value}</Text>
  </Pressable>
);

const styles = themedStyles((c) => StyleSheet.create({
  container: {
    gap: 10,
    paddingBottom: 14,
  },
  hero: {
    borderWidth: 1,
    borderColor: c.violet[200],
    borderRadius: 14,
    backgroundColor: c.violet[50],
    padding: 14,
  },
  heroLabel: {
    fontSize: 10,
    textTransform: "uppercase",
    fontWeight: "700",
    color: c.violet[800],
    letterSpacing: 0.8,
  },
  heroTitle: {
    marginTop: 6,
    fontSize: 24,
    fontWeight: "800",
    color: c.text,
  },
  heroSub: {
    marginTop: 4,
    fontSize: 12,
    color: c.slate[600],
  },
  row: {
    flexDirection: "row",
    gap: 10,
  },
  statCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 12,
    backgroundColor: c.surface,
    padding: 12,
  },
  statLabel: {
    fontSize: 11,
    color: c.textMuted,
    textTransform: "uppercase",
    fontWeight: "700",
  },
  statValue: {
    marginTop: 6,
    fontSize: 22,
    color: c.text,
    fontWeight: "800",
  },
  riskCard: {
    borderWidth: 1,
    borderColor: c.errorBorder,
    borderRadius: 12,
    backgroundColor: c.errorBg,
    padding: 12,
  },
  riskTitle: {
    fontSize: 12,
    color: c.rose[700],
    textTransform: "uppercase",
    fontWeight: "700",
  },
  riskValue: {
    marginTop: 6,
    fontSize: 30,
    fontWeight: "800",
    color: c.rose[800],
  },
  riskSub: {
    marginTop: 2,
    fontSize: 12,
    color: c.rose[700],
  },
  listCard: {
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 12,
    backgroundColor: c.surface,
    padding: 12,
  },
  listTitle: {
    fontSize: 12,
    color: c.text,
    textTransform: "uppercase",
    fontWeight: "700",
    marginBottom: 8,
  },
  empty: {
    color: c.textMuted,
    fontSize: 13,
  },
  itemRow: {
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: c.surfaceMuted,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  itemName: {
    color: c.text,
    fontWeight: "700",
  },
  itemMeta: {
    marginTop: 2,
    color: c.textMuted,
    fontSize: 12,
  },
  itemDate: {
    color: c.slate[700],
    fontSize: 12,
    fontWeight: "600",
  },
  inlineActionRow: {
    marginTop: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  linkTextCompact: {
    color: c.primary,
    fontSize: 12,
    fontWeight: "600",
  },
}));

