import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Award,
  Briefcase,
  Building2,
  CalendarDays,
  CheckSquare,
  Clock,
  FolderKanban,
  Hash,
  ListTodo,
  Loader2,
  LogIn,
  MapPin,
  RefreshCw,
  Save,
  Star,
  Target,
  TrendingUp,
  UserCircle2,
} from "lucide-react";
import {
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  XAxis,
} from "recharts";
import { useNavigate, useParams } from "react-router-dom";
import {
  getUserProfileById,
  getUsers,
  updateUserByAdmin,
} from "../../services/userService";
import {
  getAdminLeaveRequests,
  getLeaveBalanceForAdmin,
  getUserAttendanceForAdmin,
} from "../../services/attendanceService";
import { getTasks } from "../../services/taskService";
import { getProjectsWithMeta } from "../../services/projectService";
import { toErrorMessage } from "../../utils/errorMessage";
import ToastNotice from "../../components/ui/ToastNotice";

const REPORTING_PARENT_ROLES = {
  MANAGER: ["ADMIN"],
  EXECUTIVE: ["MANAGER"],
  FIELD_EXECUTIVE: ["MANAGER"],
  PRODUCTION_EXECUTIVE: ["MANAGER"],
  COMMUNITY_MANAGER: ["MANAGER"],
  CHANNEL_PARTNER: ["MANAGER"],
  COWORKING_ADMIN: ["ADMIN"],
};

const ROLE_LABELS = {
  ADMIN: "Admin",
  MANAGER: "Manager",
  EXECUTIVE: "Executive",
  FIELD_EXECUTIVE: "Field Executive",
  PRODUCTION_EXECUTIVE: "Production Executive",
  COMMUNITY_MANAGER: "Community Manager",
  CHANNEL_PARTNER: "Channel Partner",
  COWORKING_ADMIN: "Coworking admin",
};
const BROKERAGE_MODE_OPTIONS = [
  { label: "Flat per closed deal", value: "FLAT" },
  { label: "Percentage of sell value", value: "PERCENTAGE" },
];
const DEFAULT_BROKERAGE_VALUE = 50000;
const DEFAULT_BROKERAGE_PERCENTAGE = 2;
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const ATTENDANCE_STATUS_STYLES = {
  PRESENT: "border-emerald-200 bg-emerald-50 text-emerald-800",
  WORKING: "border-emerald-200 bg-emerald-50 text-emerald-800",
  BREAK: "border-indigo-200 bg-indigo-50 text-indigo-800",
  HALF_DAY: "border-blue-200 bg-blue-50 text-blue-800",
  ABSENT: "border-rose-200 bg-rose-50 text-rose-800",
  LEAVE: "border-teal-200 bg-teal-50 text-teal-800",
  PENDING: "border-amber-200 bg-amber-50 text-amber-800",
};
const TASK_STATUS_LABELS = {
  BACKLOG: "Backlog",
  TODO: "To Do",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
};
const TASK_STATUS_STYLES = {
  BACKLOG: "border-slate-300 bg-slate-50 text-slate-600",
  TODO: "border-sky-200 bg-sky-50 text-sky-700",
  IN_PROGRESS: "border-amber-200 bg-amber-50 text-amber-700",
  COMPLETED: "border-emerald-200 bg-emerald-50 text-emerald-700",
};
const TASK_PRIORITY_STYLES = {
  LOW: "border-blue-200 bg-blue-50 text-blue-700",
  MEDIUM: "border-amber-200 bg-amber-50 text-amber-700",
  HIGH: "border-rose-200 bg-rose-50 text-rose-700",
};

const LEAVE_TYPE_LABELS = {
  CASUAL: "Casual Leave",
  SICK: "Sick Leave",
  EMERGENCY: "Emergency Leave",
  UNPAID: "Unpaid Leave",
  OTHER: "Other Leave",
};

const PROJECT_STATUS_BUCKETS = {
  upcoming: ["PRE_LAUNCH", "TNC", "RERA_APPROVED"],
  active: ["UNDER_CONSTRUCTION"],
  completed: ["READY_TO_MOVE", "RESALE"],
};

const CHART_COLORS = {
  emerald: "#10b981",
  blue: "#3b82f6",
  teal: "#14b8a6",
  rose: "#f43f5e",
  amber: "#f59e0b",
  slate: "#94a3b8",
  cyan: "#06b6d4",
  violet: "#8b5cf6",
};

const getEntityId = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  return String(value._id || value.id || "");
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

const formatDateOnly = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
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

const formatDuration = (minutes) => {
  const safeMinutes = Math.max(0, Number(minutes || 0));
  const hours = Math.floor(safeMinutes / 60);
  const mins = safeMinutes % 60;
  return `${hours}h ${mins}m`;
};

const toHours = (minutes) => Math.round((Math.max(0, Number(minutes || 0)) / 60) * 10) / 10;

const averageClockTime = (dates = []) => {
  const valid = dates
    .filter(Boolean)
    .map((value) => new Date(value))
    .filter((date) => !Number.isNaN(date.getTime()));
  if (!valid.length) return "-";

  const avgMinutes = valid.reduce((sum, date) => sum + date.getHours() * 60 + date.getMinutes(), 0) / valid.length;
  const hours24 = Math.floor(avgMinutes / 60) % 24;
  const minutes = Math.round(avgMinutes % 60);
  const period = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${String(minutes).padStart(2, "0")} ${period}`;
};

const formatAttendanceStatus = (status) => {
  const normalized = String(status || "").trim().toUpperCase();
  if (normalized === "PRESENT") return "Present";
  if (normalized === "WORKING") return "Working";
  if (normalized === "BREAK") return "Break";
  if (!normalized) return "";
  return normalized.replaceAll("_", " ");
};

const attendanceStatusClass = (status, isDarkTheme) =>
  ATTENDANCE_STATUS_STYLES[String(status || "").trim().toUpperCase()]
  || (isDarkTheme
    ? "border-slate-700 bg-slate-900 text-slate-300"
    : "border-slate-200 bg-white text-slate-600");

const buildMonthCalendarDays = (monthKey) => {
  const [yearRaw, monthRaw] = String(monthKey || "").split("-");
  const year = Number.parseInt(yearRaw, 10);
  const month = Number.parseInt(monthRaw, 10);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return [];

  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0).getDate();
  const leadingEmpty = firstDay.getDay();
  const days = [];

  for (let index = 0; index < leadingEmpty; index += 1) {
    days.push({ key: `empty-${index}`, dateKey: "", day: "" });
  }

  for (let day = 1; day <= lastDay; day += 1) {
    const dateKey = `${monthKey}-${String(day).padStart(2, "0")}`;
    days.push({
      key: dateKey,
      dateKey,
      day,
      isSunday: new Date(year, month - 1, day).getDay() === 0,
    });
  }

  return days;
};

const safeReadCurrentUserId = () => {
  try {
    const row = JSON.parse(localStorage.getItem("user") || "{}");
    return String(row?._id || row?.id || "").trim();
  } catch {
    return "";
  }
};

const normalizeBrokerageMode = (value) =>
  String(value || "").trim().toUpperCase() === "PERCENTAGE" ? "PERCENTAGE" : "FLAT";

const normalizeBrokerageFormState = (config = null) => {
  const mode = normalizeBrokerageMode(config?.mode);
  const fallbackValue = mode === "PERCENTAGE"
    ? DEFAULT_BROKERAGE_PERCENTAGE
    : DEFAULT_BROKERAGE_VALUE;
  const parsedValue = Number(config?.value);

  return {
    brokerageMode: mode,
    brokerageValue: Number.isFinite(parsedValue) ? String(parsedValue) : String(fallbackValue),
    brokerageNotes: String(config?.notes || ""),
  };
};

const StatTile = ({ label, value, isDarkTheme, tone }) => (
  <div
    className={`rounded-lg border px-2.5 py-2 ${
      isDarkTheme ? "border-slate-700 bg-slate-950/70 text-slate-100" : "border-slate-200 bg-slate-50 text-slate-800"
    }`}
  >
    <p className={`text-[9px] font-semibold uppercase tracking-[0.1em] opacity-70 ${tone || ""}`}>{label}</p>
    <p className="mt-0.5 text-base font-bold">{value}</p>
  </div>
);

const DashboardCard = ({ title, icon: Icon, isDarkTheme, action, children, className = "" }) => (
  <div
    className={`flex flex-col rounded-xl border p-3 ${className} ${
      isDarkTheme ? "border-slate-700 bg-slate-900/75" : "border-slate-200 bg-white"
    }`}
  >
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-1.5">
        {Icon ? <Icon size={14} className={isDarkTheme ? "text-cyan-300" : "text-cyan-700"} /> : null}
        <h4 className={`text-xs font-bold uppercase tracking-wide ${isDarkTheme ? "text-slate-100" : "text-slate-900"}`}>
          {title}
        </h4>
      </div>
      {action}
    </div>
    <div className="mt-2.5 flex-1">{children}</div>
  </div>
);

const UserDetailsEditor = ({ theme = "light" }) => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const isDarkTheme = theme === "dark";
  const currentUserId = safeReadCurrentUserId();

  const nameInputRef = useRef(null);
  const attendanceSectionRef = useRef(null);
  const taskSectionRef = useRef(null);
  const performanceSectionRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [profile, setProfile] = useState(null);
  const [performance, setPerformance] = useState(null);
  const [users, setUsers] = useState([]);
  const [showAttendanceDetail, setShowAttendanceDetail] = useState(false);
  const [showTaskDetail, setShowTaskDetail] = useState(false);

  const [attendanceMonth, setAttendanceMonth] = useState(toMonthInputValue(new Date()));
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceData, setAttendanceData] = useState({
    timezone: "",
    from: "",
    to: "",
    summary: {},
    attendance: [],
  });
  const [tasks, setTasks] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [taskStatusFilter, setTaskStatusFilter] = useState("");

  const [leaveBalance, setLeaveBalance] = useState(null);
  const [leaveBalanceLoading, setLeaveBalanceLoading] = useState(false);
  const [leaveTypeRows, setLeaveTypeRows] = useState([]);

  const [projectRows, setProjectRows] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    roleType: "COMMERCIAL",
    role: "MANAGER",
    reportingToId: "",
    isActive: true,
    canViewInventory: false,
    department: "",
    branch: "",
    shiftTiming: "",
    monthlyTarget: "10",
    ...normalizeBrokerageFormState(null),
    password: "",
  });

  const loadData = useCallback(async () => {
    if (!userId) return;

    try {
      setLoading(true);
      setError("");

      const [profileData, usersData] = await Promise.all([
        getUserProfileById(userId),
        getUsers(),
      ]);

      const resolvedProfile = profileData?.profile || null;
      const rows = Array.isArray(usersData?.users) ? usersData.users : [];

      if (!resolvedProfile) {
        setProfile(null);
        setUsers(rows);
        return;
      }

      setProfile(resolvedProfile);
      setPerformance(profileData?.performance || null);
      setUsers(rows);
      setFormData({
        name: resolvedProfile.name || "",
        email: resolvedProfile.email || "",
        phone: resolvedProfile.phone || "",
        roleType: resolvedProfile.roleType || "COMMERCIAL",
        role: resolvedProfile.role || "MANAGER",
        reportingToId: getEntityId(resolvedProfile.parentId),
        isActive: Boolean(resolvedProfile.isActive),
        canViewInventory: Boolean(resolvedProfile.canViewInventory),
        department: resolvedProfile.department || "",
        branch: resolvedProfile.branch || "",
        shiftTiming: resolvedProfile.shiftTiming || "",
        monthlyTarget: String(Number.isFinite(resolvedProfile.monthlyTarget) ? resolvedProfile.monthlyTarget : 10),
        ...normalizeBrokerageFormState(resolvedProfile.brokerageConfig),
        password: "",
      });
    } catch (loadError) {
      setError(toErrorMessage(loadError, "Failed to load user details"));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const loadAttendanceCalendar = useCallback(async () => {
    if (!userId) return;

    try {
      setAttendanceLoading(true);
      const payload = await getUserAttendanceForAdmin(userId, { month: attendanceMonth });
      setAttendanceData({
        timezone: payload.timezone || "",
        from: payload.from || "",
        to: payload.to || "",
        summary: payload.summary || {},
        attendance: Array.isArray(payload.attendance) ? payload.attendance : [],
      });
    } catch (attendanceError) {
      setError(toErrorMessage(attendanceError, "Failed to load attendance calendar"));
      setAttendanceData({
        timezone: "",
        from: "",
        to: "",
        summary: {},
        attendance: [],
      });
    } finally {
      setAttendanceLoading(false);
    }
  }, [attendanceMonth, userId]);

  useEffect(() => {
    loadAttendanceCalendar();
  }, [loadAttendanceCalendar]);

  const loadTasks = useCallback(async () => {
    if (!userId) return;

    try {
      setTasksLoading(true);
      const rows = await getTasks({ assignedTo: userId });
      setTasks(Array.isArray(rows) ? rows : []);
    } catch (tasksError) {
      setError(toErrorMessage(tasksError, "Failed to load task history"));
      setTasks([]);
    } finally {
      setTasksLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const loadLeaveBalance = useCallback(async () => {
    if (!userId || profile?.role === "ADMIN") {
      setLeaveBalance(null);
      return;
    }

    try {
      setLeaveBalanceLoading(true);
      const payload = await getLeaveBalanceForAdmin(userId, { month: attendanceMonth });
      setLeaveBalance(payload);
    } catch (leaveError) {
      setError(toErrorMessage(leaveError, "Failed to load leave balance"));
      setLeaveBalance(null);
    } finally {
      setLeaveBalanceLoading(false);
    }
  }, [attendanceMonth, profile?.role, userId]);

  useEffect(() => {
    loadLeaveBalance();
  }, [loadLeaveBalance]);

  const loadLeaveTypeBreakdown = useCallback(async () => {
    if (!userId || profile?.role === "ADMIN") {
      setLeaveTypeRows([]);
      return;
    }

    try {
      const rows = await getAdminLeaveRequests({ userId, status: "APPROVED" });
      setLeaveTypeRows(Array.isArray(rows) ? rows : []);
    } catch {
      setLeaveTypeRows([]);
    }
  }, [profile?.role, userId]);

  useEffect(() => {
    loadLeaveTypeBreakdown();
  }, [loadLeaveTypeBreakdown]);

  const loadProjectStats = useCallback(async () => {
    if (!userId) return;

    try {
      setProjectsLoading(true);
      const payload = await getProjectsWithMeta({ createdBy: userId, limit: 200 });
      setProjectRows(Array.isArray(payload?.projects) ? payload.projects : []);
    } catch {
      setProjectRows([]);
    } finally {
      setProjectsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadProjectStats();
  }, [loadProjectStats]);

  const refreshAll = useCallback(() => {
    loadData();
    loadAttendanceCalendar();
    loadTasks();
    loadLeaveBalance();
    loadLeaveTypeBreakdown();
    loadProjectStats();
  }, [loadAttendanceCalendar, loadData, loadLeaveBalance, loadLeaveTypeBreakdown, loadProjectStats, loadTasks]);

  const filteredTasks = useMemo(() => {
    if (!taskStatusFilter) return tasks;
    return tasks.filter((task) => task.status === taskStatusFilter);
  }, [taskStatusFilter, tasks]);

  const taskStats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter((t) => t.status === "COMPLETED").length;
    const inProgress = tasks.filter((t) => t.status === "IN_PROGRESS").length;
    const overdue = tasks.filter((t) => {
      if (t.status === "COMPLETED" || !t.dueDate) return false;
      return new Date(t.dueDate) < new Date().setHours(0, 0, 0, 0);
    }).length;
    const completionRate = total ? Math.round((completed / total) * 100) : 0;
    return { total, completed, inProgress, pending: total - completed, overdue, completionRate };
  }, [tasks]);

  useEffect(() => {
    if (!success) return undefined;
    const timer = setTimeout(() => setSuccess(""), 1800);
    return () => clearTimeout(timer);
  }, [success]);

  const allowedParentRoles = useMemo(
    () => REPORTING_PARENT_ROLES[formData.role] || [],
    [formData.role],
  );

  const reportingCandidates = useMemo(() => {
    if (!allowedParentRoles.length) return [];
    return users.filter((row) => {
      const candidateId = String(row?._id || "");
      return row?.isActive
        && allowedParentRoles.includes(row.role)
        && candidateId !== String(userId || "");
    });
  }, [allowedParentRoles, userId, users]);

  const needsReporting = allowedParentRoles.length > 0;
  const isEditingSelf = String(currentUserId || "") === String(userId || "");
  const attendanceByDate = useMemo(
    () =>
      new Map(
        (attendanceData.attendance || []).map((row) => [
          String(row.attendanceDate || ""),
          row,
        ]),
      ),
    [attendanceData.attendance],
  );
  const calendarDays = useMemo(
    () => buildMonthCalendarDays(attendanceMonth),
    [attendanceMonth],
  );

  const attendanceSummaryCards = useMemo(() => {
    const summary = attendanceData.summary || {};
    return [
      { label: "Present / Working", value: Number(summary.presentDays || 0), tone: "emerald" },
      { label: "Late", value: Number(summary.lateDays || 0), tone: "rose" },
      { label: "Half Day", value: Number(summary.halfDays || 0), tone: "blue" },
      { label: "Absent", value: Number(summary.absentDays || 0), tone: "rose" },
      { label: "Leave", value: Number(summary.leaveDays || 0), tone: "teal" },
      { label: "Hours", value: Number(summary.totalWorkedHours || 0), tone: "slate" },
    ];
  }, [attendanceData.summary]);

  const attendanceAnalytics = useMemo(() => {
    const summary = attendanceData.summary || {};
    const presentDays = Number(summary.presentDays || 0);
    const halfDays = Number(summary.halfDays || 0);
    const leaveDays = Number(summary.leaveDays || 0);
    const absentDays = Number(summary.absentDays || 0);
    const lateDays = Number(summary.lateDays || 0);
    const totalWorkedHours = Number(summary.totalWorkedHours || 0);
    const workingDaysInMonth = calendarDays.filter((day) => day.dateKey && !day.isSunday).length;
    const attendedDays = presentDays + halfDays * 0.5;
    const attendancePercent = workingDaysInMonth
      ? Math.min(100, Math.round((attendedDays / workingDaysInMonth) * 100))
      : 0;

    const donutData = [
      { name: "Present", value: presentDays, color: CHART_COLORS.emerald },
      { name: "Half Day", value: halfDays, color: CHART_COLORS.blue },
      { name: "Leave", value: leaveDays, color: CHART_COLORS.teal },
      { name: "Absent", value: absentDays, color: CHART_COLORS.rose },
    ].filter((row) => row.value > 0);

    return {
      presentDays,
      halfDays,
      leaveDays,
      absentDays,
      lateDays,
      totalWorkedHours,
      workingDaysInMonth,
      attendancePercent,
      donutData,
    };
  }, [attendanceData.summary, calendarDays]);

  const productivity = useMemo(() => {
    const isCurrentMonthLoaded = attendanceMonth === toMonthInputValue(new Date());
    const todayKey = toLocalDateInputValue(new Date());
    const todayRow = isCurrentMonthLoaded ? attendanceByDate.get(todayKey) : null;

    const sortedRows = calendarDays
      .filter((day) => day.dateKey && (!isCurrentMonthLoaded || day.dateKey <= todayKey))
      .map((day) => attendanceByDate.get(day.dateKey))
      .filter(Boolean);

    const last7 = sortedRows.slice(-7);
    const weeklyMinutes = last7.reduce((sum, row) => sum + Number(row.workedMinutes || 0), 0);

    const checkIns = (attendanceData.attendance || []).map((row) => row.checkInAt).filter(Boolean);
    const checkOuts = (attendanceData.attendance || []).map((row) => row.checkOutAt).filter(Boolean);

    return {
      todayHours: todayRow ? toHours(todayRow.workedMinutes) : null,
      weeklyHours: toHours(weeklyMinutes),
      monthlyHours: attendanceAnalytics.totalWorkedHours,
      avgCheckIn: averageClockTime(checkIns),
      avgCheckOut: averageClockTime(checkOuts),
    };
  }, [attendanceAnalytics.totalWorkedHours, attendanceByDate, attendanceData.attendance, attendanceMonth, calendarDays]);

  const weeklyTrendData = useMemo(() => {
    const isCurrentMonthLoaded = attendanceMonth === toMonthInputValue(new Date());
    const todayKey = toLocalDateInputValue(new Date());
    const relevantDays = calendarDays.filter((day) => day.dateKey && (!isCurrentMonthLoaded || day.dateKey <= todayKey));
    return relevantDays.slice(-7).map((day) => {
      const row = attendanceByDate.get(day.dateKey);
      return {
        label: String(day.day),
        hours: row ? toHours(row.workedMinutes) : 0,
      };
    });
  }, [attendanceByDate, attendanceMonth, calendarDays]);

  const leaveTypeSummary = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const totals = {};
    leaveTypeRows.forEach((row) => {
      const rowYear = new Date(row.fromDate).getFullYear();
      if (rowYear !== currentYear) return;
      const type = String(row.leaveType || "OTHER").toUpperCase();
      totals[type] = (totals[type] || 0) + Number(row.totalDays || 0);
    });
    return ["CASUAL", "SICK", "EMERGENCY", "OTHER"].map((type) => ({
      type,
      label: LEAVE_TYPE_LABELS[type] || type,
      value: totals[type] || 0,
    }));
  }, [leaveTypeRows]);

  const projectStats = useMemo(() => {
    const bucketOf = (status) => {
      const normalized = String(status || "").toUpperCase();
      if (PROJECT_STATUS_BUCKETS.active.includes(normalized)) return "active";
      if (PROJECT_STATUS_BUCKETS.completed.includes(normalized)) return "completed";
      if (PROJECT_STATUS_BUCKETS.upcoming.includes(normalized)) return "upcoming";
      return null;
    };
    const stats = { active: 0, completed: 0, upcoming: 0 };
    projectRows.forEach((project) => {
      const bucket = bucketOf(project.status);
      if (bucket) stats[bucket] += 1;
    });
    return stats;
  }, [projectRows]);

  const monthlyTargetNumber = Number(formData.monthlyTarget) || Number(profile?.monthlyTarget) || 0;
  const achievedTarget = Number(performance?.achievedTarget || 0);
  const targetAchievementPercent = monthlyTargetNumber
    ? Math.min(100, Math.round((achievedTarget / monthlyTargetNumber) * 100))
    : 0;

  const performanceScore = useMemo(() => {
    const components = [];
    components.push({ score: attendanceAnalytics.attendancePercent, weight: 0.3 });
    if (taskStats.total > 0) {
      components.push({ score: taskStats.completionRate, weight: 0.3 });
    }
    if (performance && Number.isFinite(performance.conversionRate)) {
      components.push({ score: performance.conversionRate, weight: 0.2 });
    }
    if (monthlyTargetNumber > 0) {
      components.push({ score: targetAchievementPercent, weight: 0.2 });
    }

    const totalWeight = components.reduce((sum, item) => sum + item.weight, 0);
    if (!totalWeight) return 0;
    const weightedSum = components.reduce((sum, item) => sum + item.score * item.weight, 0);
    return Math.round(weightedSum / totalWeight);
  }, [attendanceAnalytics.attendancePercent, monthlyTargetNumber, performance, targetAchievementPercent, taskStats.completionRate, taskStats.total]);

  const performanceRating = Math.max(0, Math.min(5, Math.round(performanceScore / 20)));
  const performanceBadge = performanceScore >= 85
    ? "Excellent"
    : performanceScore >= 70
      ? "Very Good"
      : performanceScore >= 50
        ? "Good"
        : "Needs Improvement";

  const kpiRow = useMemo(() => ([
    { label: "Attendance %", value: `${attendanceAnalytics.attendancePercent}%` },
    { label: "Task Completion %", value: `${taskStats.completionRate}%` },
    { label: "Conversion Rate %", value: `${Number(performance?.conversionRate || 0)}%` },
    { label: "Target Achievement %", value: `${targetAchievementPercent}%` },
  ]), [attendanceAnalytics.attendancePercent, performance?.conversionRate, targetAchievementPercent, taskStats.completionRate]);

  const recentActivity = useMemo(() => {
    const lastCompletedTask = [...tasks]
      .filter((task) => task.status === "COMPLETED")
      .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))[0] || null;

    const lastAttendanceRow = [...(attendanceData.attendance || [])]
      .filter((row) => row.checkInAt)
      .sort((a, b) => new Date(b.checkInAt) - new Date(a.checkInAt))[0] || null;

    return [
      {
        key: "login",
        icon: LogIn,
        label: "Last Login",
        value: profile?.lastLoginAt ? formatDate(profile.lastLoginAt) : "No record yet",
      },
      {
        key: "task",
        icon: CheckSquare,
        label: "Last Task Completed",
        value: lastCompletedTask ? `${lastCompletedTask.title} (${formatDate(lastCompletedTask.updatedAt)})` : "No completed tasks yet",
      },
      {
        key: "attendance",
        icon: CalendarDays,
        label: "Last Attendance Marked",
        value: lastAttendanceRow ? formatDate(lastAttendanceRow.checkInAt) : "No record this month",
      },
      {
        key: "profile",
        icon: UserCircle2,
        label: "Last Profile Update",
        value: profile?.updatedAt ? formatDate(profile.updatedAt) : "-",
      },
    ];
  }, [attendanceData.attendance, profile?.lastLoginAt, profile?.updatedAt, tasks]);

  useEffect(() => {
    if (!needsReporting) {
      if (formData.reportingToId !== "") {
        setFormData((prev) => ({ ...prev, reportingToId: "" }));
      }
      return;
    }

    const hasSelectedParent = reportingCandidates.some(
      (candidate) => String(candidate._id) === String(formData.reportingToId || ""),
    );
    if (!hasSelectedParent) {
      setFormData((prev) => ({ ...prev, reportingToId: "" }));
    }
  }, [formData.reportingToId, needsReporting, reportingCandidates]);

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleRoleChange = (role) => {
    setFormData((prev) => ({ ...prev, role, reportingToId: "", canViewInventory: role === "CHANNEL_PARTNER" ? prev.canViewInventory : false }));
  };

  const scrollToSection = (ref) => {
    ref?.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleQuickEditProfile = () => {
    nameInputRef.current?.focus();
    nameInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const handleQuickViewAttendance = () => {
    setShowAttendanceDetail(true);
    setTimeout(() => scrollToSection(attendanceSectionRef), 50);
  };

  const handleQuickViewTasks = () => {
    setShowTaskDetail(true);
    setTimeout(() => scrollToSection(taskSectionRef), 50);
  };

  const handleQuickViewPerformance = () => {
    scrollToSection(performanceSectionRef);
  };

  const handleSave = async () => {
    if (!profile || !userId) return;

    const name = String(formData.name || "").trim();
    const email = String(formData.email || "").trim();
    if (!name || !email) {
      setError("Name and email are required.");
      return;
    }

    const monthlyTarget = Number(formData.monthlyTarget);
    if (!Number.isFinite(monthlyTarget) || monthlyTarget < 0) {
      setError("Monthly target must be 0 or more.");
      return;
    }

    const payload = {
      name,
      email,
      phone: String(formData.phone || "").trim(),
      roleType: formData.roleType,
      role: formData.role,
      reportingToId: needsReporting ? formData.reportingToId : null,
      isActive: Boolean(formData.isActive),
      canViewInventory:
        formData.role === "CHANNEL_PARTNER"
          ? Boolean(formData.canViewInventory)
          : false,
      department: String(formData.department || "").trim(),
      branch: String(formData.branch || "").trim(),
      shiftTiming: String(formData.shiftTiming || "").trim(),
      monthlyTarget,
    };

    if (formData.role === "CHANNEL_PARTNER") {
      const brokerageMode = normalizeBrokerageMode(formData.brokerageMode);
      const brokerageValue = Number(formData.brokerageValue);
      if (!Number.isFinite(brokerageValue) || brokerageValue < 0) {
        setError("Brokerage value must be 0 or more.");
        return;
      }
      if (brokerageMode === "PERCENTAGE" && brokerageValue > 100) {
        setError("Brokerage percentage cannot be more than 100.");
        return;
      }

      payload.brokerageConfig = {
        mode: brokerageMode,
        value: brokerageValue,
        notes: String(formData.brokerageNotes || "").trim(),
      };
    }

    const password = String(formData.password || "");
    if (password.trim()) {
      payload.password = password;
    }

    try {
      setSaving(true);
      setError("");

      const updated = await updateUserByAdmin(userId, payload);
      if (!updated) {
        await loadData();
        setSuccess("User updated");
        return;
      }

      setProfile(updated);
      setFormData((prev) => ({
        ...prev,
        name: updated.name || "",
        email: updated.email || "",
        phone: updated.phone || "",
        roleType: updated.roleType || "COMMERCIAL",
        role: updated.role || prev.role,
        reportingToId: getEntityId(updated.parentId),
        isActive: Boolean(updated.isActive),
        canViewInventory: Boolean(updated.canViewInventory),
        department: updated.department || "",
        branch: updated.branch || "",
        shiftTiming: updated.shiftTiming || "",
        monthlyTarget: String(Number.isFinite(updated.monthlyTarget) ? updated.monthlyTarget : 10),
        ...normalizeBrokerageFormState(updated.brokerageConfig),
        password: "",
      }));
      setSuccess("User updated");
    } catch (saveError) {
      setError(toErrorMessage(saveError, "Failed to update user"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={`ui-page-shell custom-scrollbar ${isDarkTheme ? "bg-slate-950/40" : "bg-slate-50/70"}`}>
        <div className={`rounded-xl border p-4 text-sm flex items-center gap-2 ${isDarkTheme ? "border-slate-700 bg-slate-900/70 text-slate-200" : "border-slate-200 bg-white text-slate-700"}`}>
          <Loader2 size={16} className="animate-spin" />
          Loading user details...
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className={`ui-page-shell custom-scrollbar ${isDarkTheme ? "bg-slate-950/40" : "bg-slate-50/70"}`}>
        <button
          type="button"
          onClick={() => navigate("/admin/users")}
          className={`mb-4 inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
            isDarkTheme ? "border-slate-700 text-slate-200 bg-slate-900/70" : "border-slate-300 text-slate-700 bg-white"
          }`}
        >
          <ArrowLeft size={14} />
          Back
        </button>
        <ToastNotice message="User not found or inaccessible." type="error" />
      </div>
    );
  }

  const initials = String(profile.name || "?")
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className={`user-access-doc-screen ui-page-shell custom-scrollbar flex flex-col gap-4 ${isDarkTheme ? "bg-slate-950/40" : "bg-slate-50/70"}`}>
      <div className="user-access-toolbar flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => navigate("/admin/users")}
          className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
            isDarkTheme ? "border-slate-700 text-slate-200 bg-slate-900/70" : "border-slate-300 text-slate-700 bg-white"
          }`}
        >
          <ArrowLeft size={14} />
          Back to Team Access
        </button>
        <button
          type="button"
          onClick={refreshAll}
          className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
            isDarkTheme ? "border-slate-700 text-slate-200 bg-slate-900/70" : "border-slate-300 text-slate-700 bg-white"
          }`}
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      <ToastNotice message={error} type="error" />
      <ToastNotice message={success} type="success" />

      {isEditingSelf ? (
        <div className={`rounded-xl border p-3 text-sm ${isDarkTheme ? "border-amber-500/30 bg-amber-500/10 text-amber-200" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
          Editing your own account is blocked here. Please update your account from the profile page.
        </div>
      ) : null}

      {/* Compact two-column dashboard */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Left: Profile card */}
        <section className={`lg:col-span-4 rounded-xl border p-4 ${isDarkTheme ? "border-slate-700 bg-slate-900/75" : "border-slate-200 bg-white"}`}>
          <div className="flex items-center gap-3">
            <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-lg font-bold ${isDarkTheme ? "bg-cyan-500/10 text-cyan-300" : "bg-cyan-50 text-cyan-700"}`}>
              {initials || <UserCircle2 size={26} />}
            </div>
            <div className="min-w-0">
              <h2 className={`truncate text-base font-bold ${isDarkTheme ? "text-slate-100" : "text-slate-900"}`}>
                {profile.name}
              </h2>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-bold ${isDarkTheme ? "border-slate-700 text-slate-300" : "border-slate-200 text-slate-600"}`}>
                  <Hash size={10} />
                  {profile.employeeCode}
                </span>
                <span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-bold ${isDarkTheme ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-300" : "border-cyan-200 bg-cyan-50 text-cyan-700"}`}>
                  {ROLE_LABELS[profile.role] || profile.role}
                </span>
                <span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-bold ${
                  formData.isActive
                    ? isDarkTheme ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : isDarkTheme ? "border-rose-500/30 bg-rose-500/10 text-rose-300" : "border-rose-200 bg-rose-50 text-rose-700"
                }`}>
                  {formData.isActive ? "Active" : "Inactive"}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <label className="space-y-0.5">
              <span className={`text-[10px] font-semibold ${isDarkTheme ? "text-slate-400" : "text-slate-500"}`}>Name</span>
              <input
                ref={nameInputRef}
                type="text"
                value={formData.name}
                onChange={(event) => handleChange("name", event.target.value)}
                disabled={isEditingSelf}
                className={`w-full rounded-lg border px-2.5 py-1.5 text-xs ${isDarkTheme ? "border-slate-700 bg-slate-950 text-slate-100" : "border-slate-300 bg-white text-slate-800"} disabled:opacity-60`}
              />
            </label>
            <label className="space-y-0.5">
              <span className={`text-[10px] font-semibold ${isDarkTheme ? "text-slate-400" : "text-slate-500"}`}>Email</span>
              <input
                type="email"
                value={formData.email}
                onChange={(event) => handleChange("email", event.target.value)}
                disabled={isEditingSelf}
                className={`w-full rounded-lg border px-2.5 py-1.5 text-xs ${isDarkTheme ? "border-slate-700 bg-slate-950 text-slate-100" : "border-slate-300 bg-white text-slate-800"} disabled:opacity-60`}
              />
            </label>
            <label className="space-y-0.5">
              <span className={`text-[10px] font-semibold ${isDarkTheme ? "text-slate-400" : "text-slate-500"}`}>Phone</span>
              <input
                type="text"
                value={formData.phone}
                onChange={(event) => handleChange("phone", event.target.value)}
                disabled={isEditingSelf}
                className={`w-full rounded-lg border px-2.5 py-1.5 text-xs ${isDarkTheme ? "border-slate-700 bg-slate-950 text-slate-100" : "border-slate-300 bg-white text-slate-800"} disabled:opacity-60`}
              />
            </label>
            <label className="space-y-0.5">
              <span className={`text-[10px] font-semibold ${isDarkTheme ? "text-slate-400" : "text-slate-500"}`}>Role</span>
              <select
                value={formData.role}
                onChange={(event) => handleRoleChange(event.target.value)}
                disabled={isEditingSelf}
                className={`w-full rounded-lg border px-2.5 py-1.5 text-xs ${isDarkTheme ? "border-slate-700 bg-slate-950 text-slate-100" : "border-slate-300 bg-white text-slate-800"} disabled:opacity-60`}
              >
                {Object.entries(ROLE_LABELS).filter(([role]) => role !== "ADMIN" || profile.role === "ADMIN").map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label className="space-y-0.5">
              <span className={`text-[10px] font-semibold ${isDarkTheme ? "text-slate-400" : "text-slate-500"}`}>Business category</span>
              <select
                value={formData.roleType}
                onChange={(event) => handleChange("roleType", event.target.value)}
                disabled={isEditingSelf}
                className={`w-full rounded-lg border px-2.5 py-1.5 text-xs ${isDarkTheme ? "border-slate-700 bg-slate-950 text-slate-100" : "border-slate-300 bg-white text-slate-800"} disabled:opacity-60`}
              >
                <option value="COMMERCIAL">Commercial</option>
                <option value="RESIDENTIAL">Residential</option>
                <option value="BOTH">Both</option>
              </select>
            </label>

            <label className="space-y-0.5">
              <span className={`text-[10px] font-semibold ${isDarkTheme ? "text-slate-400" : "text-slate-500"}`}>
                <Building2 size={10} className="inline -mt-0.5" /> Department
              </span>
              <input
                type="text"
                value={formData.department}
                onChange={(event) => handleChange("department", event.target.value)}
                disabled={isEditingSelf}
                placeholder="e.g. Sales"
                className={`w-full rounded-lg border px-2.5 py-1.5 text-xs ${isDarkTheme ? "border-slate-700 bg-slate-950 text-slate-100" : "border-slate-300 bg-white text-slate-800"} disabled:opacity-60`}
              />
            </label>
            <label className="space-y-0.5">
              <span className={`text-[10px] font-semibold ${isDarkTheme ? "text-slate-400" : "text-slate-500"}`}>
                <MapPin size={10} className="inline -mt-0.5" /> Branch
              </span>
              <input
                type="text"
                value={formData.branch}
                onChange={(event) => handleChange("branch", event.target.value)}
                disabled={isEditingSelf}
                placeholder="e.g. Indore"
                className={`w-full rounded-lg border px-2.5 py-1.5 text-xs ${isDarkTheme ? "border-slate-700 bg-slate-950 text-slate-100" : "border-slate-300 bg-white text-slate-800"} disabled:opacity-60`}
              />
            </label>
            <label className="space-y-0.5">
              <span className={`text-[10px] font-semibold ${isDarkTheme ? "text-slate-400" : "text-slate-500"}`}>
                <Clock size={10} className="inline -mt-0.5" /> Shift Timing
              </span>
              <input
                type="text"
                value={formData.shiftTiming}
                onChange={(event) => handleChange("shiftTiming", event.target.value)}
                disabled={isEditingSelf}
                placeholder="10:00 AM - 7:00 PM"
                className={`w-full rounded-lg border px-2.5 py-1.5 text-xs ${isDarkTheme ? "border-slate-700 bg-slate-950 text-slate-100" : "border-slate-300 bg-white text-slate-800"} disabled:opacity-60`}
              />
            </label>
            <label className="space-y-0.5">
              <span className={`text-[10px] font-semibold ${isDarkTheme ? "text-slate-400" : "text-slate-500"}`}>
                <Target size={10} className="inline -mt-0.5" /> Monthly Target
              </span>
              <input
                type="number"
                min="0"
                value={formData.monthlyTarget}
                onChange={(event) => handleChange("monthlyTarget", event.target.value)}
                disabled={isEditingSelf}
                className={`w-full rounded-lg border px-2.5 py-1.5 text-xs ${isDarkTheme ? "border-slate-700 bg-slate-950 text-slate-100" : "border-slate-300 bg-white text-slate-800"} disabled:opacity-60`}
              />
            </label>

            {needsReporting ? (
              <label className="col-span-2 space-y-0.5">
                <span className={`text-[10px] font-semibold ${isDarkTheme ? "text-slate-400" : "text-slate-500"}`}>
                  Reporting To ({allowedParentRoles.map((role) => ROLE_LABELS[role] || role).join(" / ")})
                </span>
                <select
                  value={formData.reportingToId}
                  onChange={(event) => handleChange("reportingToId", event.target.value)}
                  disabled={isEditingSelf}
                  className={`w-full rounded-lg border px-2.5 py-1.5 text-xs ${isDarkTheme ? "border-slate-700 bg-slate-950 text-slate-100" : "border-slate-300 bg-white text-slate-800"} disabled:opacity-60`}
                >
                  <option value="">Auto assign (least-loaded)</option>
                  {reportingCandidates.map((candidate) => (
                    <option key={candidate._id} value={candidate._id}>
                      {candidate.name} ({candidate.email}) - {ROLE_LABELS[candidate.role] || candidate.role}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <label className="space-y-0.5">
              <span className={`text-[10px] font-semibold ${isDarkTheme ? "text-slate-400" : "text-slate-500"}`}>Joining Date</span>
              <div className={`flex h-[30px] items-center rounded-lg border px-2.5 text-xs ${isDarkTheme ? "border-slate-700 bg-slate-950 text-slate-300" : "border-slate-300 bg-slate-50 text-slate-600"}`}>
                {formatDateOnly(profile.createdAt)}
              </div>
            </label>
            <label className="flex items-end gap-2 pb-1.5">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(event) => handleChange("isActive", event.target.checked)}
                disabled={isEditingSelf}
              />
              <span className={`text-xs font-semibold ${isDarkTheme ? "text-slate-300" : "text-slate-700"}`}>Active User</span>
            </label>

            <label className="col-span-2 space-y-0.5">
              <span className={`text-[10px] font-semibold ${isDarkTheme ? "text-slate-400" : "text-slate-500"}`}>Change Password</span>
              <input
                type="password"
                value={formData.password}
                onChange={(event) => handleChange("password", event.target.value)}
                disabled={isEditingSelf}
                placeholder="Leave blank to keep current password"
                className={`w-full rounded-lg border px-2.5 py-1.5 text-xs ${isDarkTheme ? "border-slate-700 bg-slate-950 text-slate-100" : "border-slate-300 bg-white text-slate-800"} disabled:opacity-60`}
              />
            </label>

            {formData.role === "CHANNEL_PARTNER" ? (
              <div className={`col-span-2 rounded-xl border p-2.5 ${isDarkTheme ? "border-slate-700 bg-slate-950 text-slate-100" : "border-slate-300 bg-white text-slate-800"}`}>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.canViewInventory}
                    onChange={(event) => handleChange("canViewInventory", event.target.checked)}
                    disabled={isEditingSelf}
                  />
                  <span className="text-xs">Can View Inventory</span>
                </label>

                <div className="mt-2 grid grid-cols-2 gap-2">
                  <label className="space-y-0.5">
                    <span className={`text-[10px] font-semibold ${isDarkTheme ? "text-slate-300" : "text-slate-600"}`}>Brokerage Model</span>
                    <select
                      value={formData.brokerageMode}
                      onChange={(event) => {
                        const nextMode = event.target.value;
                        setFormData((prev) => ({
                          ...prev,
                          brokerageMode: nextMode,
                          brokerageValue:
                            nextMode === "PERCENTAGE"
                              ? String(DEFAULT_BROKERAGE_PERCENTAGE)
                              : String(DEFAULT_BROKERAGE_VALUE),
                        }));
                      }}
                      disabled={isEditingSelf}
                      className={`w-full rounded-lg border px-2 py-1.5 text-xs ${isDarkTheme ? "border-slate-700 bg-slate-900 text-slate-100" : "border-slate-300 bg-white text-slate-800"} disabled:opacity-60`}
                    >
                      {BROKERAGE_MODE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-0.5">
                    <span className={`text-[10px] font-semibold ${isDarkTheme ? "text-slate-300" : "text-slate-600"}`}>
                      {formData.brokerageMode === "PERCENTAGE" ? "Brokerage %" : "Flat Brokerage"}
                    </span>
                    <input
                      type="number"
                      min="0"
                      max={formData.brokerageMode === "PERCENTAGE" ? "100" : undefined}
                      step={formData.brokerageMode === "PERCENTAGE" ? "0.01" : "1000"}
                      value={formData.brokerageValue}
                      onChange={(event) => handleChange("brokerageValue", event.target.value)}
                      disabled={isEditingSelf}
                      className={`w-full rounded-lg border px-2 py-1.5 text-xs ${isDarkTheme ? "border-slate-700 bg-slate-900 text-slate-100" : "border-slate-300 bg-white text-slate-800"} disabled:opacity-60`}
                    />
                  </label>
                  <label className="col-span-2 space-y-0.5">
                    <span className={`text-[10px] font-semibold ${isDarkTheme ? "text-slate-300" : "text-slate-600"}`}>Brokerage Notes</span>
                    <textarea
                      rows={2}
                      value={formData.brokerageNotes}
                      onChange={(event) => handleChange("brokerageNotes", event.target.value)}
                      disabled={isEditingSelf}
                      placeholder="Example: payable after full collection"
                      className={`w-full rounded-lg border px-2 py-1.5 text-xs ${isDarkTheme ? "border-slate-700 bg-slate-900 text-slate-100" : "border-slate-300 bg-white text-slate-800"} disabled:opacity-60`}
                    />
                  </label>
                </div>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving || isEditingSelf}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? "Saving..." : "Save Changes"}
          </button>

          <div className="mt-3 grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={handleQuickEditProfile}
              className={`rounded-lg border px-2 py-1.5 text-[11px] font-semibold ${isDarkTheme ? "border-slate-700 text-slate-200 hover:bg-slate-800" : "border-slate-300 text-slate-700 hover:bg-slate-50"}`}
            >
              Edit Profile
            </button>
            <button
              type="button"
              onClick={handleQuickViewAttendance}
              className={`rounded-lg border px-2 py-1.5 text-[11px] font-semibold ${isDarkTheme ? "border-slate-700 text-slate-200 hover:bg-slate-800" : "border-slate-300 text-slate-700 hover:bg-slate-50"}`}
            >
              View Attendance
            </button>
            <button
              type="button"
              onClick={handleQuickViewTasks}
              className={`rounded-lg border px-2 py-1.5 text-[11px] font-semibold ${isDarkTheme ? "border-slate-700 text-slate-200 hover:bg-slate-800" : "border-slate-300 text-slate-700 hover:bg-slate-50"}`}
            >
              View Tasks
            </button>
            <button
              type="button"
              onClick={handleQuickViewPerformance}
              className={`rounded-lg border px-2 py-1.5 text-[11px] font-semibold ${isDarkTheme ? "border-slate-700 text-slate-200 hover:bg-slate-800" : "border-slate-300 text-slate-700 hover:bg-slate-50"}`}
            >
              View Performance
            </button>
          </div>

          {profile.manager ? (
            <div className={`mt-3 flex items-center gap-2 rounded-lg border px-2.5 py-2 text-xs ${isDarkTheme ? "border-slate-700 bg-slate-950/50 text-slate-300" : "border-slate-200 bg-slate-50 text-slate-600"}`}>
              <Briefcase size={12} className="shrink-0" />
              <span className="truncate">Reports to <strong>{profile.manager.name}</strong></span>
            </div>
          ) : null}
        </section>

        {/* Right: Analytics dashboard */}
        <div ref={performanceSectionRef} className="lg:col-span-8 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {/* Attendance donut */}
          <DashboardCard title="Attendance" icon={CalendarDays} isDarkTheme={isDarkTheme}>
            <div className="flex items-center gap-3">
              <div className="relative h-24 w-24 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={attendanceAnalytics.donutData.length ? attendanceAnalytics.donutData : [{ name: "No data", value: 1, color: CHART_COLORS.slate }]}
                      dataKey="value"
                      innerRadius={30}
                      outerRadius={44}
                      paddingAngle={2}
                      stroke="none"
                    >
                      {(attendanceAnalytics.donutData.length ? attendanceAnalytics.donutData : [{ color: CHART_COLORS.slate }]).map((entry, index) => (
                        <Cell key={`slice-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className={`text-sm font-bold ${isDarkTheme ? "text-slate-100" : "text-slate-900"}`}>{attendanceAnalytics.attendancePercent}%</span>
                </div>
              </div>
              <div className="grid flex-1 grid-cols-2 gap-1.5 text-[11px]">
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: CHART_COLORS.emerald }} />Present {attendanceAnalytics.presentDays}</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: CHART_COLORS.blue }} />Half {attendanceAnalytics.halfDays}</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: CHART_COLORS.teal }} />Leave {attendanceAnalytics.leaveDays}</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: CHART_COLORS.rose }} />Absent {attendanceAnalytics.absentDays}</span>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-1.5 text-[11px]">
              <StatTile label="Working Days" value={attendanceAnalytics.workingDaysInMonth} isDarkTheme={isDarkTheme} />
              <StatTile label="Late Entries" value={attendanceAnalytics.lateDays} isDarkTheme={isDarkTheme} />
            </div>
          </DashboardCard>

          {/* Task summary */}
          <DashboardCard title="Task Summary" icon={ListTodo} isDarkTheme={isDarkTheme}>
            <div className="grid grid-cols-2 gap-1.5">
              <StatTile label="Total" value={taskStats.total} isDarkTheme={isDarkTheme} />
              <StatTile label="Completed" value={taskStats.completed} isDarkTheme={isDarkTheme} />
              <StatTile label="In Progress" value={taskStats.inProgress} isDarkTheme={isDarkTheme} />
              <StatTile label="Overdue" value={taskStats.overdue} isDarkTheme={isDarkTheme} />
            </div>
            <div className="mt-2.5">
              <div className="flex items-center justify-between text-[10px] font-semibold">
                <span className={isDarkTheme ? "text-slate-400" : "text-slate-500"}>Completion</span>
                <span className={isDarkTheme ? "text-slate-200" : "text-slate-700"}>{taskStats.completionRate}%</span>
              </div>
              <div className={`mt-1 h-2 w-full overflow-hidden rounded-full ${isDarkTheme ? "bg-slate-800" : "bg-slate-200"}`}>
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${taskStats.completionRate}%` }} />
              </div>
            </div>
          </DashboardCard>

          {/* Monthly target */}
          <DashboardCard title="Monthly Target" icon={Target} isDarkTheme={isDarkTheme}>
            <div className="flex items-center gap-3">
              <div className="relative h-24 w-24 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart
                    innerRadius="70%"
                    outerRadius="100%"
                    data={[{ value: targetAchievementPercent, fill: CHART_COLORS.cyan }]}
                    startAngle={90}
                    endAngle={-270}
                  >
                    <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                    <RadialBar dataKey="value" cornerRadius={8} background={{ fill: isDarkTheme ? "#1e293b" : "#e2e8f0" }} />
                  </RadialBarChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <span className={`text-sm font-bold ${isDarkTheme ? "text-slate-100" : "text-slate-900"}`}>{targetAchievementPercent}%</span>
                </div>
              </div>
              <div className="grid flex-1 grid-cols-1 gap-1.5 text-[11px]">
                <StatTile label="Assigned" value={monthlyTargetNumber} isDarkTheme={isDarkTheme} />
                <StatTile label="Achieved" value={achievedTarget} isDarkTheme={isDarkTheme} />
                <StatTile label="Remaining" value={Math.max(0, monthlyTargetNumber - achievedTarget)} isDarkTheme={isDarkTheme} />
              </div>
            </div>
          </DashboardCard>

          {/* Performance score */}
          <DashboardCard title="Performance Score" icon={Award} isDarkTheme={isDarkTheme}>
            <div className="flex items-center gap-3">
              <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-4 ${
                performanceScore >= 70 ? "border-emerald-500" : performanceScore >= 50 ? "border-amber-500" : "border-rose-500"
              }`}>
                <span className={`text-lg font-black ${isDarkTheme ? "text-slate-100" : "text-slate-900"}`}>{performanceScore}</span>
              </div>
              <div>
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      size={14}
                      className={star <= performanceRating ? "fill-amber-400 text-amber-400" : isDarkTheme ? "text-slate-700" : "text-slate-300"}
                    />
                  ))}
                </div>
                <span className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                  performanceScore >= 70
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : performanceScore >= 50
                      ? "border-amber-200 bg-amber-50 text-amber-700"
                      : "border-rose-200 bg-rose-50 text-rose-700"
                }`}>
                  {performanceBadge}
                </span>
              </div>
            </div>
          </DashboardCard>

          {/* Leave summary */}
          <DashboardCard title="Leave Summary" icon={CalendarDays} isDarkTheme={isDarkTheme}>
            {profile.role === "ADMIN" ? (
              <p className={`text-xs ${isDarkTheme ? "text-slate-400" : "text-slate-500"}`}>Admin users do not accrue leave.</p>
            ) : (
              <div className="grid grid-cols-2 gap-1.5">
                {leaveTypeSummary.map((row) => (
                  <StatTile key={row.type} label={row.label} value={row.value} isDarkTheme={isDarkTheme} />
                ))}
                <StatTile
                  label="Remaining Balance"
                  value={leaveBalanceLoading ? "…" : Number(leaveBalance?.available ?? 0)}
                  isDarkTheme={isDarkTheme}
                />
              </div>
            )}
          </DashboardCard>

          {/* Productivity metrics */}
          <DashboardCard title="Productivity" icon={TrendingUp} isDarkTheme={isDarkTheme}>
            <div className="grid grid-cols-2 gap-1.5">
              <StatTile label="Today" value={productivity.todayHours === null ? "—" : `${productivity.todayHours}h`} isDarkTheme={isDarkTheme} />
              <StatTile label="This Week" value={`${productivity.weeklyHours}h`} isDarkTheme={isDarkTheme} />
              <StatTile label="This Month" value={`${productivity.monthlyHours}h`} isDarkTheme={isDarkTheme} />
              <StatTile label="Avg In / Out" value={`${productivity.avgCheckIn} / ${productivity.avgCheckOut}`} isDarkTheme={isDarkTheme} />
            </div>
            <div className="mt-2 h-16">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weeklyTrendData}>
                  <XAxis dataKey="label" hide />
                  <Line type="monotone" dataKey="hours" stroke={CHART_COLORS.cyan} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </DashboardCard>

          {/* Recent activity */}
          <DashboardCard title="Recent Activity" icon={Clock} isDarkTheme={isDarkTheme}>
            <ul className="space-y-2">
              {recentActivity.map((item) => (
                <li key={item.key} className="flex items-start gap-2 text-[11px]">
                  <item.icon size={13} className={`mt-0.5 shrink-0 ${isDarkTheme ? "text-slate-400" : "text-slate-500"}`} />
                  <div className="min-w-0">
                    <p className={`font-semibold ${isDarkTheme ? "text-slate-200" : "text-slate-700"}`}>{item.label}</p>
                    <p className={`truncate ${isDarkTheme ? "text-slate-400" : "text-slate-500"}`}>{item.value}</p>
                  </div>
                </li>
              ))}
            </ul>
          </DashboardCard>

          {/* Project assignment */}
          <DashboardCard title="Project Assignment" icon={FolderKanban} isDarkTheme={isDarkTheme}>
            {projectsLoading ? (
              <div className="flex items-center gap-2 text-xs">
                <Loader2 size={13} className="animate-spin" />
                Loading...
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1.5">
                <StatTile label="Active" value={projectStats.active} isDarkTheme={isDarkTheme} />
                <StatTile label="Completed" value={projectStats.completed} isDarkTheme={isDarkTheme} />
                <StatTile label="Upcoming" value={projectStats.upcoming} isDarkTheme={isDarkTheme} />
              </div>
            )}
          </DashboardCard>

          {/* KPI row */}
          <DashboardCard title="Performance KPIs" icon={TrendingUp} isDarkTheme={isDarkTheme} className="sm:col-span-2 xl:col-span-3">
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {kpiRow.map((kpi) => (
                <StatTile key={kpi.label} label={kpi.label} value={kpi.value} isDarkTheme={isDarkTheme} />
              ))}
            </div>
          </DashboardCard>
        </div>
      </div>

      {/* Collapsible: Task History detail */}
      <section ref={taskSectionRef} className={`rounded-xl border p-4 ${isDarkTheme ? "border-slate-700 bg-slate-900/75" : "border-slate-200 bg-white"}`}>
        <button
          type="button"
          onClick={() => setShowTaskDetail((prev) => !prev)}
          className="flex w-full flex-col gap-3 text-left md:flex-row md:items-center md:justify-between"
        >
          <div className="flex items-center gap-2">
            <ListTodo size={18} className={isDarkTheme ? "text-cyan-300" : "text-cyan-700"} />
            <div>
              <h3 className={`text-sm font-bold ${isDarkTheme ? "text-slate-100" : "text-slate-900"}`}>
                Task History
              </h3>
              <p className={`text-xs ${isDarkTheme ? "text-slate-400" : "text-slate-500"}`}>
                {showTaskDetail ? "Click to collapse" : "Click to view all tasks assigned to"} {profile.name}
              </p>
            </div>
          </div>
        </button>

        {showTaskDetail ? (
          <>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <select
                value={taskStatusFilter}
                onChange={(event) => setTaskStatusFilter(event.target.value)}
                className={`h-10 rounded-lg border px-3 text-sm outline-none ${
                  isDarkTheme ? "border-slate-700 bg-slate-950 text-slate-100" : "border-slate-300 bg-white text-slate-800"
                }`}
              >
                <option value="">All Statuses</option>
                {Object.entries(TASK_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={loadTasks}
                disabled={tasksLoading}
                className={`inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-sm ${
                  isDarkTheme ? "border-slate-700 bg-slate-950 text-slate-100" : "border-slate-300 bg-white text-slate-700"
                } disabled:cursor-not-allowed disabled:opacity-60`}
              >
                {tasksLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                Refresh
              </button>
            </div>

            <div className="mt-3 space-y-2">
              {tasksLoading ? (
                <div className={`flex items-center justify-center gap-2 rounded-lg border p-6 text-sm ${isDarkTheme ? "border-slate-700 text-slate-300" : "border-slate-200 text-slate-500"}`}>
                  <Loader2 size={16} className="animate-spin" />
                  Loading tasks...
                </div>
              ) : filteredTasks.length === 0 ? (
                <div className={`rounded-lg border p-6 text-center text-sm ${isDarkTheme ? "border-slate-700 text-slate-400" : "border-slate-200 text-slate-500"}`}>
                  No tasks assigned to this user yet.
                </div>
              ) : (
                filteredTasks.map((task) => {
                  const expired = task.status !== "COMPLETED" && task.dueDate && new Date(task.dueDate) < new Date().setHours(0, 0, 0, 0);
                  return (
                    <div
                      key={task._id}
                      className={`rounded-lg border p-3 ${isDarkTheme ? "border-slate-700 bg-slate-950/50" : "border-slate-200 bg-white"}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            {task.status === "COMPLETED" && <CheckSquare size={13} className="text-emerald-500 shrink-0" />}
                            <p className={`truncate text-sm font-semibold ${isDarkTheme ? "text-slate-100" : "text-slate-900"}`}>
                              {task.title}
                            </p>
                          </div>
                          {task.leadId?.name ? (
                            <p className={`mt-0.5 text-xs ${isDarkTheme ? "text-slate-400" : "text-slate-500"}`}>
                              Lead: {task.leadId.name}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${TASK_PRIORITY_STYLES[task.priority] || TASK_PRIORITY_STYLES.MEDIUM}`}>
                            {task.priority}
                          </span>
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${TASK_STATUS_STYLES[task.status] || TASK_STATUS_STYLES.TODO}`}>
                            {TASK_STATUS_LABELS[task.status] || task.status}
                          </span>
                        </div>
                      </div>
                      {task.dueDate ? (
                        <p className={`mt-2 text-xs ${expired ? "font-bold text-rose-500" : isDarkTheme ? "text-slate-400" : "text-slate-500"}`}>
                          Due: {formatDateLabel(new Date(task.dueDate).toISOString().slice(0, 10))}
                          {expired ? " (Overdue)" : ""}
                        </p>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          </>
        ) : null}
      </section>

      {/* Collapsible: Attendance calendar detail */}
      <section ref={attendanceSectionRef} className={`rounded-xl border p-4 ${isDarkTheme ? "border-slate-700 bg-slate-900/75" : "border-slate-200 bg-white"}`}>
        <button
          type="button"
          onClick={() => setShowAttendanceDetail((prev) => !prev)}
          className="flex w-full flex-col gap-3 text-left md:flex-row md:items-center md:justify-between"
        >
          <div className="flex items-center gap-2">
            <CalendarDays size={18} className={isDarkTheme ? "text-cyan-300" : "text-cyan-700"} />
            <div>
              <h3 className={`text-sm font-bold ${isDarkTheme ? "text-slate-100" : "text-slate-900"}`}>
                Attendance Calendar
              </h3>
              <p className={`text-xs ${isDarkTheme ? "text-slate-400" : "text-slate-500"}`}>
                {showAttendanceDetail ? "Click to collapse" : "Click to view full calendar for"} {attendanceMonth}
              </p>
            </div>
          </div>
        </button>

        {showAttendanceDetail ? (
          <>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                type="month"
                value={attendanceMonth}
                onChange={(event) => setAttendanceMonth(event.target.value)}
                className={`h-10 rounded-lg border px-3 text-sm outline-none ${
                  isDarkTheme
                    ? "border-slate-700 bg-slate-950 text-slate-100"
                    : "border-slate-300 bg-white text-slate-800"
                }`}
              />
              <button
                type="button"
                onClick={loadAttendanceCalendar}
                disabled={attendanceLoading}
                className={`inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-sm ${
                  isDarkTheme
                    ? "border-slate-700 bg-slate-950 text-slate-100"
                    : "border-slate-300 bg-white text-slate-700"
                } disabled:cursor-not-allowed disabled:opacity-60`}
              >
                {attendanceLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                Refresh
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-6">
              {attendanceSummaryCards.map((card) => (
                <StatTile key={card.label} label={card.label} value={card.value} isDarkTheme={isDarkTheme} />
              ))}
            </div>

            <div className={`mt-4 rounded-xl border ${isDarkTheme ? "border-slate-700" : "border-slate-200"}`}>
              <div className={`grid grid-cols-7 border-b text-center text-[10px] font-bold uppercase tracking-[0.12em] ${
                isDarkTheme ? "border-slate-700 bg-slate-950 text-slate-400" : "border-slate-200 bg-slate-50 text-slate-500"
              }`}>
                {WEEKDAY_LABELS.map((label) => (
                  <div key={label} className="px-2 py-2">{label}</div>
                ))}
              </div>

              <div className="grid grid-cols-7">
                {calendarDays.map((day) => {
                  const row = day.dateKey ? attendanceByDate.get(day.dateKey) : null;
                  const hasRecord = Boolean(row);
                  const statusLabel = formatAttendanceStatus(row?.status);
                  return (
                    <div
                      key={day.key}
                      className={`min-h-[108px] border-b border-r p-2 ${
                        isDarkTheme
                          ? "border-slate-800 bg-slate-950/40"
                          : "border-slate-100 bg-white"
                      } ${day.dateKey ? "text-left" : isDarkTheme ? "bg-slate-950/20" : "bg-slate-50/60"}`}
                    >
                      {day.dateKey ? (
                        <div className="flex h-full flex-col gap-1.5">
                          <div className={`text-xs font-bold ${isDarkTheme ? "text-slate-100" : "text-slate-900"}`}>
                            {day.day}
                          </div>
                          {hasRecord ? (
                            <>
                              <span className={`inline-flex w-fit rounded-full border px-2 py-0.5 text-[10px] font-bold ${attendanceStatusClass(row.status, isDarkTheme)}`}>
                                {statusLabel}
                              </span>
                              <div className={`text-[11px] ${row.isLateCheckIn ? "font-bold text-rose-700" : isDarkTheme ? "text-slate-300" : "text-slate-600"}`}>
                                In: {formatDate(row.checkInAt)}
                              </div>
                              <div className={`text-[11px] ${isDarkTheme ? "text-slate-400" : "text-slate-500"}`}>
                                Work: {formatDuration(row.workedMinutes)}
                              </div>
                              <div className={`text-[11px] ${isDarkTheme ? "text-slate-500" : "text-slate-400"}`}>
                                Break: {formatDuration(row.totalBreakMinutes)}
                              </div>
                            </>
                          ) : (
                            <div className={`mt-auto text-[11px] ${isDarkTheme ? "text-slate-600" : "text-slate-400"}`}>
                              No record
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        ) : null}
      </section>
    </div>
  );
};

export default UserDetailsEditor;
