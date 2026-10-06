import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import { getLeadPool } from "../../services/leadService";
import { digitsOf, matchesLeadQuery } from "./calendarFollowUps";

/*
 * Searchable lead picker for the calendar (R2, 30 Sep 2026 update).
 *
 * A plain <select> of every lead stops being usable at a few hundred leads.
 * This filters the leads already loaded by name or phone as you type, and -
 * because the loaded list is capped - also asks the server once typing pauses,
 * so a lead that was not loaded can still be found.
 */
const MAX_RESULTS = 50;
const SEARCH_FIELDS = "_id,name,phone,status,nextFollowUp,dealPayment";

const LeadSearchPicker = ({ leads = [], value = "", onSelect, isEligible = () => true, isDark = false }) => {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [remote, setRemote] = useState([]);
  const [searching, setSearching] = useState(false);
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);
  const listId = useId();

  const selectedLead = useMemo(
    () => leads.find((lead) => lead._id === value) || remote.find((lead) => lead._id === value) || null,
    [leads, remote, value],
  );

  // Ask the server when the loaded list may not hold the lead being looked for.
  useEffect(() => {
    const text = query.trim();
    if (text.length < 2) {
      setRemote([]);
      setSearching(false);
      return undefined;
    }
    let live = true;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const digits = digitsOf(text);
        const search = digits.length >= 4 && digits.length >= text.replace(/\s/g, "").length - 1 ? digits : text;
        const data = await getLeadPool({ search, limit: 20, fields: SEARCH_FIELDS });
        if (live) setRemote((Array.isArray(data?.leads) ? data.leads : []).filter(isEligible));
      } catch {
        if (live) setRemote([]);
      } finally {
        if (live) setSearching(false);
      }
    }, 300);
    return () => { live = false; clearTimeout(timer); };
  }, [query, isEligible]);

  const results = useMemo(() => {
    const seen = new Set();
    const rows = [];
    [...leads.filter((lead) => matchesLeadQuery(lead, query)), ...remote].forEach((lead) => {
      if (!lead?._id || seen.has(lead._id)) return;
      seen.add(lead._id);
      rows.push(lead);
    });
    return rows.slice(0, MAX_RESULTS);
  }, [leads, remote, query]);

  useEffect(() => { setActiveIndex(0); }, [query]);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const choose = (lead) => {
    if (!lead) return;
    onSelect?.(lead);
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
  };

  const onKeyDown = (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => Math.min(index + 1, Math.max(results.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter" && open && results[activeIndex]) {
      event.preventDefault();
      choose(results[activeIndex]);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  };

  const shown = open ? query : (selectedLead ? `${selectedLead.name || "Lead"}${selectedLead.phone ? ` (${selectedLead.phone})` : ""}` : query);
  const tone = isDark
    ? { box: "border-slate-700 bg-slate-900 text-slate-100", menu: "border-slate-700 bg-slate-900", item: "text-slate-200", sub: "text-slate-400", active: "bg-cyan-500/15", icon: "text-slate-500" }
    : { box: "border-slate-300 bg-white text-slate-800", menu: "border-slate-200 bg-white", item: "text-slate-800", sub: "text-slate-500", active: "bg-sky-50", icon: "text-slate-400" };

  return (
    <div ref={wrapperRef} className="relative">
      <Search size={15} className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 ${tone.icon}`} />
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label="Search lead by name or phone"
        placeholder="Search lead by name or phone"
        value={shown}
        onFocus={() => { setOpen(true); setQuery(""); }}
        onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
        onKeyDown={onKeyDown}
        className={`h-10 w-full rounded-xl border pl-9 pr-9 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 ${tone.box}`}
      />
      {searching ? (
        <Loader2 size={15} className={`absolute right-3 top-1/2 -translate-y-1/2 animate-spin ${tone.icon}`} />
      ) : (open && query) ? (
        <button type="button" aria-label="Clear search" onMouseDown={(e) => e.preventDefault()} onClick={() => setQuery("")} className={`absolute right-2.5 top-1/2 -translate-y-1/2 ${tone.icon}`}>
          <X size={15} />
        </button>
      ) : null}

      {open ? (
        <ul id={listId} role="listbox" className={`absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border p-1 shadow-lg ${tone.menu}`}>
          {results.length ? results.map((lead, index) => (
            <li key={lead._id} role="option" aria-selected={lead._id === value}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => choose(lead)}
                className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left ${index === activeIndex ? tone.active : ""}`}
              >
                <span className="min-w-0">
                  <span className={`block truncate text-sm font-semibold ${tone.item}`}>{lead.name || "Unnamed lead"}</span>
                  <span className={`block truncate text-xs ${tone.sub}`}>{lead.phone || "No phone"}</span>
                </span>
                <span className={`shrink-0 text-[10px] font-bold uppercase tracking-wide ${tone.sub}`}>{String(lead.status || "").replace(/_/g, " ")}</span>
              </button>
            </li>
          )) : (
            <li className={`px-3 py-4 text-center text-xs ${tone.sub}`}>
              {searching ? "Searching all leads..." : query.trim() ? "No lead matches that name or phone" : "No leads to schedule"}
            </li>
          )}
          {results.length === MAX_RESULTS ? (
            <li className={`px-3 py-1.5 text-center text-[11px] ${tone.sub}`}>Showing first {MAX_RESULTS} - type more to narrow down</li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
};

export default LeadSearchPicker;
