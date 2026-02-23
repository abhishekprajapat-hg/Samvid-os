import React, { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Calendar,
  CheckCircle,
  Loader2,
  MapPin,
  RefreshCw,
  Send,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import { assignHierarchyTarget, getMyTargets } from "../../services/targetService";
import { toErrorMessage } from "../../utils/errorMessage";

const formatNumber = (value) => Number(value || 0).toLocaleString("en-IN");
const formatCurrency = (value) => `Rs ${formatNumber(value)}`;

const getCurrentMonthKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

const clampPercent = (value) => {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return 0;
  if (numeric < 0) return 0;
  if (numeric > 100) return 100;
  return Math.round(numeric * 10) / 10;
};

const safeTarget = (row) => ({
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

const MetricCard = ({
  title,
  subtitle,
  icon: Icon,
  target,
  achieved,
  percent,
  formatValue,
}) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          {title}
        </p>
        <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
      </div>
      <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
        <Icon size={15} />
      </div>
    </div>

    <div className="text-sm text-slate-700">
      <span className="font-semibold text-slate-900">{formatValue(achieved)}</span>
      <span className="text-slate-500"> / {formatValue(target)}</span>
    </div>

    <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div
        className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 transition-all duration-300"
        style={{ width: `${clampPercent(percent)}%` }}
      />
    </div>
    <p className="mt-1 text-right text-xs font-semibold text-emerald-600">
      {clampPercent(percent)}% achieved
    </p>
  </div>
);

const TargetListItem = ({ row }) => {
  const stats = safeTarget(row);
  const assignee = row?.assignedTo || {};
  const assigner = row?.assignedBy || {};

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{assignee.name || "Unknown User"}</p>
          <p className="text-xs text-slate-500">
            {assignee.roleLabel || assignee.role || "-"} | Assigned by {assigner.name || "-"}
          </p>
        </div>
        <p className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">
          {row?.month || "-"}
        </p>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-slate-600 sm:grid-cols-3">
        <div className="rounded-lg bg-slate-50 px-3 py-2">
          Leads: {formatNumber(stats.achievements.leadsAchieved)} / {formatNumber(stats.leadsTarget)}
        </div>
        <div className="rounded-lg bg-slate-50 px-3 py-2">
          Site Visits: {formatNumber(stats.achievements.siteVisitsAchieved)} / {formatNumber(stats.siteVisitTarget)}
        </div>
        <div className="rounded-lg bg-slate-50 px-3 py-2">
          Revenue: {formatCurrency(stats.achievements.revenueAchieved)} / {formatCurrency(stats.revenueTarget)}
        </div>
      </div>

      {row?.notes ? (
        <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          Note: {row.notes}
        </p>
      ) : null}
    </div>
  );
};

const Performance = () => {
  const [month, setMonth] = useState(getCurrentMonthKey());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [targetState, setTargetState] = useState({
    month: "",
    canAssign: false,
    assignableReports: [],
    myTarget: null,
    incoming: [],
    outgoing: [],
  });
  const [assignmentForm, setAssignmentForm] = useState({
    assignedToId: "",
    leadsTarget: "",
    revenueTarget: "",
    siteVisitTarget: "",
    notes: "",
  });

  const loadTargets = async (requestedMonth, { quiet = false } = {}) => {
    if (quiet) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError("");

    try {
      const payload = await getMyTargets({ month: requestedMonth });
      setTargetState({
        month: payload.month,
        canAssign: Boolean(payload.canAssign),
        assignableReports: payload.assignableReports || [],
        myTarget: payload.myTarget || null,
        incoming: payload.incoming || [],
        outgoing: payload.outgoing || [],
      });
    } catch (fetchError) {
      setError(toErrorMessage(fetchError, "Failed to load targets"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadTargets(month);
  }, [month]);

  useEffect(() => {
    if (!targetState.canAssign) return;

    setAssignmentForm((prev) => {
      const exists = targetState.assignableReports.some(
        (row) => String(row._id) === String(prev.assignedToId),
      );

      if (exists) return prev;

      return {
        ...prev,
        assignedToId: targetState.assignableReports[0]?._id || "",
      };
    });
  }, [targetState.canAssign, targetState.assignableReports]);

  const myTarget = useMemo(() => safeTarget(targetState.myTarget), [targetState.myTarget]);
  const hasMyTarget = Boolean(targetState.myTarget);

  const handleRefresh = () => {
    loadTargets(month, { quiet: true });
  };

  const handleAssign = async (event) => {
    event.preventDefault();
    setSuccessMessage("");
    setError("");

    const leadsTarget = Number(assignmentForm.leadsTarget || 0);
    const revenueTarget = Number(assignmentForm.revenueTarget || 0);
    const siteVisitTarget = Number(assignmentForm.siteVisitTarget || 0);

    if (!assignmentForm.assignedToId) {
      setError("Please select a reporting user");
      return;
    }

    if (
      !Number.isFinite(leadsTarget)
      || !Number.isFinite(revenueTarget)
      || !Number.isFinite(siteVisitTarget)
      || leadsTarget < 0
      || revenueTarget < 0
      || siteVisitTarget < 0
    ) {
      setError("All targets must be valid non-negative numbers");
      return;
    }

    if (leadsTarget <= 0 && revenueTarget <= 0 && siteVisitTarget <= 0) {
      setError("At least one target value should be greater than zero");
      return;
    }

    setSubmitting(true);
    try {
      const result = await assignHierarchyTarget({
        assignedToId: assignmentForm.assignedToId,
        month,
        leadsTarget,
        revenueTarget,
        siteVisitTarget,
        notes: assignmentForm.notes,
      });
      setSuccessMessage(result.message || "Target assigned successfully");
      await loadTargets(month, { quiet: true });
    } catch (assignError) {
      setError(toErrorMessage(assignError, "Unable to assign target"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="h-full w-full overflow-y-auto px-4 pb-8 pt-20 sm:px-6 lg:px-8 md:pt-24">
      <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl text-slate-900 sm:text-3xl">
            Hierarchy Targets
          </h1>
          <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">
            Monthly team and personal performance tracking
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="target-month">
            Select month
          </label>
          <div className="relative">
            <Calendar
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
            />
            <input
              id="target-month"
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              className="h-10 rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-800 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            />
          </div>
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

      {successMessage ? (
        <div className="mb-5 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <CheckCircle size={16} />
          {successMessage}
        </div>
      ) : null}

      {loading ? (
        <div className="flex h-44 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500">
          <Loader2 size={18} className="mr-2 animate-spin" />
          Loading targets...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <MetricCard
              title="Leads Target"
              subtitle="Assigned leads for selected month"
              icon={Users}
              target={myTarget.leadsTarget}
              achieved={myTarget.achievements.leadsAchieved}
              percent={myTarget.progress.leadsPercent}
              formatValue={formatNumber}
            />
            <MetricCard
              title="Site Visits"
              subtitle="Verified site visit completions"
              icon={MapPin}
              target={myTarget.siteVisitTarget}
              achieved={myTarget.achievements.siteVisitsAchieved}
              percent={myTarget.progress.siteVisitPercent}
              formatValue={formatNumber}
            />
            <MetricCard
              title="Revenue Target"
              subtitle="Converted revenue from closed deals"
              icon={TrendingUp}
              target={myTarget.revenueTarget}
              achieved={myTarget.achievements.revenueAchieved}
              percent={myTarget.progress.revenuePercent}
              formatValue={formatCurrency}
            />
          </div>

          {!hasMyTarget ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              No target is assigned to you for {targetState.month || month} yet.
            </div>
          ) : null}

          {targetState.canAssign ? (
            <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <Target size={16} className="text-emerald-600" />
                <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-700">
                  Assign Target To Direct Report
                </h2>
              </div>

              {targetState.assignableReports.length === 0 ? (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  No direct reporting users available in your next hierarchy level.
                </p>
              ) : (
                <form onSubmit={handleAssign} className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
                      Reporting User
                      <select
                        value={assignmentForm.assignedToId}
                        onChange={(event) =>
                          setAssignmentForm((prev) => ({
                            ...prev,
                            assignedToId: event.target.value,
                          }))
                        }
                        className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-800 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                      >
                        {targetState.assignableReports.map((row) => (
                          <option key={row._id} value={row._id}>
                            {row.name} ({row.roleLabel || row.role})
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
                      Leads Target
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={assignmentForm.leadsTarget}
                        onChange={(event) =>
                          setAssignmentForm((prev) => ({
                            ...prev,
                            leadsTarget: event.target.value,
                          }))
                        }
                        placeholder="0"
                        className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-800 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                      />
                    </label>

                    <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
                      Site Visit Target
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={assignmentForm.siteVisitTarget}
                        onChange={(event) =>
                          setAssignmentForm((prev) => ({
                            ...prev,
                            siteVisitTarget: event.target.value,
                          }))
                        }
                        placeholder="0"
                        className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-800 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                      />
                    </label>

                    <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
                      Revenue Target
                      <input
                        type="number"
                        min="0"
                        step="1000"
                        value={assignmentForm.revenueTarget}
                        onChange={(event) =>
                          setAssignmentForm((prev) => ({
                            ...prev,
                            revenueTarget: event.target.value,
                          }))
                        }
                        placeholder="0"
                        className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-800 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                      />
                    </label>
                  </div>

                  <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
                    Notes (Optional)
                    <textarea
                      value={assignmentForm.notes}
                      onChange={(event) =>
                        setAssignmentForm((prev) => ({
                          ...prev,
                          notes: event.target.value,
                        }))
                      }
                      rows={3}
                      maxLength={500}
                      placeholder="Add context for assignee"
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-800 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                    />
                  </label>

                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-slate-500">
                      Target will be saved for {targetState.month || month}.
                    </p>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                      Assign Target
                    </button>
                  </div>
                </form>
              )}
            </section>
          ) : null}

          <section className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-slate-700">
                My Incoming Targets
              </h3>

              {targetState.incoming.length === 0 ? (
                <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  No incoming targets for this month.
                </p>
              ) : (
                <div className="space-y-3">
                  {targetState.incoming.map((row) => (
                    <TargetListItem key={row._id} row={row} />
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-slate-700">
                Targets Assigned By Me
              </h3>

              {targetState.outgoing.length === 0 ? (
                <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  You have not assigned any targets for this month.
                </p>
              ) : (
                <div className="space-y-3">
                  {targetState.outgoing.map((row) => (
                    <TargetListItem key={row._id} row={row} />
                  ))}
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
};

export default Performance;
