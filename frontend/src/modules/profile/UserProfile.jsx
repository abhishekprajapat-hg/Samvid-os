import React, { useCallback, useEffect, useMemo, useState } from "react";
import PushNotificationCard from "../../components/common/PushNotificationCard";
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
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Edit3,
  Eye,
  LockKeyhole,
  Trash2,
  X,
} from "lucide-react";
import {
  getMyProfile,
  updateMyProfile,
} from "../../services/userService";
import { uploadFile } from "../../services/uploadService";
import {
  createLeaveRequest,
  getMyAttendance,
  getMyLeaveBalance,
  getMyLeaveRequests,
} from "../../services/attendanceService";
import { toErrorMessage } from "../../utils/errorMessage";
import { usePermissions } from "../../context/usePermissions";
import Modal from "../../components/ui/Modal";
import ToastNotice from "../../components/ui/ToastNotice";
import "./UserProfile.css";
import AvatarFace from "../../components/ui/AvatarFace";

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
const MANAGEMENT_ROLES = ["MANAGER"];
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
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

const formatTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
};

const formatStatus = (value, fallback = "-") => {
  const normalized = String(value || "").trim();
  return normalized ? normalized.replaceAll("_", " ") : fallback;
};

const persistCachedProfileImage = (profileImageUrl) => {
  const storedUserRaw = localStorage.getItem("user");
  if (!storedUserRaw) return;
  try {
    const storedUser = JSON.parse(storedUserRaw);
    storedUser.profileImageUrl = profileImageUrl;
    localStorage.setItem("user", JSON.stringify(storedUser));
    window.dispatchEvent(new CustomEvent("crm:profile-image-changed", { detail: { profileImageUrl } }));
  } catch {
    // Ignore an invalid local cache; the API remains the source of truth.
  }
};

const formatAttendanceStatus = (status) => {
  const normalized = String(status || "").trim().toUpperCase();
  if (normalized === "PRESENT") return "Present";
  if (normalized === "WORKING") return "Working";
  if (normalized === "BREAK") return "Break";
  if (!normalized) return "";
  return normalized.replaceAll("_", " ");
};

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

  const cellCount = days.length <= 35 ? 35 : 42;
  while (days.length < cellCount) {
    days.push({ key: `empty-trailing-${days.length}`, dateKey: "", day: "" });
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
  if (role === "ADMIN") {
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
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [profile, setProfile] = useState(null);
  const [summary, setSummary] = useState({});
  const [nameDraft, setNameDraft] = useState("");
  const [phoneDraft, setPhoneDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [accountDetailsOpen, setAccountDetailsOpen] = useState(false);
  const [photoMenuOpen, setPhotoMenuOpen] = useState(false);
  const [photoViewOpen, setPhotoViewOpen] = useState(false);
  const [photoRemoveOpen, setPhotoRemoveOpen] = useState(false);
  const [removingPhoto, setRemovingPhoto] = useState(false);
  const [attendanceMonth, setAttendanceMonth] = useState(toMonthInputValue(new Date()));
  const [selectedAttendanceDate, setSelectedAttendanceDate] = useState(toLocalDateInputValue(new Date()));
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
  const { canPageAction } = usePermissions();
  const canEditProfile = canPageAction("profile", "edit");

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
  const selectedAttendance = useMemo(
    () => attendanceByDate.get(selectedAttendanceDate) || null,
    [attendanceByDate, selectedAttendanceDate],
  );
  const selectedPendingLeave = useMemo(
    () => pendingLeaveByDate.get(selectedAttendanceDate) || null,
    [pendingLeaveByDate, selectedAttendanceDate],
  );
  const attendanceMonthLabel = useMemo(() => {
    const [year, month] = attendanceMonth.split("-").map(Number);
    return new Date(year, month - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  }, [attendanceMonth]);
  const profileMetricCards = useMemo(() => {
    const cards = [...summaryCards];
    if (profile?.role !== "ADMIN") {
      cards.push({
        key: "leaveBalance",
        label: "Leave Balance",
        value: leaveBalanceLoading ? "..." : Number(leaveBalance?.available || 0),
        icon: CalendarDays,
      });
    }
    return cards;
  }, [leaveBalance?.available, leaveBalanceLoading, profile?.role, summaryCards]);

  useEffect(() => {
    const todayKey = toLocalDateInputValue(new Date());
    setSelectedAttendanceDate(todayKey.startsWith(`${attendanceMonth}-`) ? todayKey : `${attendanceMonth}-01`);
  }, [attendanceMonth]);

  const handleRefreshAttendanceSection = useCallback(async () => {
    await Promise.all([
      loadAttendanceCalendar(),
      loadLeaveBalance(),
      loadLeaveRequests(),
    ]);
  }, [loadAttendanceCalendar, loadLeaveBalance, loadLeaveRequests]);

  const handleCalendarDateClick = (dateKey) => {
    if (!dateKey) return;
    setSelectedAttendanceDate(dateKey);
  };

  const openLeaveForSelectedDate = () => {
    if (!selectedAttendanceDate || profile?.role === "ADMIN") return;
    setLeaveRange({ fromDate: selectedAttendanceDate, toDate: selectedAttendanceDate });
    setLeaveModalOpen(true);
  };

  const moveAttendanceMonth = (step) => {
    const [year, month] = attendanceMonth.split("-").map(Number);
    setAttendanceMonth(toMonthInputValue(new Date(year, month - 1 + step, 1)));
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
    if (nextName.length < 2 || nextName.length > 80) {
      setError("Name must be between 2 and 80 characters");
      return;
    }
    if (nextPhone.length > 25 || (nextPhone && !/^[+\d()\-\s]+$/.test(nextPhone))) {
      setError("Enter a valid phone number up to 25 characters");
      return;
    }
    if (nextName === String(profile.name || "") && nextPhone === String(profile.phone || "")) {
      setEditing(false);
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
      setEditing(false);
    } catch (saveError) {
      const message = toErrorMessage(saveError, "Failed to update profile");
      console.error(`Update profile failed: ${message}`);
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const cancelEditing = () => {
    setNameDraft(String(profile?.name || ""));
    setPhoneDraft(String(profile?.phone || ""));
    setError("");
    setEditing(false);
  };

  const handlePhotoChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    setPhotoMenuOpen(false);
    if (!file) return;
    setPhotoViewOpen(false);

    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file");
      return;
    }

    try {
      setUploadingPhoto(true);
      setError("");
      const uploaded = await uploadFile(file, "profile-images");
      const response = await updateMyProfile({ profileImageUrl: uploaded.url });
      setProfile(response.profile || profile);
      setSummary(response.summary || summary);
      persistCachedProfileImage(response.profile?.profileImageUrl || uploaded.url);

      setSuccess("Profile photo updated");
    } catch (uploadError) {
      const message = toErrorMessage(uploadError, "Failed to upload photo");
      console.error(`Upload profile photo failed: ${message}`);
      setError(message);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleRemovePhoto = async () => {
    if (!profile?.profileImageUrl || !canEditProfile) return;

    try {
      setRemovingPhoto(true);
      setError("");
      const response = await updateMyProfile({ profileImageUrl: "" });
      setProfile(response.profile || { ...profile, profileImageUrl: "" });
      setSummary(response.summary || summary);
      persistCachedProfileImage("");
      setPhotoRemoveOpen(false);
      setPhotoViewOpen(false);
      setPhotoMenuOpen(false);
      setSuccess("Profile photo removed");
    } catch (removeError) {
      const message = toErrorMessage(removeError, "Failed to remove profile photo");
      console.error(`Remove profile photo failed: ${message}`);
      setError(message);
    } finally {
      setRemovingPhoto(false);
    }
  };

  return (
    <div className="profile-page ui-page-shell custom-scrollbar">
      <ToastNotice message={error} type="error" />
      <ToastNotice message={success} type="success" />

      {loading ? (
        <div className="profile-state"><Loader size={18} className="animate-spin" /> Loading your profile...</div>
      ) : !profile ? (
        <div className="profile-state profile-state-error">
          <UserCircle2 size={22} />
          <span>Profile data is not available.</span>
          <button type="button" onClick={fetchProfile}>Try again</button>
        </div>
      ) : (
        <>
          <section className="profile-identity-card">
            <div className="profile-avatar-wrap">
              {profile.profileImageUrl ? (
                <button type="button" className="profile-avatar" onClick={() => setPhotoViewOpen(true)} aria-label="View profile photo">
                  <img src={profile.profileImageUrl} alt={profile.name || "Profile"} />
                </button>
              ) : <div className="profile-avatar"><UserCircle2 size={34} /></div>}
              {canEditProfile ? (
                <button type="button" className={`profile-avatar-edit ${uploadingPhoto ? "is-busy" : ""}`} title="Profile photo options" aria-label="Profile photo options" aria-expanded={photoMenuOpen} onClick={() => setPhotoMenuOpen((open) => !open)} disabled={uploadingPhoto || removingPhoto}>
                  {uploadingPhoto ? <Loader size={12} className="animate-spin" /> : <Camera size={12} />}
                </button>
              ) : null}
              {photoMenuOpen && canEditProfile ? (
                <div className="profile-photo-menu" role="menu">
                  {profile.profileImageUrl ? <button type="button" role="menuitem" onClick={() => { setPhotoViewOpen(true); setPhotoMenuOpen(false); }}><Eye size={14} /> View photo</button> : null}
                  <label role="menuitem"><Edit3 size={14} /> {profile.profileImageUrl ? "Change photo" : "Add photo"}<input type="file" aria-label={profile.profileImageUrl ? "Change profile photo" : "Add profile photo"} accept="image/*" onChange={handlePhotoChange} disabled={uploadingPhoto} /></label>
                  {profile.profileImageUrl ? <button type="button" role="menuitem" className="is-danger" onClick={() => { setPhotoRemoveOpen(true); setPhotoMenuOpen(false); }}><Trash2 size={14} /> Remove photo</button> : null}
                </div>
              ) : null}
            </div>
            <div className="profile-identity-copy">
              <div className="profile-name-row">
                <h2>{profile.name || "Unnamed user"}</h2>
                <span>{ROLE_LABELS[profile.role] || formatStatus(profile.role)}</span>
              </div>
              <div className="profile-contact-row">
                <span><Mail size={13} /> {profile.email || "No email"}</span>
                <span><Phone size={13} /> {profile.phone || "No phone number"}</span>
              </div>
            </div>
            {canEditProfile ? (
              <button type="button" className="profile-edit-button" onClick={() => setEditing(true)} disabled={editing}>
                <Edit3 size={14} /> Edit profile
              </button>
            ) : null}
          </section>

          {profileMetricCards.length ? (
            <section className="profile-metric-grid" aria-label="Profile metrics">
              {profileMetricCards.map((card) => (
                <div key={card.key} className="profile-metric-card">
                  <span className="profile-metric-icon"><card.icon size={16} /></span>
                  <div><p>{card.label}</p><strong>{card.value}</strong></div>
                </div>
              ))}
            </section>
          ) : null}

          <div className="profile-details-grid">
            <section className="profile-card profile-personal-card">
              <ProfileCardHeader icon={UserCircle2} title="Personal details" subtitle="Your contact and account identity" />
              {editing ? (
                <div className="profile-edit-form">
                  <label>Full name<input value={nameDraft} maxLength={80} onChange={(event) => setNameDraft(event.target.value)} /></label>
                  <label>Phone<input value={phoneDraft} maxLength={25} inputMode="tel" onChange={(event) => setPhoneDraft(event.target.value)} /></label>
                  <ReadOnlyField icon={Mail} label="Email" value={profile.email || "-"} />
                  <ReadOnlyField icon={Briefcase} label="Role" value={ROLE_LABELS[profile.role] || formatStatus(profile.role)} />
                  <div className="profile-edit-actions">
                    <button type="button" className="profile-button-secondary" onClick={cancelEditing} disabled={saving}><X size={14} /> Cancel</button>
                    <button type="button" className="profile-button-primary" onClick={handleSave} disabled={saving}>
                      {saving ? <Loader size={14} className="animate-spin" /> : <Save size={14} />}{saving ? "Saving..." : "Save changes"}
                    </button>
                  </div>
                </div>
              ) : (
                <dl className="profile-detail-list">
                  <ProfileDetail label="Full name" value={profile.name || "-"} />
                  <ProfileDetail label="Phone" value={profile.phone || "Not added"} />
                  <ProfileDetail label="Email" value={profile.email || "-"} readOnly />
                  <ProfileDetail label="Role" value={ROLE_LABELS[profile.role] || formatStatus(profile.role)} readOnly />
                  <ProfileDetail label="Department" value={profile.department || "Not assigned"} />
                  <ProfileDetail label="Branch" value={profile.branch || "Not assigned"} />
                </dl>
              )}
            </section>

            <section className="profile-card profile-manager-card">
              <ProfileCardHeader icon={Users} title="Reporting manager" subtitle="Your primary reporting contact" />
              {profile.manager ? (
                <div className="profile-manager-body">
                  <div className="profile-manager-avatar"><AvatarFace user={profile.manager} initials={String(profile.manager.name || "M").trim().charAt(0).toUpperCase()} /></div>
                  <div><strong>{profile.manager.name || "-"}</strong><span>{ROLE_LABELS[profile.manager.role] || formatStatus(profile.manager.role, "Manager")}</span></div>
                  <a href={profile.manager.email ? `mailto:${profile.manager.email}` : undefined}><Mail size={13} /> {profile.manager.email || "No email"}</a>
                  <a href={profile.manager.phone ? `tel:${profile.manager.phone}` : undefined}><Phone size={13} /> {profile.manager.phone || "No phone"}</a>
                </div>
              ) : <div className="profile-empty-inline"><Users size={18} /> No reporting manager mapped</div>}
            </section>
          </div>

          <div className="profile-settings-grid">
            <PushNotificationCard />
            <section className="profile-card profile-account-card">
              <ProfileCardHeader icon={Shield} title="Account & security" subtitle="Status, employment and access information" />
              <p className="profile-account-copy">Account metadata stays private until you choose to view it.</p>
              <button type="button" className="profile-account-details-button" onClick={() => setAccountDetailsOpen(true)}><Eye size={14} /> View account details <ArrowRight size={14} /></button>
            </section>
          </div>

          <section className="profile-card profile-attendance-card">
            <div className="profile-attendance-header">
              <ProfileCardHeader icon={CalendarDays} title="Attendance" subtitle={attendanceData.timezone ? `Times shown in ${attendanceData.timezone}` : "Monthly attendance overview"} />
              <div className="profile-month-controls">
                <button type="button" onClick={() => moveAttendanceMonth(-1)} aria-label="Previous month"><ChevronLeft size={15} /></button>
                <strong>{attendanceMonthLabel}</strong>
                <button type="button" onClick={() => moveAttendanceMonth(1)} aria-label="Next month"><ChevronRight size={15} /></button>
                <button type="button" className="profile-attendance-refresh" onClick={handleRefreshAttendanceSection} disabled={attendanceLoading || leaveBalanceLoading}>
                  {attendanceLoading || leaveBalanceLoading ? <Loader size={14} className="animate-spin" /> : <RefreshCw size={14} />}<span>Refresh</span>
                </button>
              </div>
            </div>

            <div className="profile-attendance-layout">
              <div className="profile-calendar-column">
                <div className="profile-attendance-summary">
                  {attendanceSummaryCards.map((card) => <div key={card.key} className={attendanceSummaryToneClass(card.tone)}><span>{card.label}</span><strong>{Number(card.value || 0)}</strong></div>)}
                </div>
                <div className="profile-calendar">
                  <div className="profile-calendar-weekdays">{WEEKDAY_LABELS.map((label) => <span key={label}>{label}</span>)}</div>
                  <div className="profile-calendar-grid">
                    {calendarDays.map((day) => {
                      const attendanceRow = day.dateKey ? attendanceByDate.get(day.dateKey) : null;
                      const pendingLeave = day.dateKey ? pendingLeaveByDate.get(day.dateKey) : null;
                      const status = pendingLeave ? "PENDING" : attendanceRow?.status;
                      const statusLabel = pendingLeave ? "Leave pending" : formatAttendanceStatus(status);
                      const selected = day.dateKey === selectedAttendanceDate;
                      const inLeaveRange = day.dateKey ? selectedLeaveDates.has(day.dateKey) : false;
                      return (
                        <button type="button" key={day.key} disabled={!day.dateKey} aria-label={day.dateKey ? `${day.dateKey}${statusLabel ? `, ${statusLabel}` : ", no attendance record"}` : undefined} aria-pressed={day.dateKey ? selected : undefined} onClick={() => handleCalendarDateClick(day.dateKey)} className={`${selected ? "is-selected" : ""} ${inLeaveRange ? "is-leave-range" : ""}`}>
                          {day.dateKey ? <><span className="profile-calendar-day-number">{day.day}</span>{statusLabel ? <span className={`profile-calendar-status ${String(status || "").toLowerCase()}`}>{statusLabel}</span> : <span className="profile-calendar-no-record">No record</span>}</> : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <aside className="profile-attendance-sidebar">
                <div className="profile-selected-day-card">
                  <div className="profile-selected-day-heading"><div><span>Selected day</span><strong>{new Date(`${selectedAttendanceDate}T12:00:00`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</strong></div>{selectedPendingLeave ? <span className="profile-day-status pending">Leave pending</span> : selectedAttendance ? <span className={`profile-day-status ${String(selectedAttendance.status || "").toLowerCase()}`}>{formatAttendanceStatus(selectedAttendance.status)}</span> : <span className="profile-day-status">No record</span>}</div>
                  <div className="profile-day-details">
                    <div><span>Check in</span><strong>{formatTime(selectedAttendance?.checkInAt)}</strong></div>
                    <div><span>Check out</span><strong>{formatTime(selectedAttendance?.checkOutAt)}</strong></div>
                    <div><span>Worked</span><strong>{formatDuration(selectedAttendance?.workedMinutes)}</strong></div>
                    <div><span>Break</span><strong>{formatDuration(selectedAttendance?.totalBreakMinutes)}</strong></div>
                  </div>
                  {selectedAttendance?.isLateCheckIn ? <p className="profile-late-note"><Clock3 size={13} /> Late check-in recorded</p> : null}
                  {profile.role !== "ADMIN" ? <button type="button" className="profile-apply-leave" onClick={openLeaveForSelectedDate}><CalendarDays size={14} /> Apply leave for this date</button> : null}
                </div>

                {profile.role !== "ADMIN" ? (
                  <div className="profile-leave-card">
                    <div className="profile-leave-balance"><span>Leave balance</span><strong>{leaveBalanceLoading ? "..." : Number(leaveBalance?.available || 0)}</strong><small>days available</small></div>
                    <div className="profile-leave-breakdown"><span>Accrued <b>{Number(leaveBalance?.accrued || 0)}</b></span><span>Used <b>{Number(leaveBalance?.used || 0)}</b></span><span>Pending <b>{Number(leaveBalance?.pending || 0)}</b></span></div>
                    <p><CheckCircle2 size={13} /> {Number(leaveBalance?.monthlyAccrual || 1)} leave is added monthly; unused leave carries forward.</p>
                  </div>
                ) : null}
                <button type="button" className="profile-open-attendance" onClick={() => navigate("/attendance")}><CalendarDays size={14} /> Open full attendance <ArrowRight size={14} /></button>
              </aside>
            </div>
          </section>

          <Modal open={leaveModalOpen && profile.role !== "ADMIN"} onClose={closeLeaveModal} title="Apply for leave" description="Your request will follow the existing approval and leave-balance rules." size="sm">
            <form onSubmit={handleSubmitLeaveFromProfile} className="profile-leave-form">
              <div className="profile-leave-date-grid">
                <label>From<input type="date" value={leaveRange.fromDate} onChange={(event) => { const value = event.target.value; setLeaveRange((previous) => ({ fromDate: value, toDate: previous.toDate && previous.toDate >= value ? previous.toDate : value })); }} /></label>
                <label>To<input type="date" value={leaveRange.toDate} onChange={(event) => { const value = event.target.value; setLeaveRange((previous) => ({ fromDate: previous.fromDate && previous.fromDate <= value ? previous.fromDate : value, toDate: value })); }} /></label>
              </div>
              <label>Leave type<select value={leaveType} onChange={(event) => setLeaveType(event.target.value)}><option value="CASUAL">Casual</option><option value="SICK">Sick</option><option value="EMERGENCY">Emergency</option><option value="UNPAID">Unpaid</option><option value="OTHER">Other</option></select></label>
              <label>Reason<textarea value={leaveReason} onChange={(event) => setLeaveReason(event.target.value)} rows={3} maxLength={500} placeholder="Reason for leave" /></label>
              <div className="profile-modal-actions"><button type="button" className="profile-button-secondary" onClick={closeLeaveModal}>Cancel</button><button type="submit" className="profile-button-primary" disabled={leaveSubmitting}>{leaveSubmitting ? <Loader size={14} className="animate-spin" /> : <CalendarDays size={14} />}{leaveSubmitting ? "Submitting..." : "Submit request"}</button></div>
            </form>
          </Modal>

          <Modal open={accountDetailsOpen} onClose={() => setAccountDetailsOpen(false)} title="Account details" description="Employment and account metadata visible to you." size="md">
            <dl className="profile-account-detail-list">
              <ProfileDetail label="Employee ID" value={profile.employeeId || profile.employeeCode || "-"} />
              <ProfileDetail label="Account status" value={profile.isActive ? "Active" : "Inactive"} />
              <ProfileDetail label="Department" value={profile.department || "Not assigned"} />
              <ProfileDetail label="Branch" value={profile.branch || "Not assigned"} />
              <ProfileDetail label="Shift" value={profile.shiftTiming || "Not assigned"} />
              <ProfileDetail label="Joining date" value={formatDate(profile.joiningDate)} />
              <ProfileDetail label="Last login" value={formatDate(profile.lastLoginAt)} />
              <ProfileDetail label="Account created" value={formatDate(profile.createdAt)} />
              <ProfileDetail label="Last updated" value={formatDate(profile.updatedAt)} />
            </dl>
          </Modal>

          <Modal open={photoViewOpen && Boolean(profile.profileImageUrl)} onClose={() => setPhotoViewOpen(false)} title="Profile photo" description="Your current profile picture." size="sm">
            <div className="profile-photo-preview">
              <img src={profile.profileImageUrl} alt={profile.name || "Profile"} />
              {canEditProfile ? (
                <div className="profile-modal-actions">
                  <label className="profile-button-secondary profile-photo-change-button"><Edit3 size={14} /> Change photo<input type="file" aria-label="Change profile photo" accept="image/*" onChange={handlePhotoChange} disabled={uploadingPhoto || removingPhoto} /></label>
                  <button type="button" className="profile-button-danger" onClick={() => { setPhotoViewOpen(false); setPhotoRemoveOpen(true); }} disabled={uploadingPhoto || removingPhoto}><Trash2 size={14} /> Remove</button>
                </div>
              ) : null}
            </div>
          </Modal>

          <Modal open={photoRemoveOpen && Boolean(profile.profileImageUrl)} onClose={() => { if (!removingPhoto) setPhotoRemoveOpen(false); }} title="Remove profile photo?" description="Your account will return to the default avatar." size="sm">
            <div className="profile-remove-photo-confirmation">
              <p>This removes the photo from your CRM profile.</p>
              <div className="profile-modal-actions">
                <button type="button" className="profile-button-secondary" onClick={() => setPhotoRemoveOpen(false)} disabled={removingPhoto}>Cancel</button>
                <button type="button" className="profile-button-danger" onClick={handleRemovePhoto} disabled={removingPhoto}>{removingPhoto ? <Loader size={14} className="animate-spin" /> : <Trash2 size={14} />}{removingPhoto ? "Removing..." : "Remove photo"}</button>
              </div>
            </div>
          </Modal>
        </>
      )}
    </div>
  );
};

const ProfileCardHeader = ({ icon, title, subtitle }) => (
  <div className="profile-card-header"><span>{React.createElement(icon, { size: 16 })}</span><div><h3>{title}</h3><p>{subtitle}</p></div></div>
);

const ProfileDetail = ({ label, value, readOnly = false }) => (
  <div><dt>{label}{readOnly ? <LockKeyhole size={10} /> : null}</dt><dd>{value}</dd></div>
);

const ReadOnlyField = ({ icon, label, value }) => (
  <div className="profile-readonly-field"><span>{label}<LockKeyhole size={10} /></span><div>{React.createElement(icon, { size: 13 })} {value}</div></div>
);

export default UserProfile;
