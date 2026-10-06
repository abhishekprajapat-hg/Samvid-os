import React, { useState } from "react";
import { X } from "lucide-react";
import TaskAssigneePicker from "./TaskAssigneePicker";

const SUBTASK_STATUSES = [
  ["BACKLOG", "Backlog"],
  ["TODO", "To Do"],
  ["IN_PROGRESS", "In Progress"],
  ["COMPLETED", "Completed"],
];
const SUBTASK_PRIORITIES = [["LOW", "Low"], ["MEDIUM", "Medium"], ["HIGH", "High"]];

const SubtaskDetailPanel = ({ subtask, users = [], onChange, onClose, readOnly = false, statusOnly = false }) => {
  const [title, setTitle] = useState(subtask?.title || "");
  const [description, setDescription] = useState(subtask?.description || "");
  if (!subtask) return null;
  const locked = readOnly || statusOnly;
  const status = subtask.status || (subtask.isCompleted ? "COMPLETED" : "TODO");

  return (
    <section className="task-subtask-editor" aria-label={`Details for subtask ${subtask.title}`}>
      <header>
        <div><strong>Subtask details</strong><span>Each subtask has its own owner and deadline.</span></div>
        <button type="button" onClick={onClose} aria-label="Close subtask details"><X size={15} /></button>
      </header>
      <label className="task-form-field"><span>Title *</span><input value={title} maxLength={180} disabled={locked} onChange={(event) => setTitle(event.target.value)} onBlur={() => { const clean = title.trim(); if (clean && clean !== (subtask.title || "")) onChange({ title: clean }); }} /></label>
      <label className="task-form-field"><span>Description</span><textarea value={description} rows={4} maxLength={5000} disabled={locked} placeholder="Full instructions and context" onChange={(event) => setDescription(event.target.value)} onBlur={() => { if (description !== (subtask.description || "")) onChange({ description }); }} /></label>
      <div className="task-subtask-editor-grid">
        <label className="task-form-field"><span>Status</span><select value={status} disabled={readOnly} onChange={(event) => onChange({ status: event.target.value, isCompleted: event.target.value === "COMPLETED" })}>{SUBTASK_STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="task-form-field"><span>Priority</span><select value={subtask.priority || "MEDIUM"} disabled={locked} onChange={(event) => onChange({ priority: event.target.value })}>{SUBTASK_PRIORITIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="task-form-field"><span>Due date *</span><input type="date" required value={String(subtask.dueDate || "").slice(0, 10)} disabled={locked} onChange={(event) => onChange({ dueDate: event.target.value })} /></label>
        <div className="task-form-field"><span>Assign to *</span><TaskAssigneePicker compact users={users} value={subtask.assignedTo?._id || subtask.assignedTo || ""} onChange={(assignedTo) => onChange({ assignedTo })} disabled={locked} /></div>
      </div>
      {statusOnly ? <p className="task-subtask-permission-note">You can update this subtask’s status. Its creator manages the remaining fields.</p> : null}
    </section>
  );
};

export default SubtaskDetailPanel;
