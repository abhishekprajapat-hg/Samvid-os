import React, { useState } from "react";
import { Check, ChevronDown, Search, UserRound } from "lucide-react";
import AvatarFace from "../../components/ui/AvatarFace";

const initials = (name) => String(name || "?").trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

const TaskAssigneePicker = ({ users = [], value = "", onChange, disabled = false, placeholder = "Choose an assignee", compact = false }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = users.find((user) => String(user._id) === String(value));
  const needle = query.trim().toLowerCase();
  const filtered = needle
    ? users.filter((user) => `${user.name || ""} ${user.role || ""} ${user.email || ""}`.toLowerCase().includes(needle))
    : users;

  return (
    <div className={`task-user-picker ${compact ? "is-compact" : ""}`}>
      <button type="button" className="task-user-picker-trigger" disabled={disabled} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((shown) => !shown)}>
        {selected ? <span className="task-user-avatar"><AvatarFace user={selected} initials={initials(selected.name)} /></span> : <UserRound size={15} />}
        <span className="task-user-picker-copy">
          <strong>{selected?.name || placeholder}</strong>
          {selected?.role ? <small>{String(selected.role).replaceAll("_", " ")}</small> : null}
        </span>
        <ChevronDown size={14} />
      </button>
      {open ? (
        <>
          <button type="button" className="task-user-picker-backdrop" aria-label="Close assignee selector" onClick={() => setOpen(false)} />
          <div className="task-user-picker-popover">
            <label><Search size={14} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search active users..." /></label>
            <div role="listbox" aria-label="Active users">
              {filtered.length ? filtered.map((user) => {
                const active = String(user._id) === String(value);
                return (
                  <button key={user._id} type="button" role="option" aria-selected={active} onClick={() => { onChange?.(String(user._id)); setOpen(false); setQuery(""); }}>
                    <span className="task-user-avatar"><AvatarFace user={user} initials={initials(user.name)} /></span>
                    <span><strong>{user.name}</strong><small>{String(user.role || "Team member").replaceAll("_", " ")}</small></span>
                    {active ? <Check size={14} /> : null}
                  </button>
                );
              }) : <p>No active users found.</p>}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
};

export default TaskAssigneePicker;
