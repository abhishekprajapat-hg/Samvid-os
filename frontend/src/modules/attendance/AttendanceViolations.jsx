import { useEffect, useState } from "react";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import api from "../../services/api";

const LEVEL_TONES = {
  RECORDED: "bg-slate-100 text-slate-600",
  WARNING: "bg-amber-50 text-amber-700",
  MANAGEMENT_REVIEW: "bg-rose-50 text-rose-700",
};

const readable = (value) => String(value || "").replaceAll("_", " ").toLowerCase();

const LevelPill = ({ level }) => (
  <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${LEVEL_TONES[level] || LEVEL_TONES.RECORDED}`}>
    {readable(level)}
  </span>
);

export default function AttendanceViolations({ month, canReview }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  const [selected, setSelected] = useState(null);
  const [action, setAction] = useState("MANAGEMENT_REVIEW");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    api.get("/attendance/violations", { params: { month } })
      .then(({ data: payload }) => { if (active) { setData(payload); setError(""); } })
      .catch((requestError) => { if (active) setError(requestError.response?.data?.message || "Could not load violations"); });
    return () => { active = false; };
  }, [month, version]);

  const save = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      await api.patch(`/attendance/violations/${selected._id}`, { action, note });
      setSelected(null);
      setNote("");
      setVersion((value) => value + 1);
    } catch (saveError) {
      setError(saveError.response?.data?.message || "Review failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-3.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-rose-50 text-rose-600">
          <ShieldCheck size={17} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h4 className="text-[14px] font-semibold leading-tight text-slate-900">Monthly Attendance Violations &mdash; {month}</h4>
          <p className="mt-0.5 text-[12px] text-slate-500">Track policy violations and attendance insights</p>
        </div>
      </div>

      <div className="space-y-4 p-5">
        <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[11.5px] leading-relaxed text-amber-900">
          <AlertTriangle size={14} className="mt-px shrink-0" aria-hidden="true" />
          <span>
            Rejected-leave absence: first two recorded without warning; third and fourth warning;
            fifth management review. Uninformed absence: management review at three.
            Completed working days only; approved/pending leave and recorded holidays are excluded.
          </span>
        </p>

        {error ? <p role="alert" className="text-sm text-rose-600">{error}</p> : null}

        {!data ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {data.summaries.map((row) => (
                <div key={row.userId} className="rounded-lg border border-slate-200 p-3">
                  <strong className="block truncate text-[13px] text-slate-900">{row.name}</strong>
                  <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11.5px] text-slate-500">
                    Rejected leave: <span className="font-mono font-semibold text-slate-800">{row.rejectedLeave}</span>
                    <LevelPill level={row.rejectedLevel} />
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11.5px] text-slate-500">
                    Uninformed: <span className="font-mono font-semibold text-slate-800">{row.uninformed}</span>
                    <LevelPill level={row.uninformedLevel} />
                  </p>
                </div>
              ))}
            </div>

            <details className="rounded-lg border border-slate-200 p-3">
              <summary className="cursor-pointer text-[12.5px] font-semibold text-slate-700">
                Occurrences and audit history ({data.violations.length})
              </summary>
              {data.violations.map((row) => (
                <article key={row._id} className="mt-2 border-t border-slate-100 pt-2 text-[11.5px]">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="text-slate-900">{row.userName}</strong>
                    <span className="font-mono text-slate-500">{row.date}</span>
                    <span className="capitalize text-slate-600">{readable(row.kind)} #{row.ordinal}</span>
                    {row.active ? <LevelPill level={row.level} /> : <span className="text-slate-400">Resolved / excused</span>}
                  </div>
                  {row.history.map((event, index) => (
                    <p key={index} className="mt-1 text-slate-500">
                      {new Date(event.at).toLocaleString()}: <span className="capitalize">{readable(event.action)}</span> &mdash; {event.note}
                    </p>
                  ))}
                  {canReview && row.active ? (
                    <button
                      type="button"
                      className="mt-2 font-semibold text-blue-600 hover:underline"
                      onClick={() => {
                        setSelected(row);
                        setNote("");
                        setAction(row.level === "WARNING" ? "WARNING_ISSUED" : row.level === "MANAGEMENT_REVIEW" ? "MANAGEMENT_REVIEW" : "EXCUSED");
                      }}
                    >
                      Record review / excuse absence
                    </button>
                  ) : null}
                </article>
              ))}
            </details>

            <p className="text-[11.5px] text-slate-500">{data.policyNote}</p>
          </>
        )}

        {selected ? (
          <form onSubmit={save} className="space-y-2 rounded-lg border border-slate-200 p-3">
            <h5 className="text-[13px] font-semibold text-slate-900">Review {selected.userName} &mdash; {selected.date}</h5>
            <select
              aria-label="Review action"
              value={action}
              onChange={(event) => setAction(event.target.value)}
              className="h-9 w-full rounded-lg border border-slate-300 px-2 text-[13px] outline-none"
            >
              {selected.level !== "RECORDED" ? <option value="WARNING_ISSUED">Warning issued</option> : null}
              <option value="MANAGEMENT_REVIEW">Management review</option>
              <option value="EXCUSED">Excuse absence</option>
            </select>
            <textarea
              aria-label="Management review note"
              required
              maxLength={1000}
              rows={3}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className="w-full resize-y rounded-lg border border-slate-300 p-2 text-[13px] outline-none"
              placeholder="Approved wording, action taken, or reason for exemption"
            />
            <div className="flex gap-2">
              <button disabled={busy} className="h-9 rounded-lg bg-blue-600 px-3 text-[13px] font-semibold text-white disabled:opacity-60">
                {busy ? "Saving…" : "Save review"}
              </button>
              <button type="button" onClick={() => setSelected(null)} className="h-9 rounded-lg border border-slate-300 px-3 text-[13px] font-semibold text-slate-600">
                Cancel
              </button>
            </div>
          </form>
        ) : null}
      </div>
    </section>
  );
}
