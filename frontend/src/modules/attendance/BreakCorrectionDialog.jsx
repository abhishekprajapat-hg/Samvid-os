import React, { useState } from "react";
import { correctUserBreak } from "../../services/attendanceService";
import { toErrorMessage } from "../../utils/errorMessage";

const localInput = (value) => {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

export default function BreakCorrectionDialog({ row, date, onClose, onSaved }) {
  const [index, setIndex] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const attendance = row.attendance;
  const fieldClass = "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900";
  const selectSession = (value) => {
    setIndex(value);
    const session = value === "" ? null : attendance.breakSessions[Number(value)];
    setStartAt(localInput(session?.startAt));
    setEndAt(localInput(session?.endAt));
    setReason("");
    setError("");
  };
  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await correctUserBreak(row.user._id, date, {
        sessionIndex: index === "" ? null : Number(index),
        startAt: new Date(startAt).toISOString(),
        endAt: endAt ? new Date(endAt).toISOString() : null,
        reason: reason.trim(),
        expectedUpdatedAt: attendance.updatedAt,
      });
      onSaved();
    } catch (err) {
      setError(toErrorMessage(err, "Failed to save break"));
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 p-4">
      <section role="dialog" aria-modal="true" aria-labelledby="break-correction-title" className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 text-slate-900 shadow-xl">
        <div className="flex items-center justify-between gap-3">
          <h2 id="break-correction-title" className="text-lg font-bold">Manage breaks · {row.user.name}</h2>
          <button type="button" disabled={saving} onClick={onClose} className="rounded border px-2 py-1 text-sm">Close</button>
        </div>
        <p className="mt-2 text-sm text-slate-600">Attendance: {date}. Times are shown in {Intl.DateTimeFormat().resolvedOptions().timeZone}. Every correction records your name, role, time, and reason.</p>
        <form onSubmit={submit} className="mt-4 space-y-3">
          <label className="block text-sm font-semibold">Break session
            <select value={index} onChange={(event) => selectSession(event.target.value)} disabled={saving} className={fieldClass}>
              <option value="">Add missed break</option>
              {(attendance.breakSessions || []).map((session, i) => <option key={i} value={i}>Break {i + 1}: {new Date(session.startAt).toLocaleTimeString()} — {session.endAt ? new Date(session.endAt).toLocaleTimeString() : "Ongoing"}</option>)}
            </select>
          </label>
          <label className="block text-sm font-semibold">Start time
            <input autoFocus type="datetime-local" required value={startAt} min={localInput(attendance.checkInAt)} max={localInput(attendance.checkOutAt || new Date())} onChange={(event) => setStartAt(event.target.value)} disabled={saving} className={fieldClass} />
          </label>
          <label className="block text-sm font-semibold">End time {attendance.checkOutAt ? "(required)" : "(leave empty for an ongoing break)"}
            <input type="datetime-local" required={Boolean(attendance.checkOutAt)} value={endAt} min={startAt || localInput(attendance.checkInAt)} max={localInput(attendance.checkOutAt || new Date())} onChange={(event) => setEndAt(event.target.value)} disabled={saving} className={fieldClass} />
          </label>
          <label className="block text-sm font-semibold">Reason for correction
            <textarea required maxLength={240} value={reason} onChange={(event) => setReason(event.target.value)} disabled={saving} className={fieldClass} placeholder="Explain why this break needs to be added or corrected" />
          </label>
          {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
          <button type="submit" disabled={saving || !reason.trim()} className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white disabled:opacity-50">{saving ? "Saving…" : index === "" ? "Add break" : "Save correction"}</button>
        </form>
        {attendance.breakAudit?.length > 0 && <div className="mt-5 border-t pt-3">
          <h3 className="text-sm font-bold">Correction history</h3>
          <ul className="mt-2 space-y-2 text-xs text-slate-600">
            {[...attendance.breakAudit].reverse().map((entry, i) => <li key={i}>
              <strong>{entry.actorName || "Manager/Admin"} ({entry.actorRole})</strong> · {new Date(entry.changedAt).toLocaleString()}<br />
              Break {entry.sessionIndex + 1}: {entry.reason}
            </li>)}
          </ul>
        </div>}
      </section>
    </div>
  );
}
