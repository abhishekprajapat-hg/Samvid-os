import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, CalendarDays, Loader2, RefreshCw, Save } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getUserProfileById,
  getUsers,
  updateUserByAdmin,
} from "../../services/userService";
import {
  getUserAttendanceForAdmin,
  updateUserAttendanceStatus,
} from "../../services/attendanceService";
import { toErrorMessage } from "../../utils/errorMessage";
import ToastNotice from "../../components/ui/ToastNotice";

const ROLE_OPTIONS = [
  { label: "Manager", value: "MANAGER" },
  { label: "Executive", value: "EXECUTIVE" },
  { label: "Field Executive", value: "FIELD_EXECUTIVE" },
  { label: "Production Executive", value: "PRODUCTION_EXECUTIVE" },
  { label: "Channel Partner", value: "CHANNEL_PARTNER" },
];

const REPORTING_PARENT_ROLES = {
  ADMIN: ["SUPER_ADMIN"],
  MANAGER: ["ADMIN"],
  EXECUTIVE: ["MANAGER"],
  FIELD_EXECUTIVE: ["MANAGER"],
  PRODUCTION_EXECUTIVE: ["MANAGER"],
  CHANNEL_PARTNER: ["MANAGER"],
};

const ROLE_LABELS = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  MANAGER: "Manager",
  EXECUTIVE: "Executive",
  FIELD_EXECUTIVE: "Field Executive",
  PRODUCTION_EXECUTIVE: "Production Executive",
  CHANNEL_PARTNER: "Channel Partner",
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
const MANUAL_ATTENDANCE_STATUS_OPTIONS = [
  { label: "Present", value: "PRESENT" },
  { label: "Half Day", value: "HALF_DAY" },
  { label: "Absent", value: "ABSENT" },
];

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

const summaryToneClass = (tone, isDarkTheme) => {
  if (isDarkTheme) {
    return "border-slate-700 bg-slate-950/70 text-slate-100";
  }
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

const UserDetailsEditor = ({ theme = "light" }) => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const isDarkTheme = theme === "dark";
  const currentUserId = safeReadCurrentUserId();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [profile, setProfile] = useState(null);
  const [users, setUsers] = useState([]);
  const [attendanceMonth, setAttendanceMonth] = useState(toMonthInputValue(new Date()));
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceData, setAttendanceData] = useState({
    timezone: "",
    from: "",
    to: "",
    summary: {},
    attendance: [],
  });
  const [attendanceStatusModal, setAttendanceStatusModal] = useState(null);
  const [manualStatusSaving, setManualStatusSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    role: "MANAGER",
    reportingToId: "",
    isActive: true,
    canViewInventory: false,
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
      setUsers(rows);
      setFormData({
        name: resolvedProfile.name || "",
        email: resolvedProfile.email || "",
        phone: resolvedProfile.phone || "",
        role: resolvedProfile.role || "MANAGER",
        reportingToId: getEntityId(resolvedProfile.parentId),
        isActive: Boolean(resolvedProfile.isActive),
        canViewInventory: Boolean(resolvedProfile.canViewInventory),
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

  const handleRoleChange = (nextRole) => {
    setFormData((prev) => ({
      ...prev,
      role: nextRole,
      reportingToId: "",
      canViewInventory:
        nextRole === "CHANNEL_PARTNER" ? prev.canViewInventory : false,
    }));
  };

  const openAttendanceStatusModal = (dateKey, row = null) => {
    if (!dateKey || !userId || profile?.role === "ADMIN") return;
    setAttendanceStatusModal({
      date: dateKey,
      status: MANUAL_ATTENDANCE_STATUS_OPTIONS.some((option) => option.value === row?.status)
        ? row.status
        : "PRESENT",
    });
  };

  const handleManualAttendanceSave = async () => {
    if (!userId || !attendanceStatusModal?.date || !attendanceStatusModal?.status) return;

    try {
      setManualStatusSaving(true);
      setError("");
      const result = await updateUserAttendanceStatus(userId, attendanceStatusModal.date, {
        status: attendanceStatusModal.status,
      });
      setSuccess(result.message || "Attendance status updated");
      setAttendanceStatusModal(null);
      await loadAttendanceCalendar();
    } catch (saveError) {
      setError(toErrorMessage(saveError, "Failed to update attendance status"));
    } finally {
      setManualStatusSaving(false);
    }
  };

  const handleSave = async () => {
    if (!profile || !userId) return;

    const name = String(formData.name || "").trim();
    const email = String(formData.email || "").trim();
    if (!name || !email) {
      setError("Name and email are required.");
      return;
    }

    const payload = {
      name,
      email,
      phone: String(formData.phone || "").trim(),
      role: formData.role,
      reportingToId: needsReporting ? formData.reportingToId : null,
      isActive: Boolean(formData.isActive),
      canViewInventory:
        formData.role === "CHANNEL_PARTNER"
          ? Boolean(formData.canViewInventory)
          : false,
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
        role: updated.role || prev.role,
        reportingToId: getEntityId(updated.parentId),
        isActive: Boolean(updated.isActive),
        canViewInventory: Boolean(updated.canViewInventory),
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

  return (
    <div className={`ui-page-shell custom-scrollbar flex flex-col gap-5 ${isDarkTheme ? "bg-slate-950/40" : "bg-slate-50/70"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
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
          onClick={loadData}
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

      <section className={`ui-soft-panel rounded-xl border p-4 ${isDarkTheme ? "border-slate-700 bg-slate-900/75" : "border-slate-200 bg-white"}`}>
        <h2 className={`text-lg font-bold ${isDarkTheme ? "text-slate-100" : "text-slate-900"}`}>
          {profile.name}
        </h2>
        <p className={`mt-1 text-xs ${isDarkTheme ? "text-slate-400" : "text-slate-500"}`}>
          {ROLE_LABELS[profile.role] || profile.role}
        </p>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className={`text-xs font-semibold ${isDarkTheme ? "text-slate-300" : "text-slate-600"}`}>Name</span>
            <input
              type="text"
              value={formData.name}
              onChange={(event) => handleChange("name", event.target.value)}
              disabled={isEditingSelf}
              className={`w-full rounded-lg border px-3 py-2 text-sm ${isDarkTheme ? "border-slate-700 bg-slate-950 text-slate-100" : "border-slate-300 bg-white text-slate-800"} disabled:opacity-60`}
            />
          </label>

          <label className="space-y-1">
            <span className={`text-xs font-semibold ${isDarkTheme ? "text-slate-300" : "text-slate-600"}`}>Email</span>
            <input
              type="email"
              value={formData.email}
              onChange={(event) => handleChange("email", event.target.value)}
              disabled={isEditingSelf}
              className={`w-full rounded-lg border px-3 py-2 text-sm ${isDarkTheme ? "border-slate-700 bg-slate-950 text-slate-100" : "border-slate-300 bg-white text-slate-800"} disabled:opacity-60`}
            />
          </label>

          <label className="space-y-1">
            <span className={`text-xs font-semibold ${isDarkTheme ? "text-slate-300" : "text-slate-600"}`}>Phone</span>
            <input
              type="text"
              value={formData.phone}
              onChange={(event) => handleChange("phone", event.target.value)}
              disabled={isEditingSelf}
              className={`w-full rounded-lg border px-3 py-2 text-sm ${isDarkTheme ? "border-slate-700 bg-slate-950 text-slate-100" : "border-slate-300 bg-white text-slate-800"} disabled:opacity-60`}
            />
          </label>

          <label className="space-y-1">
            <span className={`text-xs font-semibold ${isDarkTheme ? "text-slate-300" : "text-slate-600"}`}>Role</span>
            <select
              value={formData.role}
              onChange={(event) => handleRoleChange(event.target.value)}
              disabled={isEditingSelf}
              className={`w-full rounded-lg border px-3 py-2 text-sm ${isDarkTheme ? "border-slate-700 bg-slate-950 text-slate-100" : "border-slate-300 bg-white text-slate-800"} disabled:opacity-60`}
            >
              {ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          {needsReporting ? (
            <label className="space-y-1 md:col-span-2">
              <span className={`text-xs font-semibold ${isDarkTheme ? "text-slate-300" : "text-slate-600"}`}>
                Reporting To ({allowedParentRoles.map((role) => ROLE_LABELS[role] || role).join(" / ")})
              </span>
              <select
                value={formData.reportingToId}
                onChange={(event) => handleChange("reportingToId", event.target.value)}
                disabled={isEditingSelf}
                className={`w-full rounded-lg border px-3 py-2 text-sm ${isDarkTheme ? "border-slate-700 bg-slate-950 text-slate-100" : "border-slate-300 bg-white text-slate-800"} disabled:opacity-60`}
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

          <label className="space-y-1">
            <span className={`text-xs font-semibold ${isDarkTheme ? "text-slate-300" : "text-slate-600"}`}>Change Password</span>
            <input
              type="password"
              value={formData.password}
              onChange={(event) => handleChange("password", event.target.value)}
              disabled={isEditingSelf}
              placeholder="Leave blank to keep current password"
              className={`w-full rounded-lg border px-3 py-2 text-sm ${isDarkTheme ? "border-slate-700 bg-slate-950 text-slate-100" : "border-slate-300 bg-white text-slate-800"} disabled:opacity-60`}
            />
          </label>

          <label className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${isDarkTheme ? "border-slate-700 bg-slate-950 text-slate-100" : "border-slate-300 bg-white text-slate-800"}`}>
            <input
              type="checkbox"
              checked={formData.isActive}
              onChange={(event) => handleChange("isActive", event.target.checked)}
              disabled={isEditingSelf}
            />
            <span className="text-sm">Active User</span>
          </label>

          {formData.role === "CHANNEL_PARTNER" ? (
            <div className={`md:col-span-2 rounded-xl border p-3 ${isDarkTheme ? "border-slate-700 bg-slate-950 text-slate-100" : "border-slate-300 bg-white text-slate-800"}`}>
              <div className="flex flex-col gap-3">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.canViewInventory}
                    onChange={(event) => handleChange("canViewInventory", event.target.checked)}
                    disabled={isEditingSelf}
                  />
                  <span className="text-sm">Can View Inventory</span>
                </label>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <label className="space-y-1">
                    <span className={`text-xs font-semibold ${isDarkTheme ? "text-slate-300" : "text-slate-600"}`}>
                      Brokerage Model
                    </span>
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
                      className={`w-full rounded-lg border px-3 py-2 text-sm ${isDarkTheme ? "border-slate-700 bg-slate-900 text-slate-100" : "border-slate-300 bg-white text-slate-800"} disabled:opacity-60`}
                    >
                      {BROKERAGE_MODE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-1">
                    <span className={`text-xs font-semibold ${isDarkTheme ? "text-slate-300" : "text-slate-600"}`}>
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
                      className={`w-full rounded-lg border px-3 py-2 text-sm ${isDarkTheme ? "border-slate-700 bg-slate-900 text-slate-100" : "border-slate-300 bg-white text-slate-800"} disabled:opacity-60`}
                    />
                  </label>

                  <label className="space-y-1 md:col-span-2">
                    <span className={`text-xs font-semibold ${isDarkTheme ? "text-slate-300" : "text-slate-600"}`}>
                      Brokerage Notes
                    </span>
                    <textarea
                      rows={3}
                      value={formData.brokerageNotes}
                      onChange={(event) => handleChange("brokerageNotes", event.target.value)}
                      disabled={isEditingSelf}
                      placeholder="Example: payable after full collection"
                      className={`w-full rounded-lg border px-3 py-2 text-sm ${isDarkTheme ? "border-slate-700 bg-slate-900 text-slate-100" : "border-slate-300 bg-white text-slate-800"} disabled:opacity-60`}
                    />
                  </label>
                </div>

                <p className={`text-xs ${isDarkTheme ? "text-slate-400" : "text-slate-500"}`}>
                  Finance dashboard will calculate realized and pending brokerage using this rule.
                </p>
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-4">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || isEditingSelf}
            className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </section>

      <section className={`rounded-xl border p-4 ${isDarkTheme ? "border-slate-700 bg-slate-900/75" : "border-slate-200 bg-white"}`}>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <CalendarDays size={18} className={isDarkTheme ? "text-cyan-300" : "text-cyan-700"} />
            <div>
              <h3 className={`text-sm font-bold ${isDarkTheme ? "text-slate-100" : "text-slate-900"}`}>
                Attendance Calendar
              </h3>
              <p className={`text-xs ${isDarkTheme ? "text-slate-400" : "text-slate-500"}`}>
                {ROLE_LABELS[profile.role] || profile.role} attendance for {attendanceMonth}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
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
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-6">
          {attendanceSummaryCards.map((card) => (
            <div
              key={card.label}
              className={`rounded-lg border px-3 py-2 ${summaryToneClass(card.tone, isDarkTheme)}`}
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] opacity-75">
                {card.label}
              </p>
              <p className="mt-1 text-lg font-bold">{card.value}</p>
            </div>
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
                <button
                  type="button"
                  key={day.key}
                  onClick={() => openAttendanceStatusModal(day.dateKey, row)}
                  disabled={!day.dateKey || profile.role === "ADMIN"}
                  className={`min-h-[108px] border-b border-r p-2 ${
                    isDarkTheme
                      ? "border-slate-800 bg-slate-950/40"
                      : "border-slate-100 bg-white"
                  } ${day.dateKey ? "text-left transition hover:bg-cyan-50 disabled:hover:bg-white" : isDarkTheme ? "bg-slate-950/20" : "bg-slate-50/60"}`}
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
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {attendanceStatusModal ? (
        <div className="fixed inset-0 z-50 flex items-end justify-end bg-slate-950/20 p-4">
          <div className={`w-full max-w-sm rounded-xl border p-4 shadow-2xl ${
            isDarkTheme ? "border-slate-700 bg-slate-900 text-slate-100" : "border-slate-200 bg-white text-slate-900"
          }`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold">Change Attendance Status</h3>
                <p className={`mt-0.5 text-xs ${isDarkTheme ? "text-slate-400" : "text-slate-500"}`}>
                  {formatDateLabel(attendanceStatusModal.date)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAttendanceStatusModal(null)}
                className={`rounded-lg border px-2 py-1 text-xs font-semibold ${
                  isDarkTheme
                    ? "border-slate-700 text-slate-300 hover:bg-slate-800"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                Close
              </button>
            </div>

            <label className={`mt-4 block text-xs font-semibold ${isDarkTheme ? "text-slate-300" : "text-slate-600"}`}>
              Status
              <select
                value={attendanceStatusModal.status}
                onChange={(event) =>
                  setAttendanceStatusModal((prev) => ({ ...prev, status: event.target.value }))}
                className={`mt-1 h-10 w-full rounded-lg border px-3 text-sm outline-none ${
                  isDarkTheme
                    ? "border-slate-700 bg-slate-950 text-slate-100"
                    : "border-slate-300 bg-white text-slate-800"
                }`}
              >
                {MANUAL_ATTENDANCE_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={handleManualAttendanceSave}
              disabled={manualStatusSaving}
              className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-cyan-600 px-4 text-sm font-semibold text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {manualStatusSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Save Status
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default UserDetailsEditor;
