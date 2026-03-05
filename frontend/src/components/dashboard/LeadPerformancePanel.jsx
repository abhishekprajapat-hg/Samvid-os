import React, { useId, useMemo, useState } from "react";
import { Activity, Gauge, Sparkles, Target, TrendingUp } from "lucide-react";

const STATUS_FLOW = [
  {
    key: "NEW",
    label: "New",
    color: "from-slate-400 to-slate-500",
    textClass: "text-slate-500",
  },
  {
    key: "CONTACTED",
    label: "Contacted",
    color: "from-cyan-400 to-sky-500",
    textClass: "text-cyan-600",
  },
  {
    key: "INTERESTED",
    label: "Interested",
    color: "from-violet-400 to-fuchsia-500",
    textClass: "text-violet-600",
  },
  {
    key: "SITE_VISIT",
    label: "Visit",
    color: "from-amber-400 to-orange-500",
    textClass: "text-amber-600",
  },
  {
    key: "REQUESTED",
    label: "Requested",
    color: "from-orange-400 to-amber-500",
    textClass: "text-orange-600",
  },
  {
    key: "CLOSED",
    label: "Closed",
    color: "from-emerald-400 to-teal-500",
    textClass: "text-emerald-600",
  },
  {
    key: "LOST",
    label: "Lost",
    color: "from-rose-400 to-red-500",
    textClass: "text-rose-600",
  },
];

const PRIMARY_STAGE_KEYS = ["NEW", "CONTACTED", "INTERESTED", "SITE_VISIT", "REQUESTED", "CLOSED"];

const TIME_WINDOWS = [
  { value: 6, label: "6W" },
  { value: 8, label: "8W" },
  { value: 12, label: "12W" },
];

const ACCENT_PALETTE = {
  cyan: {
    ring: "rgb(6,182,212)",
    ringMuted: "rgba(6,182,212,0.2)",
    created: "rgb(14,165,233)",
    createdSoft: "rgba(14,165,233,0.2)",
    closed: "rgb(16,185,129)",
    closedSoft: "rgba(16,185,129,0.22)",
    open: "rgb(59,130,246)",
    openSoft: "rgba(59,130,246,0.2)",
  },
  emerald: {
    ring: "rgb(16,185,129)",
    ringMuted: "rgba(16,185,129,0.2)",
    created: "rgb(5,150,105)",
    createdSoft: "rgba(16,185,129,0.2)",
    closed: "rgb(20,184,166)",
    closedSoft: "rgba(20,184,166,0.24)",
    open: "rgb(6,182,212)",
    openSoft: "rgba(6,182,212,0.2)",
  },
  amber: {
    ring: "rgb(245,158,11)",
    ringMuted: "rgba(245,158,11,0.22)",
    created: "rgb(249,115,22)",
    createdSoft: "rgba(249,115,22,0.24)",
    closed: "rgb(16,185,129)",
    closedSoft: "rgba(16,185,129,0.2)",
    open: "rgb(234,88,12)",
    openSoft: "rgba(234,88,12,0.18)",
  },
  violet: {
    ring: "rgb(139,92,246)",
    ringMuted: "rgba(139,92,246,0.22)",
    created: "rgb(168,85,247)",
    createdSoft: "rgba(168,85,247,0.24)",
    closed: "rgb(59,130,246)",
    closedSoft: "rgba(59,130,246,0.2)",
    open: "rgb(129,140,248)",
    openSoft: "rgba(129,140,248,0.2)",
  },
};

const parseDate = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const normalizeStatus = (value) => String(value || "").trim().toUpperCase();

const startOfWeek = (value) => {
  const date = new Date(value);
  const day = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - day);
  date.setHours(0, 0, 0, 0);
  return date;
};

const addDays = (value, days) => {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
};

const clampPercent = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(100, parsed));
};

const sum = (values = []) => values.reduce((acc, value) => acc + Number(value || 0), 0);

const countLeadsByStatus = (leads = []) => {
  const base = STATUS_FLOW.reduce((acc, row) => {
    acc[row.key] = 0;
    return acc;
  }, {});

  leads.forEach((lead) => {
    const key = normalizeStatus(lead?.status);
    if (Object.prototype.hasOwnProperty.call(base, key)) {
      base[key] += 1;
    }
  });

  return base;
};

const buildWeeklyTrend = (leads = [], weekCount = 8) => {
  const safeWeekCount = Number.isFinite(weekCount) ? Math.max(4, Math.floor(weekCount)) : 8;
  const currentWeekStart = startOfWeek(new Date());
  const firstWeekStart = addDays(currentWeekStart, -7 * (safeWeekCount - 1));
  const formatter = new Intl.DateTimeFormat("en-IN", {
    month: "short",
    day: "numeric",
  });

  const buckets = Array.from({ length: safeWeekCount }, (_, index) => {
    const start = addDays(firstWeekStart, index * 7);
    const end = addDays(start, 7);
    return {
      start,
      end,
      label: formatter.format(start),
      created: 0,
      closed: 0,
      lost: 0,
      open: 0,
    };
  });

  const toBucketIndex = (date) => {
    const parsed = parseDate(date);
    if (!parsed) return -1;
    const diffMs = parsed.getTime() - firstWeekStart.getTime();
    const index = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
    if (index < 0 || index >= buckets.length) return -1;
    return index;
  };

  leads.forEach((lead) => {
    const createdIndex = toBucketIndex(lead?.createdAt);
    if (createdIndex >= 0) {
      buckets[createdIndex].created += 1;
    }

    const status = normalizeStatus(lead?.status);
    const resolutionDate = lead?.closedAt || lead?.updatedAt || lead?.lastContactedAt || lead?.createdAt;
    const resolutionIndex = toBucketIndex(resolutionDate);

    if (resolutionIndex >= 0 && status === "CLOSED") {
      buckets[resolutionIndex].closed += 1;
    }

    if (resolutionIndex >= 0 && status === "LOST") {
      buckets[resolutionIndex].lost += 1;
    }
  });

  let openCount = 0;
  buckets.forEach((bucket) => {
    openCount = Math.max(openCount + bucket.created - bucket.closed - bucket.lost, 0);
    bucket.open = openCount;
  });

  return buckets;
};

const buildLineGeometry = ({ values = [], width, height, xPadding, yPadding, maxValue }) => {
  if (!values.length) {
    return {
      linePath: "",
      areaPath: "",
      points: [],
      maxValue: 1,
      stepX: 0,
    };
  }

  const safeMax = Number(maxValue) > 0 ? Number(maxValue) : Math.max(...values, 1);
  const xSpan = width - xPadding * 2;
  const ySpan = height - yPadding * 2;
  const stepX = values.length <= 1 ? 0 : xSpan / (values.length - 1);

  const points = values.map((value, index) => {
    const x = values.length === 1 ? width / 2 : xPadding + stepX * index;
    const y = height - yPadding - (Number(value || 0) / safeMax) * ySpan;
    return { x, y };
  });

  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");

  const first = points[0];
  const last = points[points.length - 1];
  const baseY = height - yPadding;
  const areaPath = `${linePath} L ${last.x} ${baseY} L ${first.x} ${baseY} Z`;

  return {
    linePath,
    areaPath,
    points,
    maxValue: safeMax,
    stepX,
  };
};

const formatCompactNumber = (value) =>
  new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(
    Number(value || 0),
  );

const toDeltaTone = (delta) => {
  if (delta > 0) return "up";
  if (delta < 0) return "down";
  return "flat";
};

const createInsight = ({ totalLeads, conversionPercent, leakagePercent, closeVelocity, activeLeads }) => {
  if (!totalLeads) {
    return "Pipeline abhi empty hai. Fresh lead inflow push karo for better trend visibility.";
  }

  if (conversionPercent >= 35 && leakagePercent <= 20) {
    return "Closure quality strong hai. Next lift ke liye contacted-to-visit transition scale karo.";
  }

  if (leakagePercent >= 35) {
    return "Leakage elevated hai. Qualification checklist tighten karke early drop reduce karo.";
  }

  if (closeVelocity >= 30) {
    return "Recent close velocity healthy hai. Deal desk follow-ups maintain rakho.";
  }

  if (activeLeads >= totalLeads * 0.7) {
    return "Pipeline heavy hai, lekin conversion nikalne ke liye weekly visit cadence accelerate karo.";
  }

  return "Balanced pipeline hai. Highest impact move: interested leads ko fast site-visit me convert karo.";
};

const LeadPerformancePanel = ({
  leads = [],
  theme = "light",
  title = "Performance Snapshot",
  subtitle = "Live pipeline distribution",
  accent = "cyan",
  compact = false,
  defaultWindow = 8,
}) => {
  const isDark = theme === "dark";
  const panelId = useId().replace(/:/g, "");
  const palette = ACCENT_PALETTE[accent] || ACCENT_PALETTE.cyan;

  const normalizedWindow = TIME_WINDOWS.some((entry) => entry.value === defaultWindow)
    ? defaultWindow
    : 8;
  const [windowSize, setWindowSize] = useState(normalizedWindow);

  const safeLeads = Array.isArray(leads) ? leads : [];
  const totalLeads = safeLeads.length;

  const statusCounts = useMemo(() => countLeadsByStatus(safeLeads), [safeLeads]);

  const closedLeads = Number(statusCounts.CLOSED || 0);
  const lostLeads = Number(statusCounts.LOST || 0);
  const activeLeads = Math.max(totalLeads - closedLeads - lostLeads, 0);
  const visitLeads = Number(statusCounts.SITE_VISIT || 0);
  const engagedLeads =
    Number(statusCounts.CONTACTED || 0) +
    Number(statusCounts.INTERESTED || 0) +
    Number(statusCounts.SITE_VISIT || 0) +
    closedLeads;

  const conversionPercent = totalLeads ? Math.round((closedLeads / totalLeads) * 100) : 0;
  const leakagePercent = totalLeads ? Math.round((lostLeads / totalLeads) * 100) : 0;
  const engagementPercent = totalLeads ? Math.round((engagedLeads / totalLeads) * 100) : 0;

  const weeklyTrend = useMemo(() => buildWeeklyTrend(safeLeads, windowSize), [safeLeads, windowSize]);
  const createdSeries = weeklyTrend.map((bucket) => bucket.created);
  const closedSeries = weeklyTrend.map((bucket) => bucket.closed);
  const openSeries = weeklyTrend.map((bucket) => bucket.open);

  const recentSpan = Math.min(3, weeklyTrend.length);
  const recentBuckets = weeklyTrend.slice(-recentSpan);
  const previousBuckets = weeklyTrend.slice(-recentSpan * 2, -recentSpan);

  const recentCreated = sum(recentBuckets.map((bucket) => bucket.created));
  const recentClosed = sum(recentBuckets.map((bucket) => bucket.closed));
  const recentLost = sum(recentBuckets.map((bucket) => bucket.lost));
  const previousClosed = sum(previousBuckets.map((bucket) => bucket.closed));
  const closeVelocity = recentCreated ? Math.round((recentClosed / recentCreated) * 100) : 0;
  const closeDelta =
    previousClosed > 0
      ? Math.round(((recentClosed - previousClosed) / previousClosed) * 100)
      : recentClosed > 0
      ? 100
      : 0;

  const insight = useMemo(
    () =>
      createInsight({
        totalLeads,
        conversionPercent,
        leakagePercent,
        closeVelocity,
        activeLeads,
      }),
    [activeLeads, closeVelocity, conversionPercent, leakagePercent, totalLeads],
  );

  const chartWidth = compact ? 360 : 430;
  const chartHeight = compact ? 168 : 196;
  const xPadding = 16;
  const yPadding = 16;
  const maxValue = Math.max(...createdSeries, ...closedSeries, ...openSeries, 1);

  const createdPath = useMemo(
    () =>
      buildLineGeometry({
        values: createdSeries,
        width: chartWidth,
        height: chartHeight,
        xPadding,
        yPadding,
        maxValue,
      }),
    [chartHeight, chartWidth, createdSeries, maxValue],
  );

  const closedPath = useMemo(
    () =>
      buildLineGeometry({
        values: closedSeries,
        width: chartWidth,
        height: chartHeight,
        xPadding,
        yPadding,
        maxValue,
      }),
    [chartHeight, chartWidth, closedSeries, maxValue],
  );

  const openPath = useMemo(
    () =>
      buildLineGeometry({
        values: openSeries,
        width: chartWidth,
        height: chartHeight,
        xPadding,
        yPadding,
        maxValue,
      }),
    [chartHeight, chartWidth, maxValue, openSeries],
  );

  const ySpan = chartHeight - yPadding * 2;
  const barWidth =
    createdPath.points.length > 0
      ? Math.max(Math.min((chartWidth - xPadding * 2) / createdPath.points.length - 6, 28), 10)
      : 10;

  const createdBars = createdPath.points.map((point, index) => {
    const value = Number(createdSeries[index] || 0);
    const barHeight = maxValue > 0 ? (value / maxValue) * ySpan : 0;
    const y = chartHeight - yPadding - barHeight;

    return {
      key: `bar-${index}`,
      x: point.x - barWidth / 2,
      y,
      width: barWidth,
      height: Math.max(barHeight, 0),
      value,
    };
  });

  const stageRows = useMemo(() => {
    const rows = STATUS_FLOW.map((row) => {
      const value = Number(statusCounts[row.key] || 0);
      const share = totalLeads ? Math.round((value / totalLeads) * 100) : 0;
      return {
        ...row,
        value,
        share,
      };
    });

    return rows.map((row, index) => {
      const prev = rows[index - 1];
      const flowCarry =
        index > 0 && PRIMARY_STAGE_KEYS.includes(row.key) && prev && prev.value > 0
          ? Math.round((row.value / prev.value) * 100)
          : null;

      return {
        ...row,
        flowCarry,
      };
    });
  }, [statusCounts, totalLeads]);

  const topStage = useMemo(() => {
    if (!stageRows.length) return null;
    return stageRows.reduce((best, row) => {
      if (!best) return row;
      return row.value > best.value ? row : best;
    }, null);
  }, [stageRows]);

  const trendTone = toDeltaTone(closeDelta);
  const trendClass =
    trendTone === "up"
      ? isDark
        ? "text-emerald-300"
        : "text-emerald-700"
      : trendTone === "down"
      ? isDark
        ? "text-rose-300"
        : "text-rose-700"
      : isDark
      ? "text-slate-300"
      : "text-slate-600";

  return (
    <section
      className={`relative overflow-hidden rounded-2xl border p-4 sm:p-5 ${
        isDark ? "border-slate-700/80 bg-slate-900/80" : "border-slate-200 bg-white"
      }`}
      style={{
        backgroundImage: isDark
          ? `radial-gradient(circle at 8% 0%, ${palette.createdSoft} 0%, rgba(2,6,23,0) 45%), radial-gradient(circle at 100% 0%, ${palette.closedSoft} 0%, rgba(2,6,23,0) 40%)`
          : `radial-gradient(circle at 8% 0%, ${palette.createdSoft} 0%, rgba(255,255,255,0) 45%), radial-gradient(circle at 100% 0%, ${palette.closedSoft} 0%, rgba(255,255,255,0) 40%)`,
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3
            className={`text-sm font-semibold uppercase tracking-[0.14em] ${
              isDark ? "text-slate-300" : "text-slate-600"
            }`}
          >
            {title}
          </h3>
          <p className={`mt-1 text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>{subtitle}</p>
        </div>

        <div className="flex items-center gap-2">
          {!compact && (
            <div
              className={`inline-flex rounded-full border p-1 ${
                isDark ? "border-slate-700 bg-slate-950/70" : "border-slate-200 bg-slate-50"
              }`}
            >
              {TIME_WINDOWS.map((window) => {
                const active = window.value === windowSize;
                return (
                  <button
                    key={window.value}
                    type="button"
                    onClick={() => setWindowSize(window.value)}
                    className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors ${
                      active
                        ? isDark
                          ? "bg-slate-700 text-white"
                          : "bg-slate-900 text-white"
                        : isDark
                        ? "text-slate-300 hover:text-white"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    {window.label}
                  </button>
                );
              })}
            </div>
          )}

          <div
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.18em] ${
              isDark ? "border-slate-700 bg-slate-950/70 text-slate-300" : "border-slate-200 bg-slate-50 text-slate-600"
            }`}
          >
            <span className="h-2 w-2 animate-pulse rounded-full" style={{ backgroundColor: palette.closed }} />
            Live Trend
          </div>
        </div>
      </div>

      <div className={`mt-5 grid grid-cols-1 gap-4 ${compact ? "xl:grid-cols-[0.92fr_1.3fr]" : "xl:grid-cols-[1fr_1.45fr]"}`}>
        <div
          className={`rounded-xl border p-4 ${
            isDark ? "border-slate-700 bg-slate-950/55" : "border-slate-200 bg-white/75"
          }`}
        >
          <div className="flex items-start gap-4">
            <div
              className="relative grid h-24 w-24 place-items-center rounded-full"
              style={{
                background: `conic-gradient(${palette.ring} ${clampPercent(conversionPercent) * 3.6}deg, ${
                  palette.ringMuted
                } 0deg)`,
              }}
            >
              <div
                className={`grid h-16 w-16 place-items-center rounded-full border ${
                  isDark ? "border-slate-700 bg-slate-900 text-slate-100" : "border-slate-200 bg-white text-slate-900"
                }`}
              >
                <p className="font-display text-xl leading-none">{conversionPercent}%</p>
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <p className={`text-[11px] uppercase tracking-[0.18em] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                Close Velocity
              </p>
              <p className={`mt-1 text-2xl font-semibold ${isDark ? "text-slate-100" : "text-slate-900"}`}>
                {closeVelocity}%
              </p>
              <p className={`mt-1 text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                Last {recentSpan} weeks: {recentClosed} closed / {recentCreated} created
              </p>
              <p className={`mt-1 text-xs font-semibold ${trendClass}`}>
                {closeDelta > 0 ? "+" : ""}
                {closeDelta}% vs previous window
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <MetricChip isDark={isDark} label="Total" value={formatCompactNumber(totalLeads)} icon={Target} />
            <MetricChip isDark={isDark} label="Active" value={formatCompactNumber(activeLeads)} icon={Activity} />
            <MetricChip
              isDark={isDark}
              label="Engaged"
              value={`${engagementPercent}%`}
              icon={Gauge}
            />
            <MetricChip isDark={isDark} label="Leakage" value={`${leakagePercent}%`} icon={TrendingUp} />
          </div>

          {!compact && (
            <div
              className={`mt-4 rounded-lg border p-3 ${
                isDark ? "border-slate-700 bg-slate-900/70" : "border-slate-200 bg-white"
              }`}
            >
              <p className={`flex items-center gap-1.5 text-[10px] uppercase tracking-[0.15em] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                <Sparkles size={12} />
                Insight
              </p>
              <p className={`mt-1.5 text-xs leading-relaxed ${isDark ? "text-slate-300" : "text-slate-600"}`}>{insight}</p>
            </div>
          )}
        </div>

        <div
          className={`rounded-xl border p-4 ${
            isDark ? "border-slate-700 bg-slate-950/55" : "border-slate-200 bg-white/75"
          }`}
        >
          <div className="mb-3 flex flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
            <p className={`text-[10px] uppercase tracking-[0.14em] sm:text-[11px] sm:tracking-[0.16em] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              Weekly Throughput ({windowSize} Weeks)
            </p>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[9px] uppercase sm:text-[10px]">
              <LegendTag isDark={isDark} color={palette.created} label="Created" />
              <LegendTag isDark={isDark} color={palette.closed} label="Closed" />
              <LegendTag isDark={isDark} color={palette.open} label="Open" />
            </div>
          </div>

          <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="h-44 w-full rounded-lg" preserveAspectRatio="none">
            <defs>
              <linearGradient id={`created-fill-${panelId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={palette.createdSoft} />
                <stop offset="100%" stopColor="rgba(0,0,0,0)" />
              </linearGradient>
              <linearGradient id={`closed-fill-${panelId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={palette.closedSoft} />
                <stop offset="100%" stopColor="rgba(0,0,0,0)" />
              </linearGradient>
              <linearGradient id={`bar-fill-${panelId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={palette.created} stopOpacity="0.68" />
                <stop offset="100%" stopColor={palette.created} stopOpacity="0.12" />
              </linearGradient>
            </defs>

            {[0, 1, 2, 3].map((line) => {
              const y = yPadding + ((chartHeight - yPadding * 2) * line) / 3;
              return (
                <line
                  key={`guide-${line}`}
                  x1={xPadding}
                  x2={chartWidth - xPadding}
                  y1={y}
                  y2={y}
                  stroke={isDark ? "rgba(71,85,105,0.55)" : "rgba(203,213,225,0.95)"}
                  strokeDasharray="4 6"
                  strokeWidth="1"
                />
              );
            })}

            {createdBars.map((bar) => (
              <rect
                key={bar.key}
                x={bar.x}
                y={bar.y}
                width={bar.width}
                height={bar.height}
                rx="4"
                fill={`url(#bar-fill-${panelId})`}
              />
            ))}

            {openPath.areaPath && <path d={openPath.areaPath} fill={palette.openSoft} />}
            {createdPath.areaPath && <path d={createdPath.areaPath} fill={`url(#created-fill-${panelId})`} />}
            {closedPath.areaPath && <path d={closedPath.areaPath} fill={`url(#closed-fill-${panelId})`} />}

            {openPath.linePath && (
              <path d={openPath.linePath} fill="none" stroke={palette.open} strokeWidth="1.8" strokeDasharray="6 4" />
            )}
            {createdPath.linePath && (
              <path d={createdPath.linePath} fill="none" stroke={palette.created} strokeWidth="2.4" strokeLinecap="round" />
            )}
            {closedPath.linePath && (
              <path d={closedPath.linePath} fill="none" stroke={palette.closed} strokeWidth="2.6" strokeLinecap="round" />
            )}

            {closedPath.points.map((point, index) => (
              <circle
                key={`closed-point-${index}`}
                cx={point.x}
                cy={point.y}
                r="2.4"
                fill={palette.closed}
                stroke={isDark ? "rgb(15,23,42)" : "white"}
                strokeWidth="1"
              />
            ))}
          </svg>

          <div className="mt-2 grid gap-1" style={{ gridTemplateColumns: `repeat(${Math.max(weeklyTrend.length, 1)}, minmax(0, 1fr))` }}>
            {weeklyTrend.map((bucket, index) => (
              <p
                key={bucket.label}
                className={`truncate text-center text-[9px] sm:text-[10px] ${isDark ? "text-slate-400" : "text-slate-500"}`}
                title={`${bucket.label}: ${bucket.created} created, ${bucket.closed} closed`}
              >
                <span className="sm:hidden">{index % 2 === 0 ? bucket.label : ""}</span>
                <span className="hidden sm:inline">{bucket.label}</span>
              </p>
            ))}
          </div>
        </div>
      </div>

      <div className={`mt-4 grid grid-cols-1 gap-2 ${compact ? "sm:grid-cols-2" : "sm:grid-cols-2 xl:grid-cols-3"}`}>
        {stageRows.map((row) => (
          <div
            key={row.key}
            className={`rounded-xl border px-3 py-2 ${
              isDark ? "border-slate-700 bg-slate-950/40" : "border-slate-200 bg-white/90"
            }`}
          >
            <div className="mb-1 flex items-center justify-between gap-2">
              <p className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${row.textClass}`}>{row.label}</p>
              <p className={`text-xs ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                {row.value} ({row.share}%)
              </p>
            </div>

            <div className={`h-1.5 overflow-hidden rounded-full ${isDark ? "bg-slate-800" : "bg-slate-200"}`}>
              <div className={`h-full rounded-full bg-gradient-to-r ${row.color}`} style={{ width: `${clampPercent(row.share)}%` }} />
            </div>

            {row.flowCarry !== null && (
              <p className={`mt-1 text-[10px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                Stage carry: {row.flowCarry}%
              </p>
            )}
          </div>
        ))}
      </div>

      {!compact && (
        <div
          className={`mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 ${
            isDark ? "border-slate-700 bg-slate-950/55" : "border-slate-200 bg-slate-50/80"
          }`}
        >
          <p className={`text-xs ${isDark ? "text-slate-300" : "text-slate-600"}`}>
            Hot stage: <span className="font-semibold">{topStage?.label || "None"}</span> ({topStage?.value || 0} leads)
          </p>
          <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
            Recent outcome: {recentClosed} closed / {recentLost} lost in last {recentSpan} weeks
          </p>
          <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
            Visit-ready inventory touchpoints: {visitLeads}
          </p>
        </div>
      )}
    </section>
  );
};

const MetricChip = ({ label, value, isDark, icon: Icon }) => (
  <div className={`rounded-lg border px-3 py-2 ${isDark ? "border-slate-700 bg-slate-900/70" : "border-slate-200 bg-white"}`}>
    <p className={`flex items-center gap-1 text-[10px] uppercase tracking-[0.14em] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
      {Icon ? <Icon size={11} /> : null}
      {label}
    </p>
    <p className={`mt-1 text-lg font-semibold ${isDark ? "text-slate-100" : "text-slate-900"}`}>{value}</p>
  </div>
);

const LegendTag = ({ label, color, isDark }) => (
  <span className={`inline-flex items-center gap-1 ${isDark ? "text-slate-300" : "text-slate-600"}`}>
    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
    {label}
  </span>
);

export default LeadPerformancePanel;
