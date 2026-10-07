import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Calendar as CalendarIcon, Check, CheckSquare2, ChevronDown, ChevronLeft, ChevronRight,
  Clock3, Loader2, Mail, MapPin, MessageCircle, NotebookPen, PanelRightOpen,
  Phone, Plus, RefreshCw, Save, Trash2, Users, X,
} from "lucide-react";
import api from "../../services/api";
import { addLeadDiaryEntry, completeLeadFollowUp, getAllLeads, getLeadDiary } from "../../services/leadService";
import { getTasks, updateTask, updateTaskSubtask } from "../../services/taskService";
import Modal from "../../components/ui/Modal";
import ToastNotice from "../../components/ui/ToastNotice";
import { toErrorMessage } from "../../utils/errorMessage";
import {
  buildMonthCalendarCells, canScheduleLeadFollowUp, isPendingCalendarFollowUp,
  isUnpaidCollectionLead, toCalendarDateKey,
} from "./calendarFollowUps";
import LeadSearchPicker from "./LeadSearchPicker";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const toLocalDateTimeInput = (value) => {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
};

const getDefaultFollowUpDate = (value) => {
  const date = new Date(value);
  const now = new Date();
  date.setHours(toCalendarDateKey(date) === toCalendarDateKey(now) ? Math.min(now.getHours() + 1, 23) : 11, 0, 0, 0);
  return date;
};

const formatDateTime = (value) => new Date(value).toLocaleString("en-IN", {
  day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
});

const formatDiaryTime = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
};

const formatStatus = (value, fallback = "Not set") => String(value || fallback).replaceAll("_", " ");
const getAssignedUser = (lead) => lead?.assignedTo || lead?.assignedExecutive || lead?.assignedFieldExecutive || null;
const getAssignedLabel = (lead) => getAssignedUser(lead)?.name || "Unassigned";
const getReportingLabel = (lead) => lead?.assignedManager?.name || "-";
const normalizePhoneDigits = (value) => String(value || "").replace(/\D/g, "");
const getDialerHref = (phone) => normalizePhoneDigits(phone) ? `tel:${normalizePhoneDigits(phone)}` : "";
const getWhatsAppHref = (phone) => {
  const digits = normalizePhoneDigits(phone);
  return digits ? `https://wa.me/${digits.length === 10 ? `91${digits}` : digits}` : "";
};
const getMailHref = (email) => String(email || "").trim() ? `mailto:${String(email).trim()}` : "";
const getMapsHref = (lead) => {
  const query = [lead?.projectInterested, lead?.city].map((part) => String(part || "").trim()).filter(Boolean).join(", ");
  return query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : "";
};
const formatCurrencyInr = (value) => Number.isFinite(Number(value)) ? `Rs ${Number(value).toLocaleString("en-IN")}` : "-";
const getRemainingAmount = (lead) => {
  if (String(lead?.dealPayment?.paymentType || "").toUpperCase() === "FULL") return 0;
  const amount = Number(lead?.dealPayment?.remainingAmount);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
};

const MasterSchedule = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [success, setSuccess] = useState("");
  const [leads, setLeads] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [expandedFollowUpId, setExpandedFollowUpId] = useState("");
  const [expandedTaskId, setExpandedTaskId] = useState("");
  const [detailsLeadId, setDetailsLeadId] = useState("");
  const [deletingLeadId, setDeletingLeadId] = useState("");
  const [completingLeadId, setCompletingLeadId] = useState("");
  const [updatingTaskId, setUpdatingTaskId] = useState("");
  const [activeDiaryLeadId, setActiveDiaryLeadId] = useState("");
  const [diaryLoading, setDiaryLoading] = useState(false);
  const [diarySaving, setDiarySaving] = useState(false);
  const [diaryDraft, setDiaryDraft] = useState("");
  const [diaryEntries, setDiaryEntries] = useState([]);
  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [form, setForm] = useState({ leadId: "", nextFollowUp: "" });
  const isDark = (localStorage.getItem("theme") || "light") === "dark";

  const loadScheduleData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      setLoadError("");
      const [leadResult, taskResult] = await Promise.allSettled([getAllLeads(), getTasks()]);
      if (leadResult.status === "rejected" && taskResult.status === "rejected") {
        throw leadResult.reason || taskResult.reason;
      }
      const safeLeads = leadResult.status === "fulfilled" && Array.isArray(leadResult.value) ? leadResult.value : [];
      const safeTasks = taskResult.status === "fulfilled" && Array.isArray(taskResult.value) ? taskResult.value : [];
      setLeads(safeLeads);
      setTasks(safeTasks);
      if (leadResult.status === "rejected") {
        setError(toErrorMessage(leadResult.reason, "Follow-ups are unavailable for your current access"));
      } else if (taskResult.status === "rejected") {
        setError(toErrorMessage(taskResult.reason, "Task deadlines are unavailable for your current access"));
      }
      const schedulable = safeLeads.filter(canScheduleLeadFollowUp);
      setForm((previous) => ({
        ...previous,
        leadId: schedulable.some((lead) => lead._id === previous.leadId) ? previous.leadId : (schedulable[0]?._id || ""),
      }));
    } catch (err) {
      const message = toErrorMessage(err, "Failed to load schedule data");
      setError(message);
      setLoadError(message);
      setLeads([]);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadScheduleData(); }, [loadScheduleData]);

  const followUps = useMemo(() => leads.filter(isPendingCalendarFollowUp), [leads]);
  const schedulableLeads = useMemo(() => leads.filter(canScheduleLeadFollowUp), [leads]);
  const deadlineTasks = useMemo(() => tasks.flatMap((task) => {
    const parent = task.dueDate ? [{ ...task, calendarId: String(task._id), isSubtask: false }] : [];
    const subtasks = (task.subtasks || []).filter((subtask) => Boolean(subtask.dueDate)).map((subtask) => ({
      ...subtask,
      _id: subtask._id,
      calendarId: `${task._id}:subtask:${subtask._id}`,
      parentTaskId: task._id,
      parentTitle: task.title,
      isSubtask: true,
      status: subtask.status || (subtask.isCompleted ? "COMPLETED" : "TODO"),
      priority: subtask.priority || task.priority || "MEDIUM",
      assignedTo: subtask.assignedTo || task.assignedTo,
    }));
    return [...parent, ...subtasks];
  }), [tasks]);
  const followUpsByDate = useMemo(() => {
    const map = new Map();
    followUps.forEach((lead) => {
      const key = toCalendarDateKey(lead.nextFollowUp);
      if (key) map.set(key, [...(map.get(key) || []), lead]);
    });
    return map;
  }, [followUps]);
  const tasksByDate = useMemo(() => {
    const map = new Map();
    deadlineTasks.forEach((task) => {
      const key = toCalendarDateKey(task.dueDate);
      if (key) map.set(key, [...(map.get(key) || []), task]);
    });
    return map;
  }, [deadlineTasks]);

  const calendarCells = useMemo(() => buildMonthCalendarCells(monthCursor), [monthCursor]);
  const selectedKey = toCalendarDateKey(selectedDate);
  const todayKey = toCalendarDateKey(new Date());
  const selectedDayFollowUps = useMemo(
    () => [...(followUpsByDate.get(selectedKey) || [])].sort((a, b) => new Date(a.nextFollowUp) - new Date(b.nextFollowUp)),
    [followUpsByDate, selectedKey],
  );
  const selectedDayTasks = useMemo(
    () => [...(tasksByDate.get(selectedKey) || [])].sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate)),
    [tasksByDate, selectedKey],
  );
  const detailsLead = useMemo(() => leads.find((lead) => lead._id === detailsLeadId) || null, [leads, detailsLeadId]);
  const todayFollowUps = followUpsByDate.get(todayKey)?.length || 0;
  const todayTasks = tasksByDate.get(todayKey)?.length || 0;
  const completedTasks = deadlineTasks.filter((task) => task.status === "COMPLETED").length;
  const monthTitle = monthCursor.toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  useEffect(() => {
    let cancelled = false;
    const loadDiary = async () => {
      if (!activeDiaryLeadId) {
        setDiaryEntries([]);
        setDiaryLoading(false);
        return;
      }
      try {
        setDiaryLoading(true);
        const entries = await getLeadDiary(activeDiaryLeadId);
        if (!cancelled) setDiaryEntries(Array.isArray(entries) ? entries : []);
      } catch (err) {
        if (!cancelled) {
          setDiaryEntries([]);
          setError(toErrorMessage(err, "Failed to load lead diary"));
        }
      } finally {
        if (!cancelled) setDiaryLoading(false);
      }
    };
    loadDiary();
    return () => { cancelled = true; };
  }, [activeDiaryLeadId]);

  useEffect(() => { if (detailsLeadId && !detailsLead) setDetailsLeadId(""); }, [detailsLead, detailsLeadId]);

  const resetAgendaExpansion = () => {
    setExpandedFollowUpId("");
    setExpandedTaskId("");
    setActiveDiaryLeadId("");
    setDiaryDraft("");
    setDiaryEntries([]);
  };
  const selectDate = (date) => { setSelectedDate(date); resetAgendaExpansion(); };
  const goToday = () => {
    const now = new Date();
    setSelectedDate(now);
    setMonthCursor(new Date(now.getFullYear(), now.getMonth(), 1));
    resetAgendaExpansion();
  };
  const moveMonth = (step) => setMonthCursor((previous) => new Date(previous.getFullYear(), previous.getMonth() + step, 1));
  const openSchedule = () => {
    setError("");
    setForm((previous) => ({ ...previous, nextFollowUp: toLocalDateTimeInput(getDefaultFollowUpDate(selectedDate)) }));
    setScheduleOpen(true);
  };
  const handlePickLead = (lead) => {
    if (!lead?._id) return;
    setLeads((previous) => previous.some((item) => item._id === lead._id) ? previous : [...previous, lead]);
    setForm((previous) => ({ ...previous, leadId: lead._id }));
  };

  const handleSchedule = async () => {
    if (!form.leadId || !form.nextFollowUp) return setError("Lead and follow-up date/time are required");
    const lead = leads.find((item) => item._id === form.leadId);
    if (!lead || !canScheduleLeadFollowUp(lead)) return setError("This lead is no longer eligible for a follow-up");
    try {
      setSaving(true);
      setError("");
      setSuccess("");
      await api.patch(`/leads/${form.leadId}/status`, { status: lead.status || "NEW", nextFollowUp: form.nextFollowUp });
      await loadScheduleData();
      const date = new Date(form.nextFollowUp);
      if (!Number.isNaN(date.getTime())) {
        setSelectedDate(date);
        setMonthCursor(new Date(date.getFullYear(), date.getMonth(), 1));
      }
      setScheduleOpen(false);
      setSuccess("Follow-up scheduled successfully");
    } catch (err) {
      setError(toErrorMessage(err, "Failed to schedule follow-up"));
    } finally {
      setSaving(false);
    }
  };

  const toggleFollowUpDetails = (leadId) => {
    const opening = expandedFollowUpId !== leadId;
    setExpandedFollowUpId(opening ? leadId : "");
    setActiveDiaryLeadId(opening ? leadId : "");
    setDiaryDraft("");
  };
  const handleCompleteFollowUp = async (lead) => {
    const leadId = String(lead?._id || "");
    if (!leadId || completingLeadId || isUnpaidCollectionLead(lead)) return;
    try {
      setCompletingLeadId(leadId);
      setError("");
      setSuccess("");
      const updated = await completeLeadFollowUp(leadId);
      if (!updated || updated.nextFollowUp) throw new Error("Follow-up could not be completed");
      setLeads((previous) => previous.map((item) => item._id === leadId ? updated : item));
      if (detailsLeadId === leadId) setDetailsLeadId("");
      if (expandedFollowUpId === leadId) resetAgendaExpansion();
      setSuccess("Follow-up marked done");
    } catch (err) {
      setError(toErrorMessage(err, "Failed to complete follow-up"));
    } finally {
      setCompletingLeadId("");
    }
  };
  const handleDeleteFollowUp = async (lead) => {
    const leadId = String(lead?._id || "");
    if (!leadId || deletingLeadId || isUnpaidCollectionLead(lead)) return;
    if (!window.confirm(`Delete follow-up for ${lead?.name || "this lead"}?`)) return;
    try {
      setDeletingLeadId(leadId);
      setError("");
      await api.patch(`/leads/${leadId}/status`, { status: lead?.status || "NEW", nextFollowUp: null });
      if (detailsLeadId === leadId) setDetailsLeadId("");
      resetAgendaExpansion();
      await loadScheduleData();
      setSuccess("Follow-up deleted successfully");
    } catch (err) {
      setError(toErrorMessage(err, "Failed to delete follow-up"));
    } finally {
      setDeletingLeadId("");
    }
  };
  const handleAddDiary = async () => {
    const note = diaryDraft.trim();
    if (!activeDiaryLeadId || !note) return setError(activeDiaryLeadId ? "Diary note cannot be empty" : "Select a follow-up lead first");
    try {
      setDiarySaving(true);
      setError("");
      const created = await addLeadDiaryEntry(activeDiaryLeadId, note);
      if (created) setDiaryEntries((previous) => [created, ...previous]);
      else {
        const entries = await getLeadDiary(activeDiaryLeadId);
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
    const nextStatus = task.status === "COMPLETED" ? "TODO" : "COMPLETED";
    try {
      setUpdatingTaskId(task.calendarId || task._id);
      setError("");
      const updated = task.isSubtask
        ? await updateTaskSubtask(task.parentTaskId, task._id, { status: nextStatus })
        : await updateTask(task._id, { status: nextStatus });
      setTasks((previous) => previous.map((item) => item._id === (task.parentTaskId || task._id) ? (updated || item) : item));
      setSuccess(`${task.isSubtask ? "Subtask" : "Task"} marked as ${formatStatus(nextStatus).toLowerCase()}`);
    } catch (err) {
      setError(toErrorMessage(err, "Failed to update task status"));
    } finally {
      setUpdatingTaskId("");
    }
  };

  return (
    <div className="calendar-doc-screen ui-page-shell custom-scrollbar overflow-x-hidden">
      <div className="calendar-toolbar flex items-center justify-end">
        <button type="button" onClick={loadScheduleData} disabled={loading} className="calendar-btn inline-flex h-9 items-center gap-2 border px-3 text-xs font-semibold disabled:opacity-60"><RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh</button>
      </div>
      <ToastNotice message={error} type="error" />
      <ToastNotice message={success} type="success" />

      <section className="calendar-statgrid" aria-label="Calendar summary">
        <div className="calendar-stat"><div className="calendar-stat-copy"><p>Total follow-ups</p><strong>{followUps.length}</strong><span>{leads.length} leads loaded</span></div><div className="calendar-stat-icon"><Users size={20} /></div></div>
        <button type="button" className="calendar-stat calendar-stat-action" onClick={goToday}><div className="calendar-stat-copy"><p>Today</p><strong>{todayFollowUps + todayTasks}</strong><span>{todayFollowUps} follow-ups, {todayTasks} tasks</span></div><div className="calendar-stat-icon"><Clock3 size={20} /></div><ChevronRight className="calendar-stat-arrow" size={17} /></button>
        <div className="calendar-stat"><div className="calendar-stat-copy"><p>Task deadlines</p><strong>{deadlineTasks.length}</strong><span>{completedTasks} completed</span></div><div className="calendar-stat-icon"><CheckSquare2 size={20} /></div></div>
      </section>

      <div className="calendar-layout grid min-h-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.34fr)_minmax(360px,0.96fr)]">
        <section className="calendar-card calendar-month-card overflow-hidden border">
          <div className="calendar-card-head flex items-center justify-between gap-3 border-b px-4"><h2 className="calendar-month-title">{monthTitle}</h2><div className="calendar-month-actions flex items-center gap-2"><button type="button" onClick={() => moveMonth(-1)} className="calendar-icon-btn inline-flex h-9 w-9 items-center justify-center border" aria-label="Previous month"><ChevronLeft size={16} /></button><button type="button" onClick={goToday} className="calendar-btn h-9 border px-4 text-xs font-semibold">Today</button><button type="button" onClick={() => moveMonth(1)} className="calendar-icon-btn inline-flex h-9 w-9 items-center justify-center border" aria-label="Next month"><ChevronRight size={16} /></button></div></div>
          <div className="calendar-weekdays grid grid-cols-7 border-b">{DAY_NAMES.map((day) => <div key={day} className="py-3 text-center text-[11px] font-bold uppercase">{day}</div>)}</div>
          <div className="calendar-grid grid grid-cols-7">
            {calendarCells.map((date) => {
              const key = toCalendarDateKey(date);
              const leadCount = followUpsByDate.get(key)?.length || 0;
              const taskCount = tasksByDate.get(key)?.length || 0;
              const selected = key === selectedKey;
              const inMonth = date.getMonth() === monthCursor.getMonth();
              return <button type="button" key={key} onClick={() => selectDate(date)} aria-pressed={selected} aria-label={`${date.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}: ${leadCount} follow-ups and ${taskCount} tasks`} className={`calendar-day p-2 text-left ${selected ? "is-selected" : ""} ${inMonth ? "" : "is-muted"}`}><div className="relative flex h-full w-full items-start justify-between gap-1"><span className={`calendar-date-number flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${key === todayKey ? "is-today" : ""}`}>{date.getDate()}</span><div className="calendar-day-counts flex shrink-0 flex-col items-end gap-1">{leadCount > 0 ? <span className="calendar-count-pill is-follow-up">{leadCount} L</span> : null}{taskCount > 0 ? <span className="calendar-count-pill is-task">{taskCount} T</span> : null}</div>{leadCount > 0 || taskCount > 0 ? <span className="calendar-day-caption">{leadCount} lead{leadCount === 1 ? "" : "s"} · {taskCount} task{taskCount === 1 ? "" : "s"}</span> : null}</div></button>;
            })}
          </div>
        </section>

        <section className="calendar-card calendar-agenda-card flex min-h-0 flex-col overflow-hidden border">
          <div className="calendar-agenda-head calendar-card-head flex items-center justify-between gap-3 border-b px-4 py-3"><div className="min-w-0"><h2 className="truncate text-[15px] font-bold">{selectedDate.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</h2><p>{selectedDayFollowUps.length} follow-up{selectedDayFollowUps.length === 1 ? "" : "s"} · {selectedDayTasks.length} task{selectedDayTasks.length === 1 ? "" : "s"}</p></div><button type="button" onClick={openSchedule} className="calendar-schedule-btn inline-flex h-9 items-center gap-2 px-3 text-xs font-semibold"><Plus size={15} /><span>Schedule follow-up</span></button></div>
          <div className="calendar-agenda-scroll custom-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
            {loading ? <div className="calendar-loading-state"><Loader2 size={20} className="animate-spin" /><span>Loading follow-ups and tasks...</span></div> : loadError ? <div className="calendar-error-state"><p>{loadError}</p><button type="button" onClick={loadScheduleData}>Try again</button></div> : <>
              <section className="calendar-agenda-section" aria-labelledby="calendar-followups-title">
                <div className="calendar-section-title"><h3 id="calendar-followups-title">Lead follow-ups</h3><span>{selectedDayFollowUps.length}</span></div>
                {selectedDayFollowUps.length === 0 ? <div className="calendar-empty-state"><CalendarIcon size={18} /><span>No follow-ups scheduled for this day.</span><button type="button" onClick={openSchedule}>Schedule one</button></div> : selectedDayFollowUps.map((lead) => {
                  const expanded = expandedFollowUpId === lead._id;
                  const collectionDue = isUnpaidCollectionLead(lead);
                  return <article key={lead._id} className={`calendar-agenda-item is-follow-up ${expanded ? "is-expanded" : ""}`}>
                    <div className="calendar-agenda-item-main"><div className="min-w-0 flex-1"><div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1"><strong className="truncate text-[13px]">{lead.name || "Unnamed lead"}</strong><span className="calendar-row-time"><Clock3 size={12} /> {new Date(lead.nextFollowUp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span></div><div className="mt-1 flex min-w-0 flex-wrap items-center gap-2"><span className="calendar-row-phone"><Phone size={12} /> {lead.phone || "No phone"}</span><span className={`calendar-status-chip ${collectionDue ? "is-collection" : ""}`}>{collectionDue ? "Collection due" : formatStatus(lead.status)}</span></div></div><div className="calendar-row-actions"><button type="button" onClick={() => handleCompleteFollowUp(lead)} disabled={completingLeadId === lead._id || collectionDue} className="calendar-done-btn" title={collectionDue ? "Keep this follow-up until the remaining payment is recorded" : "Mark follow-up done"}>{completingLeadId === lead._id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}{collectionDue ? "Due" : "Done"}</button><button type="button" onClick={() => toggleFollowUpDetails(lead._id)} className="calendar-expand-btn" aria-expanded={expanded} aria-label={`${expanded ? "Hide" : "Show"} details for ${lead.name || "lead"}`}><ChevronDown size={15} className={expanded ? "rotate-180" : ""} /></button></div></div>
                    {expanded ? <div className="calendar-expanded-details"><dl className="calendar-detail-grid"><div><dt>Assigned to</dt><dd>{getAssignedLabel(lead)}</dd></div><div><dt>Reporting manager</dt><dd>{getReportingLabel(lead)}</dd></div><div><dt>Project</dt><dd>{lead.projectInterested || "-"}</dd></div><div><dt>Follow-up</dt><dd>{formatDateTime(lead.nextFollowUp)}</dd></div></dl><div className="calendar-secondary-actions"><button type="button" onClick={() => setDetailsLeadId(lead._id)}><PanelRightOpen size={13} /> Lead details</button><button type="button" onClick={() => handleDeleteFollowUp(lead)} disabled={deletingLeadId === lead._id || collectionDue}>{deletingLeadId === lead._id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />} Delete</button></div><div className="calendar-diary-panel"><div className="calendar-diary-title"><NotebookPen size={14} /> Lead diary <span>{lead.name}</span></div><textarea value={diaryDraft} onChange={(event) => setDiaryDraft(event.target.value)} maxLength={2000} placeholder={`Add diary note for ${lead.name}`} /><div className="calendar-diary-actions"><span>{diaryDraft.length}/2000</span><button type="button" onClick={handleAddDiary} disabled={diarySaving || !diaryDraft.trim()}>{diarySaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}{diarySaving ? "Saving..." : "Add note"}</button></div><div className="calendar-diary-list custom-scrollbar">{diaryLoading ? <div className="calendar-diary-message"><Loader2 size={14} className="animate-spin" /> Loading diary...</div> : diaryEntries.length === 0 ? <div className="calendar-diary-message">No diary notes yet</div> : diaryEntries.map((entry) => <div key={entry._id} className="calendar-diary-entry"><p>{entry.note}</p><span>{entry.createdBy?.name || "Unknown"} · {formatDiaryTime(entry.createdAt)}</span></div>)}</div></div></div> : null}
                  </article>;
                })}
              </section>
              <section className="calendar-agenda-section" aria-labelledby="calendar-tasks-title">
                <div className="calendar-section-title"><h3 id="calendar-tasks-title">Task deadlines</h3><span>{selectedDayTasks.length}</span></div>
                {selectedDayTasks.length === 0 ? <div className="calendar-empty-state"><CheckSquare2 size={18} /><span>No task deadlines for this day.</span></div> : selectedDayTasks.map((task) => {
                  const completed = task.status === "COMPLETED";
                  const itemId = task.calendarId || String(task._id);
                  const expanded = expandedTaskId === itemId;
                  return <article key={itemId} className={`calendar-agenda-item is-task ${expanded ? "is-expanded" : ""}`}><div className="calendar-agenda-item-main"><label className="calendar-task-check">{updatingTaskId === itemId ? <Loader2 size={15} className="animate-spin" /> : <input type="checkbox" checked={completed} onChange={() => handleToggleTaskComplete(task)} />}<span className="sr-only">Mark {task.title} {completed ? "not completed" : "completed"}</span></label><div className="min-w-0 flex-1"><strong className={`block truncate text-[13px] ${completed ? "line-through text-slate-500" : ""}`}>{task.title}</strong><div className="mt-1 flex flex-wrap items-center gap-1.5">{task.isSubtask ? <span className="calendar-task-status">Subtask</span> : null}<span className={`calendar-priority-chip is-${String(task.priority || "LOW").toLowerCase()}`}>{formatStatus(task.priority, "Low")}</span><span className="calendar-task-status">{formatStatus(task.status, "Todo")}</span></div></div><button type="button" onClick={() => setExpandedTaskId(expanded ? "" : itemId)} className="calendar-expand-btn" aria-expanded={expanded}><ChevronDown size={15} className={expanded ? "rotate-180" : ""} /></button></div>{expanded ? <div className="calendar-expanded-details">{task.isSubtask ? <span>Parent task: {task.parentTitle}</span> : null}<p>{task.description || "No description provided."}</p><span>Assignee: {task.assignedTo?.name || "Unassigned"}</span></div> : null}</article>;
                })}
              </section>
            </>}
          </div>
        </section>
      </div>

      <Modal
        open={scheduleOpen}
        onClose={() => !saving && setScheduleOpen(false)}
        title="Schedule a follow-up"
        description="Choose a lead and set the next conversation time."
        size="sm"
        className="calendar-schedule-modal"
      >
        <div className="calendar-form-card">
          <div className="calendar-modal-date-banner">
            <div className="calendar-modal-date-icon"><CalendarIcon size={20} /></div>
            <div>
              <span>Selected day</span>
              <strong>{selectedDate.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</strong>
            </div>
          </div>

          <div className="calendar-modal-fields">
            <div className="calendar-modal-field">
              <div className="calendar-modal-field-heading">
                <span className="calendar-modal-field-icon"><Users size={15} /></span>
                <div>
                  <label className="calendar-form-label">Lead</label>
                  <p>Search by name or phone number</p>
                </div>
              </div>
              <LeadSearchPicker
                leads={schedulableLeads}
                value={form.leadId}
                isEligible={canScheduleLeadFollowUp}
                isDark={isDark}
                onSelect={handlePickLead}
              />
            </div>

            <div className="calendar-modal-field">
              <div className="calendar-modal-field-heading">
                <span className="calendar-modal-field-icon"><Clock3 size={15} /></span>
                <div>
                  <label htmlFor="calendar-follow-up-time" className="calendar-form-label">Date and time</label>
                  <p>Shown in your CRM timezone</p>
                </div>
              </div>
              <input
                id="calendar-follow-up-time"
                type="datetime-local"
                value={form.nextFollowUp}
                onChange={(event) => setForm((previous) => ({ ...previous, nextFollowUp: event.target.value }))}
              />
            </div>
          </div>

          <div className="calendar-modal-actions">
            <button type="button" onClick={() => setScheduleOpen(false)} disabled={saving} className="calendar-modal-secondary">Cancel</button>
            <button type="button" onClick={handleSchedule} disabled={saving || !form.leadId || !form.nextFollowUp} className="calendar-modal-primary">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
              {saving ? "Scheduling..." : "Schedule follow-up"}
            </button>
          </div>
        </div>
      </Modal>
      {detailsLead ? <LeadDetailsDrawer lead={detailsLead} isDark={isDark} completing={completingLeadId === detailsLead._id} deleting={deletingLeadId === detailsLead._id} onClose={() => setDetailsLeadId("")} onComplete={() => handleCompleteFollowUp(detailsLead)} onDelete={() => handleDeleteFollowUp(detailsLead)} /> : null}
    </div>
  );
};

const LeadDetailsDrawer = ({ lead, isDark, completing, deleting, onClose, onComplete, onDelete }) => {
  const collectionDue = isUnpaidCollectionLead(lead);
  const dialerHref = getDialerHref(lead.phone);
  const whatsAppHref = getWhatsAppHref(lead.phone);
  const mailHref = getMailHref(lead.email);
  const mapsHref = getMapsHref(lead);
  const remainingAmount = getRemainingAmount(lead);
  return <div className="mobile-bottom-sheet fixed inset-0 z-[80] flex justify-end bg-slate-900/40" onClick={onClose}><aside onClick={(event) => event.stopPropagation()} className={`mobile-fullscreen-panel h-full w-full max-w-md border-l shadow-2xl ${isDark ? "border-slate-700 bg-slate-950 text-slate-100" : "border-slate-200 bg-white text-slate-900"}`} aria-label={`Lead details for ${lead.name || "lead"}`}><div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-700"><div><div className="text-[11px] font-semibold uppercase text-slate-500">Follow-up details</div><div className="mt-1 text-sm font-bold">{lead.name || "-"}</div></div><button type="button" onClick={onClose} className="calendar-expand-btn" aria-label="Close details"><X size={14} /></button></div><div className="mobile-modal-scroll h-[calc(100%-64px)] space-y-4 overflow-y-auto p-4 custom-scrollbar"><div className="flex flex-wrap justify-end gap-2"><button type="button" onClick={onComplete} disabled={completing || collectionDue} className="calendar-done-btn">{completing ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}{collectionDue ? "Collection due" : "Mark done"}</button><button type="button" onClick={onDelete} disabled={deleting || collectionDue} className="calendar-drawer-delete">{deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />} Delete follow-up</button></div><DrawerCard title="Schedule"><p>Follow-up: {formatDateTime(lead.nextFollowUp)}</p><p>Status: {formatStatus(lead.status)}</p><p>Assigned: {getAssignedLabel(lead)}</p><p>Under: {getReportingLabel(lead)}</p></DrawerCard><DrawerCard title="Payment"><p>Mode: {formatStatus(lead.dealPayment?.mode, "-")}</p><p>Type: {formatStatus(lead.dealPayment?.paymentType, "-")}</p><p>Remaining: {remainingAmount === null ? "-" : formatCurrencyInr(remainingAmount)}</p><p>Approval: {formatStatus(lead.dealPayment?.approvalStatus, "Pending")}</p></DrawerCard><DrawerCard title="Lead info"><p>Phone: {lead.phone || "-"}</p><p>Email: {lead.email || "-"}</p><p>City: {lead.city || "-"}</p><p>Project: {lead.projectInterested || "-"}</p></DrawerCard><DrawerCard title="Contact actions"><div className="calendar-contact-grid">{dialerHref ? <a href={dialerHref}><Phone size={12} /> Call</a> : null}{whatsAppHref ? <a href={whatsAppHref} target="_blank" rel="noreferrer"><MessageCircle size={12} /> WhatsApp</a> : null}{mailHref ? <a href={mailHref}><Mail size={12} /> Email</a> : null}{mapsHref ? <a href={mapsHref} target="_blank" rel="noreferrer"><MapPin size={12} /> Maps</a> : null}{!dialerHref && !whatsAppHref && !mailHref && !mapsHref ? <p>Contact details are not available for this lead.</p> : null}</div></DrawerCard></div></aside></div>;
};

const DrawerCard = ({ title, children }) => <section className="calendar-drawer-card"><h3>{title}</h3><div>{children}</div></section>;

export default MasterSchedule;
