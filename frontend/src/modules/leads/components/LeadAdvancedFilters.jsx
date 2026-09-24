import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "../../../components/ui";

export default function LeadAdvancedFilters({ filters, status, subtype, statuses, subtypes, employees, categories, onApply }) {
  const [draft, setDraft] = useState({ ...filters, status, subtype });
  const [error, setError] = useState("");
  const set = (key, value) => setDraft((prev) => ({ ...prev, [key]: value }));
  const control = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";
  const select = (key, label, options) => <label className="space-y-1 text-xs font-medium" key={key}><span>{label}</span><select className={control} value={draft[key] || ""} onChange={(event) => set(key, event.target.value)}><option value="">Any</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
  const input = (key, label, type = "text") => <label className="space-y-1 text-xs font-medium" key={key}><span>{label}</span><input className={control} type={type} min={type === "number" ? "0" : undefined} step={type === "number" ? "any" : undefined} value={draft[key] || ""} onChange={(event) => set(key, event.target.value)} /></label>;
  const apply = (event) => {
    event.preventDefault();
    for (const [from, to, label] of [["budgetMin", "budgetMax", "Budget"], ["createdFrom", "createdTo", "Created date"], ["followUpDateFrom", "followUpDateTo", "Follow-up date"]]) {
      if (draft[from] && draft[to] && (from === "budgetMin" ? Number(draft[from]) > Number(draft[to]) : draft[from] > draft[to])) { setError(`${label}: from must not exceed to.`); return; }
    }
    const { status: nextStatus, subtype: nextSubtype, ...next } = draft;
    setError("");
    onApply(next, nextStatus || "ALL", nextSubtype || "");
  };
  return <section aria-labelledby="lead-filter-title" className="rounded-xl border border-slate-200 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
    <form onSubmit={apply}>
      <header className="px-4 pt-4"><h2 id="lead-filter-title" className="flex items-center gap-2 text-sm font-semibold"><SlidersHorizontal size={16} />Advanced filters</h2><p className="mt-1 text-xs text-slate-500">Find leads across your accessible pipeline. Dates use India time.</p></header>
      <div className="space-y-3 p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {select("status", "Status", statuses)}
          {select("source", "Lead source", [{ value: "META", label: "Meta Ads" }, { value: "MANUAL", label: "Manual / Import" }])}
          {select("assignedTo", "Assigned employee", [{ value: "UNASSIGNED", label: "Unassigned" }, ...employees.map((user) => ({ value: String(user._id), label: user.name }))])}
          {select("inventoryType", "Business category", categories)}
          {select("subtype", "Property type", subtypes)}
          {select("transactionType", "Transaction", ["SALE", "RENT", "LEASE"].map((value) => ({ value, label: value })))}
          {input("city", "City contains")}{input("project", "Project contains")}
          {input("budgetMin", "Budget from (₹)", "number")}{input("budgetMax", "Budget to (₹)", "number")}
          {input("createdFrom", "Created from", "date")}{input("createdTo", "Created to", "date")}
          {input("followUpDateFrom", "Follow-up from", "date")}{input("followUpDateTo", "Follow-up to", "date")}
        </div>
        <p className="text-xs text-slate-500">Budget matches overlapping lead budgets. Applying filters opens the All view.</p>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      </div>
      <footer className="flex flex-wrap justify-end gap-2 border-t border-slate-200 px-4 py-3 dark:border-slate-700"><Button variant="secondary" type="button" onClick={() => { setDraft({}); setError(""); onApply({}, "ALL", ""); }}>Reset filters</Button><Button type="submit">Apply filters</Button></footer>
    </form>
  </section>;
}
