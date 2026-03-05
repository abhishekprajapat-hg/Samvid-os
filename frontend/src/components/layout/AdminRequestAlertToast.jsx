import React, { useCallback, useEffect, useMemo, useState } from "react";
import { BellRing, CheckCircle2, ExternalLink, Loader, XCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useChatNotifications } from "../../context/useChatNotifications";
import { updateLeadStatus } from "../../services/leadService";
import { approveInventoryRequest, rejectInventoryRequest } from "../../services/inventoryService";
import { toErrorMessage } from "../../utils/errorMessage";

const MAX_TRACKED_ALERT_IDS = 120;

const toIdString = (value) =>
  String(value || "").trim();

const resolveLeadId = (request) =>
  toIdString(request?.leadId || request?.payload?.leadId || request?.payload?.lead?._id);

const resolveLeadStatus = (request) => {
  const status = String(request?.payload?.lead?.status || request?.payload?.status || "REQUESTED")
    .trim()
    .toUpperCase();
  return status || "REQUESTED";
};

const resolveRequestId = (request) =>
  toIdString(request?.requestId || request?.payload?.requestId || request?.payload?._id);

const resolveInventoryId = (request) => {
  const raw =
    request?.inventoryId
    || request?.payload?.inventoryId
    || request?.payload?.inventory?._id
    || request?.payload?.inventory?.id
    || request?.payload?.request?.inventoryId?._id
    || request?.payload?.request?.inventoryId
    || "";
  return typeof raw === "object"
    ? toIdString(raw._id || raw.id)
    : toIdString(raw);
};

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const AdminRequestAlertToast = ({ userRole }) => {
  const navigate = useNavigate();
  const { recentAdminRequests } = useChatNotifications();
  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains("theme-dark"),
  );
  const [dismissedIds, setDismissedIds] = useState([]);
  const [resolvedIds, setResolvedIds] = useState([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      setIsDark(root.classList.contains("theme-dark"));
    });
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const activeAlert = useMemo(() => {
    if (userRole !== "ADMIN") return null;

    return (
      recentAdminRequests.find((request) => {
        const id = toIdString(request?.id);
        if (!id) return false;
        if (dismissedIds.includes(id)) return false;
        if (resolvedIds.includes(id)) return false;
        return true;
      }) || null
    );
  }, [dismissedIds, recentAdminRequests, resolvedIds, userRole]);

  useEffect(() => {
    setError("");
    setActionLoading(false);
  }, [activeAlert?.id]);

  const rememberId = useCallback((id, setter) => {
    if (!id) return;
    setter((prev) => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      if (next.length > MAX_TRACKED_ALERT_IDS) {
        return next.slice(next.length - MAX_TRACKED_ALERT_IDS);
      }
      return next;
    });
  }, []);

  const dismissActiveAlert = useCallback(() => {
    const id = toIdString(activeAlert?.id);
    if (!id) return;
    rememberId(id, setDismissedIds);
  }, [activeAlert?.id, rememberId]);

  const markResolved = useCallback((id) => {
    rememberId(id, setResolvedIds);
  }, [rememberId]);

  const handleOpen = useCallback(() => {
    if (!activeAlert) return;

    if (activeAlert.source === "inventory") {
      const inventoryId = resolveInventoryId(activeAlert);
      if (inventoryId) {
        navigate(`/inventory/${inventoryId}`);
      } else {
        navigate("/admin/notifications");
      }
    } else {
      navigate("/leads");
    }

    dismissActiveAlert();
  }, [activeAlert, dismissActiveAlert, navigate]);

  const runAction = useCallback(async (action) => {
    if (!activeAlert || actionLoading) return;
    const alertId = toIdString(activeAlert.id);
    if (!alertId) return;

    setActionLoading(true);
    setError("");

    try {
      await action();
      markResolved(alertId);
    } catch (actionError) {
      setError(toErrorMessage(actionError, "Failed to process request"));
    } finally {
      setActionLoading(false);
    }
  }, [actionLoading, activeAlert, markResolved]);

  const handleApprove = useCallback(() => {
    if (!activeAlert) return;

    if (activeAlert.source === "inventory") {
      const requestId = resolveRequestId(activeAlert);
      if (!requestId) {
        setError("Inventory request id missing in alert payload");
        return;
      }
      runAction(() => approveInventoryRequest(requestId));
      return;
    }

    const leadId = resolveLeadId(activeAlert);
    if (!leadId) {
      setError("Lead id missing in alert payload");
      return;
    }

    runAction(() =>
      updateLeadStatus(leadId, {
        status: resolveLeadStatus(activeAlert),
        dealPayment: {
          approvalStatus: "APPROVED",
          approvalNote: "Approved from realtime alert",
        },
      }));
  }, [activeAlert, runAction]);

  const handleReject = useCallback(() => {
    if (!activeAlert) return;

    const reason = window.prompt("Rejection reason", "Rejected from realtime alert");
    if (reason === null) return;

    const trimmedReason = String(reason || "").trim();
    if (!trimmedReason) {
      setError("Rejection reason is required");
      return;
    }

    if (activeAlert.source === "inventory") {
      const requestId = resolveRequestId(activeAlert);
      if (!requestId) {
        setError("Inventory request id missing in alert payload");
        return;
      }
      runAction(() => rejectInventoryRequest(requestId, trimmedReason));
      return;
    }

    const leadId = resolveLeadId(activeAlert);
    if (!leadId) {
      setError("Lead id missing in alert payload");
      return;
    }

    runAction(() =>
      updateLeadStatus(leadId, {
        status: resolveLeadStatus(activeAlert),
        dealPayment: {
          approvalStatus: "REJECTED",
          approvalNote: trimmedReason,
        },
      }));
  }, [activeAlert, runAction]);

  if (!activeAlert) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[110] w-[min(92vw,26rem)]">
      <div className={`pointer-events-auto rounded-2xl border p-4 shadow-2xl ${
        isDark
          ? "border-slate-700 bg-slate-900/95 text-slate-100"
          : "border-slate-200 bg-white text-slate-900"
      }`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className={`inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${
              isDark ? "text-cyan-300" : "text-cyan-700"
            }`}>
              <BellRing size={12} />
              New Admin Request
            </div>
            <p className="mt-1 text-sm font-semibold leading-5 break-words">
              {activeAlert.preview || "New request received"}
            </p>
            <p className={`mt-1 text-[11px] ${
              isDark ? "text-slate-400" : "text-slate-500"
            }`}>
              {activeAlert.source === "inventory" ? "Inventory workflow" : "Lead payment approval"} | {formatDate(activeAlert.createdAt)}
            </p>
          </div>

          <button
            type="button"
            onClick={dismissActiveAlert}
            className={`rounded-md border px-2 py-1 text-[10px] font-semibold ${
              isDark
                ? "border-slate-600 text-slate-300 hover:border-slate-400"
                : "border-slate-300 text-slate-600 hover:border-slate-400"
            }`}
          >
            Later
          </button>
        </div>

        {error ? (
          <div className={`mt-3 rounded-lg border px-2 py-1.5 text-xs ${
            isDark
              ? "border-rose-500/35 bg-rose-500/15 text-rose-200"
              : "border-rose-200 bg-rose-50 text-rose-700"
          }`}>
            {error}
          </div>
        ) : null}

        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <button
            type="button"
            onClick={handleApprove}
            disabled={actionLoading}
            className={`h-9 rounded-lg border px-3 text-xs font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-60 ${
              isDark
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200 hover:border-emerald-300/60"
                : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300"
            }`}
          >
            {actionLoading ? <Loader size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
            Approve
          </button>

          <button
            type="button"
            onClick={handleReject}
            disabled={actionLoading}
            className={`h-9 rounded-lg border px-3 text-xs font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-60 ${
              isDark
                ? "border-rose-500/40 bg-rose-500/10 text-rose-200 hover:border-rose-300/60"
                : "border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-300"
            }`}
          >
            <XCircle size={13} />
            Reject
          </button>

          <button
            type="button"
            onClick={handleOpen}
            disabled={actionLoading}
            className={`h-9 rounded-lg border px-3 text-xs font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-60 ${
              isDark
                ? "border-slate-600 bg-slate-800 text-slate-200 hover:border-cyan-300/45"
                : "border-slate-300 bg-white text-slate-700 hover:border-cyan-300"
            }`}
          >
            <ExternalLink size={13} />
            Open
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminRequestAlertToast;
