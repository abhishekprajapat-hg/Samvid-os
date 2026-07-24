import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  UserCircle2,
  Loader,
  Save,
  Phone,
  Mail,
  Building2,
  Briefcase,
  Shield,
  Users,
  MapPin,
  CalendarDays,
  RefreshCw,
  ArrowRight,
} from "lucide-react";
import {
  getMyProfile,
  updateMyProfile,
} from "../../services/userService";
import {
  createLeaveRequest,
  getMyAttendance,
  getMyLeaveBalance,
  getMyLeaveRequests,
} from "../../services/attendanceService";
import { toErrorMessage } from "../../utils/errorMessage";
import ToastNotice from "../../components/ui/ToastNotice";

const ROLE_LABELS = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  MANAGER: "Manager",
  EXECUTIVE: "Executive",
  FIELD_EXECUTIVE: "Field Executive",
  PRODUCTION_EXECUTIVE: "Production Executive",
  CHANNEL_PARTNER: "Channel Partner",
};
const MANAGEMENT_ROLES = ["MANAGER"];
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

const formatAttendanceStatus = (status) => {
  const normalized = String(status || "").trim().toUpperCase();
  if (normalized === "PRESENT") return "Present";
  if (normalized === "WORKING") return "Working";
  if (normalized === "BREAK") return "Break";
  if (!normalized) return "";
  return normalized.replaceAll("_", " ");
};

const attendanceStatusClass = (status) =>
  ATTENDANCE_STATUS_STYLES[String(status || "").trim().toUpperCase()]
  || "border-slate-200 bg-white text-slate-600";

const attendanceSummaryToneClass = (tone) => {
  if (tone === "emerald") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (tone === "blue") return "border-blue-200 bg-blue-50 text-blue-800";
  if (tone === "teal") return "border-teal-200 bg-teal-50 text-teal-800";
  if (tone === "rose") return "border-rose-200 bg-rose-50 text-rose-800";
  return "border-slate-200 bg-slate-50 text-slate-800";
};

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
    days.push({
      key: `${monthKey}-${String(day).padStart(2, "0")}`,
      dateKey: `${monthKey}-${String(day).padStart(2, "0")}`,
      day,
    });
  }

  return days;
};

const buildDateKeysInRange = (fromDate, toDate) => {
  if (!fromDate || !toDate) return [];
  const [fromYear, fromMonth, fromDay] = String(fromDate).split("-").map((value) => Number.parseInt(value, 10));
  const [toYear, toMonth, toDay] = String(toDate).split("-").map((value) => Number.parseInt(value, 10));
  const fromMs = Date.UTC(fromYear, fromMonth - 1, fromDay);
  const toMs = Date.UTC(toYear, toMonth - 1, toDay);
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || toMs < fromMs) return [];

  const rows = [];
  for (let cursor = fromMs; cursor <= toMs; cursor += 24 * 60 * 60 * 1000) {
    const date = new Date(cursor);
    rows.push(
      `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`,
    );
  }
  return rows;
};

const toSummaryCards = (role, summary = {}) => {
  if (role === "ADMIN" || role === "SUPER_ADMIN") {
    return [
      { key: "users", label: "Active Users", value: summary.users ?? 0, icon: Users },
      { key: "managers", label: "Managers", value: summary.managers ?? 0, icon: Briefcase },
      { key: "executives", label: "Executives", value: summary.executives ?? 0, icon: Users },
      {
        key: "fieldExecutives",
        label: "Field Executives",
        value: summary.fieldExecutives ?? 0,
        icon: MapPin,
      },
      { key: "leads", label: "Leads", value: summary.leads ?? 0, icon: Shield },
      { key: "inventory", label: "Inventory", value: summary.inventory ?? 0, icon: Building2 },
    ];
  }

  if (MANAGEMENT_ROLES.includes(role)) {
    return [
      { key: "teamMembers", label: "Team Members", value: summary.teamMembers ?? 0, icon: Users },
      { key: "executives", label: "Executives", value: summary.executives ?? 0, icon: Briefcase },
      {
        key: "fieldExecutives",
        label: "Field Team",
        value: summary.fieldExecutives ?? 0,
        icon: MapPin,
      },
      { key: "channelPartners", label: "Channel Partners", value: summary.channelPartners ?? 0, icon: Users },
      { key: "teamLeads", label: "Team Leads", value: summary.teamLeads ?? 0, icon: Shield },
      {
        key: "dueFollowUpsToday",
        label: "Follow-ups Today",
        value: summary.dueFollowUpsToday ?? 0,
        icon: Briefcase,
      },
    ];
  }

  if (role === "EXECUTIVE" || role === "FIELD_EXECUTIVE") {
    return [
      { key: "assignedLeads", label: "Assigned Leads", value: summary.assignedLeads ?? 0, icon: Users },
      { key: "openLeads", label: "Open Leads", value: summary.openLeads ?? 0, icon: Shield },
      { key: "closedLeads", label: "Closed Leads", value: summary.closedLeads ?? 0, icon: Briefcase },
      {
        key: "dueFollowUpsToday",
        label: "Follow-ups Today",
        value: summary.dueFollowUpsToday ?? 0,
        icon: MapPin,
      },
    ];
  }

  if (role === "CHANNEL_PARTNER") {
    return [
      { key: "createdLeads", label: "Created Leads", value: summary.createdLeads ?? 0, icon: Users },
      { key: "closedLeads", label: "Closed Leads", value: summary.closedLeads ?? 0, icon: Briefcase },
    ];
  }

  return [];
};

const UserProfile = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [profile, setProfile] = useState(null);
  const [summary, setSummary] = useState({});
  const [nameDraft, setNameDraft] = useState("");
  const [phoneDraft, setPhoneDraft] = useState("");
  const [attendanceMonth, setAttendanceMonth] = useState(toMonthInputValue(new Date()));
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceData, setAttendanceData] = useState({
    timezone: "",
    summary: {},
    attendance: [],
  });
  const [leaveBalanceLoading, setLeaveBalanceLoading] = useState(false);
  const [leaveBalance, setLeaveBalance] = useState(null);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [leaveRange, setLeaveRange] = useState({ fromDate: "", toDate: "" });
  const [leaveType, setLeaveType] = useState("CASUAL");
  const [leaveReason, setLeaveReason] = useState("");
  const [leaveSubmitting, setLeaveSubmitting] = useState(false);

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const response = await getMyProfile();
      setProfile(response.profile || null);
      setSummary(response.summary || {});
      setNameDraft(String(response.profile?.name || ""));
      setPhoneDraft(String(response.profile?.phone || ""));
    } catch (fetchError) {
      const message = toErrorMessage(fetchError, "Failed to load profile");
      console.error(`Load profile failed: ${message}`);
      setError(message);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const loadAttendanceCalendar = useCallback(async () => {
    try {
      setAttendanceLoading(true);
      const payload = await getMyAttendance({ month: attendanceMonth });
      setAttendanceData({
        timezone: payload.timezone || "",
        summary: payload.summary || {},
        attendance: Array.isArray(payload.attendance) ? payload.attendance : [],
      });
    } catch (attendanceError) {
      setError(toErrorMessage(attendanceError, "Failed to load attendance calendar"));
    } finally {
      setAttendanceLoading(false);
    }
  }, [attendanceMonth]);

  useEffect(() => {
    loadAttendanceCalendar();
  }, [loadAttendanceCalendar]);

  const loadLeaveBalance = useCallback(async () => {
    if (!profile || profile.role === "ADMIN") {
      setLeaveBalance(null);
      return;
    }

    try {
      setLeaveBalanceLoading(true);
      const payload = await getMyLeaveBalance({ month: attendanceMonth });
      setLeaveBalance(payload);
    } catch (balanceError) {
      setError(toErrorMessage(balanceError, "Failed to load leave balance"));
      setLeaveBalance(null);
    } finally {
      setLeaveBalanceLoading(false);
    }
  }, [attendanceMonth, profile]);

  useEffect(() => {
    loadLeaveBalance();
  }, [loadLeaveBalance]);

  const loadLeaveRequests = useCallback(async () => {
    if (!profile || profile.role === "ADMIN") {
      setLeaveRequests([]);
      return;
    }

    try {
      const rows = await getMyLeaveRequests();
      setLeaveRequests(Array.isArray(rows) ? rows : []);
    } catch (leaveError) {
      setError(toErrorMessage(leaveError, "Failed to load leave requests"));
    }
  }, [profile]);

  useEffect(() => {
    loadLeaveRequests();
  }, [loadLeaveRequests]);

  useEffect(() => {
    if (!success) return undefined;
    const timer = setTimeout(() => setSuccess(""), 1800);
    return () => clearTimeout(timer);
  }, [success]);

  const summaryCards = useMemo(
    () => toSummaryCards(profile?.role, summary),
    [profile?.role, summary],
  );
  const attendanceByDate = useMemo(() => {
    const map = new Map();
    attendanceData.attendance.forEach((row) => {
      if (row?.attendanceDate) {
        map.set(row.attendanceDate, row);
      }
    });
    return map;
  }, [attendanceData.attendance]);
  const calendarDays = useMemo(
    () => buildMonthCalendarDays(attendanceMonth),
    [attendanceMonth],
  );
  const attendanceSummaryCards = useMemo(() => {
    const summaryRow = attendanceData.summary || {};
    return [
      { key: "present", label: "Present", value: summaryRow.presentDays ?? 0, tone: "emerald" },
      { key: "half", label: "Half Day", value: summaryRow.halfDays ?? 0, tone: "blue" },
      { key: "leave", label: "Leave", value: summaryRow.leaveDays ?? 0, tone: "teal" },
      { key: "absent", label: "Absent", value: summaryRow.absentDays ?? 0, tone: "rose" },
    ];
  }, [attendanceData.summary]);
  const pendingLeaveByDate = useMemo(() => {
    const map = new Map();
    leaveRequests
      .filter((row) => String(row?.status || "").toUpperCase() === "PENDING")
      .forEach((row) => {
        buildDateKeysInRange(row.fromDate, row.toDate).forEach((dateKey) => {
          map.set(dateKey, row);
        });
      });
    return map;
  }, [leaveRequests]);
  const selectedLeaveDates = useMemo(() => {
    if (!leaveRange.fromDate || !leaveRange.toDate) return new Set();
    return new Set(buildDateKeysInRange(leaveRange.fromDate, leaveRange.toDate));
  }, [leaveRange.fromDate, leaveRange.toDate]);

  const handleRefreshAttendanceSection = useCallback(async () => {
    await Promise.all([
      loadAttendanceCalendar(),
      loadLeaveBalance(),
      loadLeaveRequests(),
    ]);
  }, [loadAttendanceCalendar, loadLeaveBalance, loadLeaveRequests]);

  const handleCalendarDateClick = (dateKey) => {
    if (!dateKey || profile?.role === "ADMIN") return;

    setLeaveRange((prev) => {
      if (!leaveModalOpen || !prev.fromDate) {
        return { fromDate: dateKey, toDate: dateKey };
      }
      return dateKey < prev.fromDate
        ? { fromDate: dateKey, toDate: prev.fromDate }
        : { fromDate: prev.fromDate, toDate: dateKey };
    });
    setLeaveModalOpen(true);
  };

  const closeLeaveModal = () => {
    setLeaveModalOpen(false);
    setLeaveRange({ fromDate: "", toDate: "" });
    setLeaveType("CASUAL");
    setLeaveReason("");
  };

  const handleSubmitLeaveFromProfile = async (event) => {
    event.preventDefault();
    const fromDate = String(leaveRange.fromDate || "").trim();
    const toDate = String(leaveRange.toDate || fromDate).trim();
    const reason = String(leaveReason || "").trim();
    if (!fromDate || !toDate) {
      setError("Please select leave dates.");
      return;
    }
    if (!reason) {
      setError("Reason is required.");
      return;
    }

    try {
      setLeaveSubmitting(true);
      setError("");
      const result = await createLeaveRequest({
        fromDate,
        toDate,
        leaveType,
        reason,
      });
      setSuccess(result.message || "Leave request created");
      closeLeaveModal();
      await Promise.all([
        loadLeaveRequests(),
        loadLeaveBalance(),
        loadAttendanceCalendar(),
      ]);
    } catch (submitError) {
      setError(toErrorMessage(submitError, "Failed to submit leave request"));
    } finally {
      setLeaveSubmitting(false);
    }
  };

  const handleSave = async () => {
    if (!profile) return;

    const nextName = String(nameDraft || "").trim();
    const nextPhone = String(phoneDraft || "").trim();
    if (!nextName) {
      setError("Name is required");
      return;
    }

    try {
      setSaving(true);
      setError("");
      const response = await updateMyProfile({
        name: nextName,
        phone: nextPhone,
      });
      setProfile(response.profile || profile);
      setSummary(response.summary || summary);
      setNameDraft(String(response.profile?.name || nextName));
      setPhoneDraft(String(response.profile?.phone || nextPhone));

      const storedUserRaw = localStorage.getItem("user");
      if (storedUserRaw) {
        try {
          const storedUser = JSON.parse(storedUserRaw);
          storedUser.name = response.profile?.name || nextName;
          storedUser.phone = response.profile?.phone || nextPhone;
          localStorage.setItem("user", JSON.stringify(storedUser));
        } catch {
          // ignore invalid local cache
        }
      }

      setSuccess("Profile updated");
    } catch (saveError) {
      const message = toErrorMessage(saveError, "Failed to update profile");
      console.error(`Update profile failed: ${message}`);
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="ui-page-shell custom-scrollbar space-y-6">
      <ToastNotice message={error} type="error" />
      <ToastNotice message={success} type="success" />

      {loading ? (
        <div className="ui-soft-panel h-56 rounded-2xl border bg-white flex items-center justify-center text-slate-400 gap-2">
          <Loader size={18} className="animate-spin" /> Loading profile...
        </div>
      ) : !profile ? (
        <div className="ui-soft-panel h-56 rounded-2xl border bg-white flex items-center justify-center text-slate-500">
          Profile data not available
        </div>
      ) : (
        <>
          <div className="ui-soft-panel rounded-2xl border bg-white p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center">
                <UserCircle2 size={30} />
              </div>

              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Name
                  </label>
                  <input
                    type="text"
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    className="mt-1 w-full h-10 rounded-lg border border-slate-300 px-3 text-sm"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Phone
                  </label>
                  <input
                    type="text"
                    value={phoneDraft}
                    onChange={(e) => setPhoneDraft(e.target.value)}
                    className="mt-1 w-full h-10 rounded-lg border border-slate-300 px-3 text-sm"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Email
                  </label>
                  <div className="mt-1 h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 flex items-center gap-2">
                    <Mail size={13} /> {profile.email || "-"}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Role
                  </label>
                  <div className="mt-1 h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 flex items-center gap-2">
                    <Briefcase size={13} /> {ROLE_LABELS[profile.role] || profile.role || "-"}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => navigate("/attendance")}
                className="h-10 px-4 rounded-lg border border-cyan-200 bg-cyan-50 text-cyan-700 text-sm font-semibold inline-flex items-center gap-2 hover:border-cyan-300 hover:bg-cyan-100"
              >
                <CalendarDays size={14} />
                Attendance Page
                <ArrowRight size={14} />
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="h-10 px-4 rounded-lg bg-cyan-600 text-white text-sm font-semibold inline-flex items-center gap-2 hover:bg-cyan-500 disabled:opacity-60"
              >
                {saving ? <Loader size={14} className="animate-spin" /> : <Save size={14} />}
                Save Profile
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="ui-soft-panel rounded-2xl border bg-white p-5">
              <div className="text-xs uppercase tracking-widest text-slate-400 font-bold mb-3">
                Reporting
              </div>
              {profile.manager ? (
                <div className="space-y-2 text-sm text-slate-700">
                  <div className="font-semibold text-slate-900">{profile.manager.name || "-"}</div>
                  <div className="flex items-center gap-2">
                    <Mail size={13} />
                    {profile.manager.email || "-"}
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone size={13} />
                    {profile.manager.phone || "-"}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-slate-500">
                  No reporting manager mapped
                </div>
              )}
            </div>

            <div className="ui-soft-panel rounded-2xl border bg-white p-5">
              <div className="text-xs uppercase tracking-widest text-slate-400 font-bold mb-3">
                Account Metadata
              </div>
              <div className="space-y-2 text-sm text-slate-700">
                <div className="flex items-center gap-2">
                  <Building2 size={13} />
                  Company Id: {String(profile.companyId || "-")}
                </div>
                <div>Created: {formatDate(profile.createdAt)}</div>
                <div>Updated: {formatDate(profile.updatedAt)}</div>
                <div>Last Assigned: {formatDate(profile.lastAssignedAt)}</div>
              </div>
            </div>
          </div>

          <section className="ui-soft-panel rounded-2xl border bg-white p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <CalendarDays size={17} className="text-cyan-600" />
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Attendance Calendar</h3>
                  <p className="text-[11px] uppercase tracking-widest text-slate-400">
                    Month: {attendanceMonth}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="month"
                  value={attendanceMonth}
                  onChange={(event) => setAttendanceMonth(event.target.value)}
                  className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                />
                <button
                  type="button"
                  onClick={handleRefreshAttendanceSection}
                  disabled={attendanceLoading || leaveBalanceLoading}
                  className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {attendanceLoading || leaveBalanceLoading ? <Loader size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  Refresh
                </button>
              </div>
            </div>

            {profile.role !== "ADMIN" ? (
              <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,360px)_1fr]">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-emerald-800">
                  <p className="text-[10px] font-bold uppercase tracking-widest">Leave Balance</p>
                  <p className="mt-2 text-3xl font-semibold">{Number(leaveBalance?.available || 0)}</p>
                  <p className="mt-1 text-xs text-emerald-700">
                    Total leaves available
                  </p>
                </div>
                <div className="rounded-2xl border border-cyan-100 bg-cyan-50/45 px-4 py-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-700">
                      Monthly Leave Rule
                    </p>
                    <p className="text-xs text-slate-500">
                      Every month on 1st date, 1 leave is added. Unused leave carries forward.
                    </p>
                  </div>
                  <p className="mt-3 text-xs font-semibold text-slate-600">
                    Since {leaveBalance?.accrualStartMonth || "-"} | {Number(leaveBalance?.monthlyAccrual || 1)} leave/month
                  </p>
                </div>
              </div>
            ) : null}

            <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {attendanceSummaryCards.map((card) => (
                <div
                  key={card.key}
                  className={`rounded-xl border px-3 py-3 ${attendanceSummaryToneClass(card.tone)}`}
                >
                  <p className="text-[10px] font-bold uppercase tracking-widest opacity-75">{card.label}</p>
                  <p className="mt-1 text-xl font-semibold">{Number(card.value || 0)}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
              <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
                {WEEKDAY_LABELS.map((label) => (
                  <div
                    key={label}
                    className="px-2 py-2 text-center text-[10px] font-bold uppercase tracking-widest text-slate-500"
                  >
                    {label}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 bg-white">
                {calendarDays.map((day) => {
                  const attendanceRow = day.dateKey ? attendanceByDate.get(day.dateKey) : null;
                  const pendingLeave = day.dateKey ? pendingLeaveByDate.get(day.dateKey) : null;
                  const isSelectedLeaveDate = day.dateKey ? selectedLeaveDates.has(day.dateKey) : false;
                  const statusLabel = pendingLeave ? "Leave Pending" : attendanceRow ? formatAttendanceStatus(attendanceRow.status) : "";
                  const isLate = Boolean(attendanceRow?.isLateCheckIn);

                  return (
                    <button
                      type="button"
                      key={day.key}
                      onClick={() => handleCalendarDateClick(day.dateKey)}
                      disabled={!day.dateKey || profile.role === "ADMIN"}
                      className={`min-h-[96px] border-b border-r border-slate-100 p-2 text-left transition ${
                        day.dateKey ? "bg-white hover:bg-cyan-50" : "bg-slate-50/60"
                      } ${
                        isSelectedLeaveDate ? "ring-2 ring-inset ring-cyan-400" : ""
                      }`}
                    >
                      {day.dateKey ? (
                        <div className="flex h-full flex-col gap-1.5">
                          <span className="text-xs font-semibold text-slate-900">{day.day}</span>
                          {pendingLeave ? (
                            <>
                              <span className="inline-flex w-fit rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                                {statusLabel}
                              </span>
                              <span className="text-[10px] text-slate-500">
                                Awaiting approval
                              </span>
                            </>
                          ) : attendanceRow ? (
                            <>
                              <span className={`inline-flex w-fit rounded-full border px-2 py-0.5 text-[10px] font-bold ${attendanceStatusClass(attendanceRow.status)}`}>
                                {statusLabel}
                              </span>
                              <span className={`text-[10px] ${isLate ? "font-bold text-rose-700" : "text-slate-500"}`}>
                                In: {formatDate(attendanceRow.checkInAt)}
                              </span>
                              <span className="text-[10px] text-slate-500">
                                Work: {formatDuration(attendanceRow.workedMinutes)}
                              </span>
                            </>
                          ) : (
                            <span className="mt-auto text-[10px] text-slate-400">No record</span>
                          )}
                        </div>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {leaveModalOpen && profile.role !== "ADMIN" ? (
            <div className="pointer-events-none fixed inset-0 z-50 flex items-end justify-end p-4">
              <form
                onSubmit={handleSubmitLeaveFromProfile}
                className="pointer-events-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">Apply Leave</h3>
                    <p className="text-xs text-slate-500">
                      Select another calendar date to extend the range.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closeLeaveModal}
                    className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Close
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <label className="text-xs font-semibold text-slate-600">
                    From
                    <input
                      type="date"
                      value={leaveRange.fromDate}
                      onChange={(event) => {
                        const value = event.target.value;
                        setLeaveRange((prev) => ({
                          fromDate: value,
                          toDate: prev.toDate && prev.toDate >= value ? prev.toDate : value,
                        }));
                      }}
                      className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
                    />
                  </label>
                  <label className="text-xs font-semibold text-slate-600">
                    To
                    <input
                      type="date"
                      value={leaveRange.toDate}
                      onChange={(event) => {
                        const value = event.target.value;
                        setLeaveRange((prev) => ({
                          fromDate: prev.fromDate && prev.fromDate <= value ? prev.fromDate : value,
                          toDate: value,
                        }));
                      }}
                      className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
                    />
                  </label>
                </div>

                <label className="mt-3 block text-xs font-semibold text-slate-600">
                  Leave Type
                  <select
                    value={leaveType}
                    onChange={(event) => setLeaveType(event.target.value)}
                    className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
                  >
                    <option value="CASUAL">Casual</option>
                    <option value="SICK">Sick</option>
                    <option value="EMERGENCY">Emergency</option>
                    <option value="UNPAID">Unpaid</option>
                    <option value="OTHER">Other</option>
                  </select>
                </label>

                <label className="mt-3 block text-xs font-semibold text-slate-600">
                  Reason
                  <textarea
                    value={leaveReason}
                    onChange={(event) => setLeaveReason(event.target.value)}
                    rows={3}
                    maxLength={500}
                    placeholder="Reason for leave"
                    className="mt-1 w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>

                <button
                  type="submit"
                  disabled={leaveSubmitting}
                  className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-cyan-600 px-4 text-sm font-semibold text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {leaveSubmitting ? <Loader size={14} className="animate-spin" /> : <CalendarDays size={14} />}
                  Submit Leave Request
                </button>
              </form>
            </div>
          ) : null}

          {summaryCards.length > 0 && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {summaryCards.map((card) => (
                <div key={card.key} className="ui-soft-panel rounded-2xl border bg-white p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">
                      {card.label}
                    </div>
                    <card.icon size={14} className="text-slate-500" />
                  </div>
                  <div className="mt-2 text-2xl font-display text-slate-900">
                    {card.value}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default UserProfile;
