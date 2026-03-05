import React, { useEffect, useMemo, useState } from "react";
import { Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Circle, Line, Polyline, Rect, Text as SvgText } from "react-native-svg";
import { Screen } from "../../components/common/Screen";
import { AppButton, AppCard, AppChip, AppInput } from "../../components/common/ui";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";
import { getUsers } from "../../services/userService";
import { assignHierarchyTarget, getMyTargets } from "../../services/targetService";
import { toErrorMessage } from "../../utils/errorMessage";
import type { Lead } from "../../types";

const ACTIVE_STATUSES = new Set(["NEW", "CONTACTED", "INTERESTED", "SITE_VISIT"]);
const DEFAULT_REVENUE_PER_CLOSED = 50000;
const REFRESH_INTERVAL_MS = 30000;

const formatNumber = (value: number) => Number(value || 0).toLocaleString("en-IN");
const formatCurrency = (value: number) => `Rs ${formatNumber(value)}`;
const clampPercent = (value: number) => Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
const pad2 = (value: number) => String(value).padStart(2, "0");
const toDateInputValue = (value: Date) => `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`;

const getMonthKeyFromDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const getLeadDate = (lead: Lead) => {
  const raw = lead.updatedAt || lead.createdAt || "";
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const parseDate = (value?: string) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
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
      label: [row?.projectName, row?.towerName, row?.unitNumber].filter(Boolean).join(" - ") || "Property",
      remainingAmount: Number(row?.saleMeta?.remainingAmount || 0),
      remainingDueDate: String(row?.saleMeta?.remainingDueDate || "").trim(),
    }))
    .filter((row) => Number.isFinite(row.remainingAmount) && row.remainingAmount > 0);
};

const toWeekBuckets = (anchorDate: Date, weeks = 8) => {
  const end = new Date(anchorDate);
  end.setHours(23, 59, 59, 999);
  const buckets: Array<{ label: string; start: Date; end: Date; created: number; closed: number; open: number }> = [];
  for (let i = weeks - 1; i >= 0; i -= 1) {
    const weekEnd = new Date(end);
    weekEnd.setDate(end.getDate() - i * 7);
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekEnd.getDate() - 6);
    weekStart.setHours(0, 0, 0, 0);
    buckets.push({
      label: `${weekStart.getDate()} ${weekStart.toLocaleString("en-IN", { month: "short" })}`,
      start: weekStart,
      end: weekEnd,
      created: 0,
      closed: 0,
      open: 0,
    });
  }
  return buckets;
};

const findBucketIndex = (dateValue: string | undefined, buckets: ReturnType<typeof toWeekBuckets>) => {
  if (!dateValue) return -1;
  const when = new Date(dateValue);
  if (Number.isNaN(when.getTime())) return -1;
  return buckets.findIndex((bucket) => when >= bucket.start && when <= bucket.end);
};

const MiniLineChart = ({ rows }: { rows: Array<{ label: string; created: number; closed: number; open: number }> }) => {
  const w = 330;
  const h = 200;
  const p = 18;
  const maxY = Math.max(1, ...rows.map((row) => Math.max(row.created, row.closed, row.open)));
  const line = (selector: (row: (typeof rows)[number]) => number) =>
    rows
      .map((row, idx) => {
        const x = p + (idx / Math.max(rows.length - 1, 1)) * (w - p * 2);
        const y = h - p - (selector(row) / maxY) * (h - p * 2);
        return `${x},${y}`;
      })
      .join(" ");

  return (
    <Svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`}>
      <Rect x={0} y={0} width={w} height={h} fill="#fff" rx={10} />
      {[0, 1, 2, 3].map((idx) => {
        const y = p + (idx / 3) * (h - p * 2);
        return <Line key={idx} x1={p} y1={y} x2={w - p} y2={y} stroke="#e2e8f0" strokeDasharray="4 4" />;
      })}
      {rows.map((row, idx) => {
        const x = p + (idx / Math.max(rows.length - 1, 1)) * (w - p * 2);
        const barBaseY = h - p;
        const barHeight = (row.created / maxY) * (h - p * 2);
        return <Rect key={`${row.label}-bar`} x={x - 4} y={barBaseY - barHeight} width={8} height={barHeight} fill="#bae6fd" opacity={0.45} rx={4} />;
      })}
      <Polyline fill="none" stroke="#0284c7" strokeWidth={2.4} points={line((r) => r.created)} />
      <Polyline fill="none" stroke="#16a34a" strokeWidth={2.4} points={line((r) => r.closed)} />
      <Polyline fill="none" stroke="#1d4ed8" strokeWidth={2.4} points={line((r) => r.open)} />
      {rows.map((row, idx) => {
        const x = p + (idx / Math.max(rows.length - 1, 1)) * (w - p * 2);
        return (
          <SvgText key={row.label} x={x} y={h - 6} fontSize="8" textAnchor="middle" fill="#64748b">
            {row.label}
          </SvgText>
        );
      })}
    </Svg>
  );
};

const CircularScore = ({ percent }: { percent: number }) => {
  const size = 86;
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const safe = clampPercent(percent);
  const offset = circumference - (safe / 100) * circumference;
  return (
    <Svg width={size} height={size}>
      <Circle cx={size / 2} cy={size / 2} r={radius} stroke="#e2e8f0" strokeWidth={stroke} fill="none" />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="#0ea5e9"
        strokeWidth={stroke}
        strokeLinecap="round"
        fill="none"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <SvgText x={size / 2} y={size / 2 + 4} textAnchor="middle" fontSize="13" fontWeight="700" fill="#0f172a">
        {Math.round(safe)}%
      </SvgText>
    </Svg>
  );
};

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

export const PerformanceScreen = () => {
  const { role } = useAuth();
  const isAdmin = role === "ADMIN";

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [range, setRange] = useState<"ALL" | "THIS_MONTH" | "CUSTOM">("ALL");
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
  const [assigneeDropdownVisible, setAssigneeDropdownVisible] = useState(false);
  const [leaderboardDetailsVisible, setLeaderboardDetailsVisible] = useState(false);
  const [selectedLeaderboardUserId, setSelectedLeaderboardUserId] = useState("");
  const [metricDetailsVisible, setMetricDetailsVisible] = useState(false);
  const [selectedMetricKey, setSelectedMetricKey] = useState<
    "ACTIVE_PIPELINE" | "VISIT_INTENSITY" | "AVG_CLOSED_TICKET" | "ESTIMATED_REVENUE" | "TOTAL_LEADS" | "CLOSED_DEALS" | "PENDING_COLLECTION" | ""
  >("");

  const month = useMemo(() => getMonthKeyFromDate(selectedMonthDate), [selectedMonthDate]);

  const [leads, setLeads] = useState<Lead[]>([]);
  const [users, setUsers] = useState<Array<{ _id?: string; name?: string; role?: string; isActive?: boolean }>>([]);
  const [targetState, setTargetState] = useState<any>({
    month: "",
    canAssign: false,
    assignableReports: [],
    myTarget: null,
    incoming: [],
    outgoing: [],
  });
  const [assignForm, setAssignForm] = useState({
    assignedToId: "",
    leadsTarget: "",
    siteVisitTarget: "",
    revenueTarget: "",
    notes: "",
  });

  const assignableReports = useMemo(
    () => (Array.isArray(targetState?.assignableReports) ? targetState.assignableReports : []),
    [targetState],
  );
  const selectedAssignee = useMemo(
    () => assignableReports.find((row: any) => String(row._id) === assignForm.assignedToId) || null,
    [assignableReports, assignForm.assignedToId],
  );

  const load = async (silent = false) => {
    try {
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError("");

      const [leadRes, userRes, targetRes] = await Promise.all([
        api.get("/leads"),
        getUsers(),
        getMyTargets({ month }),
      ]);

      setLeads(Array.isArray(leadRes.data?.leads) ? leadRes.data.leads : []);
      setUsers(Array.isArray(userRes?.users) ? userRes.users : []);
      setTargetState(targetRes || {});
    } catch (e) {
      setError(toErrorMessage(e, "Failed to load performance dashboard"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, [month]);

  useEffect(() => {
    const timer = setInterval(() => load(true), REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [month]);

  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => setSuccess(""), 1800);
    return () => clearTimeout(timer);
  }, [success]);

  const scopedLeads = useMemo(() => {
    if (range === "ALL") return leads;
    if (range === "THIS_MONTH") {
      return leads.filter((lead) => {
        const d = getLeadDate(lead);
        if (!d) return false;
        return d.getFullYear() === selectedMonthDate.getFullYear() && d.getMonth() === selectedMonthDate.getMonth();
      });
    }
    if (!customFromDate || !customToDate) return [];
    const start = new Date(customFromDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(customToDate);
    end.setHours(23, 59, 59, 999);
    return leads.filter((lead) => {
      const d = getLeadDate(lead);
      if (!d) return false;
      return d >= start && d <= end;
    });
  }, [range, leads, selectedMonthDate, customFromDate, customToDate]);

  const periodLabel = useMemo(() => {
    if (range === "ALL") return "All data";
    if (range === "THIS_MONTH") return selectedMonthDate.toLocaleString("en-IN", { month: "long", year: "numeric" });
    if (customFromDate && customToDate) {
      return `${customFromDate.toLocaleDateString("en-IN")} to ${customToDate.toLocaleDateString("en-IN")}`;
    }
    if (customFromDate) return `From ${customFromDate.toLocaleDateString("en-IN")}`;
    return "Custom range";
  }, [range, selectedMonthDate, customFromDate, customToDate]);

  const snapshot = useMemo(() => {
    const totalLeads = scopedLeads.length;
    const closed = scopedLeads.filter((lead) => String(lead.status || "").toUpperCase() === "CLOSED").length;
    const active = scopedLeads.filter((lead) => ACTIVE_STATUSES.has(String(lead.status || "").toUpperCase())).length;
    const visits = scopedLeads.filter((lead) => String(lead.status || "").toUpperCase() === "SITE_VISIT").length;
    const visitIntensity = active > 0 ? Math.round((visits / active) * 100) : 0;
    const estimatedRevenue = closed * DEFAULT_REVENUE_PER_CLOSED;
    const avgClosedTicket = closed > 0 ? Math.round(estimatedRevenue / closed) : DEFAULT_REVENUE_PER_CLOSED;

    const latestScopedLeadDate = scopedLeads
      .map((lead) => getLeadDate(lead))
      .filter((d): d is Date => d instanceof Date)
      .sort((a, b) => b.getTime() - a.getTime())[0];
    const anchor =
      range === "CUSTOM" && customToDate
        ? customToDate
        : range === "ALL"
          ? latestScopedLeadDate || new Date()
          : new Date(selectedMonthDate.getFullYear(), selectedMonthDate.getMonth() + 1, 0);
    const weekBuckets = toWeekBuckets(anchor, 8);

    scopedLeads.forEach((lead) => {
      const createdSource = parseDate(lead.createdAt) || getLeadDate(lead);
      const createdIdx = findBucketIndex(createdSource ? createdSource.toISOString() : undefined, weekBuckets);
      if (createdIdx >= 0) weekBuckets[createdIdx].created += 1;
      if (String(lead.status || "").toUpperCase() === "CLOSED") {
        const closedSource = parseDate(lead.updatedAt) || parseDate(lead.createdAt) || getLeadDate(lead);
        const closedIdx = findBucketIndex(closedSource ? closedSource.toISOString() : undefined, weekBuckets);
        if (closedIdx >= 0) weekBuckets[closedIdx].closed += 1;
      }
    });
    weekBuckets.forEach((bucket) => {
      bucket.open = Math.max(0, bucket.created - bucket.closed);
    });

    return {
      totalLeads,
      closed,
      active,
      visits,
      visitIntensity,
      estimatedRevenue,
      avgClosedTicket,
      weekly: weekBuckets.map((row) => ({ label: row.label, created: row.created, closed: row.closed, open: row.open })),
    };
  }, [scopedLeads, range, customToDate, selectedMonthDate]);

  const pendingCollectionSummary = useMemo(() => {
    const rows = scopedLeads.flatMap((lead) =>
      getLeadPendingPaymentRows(lead).map((pending) => ({
        lead,
        ...pending,
      })),
    );
    const totalAmount = rows.reduce((sum, row) => sum + Number(row.remainingAmount || 0), 0);
    const dueDates = rows
      .map((row) => String(row.remainingDueDate || "").trim())
      .filter(Boolean)
      .map((value) => ({ raw: value, date: new Date(value) }))
      .filter((row) => !Number.isNaN(row.date.getTime()))
      .sort((a, b) => a.date.getTime() - b.date.getTime());
    return {
      totalAmount,
      rows,
      nextDueDate: dueDates[0]?.raw || "",
    };
  }, [scopedLeads]);

  const leaderboard = useMemo(() => {
    const activeUsers = users.filter((row) => row.isActive !== false);
    const rows = activeUsers.map((user) => {
      const userId = String(user._id || "");
      const assigned = scopedLeads.filter((lead) => {
        const assignedObj = lead.assignedTo as any;
        const assigneeId = String(assignedObj?._id || assignedObj?.id || "");
        return assigneeId && assigneeId === userId;
      });
      const closed = assigned.filter((lead) => String(lead.status || "").toUpperCase() === "CLOSED").length;
      const visits = assigned.filter((lead) => String(lead.status || "").toUpperCase() === "SITE_VISIT").length;
      const active = assigned.filter((lead) => ACTIVE_STATUSES.has(String(lead.status || "").toUpperCase())).length;
      const assignedCount = assigned.length;
      const closeRate = assignedCount > 0 ? (closed / assignedCount) * 100 : 0;
      const visitRate = assignedCount > 0 ? (visits / assignedCount) * 100 : 0;
      // Absolute score: closure heavy, visits secondary. Avoids false 100% when closed is 0.
      const scorePercent = clampPercent(Math.round(closeRate * 0.8 + visitRate * 0.2));
      return {
        id: userId,
        name: String(user.name || "User"),
        role: String(user.role || "-"),
        assigned: assignedCount,
        closed,
        visits,
        scorePercent,
      };
    });
    return rows
      .sort((a, b) => b.scorePercent - a.scorePercent || b.closed - a.closed || b.assigned - a.assigned)
      .slice(0, 10);
  }, [users, scopedLeads]);

  const selectedLeaderboardRow = useMemo(
    () => leaderboard.find((row) => row.id === selectedLeaderboardUserId) || null,
    [leaderboard, selectedLeaderboardUserId],
  );

  const selectedLeaderboardLeads = useMemo(() => {
    if (!selectedLeaderboardUserId) return [];
    return scopedLeads
      .filter((lead) => {
        const assignedObj = lead.assignedTo as any;
        const assigneeId = String(assignedObj?._id || assignedObj?.id || "");
        return assigneeId && assigneeId === selectedLeaderboardUserId;
      })
      .sort((a, b) => {
        const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return bTime - aTime;
      });
  }, [scopedLeads, selectedLeaderboardUserId]);

  const selectedMetricLeads = useMemo(() => {
    const normalize = (lead: Lead) => String(lead.status || "").toUpperCase();
    if (!selectedMetricKey) return [];

    if (selectedMetricKey === "ACTIVE_PIPELINE") {
      return scopedLeads.filter((lead) => ACTIVE_STATUSES.has(normalize(lead)));
    }
    if (selectedMetricKey === "VISIT_INTENSITY") {
      return scopedLeads.filter((lead) => normalize(lead) === "SITE_VISIT");
    }
    if (
      selectedMetricKey === "AVG_CLOSED_TICKET"
      || selectedMetricKey === "ESTIMATED_REVENUE"
      || selectedMetricKey === "CLOSED_DEALS"
    ) {
      return scopedLeads.filter((lead) => normalize(lead) === "CLOSED");
    }
    if (selectedMetricKey === "PENDING_COLLECTION") {
      return scopedLeads.filter((lead) => getLeadPendingPaymentRows(lead).length > 0);
    }
    return scopedLeads;
  }, [scopedLeads, selectedMetricKey]);

  const selectedMetricTitle = useMemo(() => {
    if (selectedMetricKey === "ACTIVE_PIPELINE") return "Active Pipeline Leads";
    if (selectedMetricKey === "VISIT_INTENSITY") return "Site Visit Leads";
    if (selectedMetricKey === "AVG_CLOSED_TICKET") return "Closed Leads (Avg Ticket)";
    if (selectedMetricKey === "ESTIMATED_REVENUE") return "Closed Leads (Revenue)";
    if (selectedMetricKey === "CLOSED_DEALS") return "Closed Leads";
    if (selectedMetricKey === "PENDING_COLLECTION") return "Pending Collections";
    if (selectedMetricKey === "TOTAL_LEADS") return "All Leads";
    return "Metric Details";
  }, [selectedMetricKey]);

  const myTarget = useMemo(() => {
    const row = targetState?.myTarget || {};
    return {
      leadsTarget: Number(row?.leadsTarget || 0),
      revenueTarget: Number(row?.revenueTarget || 0),
      siteVisitTarget: Number(row?.siteVisitTarget || 0),
      leadsAchieved: Number(row?.achievements?.leadsAchieved || 0),
      revenueAchieved: Number(row?.achievements?.revenueAchieved || 0),
      siteVisitsAchieved: Number(row?.achievements?.siteVisitsAchieved || 0),
      leadsPercent: clampPercent(Number(row?.progress?.leadsPercent || 0)),
      revenuePercent: clampPercent(Number(row?.progress?.revenuePercent || 0)),
      siteVisitPercent: clampPercent(Number(row?.progress?.siteVisitPercent || 0)),
    };
  }, [targetState]);

  const assignTarget = async () => {
    const leadsTarget = Number(assignForm.leadsTarget || 0);
    const siteVisitTarget = Number(assignForm.siteVisitTarget || 0);
    const revenueTarget = Number(assignForm.revenueTarget || 0);
    if (!assignForm.assignedToId) {
      setError("Please select reporting user");
      return;
    }
    if (leadsTarget <= 0 && siteVisitTarget <= 0 && revenueTarget <= 0) {
      setError("At least one target should be greater than zero");
      return;
    }
    try {
      setSubmitting(true);
      setError("");
      const result = await assignHierarchyTarget({
        assignedToId: assignForm.assignedToId,
        month,
        leadsTarget,
        siteVisitTarget,
        revenueTarget,
        notes: assignForm.notes.trim(),
      });
      setSuccess(result.message || "Target assigned");
      await load(true);
    } catch (e) {
      setError(toErrorMessage(e, "Unable to assign target"));
    } finally {
      setSubmitting(false);
    }
  };

  const showIncoming = true;

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

  return (
    <Screen title="Performance Dashboard" subtitle="Live Team Insights" loading={loading} error={error}>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {success ? <Text style={styles.success}>{success}</Text> : null}

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
      >
        <AppCard style={styles.sectionCard as object}>
          <View style={styles.filterRow}>
            <AppChip label="All" active={range === "ALL"} onPress={() => setRange("ALL")} />
            <AppChip label="This Month" active={range === "THIS_MONTH"} onPress={() => setRange("THIS_MONTH")} />
            <AppChip
              label="Custom"
              active={range === "CUSTOM"}
              onPress={() => {
                setRange("CUSTOM");
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
          {range === "CUSTOM" ? (
            <View style={styles.customRangeRow}>
              <Pressable style={styles.customDateBtn} onPress={openCustomRangePicker}>
                <Text style={styles.customDateText}>From: {customFromDate ? customFromDate.toLocaleDateString("en-IN") : "Select"}</Text>
              </Pressable>
              <Pressable style={styles.customDateBtn} onPress={openCustomRangePicker}>
                <Text style={styles.customDateText}>To: {customToDate ? customToDate.toLocaleDateString("en-IN") : "Select"}</Text>
              </Pressable>
            </View>
          ) : null}
        </AppCard>

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

        <View style={styles.snapshotGrid}>
          <StatCard
            label="Active Pipeline"
            value={snapshot.active}
            helper="Live open pipeline"
            onPress={() => {
              setSelectedMetricKey("ACTIVE_PIPELINE");
              setMetricDetailsVisible(true);
            }}
          />
          <StatCard
            label="Visit Intensity"
            value={`${snapshot.visitIntensity}%`}
            helper="Site-visits / active leads"
            onPress={() => {
              setSelectedMetricKey("VISIT_INTENSITY");
              setMetricDetailsVisible(true);
            }}
          />
          <StatCard
            label="Avg Closed Ticket"
            value={formatCurrency(snapshot.avgClosedTicket)}
            helper="Average close value"
            onPress={() => {
              setSelectedMetricKey("AVG_CLOSED_TICKET");
              setMetricDetailsVisible(true);
            }}
          />
          <StatCard
            label="Estimated Revenue"
            value={formatCurrency(snapshot.estimatedRevenue)}
            helper="Closed x ticket value"
            onPress={() => {
              setSelectedMetricKey("ESTIMATED_REVENUE");
              setMetricDetailsVisible(true);
            }}
          />
          <StatCard
            label="Total Leads"
            value={snapshot.totalLeads}
            helper={`${snapshot.active} still in pipeline`}
            onPress={() => {
              setSelectedMetricKey("TOTAL_LEADS");
              setMetricDetailsVisible(true);
            }}
          />
          <StatCard
            label="Pending Collection"
            value={formatCurrency(pendingCollectionSummary.totalAmount)}
            helper={pendingCollectionSummary.nextDueDate ? `Next due: ${pendingCollectionSummary.nextDueDate}` : "No due date"}
            onPress={() => {
              setSelectedMetricKey("PENDING_COLLECTION");
              setMetricDetailsVisible(true);
            }}
          />
          <StatCard
            label="Closed Deals"
            value={snapshot.closed}
            helper="Updated every 30 sec"
            onPress={() => {
              setSelectedMetricKey("CLOSED_DEALS");
              setMetricDetailsVisible(true);
            }}
          />
        </View>

        <AppCard style={styles.sectionCard as object}>
          <Text style={styles.sectionTitle}>Role Performance Graph</Text>
          <Text style={styles.sectionSubTitle}>
            {range === "ALL" ? "Weekly throughput across all data" : `Weekly throughput for ${periodLabel}`}
          </Text>
          <View style={styles.graphSplit}>
            <View style={styles.velocityPanel}>
              <Text style={styles.metricLabel}>Close Velocity</Text>
              <View style={styles.velocityScoreRow}>
                <CircularScore percent={snapshot.totalLeads ? (snapshot.closed / snapshot.totalLeads) * 100 : 0} />
                <View style={styles.velocityTextWrap}>
                  <Text style={styles.velocityPercent}>
                    {Math.round(snapshot.totalLeads ? (snapshot.closed / snapshot.totalLeads) * 100 : 0)}%
                  </Text>
                  <Text style={styles.meta}>Closed {snapshot.closed} / Created {snapshot.totalLeads}</Text>
                </View>
              </View>
            </View>
            <View style={styles.chartPanel}>
              <MiniLineChart rows={snapshot.weekly} />
            </View>
          </View>
        </AppCard>

        <AppCard style={styles.sectionCard as object}>
          <Text style={styles.sectionTitle}>Live Leaderboard</Text>
          <Text style={styles.sectionSubTitle}>Who is doing how much work (% score)</Text>
          {leaderboard.length === 0 ? (
            <Text style={styles.meta}>No visible users found for selected range.</Text>
          ) : (
            leaderboard.map((row, index) => (
              <Pressable
                key={`${row.id}-${index}`}
                style={styles.leaderRow}
                onPress={() => {
                  setSelectedLeaderboardUserId(row.id);
                  setLeaderboardDetailsVisible(true);
                }}
              >
                <View style={styles.leaderTopRow}>
                  <View style={styles.leaderRank}>
                    <Text style={styles.leaderRankText}>#{index + 1}</Text>
                  </View>
                  <View style={styles.leaderInfo}>
                    <Text style={styles.leaderName}>{row.name}</Text>
                    <Text style={styles.meta}>{row.role}</Text>
                  </View>
                  <View style={styles.leaderScoreWrap}>
                    <CircularScore percent={row.scorePercent} />
                  </View>
                </View>
                <Text style={styles.meta}>Leads {row.assigned} | Visits {row.visits} | Closed {row.closed}</Text>
                <View style={styles.leaderTrack}>
                  <View style={[styles.leaderFill, { width: `${clampPercent(row.scorePercent)}%` }]} />
                </View>
              </Pressable>
            ))
          )}
        </AppCard>

        <AppCard style={styles.sectionCard as object}>
          <Text style={styles.sectionTitle}>Hierarchy Targets</Text>
          <Text style={styles.sectionSubTitle}>Monthly assignment + progress tracking</Text>
          <Text style={styles.meta}>Target month: {month}</Text>

          <View style={styles.targetGrid}>
            <TargetMetric title="Leads Target" achieved={myTarget.leadsAchieved} target={myTarget.leadsTarget} percent={myTarget.leadsPercent} />
            <TargetMetric title="Site Visit Target" achieved={myTarget.siteVisitsAchieved} target={myTarget.siteVisitTarget} percent={myTarget.siteVisitPercent} />
            <TargetMetric title="Revenue Target" achieved={myTarget.revenueAchieved} target={myTarget.revenueTarget} percent={myTarget.revenuePercent} currency />
          </View>

          {targetState?.canAssign ? (
            <View style={styles.assignWrap}>
              <Text style={styles.label}>Assign Target to Direct Report</Text>
              <Text style={styles.assignToLabel}>Assign To</Text>
              <Pressable style={styles.dropdownBtn} onPress={() => setAssigneeDropdownVisible(true)}>
                <Text style={styles.dropdownText}>
                  {selectedAssignee
                    ? `${selectedAssignee.name} (${selectedAssignee.roleLabel || selectedAssignee.role})`
                    : "Select user"}
                </Text>
                <Ionicons name="chevron-down-outline" size={16} color="#64748b" />
              </Pressable>
              <AppInput value={assignForm.leadsTarget} onChangeText={(v) => setAssignForm((p) => ({ ...p, leadsTarget: v }))} placeholder="Lead target" keyboardType="phone-pad" style={styles.input as object} />
              <AppInput value={assignForm.siteVisitTarget} onChangeText={(v) => setAssignForm((p) => ({ ...p, siteVisitTarget: v }))} placeholder="Visit target" keyboardType="phone-pad" style={styles.input as object} />
              <AppInput value={assignForm.revenueTarget} onChangeText={(v) => setAssignForm((p) => ({ ...p, revenueTarget: v }))} placeholder="Revenue target" keyboardType="phone-pad" style={styles.input as object} />
              <AppInput value={assignForm.notes} onChangeText={(v) => setAssignForm((p) => ({ ...p, notes: v }))} placeholder="Notes (optional)" style={styles.input as object} />
              <AppButton title={submitting ? "Assigning..." : "Assign Target"} onPress={assignTarget} disabled={submitting} />
            </View>
          ) : null}

          <View style={styles.twoCol}>
            {showIncoming ? (
              <View style={styles.listPanel}>
                <Text style={styles.label}>My Incoming Targets</Text>
                {(targetState?.incoming || []).length === 0 ? (
                  <Text style={styles.meta}>No incoming targets for this month.</Text>
                ) : (
                  (targetState.incoming || []).map((row: any) => <TargetRow key={String(row._id)} row={row} />)
                )}
              </View>
            ) : null}
            <View style={styles.listPanel}>
              <Text style={styles.label}>Targets Assigned by Me</Text>
              {(targetState?.outgoing || []).length === 0 ? (
                <Text style={styles.meta}>No outgoing targets for this month.</Text>
              ) : (
                (targetState.outgoing || []).map((row: any) => <TargetRow key={String(row._id)} row={row} />)
              )}
            </View>
          </View>
        </AppCard>
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

      <Modal visible={assigneeDropdownVisible} transparent animationType="fade" onRequestClose={() => setAssigneeDropdownVisible(false)}>
        <View style={styles.modalWrap}>
          <View style={styles.dropdownModalCard}>
            <Text style={styles.modalTitle}>Assign To</Text>
            <ScrollView style={styles.dropdownList} showsVerticalScrollIndicator={false}>
              {assignableReports.length === 0 ? (
                <Text style={styles.meta}>No users available</Text>
              ) : (
                assignableReports.map((row: any) => {
                  const isActive = assignForm.assignedToId === String(row._id);
                  return (
                    <Pressable
                      key={String(row._id)}
                      style={[styles.dropdownItem, isActive && styles.dropdownItemActive]}
                      onPress={() => {
                        setAssignForm((prev) => ({ ...prev, assignedToId: String(row._id) }));
                        setAssigneeDropdownVisible(false);
                      }}
                    >
                      <Text style={[styles.dropdownItemText, isActive && styles.dropdownItemTextActive]}>
                        {row.name} ({row.roleLabel || row.role})
                      </Text>
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
            <Pressable style={styles.modalCancelBtn} onPress={() => setAssigneeDropdownVisible(false)}>
              <Text style={styles.modalCancelText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={leaderboardDetailsVisible} transparent animationType="fade" onRequestClose={() => setLeaderboardDetailsVisible(false)}>
        <View style={styles.modalWrap}>
          <View style={styles.dropdownModalCard}>
            <Text style={styles.modalTitle}>
              {selectedLeaderboardRow ? `${selectedLeaderboardRow.name} Performance` : "Performance Details"}
            </Text>
            {selectedLeaderboardRow ? (
              <Text style={styles.meta}>
                {selectedLeaderboardRow.role} | Score {selectedLeaderboardRow.scorePercent}% | Leads {selectedLeaderboardRow.assigned} | Visits {selectedLeaderboardRow.visits} | Closed {selectedLeaderboardRow.closed}
              </Text>
            ) : null}
            <ScrollView style={styles.dropdownList} showsVerticalScrollIndicator={false}>
              {selectedLeaderboardLeads.length === 0 ? (
                <Text style={styles.meta}>No assigned leads in selected range.</Text>
              ) : (
                selectedLeaderboardLeads.map((lead) => (
                  <View key={String(lead._id)} style={styles.targetRow}>
                    <Text style={styles.targetName}>{lead.name || "Lead"}</Text>
                    <Text style={styles.meta}>Status: {String(lead.status || "-")}</Text>
                    <Text style={styles.meta}>Phone: {String(lead.phone || "-")}</Text>
                    <Text style={styles.meta}>Project: {String(lead.projectInterested || "-")}</Text>
                    <Text style={styles.meta}>
                      Updated: {lead.updatedAt ? new Date(lead.updatedAt).toLocaleString("en-IN") : "-"}
                    </Text>
                  </View>
                ))
              )}
            </ScrollView>
            <Pressable style={styles.modalCancelBtn} onPress={() => setLeaderboardDetailsVisible(false)}>
              <Text style={styles.modalCancelText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={metricDetailsVisible} transparent animationType="fade" onRequestClose={() => setMetricDetailsVisible(false)}>
        <View style={styles.modalWrap}>
          <View style={styles.dropdownModalCard}>
            <Text style={styles.modalTitle}>{selectedMetricTitle}</Text>
            <Text style={styles.meta}>Showing {selectedMetricLeads.length} leads for {periodLabel}</Text>
            <ScrollView style={styles.dropdownList} showsVerticalScrollIndicator={false}>
              {selectedMetricLeads.length === 0 ? (
                <Text style={styles.meta}>No related data in selected range.</Text>
              ) : (
                selectedMetricLeads.map((lead) => (
                  <View key={String(lead._id)} style={styles.targetRow}>
                    <Text style={styles.targetName}>{lead.name || "Lead"}</Text>
                    <Text style={styles.meta}>Status: {String(lead.status || "-")}</Text>
                    <Text style={styles.meta}>Phone: {String(lead.phone || "-")}</Text>
                    <Text style={styles.meta}>Project: {String(lead.projectInterested || "-")}</Text>
                    <Text style={styles.meta}>
                      Assigned: {String((lead.assignedTo as any)?.name || "Unassigned")}
                    </Text>
                    {selectedMetricKey === "PENDING_COLLECTION"
                      ? getLeadPendingPaymentRows(lead).map((pending) => (
                        <Text key={`${lead._id}-${pending.label}`} style={styles.meta}>
                          Pending: {formatCurrency(pending.remainingAmount)} | Due: {pending.remainingDueDate || "-"} ({pending.label})
                        </Text>
                      ))
                      : null}
                  </View>
                ))
              )}
            </ScrollView>
            <Pressable style={styles.modalCancelBtn} onPress={() => setMetricDetailsVisible(false)}>
              <Text style={styles.modalCancelText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </Screen>
  );
};

const TargetMetric = ({
  title,
  achieved,
  target,
  percent,
  currency,
}: {
  title: string;
  achieved: number;
  target: number;
  percent: number;
  currency?: boolean;
}) => (
  <View style={styles.targetCard}>
    <Text style={styles.metricLabel}>{title}</Text>
    <Text style={styles.metricValue}>
      {currency ? formatCurrency(achieved) : formatNumber(achieved)} / {currency ? formatCurrency(target) : formatNumber(target)}
    </Text>
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${clampPercent(percent)}%` }]} />
    </View>
    <Text style={styles.metricPercent}>{clampPercent(percent)}% achieved</Text>
  </View>
);

const TargetRow = ({ row }: { row: any }) => {
  const assignee = row?.assignedTo || {};
  const p = row?.progress || {};
  return (
    <View style={styles.targetRow}>
      <Text style={styles.targetName}>{assignee?.name || "User"}</Text>
      <Text style={styles.meta}>{assignee?.roleLabel || assignee?.role || "-"} | {row?.month || "-"}</Text>
      <Text style={styles.meta}>
        Leads {Number(row?.achievements?.leadsAchieved || 0)}/{Number(row?.leadsTarget || 0)} | Site Visits {Number(row?.achievements?.siteVisitsAchieved || 0)}/{Number(row?.siteVisitTarget || 0)}
      </Text>
      <Text style={styles.meta}>
        Revenue {formatCurrency(Number(row?.achievements?.revenueAchieved || 0))}/{formatCurrency(Number(row?.revenueTarget || 0))} | {clampPercent(Number(p?.revenuePercent || 0))}%
      </Text>
    </View>
  );
};

const StatCard = ({
  label,
  value,
  helper,
  onPress,
}: {
  label: string;
  value: number | string;
  helper: string;
  onPress: () => void;
}) => (
  <Pressable style={styles.statCard} onPress={onPress}>
    <Text style={styles.metricLabel}>{label}</Text>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.meta}>{helper} • Tap to view</Text>
  </Pressable>
);

const styles = StyleSheet.create({
  error: {
    marginBottom: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 10,
    backgroundColor: "#fef2f2",
    color: "#b91c1c",
  },
  success: {
    marginBottom: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "#86efac",
    borderRadius: 10,
    backgroundColor: "#f0fdf4",
    color: "#166534",
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
  snapshotGrid: {
    gap: 8,
    marginBottom: 10,
  },
  statCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    backgroundColor: "#fff",
    padding: 10,
  },
  sectionCard: {
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontWeight: "700",
    color: "#0f172a",
  },
  sectionSubTitle: {
    marginTop: 2,
    color: "#64748b",
    fontSize: 11,
    marginBottom: 8,
  },
  graphSplit: {
    gap: 8,
  },
  velocityPanel: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    backgroundColor: "#fff",
    padding: 8,
  },
  velocityScoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  velocityTextWrap: {
    flex: 1,
  },
  velocityPercent: {
    color: "#0f172a",
    fontSize: 20,
    fontWeight: "700",
  },
  chartPanel: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    backgroundColor: "#fff",
    padding: 8,
  },
  metricLabel: {
    color: "#64748b",
    fontSize: 10,
    textTransform: "uppercase",
  },
  statValue: {
    marginTop: 5,
    color: "#0f172a",
    fontSize: 24,
    fontWeight: "700",
  },
  meta: {
    marginTop: 3,
    color: "#64748b",
    fontSize: 11,
  },
  leaderRow: {
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    backgroundColor: "#f8fbff",
  },
  leaderTopRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  leaderRank: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  leaderRankText: {
    color: "#334155",
    fontWeight: "700",
    fontSize: 11,
  },
  leaderInfo: {
    flex: 1,
  },
  leaderName: {
    color: "#0f172a",
    fontWeight: "700",
    fontSize: 12,
  },
  leaderScoreWrap: {
    marginLeft: 8,
  },
  leaderTrack: {
    marginTop: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: "#dbeafe",
    overflow: "hidden",
  },
  leaderFill: {
    height: "100%",
    backgroundColor: "#0ea5e9",
  },
  targetGrid: {
    gap: 8,
    marginBottom: 10,
  },
  targetCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    padding: 8,
    backgroundColor: "#fff",
  },
  metricValue: {
    marginTop: 4,
    color: "#0f172a",
    fontWeight: "700",
    fontSize: 13,
  },
  metricPercent: {
    marginTop: 4,
    color: "#0f766e",
    fontWeight: "700",
    fontSize: 11,
    textAlign: "right",
  },
  track: {
    marginTop: 7,
    height: 7,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "#e2e8f0",
  },
  fill: {
    height: "100%",
    backgroundColor: "#0ea5e9",
  },
  assignWrap: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    backgroundColor: "#fff",
    padding: 8,
    marginBottom: 8,
  },
  label: {
    color: "#334155",
    fontWeight: "700",
    fontSize: 12,
    marginBottom: 6,
  },
  assignToLabel: {
    color: "#475569",
    fontSize: 11,
    marginBottom: 5,
    fontWeight: "600",
  },
  dropdownBtn: {
    height: 46,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dropdownText: {
    color: "#334155",
    fontSize: 13,
    flex: 1,
    paddingRight: 8,
  },
  input: {
    marginBottom: 8,
  },
  twoCol: {
    gap: 8,
  },
  listPanel: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    backgroundColor: "#fff",
    padding: 8,
  },
  targetRow: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    backgroundColor: "#f8fafc",
    padding: 8,
    marginBottom: 8,
  },
  targetName: {
    color: "#0f172a",
    fontSize: 12,
    fontWeight: "700",
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
  dropdownModalCard: {
    width: "100%",
    maxWidth: 520,
    maxHeight: "72%",
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
  dropdownList: {
    maxHeight: 320,
    marginBottom: 10,
  },
  dropdownItem: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    backgroundColor: "#fff",
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  dropdownItemActive: {
    borderColor: "#0f172a",
    backgroundColor: "#f8fafc",
  },
  dropdownItemText: {
    color: "#334155",
    fontSize: 13,
    fontWeight: "600",
  },
  dropdownItemTextActive: {
    color: "#0f172a",
  },
});
