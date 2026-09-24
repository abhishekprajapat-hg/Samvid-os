import AttendanceViolations from "./AttendanceViolations";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart3,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  CheckCircle2,
  Clock,
  Coffee,
  FileText,
  Gauge,
  Hourglass,
  Info,
  Lightbulb,
  Loader2,
  LogIn,
  LogOut,
  MapPin,
  MoreVertical,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  Save,
  Send,
  Sparkles,
  Timer,
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
  manageUserBreak,
  reviewLeaveRequest,
  startBreakAttendance,
  updateAttendancePolicy,
  updateUserAttendanceStatus,
} from "../../services/attendanceService";
import { toErrorMessage } from "../../utils/errorMessage";
import ToastNotice from "../../components/ui/ToastNotice";
import BreakCorrectionDialog from "./BreakCorrectionDialog";

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

const formatDateShort = (value) => {
  if (!value) return "-";
  const [yearRaw, monthRaw, dayRaw] = String(value).split("-");
  const year = Number.parseInt(yearRaw, 10);
  const month = Number.parseInt(monthRaw, 10);
  const day = Number.parseInt(dayRaw, 10);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return formatDateLabel(value);
  }
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return formatDateLabel(value);
  return date.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
};

const formatTimeOnly = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  });
};

const formatDuration = (minutes) => {
  const safeMinutes = Math.max(0, Number(minutes || 0));
  const hours = Math.floor(safeMinutes / 60);
  const mins = safeMinutes % 60;
  return `${hours}h ${mins}m`;
};

const minutesBetween = (from, to) => {
  const start = new Date(from).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(to)) return 0;
  return Math.max(0, Math.floor((to - start) / 60000));
};

const BREAK_TYPE_LABELS = { LUNCH: "Lunch", TEA: "Tea", COFFEE: "Coffee", UTILITY: "Utility" };
const formatBreakType = (value) => BREAK_TYPE_LABELS[value] || "Utility";

// A stable colour per person so the same face keeps the same badge between
// loads. Derived from the name rather than the row index, which would reshuffle
// every time the list is filtered or sorted.
const AVATAR_TONES = ["bg-blue-500", "bg-emerald-500", "bg-violet-500", "bg-amber-500", "bg-rose-500", "bg-cyan-600", "bg-indigo-500", "bg-teal-600"];
const avatarTone = (name = "") => {
  const text = String(name || "?");
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
  return AVATAR_TONES[hash % AVATAR_TONES.length];
};

const getInitials = (name = "") => {
  const parts = String(name || "-").trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "-";
};

const statCardClass = "rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]";
const cardClass = "rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]";
const cardHeaderClass = "flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-3.5";
const cardBodyClass = "p-5";

/*
 * One vocabulary for the page: every heading, stat and tile is an icon in a
 * soft tinted square next to its label. Tints carry meaning rather than
 * decoration - green is attendance, amber is lateness, rose is leave, violet is
 * an average, blue is neutral information - so a glance at the colour already
 * says which family a number belongs to.
 */
const TONES = {
  blue: "bg-blue-50 text-blue-600",
  green: "bg-emerald-50 text-emerald-600",
  amber: "bg-amber-50 text-amber-600",
  rose: "bg-rose-50 text-rose-600",
  violet: "bg-violet-50 text-violet-600",
  slate: "bg-slate-100 text-slate-500",
};

const IconBox = ({ icon, tone = "blue", boxSize = "h-9 w-9", iconSize = 17 }) => {
  const Glyph = icon;
  return (
    <span className={`grid ${boxSize} shrink-0 place-items-center rounded-lg ${TONES[tone] || TONES.blue}`}>
      <Glyph size={iconSize} aria-hidden="true" />
    </span>
  );
};

const SectionHeader = ({ icon, tone, title, subtitle, children }) => (
  <div className={cardHeaderClass}>
    <IconBox icon={icon} tone={tone} />
    <div className="min-w-0 flex-1">
      <h4 className="text-[14px] font-semibold leading-tight text-slate-900">{title}</h4>
      {subtitle ? <p className="mt-0.5 text-[12px] text-slate-500">{subtitle}</p> : null}
    </div>
    {children}
  </div>
);

// Which icon and tint each summary figure wears, keyed by the card's own key so
// the personal and team variants stay in step without a second table.
const STAT_META = {
  presentDays: { icon: Users, tone: "green" },
  checkedIn: { icon: Users, tone: "green" },
  lateDays: { icon: Clock, tone: "amber" },
  onBreak: { icon: Clock, tone: "amber" },
  leaveDays: { icon: CalendarDays, tone: "rose" },
  leave: { icon: CalendarDays, tone: "rose" },
  averageHours: { icon: BarChart3, tone: "violet" },
};
const fieldClass = "h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100";
const secondaryButtonClass = "inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-60";
const primaryButtonClass = "inline-flex items-center justify-center gap-2 rounded-lg border border-blue-700 bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60";
const selectControlClass = "h-9 rounded-lg border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-700 shadow-sm outline-none";

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
  const [showTeamHistory, setShowTeamHistory] = useState(viewerRole === "ADMIN");
  const showPersonalHistory = canUsePersonalAttendance && !showTeamHistory;
  const [breakCorrectionRow, setBreakCorrectionRow] = useState(null);
  const [breakType, setBreakType] = useState("LUNCH");
  const [breakReason, setBreakReason] = useState("");
  // Break type chosen per teammate in the team list, keyed by user id.
  const [teamBreakTypes, setTeamBreakTypes] = useState({});
  const [teamBreakAction, setTeamBreakAction] = useState("");
  const [openRowMenu, setOpenRowMenu] = useState("");
  const [liveNow, setLiveNow] = useState(() => Date.now());
  useEffect(() => { const timer = setInterval(() => setLiveNow(Date.now()), 1000); return () => clearInterval(timer); }, []);

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

  /*
   * A manager can start or end this employee's break from the team list, so the
   * page cannot assume its own actions are the only thing that changes the
   * record. Refreshing quietly every half minute is what makes that appear here
   * without the employee reloading. Skipped while the tab is hidden - nobody is
   * reading it, and a background tab polling all day is pure waste.
   */
  useEffect(() => {
    if (!canUsePersonalAttendance) return undefined;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") loadMyAttendance({ quiet: true });
    }, 30000);
    return () => clearInterval(timer);
  }, [canUsePersonalAttendance, loadMyAttendance]);

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
        required: false,
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
      const result = await startBreakAttendance({ source: "WEB", breakType, note: breakReason });
      setMySuccess(result.message || "Break started");
      setBreakReason("");
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

  // Starts or ends a teammate's break as of now. The employee's own page reads
  // the same attendance record, so it shows up there on its next refresh.
  // A row is busy while either of its two writes is in flight.
  const rowBusy = (row) =>
    manualStatusAction === `${String(row.user?._id || "").trim()}:${String(adminData.date || adminDate || "").trim()}`
    || teamBreakAction === String(row.user?._id || "");

  const handleTeamBreak = async (row, action) => {
    const userId = String(row.user?._id || "");
    if (!userId) return;
    try {
      setTeamBreakAction(userId);
      setAdminError("");
      const result = await manageUserBreak(userId, {
        action,
        ...(action === "START" ? { breakType: teamBreakTypes[userId] || "UTILITY" } : {}),
      });
      setMySuccess(result.message || "Break updated");
      await loadAdminAttendance({ quiet: true });
      // A manager can act on their own row, so refresh the personal panel too.
      if (canUsePersonalAttendance) await loadMyAttendance({ quiet: true });
    } catch (error) {
      setAdminError(toErrorMessage(error, "Failed to update the break"));
    } finally {
      setTeamBreakAction("");
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
  const todayBreakSessions = Array.isArray(todayAttendance?.breakSessions)
    ? todayAttendance.breakSessions
    : [];

  // The stored workedMinutes only advances on check-out, so the live panel ticks
  // its own total from check-in minus every break taken so far.
  const activeBreak = isOnBreak ? todayBreakSessions.at(-1) || null : null;
  const activeBreakMinutes = activeBreak?.startAt
    ? minutesBetween(activeBreak.startAt, liveNow)
    : 0;
  const liveWorkedMinutes =
    todayAttendance?.checkInAt && !todayAttendance?.checkOutAt
      ? Math.max(
          0,
          minutesBetween(todayAttendance.checkInAt, liveNow)
            - todayBreakSessions.reduce(
              (total, session) => total + minutesBetween(session.startAt, session.endAt ? new Date(session.endAt).getTime() : liveNow),
              0,
            ),
        )
      : todayWorkedMinutes;

  const mySummaryCards = useMemo(() => {
    const summary = myData.summary || {};
    const totalDays = Number(summary.totalDays || 0);
    const presentDays = Number(summary.presentDays || 0);
    const workingDays = totalDays || Number(summary.workingDays || 0);
    const averageHours = presentDays
      ? (Number(summary.totalWorkedHours || 0) / presentDays).toFixed(1)
      : "0.0";
    return [
      {
        key: "presentDays",
        label: "Present",
        value: presentDays,
        detail: `of ${workingDays || totalDays} working days`,
      },
      {
        key: "lateDays",
        label: "Late",
        value: Number(summary.lateDays || 0),
        detail: "After 9:30 AM",
      },
      {
        key: "leaveDays",
        label: "Leave taken",
        value: Number(summary.leaveDays || 0),
        detail: `${Math.max(0, 10 - Number(summary.leaveDays || 0))} remaining`,
      },
      {
        key: "averageHours",
        label: "Avg. hours",
        value: averageHours,
        detail: "Target 9.0",
      },
    ];
  }, [myData.summary]);

  /*
   * Three readings of today's team, each a percentage so the bars are
   * comparable. Everything here comes off the rows already loaded - no extra
   * request, and no number that cannot be traced back to the table below it.
   */
  const todayInsights = useMemo(() => {
    const rows = adminData.attendance || [];
    const checkedIn = rows.filter((row) => row.attendance?.checkInAt);
    const onTime = checkedIn.filter((row) => !row.attendance?.isLateCheckIn).length;
    const onTimeRate = checkedIn.length ? Math.round((onTime / checkedIn.length) * 100) : 0;

    const totalUsers = Number(adminData.summary?.totalUsers || 0) || rows.length;
    const attendanceRate = totalUsers ? Math.round((checkedIn.length / totalUsers) * 100) : 0;

    const targetMinutes = 9 * 60;
    const workedRatios = checkedIn.map((row) => Math.min(1, Number(row.attendance?.workedMinutes || 0) / targetMinutes));
    const productivity = workedRatios.length
      ? Math.round((workedRatios.reduce((sum, value) => sum + value, 0) / workedRatios.length) * 100)
      : 0;

    return [
      { label: "On time arrival rate", percent: onTimeRate, value: `${onTimeRate}%`, tone: onTimeRate >= 80 ? "bg-emerald-500" : onTimeRate >= 50 ? "bg-amber-500" : "bg-rose-500" },
      { label: "Attendance vs target", percent: attendanceRate, value: `${attendanceRate}%`, tone: attendanceRate >= 80 ? "bg-emerald-500" : attendanceRate >= 50 ? "bg-amber-500" : "bg-blue-500" },
      { label: "Hours vs 9h target", percent: productivity, value: `${productivity}%`, tone: productivity >= 80 ? "bg-emerald-500" : productivity >= 50 ? "bg-amber-500" : "bg-blue-500" },
    ];
  }, [adminData.attendance, adminData.summary]);

  const adminSummaryCards = useMemo(() => {
    const summary = adminData.summary || {};
    const totalUsers = Number(summary.totalUsers || 0);
    const checkedIn = Number(summary.checkedIn || 0);
    const leave = Number(summary.leave || 0);
    const absent = Number(summary.absent || 0);
    const onBreak = Number(summary.onBreak || 0);
    const workedRows = adminData.attendance
      .map((row) => Number(row.attendance?.workedMinutes || 0))
      .filter((minutes) => minutes > 0);
    const averageHours = workedRows.length
      ? (workedRows.reduce((sum, minutes) => sum + minutes, 0) / workedRows.length / 60).toFixed(1)
      : "0.0";

    return [
      {
        key: "checkedIn",
        label: "Present",
        value: checkedIn,
        detail: `of ${totalUsers} users`,
      },
      {
        key: "onBreak",
        label: "Late",
        value: onBreak,
        detail: "On break now",
      },
      {
        key: "leave",
        label: "Leave taken",
        value: leave,
        detail: `${absent} absent today`,
      },
      {
        key: "averageHours",
        label: "Avg. hours",
        value: averageHours,
        detail: "Visible team rows",
      },
    ];
  }, [adminData.attendance, adminData.summary]);

  const todayDateKey = toLocalDateInputValue(new Date());
  const todayClockLabel = formatTimeOnly(todayAttendance?.checkInAt);
  const pendingAdminLeaveRequests = adminLeaveRequests.filter((row) => row.status === "PENDING");
  const visibleAdminLeaveRequests = pendingAdminLeaveRequests.length
    ? pendingAdminLeaveRequests.slice(0, 2)
    : adminLeaveRequests.slice(0, 2);

  return (
    <div className="attendance-doc-screen ui-page-shell custom-scrollbar bg-slate-50/70 text-slate-900">
      <ToastNotice message={myError} type="error" />
      <ToastNotice message={mySuccess} type="success" />
      <ToastNotice message={adminError} type="error" />

      {/* The command bar above already carries the page title, so this row adds
          only what it does not: where you are, and whose view this is. */}
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[12px] text-slate-400">
          <button type="button" onClick={() => navigate("/")} className="hover:text-slate-600">Home</button>
          <ChevronRight size={13} aria-hidden="true" />
          <span className="font-medium text-slate-600">Attendance</span>
        </nav>
        {isAdminViewer ? (
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-3 py-1.5 text-[12px] font-semibold text-violet-700">
            <Sparkles size={13} aria-hidden="true" />
            Admin View
          </span>
        ) : null}
      </div>

      {myLoading && canUsePersonalAttendance ? (
        <div className={`${cardClass} flex h-40 items-center justify-center text-sm text-slate-500`}>
          <Loader2 size={18} className="mr-2 animate-spin" />
          Loading attendance...
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.5fr_1fr]">
          <div className="flex flex-col gap-4">
            <section className={cardClass}>
              <div className={`${cardBodyClass} flex flex-wrap items-center gap-5`}>
                <div className="min-w-[240px] flex-1">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <IconBox icon={CalendarDays} tone="blue" boxSize="h-8 w-8" iconSize={15} />
                    <span className="text-[14px] font-semibold text-slate-900">
                      Today · {formatDateShort(todayDateKey)}
                    </span>
                    <span className={`ml-auto inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-semibold ${statusBadgeClass(todayStatus)}`}>
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      {canUsePersonalAttendance ? formatAttendanceStatus(todayStatus) : "Admin view"}
                    </span>
                    {isOnBreak ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11.5px] font-semibold text-amber-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        On Break
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-3 font-mono text-[34px] font-semibold leading-none tracking-tight text-slate-950">
                    {canUsePersonalAttendance ? todayClockLabel : formatDateShort(adminDate)}
                  </div>

                  <div className="mt-3.5 flex flex-wrap items-center gap-x-6 gap-y-2">
                    {canUsePersonalAttendance ? (
                      <>
                        <span className="flex items-center gap-2">
                          <MapPin size={15} className="shrink-0 text-slate-400" aria-hidden="true" />
                          <span className="leading-tight">
                            <span className="block text-[11px] text-slate-400">Office radius</span>
                            <strong className="font-mono text-[13px] text-slate-800">
                              {formatDistance(todayAttendance?.checkInLocation?.distanceMeters)}
                            </strong>
                          </span>
                        </span>
                        <span className="flex items-center gap-2">
                          <Timer size={15} className="shrink-0 text-slate-400" aria-hidden="true" />
                          <span className="leading-tight">
                            <span className="block text-[11px] text-slate-400">Elapsed</span>
                            <strong className="font-mono text-[13px] text-slate-800">{formatDuration(liveWorkedMinutes)}</strong>
                          </span>
                        </span>
                      </>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Users size={15} className="shrink-0 text-slate-400" aria-hidden="true" />
                        <span className="text-[12px] text-slate-500">
                          Team attendance · {Number(adminData.summary?.totalUsers || 0)} users
                        </span>
                      </span>
                    )}
                  </div>
                </div>

                {canUsePersonalAttendance ? (
                  <div className="flex flex-wrap gap-2">
                    {canCheckIn ? (
                      <button type="button" onClick={handleCheckIn} disabled={Boolean(attendanceAction)} className={primaryButtonClass}>
                        {attendanceAction === "checkin" ? <Loader2 size={14} className="animate-spin" /> : <LogIn size={14} />}
                        Check in
                      </button>
                    ) : null}
                    {canStartBreak ? (
                      <>
                        <select
                          aria-label="Break type"
                          value={breakType}
                          onChange={(event) => setBreakType(event.target.value)}
                          className={selectControlClass}
                        >
                          <option value="LUNCH">Lunch - 30 minutes</option>
                          <option value="TEA">Tea - 15 minutes</option>
                          <option value="COFFEE">Coffee - 15 minutes</option>
                          <option value="UTILITY">Utility - other reasons</option>
                        </select>
                        {breakType === "UTILITY" ? (
                          <input
                            aria-label="Utility break reason"
                            placeholder="Reason for break"
                            value={breakReason}
                            maxLength={240}
                            onChange={(event) => setBreakReason(event.target.value)}
                            className={selectControlClass}
                          />
                        ) : null}
                      </>
                    ) : null}
                    {canStartBreak ? (
                      <button type="button" onClick={handleStartBreak} disabled={Boolean(attendanceAction)} className={secondaryButtonClass}>
                        {attendanceAction === "breakstart" ? <Loader2 size={14} className="animate-spin" /> : <PauseCircle size={14} />}
                        Start break
                      </button>
                    ) : null}
                    {canEndBreak ? (
                      <button type="button" onClick={handleEndBreak} disabled={Boolean(attendanceAction)} className={secondaryButtonClass}>
                        {attendanceAction === "breakend" ? <Loader2 size={14} className="animate-spin" /> : <PlayCircle size={14} />}
                        End break
                      </button>
                    ) : null}
                    <button type="button" onClick={handleCheckOut} disabled={!canCheckOut || Boolean(attendanceAction)} className={secondaryButtonClass}>
                      {attendanceAction === "checkout" ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
                      Check out
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => loadAdminAttendance({ quiet: true, date: adminDate, status: adminStatus })}
                    disabled={adminLoading || adminRefreshing}
                    className={secondaryButtonClass}
                  >
                    {adminRefreshing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                    Refresh
                  </button>
                )}
              </div>
            </section>

            {canUsePersonalAttendance && <section className={cardClass}>
              <SectionHeader
                icon={Gauge}
                tone="blue"
                title="Live Attendance Summary"
                subtitle="Your work hours and break details for today"
              />
              <div className={`${cardBodyClass} grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4`}>
                <div className="flex items-center gap-2.5">
                  <IconBox icon={Clock} tone="blue" boxSize="h-8 w-8" iconSize={15} />
                  <div className="min-w-0">
                    <p className="text-[11.5px] text-slate-500">Logged hours</p>
                    <strong className="font-mono text-[15px] text-slate-900">{formatDuration(liveWorkedMinutes)}</strong>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <IconBox icon={Coffee} tone="violet" boxSize="h-8 w-8" iconSize={15} />
                  <div className="min-w-0">
                    <p className="text-[11.5px] text-slate-500">Daily breaks</p>
                    <strong className="font-mono text-[15px] text-slate-900">{todayBreakSessions.length}</strong>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${activeBreak ? TONES.amber : TONES.green}`}>
                    <span className="h-2 w-2 rounded-full bg-current" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11.5px] text-slate-500">Current status</p>
                    <strong className="text-[14px] text-slate-900">
                      {activeBreak ? `On ${formatBreakType(activeBreak.breakType).toLowerCase()} break` : "Not on break"}
                    </strong>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <IconBox icon={Hourglass} tone={activeBreak?.expectedMinutes && activeBreakMinutes > activeBreak.expectedMinutes ? "rose" : "slate"} boxSize="h-8 w-8" iconSize={15} />
                  <div className="min-w-0">
                    <p className="text-[11.5px] text-slate-500">Elapsed break</p>
                    <strong className={`font-mono text-[15px] ${activeBreak?.expectedMinutes && activeBreakMinutes > activeBreak.expectedMinutes ? "text-rose-700" : "text-slate-900"}`}>
                      {activeBreak ? `${activeBreakMinutes}m${activeBreak.expectedMinutes ? ` / ${activeBreak.expectedMinutes}m` : ""}` : "—"}
                    </strong>
                  </div>
                </div>
              </div>
            </section>}

            {canUsePersonalAttendance && todayBreakSessions.length ? (
              <section className={cardClass}>
                <SectionHeader
                  icon={Coffee}
                  tone="violet"
                  title="Break Sessions Today"
                  subtitle={`${todayBreakSessions.length} break${todayBreakSessions.length === 1 ? "" : "s"} · ${formatDuration(todayAttendance?.totalBreakMinutes || 0)} total`}
                >
                  <span className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-2.5 py-1.5 text-[11.5px] font-semibold text-blue-700">
                    Total Break Time
                    <span className="font-mono">{formatDuration(todayAttendance?.totalBreakMinutes || 0)}</span>
                  </span>
                </SectionHeader>
                <div className={cardBodyClass}>
                  {/* A timeline rather than a table: these are moments in a day,
                      and the rail makes the sequence readable at a glance. */}
                  <ol className="relative flex flex-col">
                    {todayBreakSessions.map((session, index) => {
                      const minutes = Number(session.durationMinutes || 0);
                      const overran = session.expectedMinutes && minutes > session.expectedMinutes;
                      const running = !session.endAt;
                      return (
                        <li key={`${session.startAt || "break"}-${index}`} className="relative flex flex-wrap items-center gap-3 py-2.5 pl-6 text-[12.8px]">
                          {index < todayBreakSessions.length - 1 ? (
                            <span aria-hidden="true" className="absolute left-[4.5px] top-6 h-full w-px bg-slate-200" />
                          ) : null}
                          <span aria-hidden="true" className={`absolute left-0 top-4 h-2.5 w-2.5 rounded-full ring-2 ring-white ${running ? "bg-amber-500" : "bg-blue-500"}`} />
                          <span className="min-w-[150px] flex-1 font-semibold text-slate-800">
                            {formatBreakType(session.breakType)} break
                            {/* A break a manager recorded should not read as one
                                this person logged themselves. */}
                            {session.correctedByName ? (
                              <span className="block text-[11px] font-normal text-slate-400">Recorded by {session.correctedByName}</span>
                            ) : null}
                          </span>
                          <span className="font-mono text-slate-500">
                            {formatTimeOnly(session.startAt)} &ndash; {running ? "Running" : formatTimeOnly(session.endAt)}
                          </span>
                          <span className={`ml-auto font-mono font-semibold tabular-nums ${overran ? "text-rose-700" : "text-slate-900"}`}>
                            {formatDuration(minutes)}
                            {session.expectedMinutes ? <span className="font-normal text-slate-400"> / {session.expectedMinutes}m</span> : null}
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              </section>
            ) : null}

            <section className={cardClass}>
              <div className={cardHeaderClass}>
                <IconBox icon={CalendarDays} tone="blue" />
                <div className="min-w-0 flex-1">
                  <h4 className="text-[14px] font-semibold leading-tight text-slate-900">
                    {showPersonalHistory ? "Daily Attendance History" : "Team Daily Attendance History"}
                  </h4>
                  <p className="mt-0.5 text-[12px] text-slate-500">
                    {showPersonalHistory ? "View your daily check-in and work hours" : "Check-in, hours and status for your team"}
                  </p>
                </div>
                {isAdminViewer && canUsePersonalAttendance && (
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setShowTeamHistory(false)} aria-pressed={!showTeamHistory} className={secondaryButtonClass}>My attendance</button>
                    <button type="button" onClick={() => setShowTeamHistory(true)} aria-pressed={showTeamHistory} className={secondaryButtonClass}>Team attendance</button>
                  </div>
                )}
                {showPersonalHistory ? (
                  <div className="ml-auto flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                    <input
                      type="month"
                      value={month}
                      onChange={(event) => setMonth(event.target.value)}
                      className="h-8 rounded-md border-0 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => loadMyAttendance({ quiet: true })}
                      disabled={myRefreshing}
                      className="inline-flex h-8 items-center justify-center rounded-md px-2 text-slate-500 transition hover:text-blue-700 disabled:opacity-60"
                      title="Refresh"
                    >
                      {myRefreshing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                    </button>
                  </div>
                ) : (
                  <div className="ml-auto flex flex-wrap gap-2">
                    <input type="date" value={adminDate} onChange={(event) => setAdminDate(event.target.value)} className={fieldClass} />
                    <select value={adminStatus} onChange={(event) => setAdminStatus(event.target.value)} className={fieldClass}>
                      <option value="">All Statuses</option>
                      <option value="WORKING">Working</option>
                      <option value="BREAK">Break</option>
                      <option value="PRESENT">Present</option>
                      <option value="HALF_DAY">Half Day</option>
                      <option value="PENDING">Pending</option>
                      <option value="LEAVE">Leave</option>
                      <option value="ABSENT">Absent</option>
                    </select>
                  </div>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-0 text-[13px]">
                  <thead>
                    <tr className="bg-slate-50 text-left text-[10.5px] font-bold uppercase tracking-[0.07em] text-slate-400">
                      {showPersonalHistory ? (
                        <>
                          <th className="border-b border-slate-200 px-3 py-2.5">Date</th>
                          <th className="border-b border-slate-200 px-3 py-2.5">In</th>
                          <th className="border-b border-slate-200 px-3 py-2.5">Out</th>
                          <th className="border-b border-slate-200 px-3 py-2.5">Hours</th>
                          <th className="border-b border-slate-200 px-3 py-2.5">Status</th>
                          {isAdminViewer ? <th className="border-b border-slate-200 px-3 py-2.5">Location</th> : null}
                        </>
                      ) : (
                        <>
                          <th className="border-b border-slate-200 px-3 py-2.5">User</th>
                          <th className="border-b border-slate-200 px-3 py-2.5">In</th>
                          <th className="border-b border-slate-200 px-3 py-2.5">Out</th>
                          <th className="border-b border-slate-200 px-3 py-2.5">Hours</th>
                          <th className="border-b border-slate-200 px-3 py-2.5">Status</th>
                          <th className="border-b border-slate-200 px-3 py-2.5 text-right">Actions</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {showPersonalHistory ? (
                      myData.attendance.length === 0 ? (
                        <tr>
                          <td className="px-3 py-4 text-sm text-slate-500" colSpan={isAdminViewer ? 6 : 5}>No attendance records found for selected month.</td>
                        </tr>
                      ) : (
                        myData.attendance.map((row) => (
                          <tr key={String(row._id || row.attendanceDate)} className="transition hover:bg-slate-50">
                            <td className="border-b border-slate-100 px-3 py-2.5 font-semibold text-slate-900">{formatDateShort(row.attendanceDate)}</td>
                            <td className={`border-b border-slate-100 px-3 py-2.5 font-mono ${row.isLateCheckIn ? "font-semibold text-rose-700" : "text-slate-700"}`}>{formatTimeOnly(row.checkInAt)}</td>
                            <td className="border-b border-slate-100 px-3 py-2.5 font-mono text-slate-500">{formatTimeOnly(row.checkOutAt)}</td>
                            <td className="border-b border-slate-100 px-3 py-2.5 font-mono text-slate-600">{formatDuration(row.workedMinutes)}</td>
                            <td className="border-b border-slate-100 px-3 py-2.5">
                              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11.5px] font-semibold ${statusBadgeClass(row.status)}`}>
                                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                                {formatAttendanceStatus(row.status)}
                              </span>
                            </td>
                            {isAdminViewer ? (
                              <td className="border-b border-slate-100 px-3 py-2.5 text-xs text-slate-500">
                                In {formatDistance(row.checkInLocation?.distanceMeters)} · Out {formatDistance(row.checkOutLocation?.distanceMeters)}
                              </td>
                            ) : null}
                          </tr>
                        ))
                      )
                    ) : adminLoading ? (
                      <tr>
                        <td className="px-3 py-4 text-sm text-slate-500" colSpan={6}>
                          <Loader2 size={16} className="mr-2 inline animate-spin" />
                          Loading team attendance...
                        </td>
                      </tr>
                    ) : adminData.attendance.length === 0 ? (
                      <tr>
                        <td className="px-3 py-4 text-sm text-slate-500" colSpan={6}>No users found for selected filters.</td>
                      </tr>
                    ) : (
                      adminData.attendance.map((row) => (
                        <tr key={String(row.user?._id || "")} className="transition hover:bg-slate-50">
                          <td className="border-b border-slate-100 px-3 py-2.5">
                            <div className="flex items-center gap-2.5">
                              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-[11.5px] font-bold text-white ${avatarTone(row.user?.name)}`}>
                                {getInitials(row.user?.name)}
                              </span>
                              <div className="min-w-0">
                                <button type="button" onClick={() => openUserProfile(row.user?._id)} className="block max-w-[170px] truncate text-left font-semibold text-slate-900 transition hover:text-blue-700">
                                  {row.user?.name || "-"}
                                </button>
                                {/* Role reads as a label under the name; it used to be
                                    the placeholder of the status select, where a long
                                    one truncated to "PRODUCT". */}
                                <span className="block max-w-[170px] truncate text-[11px] capitalize text-slate-400">
                                  {String(row.user?.role || "").replaceAll("_", " ").toLowerCase() || "-"}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className={`border-b border-slate-100 px-3 py-2.5 font-mono ${row.attendance?.isLateCheckIn ? "font-semibold text-rose-700" : "text-slate-700"}`}>{formatTimeOnly(row.attendance?.checkInAt)}</td>
                          <td className="border-b border-slate-100 px-3 py-2.5 font-mono text-slate-500">{formatTimeOnly(row.attendance?.checkOutAt)}</td>
                          <td className="border-b border-slate-100 px-3 py-2.5 font-mono text-slate-600">{formatDuration(row.attendance?.workedMinutes || 0)}</td>
                          <td className="border-b border-slate-100 px-3 py-2.5">
                            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11.5px] font-semibold ${statusBadgeClass(row.attendance?.status)}`}>
                              <span className="h-1.5 w-1.5 rounded-full bg-current" />
                              {formatAttendanceStatus(row.attendance?.status)}
                            </span>
                          </td>
                          <td className="border-b border-slate-100 px-3 py-2.5">
                            <div className="flex items-center justify-end gap-1.5">
                              {row.attendance?.checkInAt ? (
                                /* Native select arrows are sized by the browser and
                                   were clipping the label, so the chevron is ours. */
                                <span className="relative inline-flex">
                                  <select
                                    value={MANUAL_ATTENDANCE_STATUS_OPTIONS.some((option) => option.value === row.attendance?.status) ? row.attendance?.status : ""}
                                    onChange={(event) => handleManualStatusChange(row, event.target.value)}
                                    disabled={rowBusy(row)}
                                    className="h-8 appearance-none rounded-lg border border-blue-600 bg-blue-600 pl-3 pr-7 text-xs font-semibold text-white outline-none disabled:opacity-60"
                                    title="Set attendance manually"
                                  >
                                    <option value="">Set Status</option>
                                    {MANUAL_ATTENDANCE_STATUS_OPTIONS.map((option) => (
                                      <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                  </select>
                                  <ChevronDown aria-hidden="true" size={13} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-white" />
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleManualStatusChange(row, "PRESENT")}
                                  disabled={rowBusy(row)}
                                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                                  title="Mark this employee present for the day"
                                >
                                  {rowBusy(row) ? <Loader2 size={12} className="animate-spin" /> : null}
                                  Mark Present
                                </button>
                              )}

                              {/* Break controls live behind the kebab: they matter
                                  on a handful of rows, and inline they crowded out
                                  the column on every one. */}
                              <span className="relative inline-flex">
                                <button
                                  type="button"
                                  aria-label={`More actions for ${row.user?.name || "employee"}`}
                                  aria-expanded={openRowMenu === String(row.user?._id || "")}
                                  onClick={() => setOpenRowMenu((current) => (current === String(row.user?._id || "") ? "" : String(row.user?._id || "")))}
                                  className="grid h-8 w-8 place-items-center rounded-lg border border-slate-300 bg-white text-slate-500 transition hover:bg-slate-50"
                                >
                                  <MoreVertical size={15} />
                                </button>
                                {openRowMenu === String(row.user?._id || "") ? (
                                  <>
                                    <button type="button" aria-label="Close menu" className="fixed inset-0 z-10 cursor-default" onClick={() => setOpenRowMenu("")} />
                                    <div className="absolute right-0 top-9 z-20 w-56 rounded-xl border border-slate-200 bg-white p-2 text-left shadow-lg">
                                      {!row.attendance?.checkInAt ? (
                                        <p className="px-2 py-1.5 text-[11.5px] text-slate-400">Not checked in today.</p>
                                      ) : null}

                                      {row.attendance?.checkInAt && !row.attendance?.checkOutAt ? (
                                        row.attendance?.isOnBreak ? (
                                          <button
                                            type="button"
                                            onClick={() => { setOpenRowMenu(""); handleTeamBreak(row, "END"); }}
                                            disabled={teamBreakAction === String(row.user?._id || "")}
                                            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-[12.5px] font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
                                          >
                                            <PlayCircle size={14} />
                                            End break
                                            <span className="ml-auto font-mono text-[11.5px] font-normal tabular-nums text-slate-400">
                                              {minutesBetween(row.attendance?.activeBreakStartedAt, liveNow)}m
                                            </span>
                                          </button>
                                        ) : (
                                          <div className="px-2 py-1.5">
                                            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">Start a break</span>
                                            <div className="flex items-center gap-1.5">
                                              <span className="relative inline-flex flex-1">
                                                <select
                                                  aria-label={`Break type for ${row.user?.name || "employee"}`}
                                                  value={teamBreakTypes[String(row.user?._id || "")] || "UTILITY"}
                                                  onChange={(event) => setTeamBreakTypes((value) => ({ ...value, [String(row.user?._id || "")]: event.target.value }))}
                                                  className="h-8 w-full appearance-none rounded-lg border border-slate-300 bg-white pl-2 pr-6 text-xs font-semibold text-slate-700 outline-none"
                                                >
                                                  <option value="UTILITY">Utility</option>
                                                  <option value="LUNCH">Lunch</option>
                                                  <option value="TEA">Tea</option>
                                                  <option value="COFFEE">Coffee</option>
                                                </select>
                                                <ChevronDown aria-hidden="true" size={12} className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                              </span>
                                              <button
                                                type="button"
                                                onClick={() => { setOpenRowMenu(""); handleTeamBreak(row, "START"); }}
                                                disabled={teamBreakAction === String(row.user?._id || "")}
                                                className="inline-flex h-8 items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2.5 text-xs font-semibold text-amber-800 disabled:opacity-60"
                                              >
                                                <PauseCircle size={13} />
                                                Start
                                              </button>
                                            </div>
                                          </div>
                                        )
                                      ) : null}

                                      {row.attendance?.checkInAt ? (
                                        <button
                                          type="button"
                                          onClick={() => { setOpenRowMenu(""); setBreakCorrectionRow(row); }}
                                          className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-[12.5px] font-semibold text-slate-700 hover:bg-slate-50"
                                        >
                                          <Timer size={14} className="text-slate-400" />
                                          Manage breaks
                                        </button>
                                      ) : null}

                                      <button
                                        type="button"
                                        onClick={() => { setOpenRowMenu(""); openUserProfile(row.user?._id); }}
                                        className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-[12.5px] font-semibold text-slate-700 hover:bg-slate-50"
                                      >
                                        <Users size={14} className="text-slate-400" />
                                        Open profile
                                      </button>
                                    </div>
                                  </>
                                ) : null}
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <AttendanceViolations month={month} canReview={isAdminViewer} />

            {breakCorrectionRow && isAdminViewer && (
              <BreakCorrectionDialog
                row={breakCorrectionRow}
                date={adminData.date || adminDate}
                onClose={() => setBreakCorrectionRow(null)}
                onSaved={() => {
                  setBreakCorrectionRow(null);
                  setMySuccess("Break saved. The correction has been recorded in the audit history.");
                  loadAdminAttendance({ quiet: true });
                  if (canUsePersonalAttendance) loadMyAttendance({ quiet: true });
                }}
              />
            )}

          </div>

          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(canUsePersonalAttendance ? mySummaryCards : adminSummaryCards).map((card) => {
                const meta = STAT_META[card.key] || { icon: Gauge, tone: "blue" };
                return (
                  <div key={card.key} className={`${statCardClass} flex items-start gap-3`}>
                    <IconBox icon={meta.icon} tone={meta.tone} boxSize="h-10 w-10" iconSize={18} />
                    <div className="min-w-0">
                      <div className="text-[12px] font-semibold text-slate-500">{card.label}</div>
                      <div className="mt-1 font-mono text-[24px] font-semibold leading-none tracking-normal text-slate-950">{card.value}</div>
                      <div className="mt-1.5 truncate text-[11.5px] text-slate-400">{card.detail}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {canUsePersonalAttendance ? (
              <section className={cardClass}>
                <SectionHeader
                  icon={FileText}
                  tone="blue"
                  title="Leave Requests"
                  subtitle="Apply for leave or view your recent requests"
                >
                  <button type="button" onClick={loadLeaveRequestsData} disabled={leaveLoading} className="ml-auto text-xs font-semibold text-blue-600 transition hover:text-blue-800 disabled:opacity-60">
                    {leaveLoading ? "Loading" : "New request"}
                  </button>
                </SectionHeader>
                <div className={cardBodyClass}>
                  <form className="grid grid-cols-1 gap-2 sm:grid-cols-2" onSubmit={handleSubmitLeaveRequest}>
                    <input type="date" value={leaveForm.fromDate} onChange={(event) => setLeaveForm((prev) => ({ ...prev, fromDate: event.target.value }))} className={fieldClass} aria-label="Leave from date" />
                    <input type="date" value={leaveForm.toDate} onChange={(event) => setLeaveForm((prev) => ({ ...prev, toDate: event.target.value }))} className={fieldClass} aria-label="Leave to date" />
                    <select value={leaveForm.leaveType} onChange={(event) => setLeaveForm((prev) => ({ ...prev, leaveType: event.target.value }))} className={`${fieldClass} sm:col-span-2`} aria-label="Leave type">
                      {LEAVE_TYPE_OPTIONS.map((type) => (<option key={type} value={type}>{type}</option>))}
                    </select>
                    <textarea
                      value={leaveForm.reason}
                      onChange={(event) => setLeaveForm((prev) => ({ ...prev, reason: event.target.value }))}
                      rows={2}
                      placeholder="Reason"
                      className="sm:col-span-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    />
                    <button type="submit" disabled={leaveSubmitting} className={`${primaryButtonClass} sm:col-span-2`}>
                      {leaveSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                      Submit Request
                    </button>
                  </form>

                  <div className="mt-4 flex flex-col divide-y divide-slate-100">
                    {leaveRequests.length === 0 ? (
                      <div className="py-2 text-[12.8px] text-slate-500">No leave requests yet.</div>
                    ) : (
                      leaveRequests.slice(0, 3).map((row) => (
                        <div key={String(row._id)} className="flex items-center gap-3 py-2">
                          <div className="min-w-0">
                            <b className="block truncate text-[12.8px] font-semibold text-slate-900">{String(row.leaveType || "CASUAL").replaceAll("_", " ")} · {formatDateShort(row.fromDate)}</b>
                            <div className="truncate text-[11.5px] text-slate-500">{row.reason || "-"}</div>
                          </div>
                          <span className={`ml-auto inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11.5px] font-semibold ${statusBadgeClass(row.status)}`}>
                            <span className="h-1.5 w-1.5 rounded-full bg-current" />
                            {String(row.status || "PENDING").replaceAll("_", " ")}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </section>
            ) : null}

            {isAdminViewer ? (
              <section className={cardClass}>
                <div className={cardHeaderClass}>
                  <h4 className="flex-1 text-[14px] font-semibold text-slate-900">Team Approvals</h4>
                  {/* Two tabs rather than a five-option select: pending is the
                      queue you act on, everything else is history. */}
                  <div className="inline-flex rounded-lg bg-slate-100 p-0.5" role="group" aria-label="Approval view">
                    {[["PENDING", "Pending"], ["", "History"]].map(([value, label]) => (
                      <button
                        key={label}
                        type="button"
                        aria-pressed={adminLeaveStatusFilter === value}
                        onClick={() => setAdminLeaveStatusFilter(value)}
                        className={`rounded-md px-3 py-1 text-[12px] font-semibold transition ${
                          adminLeaveStatusFilter === value ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
                        }`}
                      >
                        {label}
                        {value === "PENDING" && pendingAdminLeaveRequests.length ? (
                          <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 text-[10.5px] text-amber-700">{pendingAdminLeaveRequests.length}</span>
                        ) : null}
                      </button>
                    ))}
                  </div>
                </div>
                <div className={cardBodyClass}>
                  <div className="flex flex-col divide-y divide-slate-100">
                    {adminWorkflowLoading ? (
                      <div className="py-2 text-[12.8px] text-slate-500"><Loader2 size={16} className="mr-2 inline animate-spin" />Loading approvals...</div>
                    ) : visibleAdminLeaveRequests.length === 0 ? (
                      <div className="flex flex-col items-center gap-2 py-8 text-center">
                        <span className="grid h-12 w-12 place-items-center rounded-xl bg-slate-100 text-slate-400">
                          <FileText size={22} aria-hidden="true" />
                        </span>
                        <p className="text-[12.8px] font-semibold text-slate-600">No leave requests found.</p>
                        <p className="text-[11.5px] text-slate-400">
                          {adminLeaveStatusFilter === "PENDING" ? "All team members are in office today." : "Nothing in the history for this filter."}
                        </p>
                      </div>
                    ) : (
                      visibleAdminLeaveRequests.map((row) => (
                        <div key={String(row._id)} className="flex flex-wrap items-center gap-3 py-2">
                          <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-blue-100 text-[9px] font-bold text-blue-700">{getInitials(row.user?.name)}</div>
                          <div className="min-w-[120px] flex-1">
                            <b className="block text-[12.5px] font-semibold text-slate-900">{row.user?.name || "-"}</b>
                            <div className="text-[11.5px] text-slate-500">{String(row.leaveType || "CASUAL").replaceAll("_", " ")} · {formatDateShort(row.fromDate)}</div>
                          </div>
                          {row.status === "PENDING" ? (
                            <div className="ml-auto flex gap-1.5">
                              <button type="button" onClick={() => handleReviewLeave(row._id, "APPROVED")} disabled={Boolean(reviewAction)} className="rounded-lg border border-blue-700 bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60">Approve</button>
                              <button type="button" onClick={() => handleReviewLeave(row._id, "REJECTED")} disabled={Boolean(reviewAction)} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-rose-300 hover:text-rose-700 disabled:opacity-60">Reject</button>
                            </div>
                          ) : (
                            <span className={`ml-auto inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11.5px] font-semibold ${statusBadgeClass(row.status)}`}>
                              <span className="h-1.5 w-1.5 rounded-full bg-current" />
                              {String(row.status || "PENDING").replaceAll("_", " ")}
                            </span>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </section>
            ) : null}

            {isAdminViewer ? (
              <section className={cardClass}>
                <form onSubmit={handleSaveAttendancePolicy}>
                  <div className={cardHeaderClass}>
                    <h4 className="flex-1 text-[14px] font-semibold text-slate-900">Attendance Policy</h4>
                    <label className="inline-flex items-center gap-2 text-[12px] font-semibold text-slate-600">
                      <input type="checkbox" checked={Boolean(policyForm.geofenceEnabled)} onChange={(event) => setPolicyForm((prev) => ({ ...prev, geofenceEnabled: event.target.checked }))} className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                      Geofence
                    </label>
                  </div>
                  <div className={`${cardBodyClass} space-y-3`}>
                    <ToastNotice message={policyError} type="error" />
                    <div className="grid grid-cols-2 gap-3">
                      <label className="block">
                        <span className="mb-1 block text-[11.5px] text-slate-500">Office Latitude</span>
                        <input type="number" step="any" value={policyForm.officeLatitude} onChange={(event) => setPolicyForm((prev) => ({ ...prev, officeLatitude: event.target.value }))} className={fieldClass} aria-label="Office latitude" />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-[11.5px] text-slate-500">Office Longitude</span>
                        <input type="number" step="any" value={policyForm.officeLongitude} onChange={(event) => setPolicyForm((prev) => ({ ...prev, officeLongitude: event.target.value }))} className={fieldClass} aria-label="Office longitude" />
                      </label>
                    </div>
                    <label className="block">
                      <span className="mb-1 block text-[11.5px] text-slate-500">Allowed Radius (meters)</span>
                      <input type="number" min="10" max="5000" value={policyForm.officeRadiusMeters} onChange={(event) => setPolicyForm((prev) => ({ ...prev, officeRadiusMeters: event.target.value }))} className={fieldClass} aria-label="Office radius" />
                    </label>
                    <div className="flex gap-2">
                      <button type="button" onClick={handleUseCurrentOfficeLocation} disabled={policyLoading || policySaving} className={secondaryButtonClass}>
                        <MapPin size={14} />
                        Use current
                      </button>
                      <button type="submit" disabled={policyLoading || policySaving} className={`${primaryButtonClass} flex-1`}>
                        {policySaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        Save
                      </button>
                    </div>
                  </div>
                </form>
              </section>
            ) : null}

            {isAdminViewer ? (
              <section className={cardClass}>
                <div className={cardHeaderClass}>
                  <IconBox icon={Lightbulb} tone="amber" boxSize="h-8 w-8" iconSize={15} />
                  <h4 className="text-[14px] font-semibold text-slate-900">Today&rsquo;s Insights</h4>
                </div>
                <div className={`${cardBodyClass} space-y-3`}>
                  {todayInsights.map((insight) => (
                    <div key={insight.label} className="flex items-center gap-3">
                      <span className="min-w-0 flex-1 truncate text-[12.5px] text-slate-600">{insight.label}</span>
                      <span className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                        <span className={`block h-full rounded-full ${insight.tone}`} style={{ width: `${insight.percent}%` }} />
                      </span>
                      <span className="w-12 shrink-0 text-right font-mono text-[12px] font-semibold text-slate-800">{insight.value}</span>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        </div>
      )}

      {isAdminViewer ? (
        <p className="mt-4 flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3.5 text-[12.5px] text-blue-900">
          <Info size={15} className="mt-px shrink-0" aria-hidden="true" />
          <span>
            Tip: team members can only check in within the allowed office radius.
            Break time is excluded from total working hours, and check-out works from anywhere.
          </span>
        </p>
      ) : null}
    </div>
  );
};

export default AttendanceHub;
