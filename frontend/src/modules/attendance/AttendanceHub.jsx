import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarCheck2,
  ClipboardCheck,
  CheckCircle2,
  Clock3,
  Loader2,
  LogIn,
  LogOut,
  MapPin,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  Users,
} from "lucide-react";
import {
  checkInAttendance,
  checkOutAttendance,
  createLeaveRequest,
  endBreakAttendance,
  getAdminLeaveRequests,
  getDailyAttendanceForAdmin,
  getAttendancePolicy,
  getMyLeaveRequests,
  getMyAttendance,
  reviewLeaveRequest,
  startBreakAttendance,
  updateAttendancePolicy,
  updateUserAttendanceStatus,
} from "../../services/attendanceService";
import { toErrorMessage } from "../../utils/errorMessage";
import ToastNotice from "../../components/ui/ToastNotice";

const ADMIN_VIEW_ROLES = new Set([
  "ADMIN",
  "MANAGER",
]);

const STATUS_STYLES = {
  PRESENT: "bg-emerald-100 text-emerald-700 border-emerald-200",
  WORKING: "bg-emerald-100 text-emerald-700 border-emerald-200",
  BREAK: "bg-indigo-100 text-indigo-700 border-indigo-200",
  LATE: "bg-yellow-100 text-yellow-700 border-yellow-200",
  HALF_DAY: "bg-blue-100 text-blue-700 border-blue-200",
  LEAVE: "bg-teal-100 text-teal-700 border-teal-200",
  PENDING: "bg-amber-100 text-amber-700 border-amber-200",
  ABSENT: "bg-rose-100 text-rose-700 border-rose-200",
  MISSED_CHECK_OUT: "bg-orange-100 text-orange-700 border-orange-200",
};

const LEAVE_TYPE_OPTIONS = ["CASUAL", "SICK", "EMERGENCY", "UNPAID", "OTHER"];
const MANUAL_ATTENDANCE_STATUS_OPTIONS = [
  { label: "Present", value: "PRESENT" },
  { label: "Half Day", value: "HALF_DAY" },
  { label: "Absent", value: "ABSENT" },
];

const getRoleFromStorage = () =>
  String(localStorage.getItem("role") || "").trim().toUpperCase();

const toLocalDateInputValue = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const toMonthInputValue = (value = new Date()) =>
  toLocalDateInputValue(value).slice(0, 7);

const formatDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatDateLabel = (value) => {
  if (!value) return "-";
  const [yearRaw, monthRaw, dayRaw] = String(value).split("-");
  const year = Number.parseInt(yearRaw, 10);
  const month = Number.parseInt(monthRaw, 10);
  const day = Number.parseInt(dayRaw, 10);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return value;
  }
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatDuration = (minutes) => {
  const safeMinutes = Math.max(0, Number(minutes || 0));
  const hours = Math.floor(safeMinutes / 60);
  const mins = safeMinutes % 60;
  return `${hours}h ${mins}m`;
};

const statusBadgeClass = (status) =>
  STATUS_STYLES[status] || "bg-slate-100 text-slate-700 border-slate-200";

const formatAttendanceStatus = (status) => {
  const normalized = String(status || "ABSENT").trim().toUpperCase();
  if (normalized === "PRESENT") return "Present";
  if (normalized === "WORKING") return "Working";
  if (normalized === "BREAK") return "Break";
  if (normalized === "LATE") return "Working";
  return normalized.replaceAll("_", " ");
};

const checkInTimeClass = (isLate) =>
  isLate ? "text-sm font-semibold text-rose-700" : "text-sm text-slate-700";

const EMPTY_POLICY_FORM = {
  geofenceEnabled: false,
  officeLatitude: "",
  officeLongitude: "",
  officeRadiusMeters: 200,
};
const GEOLOCATION_RETRY_ACCURACY_METERS = 150;

const toLocationPayload = (coords = {}) => ({
  latitude: coords.latitude,
  longitude: coords.longitude,
  accuracy: coords.accuracy,
});

const readCurrentPosition = (options) =>
  new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve(toLocationPayload(position.coords || {})),
      reject,
      options,
    );
  });

const hasGoodLocationAccuracy = (location) => {
  const accuracy = Number(location?.accuracy);
  return Number.isFinite(accuracy) && accuracy <= GEOLOCATION_RETRY_ACCURACY_METERS;
};

const pickBetterLocation = (first, second) => {
  const firstAccuracy = Number(first?.accuracy);
  const secondAccuracy = Number(second?.accuracy);
  if (!first) return second || null;
  if (!second) return first;
  if (!Number.isFinite(firstAccuracy)) return second;
  if (!Number.isFinite(secondAccuracy)) return first;
  return secondAccuracy < firstAccuracy ? second : first;
};

const requestAttendanceLocation = async ({ required = false } = {}) => {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    if (required) {
      throw new Error("Location is required but this browser does not support geolocation");
    }
    return null;
  }

  try {
    const firstLocation = await readCurrentPosition({
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    });
    if (hasGoodLocationAccuracy(firstLocation)) return firstLocation;

    try {
      const secondLocation = await readCurrentPosition({
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0,
      });
      return pickBetterLocation(firstLocation, secondLocation);
    } catch {
      return firstLocation;
    }
  } catch {
    if (required) {
      throw new Error("Please allow location access to mark attendance");
    }
    return null;
  }
};

const formatDistance = (meters) => {
  const safeMeters = Number(meters);
  if (!Number.isFinite(safeMeters)) return "-";
  if (safeMeters >= 1000) return `${(safeMeters / 1000).toFixed(2)} km`;
  return `${Math.round(safeMeters)} m`;
};

const AttendanceHub = () => {
  const navigate = useNavigate();
  const [viewerRole] = useState(getRoleFromStorage);
  const isAdminViewer = ADMIN_VIEW_ROLES.has(viewerRole);
  const canUsePersonalAttendance = viewerRole !== "ADMIN";

  const [month, setMonth] = useState(toMonthInputValue(new Date()));
  const [myLoading, setMyLoading] = useState(true);
  const [myRefreshing, setMyRefreshing] = useState(false);
  const [attendanceAction, setAttendanceAction] = useState("");
  const [myError, setMyError] = useState("");
  const [mySuccess, setMySuccess] = useState("");
  const [myData, setMyData] = useState({
    timezone: "",
    today: null,
    policy: null,
    summary: {},
    attendance: [],
  });

  const [adminDate, setAdminDate] = useState(toLocalDateInputValue(new Date()));
  const [adminStatus, setAdminStatus] = useState("");
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminRefreshing, setAdminRefreshing] = useState(false);
  const [adminError, setAdminError] = useState("");
  const [manualStatusAction, setManualStatusAction] = useState("");
  const [adminData, setAdminData] = useState({
    timezone: "",
    date: "",
    summary: {},
    attendance: [],
  });
  const [policyLoading, setPolicyLoading] = useState(false);
  const [policySaving, setPolicySaving] = useState(false);
  const [policyError, setPolicyError] = useState("");
  const [attendancePolicy, setAttendancePolicy] = useState(null);
  const [policyForm, setPolicyForm] = useState(EMPTY_POLICY_FORM);

  const [leaveLoading, setLeaveLoading] = useState(false);
  const [leaveSubmitting, setLeaveSubmitting] = useState(false);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [leaveForm, setLeaveForm] = useState({
    fromDate: toLocalDateInputValue(new Date()),
    toDate: toLocalDateInputValue(new Date()),
    leaveType: "CASUAL",
    reason: "",
  });

  const openUserProfile = useCallback(
    (targetUserId) => {
      const normalizedUserId = String(targetUserId || "").trim();
      if (!normalizedUserId) return;
      navigate(`/admin/users/${normalizedUserId}`);
    },
    [navigate],
  );

  const [adminWorkflowLoading, setAdminWorkflowLoading] = useState(false);
  const [adminLeaveRequests, setAdminLeaveRequests] = useState([]);
  const [adminLeaveStatusFilter, setAdminLeaveStatusFilter] = useState("PENDING");
  const [reviewAction, setReviewAction] = useState("");

  const loadMyAttendance = useCallback(async ({ quiet = false } = {}) => {
    if (!canUsePersonalAttendance) {
      setMyLoading(false);
      setMyRefreshing(false);
      return;
    }

    if (quiet) {
      setMyRefreshing(true);
    } else {
      setMyLoading(true);
    }
    setMyError("");

    try {
      const payload = await getMyAttendance({ month });
      setMyData({
        timezone: payload.timezone || "",
        today: payload.today || null,
        policy: payload.policy || null,
        summary: payload.summary || {},
        attendance: Array.isArray(payload.attendance) ? payload.attendance : [],
      });
    } catch (error) {
      setMyError(toErrorMessage(error, "Failed to load attendance"));
    } finally {
      setMyLoading(false);
      setMyRefreshing(false);
    }
  }, [canUsePersonalAttendance, month]);

  const loadAdminAttendance = useCallback(async ({
    quiet = false,
    date = adminDate,
    status = adminStatus,
  } = {}) => {
    if (!isAdminViewer) return;

    if (quiet) {
      setAdminRefreshing(true);
    } else {
      setAdminLoading(true);
    }
    setAdminError("");

    try {
      const payload = await getDailyAttendanceForAdmin({
        date,
        ...(status ? { status } : {}),
      });
      setAdminData({
        timezone: payload.timezone || "",
        date: payload.date || date,
        summary: payload.summary || {},
        attendance: Array.isArray(payload.attendance) ? payload.attendance : [],
      });
    } catch (error) {
      setAdminError(toErrorMessage(error, "Failed to load team attendance"));
    } finally {
      setAdminLoading(false);
      setAdminRefreshing(false);
    }
  }, [adminDate, adminStatus, isAdminViewer]);

  const loadLeaveRequestsData = useCallback(async () => {
    if (!canUsePersonalAttendance) {
      setLeaveLoading(false);
      return;
    }

    setLeaveLoading(true);
    try {
      const rows = await getMyLeaveRequests();
      setLeaveRequests(Array.isArray(rows) ? rows : []);
    } catch (error) {
      setMyError(toErrorMessage(error, "Failed to load leave requests"));
    } finally {
      setLeaveLoading(false);
    }
  }, [canUsePersonalAttendance]);

  const loadAdminWorkflowData = useCallback(async () => {
    if (!isAdminViewer) return;

    setAdminWorkflowLoading(true);
    try {
      const leaveRows = await getAdminLeaveRequests({
        ...(adminLeaveStatusFilter ? { status: adminLeaveStatusFilter } : {}),
      });
      setAdminLeaveRequests(Array.isArray(leaveRows) ? leaveRows : []);
    } catch (error) {
      setAdminError(toErrorMessage(error, "Failed to load review workflows"));
    } finally {
      setAdminWorkflowLoading(false);
    }
  }, [adminLeaveStatusFilter, isAdminViewer]);

  const loadAttendancePolicy = useCallback(async () => {
    if (!isAdminViewer) return;

    setPolicyLoading(true);
    try {
      const policy = await getAttendancePolicy();
      setAttendancePolicy(policy || null);
      setPolicyForm({
        geofenceEnabled: Boolean(policy?.geofenceEnabled),
        officeLatitude: policy?.officeLatitude ?? "",
        officeLongitude: policy?.officeLongitude ?? "",
        officeRadiusMeters: Number(policy?.officeRadiusMeters || 200),
      });
    } catch (error) {
      setPolicyError(toErrorMessage(error, "Failed to load attendance policy"));
    } finally {
      setPolicyLoading(false);
    }
  }, [isAdminViewer]);

  useEffect(() => {
    loadMyAttendance();
  }, [loadMyAttendance]);

  useEffect(() => {
    if (!isAdminViewer) return;
    loadAdminAttendance();
  }, [isAdminViewer, loadAdminAttendance]);

  useEffect(() => {
    loadLeaveRequestsData();
  }, [loadLeaveRequestsData]);

  useEffect(() => {
    if (!isAdminViewer) return;
    loadAdminWorkflowData();
  }, [isAdminViewer, loadAdminWorkflowData]);

  useEffect(() => {
    if (!isAdminViewer) return;
    loadAttendancePolicy();
  }, [isAdminViewer, loadAttendancePolicy]);

  useEffect(() => {
    if (!mySuccess) return undefined;
    const timer = setTimeout(() => setMySuccess(""), 2000);
    return () => clearTimeout(timer);
  }, [mySuccess]);

  const todayAttendance = myData.today;
  const canCheckIn = canUsePersonalAttendance && !todayAttendance?.checkInAt;
  const canCheckOut = canUsePersonalAttendance && Boolean(todayAttendance?.checkInAt) && !todayAttendance?.checkOutAt;
  const isOnBreak = Boolean(todayAttendance?.isOnBreak);
  const canStartBreak =
    canUsePersonalAttendance
    && Boolean(todayAttendance?.checkInAt)
    && !todayAttendance?.checkOutAt
    && !isOnBreak;
  const canEndBreak =
    canUsePersonalAttendance
    && Boolean(todayAttendance?.checkInAt)
    && !todayAttendance?.checkOutAt
    && isOnBreak;

  const handleCheckIn = async () => {
    if (!canUsePersonalAttendance) return;

    try {
      setAttendanceAction("checkin");
      setMyError("");
      const location = await requestAttendanceLocation({
        required: Boolean(myData.policy?.geofenceEnabled),
      });
      const result = await checkInAttendance({
        source: "WEB",
        ...(location ? { location } : {}),
      });
      setMySuccess(result.message || "Checked in successfully");
      await loadMyAttendance({ quiet: true });
      if (isAdminViewer) {
        await loadAdminAttendance({ quiet: true });
      }
    } catch (error) {
      setMyError(toErrorMessage(error, "Check-in failed"));
    } finally {
      setAttendanceAction("");
    }
  };

  const handleCheckOut = async () => {
    if (!canUsePersonalAttendance) return;

    if (typeof window !== "undefined") {
      const warningLines = [
        "Are you sure you want to check out for today?",
        "After check-out, you cannot check in again today.",
      ];
      if (todayAttendance?.isOnBreak) {
        warningLines.push("You are currently on break. This check-out will end the active break.");
      }
      const shouldProceed = window.confirm(warningLines.join("\n"));
      if (!shouldProceed) return;
    }

    try {
      setAttendanceAction("checkout");
      setMyError("");
      const location = await requestAttendanceLocation({
        required: Boolean(myData.policy?.geofenceEnabled),
      });
      const result = await checkOutAttendance({
        source: "WEB",
        ...(location ? { location } : {}),
      });
      setMySuccess(result.message || "Checked out successfully");
      await loadMyAttendance({ quiet: true });
      if (isAdminViewer) {
        await loadAdminAttendance({ quiet: true });
      }
    } catch (error) {
      setMyError(toErrorMessage(error, "Check-out failed"));
    } finally {
      setAttendanceAction("");
    }
  };

  const handleSaveAttendancePolicy = async (event) => {
    event.preventDefault();
    if (!isAdminViewer) return;

    const geofenceEnabled = Boolean(policyForm.geofenceEnabled);
    const officeLatitude = String(policyForm.officeLatitude || "").trim();
    const officeLongitude = String(policyForm.officeLongitude || "").trim();
    const officeRadiusMeters = Number(policyForm.officeRadiusMeters || 200);

    if (geofenceEnabled && (!officeLatitude || !officeLongitude)) {
      setPolicyError("Office latitude and longitude are required when geofence is enabled");
      return;
    }

    try {
      setPolicySaving(true);
      setPolicyError("");
      const result = await updateAttendancePolicy({
        ...(attendancePolicy || {}),
        geofenceEnabled,
        officeLatitude: officeLatitude || null,
        officeLongitude: officeLongitude || null,
        officeRadiusMeters,
      });
      setAttendancePolicy(result.policy || null);
      setPolicyForm({
        geofenceEnabled: Boolean(result.policy?.geofenceEnabled),
        officeLatitude: result.policy?.officeLatitude ?? "",
        officeLongitude: result.policy?.officeLongitude ?? "",
        officeRadiusMeters: Number(result.policy?.officeRadiusMeters || 200),
      });
      setMySuccess(result.message || "Attendance policy updated");
    } catch (error) {
      setPolicyError(toErrorMessage(error, "Failed to save attendance policy"));
    } finally {
      setPolicySaving(false);
    }
  };

  const handleUseCurrentOfficeLocation = async () => {
    if (!isAdminViewer) return;

    try {
      setPolicySaving(true);
      setPolicyError("");
      const location = await requestAttendanceLocation({ required: true });
      setPolicyForm((prev) => ({
        ...prev,
        officeLatitude: Number(location.latitude).toFixed(6),
        officeLongitude: Number(location.longitude).toFixed(6),
      }));
    } catch (error) {
      setPolicyError(toErrorMessage(error, "Failed to read current location"));
    } finally {
      setPolicySaving(false);
    }
  };

  const handleStartBreak = async () => {
    if (!canUsePersonalAttendance) return;

    try {
      setAttendanceAction("breakstart");
      setMyError("");
      const result = await startBreakAttendance({ source: "WEB" });
      setMySuccess(result.message || "Break started");
      await loadMyAttendance({ quiet: true });
      if (isAdminViewer) {
        await loadAdminAttendance({ quiet: true });
      }
    } catch (error) {
      setMyError(toErrorMessage(error, "Failed to start break"));
    } finally {
      setAttendanceAction("");
    }
  };

  const handleEndBreak = async () => {
    if (!canUsePersonalAttendance) return;

    try {
      setAttendanceAction("breakend");
      setMyError("");
      const result = await endBreakAttendance({ source: "WEB" });
      setMySuccess(result.message || "Break ended");
      await loadMyAttendance({ quiet: true });
      if (isAdminViewer) {
        await loadAdminAttendance({ quiet: true });
      }
    } catch (error) {
      setMyError(toErrorMessage(error, "Failed to end break"));
    } finally {
      setAttendanceAction("");
    }
  };

  const handleSubmitLeaveRequest = async (event) => {
    event.preventDefault();
    if (!canUsePersonalAttendance) return;

    const fromDate = String(leaveForm.fromDate || "").trim();
    const toDate = String(leaveForm.toDate || "").trim();
    const reason = String(leaveForm.reason || "").trim();

    if (!fromDate || !toDate) {
      setMyError("Please select leave start and end date.");
      return;
    }
    if (fromDate > toDate) {
      setMyError("Leave start date cannot be after end date.");
      return;
    }
    if (!reason) {
      setMyError("Please enter leave reason.");
      return;
    }

    try {
      setLeaveSubmitting(true);
      setMyError("");
      const result = await createLeaveRequest({
        fromDate,
        toDate,
        leaveType: leaveForm.leaveType,
        reason,
      });
      setMySuccess(result.message || "Leave request created");
      setLeaveForm((prev) => ({
        ...prev,
        reason: "",
      }));
      await Promise.all([
        loadLeaveRequestsData(),
        loadMyAttendance({ quiet: true }),
        isAdminViewer ? loadAdminAttendance({ quiet: true }) : Promise.resolve(),
        isAdminViewer ? loadAdminWorkflowData() : Promise.resolve(),
      ]);
    } catch (error) {
      setMyError(toErrorMessage(error, "Failed to create leave request"));
    } finally {
      setLeaveSubmitting(false);
    }
  };

  const handleReviewLeave = async (requestId, status) => {
    if (!requestId || !status) return;
    const actionKey = `leave:${requestId}:${status}`;
    const reviewNoteInput = typeof window !== "undefined"
      ? window.prompt(`Optional note for ${status.toLowerCase()} action`, "")
      : "";
    if (reviewNoteInput === null) return;

    try {
      setReviewAction(actionKey);
      setAdminError("");
      const result = await reviewLeaveRequest(requestId, {
        status,
        reviewNote: String(reviewNoteInput || "").trim(),
      });
      setMySuccess(result.message || "Leave request updated");
      await Promise.all([
        loadAdminWorkflowData(),
        loadMyAttendance({ quiet: true }),
        loadLeaveRequestsData(),
        loadAdminAttendance({ quiet: true }),
      ]);
    } catch (error) {
      setAdminError(toErrorMessage(error, "Failed to review leave request"));
    } finally {
      setReviewAction("");
    }
  };

  const handleManualStatusChange = async (row, nextStatus) => {
    const userId = String(row?.user?._id || "").trim();
    const date = String(adminData.date || adminDate || "").trim();
    if (!userId || !date || !nextStatus) return;

    const actionKey = `${userId}:${date}`;
    try {
      setManualStatusAction(actionKey);
      setAdminError("");
      const result = await updateUserAttendanceStatus(userId, date, {
        status: nextStatus,
      });
      setMySuccess(result.message || "Attendance status updated");
      await loadAdminAttendance({
        quiet: true,
        date: adminDate,
        status: adminStatus,
      });
    } catch (error) {
      setAdminError(toErrorMessage(error, "Failed to update attendance status"));
    } finally {
      setManualStatusAction("");
    }
  };

  const todayStatus = todayAttendance?.status || "ABSENT";
  const todayWorkedMinutes = Number(todayAttendance?.workedMinutes || 0);
  const todayBreakMinutes = Number(todayAttendance?.totalBreakMinutes || 0);
  const todayBreakSessions = Array.isArray(todayAttendance?.breakSessions)
    ? todayAttendance.breakSessions
    : [];

  const mySummaryCards = useMemo(() => {
    const summary = myData.summary || {};
    return [
      {
        key: "totalDays",
        label: "Days in View",
        value: Number(summary.totalDays || 0),
      },
      {
        key: "presentDays",
        label: "Present Days",
        value: Number(summary.presentDays || 0),
      },
      {
        key: "lateDays",
        label: "Late Days",
        value: Number(summary.lateDays || 0),
      },
      {
        key: "halfDays",
        label: "Half Days",
        value: Number(summary.halfDays || 0),
      },
      {
        key: "absentDays",
        label: "Absent Days",
        value: Number(summary.absentDays || 0),
      },
      {
        key: "leaveDays",
        label: "Leave Days",
        value: Number(summary.leaveDays || 0),
      },
      {
        key: "pendingDays",
        label: "Pending Days",
        value: Number(summary.pendingDays || 0),
      },
      {
        key: "workedHours",
        label: "Total Hours",
        value: Number(summary.totalWorkedHours || 0),
      },
      {
        key: "breakHours",
        label: "Break Hours",
        value: Number(summary.totalBreakHours || 0),
      },
    ];
  }, [myData.summary]);

  return (
    <div className="ui-page-shell custom-scrollbar relative">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-16 top-4 h-64 w-64 rounded-full bg-cyan-300/35 blur-3xl" />
        <div className="absolute right-0 top-24 h-72 w-72 rounded-full bg-emerald-300/35 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-56 w-56 rounded-full bg-indigo-300/25 blur-3xl" />
      </div>

      {canUsePersonalAttendance ? (
        <>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <input
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
            />
            <button
              type="button"
              onClick={() => loadMyAttendance({ quiet: true })}
              disabled={myLoading || myRefreshing}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {myRefreshing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              Refresh
            </button>
          </div>

          <ToastNotice message={myError} type="error" />
          <ToastNotice message={mySuccess} type="success" />

          {myLoading ? (
            <div className="flex h-40 items-center justify-center rounded-3xl border border-slate-200 bg-white text-slate-500 shadow-sm">
              <Loader2 size={18} className="mr-2 animate-spin" />
              Loading attendance...
            </div>
          ) : (
            <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_18px_45px_-34px_rgba(15,23,42,0.35)] lg:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Today
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-slate-900">
                    {formatDateLabel(toLocalDateInputValue(new Date()))}
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(todayStatus)}`}>
                    {formatAttendanceStatus(todayStatus)}
                  </span>
                  {isOnBreak ? (
                    <span className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-100 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                      On Break
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50/85 px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Check In</p>
                  <p className={`mt-1 ${checkInTimeClass(todayAttendance?.isLateCheckIn)}`}>
                    {formatDateTime(todayAttendance?.checkInAt)}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/85 px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Check Out</p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">{formatDateTime(todayAttendance?.checkOutAt)}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/85 px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Worked</p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">{formatDuration(todayWorkedMinutes)}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/85 px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Break Time</p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">{formatDuration(todayBreakMinutes)}</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleCheckIn}
                  disabled={!canCheckIn || Boolean(attendanceAction)}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 px-4 text-sm font-semibold text-white transition hover:from-emerald-700 hover:to-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {attendanceAction === "checkin" ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <LogIn size={14} />
                  )}
                  Check In
                </button>
                <button
                  type="button"
                  onClick={handleStartBreak}
                  disabled={!canStartBreak || Boolean(attendanceAction)}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 text-sm font-semibold text-white transition hover:from-indigo-700 hover:to-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {attendanceAction === "breakstart" ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <PauseCircle size={14} />
                  )}
                  Start Break
                </button>
                <button
                  type="button"
                  onClick={handleEndBreak}
                  disabled={!canEndBreak || Boolean(attendanceAction)}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-900 to-indigo-700 px-4 text-sm font-semibold text-white transition hover:from-indigo-800 hover:to-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {attendanceAction === "breakend" ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <PlayCircle size={14} />
                  )}
                  End Break
                </button>
                <button
                  type="button"
                  onClick={handleCheckOut}
                  disabled={!canCheckOut || Boolean(attendanceAction)}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-slate-900 to-slate-700 px-4 text-sm font-semibold text-white transition hover:from-slate-800 hover:to-slate-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {attendanceAction === "checkout" ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <LogOut size={14} />
                  )}
                  Check Out
                </button>
              </div>

              {isOnBreak && todayAttendance?.activeBreakStartedAt ? (
                <p className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-indigo-700">
                  Break running since {formatDateTime(todayAttendance.activeBreakStartedAt)}
                </p>
              ) : null}

              {(todayAttendance?.checkInLocation || todayAttendance?.checkOutLocation) ? (
                <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50/80 px-3 py-2.5">
                    <p className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-700">
                      <MapPin size={12} />
                      Check In Distance
                    </p>
                    <p className="mt-1 text-sm font-semibold text-emerald-900">
                      {formatDistance(todayAttendance?.checkInLocation?.distanceMeters)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-cyan-100 bg-cyan-50/80 px-3 py-2.5">
                    <p className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-700">
                      <MapPin size={12} />
                      Check Out Distance
                    </p>
                    <p className="mt-1 text-sm font-semibold text-cyan-900">
                      {formatDistance(todayAttendance?.checkOutLocation?.distanceMeters)}
                    </p>
                  </div>
                </div>
              ) : null}

              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Break Sessions Today
                </p>
                {todayBreakSessions.length === 0 ? (
                  <p className="mt-1 text-sm text-slate-500">No breaks recorded today.</p>
                ) : (
                  <div className="mt-2 space-y-1.5">
                    {todayBreakSessions.map((session, index) => (
                      <div key={`${session.startAt || "break"}-${index}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                        <span className="text-xs font-semibold text-slate-700">
                          Break {index + 1}
                        </span>
                        <span className="text-xs text-slate-600">
                          {formatDateTime(session.startAt)} - {session.endAt ? formatDateTime(session.endAt) : "Running..."}
                        </span>
                        <span className="text-xs font-semibold text-slate-800">
                          {formatDuration(session.durationMinutes || 0)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_18px_45px_-34px_rgba(15,23,42,0.35)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                Summary
              </p>
              <div className="mt-3 space-y-2">
                {mySummaryCards.map((card) => (
                  <div key={card.key} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/85 px-3 py-2.5">
                    <span className="text-xs font-semibold text-slate-500">{card.label}</span>
                    <span className="text-sm font-semibold text-slate-900">{card.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_18px_45px_-34px_rgba(15,23,42,0.35)]">
            <div className="border-b border-slate-200 px-4 py-3">
              <p className="text-sm font-semibold text-slate-900">My Daily Records</p>
              <p className="mt-0.5 text-[11px] uppercase tracking-[0.12em] text-slate-500">
                Attendance month: {month}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50/85">
                  <tr className="text-left text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Check In</th>
                    <th className="px-4 py-3">Check Out</th>
                    <th className="px-4 py-3">Geofence</th>
                    <th className="px-4 py-3">Break</th>
                    <th className="px-4 py-3">Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {myData.attendance.length === 0 ? (
                    <tr>
                      <td className="px-4 py-4 text-sm text-slate-500" colSpan={7}>
                        No attendance records found for selected month.
                      </td>
                    </tr>
                  ) : (
                    myData.attendance.map((row) => (
                      <tr key={String(row._id || row.attendanceDate)} className="bg-white hover:bg-slate-50/70 transition-colors">
                        <td className="px-4 py-3 text-sm font-semibold text-slate-900">
                          {formatDateLabel(row.attendanceDate)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded-full border px-2 py-1 text-xs font-semibold ${statusBadgeClass(row.status)}`}>
                            {formatAttendanceStatus(row.status)}
                          </span>
                        </td>
                        <td className={`px-4 py-3 ${checkInTimeClass(row.isLateCheckIn)}`}>
                          {formatDateTime(row.checkInAt)}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700">{formatDateTime(row.checkOutAt)}</td>
                        <td className="px-4 py-3 text-xs font-semibold text-slate-600">
                          <div>In: {formatDistance(row.checkInLocation?.distanceMeters)}</div>
                          <div>Out: {formatDistance(row.checkOutLocation?.distanceMeters)}</div>
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-indigo-700">
                          {formatDuration(row.totalBreakMinutes || 0)}
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-slate-900">
                          {formatDuration(row.workedMinutes)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_18px_45px_-34px_rgba(15,23,42,0.35)]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="inline-flex items-center gap-2">
                  <CalendarCheck2 size={16} className="text-emerald-600" />
                  <h3 className="text-base font-semibold text-slate-900">Leave Requests</h3>
                </div>
                <button
                  type="button"
                  onClick={loadLeaveRequestsData}
                  disabled={leaveLoading}
                  className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {leaveLoading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                  Refresh
                </button>
              </div>

              <form className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2" onSubmit={handleSubmitLeaveRequest}>
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  From Date
                  <input
                    type="date"
                    value={leaveForm.fromDate}
                    onChange={(event) =>
                      setLeaveForm((prev) => ({ ...prev, fromDate: event.target.value }))}
                    className="mt-1 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                  />
                </label>
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  To Date
                  <input
                    type="date"
                    value={leaveForm.toDate}
                    onChange={(event) =>
                      setLeaveForm((prev) => ({ ...prev, toDate: event.target.value }))}
                    className="mt-1 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                  />
                </label>
                <label className="sm:col-span-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Leave Type
                  <select
                    value={leaveForm.leaveType}
                    onChange={(event) =>
                      setLeaveForm((prev) => ({ ...prev, leaveType: event.target.value }))}
                    className="mt-1 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                  >
                    {LEAVE_TYPE_OPTIONS.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </label>
                <label className="sm:col-span-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Reason
                  <textarea
                    value={leaveForm.reason}
                    onChange={(event) =>
                      setLeaveForm((prev) => ({ ...prev, reason: event.target.value }))}
                    rows={3}
                    placeholder="Why do you need leave?"
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                  />
                </label>
                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    disabled={leaveSubmitting}
                    className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 px-4 text-sm font-semibold text-white transition hover:from-emerald-700 hover:to-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {leaveSubmitting ? <Loader2 size={14} className="animate-spin" /> : <ClipboardCheck size={14} />}
                    Submit Leave Request
                  </button>
                </div>
              </form>

              <div className="mt-4 max-h-64 space-y-2 overflow-y-auto pr-1">
                {leaveRequests.length === 0 ? (
                  <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                    No leave requests yet.
                  </p>
                ) : (
                  leaveRequests.map((row) => (
                    <div key={String(row._id)} className="rounded-xl border border-slate-200 bg-slate-50/85 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className={`inline-flex items-center rounded-full border px-2 py-1 text-xs font-semibold ${statusBadgeClass(row.status)}`}>
                          {String(row.status || "PENDING").replaceAll("_", " ")}
                        </span>
                        <span className="text-xs font-semibold text-slate-500">
                          {formatDateLabel(row.fromDate)} - {formatDateLabel(row.toDate)}
                        </span>
                      </div>
                      <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                        {row.leaveType || "CASUAL"} | {Number(row.totalDays || 0)} day(s)
                      </p>
                      <p className="mt-1 text-sm text-slate-700">{row.reason || "-"}</p>
                    </div>
                  ))
                )}
              </div>
            </section>

          </div>

            </>
          )}
        </>
      ) : null}

      {isAdminViewer ? (
        <>
          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_18px_45px_-34px_rgba(15,23,42,0.35)]">
            <form onSubmit={handleSaveAttendancePolicy} className="flex flex-col gap-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">Attendance Geofence</h2>
                  <p className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-500">
                    Office range for check-in and check-out
                  </p>
                </div>
                <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={Boolean(policyForm.geofenceEnabled)}
                    onChange={(event) =>
                      setPolicyForm((prev) => ({ ...prev, geofenceEnabled: event.target.checked }))}
                    className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                  />
                  Enable geofence
                </label>
              </div>

              <ToastNotice message={policyError} type="error" />

              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Latitude
                  <input
                    type="number"
                    step="any"
                    value={policyForm.officeLatitude}
                    onChange={(event) =>
                      setPolicyForm((prev) => ({ ...prev, officeLatitude: event.target.value }))}
                    className="mt-1 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                  />
                </label>
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Longitude
                  <input
                    type="number"
                    step="any"
                    value={policyForm.officeLongitude}
                    onChange={(event) =>
                      setPolicyForm((prev) => ({ ...prev, officeLongitude: event.target.value }))}
                    className="mt-1 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                  />
                </label>
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Radius
                  <input
                    type="number"
                    min="10"
                    max="5000"
                    value={policyForm.officeRadiusMeters}
                    onChange={(event) =>
                      setPolicyForm((prev) => ({ ...prev, officeRadiusMeters: event.target.value }))}
                    className="mt-1 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                  />
                </label>
                <div className="flex items-end gap-2">
                  <button
                    type="button"
                    onClick={handleUseCurrentOfficeLocation}
                    disabled={policyLoading || policySaving}
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-300 bg-white text-cyan-700 transition hover:border-cyan-300 hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-60"
                    title="Use current location"
                  >
                    <MapPin size={15} />
                  </button>
                  <button
                    type="submit"
                    disabled={policyLoading || policySaving}
                    className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-emerald-600 px-4 text-sm font-semibold text-white transition hover:from-cyan-700 hover:to-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {policySaving ? <Loader2 size={14} className="animate-spin" /> : <MapPin size={14} />}
                    Save
                  </button>
                </div>
              </div>
            </form>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_18px_45px_-34px_rgba(15,23,42,0.35)]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Team Daily Attendance</h2>
              <p className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-500">
                View all users attendance by date
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                aria-label="Attendance report date"
                type="date"
                value={adminDate}
                onChange={(event) => setAdminDate(event.target.value)}
                className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
              />
              <select
                aria-label="Attendance status filter"
                value={adminStatus}
                onChange={(event) => setAdminStatus(event.target.value)}
                className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
              >
                <option value="">All Statuses</option>
                <option value="WORKING">Working</option>
                <option value="BREAK">Break</option>
                <option value="PRESENT">Present</option>
                <option value="HALF_DAY">Half Day</option>
                <option value="PENDING">Pending</option>
                <option value="LEAVE">Leave</option>
                <option value="ABSENT">Absent</option>
              </select>
              <button
                type="button"
                onClick={() =>
                  loadAdminAttendance({
                    quiet: true,
                    date: adminDate,
                    status: adminStatus,
                  })}
                disabled={adminLoading || adminRefreshing}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {adminRefreshing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                Refresh
              </button>
            </div>
          </div>

          <ToastNotice message={adminError} type="error" />

          {adminLoading ? (
            <div className="mt-4 flex h-32 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-500">
              <Loader2 size={18} className="mr-2 animate-spin" />
              Loading team attendance...
            </div>
          ) : (
            <>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-5">
                <div className="rounded-2xl border border-slate-200 bg-slate-50/85 px-3 py-3">
                  <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Total Users</p>
                  <p className="mt-1 text-xl font-semibold text-slate-900">{Number(adminData.summary?.totalUsers || 0)}</p>
                </div>
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-3">
                  <p className="text-[10px] uppercase tracking-[0.12em] text-emerald-700">Active Login</p>
                  <p className="mt-1 text-xl font-semibold text-emerald-800">
                    {Number(adminData.summary?.activeLogins ?? adminData.summary?.checkedIn ?? 0)}
                  </p>
                </div>
                <div className="rounded-2xl border border-cyan-200 bg-cyan-50 px-3 py-3">
                  <p className="text-[10px] uppercase tracking-[0.12em] text-cyan-700">Checked Out</p>
                  <p className="mt-1 text-xl font-semibold text-cyan-800">{Number(adminData.summary?.checkedOut || 0)}</p>
                </div>
                <div className="rounded-2xl border border-indigo-200 bg-indigo-50 px-3 py-3">
                  <p className="text-[10px] uppercase tracking-[0.12em] text-indigo-700">On Break</p>
                  <p className="mt-1 text-xl font-semibold text-indigo-800">{Number(adminData.summary?.onBreak || 0)}</p>
                </div>
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-3">
                  <p className="text-[10px] uppercase tracking-[0.12em] text-rose-700">Absent</p>
                  <p className="mt-1 text-xl font-semibold text-rose-800">{Number(adminData.summary?.absent || 0)}</p>
                </div>
              </div>

              <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50/85">
                      <tr className="text-left text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
                        <th className="px-4 py-3">User</th>
                        <th className="px-4 py-3">Role</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Check In</th>
                        <th className="px-4 py-3">Check Out</th>
                        <th className="px-4 py-3">Geofence</th>
                        <th className="px-4 py-3">Break</th>
                        <th className="px-4 py-3">Duration</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {adminData.attendance.length === 0 ? (
                        <tr>
                          <td className="px-4 py-4 text-sm text-slate-500" colSpan={8}>
                            No users found for selected filters.
                          </td>
                        </tr>
                      ) : (
                        adminData.attendance.map((row) => (
                          <tr key={String(row.user?._id || "")} className="bg-white hover:bg-slate-50/70 transition-colors">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <Users size={14} className="text-slate-400" />
                                <div>
                                  <p className="text-sm font-semibold text-slate-900">{row.user?.name || "-"}</p>
                                  <p className="text-xs text-slate-500">{row.user?.email || "-"}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              {row.user?._id ? (
                                <button
                                  type="button"
                                  onClick={() => openUserProfile(row.user?._id)}
                                  className="text-left text-xs font-semibold text-cyan-700 underline-offset-2 transition hover:text-cyan-900 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2"
                                  title="Open profile"
                                >
                                  {row.user?.role || "-"}
                                </button>
                              ) : (
                                <span className="text-xs font-semibold text-slate-600">{row.user?.role || "-"}</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-col gap-1">
                                <span className={`inline-flex w-fit items-center rounded-full border px-2 py-1 text-xs font-semibold ${statusBadgeClass(row.attendance?.status)}`}>
                                  {formatAttendanceStatus(row.attendance?.status)}
                                </span>
                                <select
                                  value={
                                    MANUAL_ATTENDANCE_STATUS_OPTIONS.some((option) => option.value === row.attendance?.status)
                                      ? row.attendance?.status
                                      : ""
                                  }
                                  onChange={(event) => handleManualStatusChange(row, event.target.value)}
                                  disabled={manualStatusAction === `${String(row.user?._id || "").trim()}:${String(adminData.date || adminDate || "").trim()}`}
                                  className="h-8 w-32 rounded-lg border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-700 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
                                  title="Manual status"
                                >
                                  <option value="">Manual</option>
                                  {MANUAL_ATTENDANCE_STATUS_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </td>
                            <td className={`px-4 py-3 ${checkInTimeClass(row.attendance?.isLateCheckIn)}`}>
                              {formatDateTime(row.attendance?.checkInAt)}
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-700">
                              {formatDateTime(row.attendance?.checkOutAt)}
                            </td>
                            <td className="px-4 py-3 text-xs font-semibold text-slate-600">
                              <div>In: {formatDistance(row.attendance?.checkInLocation?.distanceMeters)}</div>
                              <div>Out: {formatDistance(row.attendance?.checkOutLocation?.distanceMeters)}</div>
                            </td>
                            <td className="px-4 py-3 text-sm font-semibold text-indigo-700">
                              {formatDuration(row.attendance?.totalBreakMinutes || 0)}
                            </td>
                            <td className="px-4 py-3 text-sm font-semibold text-slate-900">
                              {formatDuration(row.attendance?.workedMinutes || 0)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_18px_45px_-34px_rgba(15,23,42,0.35)]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Approval Queue</h3>
              <p className="mt-0.5 text-xs uppercase tracking-[0.12em] text-slate-500">
                Review leave requests
              </p>
            </div>
            <button
              type="button"
              onClick={loadAdminWorkflowData}
              disabled={adminWorkflowLoading}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {adminWorkflowLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              Refresh Queue
            </button>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/85 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="inline-flex items-center gap-2">
                  <CalendarCheck2 size={15} className="text-emerald-600" />
                  <h4 className="text-sm font-semibold text-slate-900">Leave Approvals</h4>
                </div>
                <select
                  aria-label="Leave approval status filter"
                  value={adminLeaveStatusFilter}
                  onChange={(event) => setAdminLeaveStatusFilter(event.target.value)}
                  className="h-9 rounded-xl border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                >
                  <option value="">All</option>
                  <option value="PENDING">Pending</option>
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>

              <div className="mt-3 space-y-2">
                {adminLeaveRequests.length === 0 ? (
                  <p className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500">
                    No leave requests found.
                  </p>
                ) : (
                  adminLeaveRequests.map((row) => (
                    <div key={String(row._id)} className="rounded-xl border border-slate-200 bg-white p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{row.user?.name || "-"}</p>
                          <p className="text-xs text-slate-500">{row.user?.email || "-"}</p>
                        </div>
                        <span className={`inline-flex items-center rounded-full border px-2 py-1 text-xs font-semibold ${statusBadgeClass(row.status)}`}>
                          {String(row.status || "PENDING").replaceAll("_", " ")}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatDateLabel(row.fromDate)} - {formatDateLabel(row.toDate)} | {row.leaveType || "CASUAL"}
                      </p>
                      <p className="mt-1 text-sm text-slate-700">{row.reason || "-"}</p>

                      {row.status === "PENDING" ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => handleReviewLeave(row._id, "APPROVED")}
                            disabled={Boolean(reviewAction)}
                            className="inline-flex h-8 items-center rounded-lg bg-gradient-to-r from-emerald-600 to-emerald-500 px-3 text-xs font-semibold text-white transition hover:from-emerald-700 hover:to-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReviewLeave(row._id, "REJECTED")}
                            disabled={Boolean(reviewAction)}
                            className="inline-flex h-8 items-center rounded-lg bg-gradient-to-r from-rose-600 to-rose-500 px-3 text-xs font-semibold text-white transition hover:from-rose-700 hover:to-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-slate-500">
                          Reviewed: {formatDateTime(row.reviewedAt)} {row.reviewNote ? `| ${row.reviewNote}` : ""}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
          </section>
        </>
      ) : (
        <div className="flex items-start gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 shadow-sm">
          <Clock3 size={16} className="mt-0.5 text-slate-500" />
          Your role has personal attendance access only. Admin or management can view all users attendance.
        </div>
      )}
    </div>
  );
};

export default AttendanceHub;
