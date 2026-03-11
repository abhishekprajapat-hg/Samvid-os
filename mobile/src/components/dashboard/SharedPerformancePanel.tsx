import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Defs, Line, LinearGradient, Path, Rect, Stop, Text as SvgText } from "react-native-svg";
import type { Lead } from "../../types";
import type { CompanyPerformanceOverview } from "../../services/leadService";
import { useAuth } from "../../context/AuthContext";

const clampPercent = (value: number) => Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));

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

export const SharedPerformancePanel = ({
  leads,
  overview,
}: {
  leads: Lead[];
  overview?: CompanyPerformanceOverview | null;
}) => {
  const [showAllLeaderboard, setShowAllLeaderboard] = useState(false);
  const { user } = useAuth();
  const loggedInUserId = String(user?._id || user?.id || "");

  const snapshot = useMemo(() => {
    const totalLeads = leads.length;
    const closed = leads.filter((lead) => String(lead.status || "").toUpperCase() === "CLOSED").length;
    const latestLeadDate = leads
      .map((lead) => {
        const raw = lead.updatedAt || lead.createdAt || "";
        const parsed = new Date(raw);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
      })
      .filter((d): d is Date => d instanceof Date)
      .sort((a, b) => b.getTime() - a.getTime())[0];
    const weekBuckets = toWeekBuckets(latestLeadDate || new Date(), 8);

    leads.forEach((lead) => {
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
  }, [leads]);

  const leaderboard = useMemo(() => {
    const rowMap = new Map<string, { id: string; name: string; role: string; assigned: number; closed: number; visits: number; scorePercent: number }>();

    leads.forEach((lead) => {
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
  }, [leads]);

  const resolvedSnapshot = useMemo(
    () =>
      overview?.summary && Array.isArray(overview.weekly)
        ? {
          totalLeads: Number(overview.summary.totalLeads || 0),
          closed: Number(overview.summary.closed || 0),
          closeVelocity: Number(overview.summary.closeVelocity || 0),
          weekly: overview.weekly.map((row) => ({
            label: String(row.label || ""),
            created: Number(row.created || 0),
            closed: Number(row.closed || 0),
            open: Number(row.open || 0),
          })),
        }
        : snapshot,
    [overview, snapshot],
  );

  const resolvedLeaderboard = useMemo(
    () =>
      Array.isArray(overview?.leaderboard)
        ? overview.leaderboard.map((row) => ({
          id: String(row.id || ""),
          name: String(row.name || "User"),
          role: String(row.role || "-"),
          assigned: Number(row.assigned || 0),
          closed: Number(row.closed || 0),
          visits: Number(row.visits || 0),
          scorePercent: clampPercent(Number(row.scorePercent || 0)),
        }))
        : leaderboard,
    [overview, leaderboard],
  );

  const pinnedLeaderboard = useMemo(() => {
    if (!loggedInUserId) return resolvedLeaderboard;
    const idx = resolvedLeaderboard.findIndex((row) => String(row.id || "") === loggedInUserId);
    if (idx <= 0) return resolvedLeaderboard;
    const currentUserRow = resolvedLeaderboard[idx];
    return [
      currentUserRow,
      ...resolvedLeaderboard.slice(0, idx),
      ...resolvedLeaderboard.slice(idx + 1),
    ];
  }, [resolvedLeaderboard, loggedInUserId]);
  const visibleLeaderboard = useMemo(
    () => (showAllLeaderboard ? pinnedLeaderboard : pinnedLeaderboard.slice(0, 5)),
    [pinnedLeaderboard, showAllLeaderboard],
  );

  return (
    <>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Role Performance Graph</Text>
        <Text style={styles.sectionSubTitle}>Weekly throughput across all data</Text>
        <View style={styles.graphSplit}>
          <View style={styles.velocityPanel}>
              <Text style={styles.metricLabel}>Close Velocity</Text>
              <View style={styles.velocityScoreRow}>
                <CircularScore percent={resolvedSnapshot.closeVelocity} />
                <View style={styles.velocityTextWrap}>
                  <Text style={styles.velocityPercent}>{Math.round(resolvedSnapshot.closeVelocity)}%</Text>
                  <Text style={styles.metricHelper}>Closed {resolvedSnapshot.closed} / Created {resolvedSnapshot.totalLeads}</Text>
                </View>
              </View>
            </View>
            <View style={styles.chartPanel}>
              <MiniLineChart rows={resolvedSnapshot.weekly} />
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
    </>
  );
};

const styles = StyleSheet.create({
  section: {
    borderWidth: 1,
    borderColor: "#dbeafe",
    borderRadius: 14,
    backgroundColor: "#fff",
    padding: 12,
  },
  sectionTitle: {
    color: "#0f172a",
    fontWeight: "800",
    fontSize: 20,
  },
  sectionSubTitle: {
    marginTop: 2,
    color: "#64748b",
    fontSize: 12,
  },
  graphSplit: {
    marginTop: 12,
    gap: 10,
  },
  velocityPanel: {
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: 12,
    backgroundColor: "#f8fbff",
    padding: 10,
  },
  metricLabel: {
    fontSize: 10,
    textTransform: "uppercase",
    color: "#64748b",
    fontWeight: "700",
  },
  velocityScoreRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  velocityTextWrap: {
    gap: 4,
  },
  velocityPercent: {
    fontSize: 36,
    color: "#0f172a",
    fontWeight: "800",
  },
  metricHelper: {
    fontSize: 12,
    color: "#64748b",
  },
  chartPanel: {
    borderWidth: 1,
    borderColor: "#dbeafe",
    borderRadius: 12,
    backgroundColor: "#ffffff",
    padding: 6,
    minHeight: 210,
  },
  leaderRow: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: 12,
    backgroundColor: "#f8fbff",
    padding: 10,
  },
  leaderTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
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
    color: "#334155",
    fontSize: 12,
    fontWeight: "800",
  },
  leaderInfo: {
    flex: 1,
  },
  progressLabel: {
    color: "#0f172a",
    fontSize: 20,
    fontWeight: "800",
  },
  leaderScoreWrap: {
    width: 92,
    alignItems: "center",
  },
  leaderTrack: {
    marginTop: 8,
    height: 8,
    borderRadius: 99,
    backgroundColor: "#dbeafe",
    overflow: "hidden",
  },
  leaderFill: {
    height: "100%",
    borderRadius: 99,
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
});
