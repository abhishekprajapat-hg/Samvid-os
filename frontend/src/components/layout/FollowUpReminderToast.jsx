import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlarmClock, ExternalLink, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getAllLeads } from "../../services/leadService";

const ACTIVE_LEAD_STATUSES = new Set(["NEW", "CONTACTED", "INTERESTED", "SITE_VISIT"]);
const POLL_INTERVAL_MS = 60000;
const REMINDER_LOOKBACK_MS = 24 * 60 * 60 * 1000;
const REMINDER_LOOKAHEAD_MS = 60 * 60 * 1000;
const REMINDER_STORAGE_KEY = "followUpReminderSeen:v1";
const MAX_SEEN_KEYS = 500;

const toIdString = (value) => String(value || "").trim();

const readSeenReminderKeys = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(REMINDER_STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter(Boolean).slice(-MAX_SEEN_KEYS) : [];
  } catch {
    return [];
  }
};

const writeSeenReminderKeys = (keys) => {
  try {
    localStorage.setItem(
      REMINDER_STORAGE_KEY,
      JSON.stringify([...new Set(keys)].slice(-MAX_SEEN_KEYS)),
    );
  } catch {
    // Storage can be unavailable in private browsing.
  }
};

const getReminderBucket = (diffMs) => {
  if (diffMs <= -60 * 1000) return "overdue";
  if (diffMs <= 60 * 1000) return "due";
  if (diffMs <= 15 * 60 * 1000) return "15m";
  if (diffMs <= 30 * 60 * 1000) return "30m";
  if (diffMs <= 60 * 60 * 1000) return "60m";
  return "";
};

const getTimeLeftText = (diffMs) => {
  const absMs = Math.abs(diffMs);
  const totalMinutes = Math.max(1, Math.round(absMs / 60000));

  if (diffMs <= -60 * 1000) {
    if (totalMinutes < 60) return `${totalMinutes} min overdue`;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return minutes ? `${hours}h ${minutes}m overdue` : `${hours}h overdue`;
  }

  if (diffMs <= 60 * 1000) return "Due now";
  if (totalMinutes < 60) return `${totalMinutes} min left`;

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes ? `${hours}h ${minutes}m left` : `${hours}h left`;
};

const formatFollowUpTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const buildReminderKey = (lead, bucket) =>
  `${toIdString(lead?._id)}:${new Date(lead?.nextFollowUp).getTime()}:${bucket}`;

const normalizeReminderLead = (lead, nowMs) => {
  const leadId = toIdString(lead?._id);
  const followUpMs = new Date(lead?.nextFollowUp).getTime();
  const status = String(lead?.status || "").trim().toUpperCase();
  if (!leadId || !Number.isFinite(followUpMs) || !ACTIVE_LEAD_STATUSES.has(status)) {
    return null;
  }

  const diffMs = followUpMs - nowMs;
  if (diffMs < -REMINDER_LOOKBACK_MS || diffMs > REMINDER_LOOKAHEAD_MS) {
    return null;
  }

  const bucket = getReminderBucket(diffMs);
  if (!bucket) return null;

  return {
    ...lead,
    _reminderBucket: bucket,
    _reminderKey: buildReminderKey(lead, bucket),
    _reminderDiffMs: diffMs,
  };
};

const FollowUpReminderToast = ({ enabled = true }) => {
  const navigate = useNavigate();
  const [leads, setLeads] = useState([]);
  const [nowMs, setNowMs] = useState(Date.now());
  const [dismissedKeys, setDismissedKeys] = useState(() => readSeenReminderKeys());
  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains("theme-dark"),
  );
  const loadingRef = useRef(false);

  const loadReminderLeads = useCallback(async () => {
    if (!enabled || loadingRef.current) return;
    loadingRef.current = true;

    const now = new Date();
    const from = new Date(now.getTime() - REMINDER_LOOKBACK_MS);
    const to = new Date(now.getTime() + REMINDER_LOOKAHEAD_MS);

    try {
      const rows = await getAllLeads({
        page: 1,
        limit: 200,
        fields: "_id,name,phone,city,projectInterested,status,nextFollowUp,assignedTo",
        followUpFrom: from.toISOString(),
        followUpTo: to.toISOString(),
      });
      setLeads(Array.isArray(rows) ? rows : []);
    } catch {
      setLeads([]);
    } finally {
      loadingRef.current = false;
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setLeads([]);
      return undefined;
    }

    loadReminderLeads();
    const pollId = window.setInterval(loadReminderLeads, POLL_INTERVAL_MS);
    const tickId = window.setInterval(() => setNowMs(Date.now()), 30000);

    return () => {
      window.clearInterval(pollId);
      window.clearInterval(tickId);
    };
  }, [enabled, loadReminderLeads]);

  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      setIsDark(root.classList.contains("theme-dark"));
    });
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const activeReminder = useMemo(() => {
    const rows = leads
      .map((lead) => normalizeReminderLead(lead, nowMs))
      .filter(Boolean)
      .filter((lead) => !dismissedKeys.includes(lead._reminderKey));

    rows.sort((a, b) => {
      const aOverdue = a._reminderDiffMs <= 0;
      const bOverdue = b._reminderDiffMs <= 0;
      if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
      return a._reminderDiffMs - b._reminderDiffMs;
    });

    return rows[0] || null;
  }, [dismissedKeys, leads, nowMs]);

  const rememberReminder = useCallback((key) => {
    if (!key) return;
    setDismissedKeys((prev) => {
      const next = [...new Set([...prev, key])].slice(-MAX_SEEN_KEYS);
      writeSeenReminderKeys(next);
      return next;
    });
  }, []);

  const handleDismiss = useCallback(() => {
    rememberReminder(activeReminder?._reminderKey);
  }, [activeReminder?._reminderKey, rememberReminder]);

  const handleOpen = useCallback(() => {
    const leadId = toIdString(activeReminder?._id);
    if (!leadId) return;
    rememberReminder(activeReminder?._reminderKey);
    navigate(`/leads/${leadId}`);
  }, [activeReminder, navigate, rememberReminder]);

  if (!enabled || !activeReminder) return null;

  const timeLeftText = getTimeLeftText(activeReminder._reminderDiffMs);
  const isOverdue = activeReminder._reminderDiffMs < -60 * 1000;

  return (
    <div className="follow-up-reminder-toast pointer-events-none fixed bottom-4 left-4 z-[113] w-[min(92vw,25rem)]">
      <div
        className={`pointer-events-auto rounded-2xl border p-3 shadow-2xl ${
          isDark
            ? "border-amber-400/25 bg-slate-900/95 text-slate-100"
            : "border-amber-200 bg-white text-slate-900"
        }`}
      >
        <div className="flex items-start gap-3">
          <span
            className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
              isOverdue
                ? isDark ? "bg-rose-500/15 text-rose-200" : "bg-rose-50 text-rose-700"
                : isDark ? "bg-amber-500/15 text-amber-200" : "bg-amber-50 text-amber-700"
            }`}
          >
            <AlarmClock size={18} />
          </span>

          <div className="min-w-0 flex-1">
            <p
              className={`text-[10px] font-bold uppercase tracking-[0.14em] ${
                isOverdue
                  ? isDark ? "text-rose-200" : "text-rose-700"
                  : isDark ? "text-amber-200" : "text-amber-700"
              }`}
            >
              Follow-up reminder
            </p>
            <p className="mt-0.5 truncate text-sm font-semibold">
              {activeReminder.name || "Lead follow-up"} | {timeLeftText}
            </p>
            <p className={`mt-0.5 text-xs ${isDark ? "text-slate-300" : "text-slate-600"}`}>
              {activeReminder.projectInterested || activeReminder.city || activeReminder.phone || "Follow up scheduled"}
            </p>
            <p className={`mt-1 text-[11px] ${isDark ? "text-slate-500" : "text-slate-500"}`}>
              Scheduled: {formatFollowUpTime(activeReminder.nextFollowUp)}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={handleOpen}
              className={`rounded-lg border p-1.5 ${
                isDark
                  ? "border-slate-700 text-slate-300 hover:border-amber-300 hover:text-amber-200"
                  : "border-slate-200 text-slate-600 hover:border-amber-300 hover:text-amber-700"
              }`}
              aria-label="Open follow-up lead"
              title="Open lead"
            >
              <ExternalLink size={14} />
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              className={`rounded-lg border p-1.5 ${
                isDark
                  ? "border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200"
                  : "border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-800"
              }`}
              aria-label="Dismiss follow-up reminder"
              title="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FollowUpReminderToast;
