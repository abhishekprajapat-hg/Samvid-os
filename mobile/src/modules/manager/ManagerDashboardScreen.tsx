import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Circle, Defs, Line, LinearGradient, Path, Rect, Stop, Text as SvgText } from "react-native-svg";
import { Screen } from "../../components/common/Screen";
import { useAuth } from "../../context/AuthContext";
import { getAllLeads, getCompanyPerformanceOverview } from "../../services/leadService";
import { getInventoryAssets } from "../../services/inventoryService";
import { toErrorMessage } from "../../utils/errorMessage";
import type { Lead, InventoryAsset } from "../../types";
import type { CompanyPerformanceOverview } from "../../services/leadService";

const PIPELINE_STATUSES = new Set(["CONTACTED", "INTERESTED", "SITE_VISIT"]);
const ACTIVE_STATUSES = new Set(["NEW", "CONTACTED", "INTERESTED", "SITE_VISIT"]);
const REFRESH_INTERVAL_MS = 30000;

const formatCurrency = (value: number) => `Rs ${Math.round(value).toLocaleString("en-IN")}`;

const toPercent = (value: number) => `${Math.round(value)}%`;
const clampPercent = (value: number) => Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
const pad2 = (value: number) => String(value).padStart(2, "0");
const toDateInputValue = (value: Date) => `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`;
const toMonthParam = (value: Date) => `${value.getFullYear()}-${pad2(value.getMonth() + 1)}`;
const getLeadDate = (lead: Lead) => {
  const raw = lead.updatedAt || lead.createdAt || "";
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
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
  const preparedRows = useMemo(() => {
    if (!Array.isArray(rows) || rows.length === 0) return [{ label: "-", created: 0, closed: 0, open: 0 }];
    const firstActiveIdx = rows.findIndex((row) => Math.max(row.created, row.closed, row.open) > 0);
    if (firstActiveIdx <= 0) return rows;
    const start = Math.max(0, firstActiveIdx - 1);
    const trimmed = rows.slice(start);
    if (trimmed.length >= 4) return trimmed;
    const needed = 4 - trimmed.length;
    const prefix = rows.slice(Math.max(0, start - needed), start);
    return [...prefix, ...trimmed];
  }, [rows]);
  const rawMax = Math.max(1, ...preparedRows.map((row) => Math.max(row.created, row.closed, row.open)));
  const maxY = rawMax <= 5 ? rawMax + 1 : Math.ceil(rawMax * 1.15);
  const yRange = Math.max(1, maxY);
  const step = (w - p * 2) / Math.max(preparedRows.length - 1, 1);
  const toPoints = (selector: (row: (typeof rows)[number]) => number) =>
    preparedRows.map((row, idx) => ({
      x: p + idx * step,
      y: h - p - (selector(row) / yRange) * (h - p * 2),
    }));
  const toSmoothPath = (points: Array<{ x: number; y: number }>) => {
    if (points.length <= 1) {
      const first = points[0] || { x: p, y: h - p };
      return `M ${first.x} ${first.y}`;
    }
    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i += 1) {
      const p0 = points[i - 1] || points[i];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2] || p2;
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }
    return path;
  };
  const createdPoints = toPoints((r) => r.created);
  const closedPoints = toPoints((r) => r.closed);
  const openPoints = toPoints((r) => r.open);
  const createdPath = toSmoothPath(createdPoints);
  const closedPath = toSmoothPath(closedPoints);
  const openPath = toSmoothPath(openPoints);
  const latestActiveIdx = preparedRows.reduce((acc, row, idx) => (Math.max(row.created, row.closed, row.open) > 0 ? idx : acc), -1);
  const latestBandX = latestActiveIdx >= 0 ? p + latestActiveIdx * step - step / 2 : -1;
  const latestBandW = Math.max(16, step);
  const barWidth = Math.min(18, Math.max(8, step * 0.34));

  return (
    <Svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`}>
      <Defs>
        <LinearGradient id="createdBarGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#38bdf8" stopOpacity="0.55" />
          <Stop offset="1" stopColor="#38bdf8" stopOpacity="0.12" />
        </LinearGradient>
        <LinearGradient id="closedAreaGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#10b981" stopOpacity="0.35" />
          <Stop offset="1" stopColor="#10b981" stopOpacity="0.05" />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={w} height={h} fill="#fff" rx={10} />
      {[0, 1, 2, 3, 4].map((idx) => {
        const y = p + (idx / 4) * (h - p * 2);
        return <Line key={idx} x1={p} y1={y} x2={w - p} y2={y} stroke="#e2e8f0" strokeDasharray="4 4" />;
      })}
      {latestActiveIdx >= 0 ? (
        <Rect x={latestBandX} y={p} width={latestBandW} height={h - p * 2} fill="#22d3ee" opacity={0.09} rx={8} />
      ) : null}
      {preparedRows.map((row, idx) => {
        const x = p + idx * step;
        const barBaseY = h - p;
        const barHeight = (row.created / yRange) * (h - p * 2);
        return <Rect key={`${row.label}-bar`} x={x - barWidth / 2} y={barBaseY - barHeight} width={barWidth} height={barHeight} fill="url(#createdBarGrad)" rx={5} />;
      })}
      {closedPoints.length > 1 ? (
        <Path
          d={`${closedPath} L ${closedPoints[closedPoints.length - 1].x} ${h - p} L ${closedPoints[0].x} ${h - p} Z`}
          fill="url(#closedAreaGrad)"
        />
      ) : null}
      <Path d={createdPath} fill="none" stroke="#0284c7" strokeWidth={2.6} />
      <Path d={closedPath} fill="none" stroke="#10b981" strokeWidth={3} />
      <Path d={openPath} fill="none" stroke="#1d4ed8" strokeWidth={2.2} strokeDasharray="4 3" />
      {createdPoints.map((point, idx) => (
        <Circle key={`c-${idx}`} cx={point.x} cy={point.y} r={2.2} fill="#0284c7" />
      ))}
      {closedPoints.map((point, idx) => (
        <Circle key={`cl-${idx}`} cx={point.x} cy={point.y} r={2.4} fill="#10b981" />
      ))}
      {openPoints.map((point, idx) => (
        <Circle key={`o-${idx}`} cx={point.x} cy={point.y} r={2} fill="#1d4ed8" />
      ))}
      <SvgText x={w - p} y={12} fontSize="8" textAnchor="end" fill="#0284c7">Created</SvgText>
      <SvgText x={w - p - 48} y={12} fontSize="8" textAnchor="end" fill="#10b981">Closed</SvgText>
      <SvgText x={w - p - 88} y={12} fontSize="8" textAnchor="end" fill="#1d4ed8">Open</SvgText>
      {preparedRows.map((row, idx) => {
        const x = p + idx * step;
        const showLabel = preparedRows.length <= 6 || idx === 0 || idx === preparedRows.length - 1 || idx % 2 === 0;
        if (!showLabel) return null;
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

export const ManagerDashboardScreen = () => {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const loggedInUserId = String(user?._id || user?.id || "");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [assets, setAssets] = useState<InventoryAsset[]>([]);
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
  const [companyPerformance, setCompanyPerformance] = useState<CompanyPerformanceOverview | null>(null);
  const [showAllLeaderboard, setShowAllLeaderboard] = useState(false);

  const performanceParams = useMemo(() => {
    if (range === "THIS_MONTH") {
      return {
        range: "THIS_MONTH" as const,
        month: toMonthParam(selectedMonthDate),
      };
    }
    if (range === "CUSTOM") {
      if (!customFromDate || !customToDate) return null;
      return {
        range: "CUSTOM" as const,
        from: toDateInputValue(customFromDate),
        to: toDateInputValue(customToDate),
      };
    }
    return {
      range: "ALL" as const,
    };
  }, [range, selectedMonthDate, customFromDate, customToDate]);

  const load = useCallback(async (silent = false) => {
    try {
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError("");

      const [leadRows, inventoryRows, performanceOverview] = await Promise.all([
        getAllLeads(),
        getInventoryAssets(),
        performanceParams
          ? getCompanyPerformanceOverview(performanceParams).catch(() => null)
          : Promise.resolve(null),
      ]);
      setLeads(Array.isArray(leadRows) ? leadRows : []);
      setAssets(Array.isArray(inventoryRows) ? inventoryRows : []);
      setCompanyPerformance(performanceOverview);
    } catch (e) {
      setError(toErrorMessage(e, "Failed to load manager dashboard"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [performanceParams]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const timer = setInterval(() => load(true), REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [load]);

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

  const performanceSnapshot = useMemo(() => {
    const totalLeads = scopedLeads.length;
    const closed = scopedLeads.filter((lead) => String(lead.status || "").toUpperCase() === "CLOSED").length;
    const latestLeadDate = scopedLeads
      .map((lead) => getLeadDate(lead))
      .filter((d): d is Date => d instanceof Date)
      .sort((a, b) => b.getTime() - a.getTime())[0];
    const weekBuckets = toWeekBuckets(latestLeadDate || new Date(), 8);

    scopedLeads.forEach((lead) => {
      const createdIdx = findBucketIndex(lead.createdAt, weekBuckets);
      if (createdIdx >= 0) weekBuckets[createdIdx].created += 1;
      if (String(lead.status || "").toUpperCase() === "CLOSED") {
        const closedIdx = findBucketIndex(lead.updatedAt || lead.createdAt, weekBuckets);
        if (closedIdx >= 0) weekBuckets[closedIdx].closed += 1;
      }
    });
    weekBuckets.forEach((bucket) => {
      bucket.open = Math.max(0, bucket.created - bucket.closed);
    });

    return {
      totalLeads,
      closed,
      closeVelocity: totalLeads > 0 ? (closed / totalLeads) * 100 : 0,
      weekly: weekBuckets.map((row) => ({ label: row.label, created: row.created, closed: row.closed, open: row.open })),
    };
  }, [scopedLeads]);

  const leaderboard = useMemo(() => {
    const rowMap = new Map<string, { id: string; name: string; role: string; assigned: number; closed: number; visits: number; scorePercent: number }>();

    scopedLeads.forEach((lead) => {
      const assigned = lead.assignedTo;
      if (!assigned || typeof assigned !== "object") return;
      const id = String((assigned as any)._id || (assigned as any).id || "");
      if (!id) return;
      const role = String((assigned as any).role || "-").toUpperCase();
      if (role === "ADMIN") return;
      const row = rowMap.get(id) || {
        id,
        name: String((assigned as any).name || "User"),
        role,
        assigned: 0,
        closed: 0,
        visits: 0,
        scorePercent: 0,
      };
      row.assigned += 1;
      const status = String(lead.status || "").toUpperCase();
      if (status === "CLOSED") row.closed += 1;
      if (status === "SITE_VISIT") row.visits += 1;
      rowMap.set(id, row);
    });

    return Array.from(rowMap.values())
      .map((row) => {
        const closeRate = row.assigned > 0 ? (row.closed / row.assigned) * 100 : 0;
        const visitRate = row.assigned > 0 ? (row.visits / row.assigned) * 100 : 0;
        return {
          ...row,
          scorePercent: clampPercent(Math.round(closeRate * 0.8 + visitRate * 0.2)),
        };
      })
      .sort((a, b) => b.scorePercent - a.scorePercent || b.closed - a.closed || b.assigned - a.assigned);
  }, [scopedLeads]);

  const resolvedPerformanceSnapshot = useMemo(
    () =>
      companyPerformance?.summary && Array.isArray(companyPerformance.weekly)
        ? {
          totalLeads: Number(companyPerformance.summary.totalLeads || 0),
          closed: Number(companyPerformance.summary.closed || 0),
          closeVelocity: Number(companyPerformance.summary.closeVelocity || 0),
          weekly: companyPerformance.weekly.map((row) => ({
            label: String(row.label || ""),
            created: Number(row.created || 0),
            closed: Number(row.closed || 0),
            open: Number(row.open || 0),
          })),
        }
        : performanceSnapshot,
    [companyPerformance, performanceSnapshot],
  );

  const resolvedLeaderboard = useMemo(
    () =>
      Array.isArray(companyPerformance?.leaderboard)
        ? companyPerformance.leaderboard.map((row) => ({
          id: String(row.id || ""),
          name: String(row.name || "User"),
          role: String(row.role || "-"),
          assigned: Number(row.assigned || 0),
          closed: Number(row.closed || 0),
          visits: Number(row.visits || 0),
          scorePercent: clampPercent(Number(row.scorePercent || 0)),
        }))
        : leaderboard,
    [companyPerformance, leaderboard],
  );

  const pinnedLeaderboard = useMemo(() => resolvedLeaderboard, [resolvedLeaderboard]);
  const visibleLeaderboard = useMemo(
    () => (showAllLeaderboard ? pinnedLeaderboard : pinnedLeaderboard.slice(0, 5)),
    [pinnedLeaderboard, showAllLeaderboard],
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
    <Screen title="Manager Dashboard" subtitle="Command Deck" loading={loading} error={error}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
      >
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

        <View style={styles.section}>
          <View style={styles.filterRow}>
            <Pressable style={[styles.filterChip, range === "ALL" && styles.filterChipActive]} onPress={() => setRange("ALL")}>
              <Text style={[styles.filterChipText, range === "ALL" && styles.filterChipTextActive]}>All</Text>
            </Pressable>
            <Pressable style={[styles.filterChip, range === "THIS_MONTH" && styles.filterChipActive]} onPress={() => setRange("THIS_MONTH")}>
              <Text style={[styles.filterChipText, range === "THIS_MONTH" && styles.filterChipTextActive]}>This Month</Text>
            </Pressable>
            <Pressable
              style={[styles.filterChip, range === "CUSTOM" && styles.filterChipActive]}
              onPress={() => {
                setRange("CUSTOM");
                openCustomRangePicker();
              }}
            >
              <Text style={[styles.filterChipText, range === "CUSTOM" && styles.filterChipTextActive]}>Custom</Text>
            </Pressable>
            <Pressable style={styles.calendarIconBtn} onPress={openMonthPicker}>
              <Ionicons name="calendar-outline" size={14} color="#334155" />
            </Pressable>
            <Pressable style={styles.refreshBtn} onPress={() => load(true)} disabled={refreshing}>
              <Ionicons name={refreshing ? "sync" : "refresh"} size={14} color="#334155" />
            </Pressable>
          </View>
          <Text style={styles.metricHelper}>Showing: {periodLabel}</Text>
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
                if (!customToDate || customToDate < next) setCustomToDate(next);
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

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Role Performance Graph</Text>
          <Text style={styles.sectionSubTitle}>
            {range === "ALL" ? "Weekly throughput across all data" : `Weekly throughput for ${String(companyPerformance?.periodLabel || periodLabel)}`}
          </Text>
          <View style={styles.graphSplit}>
            <View style={styles.velocityPanel}>
              <Text style={styles.metricLabel}>Close Velocity</Text>
              <View style={styles.velocityScoreRow}>
                <CircularScore percent={resolvedPerformanceSnapshot.closeVelocity} />
                <View style={styles.velocityTextWrap}>
                  <Text style={styles.velocityPercent}>{Math.round(resolvedPerformanceSnapshot.closeVelocity)}%</Text>
                  <Text style={styles.metricHelper}>Closed {resolvedPerformanceSnapshot.closed} / Created {resolvedPerformanceSnapshot.totalLeads}</Text>
                </View>
              </View>
            </View>
            <View style={styles.chartPanel}>
              <MiniLineChart rows={resolvedPerformanceSnapshot.weekly} />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Live Leaderboard</Text>
          <Text style={styles.sectionSubTitle}>Who is doing how much work (% score)</Text>
          {visibleLeaderboard.length === 0 ? (
            <Text style={styles.metricHelper}>No leaderboard data available.</Text>
          ) : (
            visibleLeaderboard.map((row, index) => (
              <View key={`${row.id}-${index}`} style={styles.leaderRow}>
                <View style={styles.leaderTopRow}>
                  <View style={styles.leaderRank}>
                    <Text style={styles.leaderRankText}>#{index + 1}</Text>
                  </View>
                  <View style={styles.leaderInfo}>
                    <Text style={styles.progressLabel}>{row.name}</Text>
                    <Text style={styles.metricHelper}>{row.role}</Text>
                  </View>
                  <View style={styles.leaderScoreWrap}>
                    <CircularScore percent={row.scorePercent} />
                  </View>
                </View>
                <Text style={styles.metricHelper}>Leads {row.assigned} | Visits {row.visits} | Closed {row.closed}</Text>
                <View style={styles.leaderTrack}>
                  <View style={[styles.leaderFill, { width: `${clampPercent(row.scorePercent)}%` }]} />
                </View>
              </View>
            ))
          )}
          {pinnedLeaderboard.length > 5 ? (
            <View style={styles.inlineActionRow}>
              <View />
              <Pressable onPress={() => setShowAllLeaderboard((prev) => !prev)}>
                <Text style={styles.linkTextCompact}>{showAllLeaderboard ? "Show less" : "Show more"}</Text>
              </Pressable>
            </View>
          ) : null}
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

      <Modal visible={webMonthPickerVisible} transparent animationType="fade" onRequestClose={() => setWebMonthPickerVisible(false)}>
        <View style={styles.modalWrap}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select Month/Date</Text>
            <View style={styles.webInputWrap}>
              <input
                value={webMonthDateValue}
                onChange={(event) => setWebMonthDateValue((event.target as any).value)}
                type="date"
                style={styles.webDateInput as any}
              />
            </View>
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
            <View style={styles.webInputWrap}>
              <input
                value={webCustomFromValue}
                onChange={(event) => setWebCustomFromValue((event.target as any).value)}
                type="date"
                style={styles.webDateInput as any}
              />
            </View>
            <View style={styles.webInputWrap}>
              <input
                value={webCustomToValue}
                onChange={(event) => setWebCustomToValue((event.target as any).value)}
                type="date"
                style={styles.webDateInput as any}
              />
            </View>
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
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
    flexWrap: "wrap",
  },
  filterChip: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "#fff",
  },
  filterChipActive: {
    borderColor: "#0f172a",
    backgroundColor: "#0f172a",
  },
  filterChipText: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "700",
  },
  filterChipTextActive: {
    color: "#fff",
  },
  calendarIconBtn: {
    width: 34,
    height: 34,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  refreshBtn: {
    width: 34,
    height: 34,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
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
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  customDateText: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "600",
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
  sectionSubTitle: {
    marginTop: 2,
    marginBottom: 8,
    color: "#64748b",
    fontSize: 12,
  },
  graphSplit: {
    gap: 10,
  },
  velocityPanel: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    backgroundColor: "#f8fafc",
    padding: 10,
  },
  velocityScoreRow: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  velocityTextWrap: {
    flex: 1,
  },
  velocityPercent: {
    fontSize: 30,
    fontWeight: "800",
    color: "#0f172a",
  },
  chartPanel: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    backgroundColor: "#fff",
    padding: 6,
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
  leaderRow: {
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: 12,
    backgroundColor: "#f8fbff",
    padding: 10,
    marginBottom: 8,
  },
  leaderTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  leaderRank: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },
  leaderRankText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#334155",
  },
  leaderInfo: {
    flex: 1,
  },
  leaderScoreWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  leaderTrack: {
    marginTop: 8,
    height: 8,
    borderRadius: 6,
    backgroundColor: "#dbeafe",
    overflow: "hidden",
  },
  leaderFill: {
    height: "100%",
    backgroundColor: "#0ea5e9",
  },
  inlineActionRow: {
    marginTop: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  linkTextCompact: {
    color: "#2563eb",
    fontSize: 12,
    fontWeight: "600",
  },
  cardClickable: {
    opacity: 0.96,
  },
  modalWrap: {
    flex: 1,
    justifyContent: "center",
    padding: 16,
    backgroundColor: "rgba(15,23,42,0.45)",
  },
  modalCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    backgroundColor: "#fff",
    padding: 14,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 10,
  },
  webInputWrap: {
    marginBottom: 8,
  },
  webDateInput: {
    width: "100%",
    minHeight: 40,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#fff",
    color: "#0f172a",
    fontSize: 13,
  },
  modalActions: {
    marginTop: 10,
    flexDirection: "row",
    gap: 10,
  },
  modalCancelBtn: {
    flex: 1,
    minHeight: 38,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  modalCancelText: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "700",
  },
  modalApplyBtn: {
    flex: 1,
    minHeight: 38,
    borderWidth: 1,
    borderColor: "#0f172a",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0f172a",
  },
  modalApplyText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
});
