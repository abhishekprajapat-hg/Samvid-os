import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion as Motion } from "framer-motion";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Loader2,
  NotebookPen,
  Save,
  Plus,
  RefreshCw,
  Phone,
  User,
  Users,
  Mail,
  MapPin,
  MessageCircle,
  PanelRightOpen,
  Trash2,
  X,
} from "lucide-react";
import api from "../../services/api";
import { addLeadDiaryEntry, getLeadDiary } from "../../services/leadService";
import { toErrorMessage } from "../../utils/errorMessage";
import { getTasks, updateTask } from "../../services/taskService";
import ToastNotice from "../../components/ui/ToastNotice";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const toDateKey = (dateValue) => {
  const d = new Date(dateValue);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
};

const toLocalDateTimeInput = (date) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const mins = String(d.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${mins}`;
};

const formatDateTime = (dateValue) => {
  const d = new Date(dateValue);
  return d.toLocaleString([], {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatDiaryTime = (dateValue) => {
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return "-";

  return d.toLocaleString([], {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const buildCalendarCells = (monthDate) => {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const first = new Date(year, month, 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const d = new Date(start);
    d.setDate(start.getDate() + index);
    return d;
  });
};

const getAssignedUser = (lead) =>
  lead?.assignedTo || lead?.assignedExecutive || lead?.assignedFieldExecutive || null;

const getAssignedLabel = (lead) => {
  const assignedUser = getAssignedUser(lead);
  if (assignedUser?.name) return assignedUser.name;
  return "Unassigned";
};

const getReportingLabel = (lead) => {
  if (lead?.assignedManager?.name) return lead.assignedManager.name;
  return "-";
};

const normalizePhoneDigits = (value) =>
  String(value || "").replace(/\D/g, "");

const getDialerHref = (phone) => {
  const digits = normalizePhoneDigits(phone);
  return digits ? `tel:${digits}` : "";
};

const getWhatsAppHref = (phone) => {
  const digits = normalizePhoneDigits(phone);
  if (!digits) return "";
  const waNumber = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${waNumber}`;
};

const getMailHref = (email) => {
  const trimmed = String(email || "").trim();
  return trimmed ? `mailto:${trimmed}` : "";
};

const getMapsHref = (lead) => {
  const locationQuery = [lead?.projectInterested, lead?.city]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(", ");
  return locationQuery
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locationQuery)}`
    : "";
};

const formatCurrencyInr = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "-";
  return `Rs ${amount.toLocaleString("en-IN")}`;
};

const getRemainingAmount = (lead) => {
  const paymentType = String(lead?.dealPayment?.paymentType || "").trim().toUpperCase();
  const remainingAmount = Number(lead?.dealPayment?.remainingAmount);

  if (paymentType === "FULL") return 0;
  if (paymentType === "PARTIAL" && Number.isFinite(remainingAmount) && remainingAmount > 0) {
    return remainingAmount;
  }
  if (Number.isFinite(remainingAmount) && remainingAmount >= 0) {
    return remainingAmount;
  }
  return null;
};

const MasterSchedule = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [leads, setLeads] = useState([]);
  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [activeDiaryLeadId, setActiveDiaryLeadId] = useState("");
  const [detailsLeadId, setDetailsLeadId] = useState("");
  const [deletingLeadId, setDeletingLeadId] = useState("");
  const [diaryLoading, setDiaryLoading] = useState(false);
  const [diarySaving, setDiarySaving] = useState(false);
  const [diaryDraft, setDiaryDraft] = useState("");
  const [diaryEntries, setDiaryEntries] = useState([]);

  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [form, setForm] = useState({
    leadId: "",
    nextFollowUp: "",
  });

  const isDark = (localStorage.getItem("theme") || "light") === "dark";
  const [tasks, setTasks] = useState([]);

  const loadScheduleData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const [leadsRes, tasksData] = await Promise.all([
        api.get("/leads"),
        getTasks()
      ]);
      const list = leadsRes.data?.leads || [];
      setLeads(list);
      setTasks(tasksData || []);
      if (!form.leadId && list.length > 0) {
        setForm((prev) => ({
          ...prev,
          leadId: list[0]._id,
        }));
      }
    } catch (err) {
      setError(toErrorMessage(err, "Failed to load schedule data"));
      setLeads([]);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [form.leadId]);

  useEffect(() => {
    loadScheduleData();
  }, [loadScheduleData]);

  useEffect(() => {
    const now = new Date(selectedDate);
    now.setHours(11, 0, 0, 0);
    setForm((prev) => ({
      ...prev,
      nextFollowUp: prev.nextFollowUp || toLocalDateTimeInput(now),
    }));
  }, [selectedDate]);

  const followUps = useMemo(
    () => leads.filter((lead) => Boolean(lead.nextFollowUp)),
    [leads],
  );

  const byDate = useMemo(() => {
    const map = new Map();
    followUps.forEach((lead) => {
      const key = toDateKey(lead.nextFollowUp);
      const arr = map.get(key) || [];
      arr.push(lead);
      map.set(key, arr);
    });
    return map;
  }, [followUps]);

  const tasksByDate = useMemo(() => {
    const map = new Map();
    tasks.forEach((task) => {
      if (!task.dueDate) return;
      const key = toDateKey(task.dueDate);
      const arr = map.get(key) || [];
      arr.push(task);
      map.set(key, arr);
    });
    return map;
  }, [tasks]);

  const calendarCells = useMemo(() => buildCalendarCells(monthCursor), [monthCursor]);
  const selectedKey = toDateKey(selectedDate);
  const selectedDayItems = useMemo(() => {
    const items = [...(byDate.get(selectedKey) || [])];
    return items.sort((a, b) => new Date(a.nextFollowUp) - new Date(b.nextFollowUp));
  }, [byDate, selectedKey]);

  const selectedDayTasks = useMemo(() => {
    const key = toDateKey(selectedDate);
    return (tasksByDate.get(key) || []).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
  }, [tasksByDate, selectedDate]);

  const selectedDayLead = useMemo(
    () => selectedDayItems.find((lead) => lead._id === selectedLeadId) || selectedDayItems[0] || null,
    [selectedDayItems, selectedLeadId],
  );
  const selectedLead = useMemo(() => {
    if (activeDiaryLeadId) {
      return leads.find((lead) => lead._id === activeDiaryLeadId) || null;
    }
    return selectedDayLead;
  }, [activeDiaryLeadId, leads, selectedDayLead]);
  const detailsLead = useMemo(
    () => leads.find((lead) => lead._id === detailsLeadId) || null,
    [leads, detailsLeadId],
  );
  const selectedDiaryLeadId = String(selectedLead?._id || "");
  const detailsDialerHref = getDialerHref(detailsLead?.phone);
  const detailsWhatsAppHref = getWhatsAppHref(detailsLead?.phone);
  const detailsMailHref = getMailHref(detailsLead?.email);
  const detailsMapsHref = getMapsHref(detailsLead);
  const detailsRemainingAmount = getRemainingAmount(detailsLead);
  const hasAnyContactAction = Boolean(
    detailsDialerHref || detailsWhatsAppHref || detailsMailHref || detailsMapsHref,
  );
  const detailsPaymentMode = String(detailsLead?.dealPayment?.mode || "")
    .trim()
    .replaceAll("_", " ");
  const detailsPaymentType = String(detailsLead?.dealPayment?.paymentType || "")
    .trim()
    .replaceAll("_", " ");

  const monthTitle = monthCursor.toLocaleDateString([], {
    month: "long",
    year: "numeric",
  });
  const todayKey = toDateKey(new Date());
  const todayFollowUps = byDate.get(todayKey)?.length || 0;
  const todayTasks = tasksByDate.get(todayKey)?.length || 0;
  const completedTasks = tasks.filter((task) => task.status === "COMPLETED").length;

  useEffect(() => {
    if (!selectedDayItems.length) {
      setSelectedLeadId("");
      return;
    }

    const isSelectedLeadStillVisible = selectedDayItems.some((lead) => lead._id === selectedLeadId);
    if (!isSelectedLeadStillVisible) {
      setSelectedLeadId(selectedDayItems[0]._id);
    }
  }, [selectedDayItems, selectedLeadId]);

  useEffect(() => {
    if (activeDiaryLeadId && !leads.some((lead) => lead._id === activeDiaryLeadId)) {
      setActiveDiaryLeadId("");
      setDiaryDraft("");
      setDiaryEntries([]);
      return;
    }
  }, [activeDiaryLeadId, leads]);

  useEffect(() => {
    if (detailsLeadId && !leads.some((lead) => lead._id === detailsLeadId)) {
      setDetailsLeadId("");
    }
  }, [detailsLeadId, leads]);

  useEffect(() => {
    if (!activeDiaryLeadId && selectedDayLead?._id) {
      setActiveDiaryLeadId(selectedDayLead._id);
    }
  }, [activeDiaryLeadId, selectedDayLead]);

  useEffect(() => {
    let isCancelled = false;

    const loadDiary = async () => {
      if (!selectedDiaryLeadId) {
        setDiaryEntries([]);
        setDiaryLoading(false);
        return;
      }

      try {
        setDiaryLoading(true);
        const entries = await getLeadDiary(selectedDiaryLeadId);
        if (!isCancelled) {
          setDiaryEntries(Array.isArray(entries) ? entries : []);
        }
      } catch (err) {
        if (!isCancelled) {
          setDiaryEntries([]);
          setError(toErrorMessage(err, "Failed to load lead diary"));
        }
      } finally {
        if (!isCancelled) {
          setDiaryLoading(false);
        }
      }
    };

    loadDiary();

    return () => {
      isCancelled = true;
    };
  }, [selectedDiaryLeadId]);

  const handleSchedule = async () => {
    if (!form.leadId || !form.nextFollowUp) {
      setError("Lead and follow-up date/time are required");
      return;
    }

    const lead = leads.find((l) => l._id === form.leadId);
    if (!lead) {
      setError("Invalid lead selected");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      await api.patch(`/leads/${form.leadId}/status`, {
        status: lead.status || "NEW",
        nextFollowUp: form.nextFollowUp,
      });

      setSuccess("Follow-up scheduled successfully");
      await loadScheduleData();

      const followUpDate = new Date(form.nextFollowUp);
      if (!Number.isNaN(followUpDate.getTime())) {
        setSelectedDate(followUpDate);
        setMonthCursor(new Date(followUpDate.getFullYear(), followUpDate.getMonth(), 1));
      }
      setSelectedLeadId(form.leadId);
      setActiveDiaryLeadId(form.leadId);
      setDiaryDraft("");
    } catch (err) {
      setError(toErrorMessage(err, "Failed to schedule follow-up"));
    } finally {
      setSaving(false);
    }
  };

  const moveMonth = (step) => {
    setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + step, 1));
  };

  const goToday = () => {
    const now = new Date();
    setSelectedDate(now);
    setMonthCursor(new Date(now.getFullYear(), now.getMonth(), 1));
  };

  const handleSelectLead = (leadId) => {
    setSelectedLeadId(leadId);
    setActiveDiaryLeadId(leadId);
    setDiaryDraft("");
  };

  const handleOpenLeadDetails = (leadId) => {
    setSelectedLeadId(leadId);
    setActiveDiaryLeadId(leadId);
    setDetailsLeadId(leadId);
    setDiaryDraft("");
  };

  const handleCloseLeadDetails = () => {
    setDetailsLeadId("");
  };

  const handleDeleteFollowUp = async (lead) => {
    const leadId = String(lead?._id || "");
    if (!leadId || deletingLeadId) return;

    const confirmed = window.confirm(
      `Delete follow-up for ${lead?.name || "this lead"}?`,
    );
    if (!confirmed) return;

    try {
      setDeletingLeadId(leadId);
      setError("");
      setSuccess("");

      await api.patch(`/leads/${leadId}/status`, {
        status: lead?.status || "NEW",
        nextFollowUp: null,
      });

      if (detailsLeadId === leadId) {
        setDetailsLeadId("");
      }

      if (selectedLeadId === leadId) {
        setSelectedLeadId("");
        setActiveDiaryLeadId("");
        setDiaryDraft("");
        setDiaryEntries([]);
      }

      setSuccess("Follow-up deleted successfully");
      await loadScheduleData();
    } catch (err) {
      setError(toErrorMessage(err, "Failed to delete follow-up"));
    } finally {
      setDeletingLeadId("");
    }
  };

  const handleFormLeadChange = (leadId) => {
    setForm((prev) => ({ ...prev, leadId }));
    setSelectedLeadId(leadId);
    setActiveDiaryLeadId(leadId);
    setDiaryDraft("");

    const selected = leads.find((lead) => lead._id === leadId);
    if (!selected?.nextFollowUp) return;

    const followUpDate = new Date(selected.nextFollowUp);
    if (Number.isNaN(followUpDate.getTime())) return;

    setSelectedDate(followUpDate);
    setMonthCursor(new Date(followUpDate.getFullYear(), followUpDate.getMonth(), 1));
  };

  const handleAddDiary = async () => {
    if (!selectedDiaryLeadId) {
      setError("Select a follow-up lead first");
      return;
    }

    const note = diaryDraft.trim();
    if (!note) {
      setError("Diary note cannot be empty");
      return;
    }

    try {
      setDiarySaving(true);
      setError("");
      setSuccess("");

      const createdEntry = await addLeadDiaryEntry(selectedDiaryLeadId, note);
      if (createdEntry) {
        setDiaryEntries((prev) => [createdEntry, ...prev]);
      } else {
        const entries = await getLeadDiary(selectedDiaryLeadId);
        setDiaryEntries(Array.isArray(entries) ? entries : []);
      }

      setDiaryDraft("");
      setSuccess("Diary note added");
    } catch (err) {
      setError(toErrorMessage(err, "Failed to save diary note"));
    } finally {
      setDiarySaving(false);
    }
  };

  const handleToggleTaskComplete = async (task) => {
    const newStatus = task.status === "COMPLETED" ? "TODO" : "COMPLETED";
    try {
      await updateTask(task._id, { status: newStatus });
      setSuccess(`Task marked as ${newStatus.toLowerCase()}`);
      await loadScheduleData();
    } catch (err) {
      setError(toErrorMessage(err, "Failed to update task status"));
    }
  };

  return (
    <div className={`calendar-doc-screen ui-page-shell custom-scrollbar overflow-x-hidden ${isDark ? "bg-slate-950/35" : "bg-white/30"}`}>
      <div className="calendar-toolbar flex flex-wrap items-center justify-end gap-2">
          <button
            onClick={loadScheduleData}
            className={`calendar-btn h-10 px-4 rounded-xl border text-sm font-semibold flex items-center gap-2 ${
              isDark ? "border-slate-700 bg-slate-900/70 text-slate-200" : "border-slate-300 bg-white text-slate-700"
            }`}
          >
            <RefreshCw size={15} />
            Refresh
          </button>
          <button
            onClick={goToday}
            className={`calendar-btn calendar-btn-primary h-10 px-4 rounded-xl border text-sm font-semibold ${
              isDark ? "border-cyan-400/40 bg-cyan-500/10 text-cyan-200" : "border-sky-300 bg-sky-50 text-sky-700"
            }`}
          >
            Today
          </button>
      </div>

      <ToastNotice message={error} type="error" />
      <ToastNotice message={success} type="success" />

      <section className="calendar-statgrid">
        <div className="calendar-stat">
          <div>
            <p>Total follow-ups</p>
            <strong>{followUps.length}</strong>
            <span>{leads.length} leads loaded</span>
          </div>
          <CalendarIcon size={17} />
        </div>
        <div className="calendar-stat">
          <div>
            <p>Today</p>
            <strong>{todayFollowUps + todayTasks}</strong>
            <span>{todayFollowUps} follow-ups, {todayTasks} tasks</span>
          </div>
          <Clock3 size={17} />
        </div>
        <div className="calendar-stat">
          <div>
            <p>Task deadlines</p>
            <strong>{tasks.length}</strong>
            <span>{completedTasks} completed</span>
          </div>
          <NotebookPen size={17} />
        </div>
      </section>

      <div className="calendar-layout grid grid-cols-1 gap-3 md:gap-5 md:min-h-[640px] xl:grid-cols-[1.2fr_0.8fr]">
        <section className={`calendar-card calendar-month-card rounded-2xl border overflow-hidden ${isDark ? "border-slate-700 bg-slate-900/70" : "border-slate-200 bg-white"}`}>
          <div className={`calendar-card-head h-14 px-4 flex items-center justify-between border-b ${isDark ? "border-slate-700 bg-slate-900/90" : "border-slate-200 bg-slate-50"}`}>
            <div className={`text-sm font-bold tracking-wide ${isDark ? "text-slate-100" : "text-slate-800"}`}>{monthTitle}</div>
            <div className="flex items-center gap-1">
              <button onClick={() => moveMonth(-1)} className={`calendar-icon-btn p-2 rounded-lg ${isDark ? "hover:bg-slate-800 text-slate-300" : "hover:bg-slate-200 text-slate-600"}`}>
                <ChevronLeft size={16} />
              </button>
              <button onClick={() => moveMonth(1)} className={`calendar-icon-btn p-2 rounded-lg ${isDark ? "hover:bg-slate-800 text-slate-300" : "hover:bg-slate-200 text-slate-600"}`}>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          <div className={`calendar-weekdays grid grid-cols-7 border-b ${isDark ? "border-slate-700" : "border-slate-200"}`}>
            {DAY_NAMES.map((day) => (
              <div key={day} className={`py-2 text-center text-[11px] font-bold uppercase tracking-wider ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                {day}
              </div>
            ))}
          </div>

          <div className="calendar-grid grid grid-cols-7 auto-rows-fr">
            {calendarCells.map((date) => {
              const key = toDateKey(date);
              const leadCount = (byDate.get(key) || []).length;
              const taskCount = (tasksByDate.get(key) || []).length;
              const selected = key === selectedKey;
              const inMonth = date.getMonth() === monthCursor.getMonth();
              const isToday = key === toDateKey(new Date());

              return (
                <button
                  key={key}
                  onClick={() => setSelectedDate(date)}
                  className={`calendar-day min-h-[56px] border p-1.5 text-left transition-colors sm:min-h-[92px] sm:p-2 ${
                    isDark ? "border-slate-800 hover:bg-slate-800/60" : "border-slate-100 hover:bg-slate-50"
                  } ${selected ? (isDark ? "is-selected bg-cyan-500/10" : "is-selected bg-sky-50") : ""} ${inMonth ? "" : "is-muted"}`}
                >
                  <div className="flex items-start justify-between w-full h-full">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      isToday ? "bg-cyan-500 text-white" : inMonth ? (isDark ? "text-slate-200" : "text-slate-700") : (isDark ? "text-slate-600" : "text-slate-300")
                    }`}>
                      {date.getDate()}
                    </span>
                    <div className="flex flex-col gap-1 items-end shrink-0">
                      {leadCount > 0 && (
                        <span 
                      className={`rounded px-1 py-0.5 text-[8px] font-bold sm:px-1.5 sm:text-[9px] ${
                            isDark ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}
                          title={`${leadCount} Lead Follow-up(s)`}
                        >
                          {leadCount} L
                        </span>
                      )}
                      {taskCount > 0 && (
                        <span 
                      className={`rounded px-1 py-0.5 text-[8px] font-bold sm:px-1.5 sm:text-[9px] ${
                            isDark ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" : "bg-emerald-50 text-emerald-700 border border-emerald-250"
                          }`}
                          title={`${taskCount} Task Deadline(s)`}
                        >
                          {taskCount} T
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="calendar-side grid grid-rows-[auto_auto] gap-3 md:gap-4 xl:min-h-0 xl:grid-rows-[auto_1fr]">
          <div className={`calendar-card calendar-form-card rounded-2xl border p-3 sm:p-4 ${isDark ? "border-slate-700 bg-slate-900/75" : "border-slate-200 bg-white"}`}>
            <h3 className={`text-sm font-bold mb-3 ${isDark ? "text-slate-100" : "text-slate-800"}`}>Schedule Follow-up</h3>
            <div className="space-y-2">
              <select
                value={form.leadId}
                onChange={(e) => handleFormLeadChange(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border bg-transparent text-sm"
              >
                <option value="">Select lead</option>
                {leads.map((lead) => (
                  <option key={lead._id} value={lead._id}>
                    {lead.name} ({lead.phone})
                  </option>
                ))}
              </select>
              <input
                type="datetime-local"
                value={form.nextFollowUp}
                onChange={(e) => setForm((prev) => ({ ...prev, nextFollowUp: e.target.value }))}
                className="w-full h-10 px-3 rounded-xl border bg-transparent text-sm"
              />
              <button
                onClick={handleSchedule}
                disabled={saving}
                className={`w-full h-10 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 ${
                  isDark ? "bg-cyan-600 hover:bg-cyan-500 text-white" : "bg-sky-600 hover:bg-sky-500 text-white"
                } disabled:opacity-60`}
              >
                <Plus size={14} />
                {saving ? "Saving..." : "Save Follow-up"}
              </button>
            </div>
          </div>

          <div className={`calendar-card calendar-agenda-card rounded-2xl border flex flex-col xl:min-h-0 ${isDark ? "border-slate-700 bg-slate-900/75" : "border-slate-200 bg-white"}`}>
            <div className={`calendar-card-head p-4 border-b ${isDark ? "border-slate-700" : "border-slate-200"}`}>
              <div className={`text-sm font-bold ${isDark ? "text-slate-100" : "text-slate-800"}`}>
                {new Date(selectedDate).toLocaleDateString([], { weekday: "long", day: "2-digit", month: "long" })}
              </div>
              <div className={`text-xs mt-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                {selectedDayItems.length} follow-up{selectedDayItems.length === 1 ? "" : "s"}, {selectedDayTasks.length} task{selectedDayTasks.length === 1 ? "" : "s"}
              </div>
            </div>

            <div className="calendar-agenda-scroll flex-1 overflow-visible p-4 space-y-4 xl:overflow-y-auto custom-scrollbar">
                {loading ? (
                  <div className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>Loading...</div>
                ) : (
                  <>
                    {/* SECTION 1: Lead Follow-ups */}
                    <div className="space-y-2.5">
                      <h4 className={`text-xs font-bold uppercase tracking-wider flex items-center justify-between ${
                        isDark ? "text-slate-400" : "text-slate-500"
                      }`}>
                        <span>Lead Follow-ups</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                          isDark ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-600"
                        }`}>{selectedDayItems.length}</span>
                      </h4>
                      {selectedDayItems.length === 0 ? (
                        <div className={`text-xs p-3 border border-dashed rounded-xl text-center ${
                          isDark ? "border-slate-800 text-slate-500" : "border-slate-200 text-slate-400"
                        }`}>
                          No follow-ups scheduled
                        </div>
                      ) : (
                        selectedDayItems.map((lead, index) => {
                          const isActiveLead = selectedLeadId === lead._id;
                          const isDiaryForLead = selectedDiaryLeadId === lead._id;

                          return (
                            <div key={lead._id} className="space-y-3">
                              <Motion.div
                                initial={{ opacity: 0, x: 10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.04 }}
                                onClick={() => handleSelectLead(lead._id)}
                                className={`rounded-xl border p-3 cursor-pointer transition-colors ${
                                  isActiveLead
                                    ? (isDark ? "border-cyan-500/50 bg-cyan-500/10" : "border-sky-400 bg-sky-50")
                                    : (isDark ? "border-slate-700 bg-slate-900/85 hover:border-slate-500" : "border-slate-200 bg-white hover:border-slate-300")
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className={`text-sm font-semibold ${isDark ? "text-slate-100" : "text-slate-900"}`}>{lead.name}</div>
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        handleOpenLeadDetails(lead._id);
                                      }}
                                      className={`inline-flex h-7 w-7 items-center justify-center rounded-md border ${
                                        isDark
                                          ? "border-slate-600 bg-slate-800 text-slate-200 hover:border-cyan-400/60"
                                          : "border-slate-300 bg-white text-slate-600 hover:border-sky-400 hover:text-sky-700"
                                      }`}
                                      title="Follow-up details"
                                      aria-label="Open follow-up details"
                                    >
                                      <PanelRightOpen size={13} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        handleDeleteFollowUp(lead);
                                      }}
                                      disabled={deletingLeadId === lead._id}
                                      className={`inline-flex h-7 w-7 items-center justify-center rounded-md border ${
                                        isDark
                                          ? "border-rose-500/50 bg-rose-500/10 text-rose-200 hover:border-rose-400"
                                          : "border-rose-300 bg-rose-50 text-rose-700 hover:border-rose-400"
                                      } disabled:opacity-60`}
                                      title="Delete follow-up"
                                      aria-label="Delete follow-up"
                                    >
                                      {deletingLeadId === lead._id ? (
                                        <Loader2 size={13} className="animate-spin" />
                                      ) : (
                                        <Trash2 size={13} />
                                      )}
                                    </button>
                                  </div>
                                </div>
                                <div className={`mt-2 text-xs space-y-1 ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                                  <div className="flex items-center gap-2">
                                    <Clock3 size={12} /> {formatDateTime(lead.nextFollowUp)}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Phone size={12} /> {lead.phone || "-"}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <User size={12} /> Assigned: {getAssignedLabel(lead)}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Users size={12} /> Under: {getReportingLabel(lead)}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <User size={12} /> {lead.status}
                                  </div>
                                </div>
                              </Motion.div>

                              {isActiveLead && isDiaryForLead ? (
                                <div className={`rounded-xl border p-4 space-y-3 ${isDark ? "border-cyan-500/40 bg-slate-900/70" : "border-sky-300 bg-sky-50/60"}`}>
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                      <NotebookPen size={14} className={isDark ? "text-cyan-300" : "text-sky-700"} />
                                      <span className={`text-sm font-bold ${isDark ? "text-slate-100" : "text-slate-800"}`}>
                                        Lead Diary
                                      </span>
                                    </div>
                                    <span className={`text-[11px] font-semibold ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                                      {lead.name}
                                    </span>
                                  </div>

                                  <div className="space-y-2">
                                    <textarea
                                      value={diaryDraft}
                                      onChange={(e) => setDiaryDraft(e.target.value)}
                                      maxLength={2000}
                                      placeholder={`Add diary note for ${lead.name}`}
                                      className={`w-full min-h-[84px] rounded-xl border px-3 py-2 text-sm bg-transparent resize-y ${
                                        isDark ? "border-slate-700 text-slate-100 placeholder:text-slate-500" : "border-slate-300 text-slate-800 placeholder:text-slate-400"
                                      }`}
                                    />
                                    <div className="flex items-center justify-between gap-2">
                                      <span className={`text-[11px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                                        {diaryDraft.length}/2000
                                      </span>
                                      <button
                                        onClick={handleAddDiary}
                                        disabled={diarySaving || !diaryDraft.trim()}
                                        className={`h-9 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${
                                          isDark ? "bg-cyan-600 hover:bg-cyan-500 text-white" : "bg-sky-600 hover:bg-sky-500 text-white"
                                        } disabled:opacity-60`}
                                      >
                                        {diarySaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                                        {diarySaving ? "Saving..." : "Add Note"}
                                      </button>
                                    </div>
                                  </div>

                                  <div className={`rounded-xl border max-h-48 overflow-y-auto custom-scrollbar ${isDark ? "border-slate-700 bg-slate-900/50" : "border-slate-200 bg-white"}`}>
                                    {diaryLoading ? (
                                      <div className={`px-3 py-4 text-sm flex items-center gap-2 ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                                        <Loader2 size={14} className="animate-spin" /> Loading diary...
                                      </div>
                                    ) : diaryEntries.length === 0 ? (
                                      <div className={`px-3 py-4 text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                                        No diary notes yet
                                      </div>
                                    ) : (
                                      <div className="divide-y divide-slate-200/60 dark:divide-slate-700/80">
                                        {diaryEntries.map((entry) => (
                                          <div key={entry._id} className="px-3 py-2.5">
                                            <p className={`text-sm whitespace-pre-wrap break-words ${isDark ? "text-slate-100" : "text-slate-800"}`}>
                                              {entry.note}
                                            </p>
                                            <div className={`mt-1 text-[11px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                                              {entry.createdBy?.name || "Unknown"} - {formatDiaryTime(entry.createdAt)}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* SECTION 2: Task Deadlines */}
                    <div className="space-y-2.5 pt-2">
                      <h4 className={`text-xs font-bold uppercase tracking-wider flex items-center justify-between ${
                        isDark ? "text-slate-400" : "text-slate-500"
                      }`}>
                        <span>Task Deadlines</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                          isDark ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-600"
                        }`}>{selectedDayTasks.length}</span>
                      </h4>
                      {selectedDayTasks.length === 0 ? (
                        <div className={`text-xs p-3 border border-dashed rounded-xl text-center ${
                          isDark ? "border-slate-800 text-slate-500" : "border-slate-200 text-slate-400"
                        }`}>
                          No tasks due
                        </div>
                      ) : (
                        selectedDayTasks.map((task, index) => {
                          const isCompleted = task.status === "COMPLETED";
                          return (
                            <Motion.div
                              key={task._id}
                              initial={{ opacity: 0, x: 10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: index * 0.04 }}
                              className={`rounded-xl border p-3 flex items-start gap-3 transition-colors ${
                                isDark ? "border-slate-700 bg-slate-900/85 hover:border-slate-500" : "border-slate-200 bg-white hover:border-slate-300"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isCompleted}
                                onChange={() => handleToggleTaskComplete(task)}
                                className="mt-1 h-4 w-4 rounded border-slate-700 bg-transparent text-emerald-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                              />
                              <div className="flex-1 min-w-0">
                                <div className={`text-sm font-semibold truncate ${
                                  isCompleted ? "line-through text-slate-500" : (isDark ? "text-slate-100" : "text-slate-900")
                                }`}>
                                  {task.title}
                                </div>
                                {task.description && (
                                  <p className={`text-xs truncate ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                                    {task.description}
                                  </p>
                                )}
                                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px]">
                                  <span className={`px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                                    task.priority === "HIGH" ? "bg-rose-500/15 text-rose-450 border border-rose-500/10" :
                                    task.priority === "MEDIUM" ? "bg-amber-500/15 text-amber-450 border border-amber-500/10" :
                                    "bg-blue-500/15 text-blue-450 border border-blue-500/10"
                                  }`}>
                                    {task.priority}
                                  </span>
                                  <span className={`px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                                    isCompleted ? "bg-emerald-500/15 text-emerald-450" : "bg-slate-500/15 text-slate-400"
                                  }`}>
                                    {task.status.replace("_", " ")}
                                  </span>
                                  {task.assignedTo && (
                                    <span className={isDark ? "text-slate-400" : "text-slate-500"}>
                                      Assignee: {task.assignedTo.name}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </Motion.div>
                          );
                        })
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </section>
        </div>

      {detailsLead ? (
        <div className="mobile-bottom-sheet fixed inset-0 z-[80] flex justify-end bg-slate-900/40 sm:items-stretch sm:justify-end" onClick={handleCloseLeadDetails}>
          <Motion.aside
            initial={{ opacity: 0, x: 36 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2 }}
            onClick={(event) => event.stopPropagation()}
            className={`mobile-fullscreen-panel h-full w-full max-w-md border-l shadow-2xl ${
              isDark ? "border-slate-700 bg-slate-950 text-slate-100" : "border-slate-200 bg-white text-slate-900"
            }`}
          >
            <div className={`flex items-start justify-between gap-3 border-b px-4 py-3 ${isDark ? "border-slate-700" : "border-slate-200"}`}>
              <div>
                <div className={`text-[11px] font-semibold uppercase tracking-widest ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  Follow-up Details
                </div>
                <div className="mt-1 text-sm font-bold">{detailsLead.name || "-"}</div>
              </div>
              <button
                type="button"
                onClick={handleCloseLeadDetails}
                className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border ${
                  isDark ? "border-slate-600 bg-slate-900 text-slate-200 hover:border-cyan-400/50" : "border-slate-300 bg-white text-slate-700 hover:border-sky-400"
                }`}
                aria-label="Close details"
              >
                <X size={14} />
              </button>
            </div>

            <div className="mobile-modal-scroll h-[calc(100%-64px)] space-y-4 p-3 custom-scrollbar sm:p-4">
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => handleDeleteFollowUp(detailsLead)}
                  disabled={deletingLeadId === detailsLead._id}
                  className={`inline-flex h-8 items-center gap-1 rounded-lg border px-3 text-xs font-semibold ${
                    isDark
                      ? "border-rose-500/50 bg-rose-500/10 text-rose-200 hover:border-rose-400"
                      : "border-rose-300 bg-rose-50 text-rose-700 hover:border-rose-400"
                  } disabled:opacity-60`}
                >
                  {deletingLeadId === detailsLead._id ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Trash2 size={12} />
                  )}
                  Delete Follow-up
                </button>
              </div>

              <div className={`rounded-xl border p-3 ${isDark ? "border-slate-700 bg-slate-900/70" : "border-slate-200 bg-slate-50"}`}>
                <div className="text-xs font-semibold">Schedule</div>
                <div className="mt-2 space-y-1 text-xs">
                  <div>Follow-up: {formatDateTime(detailsLead.nextFollowUp)}</div>
                  <div>Status: {detailsLead.status || "-"}</div>
                  <div>Assigned: {getAssignedLabel(detailsLead)}</div>
                  <div>Under: {getReportingLabel(detailsLead)}</div>
                </div>
              </div>

              <div className={`rounded-xl border p-3 ${isDark ? "border-slate-700 bg-slate-900/70" : "border-slate-200 bg-slate-50"}`}>
                <div className="text-xs font-semibold">Payment</div>
                <div className="mt-2 space-y-1 text-xs">
                  <div>Mode: {detailsPaymentMode || "-"}</div>
                  <div>Type: {detailsPaymentType || "-"}</div>
                  <div className={detailsRemainingAmount > 0 ? (isDark ? "text-amber-200" : "text-amber-700") : ""}>
                    Remaining: {detailsRemainingAmount === null ? "-" : formatCurrencyInr(detailsRemainingAmount)}
                  </div>
                  <div>Approval: {String(detailsLead?.dealPayment?.approvalStatus || "PENDING")}</div>
                </div>
              </div>

              <div className={`rounded-xl border p-3 ${isDark ? "border-slate-700 bg-slate-900/70" : "border-slate-200 bg-slate-50"}`}>
                <div className="text-xs font-semibold">Lead Info</div>
                <div className="mt-2 space-y-1 text-xs">
                  <div>Phone: {detailsLead.phone || "-"}</div>
                  <div>Email: {detailsLead.email || "-"}</div>
                  <div>City: {detailsLead.city || "-"}</div>
                  <div>Project: {detailsLead.projectInterested || "-"}</div>
                </div>
              </div>

              <div className={`rounded-xl border p-3 ${isDark ? "border-slate-700 bg-slate-900/70" : "border-slate-200 bg-slate-50"}`}>
                <div className="text-xs font-semibold">Contact Actions</div>
                {hasAnyContactAction ? (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {detailsDialerHref ? (
                      <a
                        href={detailsDialerHref}
                        className={`inline-flex h-9 items-center justify-center gap-1 rounded-lg border text-xs font-semibold ${
                          isDark ? "border-slate-600 bg-slate-900 hover:border-cyan-400/50" : "border-slate-300 bg-white hover:border-sky-400"
                        }`}
                      >
                        <Phone size={12} /> Call
                      </a>
                    ) : null}
                    {detailsWhatsAppHref ? (
                      <a
                        href={detailsWhatsAppHref}
                        target="_blank"
                        rel="noreferrer"
                        className={`inline-flex h-9 items-center justify-center gap-1 rounded-lg border text-xs font-semibold ${
                          isDark ? "border-slate-600 bg-slate-900 hover:border-cyan-400/50" : "border-slate-300 bg-white hover:border-sky-400"
                        }`}
                      >
                        <MessageCircle size={12} /> WhatsApp
                      </a>
                    ) : null}
                    {detailsMailHref ? (
                      <a
                        href={detailsMailHref}
                        className={`inline-flex h-9 items-center justify-center gap-1 rounded-lg border text-xs font-semibold ${
                          isDark ? "border-slate-600 bg-slate-900 hover:border-cyan-400/50" : "border-slate-300 bg-white hover:border-sky-400"
                        }`}
                      >
                        <Mail size={12} /> Email
                      </a>
                    ) : null}
                    {detailsMapsHref ? (
                      <a
                        href={detailsMapsHref}
                        target="_blank"
                        rel="noreferrer"
                        className={`inline-flex h-9 items-center justify-center gap-1 rounded-lg border text-xs font-semibold ${
                          isDark ? "border-slate-600 bg-slate-900 hover:border-cyan-400/50" : "border-slate-300 bg-white hover:border-sky-400"
                        }`}
                      >
                        <MapPin size={12} /> Maps
                      </a>
                    ) : null}
                  </div>
                ) : (
                  <div className={`mt-2 text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                    Contact details are not available for this lead.
                  </div>
                )}
              </div>
            </div>
          </Motion.aside>
        </div>
      ) : null}
    </div>
  );
};

export default MasterSchedule;

