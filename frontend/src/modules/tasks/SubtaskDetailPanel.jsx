import React, { useState } from "react";
import { X } from "lucide-react";

/*
 * A subtask is more than a tick box.
 *
 * The checklist answers "is it done"; this panel answers "what is it" - the
 * note the person picking it up needs, and the date it is wanted by. It opens
 * beside the row rather than under it so the list it belongs to stays on
 * screen: a subtask read without its siblings has lost the context that made
 * it a subtask rather than a task.
 *
 * Description commits on blur and the date on change, which is what each input
 * can honestly report. Holding the text in a draft keeps typing local instead
 * of firing a save - and a round trip - on every keystroke.
 *
 * The draft is seeded once per mount, so callers must key this by the subtask
 * they are opening. Selecting a different row is a different document, and a
 * remount is how that gets a fresh draft - syncing it back through an effect
 * would only trade a clear rule for cascading renders.
 */
const SubtaskDetailPanel = ({
  subtask,
  onChange,
  onClose,
  readOnly = false,
  styles,
  isDark,
}) => {
  const [draft, setDraft] = useState(subtask?.description || "");

  if (!subtask) return null;

  const commitDescription = () => {
    if (draft === (subtask.description || "")) return;
    onChange({ description: draft });
  };

  return (
    <aside
      aria-label={`Details for subtask ${subtask.title}`}
      className={`flex min-w-0 flex-col gap-2 rounded-xl border p-2.5 ${
        isDark ? "border-slate-800 bg-slate-950/60" : "border-slate-200 bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className={`min-w-0 break-words text-[11px] font-bold uppercase tracking-wider ${styles.label}`}>
          {subtask.title}
        </span>
        <button
          type="button"
          onClick={onClose}
          title="Close subtask details"
          aria-label="Close subtask details"
          className={`shrink-0 rounded p-1 ${styles.label} hover:bg-slate-500/10`}
        >
          <X size={13} />
        </button>
      </div>

      <label className="block">
        <span className={`mb-1 block text-[10px] font-bold uppercase tracking-wider ${styles.label}`}>Details</span>
        <textarea
          value={draft}
          rows={4}
          maxLength={5000}
          disabled={readOnly}
          placeholder="What this subtask involves"
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commitDescription}
          className={`w-full resize-y rounded-lg border px-2 py-1.5 text-xs disabled:opacity-60 ${styles.input}`}
        />
      </label>

      <label className="block">
        <span className={`mb-1 block text-[10px] font-bold uppercase tracking-wider ${styles.label}`}>Due date</span>
        <input
          type="date"
          disabled={readOnly}
          value={String(subtask.dueDate || "").slice(0, 10)}
          onChange={(event) => onChange({ dueDate: event.target.value || null })}
          className={`h-8 w-full rounded-lg border px-2 text-xs disabled:opacity-60 ${styles.input}`}
        />
      </label>
    </aside>
  );
};

export default SubtaskDetailPanel;
