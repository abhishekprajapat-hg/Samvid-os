import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BellRing,
  Building2,
  CircleDollarSign,
  CheckCircle2,
  Clock3,
  FileText,
  Loader,
  RefreshCw,
  Search,
  UserRound,
  XCircle,
} from "lucide-react";
import { getLeadPaymentRequests, updateLeadStatus } from "../../services/leadService";
import {
  approveInventoryRequest,
  getPendingInventoryRequests,
  rejectInventoryRequest,
} from "../../services/inventoryService";
import { toErrorMessage } from "../../utils/errorMessage";
import { useChatNotifications } from "../../context/useChatNotifications";

const APPROVAL_FILTERS = [
  { value: "ALL", label: "All decisions" },
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
];
const REQUEST_FIELD_LABELS = {
  projectName: "Project",
  towerName: "Tower",
  unitNumber: "Unit",
  price: "Price",
  type: "Type",
  category: "Category",
  status: "Status",
  reservationReason: "Reservation Reason",
  saleDetails: "Sold Details",
  location: "Location",
  siteLocation: "Coordinates",
  images: "Images",
  documents: "Documents",
};

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString([], {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatAmount = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "-";
  return `Rs ${parsed.toLocaleString("en-IN")}`;
};

const formatPaymentMode = (value) => {
  const mode = String(value || "").trim().toUpperCase();
  if (!mode) return "-";
  if (mode === "NET_BANKING_NEFTRTGSIMPS") return "Net Banking (NEFT/RTGS/IMPS)";
  if (mode === "CHECK") return "Check / Cheque";
  return mode;
};

const formatPaymentType = (value) => {
  const type = String(value || "").trim().toUpperCase();
  if (!type) return "-";
  if (type === "FULL") return "Full Payment";
  if (type === "PARTIAL") return "Partial Payment";
  return type;
};

const getApprovalTone = (status, isDark) => {
  const value = String(status || "").toUpperCase();
  if (value === "APPROVED") {
    return isDark
      ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-200"
      : "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (value === "REJECTED") {
    return isDark
      ? "border-rose-500/35 bg-rose-500/10 text-rose-200"
      : "border-rose-200 bg-rose-50 text-rose-700";
  }
  return isDark
    ? "border-amber-500/35 bg-amber-500/10 text-amber-200"
    : "border-amber-200 bg-amber-50 text-amber-700";
};

const formatInventoryStatusLabel = (value) => {
  const status = String(value || "").trim();
  if (!status) return "-";
  if (status === "Blocked") return "Reserved";
  return status;
};

const getInventoryUnitLabel = (inventoryLike = {}) =>
  [inventoryLike.projectName, inventoryLike.towerName, inventoryLike.unitNumber]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(" - ");

const toObjectIdString = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && value._id) return String(value._id);
  return String(value);
};

const formatRoleLabel = (value) =>
  String(value || "")
    .toLowerCase()
    .split("_")
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");

const formatUserWithRole = (userLike) => {
  if (!userLike) return "-";
  if (typeof userLike === "string") return userLike;
  const name = String(userLike?.name || "").trim();
  const role = formatRoleLabel(userLike?.role);
  if (!name && !role) return "-";
  if (!role) return name || "-";
  if (!name) return role;
  return `${name} (${role})`;
};

const getUserContactField = (userLike, field) => {
  if (!userLike || typeof userLike !== "object") return "";
  return String(userLike?.[field] || "").trim();
};

const isSoldInventoryStatus = (value) =>
  String(value || "").trim().toLowerCase() === "sold";

const getLeadPropertyRows = (lead = {}) => {
  const rows = [];
  const dedupe = new Set();

  const pushInventory = (inventoryLike) => {
    const inventoryId = toObjectIdString(inventoryLike);
    if (!inventoryId || dedupe.has(inventoryId)) return;
    dedupe.add(inventoryId);
    rows.push(inventoryLike);
  };

  pushInventory(lead?.inventoryId);
  if (Array.isArray(lead?.relatedInventoryIds)) {
    lead.relatedInventoryIds.forEach((inventoryLike) => pushInventory(inventoryLike));
  }

  return rows;
};

const formatCoordinates = (siteLocation = {}) => {
  const lat = Number(siteLocation?.lat);
  const lng = Number(siteLocation?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "-";
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
};

const formatRequestValue = (key, value) => {
  if (key === "price") return formatAmount(value);
  if (key === "status") return formatInventoryStatusLabel(value);
  if (key === "siteLocation") return formatCoordinates(value);
  if (key === "saleDetails") {
    const leadName = String(value?.leadId?.name || value?.leadId || "-");
    const mode = formatPaymentMode(value?.paymentMode);
    const type = formatPaymentType(value?.paymentType);
    const totalAmount = formatAmount(value?.totalAmount);
    const remainingAmount = formatAmount(value?.remainingAmount);
    return `${leadName} | ${mode} | ${type} | Total: ${totalAmount} | Remaining: ${remainingAmount}`;
  }
  if (Array.isArray(value)) return `${value.length} item(s)`;
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
};

const resolveAlertInventoryId = (alert = {}) => {
  const payload = alert?.payload || {};
  const raw =
    alert?.inventoryId
    || payload.inventoryId
    || payload.inventory?._id
    || payload.inventory?.id
    || payload.request?.inventoryId?._id
    || payload.request?.inventoryId
    || "";
  if (typeof raw === "object") {
    return String(raw?._id || raw?.id || "").trim();
  }
  return String(raw || "").trim();
};

const AdminNotifications = () => {
  const navigate = useNavigate();
  const { adminRequestPulseAt, markAdminRequestsRead, recentAdminRequests } = useChatNotifications();
  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains("theme-dark"),
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [query, setQuery] = useState("");
  const [approvalFilter, setApprovalFilter] = useState("ALL");
  const [leadRequests, setLeadRequests] = useState([]);
  const [inventoryRequests, setInventoryRequests] = useState([]);
  const [reviewingLeadId, setReviewingLeadId] = useState("");
  const [reviewingInventoryRequestId, setReviewingInventoryRequestId] = useState("");

  const loadNotifications = useCallback(async (asRefresh = false) => {
    try {
      if (asRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError("");
      setSuccess("");

      const [leadRows, inventoryRows] = await Promise.all([
        getLeadPaymentRequests({
          approvalStatus: approvalFilter,
          limit: 300,
        }),
        getPendingInventoryRequests(),
      ]);

      setLeadRequests(Array.isArray(leadRows) ? leadRows : []);
      setInventoryRequests(Array.isArray(inventoryRows) ? inventoryRows : []);
    } catch (fetchError) {
      const message = toErrorMessage(fetchError, "Failed to load notifications");
      setError(message);
      setLeadRequests([]);
      setInventoryRequests([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [approvalFilter]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    markAdminRequestsRead();
  }, [markAdminRequestsRead]);

  useEffect(() => {
    if (!adminRequestPulseAt) return;
    loadNotifications(true);
    markAdminRequestsRead();
  }, [adminRequestPulseAt, loadNotifications, markAdminRequestsRead]);

  useEffect(() => {
    if (!success) return undefined;
    const timerId = setTimeout(() => setSuccess(""), 2200);
    return () => clearTimeout(timerId);
  }, [success]);

  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      setIsDark(root.classList.contains("theme-dark"));
    });
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const normalizedQuery = String(query || "").trim().toLowerCase();

  const filteredLeadRequests = useMemo(() => {
    if (!normalizedQuery) return leadRequests;

    return leadRequests.filter((lead) => {
      const approvalStatus = String(lead?.dealPayment?.approvalStatus || "").toLowerCase();
      const leadStatus = String(lead?.status || "").toLowerCase();
      const mode = String(lead?.dealPayment?.mode || "").toLowerCase();
      const paymentType = String(lead?.dealPayment?.paymentType || "").toLowerCase();
      const paymentReference = String(lead?.dealPayment?.paymentReference || "").toLowerCase();
      const name = String(lead?.name || "").toLowerCase();
      const phone = String(lead?.phone || "").toLowerCase();
      const project = String(lead?.projectInterested || "").toLowerCase();
      const requestedBy = String(lead?.dealPayment?.approvalRequestedBy?.name || "").toLowerCase();
      const assignedTo = String(lead?.assignedTo?.name || "").toLowerCase();
      const assignedManager = String(lead?.assignedManager?.name || "").toLowerCase();
      const assignedExecutive = String(lead?.assignedExecutive?.name || "").toLowerCase();
      const assignedFieldExecutive = String(lead?.assignedFieldExecutive?.name || "").toLowerCase();
      const closureDocs = Array.isArray(lead?.closureDocuments) ? lead.closureDocuments : [];
      const closureDocNames = closureDocs
        .map((doc) => String(doc?.name || doc?.url || "").toLowerCase())
        .join(" ");
      const propertyNames = getLeadPropertyRows(lead)
        .map((inventoryLike) => getInventoryUnitLabel(inventoryLike))
        .join(" ")
        .toLowerCase();

      const searchableText = [
        approvalStatus,
        leadStatus,
        mode,
        paymentType,
        paymentReference,
        name,
        phone,
        project,
        requestedBy,
        assignedTo,
        assignedManager,
        assignedExecutive,
        assignedFieldExecutive,
        closureDocNames,
        propertyNames,
      ].join(" ");

      return searchableText.includes(normalizedQuery);
    });
  }, [leadRequests, normalizedQuery]);

  const filteredInventoryRequests = useMemo(() => {
    if (!normalizedQuery) return inventoryRequests;

    return inventoryRequests.filter((request) => {
      const requestedBy = String(request?.requestedBy?.name || "").toLowerCase();
      const role = String(request?.requestedBy?.role || "").toLowerCase();
      const requestType = String(request?.type || "").toLowerCase();
      const unit = String(request?.inventoryId?.unitNumber || "").toLowerCase();
      const project = String(request?.inventoryId?.projectName || "").toLowerCase();
      const team = String(request?.teamId?.name || "").toLowerCase();
      return [requestedBy, role, requestType, unit, project, team]
        .join(" ")
        .includes(normalizedQuery);
    });
  }, [inventoryRequests, normalizedQuery]);

  const filteredRecentAlerts = useMemo(() => {
    if (!normalizedQuery) return recentAdminRequests;

    return recentAdminRequests.filter((alert) => {
      const payload = alert?.payload || {};
      const inventoryBits = [
        payload?.inventory?.projectName,
        payload?.inventory?.towerName,
        payload?.inventory?.unitNumber,
        payload?.inventoryId?.projectName,
        payload?.inventoryId?.towerName,
        payload?.inventoryId?.unitNumber,
      ]
        .map((value) => String(value || "").trim())
        .filter(Boolean)
        .join(" ");

      const searchableText = [
        alert?.preview,
        alert?.source,
        alert?.requestType,
        payload?.lead?.name,
        payload?.lead?.phone,
        payload?.requestId,
        payload?.inventoryRequestType,
        payload?.type,
        inventoryBits,
      ]
        .join(" ")
        .toLowerCase();

      return searchableText.includes(normalizedQuery);
    });
  }, [normalizedQuery, recentAdminRequests]);

  const metrics = useMemo(() => {
    const pendingLead = leadRequests.filter(
      (lead) => String(lead?.dealPayment?.approvalStatus || "").toUpperCase() === "PENDING",
    ).length;
    const approvedLead = leadRequests.filter(
      (lead) => String(lead?.dealPayment?.approvalStatus || "").toUpperCase() === "APPROVED",
    ).length;
    const rejectedLead = leadRequests.filter(
      (lead) => String(lead?.dealPayment?.approvalStatus || "").toUpperCase() === "REJECTED",
    ).length;

    return {
      pendingLead,
      approvedLead,
      rejectedLead,
      pendingInventory: inventoryRequests.length,
    };
  }, [leadRequests, inventoryRequests.length]);

  const handleApproveLeadRequest = useCallback(async (lead) => {
    const leadId = String(lead?._id || "");
    if (!leadId) return;

    try {
      setReviewingLeadId(leadId);
      setError("");
      setSuccess("");

      const currentStatus = String(lead?.status || "").trim().toUpperCase() || "REQUESTED";
      await updateLeadStatus(leadId, {
        status: currentStatus,
        dealPayment: {
          approvalStatus: "APPROVED",
          approvalNote: "Approved from notifications",
        },
      });
      setSuccess("Payment request approved");
      await loadNotifications(true);
    } catch (reviewError) {
      setError(toErrorMessage(reviewError, "Failed to approve payment request"));
    } finally {
      setReviewingLeadId("");
    }
  }, [loadNotifications]);

  const handleRejectLeadRequest = useCallback(async (lead) => {
    const leadId = String(lead?._id || "");
    if (!leadId) return;

    const reason = window.prompt("Rejection reason", "Rejected from notifications");
    if (reason === null) return;
    const trimmedReason = String(reason || "").trim();
    if (!trimmedReason) {
      setError("Rejection reason is required");
      return;
    }

    try {
      setReviewingLeadId(leadId);
      setError("");
      setSuccess("");

      const currentStatus = String(lead?.status || "").trim().toUpperCase() || "REQUESTED";
      await updateLeadStatus(leadId, {
        status: currentStatus,
        dealPayment: {
          approvalStatus: "REJECTED",
          approvalNote: trimmedReason,
        },
      });
      setSuccess("Payment request rejected");
      await loadNotifications(true);
    } catch (reviewError) {
      setError(toErrorMessage(reviewError, "Failed to reject payment request"));
    } finally {
      setReviewingLeadId("");
    }
  }, [loadNotifications]);

  const handleApproveInventoryRequest = useCallback(async (requestId) => {
    const resolvedId = String(requestId || "");
    if (!resolvedId) return;

    try {
      setReviewingInventoryRequestId(resolvedId);
      setError("");
      setSuccess("");
      await approveInventoryRequest(resolvedId);
      setSuccess("Inventory request approved");
      await loadNotifications(true);
    } catch (reviewError) {
      setError(toErrorMessage(reviewError, "Failed to approve inventory request"));
    } finally {
      setReviewingInventoryRequestId("");
    }
  }, [loadNotifications]);

  const handleRejectInventoryRequest = useCallback(async (requestId) => {
    const resolvedId = String(requestId || "");
    if (!resolvedId) return;

    const reason = window.prompt("Rejection reason", "Rejected from notifications");
    if (reason === null) return;
    const trimmedReason = String(reason || "").trim();
    if (!trimmedReason) {
      setError("Rejection reason is required");
      return;
    }

    try {
      setReviewingInventoryRequestId(resolvedId);
      setError("");
      setSuccess("");
      await rejectInventoryRequest(resolvedId, trimmedReason);
      setSuccess("Inventory request rejected");
      await loadNotifications(true);
    } catch (reviewError) {
      setError(toErrorMessage(reviewError, "Failed to reject inventory request"));
    } finally {
      setReviewingInventoryRequestId("");
    }
  }, [loadNotifications]);

  const handleOpenAlertTarget = useCallback((alert) => {
    if (String(alert?.source || "").toLowerCase() === "lead") {
      navigate("/leads");
      return;
    }

    const inventoryId = resolveAlertInventoryId(alert);
    if (inventoryId) {
      navigate(`/inventory/${inventoryId}`);
      return;
    }

    navigate("/admin/notifications");
  }, [navigate]);

  return (
    <div
      className={`h-full w-full overflow-y-auto px-4 pb-8 pt-20 sm:px-6 lg:px-10 md:pt-24 custom-scrollbar ${
        isDark ? "bg-slate-950/45" : "bg-slate-50/80"
      }`}
    >
      <div className={`mb-5 rounded-2xl border p-5 ${
        isDark ? "border-slate-700 bg-slate-900/80" : "border-slate-200 bg-white"
      }`}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${
              isDark ? "text-cyan-200" : "text-cyan-700"
            }`}>
              Admin Desk
            </p>
            <h1 className={`text-3xl font-bold ${isDark ? "text-slate-100" : "text-slate-900"}`}>
              Notification Center
            </h1>
            <p className={`mt-1 text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              Central view for payment approvals and inventory requests.
            </p>
          </div>

          <button
            type="button"
            onClick={() => loadNotifications(true)}
            disabled={refreshing}
            className={`h-10 rounded-lg border px-4 text-xs font-semibold inline-flex items-center gap-2 ${
              isDark
                ? "border-slate-700 bg-slate-900 text-slate-200 hover:border-cyan-300/45"
                : "border-slate-300 bg-white text-slate-700 hover:border-cyan-300"
            } disabled:opacity-60`}
          >
            {refreshing ? <Loader size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Refresh
          </button>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-2 lg:grid-cols-4">
        <div className={`rounded-xl border p-3 ${isDark ? "border-slate-700 bg-slate-900/80" : "border-slate-200 bg-white"}`}>
          <p className={`text-[10px] uppercase tracking-[0.14em] ${isDark ? "text-slate-400" : "text-slate-500"}`}>Pending Payments</p>
          <p className={`mt-1 text-2xl font-semibold ${isDark ? "text-amber-200" : "text-amber-700"}`}>{metrics.pendingLead}</p>
        </div>
        <div className={`rounded-xl border p-3 ${isDark ? "border-slate-700 bg-slate-900/80" : "border-slate-200 bg-white"}`}>
          <p className={`text-[10px] uppercase tracking-[0.14em] ${isDark ? "text-slate-400" : "text-slate-500"}`}>Approved Payments</p>
          <p className={`mt-1 text-2xl font-semibold ${isDark ? "text-emerald-200" : "text-emerald-700"}`}>{metrics.approvedLead}</p>
        </div>
        <div className={`rounded-xl border p-3 ${isDark ? "border-slate-700 bg-slate-900/80" : "border-slate-200 bg-white"}`}>
          <p className={`text-[10px] uppercase tracking-[0.14em] ${isDark ? "text-slate-400" : "text-slate-500"}`}>Rejected Payments</p>
          <p className={`mt-1 text-2xl font-semibold ${isDark ? "text-rose-200" : "text-rose-700"}`}>{metrics.rejectedLead}</p>
        </div>
        <div className={`rounded-xl border p-3 ${isDark ? "border-slate-700 bg-slate-900/80" : "border-slate-200 bg-white"}`}>
          <p className={`text-[10px] uppercase tracking-[0.14em] ${isDark ? "text-slate-400" : "text-slate-500"}`}>Inventory Pending</p>
          <p className={`mt-1 text-2xl font-semibold ${isDark ? "text-cyan-200" : "text-cyan-700"}`}>{metrics.pendingInventory}</p>
        </div>
      </div>

      <div className={`mb-5 rounded-xl border p-3 ${isDark ? "border-slate-700 bg-slate-900/75" : "border-slate-200 bg-white"}`}>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          <div className="relative md:col-span-2">
            <Search size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${isDark ? "text-slate-500" : "text-slate-400"}`} />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by lead, property, docs, executive, payment ref..."
              className={`h-10 w-full rounded-lg border pl-9 pr-3 text-sm ${
                isDark ? "border-slate-700 bg-slate-950 text-slate-200" : "border-slate-300 bg-white text-slate-700"
              }`}
            />
          </div>
          <select
            value={approvalFilter}
            onChange={(event) => setApprovalFilter(event.target.value)}
            className={`h-10 rounded-lg border px-3 text-sm ${
              isDark ? "border-slate-700 bg-slate-950 text-slate-200" : "border-slate-300 bg-white text-slate-700"
            }`}
          >
            {APPROVAL_FILTERS.map((filter) => (
              <option key={filter.value} value={filter.value}>
                {filter.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className={`mb-4 rounded-xl border px-3 py-2 text-sm ${
          isDark ? "border-rose-500/30 bg-rose-500/10 text-rose-200" : "border-rose-200 bg-rose-50 text-rose-700"
        }`}>
          {error}
        </div>
      )}
      {success && (
        <div className={`mb-4 rounded-xl border px-3 py-2 text-sm ${
          isDark ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" : "border-emerald-200 bg-emerald-50 text-emerald-700"
        }`}>
          {success}
        </div>
      )}

      <section className={`mb-5 rounded-2xl border p-4 ${
        isDark ? "border-slate-700 bg-slate-900/75" : "border-slate-200 bg-white"
      }`}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="inline-flex items-center gap-2">
            <BellRing size={16} className={isDark ? "text-cyan-300" : "text-cyan-700"} />
            <h2 className={`text-base font-semibold ${isDark ? "text-slate-100" : "text-slate-900"}`}>
              Realtime Alert Feed
            </h2>
          </div>
          <span className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
            {filteredRecentAlerts.length}
          </span>
        </div>

        {filteredRecentAlerts.length === 0 ? (
          <div className={`rounded-xl border p-3 text-sm ${
            isDark ? "border-slate-700 text-slate-400" : "border-slate-200 text-slate-500"
          }`}>
            No realtime alerts found.
          </div>
        ) : (
          <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1 custom-scrollbar">
            {filteredRecentAlerts.map((alert) => {
              const payload = alert?.payload || {};
              const source = String(alert?.source || "").toLowerCase();
              const inventoryLabel = getInventoryUnitLabel(payload?.inventory || payload?.inventoryId || {});
              const leadName = String(payload?.lead?.name || "").trim();
              const requestTag = source === "lead"
                ? "Payment Request"
                : `${String(payload?.inventoryRequestType || payload?.type || "UPDATE").toUpperCase()} Inventory Request`;

              return (
                <div key={alert.id} className={`rounded-xl border p-3 ${
                  isDark ? "border-slate-700 bg-slate-950/70" : "border-slate-200 bg-slate-50"
                }`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className={`text-sm font-semibold ${isDark ? "text-slate-100" : "text-slate-800"}`}>
                      {alert.preview || "New request received"}
                    </p>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                      isDark
                        ? "border-cyan-400/35 bg-cyan-500/10 text-cyan-200"
                        : "border-cyan-200 bg-cyan-50 text-cyan-700"
                    }`}>
                      {requestTag}
                    </span>
                  </div>

                  <div className="mt-2 grid grid-cols-1 gap-1 text-[11px] sm:grid-cols-2">
                    <div><span className={isDark ? "text-slate-400" : "text-slate-500"}>Source:</span> <span className={isDark ? "text-slate-200" : "text-slate-700"}>{source === "lead" ? "Lead" : "Inventory"}</span></div>
                    <div><span className={isDark ? "text-slate-400" : "text-slate-500"}>Received:</span> <span className={isDark ? "text-slate-200" : "text-slate-700"}>{formatDate(alert?.createdAt)}</span></div>
                    {source === "lead" ? (
                      <>
                        <div><span className={isDark ? "text-slate-400" : "text-slate-500"}>Lead:</span> <span className={isDark ? "text-slate-200" : "text-slate-700"}>{leadName || "-"}</span></div>
                        <div><span className={isDark ? "text-slate-400" : "text-slate-500"}>Phone:</span> <span className={isDark ? "text-slate-200" : "text-slate-700"}>{payload?.lead?.phone || "-"}</span></div>
                        <div><span className={isDark ? "text-slate-400" : "text-slate-500"}>Project:</span> <span className={isDark ? "text-slate-200" : "text-slate-700"}>{payload?.lead?.projectInterested || "-"}</span></div>
                        <div><span className={isDark ? "text-slate-400" : "text-slate-500"}>Mode/Type:</span> <span className={isDark ? "text-slate-200" : "text-slate-700"}>{formatPaymentMode(payload?.payment?.mode)} / {formatPaymentType(payload?.payment?.paymentType)}</span></div>
                        <div className="sm:col-span-2"><span className={isDark ? "text-slate-400" : "text-slate-500"}>Reference:</span> <span className={isDark ? "text-slate-200" : "text-slate-700"}>{payload?.payment?.paymentReference || "-"}</span></div>
                      </>
                    ) : (
                      <>
                        <div><span className={isDark ? "text-slate-400" : "text-slate-500"}>Request Id:</span> <span className={isDark ? "text-slate-200" : "text-slate-700"}>{payload?.requestId || alert?.requestId || "-"}</span></div>
                        <div><span className={isDark ? "text-slate-400" : "text-slate-500"}>Inventory:</span> <span className={isDark ? "text-slate-200" : "text-slate-700"}>{inventoryLabel || "-"}</span></div>
                        <div><span className={isDark ? "text-slate-400" : "text-slate-500"}>Requested By:</span> <span className={isDark ? "text-slate-200" : "text-slate-700"}>{payload?.requestedBy?.name || "-"}</span></div>
                        <div><span className={isDark ? "text-slate-400" : "text-slate-500"}>Type:</span> <span className={isDark ? "text-slate-200" : "text-slate-700"}>{String(payload?.inventoryRequestType || payload?.type || "-").toUpperCase()}</span></div>
                      </>
                    )}
                  </div>

                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleOpenAlertTarget(alert)}
                      className={`h-7 rounded-lg border px-2 text-[10px] font-semibold ${
                        isDark
                          ? "border-slate-600 bg-slate-900 text-slate-200 hover:border-cyan-300/40"
                          : "border-slate-300 bg-white text-slate-700 hover:border-cyan-300"
                      }`}
                    >
                      Open Request
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <section className={`rounded-2xl border p-4 ${
          isDark ? "border-slate-700 bg-slate-900/75" : "border-slate-200 bg-white"
        }`}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="inline-flex items-center gap-2">
              <CircleDollarSign size={16} className={isDark ? "text-amber-300" : "text-amber-700"} />
              <h2 className={`text-base font-semibold ${isDark ? "text-slate-100" : "text-slate-900"}`}>
                Lead Payment Requests
              </h2>
            </div>
            <span className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              {filteredLeadRequests.length}
            </span>
          </div>

          {loading ? (
            <div className={`h-28 flex items-center justify-center gap-2 text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              <Loader size={14} className="animate-spin" />
              Loading payment requests...
            </div>
          ) : filteredLeadRequests.length === 0 ? (
            <div className={`rounded-xl border p-3 text-sm ${isDark ? "border-slate-700 text-slate-400" : "border-slate-200 text-slate-500"}`}>
              No payment requests found for current filter.
            </div>
          ) : (
            <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1 custom-scrollbar">
              {filteredLeadRequests.map((lead) => {
                const approvalStatus = String(lead?.dealPayment?.approvalStatus || "PENDING").toUpperCase();
                const isPendingApproval = approvalStatus === "PENDING";
                const isReviewingLead = reviewingLeadId === String(lead?._id || "");
                const closureDocuments = Array.isArray(lead?.closureDocuments) ? lead.closureDocuments : [];
                const propertyRows = getLeadPropertyRows(lead);
                const soldProperties = propertyRows.filter((inventoryLike) =>
                  isSoldInventoryStatus(inventoryLike?.status));
                const primaryProperty = propertyRows[0] || null;
                const executiveDetails = [
                  { label: "Assigned To", user: lead?.assignedTo },
                  { label: "Manager", user: lead?.assignedManager },
                  { label: "Executive", user: lead?.assignedExecutive },
                  { label: "Field Executive", user: lead?.assignedFieldExecutive },
                  { label: "Created By", user: lead?.createdBy },
                ];
                return (
                  <div key={lead._id} className={`rounded-xl border p-3 ${
                    isDark ? "border-slate-700 bg-slate-950/70" : "border-slate-200 bg-slate-50"
                  }`}>
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div>
                        <p className={`text-sm font-semibold ${isDark ? "text-slate-100" : "text-slate-800"}`}>
                          {lead.name || "Lead"}
                        </p>
                        <p className={`text-[11px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                          {lead.phone || "-"} | {lead.projectInterested || "-"}
                        </p>
                      </div>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${getApprovalTone(approvalStatus, isDark)}`}>
                        {approvalStatus}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div><span className={isDark ? "text-slate-400" : "text-slate-500"}>Lead Status:</span> <span className={isDark ? "text-slate-200" : "text-slate-700"}>{lead.status || "-"}</span></div>
                      <div><span className={isDark ? "text-slate-400" : "text-slate-500"}>Mode:</span> <span className={isDark ? "text-slate-200" : "text-slate-700"}>{formatPaymentMode(lead?.dealPayment?.mode)}</span></div>
                      <div><span className={isDark ? "text-slate-400" : "text-slate-500"}>Type:</span> <span className={isDark ? "text-slate-200" : "text-slate-700"}>{formatPaymentType(lead?.dealPayment?.paymentType)}</span></div>
                      <div><span className={isDark ? "text-slate-400" : "text-slate-500"}>Remaining:</span> <span className={isDark ? "text-slate-200" : "text-slate-700"}>{formatAmount(lead?.dealPayment?.remainingAmount)}</span></div>
                      <div className="col-span-2"><span className={isDark ? "text-slate-400" : "text-slate-500"}>Reference:</span> <span className={isDark ? "text-slate-200" : "text-slate-700"}>{lead?.dealPayment?.paymentReference || "-"}</span></div>
                      <div className="col-span-2"><span className={isDark ? "text-slate-400" : "text-slate-500"}>Requested By:</span> <span className={isDark ? "text-slate-200" : "text-slate-700"}>{lead?.dealPayment?.approvalRequestedBy?.name || "-"}</span></div>
                      <div className="col-span-2"><span className={isDark ? "text-slate-400" : "text-slate-500"}>Admin Note:</span> <span className={isDark ? "text-slate-200" : "text-slate-700"}>{lead?.dealPayment?.approvalNote || "-"}</span></div>
                    </div>

                    <div className={`mt-2 rounded-lg border p-2 ${
                      isDark ? "border-slate-700 bg-slate-900/65" : "border-slate-200 bg-white"
                    }`}>
                      <div className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                        isDark ? "text-slate-400" : "text-slate-500"
                      }`}>
                        <Building2 size={11} />
                        Sold Property Details
                      </div>
                      <div className="mt-1 space-y-1 text-[11px]">
                        <div>
                          <span className={isDark ? "text-slate-400" : "text-slate-500"}>Primary Property:</span>{" "}
                          <span className={isDark ? "text-slate-200" : "text-slate-700"}>
                            {primaryProperty ? getInventoryUnitLabel(primaryProperty) || "-" : "-"}
                          </span>
                        </div>
                        <div>
                          <span className={isDark ? "text-slate-400" : "text-slate-500"}>Primary Status:</span>{" "}
                          <span className={isDark ? "text-slate-200" : "text-slate-700"}>
                            {formatInventoryStatusLabel(primaryProperty?.status)}
                          </span>
                        </div>
                        <div>
                          <span className={isDark ? "text-slate-400" : "text-slate-500"}>Sold Properties:</span>{" "}
                          <span className={isDark ? "text-slate-200" : "text-slate-700"}>
                            {soldProperties.length}
                          </span>
                        </div>
                        {soldProperties.length > 0 ? (
                          <div className="space-y-1">
                            {soldProperties.map((inventoryLike) => (
                              <div
                                key={toObjectIdString(inventoryLike)}
                                className={`rounded border px-2 py-1 ${
                                  isDark ? "border-slate-700 bg-slate-950/70" : "border-slate-200 bg-slate-50"
                                }`}
                              >
                                <div className={isDark ? "text-slate-100" : "text-slate-800"}>
                                  {getInventoryUnitLabel(inventoryLike) || "-"}
                                </div>
                                <div className={isDark ? "text-slate-400" : "text-slate-500"}>
                                  {inventoryLike?.location || "-"} | {formatAmount(inventoryLike?.price)}
                                </div>
                                <div className={isDark ? "text-slate-400" : "text-slate-500"}>
                                  {Array.isArray(inventoryLike?.images) ? inventoryLike.images.length : 0} images
                                  {" | "}
                                  {Array.isArray(inventoryLike?.documents) ? inventoryLike.documents.length : 0} docs
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className={`mt-2 rounded-lg border p-2 ${
                      isDark ? "border-slate-700 bg-slate-900/65" : "border-slate-200 bg-white"
                    }`}>
                      <div className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                        isDark ? "text-slate-400" : "text-slate-500"
                      }`}>
                        <UserRound size={11} />
                        Executive Details
                      </div>
                      <div className="mt-1 grid grid-cols-1 gap-1 text-[11px] sm:grid-cols-2">
                        {executiveDetails.map((detail) => (
                          <div
                            key={`${lead._id}:${detail.label}`}
                            className={`rounded border px-2 py-1 ${
                              isDark ? "border-slate-700 bg-slate-950/70" : "border-slate-200 bg-slate-50"
                            }`}
                          >
                            <div>
                              <span className={isDark ? "text-slate-400" : "text-slate-500"}>{detail.label}:</span>{" "}
                              <span className={isDark ? "text-slate-200" : "text-slate-700"}>
                                {formatUserWithRole(detail.user)}
                              </span>
                            </div>
                            <div className={isDark ? "text-slate-400" : "text-slate-500"}>
                              Phone: {getUserContactField(detail.user, "phone") || "-"}
                            </div>
                            <div className={isDark ? "text-slate-400" : "text-slate-500"}>
                              Email: {getUserContactField(detail.user, "email") || "-"}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className={`mt-2 rounded-lg border p-2 ${
                      isDark ? "border-slate-700 bg-slate-900/65" : "border-slate-200 bg-white"
                    }`}>
                      <div className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                        isDark ? "text-slate-400" : "text-slate-500"
                      }`}>
                        <FileText size={11} />
                        Submitted Documents ({closureDocuments.length})
                      </div>
                      {closureDocuments.length === 0 ? (
                        <div className={`mt-1 text-[11px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                          No documents submitted yet.
                        </div>
                      ) : (
                        <div className="mt-1 space-y-1">
                          {closureDocuments.map((doc, index) => (
                            <a
                              key={`${lead._id}:${doc?.url || index}`}
                              href={doc?.url || "#"}
                              target="_blank"
                              rel="noreferrer"
                              className={`block rounded border px-2 py-1 text-[11px] ${
                                isDark
                                  ? "border-slate-700 bg-slate-950/70 text-cyan-200 hover:border-cyan-300/40"
                                  : "border-slate-200 bg-slate-50 text-cyan-700 hover:border-cyan-300"
                              }`}
                            >
                              <div className="font-semibold">
                                {doc?.name || `Document ${index + 1}`}
                              </div>
                              <div className={isDark ? "text-slate-400" : "text-slate-500"}>
                                {String(doc?.kind || "file").toUpperCase()} | {formatDate(doc?.uploadedAt)}
                              </div>
                              <div className={isDark ? "text-slate-400" : "text-slate-500"}>
                                Uploaded By: {formatUserWithRole(doc?.uploadedBy)}
                              </div>
                            </a>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <div className={`inline-flex items-center gap-1 text-[10px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                        <Clock3 size={11} />
                        {formatDate(lead?.dealPayment?.approvalRequestedAt || lead?.updatedAt)}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {isPendingApproval ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleApproveLeadRequest(lead)}
                              disabled={isReviewingLead}
                              className={`h-7 rounded-lg border px-2 text-[10px] font-semibold inline-flex items-center gap-1 ${
                                isDark
                                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200 hover:border-emerald-300/55"
                                  : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300"
                              } disabled:opacity-60`}
                            >
                              {isReviewingLead ? <Loader size={11} className="animate-spin" /> : <CheckCircle2 size={11} />}
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRejectLeadRequest(lead)}
                              disabled={isReviewingLead}
                              className={`h-7 rounded-lg border px-2 text-[10px] font-semibold inline-flex items-center gap-1 ${
                                isDark
                                  ? "border-rose-500/40 bg-rose-500/10 text-rose-200 hover:border-rose-300/55"
                                  : "border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-300"
                              } disabled:opacity-60`}
                            >
                              <XCircle size={11} />
                              Reject
                            </button>
                          </>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => navigate("/leads")}
                          className={`h-7 rounded-lg border px-2 text-[10px] font-semibold ${
                            isDark
                              ? "border-slate-600 bg-slate-900 text-slate-200 hover:border-cyan-300/40"
                              : "border-slate-300 bg-white text-slate-700 hover:border-cyan-300"
                          }`}
                        >
                          Open Lead Matrix
                        </button>
                        <button
                          type="button"
                          onClick={() => navigate(`/leads/${lead._id}`)}
                          className={`h-7 rounded-lg border px-2 text-[10px] font-semibold ${
                            isDark
                              ? "border-slate-600 bg-slate-900 text-slate-200 hover:border-cyan-300/40"
                              : "border-slate-300 bg-white text-slate-700 hover:border-cyan-300"
                          }`}
                        >
                          Open Lead Details
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className={`rounded-2xl border p-4 ${
          isDark ? "border-slate-700 bg-slate-900/75" : "border-slate-200 bg-white"
        }`}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="inline-flex items-center gap-2">
              <Building2 size={16} className={isDark ? "text-cyan-300" : "text-cyan-700"} />
              <h2 className={`text-base font-semibold ${isDark ? "text-slate-100" : "text-slate-900"}`}>
                Inventory Requests
              </h2>
            </div>
            <span className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              {filteredInventoryRequests.length}
            </span>
          </div>

          {loading ? (
            <div className={`h-28 flex items-center justify-center gap-2 text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              <Loader size={14} className="animate-spin" />
              Loading inventory requests...
            </div>
          ) : filteredInventoryRequests.length === 0 ? (
            <div className={`rounded-xl border p-3 text-sm ${isDark ? "border-slate-700 text-slate-400" : "border-slate-200 text-slate-500"}`}>
              No pending inventory requests found.
            </div>
          ) : (
            <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1 custom-scrollbar">
              {filteredInventoryRequests.map((request) => {
                const inventoryId = String(request?.inventoryId?._id || "");
                const requestId = String(request?._id || "");
                const requestType = String(request?.type || "").toUpperCase();
                const requestedByName = request?.requestedBy?.name || "-";
                const requestedByRole = request?.requestedBy?.role || "-";
                const isReviewingInventory = reviewingInventoryRequestId === requestId;
                const isCreateRequest = String(request?.type || "").toLowerCase() === "create";
                const proposedData = request?.proposedData || {};
                const currentInventory = request?.inventoryId || {};
                const currentStatusLabel = formatInventoryStatusLabel(currentInventory?.status);
                const requestedStatusLabel = formatInventoryStatusLabel(proposedData?.status || currentInventory?.status || "Available");
                const requestedFields = !isCreateRequest
                  ? Object.entries(proposedData).filter(([key]) => REQUEST_FIELD_LABELS[key])
                  : [];
                const detailSource = isCreateRequest ? proposedData : currentInventory;
                const detailImages = Array.isArray(detailSource?.images) ? detailSource.images : [];
                const detailDocs = Array.isArray(detailSource?.documents) ? detailSource.documents : [];
                const inventoryLabel = [
                  request?.inventoryId?.projectName,
                  request?.inventoryId?.towerName,
                  request?.inventoryId?.unitNumber,
                ]
                  .map((value) => String(value || "").trim())
                  .filter(Boolean)
                  .join(" - ");

                return (
                  <div key={request._id} className={`rounded-xl border p-3 ${
                    isDark ? "border-slate-700 bg-slate-950/70" : "border-slate-200 bg-slate-50"
                  }`}>
                    <div className="mb-2 flex items-start justify-between">
                      <div>
                        <p className={`text-sm font-semibold ${isDark ? "text-slate-100" : "text-slate-800"}`}>
                          {requestType || "UPDATE"} request
                        </p>
                        <p className={`text-[11px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                          {requestedByName} ({requestedByRole})
                        </p>
                      </div>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] ${
                        isDark
                          ? "border-cyan-400/35 bg-cyan-500/10 text-cyan-200"
                          : "border-cyan-200 bg-cyan-50 text-cyan-700"
                      }`}>
                        PENDING
                      </span>
                    </div>

                    <div className="space-y-1 text-[11px]">
                      <div><span className={isDark ? "text-slate-400" : "text-slate-500"}>Inventory:</span> <span className={isDark ? "text-slate-200" : "text-slate-700"}>{inventoryLabel || getInventoryUnitLabel(proposedData) || "New inventory create request"}</span></div>
                      <div><span className={isDark ? "text-slate-400" : "text-slate-500"}>Team:</span> <span className={isDark ? "text-slate-200" : "text-slate-700"}>{request?.teamId?.name || "-"}</span></div>
                      <div><span className={isDark ? "text-slate-400" : "text-slate-500"}>Requested At:</span> <span className={isDark ? "text-slate-200" : "text-slate-700"}>{formatDate(request?.createdAt)}</span></div>
                      <div><span className={isDark ? "text-slate-400" : "text-slate-500"}>Status Move:</span> <span className={isDark ? "text-slate-200" : "text-slate-700"}>{isCreateRequest ? requestedStatusLabel : `${currentStatusLabel} -> ${requestedStatusLabel}`}</span></div>
                      <div><span className={isDark ? "text-slate-400" : "text-slate-500"}>Location:</span> <span className={isDark ? "text-slate-200" : "text-slate-700"}>{detailSource?.location || "-"}</span></div>
                      <div><span className={isDark ? "text-slate-400" : "text-slate-500"}>Coordinates:</span> <span className={isDark ? "text-slate-200" : "text-slate-700"}>{formatCoordinates(detailSource?.siteLocation)}</span></div>
                      <div><span className={isDark ? "text-slate-400" : "text-slate-500"}>Price:</span> <span className={isDark ? "text-slate-200" : "text-slate-700"}>{formatAmount(detailSource?.price)}</span></div>
                      <div><span className={isDark ? "text-slate-400" : "text-slate-500"}>Media:</span> <span className={isDark ? "text-slate-200" : "text-slate-700"}>{detailImages.length} images, {detailDocs.length} docs</span></div>
                      {String(requestedStatusLabel || "").toLowerCase() === "sold" && detailSource?.saleDetails ? (
                        <div className="col-span-2"><span className={isDark ? "text-slate-400" : "text-slate-500"}>Sold Details:</span> <span className={isDark ? "text-slate-200" : "text-slate-700"}>{formatRequestValue("saleDetails", detailSource?.saleDetails)}</span></div>
                      ) : null}
                    </div>

                    {!isCreateRequest && requestedFields.length > 0 ? (
                      <div className={`mt-2 rounded-lg border p-2 ${
                        isDark ? "border-slate-700 bg-slate-900/70" : "border-slate-200 bg-white"
                      }`}>
                        <p className={`text-[10px] font-semibold uppercase tracking-[0.12em] ${
                          isDark ? "text-slate-400" : "text-slate-500"
                        }`}>
                          Requested Changes
                        </p>
                        <div className="mt-1 grid grid-cols-1 gap-1 text-[11px] sm:grid-cols-2">
                          {requestedFields.map(([key, value]) => (
                            <p key={`${requestId}:${key}`}>
                              <span className={isDark ? "text-slate-400" : "text-slate-500"}>{REQUEST_FIELD_LABELS[key] || key}:</span>{" "}
                              <span className={isDark ? "text-slate-200" : "text-slate-700"}>{formatRequestValue(key, value)}</span>
                            </p>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleApproveInventoryRequest(requestId)}
                        disabled={isReviewingInventory}
                        className={`h-7 rounded-lg border px-2 text-[10px] font-semibold inline-flex items-center gap-1 ${
                          isDark
                            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200 hover:border-emerald-300/55"
                            : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300"
                        } disabled:opacity-60`}
                      >
                        {isReviewingInventory ? <Loader size={11} className="animate-spin" /> : <CheckCircle2 size={11} />}
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRejectInventoryRequest(requestId)}
                        disabled={isReviewingInventory}
                        className={`h-7 rounded-lg border px-2 text-[10px] font-semibold inline-flex items-center gap-1 ${
                          isDark
                            ? "border-rose-500/40 bg-rose-500/10 text-rose-200 hover:border-rose-300/55"
                            : "border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-300"
                        } disabled:opacity-60`}
                      >
                        <XCircle size={11} />
                        Reject
                      </button>
                      {inventoryId ? (
                        <button
                          type="button"
                          onClick={() => navigate(`/inventory/${inventoryId}`)}
                          className={`h-7 rounded-lg border px-2 text-[10px] font-semibold ${
                            isDark
                              ? "border-slate-600 bg-slate-900 text-slate-200 hover:border-cyan-300/40"
                              : "border-slate-300 bg-white text-slate-700 hover:border-cyan-300"
                          }`}
                        >
                          Open Inventory
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {!loading && !error && (
        <div className={`mt-5 rounded-xl border px-3 py-2 text-xs ${
          isDark ? "border-slate-700 bg-slate-900/70 text-slate-400" : "border-slate-200 bg-white text-slate-500"
        }`}>
          <span className="inline-flex items-center gap-1">
            <BellRing size={12} />
            All requests are visible on this alert page with detailed context.
          </span>
          {recentAdminRequests.length > 0 ? (
            <span className={`mt-2 inline-flex items-center gap-1 ${isDark ? "text-cyan-300" : "text-cyan-700"}`}>
              <Clock3 size={12} />
              Realtime alerts captured: {recentAdminRequests.length}
            </span>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default AdminNotifications;
