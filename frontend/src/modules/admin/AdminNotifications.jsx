import React, { useCallback, useEffect, useMemo, useState } from "react";
import "./notifications.css";
import { useNavigate } from "react-router-dom";
import {
  BellRing,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  ExternalLink,
  FileText,
  Filter,
  IndianRupee,
  Loader,
  Mail,
  Package,
  Radio,
  RefreshCw,
  Search,
  Settings as SettingsIcon,
  UserRound,
  Users,
  XCircle,
} from "lucide-react";
import { getLeadPaymentRequests, updateLeadStatus } from "../../services/leadService";
import {
  getAdminUserDeleteRequests,
  reviewUserDeleteRequest,
} from "../../services/userService";
import {
  approveInventoryRequest,
  getPendingInventoryRequests,
  rejectInventoryRequest,
} from "../../services/inventoryService";
import { toErrorMessage } from "../../utils/errorMessage";
import { useChatNotifications } from "../../context/useChatNotifications";
import ToastNotice from "../../components/ui/ToastNotice";

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
  return `₹${parsed.toLocaleString("en-IN")}`;
};

const READ_STORAGE_KEY = "adminNotificationsReadIds";

const INBOX_TABS = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "payments", label: "Payments" },
  { id: "inventory", label: "Inventory" },
  { id: "system", label: "System" },
];

const DATE_FILTERS = [
  { value: "ALL", label: "All Dates" },
  { value: "TODAY", label: "Today" },
  { value: "WEEK", label: "Last 7 days" },
  { value: "MONTH", label: "Last 30 days" },
];

const formatWhen = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const time = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === now.toDateString()) return `Today, ${time}`;
  if (date.toDateString() === yesterday.toDateString()) return `Yesterday, ${time}`;
  return `${date.toLocaleDateString([], { day: "numeric", month: "short" })}, ${time}`;
};

const withinDateFilter = (value, filter) => {
  if (filter === "ALL") return true;
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  if (filter === "TODAY") return date.toDateString() === now.toDateString();
  const days = filter === "WEEK" ? 7 : 30;
  return now.getTime() - date.getTime() <= days * 24 * 60 * 60 * 1000;
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
  [inventoryLike?.projectName, inventoryLike?.towerName, inventoryLike?.unitNumber]
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
  const userRole = String(localStorage.getItem("role") || "").trim().toUpperCase();
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
  const [userDeleteRequests, setUserDeleteRequests] = useState([]);
  const [inboxTab, setInboxTab] = useState("all");
  const [dateFilter, setDateFilter] = useState("ALL");
  const [showInboxFilters, setShowInboxFilters] = useState(true);
  const [selectedId, setSelectedId] = useState("");
  const [readIds, setReadIds] = useState(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(READ_STORAGE_KEY) || "[]");
      return new Set(Array.isArray(raw) ? raw : []);
    } catch {
      return new Set();
    }
  });
  const [reviewingLeadId, setReviewingLeadId] = useState("");
  const [reviewingInventoryRequestId, setReviewingInventoryRequestId] = useState("");
  const [reviewingUserDeleteRequestId, setReviewingUserDeleteRequestId] = useState("");
  const loadNotifications = useCallback(async (asRefresh = false) => {
    try {
      if (asRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError("");
      setSuccess("");

      const [leadResult, inventoryResult, userDeleteResult] = await Promise.allSettled([
        getLeadPaymentRequests({
          approvalStatus: approvalFilter,
          limit: 300,
        }),
        getPendingInventoryRequests(),
        userRole === "ADMIN"
          ? getAdminUserDeleteRequests({ status: "PENDING" })
          : Promise.resolve([]),
      ]);

      if (leadResult.status === "fulfilled") {
        setLeadRequests(Array.isArray(leadResult.value) ? leadResult.value : []);
      } else {
        setLeadRequests([]);
      }

      if (inventoryResult.status === "fulfilled") {
        setInventoryRequests(Array.isArray(inventoryResult.value) ? inventoryResult.value : []);
      } else {
        setInventoryRequests([]);
      }

      if (userDeleteResult.status === "fulfilled") {
        setUserDeleteRequests(Array.isArray(userDeleteResult.value) ? userDeleteResult.value : []);
      } else {
        setUserDeleteRequests([]);
      }
    } catch (fetchError) {
      const message = toErrorMessage(fetchError, "Failed to load notifications");
      setError(message);
      setLeadRequests([]);
      setInventoryRequests([]);
      setUserDeleteRequests([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [approvalFilter, userRole]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    markAdminRequestsRead();
  }, [markAdminRequestsRead]);

  useEffect(() => {
    if (!adminRequestPulseAt) return;
    const timerId = window.setTimeout(() => {
      loadNotifications(true);
      markAdminRequestsRead();
    }, 700);
    return () => window.clearTimeout(timerId);
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

  const filteredUserDeleteRequests = useMemo(() => {
    if (!normalizedQuery) return userDeleteRequests;

    return userDeleteRequests.filter((request) => {
      const target = request?.targetUser || request?.snapshot || {};
      const requestedBy = request?.requestedBy || {};
      const searchableText = [
        target?.name,
        target?.email,
        target?.phone,
        target?.role,
        request?.snapshot?.name,
        request?.snapshot?.email,
        request?.snapshot?.role,
        requestedBy?.name,
        requestedBy?.email,
        request?.reason,
      ]
        .join(" ")
        .toLowerCase();
      return searchableText.includes(normalizedQuery);
    });
  }, [normalizedQuery, userDeleteRequests]);

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
      pendingUserDelete: userDeleteRequests.length,
    };
  }, [leadRequests, inventoryRequests.length, userDeleteRequests.length]);

  const persistReadIds = useCallback((nextSet) => {
    setReadIds(nextSet);
    try {
      localStorage.setItem(READ_STORAGE_KEY, JSON.stringify([...nextSet]));
    } catch {
      /* storage unavailable - read state stays in memory only */
    }
  }, []);

  // Every request type folded into one inbox feed, newest first
  const inboxItems = useMemo(() => {
    const items = [];

    filteredLeadRequests.forEach((lead) => {
      const status = String(lead?.dealPayment?.approvalStatus || "PENDING").toUpperCase();
      const propertyRows = getLeadPropertyRows(lead);
      const property = propertyRows[0] || null;
      const title = status === "APPROVED"
        ? "Lead payment approved"
        : status === "REJECTED"
          ? "Lead payment rejected"
          : "Lead payment approval requested";
      items.push({
        id: `payment:${toObjectIdString(lead?._id)}`,
        category: "payments",
        status,
        icon: IndianRupee,
        title,
        subtitle: lead?.name || "Lead",
        context: property ? getInventoryUnitLabel(property) : (lead?.projectInterested || "-"),
        meta: [
          formatAmount(property?.price),
          formatPaymentType(lead?.dealPayment?.paymentType),
          formatPaymentMode(lead?.dealPayment?.mode),
        ].filter((value) => value && value !== "-").join(" · "),
        at: lead?.dealPayment?.approvalReviewedAt || lead?.dealPayment?.approvalRequestedAt || lead?.updatedAt,
        lead,
        property,
        propertyRows,
        soldCount: propertyRows.filter((row) => isSoldInventoryStatus(row?.status)).length,
      });
    });

    filteredInventoryRequests.forEach((request) => {
      const requestId = toObjectIdString(request?._id || request?.id);
      const label = getInventoryUnitLabel(request?.inventoryId)
        || getInventoryUnitLabel(request?.proposedData)
        || "New inventory";
      items.push({
        id: `inventory:${requestId}`,
        category: "inventory",
        status: "PENDING",
        icon: Building2,
        title: `${String(request?.type || "UPDATE").toUpperCase()} inventory request`,
        subtitle: request?.requestedBy?.name || "-",
        context: label,
        meta: [request?.teamId?.name, formatAmount(request?.proposedData?.price ?? request?.inventoryId?.price)]
          .filter((value) => value && value !== "-").join(" · "),
        at: request?.createdAt,
        request,
        requestId,
      });
    });

    filteredUserDeleteRequests.forEach((request) => {
      const requestId = toObjectIdString(request?._id || request?.id);
      const target = request?.targetUser || request?.snapshot || {};
      items.push({
        id: `account:${requestId}`,
        category: "system",
        status: "PENDING",
        icon: UserRound,
        title: `Delete ${target?.name || "user"} request`,
        subtitle: request?.requestedBy?.name || "-",
        context: [target?.role, target?.email].filter(Boolean).join(" · ") || "-",
        meta: request?.reason || "",
        at: request?.createdAt,
        request,
        requestId,
        target,
      });
    });

    filteredRecentAlerts.forEach((alert, index) => {
      items.push({
        id: `alert:${alert?.id || index}`,
        category: "system",
        status: "ALERT",
        icon: BellRing,
        title: alert?.preview || "Realtime alert",
        subtitle: String(alert?.source || "Realtime").toUpperCase(),
        context: String(alert?.requestType || "-"),
        meta: "",
        at: alert?.createdAt,
        alert,
      });
    });

    return items.sort((x, y) => new Date(y.at || 0).getTime() - new Date(x.at || 0).getTime());
  }, [filteredLeadRequests, filteredInventoryRequests, filteredUserDeleteRequests, filteredRecentAlerts]);

  const dateFilteredItems = useMemo(
    () => inboxItems.filter((item) => withinDateFilter(item.at, dateFilter)),
    [inboxItems, dateFilter],
  );

  const tabCounts = useMemo(() => ({
    all: dateFilteredItems.length,
    unread: dateFilteredItems.filter((item) => !readIds.has(item.id)).length,
    payments: dateFilteredItems.filter((item) => item.category === "payments").length,
    inventory: dateFilteredItems.filter((item) => item.category === "inventory").length,
    system: dateFilteredItems.filter((item) => item.category === "system").length,
  }), [dateFilteredItems, readIds]);

  const visibleItems = useMemo(() => {
    if (inboxTab === "unread") return dateFilteredItems.filter((item) => !readIds.has(item.id));
    if (inboxTab === "all") return dateFilteredItems;
    return dateFilteredItems.filter((item) => item.category === inboxTab);
  }, [dateFilteredItems, inboxTab, readIds]);

  const selectedItem = useMemo(
    () => visibleItems.find((item) => item.id === selectedId) || visibleItems[0] || null,
    [visibleItems, selectedId],
  );

  const handleSelectItem = useCallback((item) => {
    setSelectedId(item.id);
    if (!readIds.has(item.id)) {
      const next = new Set(readIds);
      next.add(item.id);
      persistReadIds(next);
    }
  }, [readIds, persistReadIds]);

  const handleMarkAllRead = useCallback(() => {
    persistReadIds(new Set(inboxItems.map((item) => item.id)));
    markAdminRequestsRead();
    setSuccess("All notifications marked as read");
  }, [inboxItems, markAdminRequestsRead, persistReadIds]);

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

  const handleApproveUserDeleteRequest = useCallback(async (requestId) => {
    const resolvedId = String(requestId || "");
    if (!resolvedId) return;

    try {
      setReviewingUserDeleteRequestId(resolvedId);
      setError("");
      setSuccess("");
      await reviewUserDeleteRequest(resolvedId, {
        action: "APPROVED",
        reviewNote: "Approved from notifications",
      });
      setSuccess("User delete request approved and user deleted");
      await loadNotifications(true);
    } catch (reviewError) {
      setError(toErrorMessage(reviewError, "Failed to approve user delete request"));
    } finally {
      setReviewingUserDeleteRequestId("");
    }
  }, [loadNotifications]);

  const handleRejectUserDeleteRequest = useCallback(async (requestId) => {
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
      setReviewingUserDeleteRequestId(resolvedId);
      setError("");
      setSuccess("");
      await reviewUserDeleteRequest(resolvedId, {
        action: "REJECTED",
        reviewNote: trimmedReason,
      });
      setSuccess("User delete request rejected");
      await loadNotifications(true);
    } catch (reviewError) {
      setError(toErrorMessage(reviewError, "Failed to reject user delete request"));
    } finally {
      setReviewingUserDeleteRequestId("");
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

  const cardCls = isDark ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white";
  const innerCardCls = isDark ? "border-slate-800 bg-slate-950/40" : "border-slate-200 bg-white";
  const mutedCls = isDark ? "text-slate-400" : "text-slate-500";
  const titleCls = isDark ? "text-slate-100" : "text-slate-900";
  const chipCls = isDark ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-600";
  const inputCls = isDark
    ? "border-slate-700 bg-slate-950 text-slate-200 placeholder:text-slate-500"
    : "border-slate-200 bg-white text-slate-700 placeholder:text-slate-400";
  const btnCls = isDark
    ? "border-slate-700 bg-slate-900 text-slate-200 hover:border-slate-600"
    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300";
  const accentCls = isDark
    ? "border-sky-500/40 bg-sky-500/10 text-sky-300"
    : "border-sky-500 bg-sky-50 text-sky-700";

  const renderFieldGrid = (leftRows, rightRows) => (
    <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
      {[leftRows, rightRows].map((rows, columnIndex) => (
        <div
          key={columnIndex}
          className={`grid grid-cols-[104px_minmax(0,1fr)] gap-x-3 gap-y-2 ${
            columnIndex === 1 ? (isDark ? "sm:border-l sm:border-white/5 sm:pl-8" : "sm:border-l sm:border-slate-100 sm:pl-8") : ""
          }`}
        >
          {rows.filter(Boolean).map(([label, value]) => (
            <React.Fragment key={label}>
              <span className={`text-xs ${mutedCls}`}>{label}</span>
              <span className={`min-w-0 break-words text-xs font-semibold ${titleCls}`}>{value}</span>
            </React.Fragment>
          ))}
        </div>
      ))}
    </div>
  );

  const renderSection = (Icon, title, body) => (
    <div className={`rounded-2xl border p-4 ${innerCardCls}`}>
      <div className="mb-3 flex items-center gap-2">
        <Icon size={16} className={mutedCls} />
        <p className={`text-sm font-black ${titleCls}`}>{title}</p>
      </div>
      {body}
    </div>
  );

  const renderTimeline = (rows) => (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.label} className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
            row.done ? "bg-emerald-500 text-white" : (isDark ? "bg-slate-800 text-slate-600" : "bg-slate-200 text-slate-400")
          }`}>
            <Check size={12} />
          </span>
          <span className={`w-20 shrink-0 text-xs font-bold ${titleCls}`}>{row.label}</span>
          <span className={`min-w-0 flex-1 text-xs ${mutedCls}`}>{row.text}</span>
          <span className={`shrink-0 text-xs ${mutedCls}`}>{row.at ? formatWhen(row.at) : "-"}</span>
        </div>
      ))}
    </div>
  );

  const renderPanelHeader = (Icon, tone, title, subtitle, statusBadge, actions) => (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${tone}`}>
          <Icon size={20} />
        </span>
        <div className="min-w-0">
          <p className={`truncate text-lg font-black ${titleCls}`}>{title}</p>
          <p className={`truncate text-xs ${mutedCls}`}>{subtitle}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {statusBadge}
        {actions}
      </div>
    </div>
  );

  return (
    <div className={`notifications-page ui-page-shell scrollbar-hide ${isDark ? "bg-slate-950/45" : "bg-slate-50/80"}`}>
      <ToastNotice message={error} type="error" />
      <ToastNotice message={success} type="success" />

      {/* Page header */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className={`text-2xl font-black tracking-tight sm:text-3xl ${titleCls}`}>Notifications</h1>
          <p className={`mt-1 text-sm ${mutedCls}`}>Review alerts, payment approvals and inventory requests</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[180px] flex-1 sm:max-w-[260px]">
            <Search size={16} className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 ${mutedCls}`} />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Search notifications"
              placeholder="Search notifications..."
              className={`h-10 w-full rounded-xl border pl-9 pr-3 text-sm ${inputCls}`}
            />
          </div>
          <button
            type="button"
            onClick={handleMarkAllRead}
            className={`flex h-10 shrink-0 items-center gap-2 rounded-xl border px-3.5 text-sm font-semibold ${
              isDark ? "border-sky-500/40 bg-sky-500/10 text-sky-300" : "border-sky-200 bg-white text-sky-700 hover:border-sky-300"
            }`}
          >
            <Check size={16} /> Mark all as read
          </button>
          <button
            type="button"
            onClick={() => setShowInboxFilters((value) => !value)}
            aria-pressed={showInboxFilters}
            className={`flex h-10 shrink-0 items-center gap-2 rounded-xl border px-3.5 text-sm font-semibold ${
              showInboxFilters ? accentCls : btnCls
            }`}
          >
            <Filter size={16} /> Filter
          </button>
          <button
            type="button"
            onClick={() => navigate("/settings")}
            title="Settings"
            aria-label="Settings"
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${btnCls}`}
          >
            <SettingsIcon size={16} />
          </button>
          <button
            type="button"
            onClick={() => loadNotifications(true)}
            disabled={refreshing}
            title="Refresh"
            aria-label="Refresh"
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border disabled:opacity-60 ${btnCls}`}
          >
            {refreshing ? <Loader size={16} className="animate-spin" /> : <RefreshCw size={16} />}
          </button>
        </div>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          {
            key: "unread",
            label: "Unread",
            value: tabCounts.unread,
            icon: Mail,
            tint: isDark ? "bg-sky-500/10 text-sky-300" : "bg-sky-50 text-sky-600",
            surface: cardCls,
            onClick: () => setInboxTab("unread"),
          },
          {
            key: "alerts",
            label: "Realtime Alerts",
            value: recentAdminRequests.length,
            icon: Radio,
            tint: isDark ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-600",
            surface: cardCls,
            onClick: () => setInboxTab("system"),
          },
          {
            key: "payments",
            label: "Payment Requests",
            value: leadRequests.length,
            icon: IndianRupee,
            tint: isDark ? "bg-amber-500/10 text-amber-300" : "bg-amber-100 text-amber-700",
            surface: isDark ? "border-amber-500/25 bg-amber-500/5" : "border-amber-200 bg-amber-50/70",
            onClick: () => setInboxTab("payments"),
          },
          {
            key: "inventory",
            label: "Inventory Requests",
            value: metrics.pendingInventory,
            icon: Building2,
            tint: isDark ? "bg-violet-500/10 text-violet-300" : "bg-violet-50 text-violet-600",
            surface: cardCls,
            onClick: () => setInboxTab("inventory"),
          },
        ].map((tile) => (
          <button
            key={tile.key}
            type="button"
            onClick={tile.onClick}
            className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition-colors ${tile.surface}`}
          >
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tile.tint}`}>
              <tile.icon size={20} />
            </span>
            <span className="min-w-0">
              <span className={`block truncate text-sm font-semibold ${mutedCls}`}>{tile.label}</span>
              <span className={`block text-2xl font-black ${titleCls}`}>{tile.value}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,430px)_minmax(0,1fr)]">
        {/* Inbox */}
        <section className={`flex min-w-0 flex-col gap-3 rounded-2xl border p-4 ${cardCls}`}>
          <h2 className={`text-lg font-black ${titleCls}`}>Inbox</h2>

          <div className={`flex flex-wrap items-center gap-x-4 border-b ${isDark ? "border-white/5" : "border-slate-100"}`}>
            {INBOX_TABS.map((tab) => {
              const isActiveTab = inboxTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setInboxTab(tab.id)}
                  aria-pressed={isActiveTab}
                  className={`-mb-px flex items-center gap-1.5 border-b-2 pb-2 text-sm font-semibold transition-colors ${
                    isActiveTab
                      ? `border-sky-500 ${isDark ? "text-sky-300" : "text-sky-700"}`
                      : `border-transparent ${mutedCls}`
                  }`}
                >
                  {tab.label}
                  <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-black ${
                    isActiveTab ? (isDark ? "bg-sky-500/20 text-sky-200" : "bg-sky-100 text-sky-700") : chipCls
                  }`}>
                    {tabCounts[tab.id]}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="relative">
            <Search size={16} className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 ${mutedCls}`} />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Search the inbox"
              placeholder="Search notifications..."
              className={`h-10 w-full rounded-xl border pl-9 pr-3 text-sm ${inputCls}`}
            />
          </div>

          {showInboxFilters && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <select
                aria-label="Filter requests by decision"
                value={approvalFilter}
                onChange={(event) => setApprovalFilter(event.target.value)}
                className={`h-10 rounded-xl border px-3 text-sm font-semibold ${inputCls}`}
              >
                {APPROVAL_FILTERS.map((filter) => (
                  <option key={filter.value} value={filter.value}>
                    {filter.value === "ALL" ? "All Status" : filter.label}
                  </option>
                ))}
              </select>
              <div className="relative">
                <CalendarDays size={15} className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 ${mutedCls}`} />
                <select
                  aria-label="Filter by date"
                  value={dateFilter}
                  onChange={(event) => setDateFilter(event.target.value)}
                  className={`h-10 w-full rounded-xl border pl-9 pr-3 text-sm font-semibold ${inputCls}`}
                >
                  {DATE_FILTERS.map((filter) => (
                    <option key={filter.value} value={filter.value}>{filter.label}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {loading ? (
            <div className={`flex h-32 items-center justify-center gap-2 text-sm ${mutedCls}`}>
              <Loader size={14} className="animate-spin" /> Loading notifications...
            </div>
          ) : (
            <div className="space-y-2">
              {visibleItems.map((item) => {
                const isSelected = selectedItem?.id === item.id;
                const isUnread = !readIds.has(item.id);
                const ItemIcon = item.icon;
                return (
                  <div
                    key={item.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleSelectItem(item)}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter" && event.key !== " ") return;
                      event.preventDefault();
                      handleSelectItem(item);
                    }}
                    className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 transition-colors ${
                      isSelected
                        ? (isDark ? "border-sky-500/50 border-l-4 border-l-sky-500 bg-sky-500/5" : "border-sky-200 border-l-4 border-l-sky-500 bg-sky-50/70")
                        : (isDark ? "border-slate-800 hover:border-slate-700" : "border-slate-200 hover:border-slate-300")
                    }`}
                  >
                    <span className={`mt-2 h-2 w-2 shrink-0 rounded-full ${isUnread ? "bg-sky-500" : "bg-transparent"}`} />
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                      item.category === "payments"
                        ? (isDark ? "bg-amber-500/10 text-amber-300" : "bg-amber-100 text-amber-700")
                        : item.category === "inventory"
                          ? (isDark ? "bg-violet-500/10 text-violet-300" : "bg-violet-50 text-violet-600")
                          : (isDark ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-600")
                    }`}>
                      <ItemIcon size={16} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`min-w-0 truncate text-sm font-bold ${titleCls}`}>{item.title}</p>
                        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${getApprovalTone(item.status, isDark)}`}>
                          {item.status}
                        </span>
                      </div>
                      <p className={`truncate text-xs font-semibold ${titleCls}`}>{item.subtitle}</p>
                      <div className="flex items-center justify-between gap-2">
                        <p className={`min-w-0 truncate text-[11px] ${mutedCls}`}>{item.context}</p>
                        <span className={`shrink-0 text-[11px] ${mutedCls}`}>{formatWhen(item.at)}</span>
                      </div>
                      {item.meta ? (
                        <p className={`mt-1 truncate text-[11px] font-semibold ${titleCls}`}>{item.meta}</p>
                      ) : null}
                    </div>
                  </div>
                );
              })}

              {inboxTab === "all" && tabCounts.inventory === 0 ? (
                <button
                  type="button"
                  onClick={() => setInboxTab("inventory")}
                  className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left ${
                    isDark ? "border-slate-800 hover:border-slate-700" : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${chipCls}`}>
                    <Package size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-sm font-bold ${titleCls}`}>Inventory requests</span>
                    <span className={`block truncate text-xs ${mutedCls}`}>No inventory requests yet</span>
                  </span>
                  <ChevronRight size={16} className={mutedCls} />
                </button>
              ) : null}

              {inboxTab === "all" && tabCounts.system === 0 ? (
                <button
                  type="button"
                  onClick={() => setInboxTab("system")}
                  className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left ${
                    isDark ? "border-slate-800 hover:border-slate-700" : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${chipCls}`}>
                    <BellRing size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-sm font-bold ${titleCls}`}>System notifications</span>
                    <span className={`block truncate text-xs ${mutedCls}`}>No system notifications yet</span>
                  </span>
                  <ChevronRight size={16} className={mutedCls} />
                </button>
              ) : null}

              <div className={`flex flex-col items-center gap-1 rounded-2xl border p-6 text-center ${
                isDark ? "border-sky-500/20 bg-sky-500/5" : "border-sky-100 bg-sky-50/60"
              }`}>
                <CheckCircle2 size={26} className={isDark ? "text-emerald-400" : "text-emerald-500"} />
                <p className={`text-sm font-bold ${titleCls}`}>
                  {visibleItems.length === 0 ? "Nothing here right now" : "You're all caught up"}
                </p>
                <p className={`text-xs ${mutedCls}`}>No more notifications at the moment.</p>
              </div>
            </div>
          )}
        </section>

        {/* Detail panel */}
        <section className={`min-w-0 rounded-2xl border p-4 ${cardCls}`}>
          {!selectedItem ? (
            <div className={`flex h-full min-h-[240px] flex-col items-center justify-center gap-2 text-center ${mutedCls}`}>
              <BellRing size={26} />
              <p className="text-sm font-semibold">Select a notification to see its details</p>
            </div>
          ) : selectedItem.category === "payments" ? (
            (() => {
              const lead = selectedItem.lead || {};
              const deal = lead?.dealPayment || {};
              const property = selectedItem.property;
              const images = Array.isArray(property?.images) ? property.images : [];
              const documents = Array.isArray(property?.documents) ? property.documents : [];
              const executive = lead?.assignedExecutive || lead?.assignedTo;
              const manager = lead?.assignedManager;
              const isPendingApproval = selectedItem.status === "PENDING";
              const isReviewingLead = reviewingLeadId === String(lead?._id || "");
              const decisionLabel = selectedItem.status === "APPROVED"
                ? "Approved"
                : selectedItem.status === "REJECTED" ? "Rejected" : "Pending";
              return (
                <>
                  {renderPanelHeader(
                    IndianRupee,
                    isDark ? "bg-amber-500/10 text-amber-300" : "bg-amber-100 text-amber-700",
                    "Payment request details",
                    selectedItem.status === "APPROVED"
                      ? "Lead payment has been approved"
                      : selectedItem.status === "REJECTED"
                        ? "Lead payment has been rejected"
                        : "Lead payment is awaiting your decision",
                    <span className={`rounded-full border px-3 py-1 text-[11px] font-bold ${getApprovalTone(selectedItem.status, isDark)}`}>
                      {selectedItem.status}
                    </span>,
                    <button
                      type="button"
                      onClick={() => navigate(`/leads/${toObjectIdString(lead?._id)}`)}
                      className={`flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-bold ${btnCls}`}
                    >
                      <ExternalLink size={14} /> Open lead
                    </button>,
                  )}

                  <div className="mt-4 space-y-3">
                    {renderSection(FileText, "Overview", renderFieldGrid(
                      [
                        ["Lead", lead?.name || "-"],
                        ["Lead status", lead?.status || "-"],
                        ["Payment type", formatPaymentType(deal.paymentType)],
                      ],
                      [
                        ["Mode", formatPaymentMode(deal.mode)],
                        ["Reference", deal.paymentReference || "-"],
                        ["Remaining", formatAmount(deal.remainingAmount)],
                      ],
                    ))}

                    {renderSection(Building2, "Property details", renderFieldGrid(
                      [
                        ["Property", property ? (getInventoryUnitLabel(property) || "-") : "-"],
                        ["Address", property?.location || "-"],
                        ["Status", (
                          <span className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-bold ${
                            isDark ? "bg-emerald-500/10 text-emerald-300" : "bg-emerald-50 text-emerald-700"
                          }`}>
                            {formatInventoryStatusLabel(property?.status)}
                          </span>
                        )],
                      ],
                      [
                        ["Sale value", formatAmount(property?.price)],
                        ["Sold properties", selectedItem.soldCount],
                        ["Images", images.length],
                        ["Documents", documents.length],
                      ],
                    ))}

                    {renderSection(Users, "People", renderFieldGrid(
                      [
                        ["Executive", formatUserWithRole(executive)],
                        ["Phone", getUserContactField(executive, "phone") || "-"],
                        ["Email", getUserContactField(executive, "email") || "-"],
                      ],
                      [
                        ["Manager", formatUserWithRole(manager)],
                        ["Phone", getUserContactField(manager, "phone") || "-"],
                        ["Email", getUserContactField(manager, "email") || "-"],
                      ],
                    ))}

                    {renderSection(Clock3, "Activity timeline", renderTimeline([
                      {
                        label: "Requested",
                        text: deal.approvalRequestedBy?.name
                          ? `Payment request created by ${deal.approvalRequestedBy.name}`
                          : "Payment request created",
                        at: deal.approvalRequestedAt,
                        done: Boolean(deal.approvalRequestedAt),
                      },
                      {
                        label: "Reviewed",
                        text: deal.approvalReviewedBy?.name
                          ? `Reviewed by ${deal.approvalReviewedBy.name}`
                          : "Awaiting review",
                        at: deal.approvalReviewedAt,
                        done: Boolean(deal.approvalReviewedAt),
                      },
                      {
                        label: decisionLabel,
                        text: deal.approvalNote || (isPendingApproval ? "Decision pending" : `Payment ${decisionLabel.toLowerCase()}`),
                        at: isPendingApproval ? null : deal.approvalReviewedAt,
                        done: !isPendingApproval,
                      },
                    ]))}
                  </div>

                  <div className={`mt-4 flex flex-wrap items-center justify-end gap-2 border-t pt-4 ${
                    isDark ? "border-white/5" : "border-slate-100"
                  }`}>
                    {isPendingApproval ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleApproveLeadRequest(lead)}
                          disabled={isReviewingLead}
                          className={`flex h-10 items-center gap-1.5 rounded-xl border px-4 text-sm font-semibold disabled:opacity-60 ${
                            isDark
                              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                              : "border-emerald-200 bg-emerald-50 text-emerald-700"
                          }`}
                        >
                          {isReviewingLead ? <Loader size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRejectLeadRequest(lead)}
                          disabled={isReviewingLead}
                          className={`flex h-10 items-center gap-1.5 rounded-xl border px-4 text-sm font-semibold disabled:opacity-60 ${
                            isDark ? "border-rose-500/40 bg-rose-500/10 text-rose-200" : "border-rose-200 bg-rose-50 text-rose-700"
                          }`}
                        >
                          <XCircle size={14} /> Reject
                        </button>
                      </>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => navigate("/leads")}
                      className={`h-10 rounded-xl border px-4 text-sm font-semibold ${btnCls}`}
                    >
                      Lead matrix
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate(`/leads/${toObjectIdString(lead?._id)}`)}
                      className="flex h-10 items-center gap-1.5 rounded-xl bg-sky-600 px-4 text-sm font-semibold text-white hover:bg-sky-500"
                    >
                      <ExternalLink size={14} /> Open lead
                    </button>
                  </div>
                </>
              );
            })()
          ) : selectedItem.category === "inventory" ? (
            (() => {
              const request = selectedItem.request || {};
              const detailSource = request?.proposedData || request?.inventoryId || {};
              const requestedFields = Object.entries(request?.proposedData || {}).filter(
                ([key]) => Object.prototype.hasOwnProperty.call(REQUEST_FIELD_LABELS, key),
              );
              const inventoryId = toObjectIdString(request?.inventoryId?._id || request?.inventoryId);
              const isReviewing = reviewingInventoryRequestId === selectedItem.requestId;
              const detailImages = Array.isArray(detailSource?.images) ? detailSource.images : [];
              const detailDocs = Array.isArray(detailSource?.documents) ? detailSource.documents : [];
              return (
                <>
                  {renderPanelHeader(
                    Building2,
                    isDark ? "bg-violet-500/10 text-violet-300" : "bg-violet-50 text-violet-600",
                    "Inventory request details",
                    `${String(request?.type || "UPDATE").toUpperCase()} request awaiting your decision`,
                    <span className={`rounded-full border px-3 py-1 text-[11px] font-bold ${getApprovalTone("PENDING", isDark)}`}>
                      PENDING
                    </span>,
                    inventoryId ? (
                      <button
                        type="button"
                        onClick={() => navigate(`/inventory/${inventoryId}`)}
                        className={`flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-bold ${btnCls}`}
                      >
                        <ExternalLink size={14} /> Open inventory
                      </button>
                    ) : null,
                  )}

                  <div className="mt-4 space-y-3">
                    {renderSection(FileText, "Overview", renderFieldGrid(
                      [
                        ["Requested by", formatUserWithRole(request?.requestedBy)],
                        ["Team", request?.teamId?.name || "-"],
                        ["Requested at", formatDate(request?.createdAt)],
                      ],
                      [
                        ["Unit", selectedItem.context || "-"],
                        ["Type", String(request?.type || "UPDATE").toUpperCase()],
                        ["Status", formatInventoryStatusLabel(detailSource?.status)],
                      ],
                    ))}

                    {renderSection(Package, "Unit details", renderFieldGrid(
                      [
                        ["Location", detailSource?.location || "-"],
                        ["Coordinates", formatCoordinates(detailSource?.siteLocation)],
                        ["Price", formatAmount(detailSource?.price)],
                      ],
                      [
                        ["Images", detailImages.length],
                        ["Documents", detailDocs.length],
                        ["Category", detailSource?.category || "-"],
                      ],
                    ))}

                    {requestedFields.length > 0
                      ? renderSection(FileText, "Requested changes", (
                        <div className="grid gap-2 sm:grid-cols-2">
                          {requestedFields.map(([key, value]) => (
                            <div key={key} className="grid grid-cols-[104px_minmax(0,1fr)] gap-x-3">
                              <span className={`text-xs ${mutedCls}`}>{REQUEST_FIELD_LABELS[key] || key}</span>
                              <span className={`min-w-0 break-words text-xs font-semibold ${titleCls}`}>
                                {formatRequestValue(key, value)}
                              </span>
                            </div>
                          ))}
                        </div>
                      ))
                      : null}

                    {renderSection(Clock3, "Activity timeline", renderTimeline([
                      { label: "Requested", text: "Inventory request created", at: request?.createdAt, done: true },
                      { label: "Pending", text: "Waiting for admin decision", at: null, done: false },
                    ]))}
                  </div>

                  <div className={`mt-4 flex flex-wrap items-center justify-end gap-2 border-t pt-4 ${
                    isDark ? "border-white/5" : "border-slate-100"
                  }`}>
                    <button
                      type="button"
                      onClick={() => handleApproveInventoryRequest(selectedItem.requestId)}
                      disabled={isReviewing}
                      className={`flex h-10 items-center gap-1.5 rounded-xl border px-4 text-sm font-semibold disabled:opacity-60 ${
                        isDark ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200" : "border-emerald-200 bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      {isReviewing ? <Loader size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRejectInventoryRequest(selectedItem.requestId)}
                      disabled={isReviewing}
                      className={`flex h-10 items-center gap-1.5 rounded-xl border px-4 text-sm font-semibold disabled:opacity-60 ${
                        isDark ? "border-rose-500/40 bg-rose-500/10 text-rose-200" : "border-rose-200 bg-rose-50 text-rose-700"
                      }`}
                    >
                      <XCircle size={14} /> Reject
                    </button>
                  </div>
                </>
              );
            })()
          ) : selectedItem.alert ? (
            (() => {
              const alert = selectedItem.alert;
              return (
                <>
                  {renderPanelHeader(
                    BellRing,
                    chipCls,
                    "Realtime alert",
                    `${selectedItem.subtitle} · ${selectedItem.context}`,
                    <span className={`rounded-full border px-3 py-1 text-[11px] font-bold ${getApprovalTone("ALERT", isDark)}`}>
                      ALERT
                    </span>,
                    <button
                      type="button"
                      onClick={() => handleOpenAlertTarget(alert)}
                      className={`flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-bold ${btnCls}`}
                    >
                      <ExternalLink size={14} /> Open target
                    </button>,
                  )}
                  <div className="mt-4 space-y-3">
                    {renderSection(FileText, "Overview", renderFieldGrid(
                      [
                        ["Source", String(alert?.source || "-").toUpperCase()],
                        ["Type", String(alert?.requestType || "-")],
                      ],
                      [
                        ["Received", formatWhen(alert?.createdAt)],
                        ["Reference", toObjectIdString(alert?.requestId) || "-"],
                      ],
                    ))}
                    {renderSection(BellRing, "Message", (
                      <p className={`text-xs ${titleCls}`}>{alert?.preview || "-"}</p>
                    ))}
                  </div>
                </>
              );
            })()
          ) : (
            (() => {
              const request = selectedItem.request || {};
              const target = selectedItem.target || {};
              const isReviewing = reviewingUserDeleteRequestId === selectedItem.requestId;
              return (
                <>
                  {renderPanelHeader(
                    UserRound,
                    isDark ? "bg-rose-500/10 text-rose-300" : "bg-rose-50 text-rose-600",
                    "Account delete request",
                    `${target?.name || "User"} is queued for deletion`,
                    <span className={`rounded-full border px-3 py-1 text-[11px] font-bold ${getApprovalTone("PENDING", isDark)}`}>
                      PENDING
                    </span>,
                    null,
                  )}

                  <div className="mt-4 space-y-3">
                    {renderSection(FileText, "Overview", renderFieldGrid(
                      [
                        ["User", target?.name || "-"],
                        ["Role", target?.role || "-"],
                        ["Email", target?.email || "-"],
                      ],
                      [
                        ["Phone", target?.phone || "-"],
                        ["Requested by", formatUserWithRole(request?.requestedBy)],
                        ["Requested at", formatDate(request?.createdAt)],
                      ],
                    ))}
                    {renderSection(FileText, "Reason", (
                      <p className={`text-xs ${titleCls}`}>{request?.reason || "-"}</p>
                    ))}
                    {renderSection(Clock3, "Activity timeline", renderTimeline([
                      { label: "Requested", text: "Delete request created", at: request?.createdAt, done: true },
                      { label: "Pending", text: "Waiting for admin decision", at: null, done: false },
                    ]))}
                  </div>

                  <div className={`mt-4 flex flex-wrap items-center justify-end gap-2 border-t pt-4 ${
                    isDark ? "border-white/5" : "border-slate-100"
                  }`}>
                    <button
                      type="button"
                      onClick={() => handleApproveUserDeleteRequest(selectedItem.requestId)}
                      disabled={isReviewing}
                      className={`flex h-10 items-center gap-1.5 rounded-xl border px-4 text-sm font-semibold disabled:opacity-60 ${
                        isDark ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200" : "border-emerald-200 bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      {isReviewing ? <Loader size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRejectUserDeleteRequest(selectedItem.requestId)}
                      disabled={isReviewing}
                      className={`flex h-10 items-center gap-1.5 rounded-xl border px-4 text-sm font-semibold disabled:opacity-60 ${
                        isDark ? "border-rose-500/40 bg-rose-500/10 text-rose-200" : "border-rose-200 bg-rose-50 text-rose-700"
                      }`}
                    >
                      <XCircle size={14} /> Reject
                    </button>
                  </div>
                </>
              );
            })()
          )}
        </section>
      </div>
    </div>
  );
};

export default AdminNotifications;
