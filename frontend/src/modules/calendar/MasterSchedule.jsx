import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Plus,
  RefreshCw,
  Phone,
  User,
} from "lucide-react";
import api from "../../services/api";
import { toErrorMessage } from "../../utils/errorMessage";

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

const MasterSchedule = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [leads, setLeads] = useState([]);

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

  const loadLeads = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/leads");
      const list = res.data?.leads || [];
      setLeads(list);
      if (!form.leadId && list.length > 0) {
        setForm((prev) => ({
          ...prev,
          leadId: list[0]._id,
        }));
      }
    } catch (err) {
      setError(toErrorMessage(err, "Failed to load leads"));
      setLeads([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeads();
  }, []);

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

  const calendarCells = useMemo(() => buildCalendarCells(monthCursor), [monthCursor]);
  const selectedKey = toDateKey(selectedDate);
  const selectedDayItems = useMemo(() => {
    const items = [...(byDate.get(selectedKey) || [])];
    return items.sort((a, b) => new Date(a.nextFollowUp) - new Date(b.nextFollowUp));
  }, [byDate, selectedKey]);

  const monthTitle = monthCursor.toLocaleDateString([], {
    month: "long",
    year: "numeric",
  });

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
      await loadLeads();
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

  return (
    <div className={`w-full h-full px-4 sm:px-6 md:px-10 pt-20 md:pt-24 pb-8 overflow-y-auto ${isDark ? "bg-slate-950/35" : "bg-white/30"}`}>
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
        <div>
          <h1 className={`text-3xl font-bold ${isDark ? "text-slate-100" : "text-slate-900"}`}>Master Schedule</h1>
          <p className={`text-xs mt-1 uppercase tracking-widest ${isDark ? "text-slate-400" : "text-slate-500"}`}>
            Real follow-ups: {followUps.length}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={loadLeads}
            className={`h-10 px-4 rounded-xl border text-sm font-semibold flex items-center gap-2 ${
              isDark ? "border-slate-700 bg-slate-900/70 text-slate-200" : "border-slate-300 bg-white text-slate-700"
            }`}
          >
            <RefreshCw size={15} />
            Refresh
          </button>
          <button
            onClick={goToday}
            className={`h-10 px-4 rounded-xl border text-sm font-semibold ${
              isDark ? "border-cyan-400/40 bg-cyan-500/10 text-cyan-200" : "border-sky-300 bg-sky-50 text-sky-700"
            }`}
          >
            Today
          </button>
        </div>
      </div>

      {error && (
        <div className={`rounded-xl border p-3 mb-4 text-sm ${isDark ? "border-red-500/35 bg-red-500/10 text-red-300" : "border-red-200 bg-red-50 text-red-700"}`}>
          {error}
        </div>
      )}
      {success && (
        <div className={`rounded-xl border p-3 mb-4 text-sm ${isDark ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-300" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-5 min-h-[640px]">
        <section className={`rounded-2xl border overflow-hidden ${isDark ? "border-slate-700 bg-slate-900/70" : "border-slate-200 bg-white"}`}>
          <div className={`h-14 px-4 flex items-center justify-between border-b ${isDark ? "border-slate-700 bg-slate-900/90" : "border-slate-200 bg-slate-50"}`}>
            <div className={`text-sm font-bold tracking-wide ${isDark ? "text-slate-100" : "text-slate-800"}`}>{monthTitle}</div>
            <div className="flex items-center gap-1">
              <button onClick={() => moveMonth(-1)} className={`p-2 rounded-lg ${isDark ? "hover:bg-slate-800 text-slate-300" : "hover:bg-slate-200 text-slate-600"}`}>
                <ChevronLeft size={16} />
              </button>
              <button onClick={() => moveMonth(1)} className={`p-2 rounded-lg ${isDark ? "hover:bg-slate-800 text-slate-300" : "hover:bg-slate-200 text-slate-600"}`}>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          <div className={`grid grid-cols-7 border-b ${isDark ? "border-slate-700" : "border-slate-200"}`}>
            {DAY_NAMES.map((day) => (
              <div key={day} className={`py-2 text-center text-[11px] font-bold uppercase tracking-wider ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 auto-rows-fr">
            {calendarCells.map((date) => {
              const key = toDateKey(date);
              const count = (byDate.get(key) || []).length;
              const selected = key === selectedKey;
              const inMonth = date.getMonth() === monthCursor.getMonth();
              const isToday = key === toDateKey(new Date());

              return (
                <button
                  key={key}
                  onClick={() => setSelectedDate(date)}
                  className={`min-h-[92px] border p-2 text-left transition-colors ${
                    isDark ? "border-slate-800 hover:bg-slate-800/60" : "border-slate-100 hover:bg-slate-50"
                  } ${selected ? (isDark ? "bg-cyan-500/10" : "bg-sky-50") : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      isToday ? "bg-cyan-500 text-white" : inMonth ? (isDark ? "text-slate-200" : "text-slate-700") : (isDark ? "text-slate-600" : "text-slate-300")
                    }`}>
                      {date.getDate()}
                    </span>
                    {count > 0 && (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        isDark ? "bg-cyan-500/20 text-cyan-200" : "bg-sky-100 text-sky-700"
                      }`}>
                        {count}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="grid grid-rows-[auto_1fr] gap-4 min-h-0">
          <div className={`rounded-2xl border p-4 ${isDark ? "border-slate-700 bg-slate-900/75" : "border-slate-200 bg-white"}`}>
            <h3 className={`text-sm font-bold mb-3 ${isDark ? "text-slate-100" : "text-slate-800"}`}>Schedule Follow-up</h3>
            <div className="space-y-2">
              <select
                value={form.leadId}
                onChange={(e) => setForm((prev) => ({ ...prev, leadId: e.target.value }))}
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

          <div className={`rounded-2xl border min-h-0 flex flex-col ${isDark ? "border-slate-700 bg-slate-900/75" : "border-slate-200 bg-white"}`}>
            <div className={`p-4 border-b ${isDark ? "border-slate-700" : "border-slate-200"}`}>
              <div className={`text-sm font-bold ${isDark ? "text-slate-100" : "text-slate-800"}`}>
                {new Date(selectedDate).toLocaleDateString([], { weekday: "long", day: "2-digit", month: "long" })}
              </div>
              <div className={`text-xs mt-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                {selectedDayItems.length} item{selectedDayItems.length === 1 ? "" : "s"}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {loading ? (
                <div className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>Loading...</div>
              ) : selectedDayItems.length === 0 ? (
                <div className={`h-full rounded-xl border border-dashed flex flex-col items-center justify-center p-6 text-center ${
                  isDark ? "border-slate-700 text-slate-400" : "border-slate-300 text-slate-500"
                }`}>
                  <CalendarIcon size={26} className="mb-2 opacity-70" />
                  No follow-ups on this date
                </div>
              ) : (
                selectedDayItems.map((lead, index) => (
                  <motion.div
                    key={lead._id}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.04 }}
                    className={`rounded-xl border p-3 ${isDark ? "border-slate-700 bg-slate-900/85" : "border-slate-200 bg-white"}`}
                  >
                    <div className={`text-sm font-semibold ${isDark ? "text-slate-100" : "text-slate-900"}`}>{lead.name}</div>
                    <div className={`mt-2 text-xs space-y-1 ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                      <div className="flex items-center gap-2">
                        <Clock3 size={12} /> {formatDateTime(lead.nextFollowUp)}
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone size={12} /> {lead.phone || "-"}
                      </div>
                      <div className="flex items-center gap-2">
                        <User size={12} /> {lead.status}
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default MasterSchedule;
