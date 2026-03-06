import React, { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Crown,
  Loader2,
  Medal,
  RefreshCw,
  Trophy,
  Users,
} from "lucide-react";
import { getRoleLeaderboard } from "../../services/userService";
import { toErrorMessage } from "../../utils/errorMessage";

const WINDOW_OPTIONS = [
  { label: "Last 7 Days", value: 7 },
  { label: "Last 30 Days", value: 30 },
  { label: "Last 90 Days", value: 90 },
];
const formatPercent = (value) => {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return "0%";
  const rounded = Math.round(numeric * 10) / 10;
  return `${rounded}%`;
};

const rankBadgeClass = (rank) => {
  if (rank === 1) return "bg-amber-100 text-amber-700 border-amber-200";
  if (rank === 2) return "bg-slate-100 text-slate-700 border-slate-200";
  if (rank === 3) return "bg-orange-100 text-orange-700 border-orange-200";
  return "bg-slate-50 text-slate-600 border-slate-200";
};

const RankIcon = ({ rank }) => {
  if (rank === 1) return <Crown size={14} />;
  if (rank <= 3) return <Medal size={14} />;
  return <Trophy size={14} />;
};

const RoleLeaderboard = () => {
  const [viewerRole] = useState(() =>
    String(localStorage.getItem("role") || "").trim().toUpperCase(),
  );
  const [selectedRole, setSelectedRole] = useState(viewerRole || "");
  const [windowDays, setWindowDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState({
    role: "",
    roleLabel: "",
    count: 0,
    leaderboard: [],
    allowedRoleFilters: [],
  });

  const loadLeaderboard = async (days, roleFilter, { quiet = false } = {}) => {
    if (quiet) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError("");

    try {
      const payload = await getRoleLeaderboard({
        windowDays: days,
        ...(roleFilter ? { role: roleFilter } : {}),
      });
      setData({
        role: payload.role,
        roleLabel: payload.roleLabel,
        count: payload.count,
        leaderboard: payload.leaderboard,
        allowedRoleFilters: payload.allowedRoleFilters || [],
      });

      const normalizedRequested = String(roleFilter || "").trim().toUpperCase();
      const normalizedResolved = String(payload.role || "").trim().toUpperCase();
      if (normalizedResolved && normalizedRequested !== normalizedResolved) {
        setSelectedRole(normalizedResolved);
      }
    } catch (fetchError) {
      setError(toErrorMessage(fetchError, "Leaderboard load failed"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadLeaderboard(windowDays, selectedRole);
  }, [windowDays, selectedRole]);

  const rows = data.leaderboard || [];
  const myRow = useMemo(
    () => rows.find((row) => Boolean(row?.isSelf)) || null,
    [rows],
  );
  const topRow = rows[0] || null;
  const roleFilterOptions = data.allowedRoleFilters || [];

  const handleRefresh = () => {
    loadLeaderboard(windowDays, selectedRole, { quiet: true });
  };

  return (
    <div className="h-full w-full overflow-y-auto custom-scrollbar px-4 pb-8 pt-20 sm:px-6 lg:px-8 md:pt-24">
      <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl text-slate-900 sm:text-3xl">
            Role Leaderboard
          </h1>
          <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">
            Compare your performance with all active {String(data.roleLabel || "role").toLowerCase()} users
          </p>
        </div>

        <div className="flex items-center gap-2">
          {roleFilterOptions.length > 1 ? (
            <>
              <label className="sr-only" htmlFor="leaderboard-role">
                Select role filter
              </label>
              <select
                id="leaderboard-role"
                value={selectedRole}
                onChange={(event) => setSelectedRole(event.target.value)}
                className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              >
                {roleFilterOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </>
          ) : null}

          <label className="sr-only" htmlFor="leaderboard-window">
            Select leaderboard window
          </label>
          <select
            id="leaderboard-window"
            value={windowDays}
            onChange={(event) => setWindowDays(Number(event.target.value))}
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
          >
            {WINDOW_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading || refreshing}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-emerald-300 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {refreshing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Refresh
          </button>
        </div>
      </div>

      {error ? (
        <div className="mb-5 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertCircle size={16} />
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="flex h-40 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500">
          <Loader2 size={18} className="mr-2 animate-spin" />
          Loading leaderboard...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                Active Peers
              </p>
              <div className="mt-2 flex items-center gap-2 text-slate-900">
                <Users size={16} className="text-emerald-600" />
                <span className="text-xl font-semibold">{Number(data.count || 0)}</span>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                Your Rank
              </p>
              <div className="mt-2 flex items-center gap-2 text-slate-900">
                <Trophy size={16} className="text-amber-500" />
                <span className="text-xl font-semibold">
                  {myRow?.rank ? `#${myRow.rank}` : "-"}
                </span>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                Top Conversion
              </p>
              <div className="mt-2 flex items-center gap-2 text-slate-900">
                <Crown size={16} className="text-amber-500" />
                <span className="text-xl font-semibold">
                  {topRow ? formatPercent(topRow.conversionRate) : "0%"}
                </span>
              </div>
            </div>
          </div>

          {rows.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600 shadow-sm">
              No users available for leaderboard in selected window.
            </div>
          ) : (
            <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr className="text-left text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
                      <th className="px-4 py-3">Rank</th>
                      <th className="px-4 py-3">User</th>
                      <th className="px-4 py-3">Closed</th>
                      <th className="px-4 py-3">Total</th>
                      <th className="px-4 py-3">Conversion</th>
                      <th className="px-4 py-3">Site Visits</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((row) => (
                      <tr
                        key={row.userId}
                        className={row.isSelf ? "bg-emerald-50/70" : "bg-white"}
                      >
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-semibold ${rankBadgeClass(row.rank)}`}>
                            <RankIcon rank={row.rank} />
                            #{row.rank}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm font-semibold text-slate-900">
                            {row.name || "Unknown User"}
                            {row.isSelf ? " (You)" : ""}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-slate-800">
                          {Number(row.closedLeads || 0).toLocaleString("en-IN")}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700">
                          {Number(row.totalLeads || 0).toLocaleString("en-IN")}
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-emerald-700">
                          {formatPercent(row.conversionRate)}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700">
                          {Number(row.siteVisits || 0).toLocaleString("en-IN")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default RoleLeaderboard;
