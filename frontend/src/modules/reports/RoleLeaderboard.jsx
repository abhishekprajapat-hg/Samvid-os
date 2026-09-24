import React, { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import ToastNotice from "../../components/ui/ToastNotice";
import { getAllLeads } from "../../services/leadService";
import { getMyTargets } from "../../services/targetService";
import { getRoleLeaderboard } from "../../services/userService";
import { toErrorMessage } from "../../utils/errorMessage";

const WINDOW_OPTIONS = [
  { key: "MONTH", label: "This month", days: () => new Date().getDate() },
  {
    key: "QUARTER",
    label: "This quarter",
    days: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
      return Math.max(1, Math.ceil((now - start) / 86400000) + 1);
    },
  },
  { key: "ALL", label: "All time", days: () => 3650 },
];

const MODE_OPTIONS = [
  { key: "CLOSURES", label: "Closures" },
  { key: "VISITS", label: "Site visits" },
  { key: "REVENUE", label: "Revenue" },
];

const toMonthKey = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const toDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
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

const getInitials = (name = "") =>
  String(name || "User")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "U";

const getLeadRevenue = (lead = {}) => {
  const received = Number(lead.brokerageReceived);
  if (Number.isFinite(received) && received > 0) return received;
  const saleDetails = lead?.inventoryId?.saleDetails;
  const total = Number(saleDetails?.totalAmount || lead?.inventoryId?.price || 0);
  const remaining = Number(saleDetails?.remainingAmount || 0);
  return Math.max(0, total - remaining);
};

const getLeadOwnerId = (lead = {}, selectedRole = "") => {
  if (selectedRole === "CHANNEL_PARTNER") {
    return String(lead?.createdBy?._id || lead?.createdBy || "");
  }
  return String(lead?.assignedTo?._id || lead?.assignedTo || "");
};

const getOrdinalSuffix = (rank) => {
  const value = Number(rank || 0);
  if (!value) return "";
  const teen = value % 100;
  if (teen >= 11 && teen <= 13) return "th";
  if (value % 10 === 1) return "st";
  if (value % 10 === 2) return "nd";
  if (value % 10 === 3) return "rd";
  return "th";
};

const RoleLeaderboard = () => {
  const [viewerRole] = useState(() =>
    String(window.localStorage.getItem("role") || "").trim().toUpperCase(),
  );
  const [selectedRole, setSelectedRole] = useState(viewerRole || "");
  const [windowKey, setWindowKey] = useState("MONTH");
  const [mode, setMode] = useState("CLOSURES");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState({
    role: "",
    roleLabel: "",
    count: 0,
    leaderboard: [],
    allowedRoleFilters: [],
  });
  const [targetState, setTargetState] = useState({ myTarget: null, outgoing: [] });
  const [leads, setLeads] = useState([]);

  const windowDays = useMemo(
    () => WINDOW_OPTIONS.find((option) => option.key === windowKey)?.days() || 30,
    [windowKey],
  );

  useEffect(() => {
    let alive = true;
    const loadLeaderboard = async () => {
      setLoading(true);
      setError("");
      try {
        const [payload, leadRows, targetPayload] = await Promise.all([
          getRoleLeaderboard({
            windowDays,
            ...(selectedRole ? { role: selectedRole } : {}),
          }),
          getAllLeads(),
          getMyTargets({ month: toMonthKey() }).catch(() => ({ myTarget: null, outgoing: [] })),
        ]);
        if (!alive) return;
        setData({
          role: payload.role,
          roleLabel: payload.roleLabel,
          count: payload.count,
          leaderboard: payload.leaderboard,
          allowedRoleFilters: payload.allowedRoleFilters || [],
        });
        setSelectedRole(String(payload.role || selectedRole || "").trim().toUpperCase());
        setLeads(Array.isArray(leadRows) ? leadRows : []);
        setTargetState({
          myTarget: targetPayload.myTarget || null,
          outgoing: targetPayload.outgoing || [],
        });
      } catch (fetchError) {
        if (alive) setError(toErrorMessage(fetchError, "Leaderboard load failed"));
      } finally {
        if (alive) setLoading(false);
      }
    };

    loadLeaderboard();
    return () => {
      alive = false;
    };
  }, [selectedRole, windowDays]);

  const revenueByUserId = useMemo(() => {
    const since = new Date(Date.now() - windowDays * 86400000);
    const rows = new Map();
    leads.forEach((lead) => {
      if (String(lead.status || "").toUpperCase() !== "CLOSED") return;
      const rangeDate = toDate(lead.updatedAt || lead.createdAt);
      if (rangeDate && rangeDate < since) return;
      const ownerId = getLeadOwnerId(lead, data.role);
      if (!ownerId) return;
      rows.set(ownerId, (rows.get(ownerId) || 0) + getLeadRevenue(lead));
    });
    return rows;
  }, [data.role, leads, windowDays]);

  const targetByUserId = useMemo(() => {
    const rows = new Map();
    targetState.outgoing.forEach((target) => {
      const assigneeId = String(target?.assignedTo?._id || target?.assignedTo || "");
      if (assigneeId) rows.set(assigneeId, target);
    });
    const myTarget = targetState.myTarget;
    const myAssigneeId = String(myTarget?.assignedTo?._id || myTarget?.assignedTo || "");
    if (myAssigneeId) rows.set(myAssigneeId, myTarget);
    return rows;
  }, [targetState]);

  const rankedRows = useMemo(() => {
    const rows = (data.leaderboard || []).map((row) => {
      const revenue = revenueByUserId.get(String(row.userId)) || 0;
      const target = targetByUserId.get(String(row.userId)) || null;
      const targetValue = Number(target?.leadsTarget || target?.revenueTarget || 0);
      const achievedValue = target?.leadsTarget
        ? Number(target?.achievements?.closedDealsAchieved || row.closedLeads || 0)
        : revenue;
      const targetPercent = targetValue > 0 ? Math.round((achievedValue / targetValue) * 100) : null;
      return { ...row, revenue, targetPercent };
    });

    const sorter = {
      CLOSURES: (left, right) => right.closedLeads - left.closedLeads || right.siteVisits - left.siteVisits,
      VISITS: (left, right) => right.siteVisits - left.siteVisits || right.closedLeads - left.closedLeads,
      REVENUE: (left, right) => right.revenue - left.revenue || right.closedLeads - left.closedLeads,
    }[mode];

    return [...rows].sort(sorter).map((row, index) => ({ ...row, displayRank: index + 1 }));
  }, [data.leaderboard, mode, revenueByUserId, targetByUserId]);

  const myRow = rankedRows.find((row) => row.isSelf) || null;
  const teamTarget = rankedRows.reduce((sum, row) => {
    const target = targetByUserId.get(String(row.userId));
    return sum + Number(target?.leadsTarget || 0);
  }, 0);
  const achieved = rankedRows.reduce((sum, row) => sum + Number(row.closedLeads || 0), 0);
  const now = new Date();
  const daysLeft = Math.max(0, new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate());
  const neededPerDay = daysLeft > 0 ? Math.max(0, (teamTarget - achieved) / daysLeft) : 0;
  const currentWindowLabel = WINDOW_OPTIONS.find((option) => option.key === windowKey)?.label || "This month";

  return (
    <div className="leaderboard-doc-screen ui-page-shell custom-scrollbar">
      <ToastNotice message={error} type="error" />

      <div className="leaderboard-toolbar">
        <div className="leaderboard-seg">
          {WINDOW_OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              className={windowKey === option.key ? "on" : ""}
              onClick={() => setWindowKey(option.key)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="leaderboard-seg">
          {MODE_OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              className={mode === option.key ? "on" : ""}
              onClick={() => setMode(option.key)}
            >
              {option.label}
            </button>
          ))}
        </div>
        {data.allowedRoleFilters.length > 1 ? (
          <select
            value={selectedRole}
            onChange={(event) => setSelectedRole(event.target.value)}
            className="leaderboard-select"
            aria-label="Role filter"
          >
            {data.allowedRoleFilters.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        ) : null}
      </div>

      {loading ? (
        <div className="leaderboard-card leaderboard-loading">
          <Loader2 size={18} className="animate-spin" />
          Loading leaderboard...
        </div>
      ) : (
        <div className="leaderboard-split">
          <div className="leaderboard-card">
            <div className="leaderboard-card-h">
              <h4>{new Date().toLocaleString("en-IN", { month: "long" })} rankings</h4>
              <span className="leaderboard-muted">Updated now</span>
            </div>
            <div className="leaderboard-table-wrap">
              <table className="leaderboard-tbl">
                <thead>
                  <tr>
                    <th className="leaderboard-rank-col">#</th>
                    <th>Executive</th>
                    <th>Closures</th>
                    <th>Visits</th>
                    <th>Revenue</th>
                    <th>Target</th>
                  </tr>
                </thead>
                <tbody>
                  {rankedRows.length === 0 ? (
                    <tr><td colSpan={6} className="leaderboard-empty">No leaderboard rows for {currentWindowLabel.toLowerCase()}.</td></tr>
                  ) : null}
                  {rankedRows.map((row) => (
                    <tr key={row.userId} className={row.displayRank === 1 ? "is-top" : row.isSelf ? "is-self" : ""}>
                      <td><b className={row.displayRank === 1 ? "leaderboard-rank-top" : ""}>{row.displayRank}</b></td>
                      <td>
                        <div className="leaderboard-cellname">
                          <div className="leaderboard-avatar">{getInitials(row.name)}</div>
                          <div>
                            <b>{row.name || "Unknown User"}</b>
                            <small>{row.isSelf ? "You" : data.roleLabel || row.role || "Executive"}</small>
                          </div>
                        </div>
                      </td>
                      <td className="leaderboard-num"><b>{Number(row.closedLeads || 0)}</b></td>
                      <td className="leaderboard-num">{Number(row.siteVisits || 0)}</td>
                      <td className="leaderboard-num">{formatCurrencyCompact(row.revenue)}</td>
                      <td>
                        {row.targetPercent === null ? (
                          <span className="leaderboard-muted">-</span>
                        ) : (
                          <span className={`leaderboard-pill ${row.targetPercent >= 100 ? "t-won" : row.targetPercent >= 70 ? "t-warm" : "t-risk"}`}>
                            <i />
                            {row.targetPercent}%
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="leaderboard-side">
            <div className="leaderboard-card">
              <div className="leaderboard-card-h"><h4>Your position</h4></div>
              <div className="leaderboard-position">
                <div className="leaderboard-position-rank">
                  {myRow?.displayRank || "-"}
                  {myRow?.displayRank ? <span>{getOrdinalSuffix(myRow.displayRank)}</span> : null}
                </div>
                <p className="leaderboard-hint">of {data.count || rankedRows.length} in {currentWindowLabel.toLowerCase()}</p>
                <div className="leaderboard-bar-mini">
                  <i style={{ width: `${myRow?.targetPercent ? Math.min(myRow.targetPercent, 100) : 0}%` }} />
                </div>
                <p className="leaderboard-hint">
                  {myRow ? `${myRow.closedLeads} closures tracked` : "No personal rank in this filter"}
                </p>
              </div>
            </div>

            <div className="leaderboard-card">
              <div className="leaderboard-card-h"><h4>Team pace</h4></div>
              <div className="leaderboard-card-b">
                <div className="leaderboard-rowlist">
                  <div><span>Team target</span><b className="leaderboard-num">{teamTarget || "-"} closures</b></div>
                  <div><span>Achieved</span><b className="leaderboard-num ok">{achieved}</b></div>
                  <div><span>Days left</span><b className="leaderboard-num">{daysLeft}</b></div>
                  <div><span>Needed per day</span><b className="leaderboard-num">{neededPerDay.toFixed(2)}</b></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoleLeaderboard;
