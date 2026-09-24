import React, { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import ToastNotice from "../../components/ui/ToastNotice";
import { getMyTargets } from "../../services/targetService";
import { toErrorMessage } from "../../utils/errorMessage";

const MANAGEMENT_ROLES = new Set(["ADMIN", "MANAGER"]);

const toMonthKey = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const addMonths = (date, amount) =>
  new Date(date.getFullYear(), date.getMonth() + amount, 1);

const formatMonthLabel = (monthKey) => {
  const [year, month] = String(monthKey || "").split("-").map(Number);
  const date = new Date(year || new Date().getFullYear(), (month || 1) - 1, 1);
  return date.toLocaleString("en-IN", { month: "long" });
};

const formatShortMonth = (monthKey) => {
  const [year, month] = String(monthKey || "").split("-").map(Number);
  const date = new Date(year || new Date().getFullYear(), (month || 1) - 1, 1);
  return date.toLocaleString("en-IN", { month: "short" });
};

const clampPercent = (value) => {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(100, Math.round(numeric)));
};

const formatCurrencyCompact = (value) => {
  const amount = Number(value) || 0;
  if (Math.abs(amount) >= 100000) {
    const lakhs = amount / 100000;
    return `₹${lakhs.toFixed(lakhs >= 10 ? 1 : 2).replace(/\.0+$/, "")} L`;
  }
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
};

const safeTarget = (row) => ({
  month: row?.month || "",
  assignedTo: row?.assignedTo || null,
  leadsTarget: Number(row?.leadsTarget || 0),
  revenueTarget: Number(row?.revenueTarget || 0),
  siteVisitTarget: Number(row?.siteVisitTarget || 0),
  achievements: {
    leadsAchieved: Number(row?.achievements?.leadsAchieved || 0),
    revenueAchieved: Number(row?.achievements?.revenueAchieved || 0),
    siteVisitsAchieved: Number(row?.achievements?.siteVisitsAchieved || 0),
    closedDealsAchieved: Number(row?.achievements?.closedDealsAchieved || 0),
  },
  progress: {
    leadsPercent: clampPercent(row?.progress?.leadsPercent),
    revenuePercent: clampPercent(row?.progress?.revenuePercent),
    siteVisitPercent: clampPercent(row?.progress?.siteVisitPercent),
  },
});

const combineTargets = (targets = [], month = "") => {
  const summary = targets.reduce(
    (acc, row) => {
      const target = safeTarget(row);
      acc.leadsTarget += target.leadsTarget;
      acc.revenueTarget += target.revenueTarget;
      acc.siteVisitTarget += target.siteVisitTarget;
      acc.achievements.leadsAchieved += target.achievements.leadsAchieved;
      acc.achievements.revenueAchieved += target.achievements.revenueAchieved;
      acc.achievements.siteVisitsAchieved += target.achievements.siteVisitsAchieved;
      acc.achievements.closedDealsAchieved += target.achievements.closedDealsAchieved;
      return acc;
    },
    {
      month,
      leadsTarget: 0,
      revenueTarget: 0,
      siteVisitTarget: 0,
      achievements: {
        leadsAchieved: 0,
        revenueAchieved: 0,
        siteVisitsAchieved: 0,
        closedDealsAchieved: 0,
      },
    },
  );

  return {
    ...summary,
    progress: {
      leadsPercent: clampPercent((summary.achievements.closedDealsAchieved / Math.max(summary.leadsTarget, 1)) * 100),
      revenuePercent: clampPercent((summary.achievements.revenueAchieved / Math.max(summary.revenueTarget, 1)) * 100),
      siteVisitPercent: clampPercent((summary.achievements.siteVisitsAchieved / Math.max(summary.siteVisitTarget, 1)) * 100),
    },
  };
};

const Performance = () => {
  const [viewerRole] = useState(() =>
    String(window.localStorage.getItem("role") || "").trim().toUpperCase(),
  );
  const [viewMode, setViewMode] = useState("ME");
  const [month, setMonth] = useState(toMonthKey());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [targetState, setTargetState] = useState({
    canAssign: false,
    myTarget: null,
    incoming: [],
    outgoing: [],
  });
  const [history, setHistory] = useState([]);

  useEffect(() => {
    let alive = true;

    const loadTargets = async () => {
      setLoading(true);
      setError("");
      try {
        const currentDate = new Date(`${month}-01T00:00:00`);
        const historyMonths = Array.from({ length: 6 }, (_, index) => toMonthKey(addMonths(currentDate, index - 5)));
        const [current, ...historyRows] = await Promise.all([
          getMyTargets({ month }),
          ...historyMonths.map((monthKey) =>
            getMyTargets({ month: monthKey }).catch(() => ({
              month: monthKey,
              myTarget: null,
              outgoing: [],
            })),
          ),
        ]);
        if (!alive) return;
        setTargetState({
          canAssign: Boolean(current.canAssign),
          myTarget: current.myTarget || null,
          incoming: current.incoming || [],
          outgoing: current.outgoing || [],
        });
        setHistory(historyRows.map((row, index) => ({
          month: historyMonths[index],
          myTarget: row.myTarget || null,
          outgoing: row.outgoing || [],
        })));
      } catch (fetchError) {
        if (alive) setError(toErrorMessage(fetchError, "Failed to load targets"));
      } finally {
        if (alive) setLoading(false);
      }
    };

    loadTargets();
    return () => {
      alive = false;
    };
  }, [month]);

  const canSeeTeam = MANAGEMENT_ROLES.has(viewerRole) && targetState.outgoing.length > 0;
  const currentTarget = useMemo(() => {
    if (viewMode === "TEAM" && canSeeTeam) {
      return combineTargets(targetState.outgoing, month);
    }
    return safeTarget(targetState.myTarget);
  }, [canSeeTeam, month, targetState.myTarget, targetState.outgoing, viewMode]);

  const daysLeft = useMemo(() => {
    const now = new Date();
    const selected = new Date(`${month}-01T00:00:00`);
    if (selected.getMonth() !== now.getMonth() || selected.getFullYear() !== now.getFullYear()) return 0;
    return Math.max(0, new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate());
  }, [month]);

  const closurePercent = clampPercent(
    (currentTarget.achievements.closedDealsAchieved / Math.max(currentTarget.leadsTarget, 1)) * 100,
  );
  const paceBehind = currentTarget.leadsTarget > 0 && closurePercent < 70;
  const remainingClosures = Math.max(0, currentTarget.leadsTarget - currentTarget.achievements.closedDealsAchieved);
  const neededPerDay = daysLeft > 0 ? remainingClosures / daysLeft : 0;

  const progressRows = [
    {
      label: "Closures",
      achieved: currentTarget.achievements.closedDealsAchieved,
      target: currentTarget.leadsTarget,
      percent: closurePercent,
      color: "var(--b500)",
      valueLabel: `${currentTarget.achievements.closedDealsAchieved} of ${currentTarget.leadsTarget}`,
    },
    {
      label: "Site visits",
      achieved: currentTarget.achievements.siteVisitsAchieved,
      target: currentTarget.siteVisitTarget,
      percent: currentTarget.progress.siteVisitPercent,
      color: "var(--ok500)",
      valueLabel: `${currentTarget.achievements.siteVisitsAchieved} of ${currentTarget.siteVisitTarget}`,
    },
    {
      label: "Revenue",
      achieved: currentTarget.achievements.revenueAchieved,
      target: currentTarget.revenueTarget,
      percent: currentTarget.progress.revenuePercent,
      color: "var(--wa500)",
      valueLabel: `${formatCurrencyCompact(currentTarget.achievements.revenueAchieved)} of ${formatCurrencyCompact(currentTarget.revenueTarget)}`,
    },
    {
      label: "New leads contacted",
      achieved: currentTarget.achievements.leadsAchieved,
      target: currentTarget.leadsTarget,
      percent: currentTarget.progress.leadsPercent,
      color: "var(--ok500)",
      valueLabel: `${currentTarget.achievements.leadsAchieved} of ${currentTarget.leadsTarget}`,
    },
  ];

  const historyBars = history.map((row) => {
    const target = viewMode === "TEAM" && canSeeTeam
      ? combineTargets(row.outgoing, row.month)
      : safeTarget(row.myTarget);
    const percent = clampPercent(
      (target.achievements.closedDealsAchieved / Math.max(target.leadsTarget, 1)) * 100,
    );
    return {
      month: row.month,
      label: formatShortMonth(row.month),
      percent,
      color: percent >= 85 ? "var(--ok500)" : percent >= 55 ? "var(--wa500)" : "var(--dg500)",
    };
  });

  if (loading) {
    return (
      <div className="targets-doc-screen ui-page-shell custom-scrollbar targets-loading">
        <Loader2 size={18} className="animate-spin" />
        Loading targets...
      </div>
    );
  }

  return (
    <div className="targets-doc-screen ui-page-shell custom-scrollbar">
      <ToastNotice message={error} type="error" />

      <div className="targets-toolbar">
        <input
          type="month"
          value={month}
          onChange={(event) => setMonth(event.target.value || toMonthKey())}
          className="targets-month"
          aria-label="Target month"
        />
      </div>

      <div className="targets-statgrid">
        <div className="targets-stat">
          <div className="targets-k">Closures</div>
          <div className="targets-v">
            {currentTarget.achievements.closedDealsAchieved}
            <span>/ {currentTarget.leadsTarget}</span>
          </div>
          <div className="targets-d">{closurePercent}% - {daysLeft} days left</div>
        </div>
        <div className="targets-stat">
          <div className="targets-k">Site visits</div>
          <div className="targets-v">
            {currentTarget.achievements.siteVisitsAchieved}
            <span>/ {currentTarget.siteVisitTarget}</span>
          </div>
          <div className="targets-d">{currentTarget.progress.siteVisitPercent}%</div>
        </div>
        <div className="targets-stat">
          <div className="targets-k">Revenue</div>
          <div className="targets-v targets-v-money">
            {formatCurrencyCompact(currentTarget.achievements.revenueAchieved)}
            <span>/ {formatCurrencyCompact(currentTarget.revenueTarget)}</span>
          </div>
          <div className="targets-d">{currentTarget.progress.revenuePercent}%</div>
        </div>
        <div className={`targets-stat ${paceBehind ? "is-alert" : ""}`}>
          <div className="targets-k">Pace</div>
          <div className="targets-v targets-v-pace">{paceBehind ? "Behind" : "On track"}</div>
          <div className="targets-d">Need {neededPerDay.toFixed(2)} closures/day</div>
        </div>
      </div>

      <div className="targets-split">
        <div className="targets-card">
          <div className="targets-card-h">
            <h4>{formatMonthLabel(month)} targets</h4>
            <div className="targets-seg">
              <button type="button" className={viewMode === "ME" ? "on" : ""} onClick={() => setViewMode("ME")}>Me</button>
              {MANAGEMENT_ROLES.has(viewerRole) ? (
                <button type="button" className={viewMode === "TEAM" ? "on" : ""} onClick={() => setViewMode("TEAM")}>Team</button>
              ) : null}
            </div>
          </div>
          <div className="targets-card-b targets-progress-stack">
            {progressRows.map((row) => (
              <div key={row.label}>
                <div className="targets-progress-line">
                  <b>{row.label}</b>
                  <span>{row.valueLabel}</span>
                </div>
                <div className="targets-bar-mini">
                  <i style={{ width: `${row.percent}%`, background: row.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="targets-card">
          <div className="targets-card-h"><h4>Last 6 months</h4></div>
          <div className="targets-card-b">
            <div className="targets-bars">
              {historyBars.map((bar) => (
                <div key={bar.month} title={`${bar.percent}%`}>
                  <i style={{ height: `${Math.max(8, bar.percent)}%`, background: bar.color }} />
                  <span>{bar.label}</span>
                </div>
              ))}
            </div>
            <p className="targets-hint">Percent of monthly closure target achieved.</p>
          </div>
        </div>
      </div>

      {!targetState.myTarget && viewMode === "ME" ? (
        <div className="targets-empty">No target is assigned to you for {month} yet.</div>
      ) : null}
    </div>
  );
};

export default Performance;
