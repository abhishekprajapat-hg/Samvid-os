import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { Screen } from "../../components/common/Screen";
import { AppButton, AppChip } from "../../components/common/ui";
import { clearLeadFollowUp, getAllLeads } from "../../services/leadService";
import { toErrorMessage } from "../../utils/errorMessage";
import type { Lead } from "../../types";

const COMMISSION_PER_DEAL = 50000;
const RANGE_OPTIONS = ["ALL", "THIS_MONTH", "CUSTOM"] as const;
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

const toObjectIdString = (value: any): string => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && value._id) return String(value._id);
  return String(value);
};

const toAmountNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const getLeadRelatedInventories = (lead: Lead): any[] => {
  const merged: any[] = [];
  const seen = new Set<string>();
  const pushUnique = (value: any) => {
    const id = toObjectIdString(value);
    if (!id || seen.has(id)) return;
    seen.add(id);
    merged.push(value);
  };

  pushUnique((lead as any)?.inventoryId);
  if (Array.isArray((lead as any)?.relatedInventoryIds)) {
    (lead as any).relatedInventoryIds.forEach((row: any) => pushUnique(row));
  }

  return merged;
};

const getLeadSaleEntries = (lead: Lead): Array<{ entryKey: string; totalAmount: number; remainingAmount: number }> => {
  const leadId = toObjectIdString((lead as any)?._id) || "lead";
  const leadStatus = String((lead as any)?.status || "").trim().toUpperCase();
  const isClosedContext = ["CLOSED", "REQUESTED"].includes(leadStatus);
  const linkedInventories = getLeadRelatedInventories(lead);
  const entries: Array<{ entryKey: string; totalAmount: number; remainingAmount: number }> = [];

  linkedInventories.forEach((inventory, index) => {
    if (!inventory || typeof inventory !== "object") return;

    const saleTotalAmount = toAmountNumber((inventory as any)?.saleDetails?.totalAmount);
    const inventoryPrice = toAmountNumber((inventory as any)?.price);
    const totalAmount =
      saleTotalAmount !== null && saleTotalAmount > 0
        ? saleTotalAmount
        : inventoryPrice;

    if (totalAmount === null || totalAmount <= 0) return;

    const inventoryStatus = String((inventory as any)?.status || "").trim().toUpperCase();
    const hasSaleDetails = saleTotalAmount !== null && saleTotalAmount > 0;
    const isSoldInventory = inventoryStatus === "SOLD" || hasSaleDetails;
    if (!isClosedContext && !isSoldInventory) return;

    const remainingRaw = toAmountNumber((inventory as any)?.saleDetails?.remainingAmount);
    const remainingAmount =
      remainingRaw === null
        ? 0
        : Math.max(0, Math.min(remainingRaw, totalAmount));
    const entryKey = toObjectIdString(inventory) || `${leadId}:${index}`;

    entries.push({
      entryKey,
      totalAmount,
      remainingAmount,
    });
  });

  if (entries.length > 0 || !isClosedContext) return entries;

  const fallbackInventory = linkedInventories.find((inventory) => {
    if (!inventory || typeof inventory !== "object") return false;
    const amount = toAmountNumber((inventory as any)?.price);
    return amount !== null && amount > 0;
  });
  const fallbackTotalAmount = toAmountNumber((fallbackInventory as any)?.price);
  if (fallbackTotalAmount === null || fallbackTotalAmount <= 0) return entries;

  const paymentType = String((lead as any)?.dealPayment?.paymentType || "").trim().toUpperCase();
  const dealRemainingRaw = toAmountNumber((lead as any)?.dealPayment?.remainingAmount);
  const fallbackRemainingAmount =
    paymentType === "PARTIAL" && dealRemainingRaw !== null
      ? Math.max(0, Math.min(dealRemainingRaw, fallbackTotalAmount))
      : 0;

  entries.push({
    entryKey: `${leadId}:fallback`,
    totalAmount: fallbackTotalAmount,
    remainingAmount: fallbackRemainingAmount,
  });

  return entries;
};

const pad2 = (value: number) => String(value).padStart(2, "0");
const toDateInputValue = (value: Date) => `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`;

const WebDateInput = ({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
}) => {
  if (Platform.OS === "web") {
    return (
      <View style={styles.webInputWrap}>
        <input
          value={value}
          onChange={(event) => onChange((event.target as HTMLInputElement).value)}
          placeholder={placeholder}
          type="date"
          style={styles.webDateInput as any}
        />
      </View>
    );
  }
  return <TextInput style={styles.modalInput} value={value} onChangeText={onChange} placeholder={placeholder} />;
};

export const FinancialCoreScreen = () => {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [rangeKey, setRangeKey] = useState<RangeKey>("ALL");
  const [selectedMonthDate, setSelectedMonthDate] = useState(new Date());
  const [customFromDate, setCustomFromDate] = useState<Date | null>(null);
  const [customToDate, setCustomToDate] = useState<Date | null>(null);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showCustomFromPicker, setShowCustomFromPicker] = useState(false);
  const [showCustomToPicker, setShowCustomToPicker] = useState(false);
  const [webMonthPickerVisible, setWebMonthPickerVisible] = useState(false);
  const [webMonthDateValue, setWebMonthDateValue] = useState(toDateInputValue(new Date()));
  const [webCustomPickerVisible, setWebCustomPickerVisible] = useState(false);
  const [webCustomFromValue, setWebCustomFromValue] = useState("");
  const [webCustomToValue, setWebCustomToValue] = useState("");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [clearingFollowUpId, setClearingFollowUpId] = useState("");

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
    if (rangeKey === "ALL") return leads;
    if (rangeKey === "THIS_MONTH") {
      return leads.filter((lead) => {
        const createdAt = toDate(lead.createdAt);
        if (!createdAt) return false;
        return (
          createdAt.getFullYear() === selectedMonthDate.getFullYear()
          && createdAt.getMonth() === selectedMonthDate.getMonth()
        );
      });
    }
    if (!customFromDate || !customToDate) return [];
    const start = new Date(customFromDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(customToDate);
    end.setHours(23, 59, 59, 999);
    return leads.filter((lead) => {
      const createdAt = toDate(lead.createdAt);
      if (!createdAt) return false;
      return createdAt >= start && createdAt <= end;
    });
  }, [leads, rangeKey, selectedMonthDate, customFromDate, customToDate]);

  const periodLabel = useMemo(() => {
    if (rangeKey === "ALL") return "All data";
    if (rangeKey === "THIS_MONTH") {
      return selectedMonthDate.toLocaleString("en-IN", { month: "long", year: "numeric" });
    }
    if (customFromDate && customToDate) {
      return `${customFromDate.toLocaleDateString("en-IN")} to ${customToDate.toLocaleDateString("en-IN")}`;
    }
    if (customFromDate) return `From ${customFromDate.toLocaleDateString("en-IN")}`;
    return "Custom range";
  }, [rangeKey, selectedMonthDate, customFromDate, customToDate]);

  const dashboard = useMemo(() => {
    const statusCount: Record<string, number> = {};
    PIPELINE_STATUSES.forEach((status) => {
      statusCount[status.key] = 0;
    });

    const sourceCount = { META: 0, MANUAL: 0, OTHER: 0 };
    const activeStatuses = new Set(["NEW", "CONTACTED", "INTERESTED", "SITE_VISIT"]);
    const countedSaleKeys = new Set<string>();
    let totalSellAmount = 0;
    let pendingSellCollection = 0;

    scopedLeads.forEach((lead) => {
      const status = String(lead.status || "NEW");
      const source = String(lead.source || "");
      if (Object.prototype.hasOwnProperty.call(statusCount, status)) {
        statusCount[status] += 1;
      }
      if (source === "META") sourceCount.META += 1;
      else if (source === "MANUAL") sourceCount.MANUAL += 1;
      else sourceCount.OTHER += 1;

      getLeadSaleEntries(lead).forEach((entry) => {
        if (countedSaleKeys.has(entry.entryKey)) return;
        countedSaleKeys.add(entry.entryKey);
        totalSellAmount += entry.totalAmount;
        pendingSellCollection += entry.remainingAmount;
      });
    });

    const totalLeads = scopedLeads.length;
    const closedDeals = statusCount.CLOSED || 0;
    const lostDeals = statusCount.LOST || 0;
    const activePipeline = [...activeStatuses].reduce((sum, status) => sum + (statusCount[status] || 0), 0);
    const conversionRate = totalLeads > 0 ? Math.round((closedDeals / totalLeads) * 100) : 0;
    const winRate = closedDeals + lostDeals > 0 ? Math.round((closedDeals / (closedDeals + lostDeals)) * 100) : 0;
    const collectedSellValue = Math.max(0, totalSellAmount - pendingSellCollection);
    const commissionPayable = closedDeals * COMMISSION_PER_DEAL;
    const avgCommissionPerClosed = closedDeals > 0 ? commissionPayable / closedDeals : 0;

    return {
      totalLeads,
      closedDeals,
      lostDeals,
      activePipeline,
      conversionRate,
      winRate,
      totalSellAmount,
      pendingSellCollection,
      collectedSellValue,
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

  const openMonthPicker = () => {
    if (Platform.OS === "web") {
      setWebMonthDateValue(toDateInputValue(selectedMonthDate));
      setWebMonthPickerVisible(true);
      return;
    }
    setShowMonthPicker(true);
  };

  const openCustomRangePicker = () => {
    if (Platform.OS === "web") {
      setWebCustomFromValue(customFromDate ? toDateInputValue(customFromDate) : "");
      setWebCustomToValue(customToDate ? toDateInputValue(customToDate) : "");
      setWebCustomPickerVisible(true);
      return;
    }
    setShowCustomFromPicker(true);
  };

  const applyWebMonthPicker = () => {
    if (!webMonthDateValue) {
      setError("Please select date");
      return;
    }
    const parsed = new Date(`${webMonthDateValue}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) {
      setError("Please select valid date");
      return;
    }
    setSelectedMonthDate(parsed);
    setWebMonthPickerVisible(false);
  };

  const applyWebCustomRange = () => {
    if (!webCustomFromValue || !webCustomToValue) {
      setError("Please select from and to date");
      return;
    }
    const parsedFrom = new Date(`${webCustomFromValue}T00:00:00`);
    const parsedTo = new Date(`${webCustomToValue}T00:00:00`);
    if (Number.isNaN(parsedFrom.getTime()) || Number.isNaN(parsedTo.getTime())) {
      setError("Please select valid custom dates");
      return;
    }
    if (parsedTo < parsedFrom) {
      setError("To date cannot be before from date");
      return;
    }
    setCustomFromDate(parsedFrom);
    setCustomToDate(parsedTo);
    setWebCustomPickerVisible(false);
  };

  const clearFollowUpForLead = (lead: Lead) => {
    if (!lead?._id) return;
    Alert.alert(
      "Delete follow-up",
      `Delete follow-up for "${lead.name || "this lead"}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setClearingFollowUpId(String(lead._id));
              const updated = await clearLeadFollowUp(String(lead._id), String(lead.status || "NEW"));
              if (!updated || updated.nextFollowUp) {
                throw new Error("Follow-up not cleared");
              }
              await load(true);
            } catch (e) {
              setError(toErrorMessage(e, "Failed to delete follow-up"));
            } finally {
              setClearingFollowUpId("");
            }
          },
        },
      ],
    );
  };

  return (
    <Screen title="Financial Core" subtitle="Finance Dashboard" loading={loading} error={error}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.sectionCard}>
          <View style={styles.filterRow}>
            <AppChip label="All" active={rangeKey === "ALL"} onPress={() => setRangeKey("ALL")} />
            <AppChip label="This Month" active={rangeKey === "THIS_MONTH"} onPress={() => setRangeKey("THIS_MONTH")} />
            <AppChip
              label="Custom"
              active={rangeKey === "CUSTOM"}
              onPress={() => {
                setRangeKey("CUSTOM");
                openCustomRangePicker();
              }}
            />
            <View style={{ flex: 1 }} />
            <Pressable style={styles.calendarIconBtn} onPress={openMonthPicker}>
              <Ionicons name="calendar-outline" size={14} color="#334155" />
            </Pressable>
            <AppButton title={refreshing ? "Refreshing..." : "Refresh"} variant="ghost" onPress={() => load(true)} disabled={refreshing} />
          </View>
          <Text style={styles.periodText}>Showing: {periodLabel}</Text>
          {rangeKey === "CUSTOM" ? (
            <View style={styles.customRangeRow}>
              <Pressable style={styles.customDateBtn} onPress={openCustomRangePicker}>
                <Text style={styles.customDateText}>From: {customFromDate ? customFromDate.toLocaleDateString("en-IN") : "Select"}</Text>
              </Pressable>
              <Pressable style={styles.customDateBtn} onPress={openCustomRangePicker}>
                <Text style={styles.customDateText}>To: {customToDate ? customToDate.toLocaleDateString("en-IN") : "Select"}</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        {showMonthPicker ? (
          <DateTimePicker
            value={selectedMonthDate}
            mode="date"
            display="default"
            onChange={(_, next) => {
              setShowMonthPicker(false);
              if (next) setSelectedMonthDate(next);
            }}
          />
        ) : null}
        {showCustomFromPicker ? (
          <DateTimePicker
            value={customFromDate || new Date()}
            mode="date"
            display="default"
            onChange={(_, next) => {
              setShowCustomFromPicker(false);
              if (next) {
                setCustomFromDate(next);
                if (!customToDate || customToDate < next) {
                  setCustomToDate(next);
                }
                setTimeout(() => setShowCustomToPicker(true), 30);
              }
            }}
          />
        ) : null}
        {showCustomToPicker ? (
          <DateTimePicker
            value={customToDate || customFromDate || new Date()}
            mode="date"
            display="default"
            onChange={(_, next) => {
              setShowCustomToPicker(false);
              if (next) {
                if (customFromDate && next < customFromDate) {
                  setCustomToDate(customFromDate);
                  return;
                }
                setCustomToDate(next);
              }
            }}
          />
        ) : null}

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
            title="Total Sell Value"
            value={formatCurrency(dashboard.totalSellAmount)}
            helper={`Collected ${formatCurrency(dashboard.collectedSellValue)} | Pending ${formatCurrency(dashboard.pendingSellCollection)}`}
            onPress={() => navigation.navigate("Leads", { initialStatus: "CLOSED" })}
          />
          <MetricCard
            title="Remaining Amount"
            value={formatCurrency(dashboard.pendingSellCollection)}
            helper="Pending collection on partial closures"
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
                  <View style={styles.watchRightCol}>
                    <Text style={[styles.watchDate, item.isOverdue && styles.watchDateOverdue]}>
                      {formatDateTime(item.nextFollowUp)}
                    </Text>
                    <Pressable
                      style={styles.followupDeleteBtn}
                      onPress={(event: any) => {
                        event?.stopPropagation?.();
                        clearFollowUpForLead(item);
                      }}
                      disabled={clearingFollowUpId === item._id}
                    >
                      <Ionicons name="trash-outline" size={13} color="#b91c1c" />
                      <Text style={styles.followupDeleteText}>{clearingFollowUpId === item._id ? "..." : "Delete"}</Text>
                    </Pressable>
                  </View>
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

      <Modal visible={webMonthPickerVisible} transparent animationType="fade" onRequestClose={() => setWebMonthPickerVisible(false)}>
        <View style={styles.modalWrap}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select Month/Date</Text>
            <WebDateInput value={webMonthDateValue} onChange={setWebMonthDateValue} placeholder="YYYY-MM-DD" />
            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancelBtn} onPress={() => setWebMonthPickerVisible(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalApplyBtn} onPress={applyWebMonthPicker}>
                <Text style={styles.modalApplyText}>Apply</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={webCustomPickerVisible} transparent animationType="fade" onRequestClose={() => setWebCustomPickerVisible(false)}>
        <View style={styles.modalWrap}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select Custom Range</Text>
            <WebDateInput value={webCustomFromValue} onChange={setWebCustomFromValue} placeholder="From date" />
            <WebDateInput value={webCustomToValue} onChange={setWebCustomToValue} placeholder="To date" />
            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancelBtn} onPress={() => setWebCustomPickerVisible(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalApplyBtn} onPress={applyWebCustomRange}>
                <Text style={styles.modalApplyText}>Apply</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
  calendarIconBtn: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 9,
    backgroundColor: "#fff",
    height: 36,
    width: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  periodText: {
    marginTop: 8,
    color: "#475569",
    fontSize: 11,
    fontWeight: "600",
  },
  customRangeRow: {
    marginTop: 8,
    flexDirection: "row",
    gap: 8,
  },
  customDateBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    backgroundColor: "#fff",
    padding: 10,
  },
  customDateText: {
    color: "#334155",
    fontSize: 11,
    fontWeight: "600",
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
    width: 126,
    textAlign: "right",
  },
  watchRightCol: {
    width: 126,
    alignItems: "flex-end",
    gap: 6,
  },
  watchDateOverdue: {
    color: "#b91c1c",
  },
  followupDeleteBtn: {
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: "#fff1f2",
    borderRadius: 8,
    minHeight: 24,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  followupDeleteText: {
    color: "#b91c1c",
    fontSize: 10,
    fontWeight: "700",
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
  modalWrap: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.35)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 14,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 14,
  },
  modalTitle: {
    color: "#0f172a",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 10,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    backgroundColor: "#fff",
    color: "#0f172a",
    height: 44,
    paddingHorizontal: 12,
    marginBottom: 8,
    fontSize: 13,
  },
  webInputWrap: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    backgroundColor: "#fff",
    height: 44,
    marginBottom: 8,
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  webDateInput: {
    height: 30,
    fontSize: 13,
    color: "#0f172a",
    backgroundColor: "transparent",
    borderWidth: 0,
    padding: 0,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 6,
  },
  modalCancelBtn: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    minWidth: 90,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    backgroundColor: "#fff",
  },
  modalCancelText: {
    color: "#334155",
    fontWeight: "600",
    fontSize: 12,
  },
  modalApplyBtn: {
    borderWidth: 1,
    borderColor: "#0f172a",
    borderRadius: 10,
    minWidth: 90,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    backgroundColor: "#0f172a",
  },
  modalApplyText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
  },
});
