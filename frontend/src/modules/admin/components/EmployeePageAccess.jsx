import { useEffect, useRef, useState } from "react";
import api from "../../../services/api";
import { toErrorMessage } from "../../../utils/errorMessage";

const ACTION_LABELS = { view: "Open", create: "Add", edit: "Edit", delete: "Delete", export: "Export", approve: "Approve", assign: "Assign", follow_up: "Follow-up" };

const toEntryMap = (entries = [], catalog = []) => {
  const fallback = new Map(catalog.map((page) => [page.key, page]));
  return (Array.isArray(entries) ? entries : []).reduce((map, entry) => {
    const pageKey = typeof entry === "string" ? entry : entry?.pageKey;
    const page = fallback.get(pageKey);
    if (!page) return map;
    const actions = Array.isArray(entry?.actions) ? entry.actions : (typeof entry === "string" ? page.actions : ["view"]);
    map.set(pageKey, [...new Set(["view", ...actions].filter((action) => page.actions.includes(action)))]);
    return map;
  }, new Map());
};

export default function EmployeePageAccess({ user, onClose }) {
  const dialog = useRef(null);
  const [catalog, setCatalog] = useState([]);
  const [selected, setSelected] = useState(new Map());
  const [defaults, setDefaults] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    dialog.current?.showModal();
    let active = true;
    api.get(`/access/users/${user._id}/pages`).then(({ data }) => {
      if (!active) return;
      const pages = Array.isArray(data.pages) ? data.pages : [];
      setCatalog(pages);
      setSelected(toEntryMap(data.pageAccess || data.pageEntries || data.pageKeys, pages));
      setDefaults(data.usesRoleDefaults);
    }).catch((err) => { if (active) setError(toErrorMessage(err)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user._id]);

  const togglePage = (page, checked) => setSelected((current) => {
    const next = new Map(current);
    if (checked) next.set(page.key, ["view"]); else next.delete(page.key);
    return next;
  });

  const toggleAction = (page, action, checked) => setSelected((current) => {
    const next = new Map(current);
    const actions = new Set(next.get(page.key) || []);
    if (checked) { actions.add(action); actions.add("view"); } else { actions.delete(action); if (action === "view") actions.clear(); }
    if (actions.size) next.set(page.key, [...actions]); else next.delete(page.key);
    return next;
  });

  const save = async () => {
    setSaving(true); setError("");
    try {
      const pageAccess = [...selected.entries()].map(([pageKey, actions]) => ({ pageKey, actions }));
      await api.patch(`/access/users/${user._id}/pages`, { pageAccess: defaults ? null : pageAccess });
      onClose();
    } catch (err) { setError(toErrorMessage(err)); } finally { setSaving(false); }
  };

  const groups = [...new Set(catalog.map((page) => page.group))];
  return (
    <dialog ref={dialog} onCancel={(event) => { event.preventDefault(); if (!saving) onClose(); }} className="w-[min(760px,94vw)] max-h-[92dvh] rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-xl backdrop:bg-black/40">
      <div className="p-5">
        <div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-semibold">Page & action access</h2><p className="text-sm text-slate-600">{user.name} · {user.email}</p></div><button type="button" onClick={onClose} disabled={saving} aria-label="Close page access">×</button></div>
        <p className="my-4 text-sm text-slate-600">Choose which pages this employee can open and which actions they can perform. View is added automatically when another action is selected.</p>
        {error && <p role="alert" className="mb-3 text-sm text-red-600">{error}</p>}
        {loading ? <p role="status">Loading page access…</p> : catalog.length > 0 && <>
          <label className="flex items-center gap-2 rounded-lg bg-slate-100 p-3 text-sm font-medium"><input type="checkbox" checked={defaults} disabled={saving} onChange={(event) => setDefaults(event.target.checked)} />Use role defaults</label>
          <div className="my-4 max-h-[58dvh] space-y-4 overflow-y-auto pr-1">{groups.map((group) => <fieldset key={group}><legend className="mb-2 text-xs font-semibold uppercase text-slate-500">{group}</legend><div className="grid gap-2 sm:grid-cols-2">{catalog.filter((page) => page.group === group).map((page) => { const actions = selected.get(page.key) || []; const pageChecked = page.alwaysAccessible || actions.includes("view"); return <div key={page.key} className="rounded-lg border border-slate-200 p-3"><label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" disabled={defaults || saving || page.alwaysAccessible} checked={pageChecked} onChange={(event) => togglePage(page, event.target.checked)} /><span>{page.label}</span>{page.alwaysAccessible && <span className="text-xs text-slate-500">Always available</span>}</label><div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 border-t border-slate-100 pt-2">{page.actions.map((action) => <label key={action} className="inline-flex items-center gap-1 text-xs text-slate-600"><input type="checkbox" disabled={defaults || saving || page.alwaysAccessible || !pageChecked} checked={page.alwaysAccessible ? action === "view" : actions.includes(action)} onChange={(event) => toggleAction(page, action, event.target.checked)} />{ACTION_LABELS[action] || action}</label>)}</div></div>; })}</div></fieldset>)}</div>
        </>}
        <div className="flex justify-end gap-3 border-t pt-4"><button type="button" disabled={saving} onClick={onClose} className="rounded-lg border px-4 py-2 text-sm">Cancel</button><button type="button" disabled={loading || saving || !catalog.length} onClick={save} className="rounded-lg bg-blue-700 px-4 py-2 text-sm text-white disabled:opacity-50">{saving ? "Saving…" : "Save access"}</button></div>
      </div>
    </dialog>
  );
}
