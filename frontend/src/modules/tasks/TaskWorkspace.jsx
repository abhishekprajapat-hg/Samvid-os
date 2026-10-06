import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Edit3,
  Filter,
  GripVertical,
  Link2,
  ListChecks,
  MoreVertical,
  Plus,
  Search,
  Tag,
  Trash2,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import {
  addTaskSubtask,
  createTask,
  deleteTask,
  deleteTaskSubtask,
  getTaskAssignees,
  getTasks,
  updateTask,
  updateTaskSubtask,
} from "../../services/taskService";
import { getAllLeads } from "../../services/leadService";
import { deleteOutcomeMessage, isDeleteApprovalPending } from "../../services/deleteRequestService";
import ToastNotice from "../../components/ui/ToastNotice";
import TaskAssigneePicker from "./TaskAssigneePicker";
import "./task-workspace.css";

const STATUSES = [
  ["BACKLOG", "Backlog"],
  ["TODO", "To Do"],
  ["IN_PROGRESS", "In Progress"],
  ["COMPLETED", "Completed"],
];
const PRIORITIES = [["LOW", "Low"], ["MEDIUM", "Medium"], ["HIGH", "High"]];
// R3 (30 Sep 2026): overdue = not completed and the due date is before today.
const isTaskOverdue = (task) => task?.status !== "COMPLETED" && Boolean(task?.dueDate) && dateKey(task.dueDate) < dateKey();
const DEFAULT_TAGS = ["Call", "Meeting", "Client", "Follow-up"];

const refId = (value) => String(value?._id || value || "");
const subtaskStatus = (subtask) => subtask?.status || (subtask?.isCompleted ? "COMPLETED" : "TODO");
const isSubtaskDone = (subtask) => subtaskStatus(subtask) === "COMPLETED";
const dateKey = (value = new Date()) => {
  if (value === null || value === "") return "";
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
};
const formatDate = (value) => {
  if (!value) return "No date";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "No date";
  return parsed.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};
const initials = (name) => String(name || "?").trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
const titleCase = (value) => String(value || "").replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
const userName = (user) => user?.name || "Unassigned";
const leadName = (lead) => lead?.name || lead?.fullName || lead?.contactName || "Unnamed lead";

const emptyTaskForm = (currentUserId) => ({
  title: "",
  description: "",
  status: "TODO",
  priority: "MEDIUM",
  dueDate: dateKey(),
  assignedTo: currentUserId,
  leadId: "",
  tags: [],
  subtasks: [],
});

const normalizeFormTask = (task, currentUserId) => ({
  title: task?.title || "",
  description: task?.description || "",
  status: task?.status || "TODO",
  priority: task?.priority || "MEDIUM",
  dueDate: task?.dueDate ? dateKey(task.dueDate) : dateKey(),
  assignedTo: refId(task?.assignedTo) || currentUserId,
  leadId: refId(task?.leadId),
  tags: task?.tags || [],
  subtasks: (task?.subtasks || []).map((subtask) => ({
    ...subtask,
    title: subtask.title || "",
    description: subtask.description || "",
    assignedTo: refId(subtask.assignedTo) || refId(task?.assignedTo) || currentUserId,
    dueDate: subtask.dueDate ? dateKey(subtask.dueDate) : (task?.dueDate ? dateKey(task.dueDate) : dateKey()),
    status: subtaskStatus(subtask),
    priority: subtask.priority || task?.priority || "MEDIUM",
    isCompleted: isSubtaskDone(subtask),
  })),
});

function UserAvatar({ user, size = "md" }) {
  return <span className={`tw-avatar tw-avatar-${size}`} aria-hidden="true">{user?.profileImageUrl ? <img src={user.profileImageUrl} alt="" /> : initials(user?.name)}</span>;
}

function SelectField({ label, value, onChange, options, disabled = false, tone = "", icon = null }) {
  return (
    <label className={`tw-field ${tone}`}>
      <span>{label}</span>
      <div className="tw-select-wrap">
        {icon}
        <select value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled}>
          {options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}
        </select>
        <ChevronDown size={14} />
      </div>
    </label>
  );
}

function AssigneeField({ label = "Assign to", users, value, onChange, disabled = false }) {
  return (
    <div className="tw-field">
      <span>{label}</span>
      <TaskAssigneePicker compact users={users} value={value} onChange={onChange} disabled={disabled} />
    </div>
  );
}

function TaskFormModal({
  task,
  users,
  leads,
  currentUserId,
  defaultAssigneeId,
  lockAssignee,
  productionRole,
  busy,
  onClose,
  onSave,
}) {
  const initialForm = task ? normalizeFormTask(task, currentUserId) : emptyTaskForm(defaultAssigneeId || currentUserId);
  const [form, setForm] = useState(initialForm);
  const [expanded, setExpanded] = useState(initialForm.subtasks.length ? 0 : null);
  const [tagDraft, setTagDraft] = useState("");
  const [validation, setValidation] = useState("");

  useEffect(() => {
    document.documentElement.classList.add("task-editor-open");
    return () => document.documentElement.classList.remove("task-editor-open");
  }, []);

  const patch = (change) => setForm((previous) => ({ ...previous, ...change }));
  const patchSubtask = (index, change) => setForm((previous) => ({
    ...previous,
    subtasks: previous.subtasks.map((subtask, currentIndex) => currentIndex === index ? { ...subtask, ...change } : subtask),
  }));
  const addSubtask = () => {
    const nextIndex = form.subtasks.length;
    patch({
      subtasks: [...form.subtasks, {
        title: "",
        description: "",
        assignedTo: form.assignedTo || currentUserId,
        dueDate: form.dueDate || dateKey(),
        status: "TODO",
        priority: form.priority || "MEDIUM",
        isCompleted: false,
      }],
    });
    setExpanded(nextIndex);
  };
  const addTag = (candidate = tagDraft) => {
    const clean = candidate.trim();
    if (!clean || form.tags.includes(clean)) return;
    patch({ tags: [...form.tags, clean].slice(0, 20) });
    setTagDraft("");
  };
  const submit = (event) => {
    event.preventDefault();
    if (!form.title.trim()) return setValidation("Enter a task title.");
    if (!form.assignedTo) return setValidation("Choose an assignee.");
    if (!form.dueDate) return setValidation("Choose a due date.");
    const invalidIndex = form.subtasks.findIndex((subtask) => !subtask.title.trim() || !subtask.dueDate);
    if (invalidIndex >= 0) {
      setExpanded(invalidIndex);
      return setValidation(`Complete the required fields in subtask ${invalidIndex + 1}.`);
    }
    if (form.status === "COMPLETED" && form.subtasks.some((subtask) => subtaskStatus(subtask) !== "COMPLETED")) {
      return setValidation("Complete every subtask before completing the parent task.");
    }
    setValidation("");
    onSave(form);
  };

  const availableTagSuggestions = DEFAULT_TAGS.filter((tagName) => !form.tags.includes(tagName));

  return (
    <div className="tw-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !busy && onClose()}>
      <form className="tw-task-modal" role="dialog" aria-modal="true" aria-labelledby="task-editor-title" onSubmit={submit}>
        <header className="tw-modal-header">
          <span className="tw-modal-icon"><ListChecks size={19} /></span>
          <div>
            <h2 id="task-editor-title">{task ? "Edit task" : "New task"}</h2>
            <p>{task ? "Update the task and its subtasks." : "Create a task and add subtasks to break it down."}</p>
          </div>
          <button className="tw-icon-button" type="button" onClick={onClose} disabled={busy} aria-label="Close"><X size={17} /></button>
        </header>

        <div className="tw-modal-body">
          {validation ? <div className="tw-inline-error"><AlertCircle size={15} />{validation}</div> : null}
          <label className="tw-field tw-field-wide">
            <span>Title <b>*</b></span>
            <input autoFocus maxLength={180} value={form.title} onChange={(event) => patch({ title: event.target.value })} placeholder="What needs to be done?" />
          </label>
          <label className="tw-field tw-field-wide">
            <span>Description</span>
            <textarea rows={3} maxLength={10000} value={form.description} onChange={(event) => patch({ description: event.target.value })} placeholder="Add context, instructions, or expected outcome" />
          </label>

          <div className="tw-form-grid-three">
            <SelectField label="Status" value={form.status} onChange={(status) => patch({ status })} options={STATUSES} />
            <SelectField label="Priority" value={form.priority} onChange={(priority) => patch({ priority })} options={PRIORITIES} />
            <label className="tw-field"><span>Due date</span><input type="date" required value={form.dueDate} onChange={(event) => patch({ dueDate: event.target.value })} /></label>
          </div>

          <div className={`tw-assignee-line ${lockAssignee ? "is-locked" : ""}`}>
            <AssigneeField label={<>Assign to <b>*</b></>} users={users} value={form.assignedTo} onChange={(assignedTo) => patch({ assignedTo, subtasks: form.subtasks.map((subtask) => ({ ...subtask, assignedTo })) })} disabled={lockAssignee} />
            {!lockAssignee ? <button className="tw-secondary-button tw-assign-me" type="button" onClick={() => patch({ assignedTo: currentUserId, subtasks: form.subtasks.map((subtask) => ({ ...subtask, assignedTo: currentUserId })) })}><UserRound size={15} />Assign to me</button> : null}
          </div>
          <p className="tw-help-note"><AlertCircle size={14} />Every subtask is automatically assigned to the task owner.</p>

          <div className="tw-form-grid-two">
            {!productionRole ? (
              <label className="tw-field"><span>Lead</span><div className="tw-select-wrap"><Link2 size={15} /><select value={form.leadId} onChange={(event) => patch({ leadId: event.target.value })}><option value="">No linked lead</option>{leads.map((lead) => <option key={lead._id} value={lead._id}>{leadName(lead)}</option>)}</select><ChevronDown size={14} /></div></label>
            ) : <div />}
            <div className="tw-field"><span>Category tags</span><div className="tw-tag-editor">{form.tags.map((tagName) => <button type="button" key={tagName} onClick={() => patch({ tags: form.tags.filter((item) => item !== tagName) })}>{tagName}<X size={11} /></button>)}<input value={tagDraft} onChange={(event) => setTagDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addTag(); } }} placeholder="Add tag..." /></div></div>
          </div>
          {availableTagSuggestions.length && tagDraft ? <div className="tw-tag-suggestions">{availableTagSuggestions.filter((tagName) => tagName.toLowerCase().includes(tagDraft.toLowerCase())).map((tagName) => <button type="button" key={tagName} onClick={() => addTag(tagName)}>{tagName}</button>)}</div> : null}

          <section className="tw-form-subtasks">
            <div className="tw-subtasks-heading">
              <div><h3><ListChecks size={16} />Subtasks ({form.subtasks.length})</h3><p>Subtasks use the parent assignee and keep their own deadline, status, and priority.</p></div>
              <button className="tw-secondary-button" type="button" onClick={addSubtask}><Plus size={15} />Add subtask</button>
            </div>
            <div className="tw-form-subtask-list">
              {form.subtasks.map((subtask, index) => {
                const isOpen = expanded === index;
                return (
                  <article className={`tw-form-subtask ${isOpen ? "is-open" : ""}`} key={subtask._id || `draft-${index}`}>
                    <div className="tw-form-subtask-summary">
                      <button className={`tw-check ${isSubtaskDone(subtask) ? "is-checked" : ""}`} type="button" onClick={() => patchSubtask(index, { status: isSubtaskDone(subtask) ? "TODO" : "COMPLETED", isCompleted: !isSubtaskDone(subtask) })} aria-label={isSubtaskDone(subtask) ? "Reopen subtask" : "Complete subtask"}>{isSubtaskDone(subtask) ? <Check size={14} /> : null}</button>
                      <button className="tw-subtask-summary-copy" type="button" onClick={() => setExpanded(isOpen ? null : index)}>
                        <strong>{subtask.title || `New subtask ${index + 1}`}</strong>
                        {!isOpen ? <small>{subtask.description || "Add subtask details"}</small> : null}
                      </button>
                      {!isOpen ? <div className="tw-subtask-chips"><span><CalendarDays size={12} />{formatDate(subtask.dueDate)}</span><span className={`tw-priority-${String(subtask.priority).toLowerCase()}`}>{titleCase(subtask.priority)}</span></div> : null}
                      <button className="tw-icon-button tw-subtask-toggle" type="button" onClick={() => setExpanded(isOpen ? null : index)} aria-label={isOpen ? "Collapse subtask" : "Expand subtask"}><ChevronDown size={15} /></button>
                      <button className="tw-icon-button tw-danger" type="button" onClick={() => { patch({ subtasks: form.subtasks.filter((_, itemIndex) => itemIndex !== index) }); setExpanded(null); }} aria-label="Remove subtask"><Trash2 size={14} /></button>
                    </div>
                    {isOpen ? (
                      <div className="tw-form-subtask-editor">
                        <label className="tw-field tw-field-wide"><span>Title <b>*</b></span><input autoFocus value={subtask.title} maxLength={180} onChange={(event) => patchSubtask(index, { title: event.target.value })} placeholder="Subtask title" /></label>
                        <label className="tw-field tw-field-wide"><span>Description</span><textarea rows={2} maxLength={5000} value={subtask.description} onChange={(event) => patchSubtask(index, { description: event.target.value })} placeholder="Full instructions for this subtask" /></label>
                        <div className="tw-form-grid-three">
                          <label className="tw-field"><span>Due date</span><input type="date" required value={subtask.dueDate} onChange={(event) => patchSubtask(index, { dueDate: event.target.value })} /></label>
                          <SelectField label="Status" value={subtaskStatus(subtask)} onChange={(status) => patchSubtask(index, { status, isCompleted: status === "COMPLETED" })} options={STATUSES} />
                          <SelectField label="Priority" value={subtask.priority} onChange={(priority) => patchSubtask(index, { priority })} options={PRIORITIES} />
                        </div>
                      </div>
                    ) : null}
                  </article>
                );
              })}
              {!form.subtasks.length ? <button className="tw-empty-subtasks" type="button" onClick={addSubtask}><Plus size={15} />Break this task into smaller steps</button> : null}
            </div>
          </section>
        </div>

        <footer className="tw-modal-footer">
          <button className="tw-secondary-button" type="button" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="tw-primary-button" type="submit" disabled={busy}>{busy ? "Saving..." : <><Check size={15} />{task ? "Save changes" : "Create task"}</>}</button>
        </footer>
      </form>
    </div>
  );
}

function TaskRow({ task, selected, onSelect, onToggle, onEdit, onDelete, canEdit, canDelete, menuOpen, setMenuOpen, draggable = false, onDragStart }) {
  const progress = task.subtasks?.length ? { done: task.subtasks.filter(isSubtaskDone).length, total: task.subtasks.length } : null;
  const overdue = task.status !== "COMPLETED" && dateKey(task.dueDate) < dateKey() || (task.subtasks || []).some((subtask) => !isSubtaskDone(subtask) && dateKey(subtask.dueDate) < dateKey());
  const dueToday = task.status !== "COMPLETED" && dateKey(task.dueDate) === dateKey();
  return (
    <article
      className={`tw-task-row ${selected ? "is-selected" : ""} ${task.status === "COMPLETED" ? "is-completed" : ""}`}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget || !["Enter", " "].includes(event.key)) return;
        event.preventDefault();
        onSelect();
      }}
      tabIndex={0}
      draggable={draggable}
      onDragStart={onDragStart}
    >
      {draggable ? <GripVertical className="tw-drag-handle" size={15} /> : null}
      <button className={`tw-check ${task.status === "COMPLETED" ? "is-checked" : ""}`} type="button" onClick={(event) => { event.stopPropagation(); onToggle(); }} aria-label={task.status === "COMPLETED" ? "Reopen task" : "Complete task"}>{task.status === "COMPLETED" ? <Check size={15} /> : null}</button>
      <div className="tw-task-copy">
        <strong>{task.title}</strong>
        <p>{task.description || "No description added."}</p>
        {progress ? <span><ListChecks size={13} />{progress.done}/{progress.total} subtasks</span> : <span><ListChecks size={13} />No subtasks</span>}
      </div>
      <div className={`tw-task-priority tw-priority-${String(task.priority || "MEDIUM").toLowerCase()}`}><i />{titleCase(task.priority || "MEDIUM")}</div>
      <div className="tw-task-date"><span><CalendarDays size={14} />{formatDate(task.dueDate)}</span>{overdue ? <b>Overdue</b> : dueToday ? <b className="is-today">Today</b> : null}</div>
      <div className="tw-task-assignee"><UserAvatar user={task.assignedTo} /><span>{userName(task.assignedTo)}</span></div>
      <div className="tw-row-menu">
        <button className="tw-icon-button" type="button" onClick={(event) => { event.stopPropagation(); setMenuOpen(menuOpen ? null : task._id); }} aria-label="Task actions"><MoreVertical size={16} /></button>
        {menuOpen ? <div className="tw-menu-popover">{canEdit ? <button type="button" onClick={(event) => { event.stopPropagation(); onEdit(); }}><Edit3 size={14} />Edit task</button> : null}{canDelete ? <button className="is-danger" type="button" onClick={(event) => { event.stopPropagation(); onDelete(); }}><Trash2 size={14} />Delete task</button> : null}{!canEdit && !canDelete ? <span>No additional actions</span> : null}</div> : null}
      </div>
    </article>
  );
}

function SavedSubtask({ subtask, index, task, expanded, setExpanded, canManage, canChangeStatus, onPatch, onDelete }) {
  const locked = !canManage;
  return (
    <article className={`tw-detail-subtask ${expanded ? "is-open" : ""}`}>
      <div className="tw-detail-subtask-summary">
        <button className={`tw-check ${isSubtaskDone(subtask) ? "is-checked" : ""}`} disabled={!canChangeStatus} type="button" onClick={() => onPatch({ status: isSubtaskDone(subtask) ? "TODO" : "COMPLETED" })}>{isSubtaskDone(subtask) ? <Check size={14} /> : null}</button>
        <button className="tw-detail-subtask-copy" type="button" onClick={() => setExpanded(expanded ? null : index)}><strong>{subtask.title}</strong>{!expanded ? <small>{subtask.description || "No description added."}</small> : null}</button>
        <div className="tw-detail-subtask-meta"><span><CalendarDays size={13} />{formatDate(subtask.dueDate)}</span></div>
        <button className="tw-icon-button tw-expand" type="button" onClick={() => setExpanded(expanded ? null : index)} aria-label={expanded ? "Collapse subtask" : "Expand subtask"}><ChevronDown size={15} /></button>
      </div>
      {expanded ? (
        <div className="tw-detail-subtask-editor">
          <label className="tw-field tw-field-wide"><span>Title</span><input defaultValue={subtask.title || ""} disabled={locked} onBlur={(event) => { const title = event.target.value.trim(); if (title && title !== subtask.title) onPatch({ title }); }} /></label>
          <label className="tw-field tw-field-wide"><span>Description</span><textarea rows={3} defaultValue={subtask.description || ""} disabled={locked} onBlur={(event) => { if (event.target.value !== (subtask.description || "")) onPatch({ description: event.target.value }); }} /></label>
          <div className="tw-form-grid-three">
            <label className="tw-field"><span>Due date</span><input type="date" value={dateKey(subtask.dueDate)} disabled={locked} onChange={(event) => onPatch({ dueDate: event.target.value })} /></label>
            <SelectField label="Status" value={subtaskStatus(subtask)} onChange={(status) => onPatch({ status })} options={STATUSES} disabled={!canChangeStatus} />
            <SelectField label="Priority" value={subtask.priority || task.priority || "MEDIUM"} onChange={(priority) => onPatch({ priority })} options={PRIORITIES} disabled={locked} />
          </div>
          {canManage ? <button className="tw-text-danger" type="button" onClick={onDelete}><Trash2 size={14} />Remove subtask</button> : null}
        </div>
      ) : null}
    </article>
  );
}

function TaskDetails({ task, users, leads, currentUserId, canManage, canDelete, productionRole, expandedSubtask, setExpandedSubtask, onCloseMobile, onEdit, onDelete, onPatchTask, onPatchSubtask, onDeleteSubtask, onAddSubtask }) {
  const [tagDraft, setTagDraft] = useState("");
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [subtaskDraft, setSubtaskDraft] = useState(null);
  const done = task?.subtasks?.filter(isSubtaskDone).length || 0;
  const total = task?.subtasks?.length || 0;
  if (!task) return <section className="tw-detail-panel tw-detail-empty"><ClipboardList size={34} /><h2>Select a task</h2><p>Choose a task from the list to view its full details and subtasks.</p></section>;
  const parentReceiver = refId(task.assignedTo) === currentUserId && refId(task.createdBy) !== currentUserId;
  const canChangeParentStatus = canManage || parentReceiver;
  const overdue = task.status !== "COMPLETED" && task.dueDate && dateKey(task.dueDate) < dateKey();
  const addTag = () => {
    const tagName = tagDraft.trim();
    if (!tagName || (task.tags || []).includes(tagName)) return;
    onPatchTask({ tags: [...(task.tags || []), tagName] });
    setTagDraft("");
  };
  const openSubtaskDraft = () => {
    setSubtaskDraft({ title: "", description: "", dueDate: task.dueDate ? dateKey(task.dueDate) : dateKey(), status: "TODO", priority: task.priority || "MEDIUM" });
    setAddingSubtask(true);
  };
  const patchDraft = (change) => setSubtaskDraft((previous) => ({ ...previous, ...change }));
  const saveSubtaskDraft = async () => {
    if (!subtaskDraft?.title.trim() || !subtaskDraft.dueDate) return;
    const saved = await onAddSubtask({ ...subtaskDraft, assignedTo: refId(task.assignedTo), title: subtaskDraft.title.trim() });
    if (saved) { setAddingSubtask(false); setSubtaskDraft(null); }
  };
  return (
    <section className="tw-detail-panel">
      <header className="tw-detail-header">
        <button className="tw-mobile-back" type="button" onClick={onCloseMobile}><ChevronRight size={18} />Tasks</button>
        <div><h2>{task.title}</h2><p>{task.description || "No description added."}</p></div>
        <div className="tw-detail-actions">{canManage ? <button className="tw-secondary-button" type="button" onClick={onEdit}><Edit3 size={15} />Edit</button> : null}{canDelete ? <button className="tw-icon-button" type="button" onClick={onDelete} aria-label="Delete task"><Trash2 size={16} /></button> : null}</div>
      </header>

      <div className="tw-detail-fields">
        <SelectField label="Status" value={task.status} onChange={(status) => onPatchTask({ status })} options={STATUSES} disabled={!canChangeParentStatus} tone={`tw-status-${String(task.status).toLowerCase()}`} />
        <SelectField label="Priority" value={task.priority || "MEDIUM"} onChange={(priority) => onPatchTask({ priority })} options={PRIORITIES} disabled={!canManage} tone={`tw-priority-field-${String(task.priority || "MEDIUM").toLowerCase()}`} />
        <label className={`tw-field ${overdue ? "is-overdue" : ""}`}><span>Due date</span><div className="tw-date-field"><input type="date" value={dateKey(task.dueDate)} onChange={(event) => onPatchTask({ dueDate: event.target.value })} disabled={!canManage} />{overdue ? <b>Overdue</b> : null}</div></label>
        <AssigneeField users={users} value={refId(task.assignedTo)} onChange={(assignedTo) => onPatchTask({ assignedTo })} disabled={!canManage} />
        <div className="tw-field"><span>Created by</span><div className="tw-readonly-field"><UserAvatar user={task.createdBy} size="sm" /><strong>{userName(task.createdBy)}</strong><small>{titleCase(task.createdBy?.role)}</small></div></div>
        {!productionRole ? <label className="tw-field"><span>Linked lead</span><div className="tw-select-wrap"><Link2 size={15} /><select value={refId(task.leadId)} disabled={!canManage} onChange={(event) => onPatchTask({ leadId: event.target.value || null })}><option value="">No linked lead</option>{leads.map((lead) => <option value={lead._id} key={lead._id}>{leadName(lead)}</option>)}</select><ChevronDown size={14} /></div></label> : <div />}
      </div>

      <div className="tw-detail-tags">
        <span><Tag size={14} />Category tags</span>
        <div>{(task.tags || []).map((tagName) => <button type="button" key={tagName} disabled={!canManage} onClick={() => onPatchTask({ tags: task.tags.filter((item) => item !== tagName) })}>{tagName}{canManage ? <X size={11} /> : null}</button>)}{canManage ? <label><Plus size={13} /><input value={tagDraft} onChange={(event) => setTagDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addTag(); } }} onBlur={addTag} placeholder="Add tag" /></label> : null}</div>
      </div>

      <div className="tw-detail-divider" />
      <div className="tw-detail-subtasks-heading"><h3><ListChecks size={16} />Subtasks <span>({done} of {total})</span></h3>{canManage ? <button className="tw-secondary-button" type="button" onClick={openSubtaskDraft}><Plus size={15} />Add subtask</button> : null}</div>
      <div className="tw-detail-subtasks">
        {addingSubtask && subtaskDraft ? (
          <section className="tw-detail-new-subtask">
            <div className="tw-detail-new-subtask-title"><strong>New subtask</strong><button className="tw-icon-button" type="button" onClick={() => { setAddingSubtask(false); setSubtaskDraft(null); }} aria-label="Cancel new subtask"><X size={14} /></button></div>
            <label className="tw-field tw-field-wide"><span>Title <b>*</b></span><input autoFocus value={subtaskDraft.title} onChange={(event) => patchDraft({ title: event.target.value })} placeholder="Subtask title" /></label>
            <label className="tw-field tw-field-wide"><span>Description</span><textarea rows={3} value={subtaskDraft.description} onChange={(event) => patchDraft({ description: event.target.value })} placeholder="Full instructions for this subtask" /></label>
            <div className="tw-form-grid-three">
              <label className="tw-field"><span>Due date</span><input type="date" value={subtaskDraft.dueDate} onChange={(event) => patchDraft({ dueDate: event.target.value })} /></label>
              <SelectField label="Status" value={subtaskDraft.status} onChange={(status) => patchDraft({ status })} options={STATUSES} />
              <SelectField label="Priority" value={subtaskDraft.priority} onChange={(priority) => patchDraft({ priority })} options={PRIORITIES} />
            </div>
            <div className="tw-detail-new-subtask-actions"><button className="tw-secondary-button" type="button" onClick={() => { setAddingSubtask(false); setSubtaskDraft(null); }}>Cancel</button><button className="tw-primary-button" type="button" disabled={!subtaskDraft.title.trim() || !subtaskDraft.dueDate} onClick={saveSubtaskDraft}><Check size={14} />Add subtask</button></div>
          </section>
        ) : null}
        {(task.subtasks || []).map((subtask, index) => (
          <SavedSubtask
            key={subtask._id || index}
            subtask={subtask}
            index={index}
            task={task}
            expanded={expandedSubtask === index}
            setExpanded={setExpandedSubtask}
            canManage={canManage}
            canChangeStatus={canManage || refId(task.assignedTo) === currentUserId}
            onPatch={(patch, localOnly) => onPatchSubtask(index, patch, localOnly)}
            onDelete={() => onDeleteSubtask(index)}
          />
        ))}
        {!total ? <div className="tw-no-subtasks"><ListChecks size={23} /><p>No subtasks yet.</p>{canManage ? <button type="button" onClick={onAddSubtask}>Add the first subtask</button> : null}</div> : null}
      </div>
    </section>
  );
}

function memberTaskStats(tasks, memberId) {
  const memberTasks = tasks.filter((task) => refId(task.assignedTo) === String(memberId));
  const today = dateKey();
  return {
    total: memberTasks.length,
    open: memberTasks.filter((task) => task.status !== "COMPLETED").length,
    overdue: memberTasks.filter((task) => task.status !== "COMPLETED" && task.dueDate && dateKey(task.dueDate) < today).length,
    completed: memberTasks.filter((task) => task.status === "COMPLETED").length,
  };
}

function TeamDirectory({ users, tasks, search, onSelect, onCreate }) {
  const needle = search.trim().toLowerCase();
  const visibleUsers = users.filter((user) => `${user.name || ""} ${user.role || ""}`.toLowerCase().includes(needle));
  return (
    <section className="tw-team-directory">
      <header>
        <div><span className="tw-team-icon"><UsersRound size={20} /></span><div><h2>Team members</h2><p>Select a profile to see that user&apos;s assigned tasks.</p></div></div>
        <span>{visibleUsers.length} active</span>
      </header>
      {!visibleUsers.length ? <div className="tw-empty-state"><UsersRound size={36} /><h2>No team members found</h2><p>Try a different name or role.</p></div> : (
        <div className="tw-team-grid">
          {visibleUsers.map((user) => {
            const stats = memberTaskStats(tasks, user._id);
            return (
              <article className="tw-member-card" key={user._id} onClick={() => onSelect(user)} onKeyDown={(event) => { if (["Enter", " "].includes(event.key)) { event.preventDefault(); onSelect(user); } }} role="button" tabIndex={0}>
                <div className="tw-member-identity"><UserAvatar user={user} size="lg" /><div><h3>{user.name}</h3><p>{titleCase(user.role || "Team member")}</p></div><ChevronRight size={17} /></div>
                <div className="tw-member-stats"><span><strong>{stats.open}</strong>Open</span><button type="button" className="tw-member-overdue" title={`Show ${user.name}'s overdue tasks`} onClick={(event) => { event.stopPropagation(); onSelect(user, "OVERDUE"); }}><strong>{stats.overdue}</strong>Overdue</button><span><strong>{stats.completed}</strong>Done</span></div>
                <button type="button" onClick={(event) => { event.stopPropagation(); onCreate(user); }}><Plus size={15} />Assign task</button>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function TeamMemberBar({ user, tasks, onBack, onCreate }) {
  const stats = memberTaskStats(tasks, user._id);
  return (
    <section className="tw-team-member-bar">
      <button className="tw-team-back" type="button" onClick={onBack}><ArrowLeft size={16} />All team members</button>
      <UserAvatar user={user} size="lg" />
      <div className="tw-team-member-copy"><h2>{user.name}</h2><p>{titleCase(user.role || "Team member")} · {stats.open} open · {stats.completed} completed</p></div>
      <button className="tw-primary-button" type="button" onClick={() => onCreate(user)}><Plus size={16} />Assign task</button>
    </section>
  );
}

export default function TaskWorkspace() {
  const storedUser = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("user") || "{}"); } catch { return {}; }
  }, []);
  const currentUserId = String(storedUser.id || storedUser._id || "");
  const role = String(localStorage.getItem("role") || storedUser.role || "").toUpperCase();
  const isManager = ["ADMIN", "MANAGER"].includes(role);
  const productionRole = ["PRODUCTION_EXECUTIVE", "COMMUNITY_MANAGER"].includes(role);
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [memberFilter, setMemberFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [viewMode, setViewMode] = useState("list");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [mobileDetails, setMobileDetails] = useState(false);
  const [menuTaskId, setMenuTaskId] = useState("");
  const [expandedSubtask, setExpandedSubtask] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [quickTitle, setQuickTitle] = useState("");
  const [quickSubmitting, setQuickSubmitting] = useState(false);
  const [teamMemberId, setTeamMemberId] = useState("");
  const [creationAssigneeId, setCreationAssigneeId] = useState("");
  const [lockCreationAssignee, setLockCreationAssignee] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState({ Today: false, Upcoming: false, Completed: true });

  const assignableUsers = useMemo(() => {
    const result = [...users];
    if (currentUserId && !result.some((user) => String(user._id) === currentUserId)) result.unshift({ _id: currentUserId, name: storedUser.name || "Me", role });
    return result.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
  }, [users, currentUserId, storedUser.name, role]);

  const loadData = useCallback(async ({ quiet = false } = {}) => {
    if (quiet) setRefreshing(true); else setLoading(true);
    setError("");
    try {
      const [taskResult, userResult, leadResult] = await Promise.allSettled([
        getTasks({ scope: "all" }),
        getTaskAssignees(),
        productionRole ? Promise.resolve([]) : getAllLeads(),
      ]);
      if (taskResult.status === "rejected") throw taskResult.reason;
      const nextTasks = Array.isArray(taskResult.value) ? taskResult.value : [];
      setTasks(nextTasks);
      if (userResult.status === "fulfilled") setUsers((userResult.value?.users || []).filter((user) => user.isActive !== false));
      if (leadResult.status === "fulfilled") setLeads(Array.isArray(leadResult.value) ? leadResult.value : []);
      setSelectedId((previous) => nextTasks.some((task) => task._id === previous) ? previous : "");
    } catch (requestError) {
      console.error(requestError);
      setError(requestError.response?.data?.message || "Tasks could not be loaded.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [productionRole]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { if (!success) return undefined; const timer = window.setTimeout(() => setSuccess(""), 3500); return () => window.clearTimeout(timer); }, [success]);
  useEffect(() => {
    document.documentElement.classList.toggle("task-detail-open", mobileDetails);
    return () => document.documentElement.classList.remove("task-detail-open");
  }, [mobileDetails]);

  const canManageTask = useCallback((task) => {
    const creator = refId(task?.createdBy) === currentUserId;
    const receiver = refId(task?.assignedTo) === currentUserId && !creator;
    return Boolean(currentUserId) && (creator || (!receiver && isManager));
  }, [currentUserId, isManager]);
  const canDeleteTask = useCallback((task) => {
    const creator = refId(task?.createdBy) === currentUserId;
    const receiver = refId(task?.assignedTo) === currentUserId && !creator;
    return Boolean(currentUserId) && (creator || (!receiver && isManager));
  }, [currentUserId, isManager]);

  const tabTasks = useMemo(() => tasks.filter((task) => {
    const assignedHere = refId(task.assignedTo) === currentUserId || (task.subtasks || []).some((subtask) => refId(subtask.assignedTo) === currentUserId);
    const createdHere = refId(task.createdBy) === currentUserId;
    if (tab === "assigned") return assignedHere && !createdHere;
    if (tab === "created") return createdHere;
    if (tab === "team") return Boolean(teamMemberId) && refId(task.assignedTo) === teamMemberId;
    if (tab === "completed") return task.status === "COMPLETED";
    if (tab === "overdue") return isTaskOverdue(task);
    return true;
  }), [tasks, tab, currentUserId, teamMemberId]);

  const counts = useMemo(() => ({
    all: tasks.length,
    assigned: tasks.filter((task) => (refId(task.assignedTo) === currentUserId || (task.subtasks || []).some((subtask) => refId(subtask.assignedTo) === currentUserId)) && refId(task.createdBy) !== currentUserId).length,
    created: tasks.filter((task) => refId(task.createdBy) === currentUserId).length,
    team: assignableUsers.length,
    completed: tasks.filter((task) => task.status === "COMPLETED").length,
    overdue: tasks.filter(isTaskOverdue).length,
  }), [tasks, currentUserId, assignableUsers.length]);

  const visibleTasks = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return tabTasks.filter((task) => {
      const subtaskText = (task.subtasks || []).map((subtask) => `${subtask.title || ""} ${subtask.description || ""}`).join(" ");
      if (needle && !`${task.title || ""} ${task.description || ""} ${subtaskText}`.toLowerCase().includes(needle)) return false;
      if (memberFilter && refId(task.assignedTo) !== memberFilter && !(task.subtasks || []).some((subtask) => refId(subtask.assignedTo) === memberFilter)) return false;
      if (statusFilter === "OVERDUE") {
        if (!isTaskOverdue(task)) return false;
      } else if (statusFilter && task.status !== statusFilter && !(task.subtasks || []).some((subtask) => subtaskStatus(subtask) === statusFilter)) return false;
      if (priorityFilter && task.priority !== priorityFilter && !(task.subtasks || []).some((subtask) => subtask.priority === priorityFilter)) return false;
      return true;
    }).sort((a, b) => {
      if (a.status === "COMPLETED" && b.status !== "COMPLETED") return 1;
      if (b.status === "COMPLETED" && a.status !== "COMPLETED") return -1;
      const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      return aDue - bDue;
    });
  }, [tabTasks, search, memberFilter, statusFilter, priorityFilter]);

  const groups = useMemo(() => {
    const result = { Today: [], Upcoming: [], Completed: [] };
    const today = dateKey();
    visibleTasks.forEach((task) => {
      if (task.status === "COMPLETED") result.Completed.push(task);
      else if (!task.dueDate || dateKey(task.dueDate) <= today) result.Today.push(task);
      else result.Upcoming.push(task);
    });
    return result;
  }, [visibleTasks]);
  const selectedTask = visibleTasks.find((task) => task._id === selectedId) || visibleTasks[0] || null;

  const replaceTask = (updated) => {
    if (!updated?._id) return;
    setTasks((previous) => previous.map((task) => task._id === updated._id ? updated : task));
  };
  const showError = (requestError, fallback) => setError(requestError.response?.data?.message || fallback);

  const saveTask = async (form) => {
    setSubmitting(true);
    try {
      const payload = {
        title: form.title.trim(), description: form.description.trim(), status: form.status, priority: form.priority,
        dueDate: form.dueDate, assignedTo: form.assignedTo, leadId: productionRole ? null : (form.leadId || null), tags: form.tags,
        subtasks: form.subtasks.map((subtask) => ({ ...subtask, assignedTo: form.assignedTo, dueDate: subtask.dueDate, status: subtaskStatus(subtask), isCompleted: isSubtaskDone(subtask) })),
      };
      const saved = editingTask ? await updateTask(editingTask._id, payload) : await createTask(payload);
      replaceTask(saved);
      if (!editingTask) setTasks((previous) => previous.some((task) => task._id === saved._id) ? previous : [saved, ...previous]);
      setSelectedId(saved._id);
      setEditorOpen(false);
      setEditingTask(null);
      setSuccess(editingTask ? "Task updated." : "Task created and assigned.");
      await loadData({ quiet: true });
    } catch (requestError) { showError(requestError, "Task could not be saved."); }
    finally { setSubmitting(false); }
  };

  const quickCreateTask = async (event) => {
    event.preventDefault();
    const title = quickTitle.trim();
    if (!title || quickSubmitting) return;
    setQuickSubmitting(true);
    try {
      const created = await createTask({
        title,
        description: "",
        status: "TODO",
        priority: "MEDIUM",
        dueDate: dateKey(),
        assignedTo: teamMemberId || memberFilter || currentUserId,
        leadId: null,
        tags: [],
        subtasks: [],
      });
      setTasks((previous) => [created, ...previous]);
      setSelectedId(created._id);
      setQuickTitle("");
      setCollapsedGroups((previous) => ({ ...previous, Today: false }));
      setSuccess(`Task added${teamMemberId || memberFilter ? ` for ${userName(created.assignedTo)}` : ""}.`);
    } catch (requestError) { showError(requestError, "Task could not be added."); }
    finally { setQuickSubmitting(false); }
  };

  const patchTask = async (task, patch) => {
    if (!task) return;
    if (patch.status === "COMPLETED" && (task.subtasks || []).some((subtask) => !isSubtaskDone(subtask))) {
      setError("Complete every subtask before completing the parent task.");
      return;
    }
    const previous = task;
    replaceTask({ ...task, ...patch });
    try {
      const updated = await updateTask(task._id, patch);
      replaceTask(updated);
      setSuccess("Task updated.");
    } catch (requestError) { replaceTask(previous); showError(requestError, "Task could not be updated."); }
  };

  const patchSubtask = async (task, index, patch, localOnly = false) => {
    const subtask = task?.subtasks?.[index];
    if (!subtask) return;
    const localTask = { ...task, subtasks: task.subtasks.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch, ...(patch.status ? { isCompleted: patch.status === "COMPLETED" } : {}) } : item) };
    replaceTask(localTask);
    if (localOnly) return;
    try {
      const updated = await updateTaskSubtask(task._id, subtask._id, patch);
      replaceTask(updated);
      setSuccess("Subtask updated.");
    } catch (requestError) { replaceTask(task); showError(requestError, "Subtask could not be updated."); }
  };

  const removeSubtask = async (task, index) => {
    const subtask = task?.subtasks?.[index];
    if (!subtask?._id || !window.confirm("Remove this subtask?")) return;
    try {
      replaceTask(await deleteTaskSubtask(task._id, subtask._id));
      setExpandedSubtask(null);
      setSuccess("Subtask removed.");
    } catch (requestError) { showError(requestError, "Subtask could not be removed."); }
  };

  const addSubtask = async (task, draft) => {
    try {
      const updated = await addTaskSubtask(task._id, draft);
      replaceTask(updated);
      setExpandedSubtask((updated.subtasks || []).length - 1);
      setSuccess("Subtask added.");
      return true;
    } catch (requestError) { showError(requestError, "Subtask could not be added."); return false; }
  };

  const removeTask = async (task) => {
    const needsApproval = role === "MANAGER";
    if (!window.confirm(needsApproval ? "Send a request to Admin to delete this task?" : "Delete this task? This cannot be undone.")) return;
    try {
      const result = await deleteTask(task._id);
      setSuccess(deleteOutcomeMessage(result, "Task deleted."));
      if (!isDeleteApprovalPending(result)) setTasks((previous) => previous.filter((item) => item._id !== task._id));
      await loadData({ quiet: true });
    } catch (requestError) { showError(requestError, "Task could not be deleted."); }
  };

  const openTask = (task) => { setSelectedId(task._id); setExpandedSubtask(null); setMobileDetails(true); };
  const editTask = (task) => { setEditingTask(task); setEditorOpen(true); };
  const openNewTask = (assigneeId = "", locked = false) => {
    setEditingTask(null);
    setCreationAssigneeId(assigneeId || currentUserId);
    setLockCreationAssignee(Boolean(locked && assigneeId));
    setEditorOpen(true);
  };
  const selectTeamMember = (user, status = "") => {
    setTeamMemberId(String(user._id));
    setSelectedId("");
    setMemberFilter("");
    setSearch("");
    setStatusFilter(status);
  };
  const selectedTeamMember = assignableUsers.find((user) => String(user._id) === teamMemberId) || null;
  const tabs = [
    ...(isManager ? [["team", "Team"]] : []), ["all", "All tasks"],
    ["assigned", "Assigned to me"], ["created", "My tasks"], ["overdue", "Overdue"], ["completed", "Completed"],
  ];

  return (
    <main className="task-workspace-page">
      <ToastNotice message={success} type="success" />
      <ToastNotice message={error} type="error" />
      <div className="tw-commandbar">
        <nav className="tw-tabs" aria-label="Task views">
          {tabs.map(([value, label]) => <button key={value} type="button" className={tab === value ? "is-active" : ""} onClick={() => { setTab(value); setSelectedId(""); setTeamMemberId(""); setMemberFilter(""); setSearch(""); }}>{label}<span>{counts[value]}</span></button>)}
        </nav>
        <div className="tw-toolbar">
          {tab !== "team" ? <label className="tw-member-filter"><UsersRound size={16} /><select value={memberFilter} onChange={(event) => setMemberFilter(event.target.value)}><option value="">All members</option>{assignableUsers.map((user) => <option key={user._id} value={user._id}>{user.name}</option>)}</select><ChevronDown size={14} /></label> : null}
          <label className="tw-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={tab === "team" && !selectedTeamMember ? "Search team..." : "Search tasks..."} /><kbd>Ctrl K</kbd></label>
          {tab !== "team" || selectedTeamMember ? <div className="tw-filters-wrap">
            <button className={`tw-secondary-button ${filtersOpen || statusFilter || priorityFilter ? "is-active" : ""}`} type="button" onClick={() => setFiltersOpen((open) => !open)}><Filter size={16} />Filters{statusFilter || priorityFilter ? <span className="tw-filter-count">{Number(Boolean(statusFilter)) + Number(Boolean(priorityFilter))}</span> : null}</button>
            {filtersOpen ? <div className="tw-filters-popover"><SelectField label="Status" value={statusFilter} onChange={setStatusFilter} options={[["", "Any status"], ...STATUSES, ["OVERDUE", "Overdue"]]} /><SelectField label="Priority" value={priorityFilter} onChange={setPriorityFilter} options={[["", "Any priority"], ...PRIORITIES]} /><div className="tw-view-toggle"><button type="button" className={viewMode === "list" ? "is-active" : ""} onClick={() => setViewMode("list")}><ListChecks size={14} />List</button><button type="button" className={viewMode === "board" ? "is-active" : ""} onClick={() => setViewMode("board")}><ClipboardList size={14} />Board</button></div><button className="tw-clear-filters" type="button" onClick={() => { setStatusFilter(""); setPriorityFilter(""); setMemberFilter(""); }}>Clear filters</button></div> : null}
          </div> : null}
          {tab !== "team" || selectedTeamMember ? <button className="tw-primary-button" type="button" onClick={() => openNewTask(selectedTeamMember?._id || "", Boolean(selectedTeamMember))}><Plus size={17} />New task</button> : null}
        </div>
      </div>

      {loading ? <div className="tw-loading-state"><span /><p>Loading task workspace...</p></div> : tab === "team" && !selectedTeamMember ? (
        <TeamDirectory users={assignableUsers} tasks={tasks} search={search} onSelect={selectTeamMember} onCreate={(user) => openNewTask(String(user._id), true)} />
      ) : (
        <>
        {selectedTeamMember ? <TeamMemberBar user={selectedTeamMember} tasks={tasks} onBack={() => { setTeamMemberId(""); setSelectedId(""); setSearch(""); }} onCreate={(user) => openNewTask(String(user._id), true)} /> : null}
        <div className={`tw-workspace ${mobileDetails ? "show-mobile-detail" : ""}`}>
          <section className="tw-list-panel">
            {refreshing ? <div className="tw-refresh-line" /> : null}
            {tab !== "completed" ? (
              <form className="tw-quick-add" onSubmit={quickCreateTask}>
                <span><Plus size={18} /></span>
                <input value={quickTitle} onChange={(event) => setQuickTitle(event.target.value)} maxLength={180} placeholder="Add a task" aria-label="Quick task title" />
                {quickTitle.trim() ? <button type="submit" disabled={quickSubmitting}>{quickSubmitting ? "Adding..." : "Add"}</button> : <button type="button" onClick={() => openNewTask(selectedTeamMember?._id || "", Boolean(selectedTeamMember))}>Details</button>}
              </form>
            ) : null}
            {error && !tasks.length ? <div className="tw-empty-state tw-error-state"><AlertCircle size={36} /><h2>Tasks are unavailable</h2><p>{error}</p><button className="tw-secondary-button" type="button" onClick={() => loadData()}>Try again</button></div> : !visibleTasks.length ? <div className="tw-empty-state"><ClipboardList size={36} /><h2>No tasks found</h2><p>{search || memberFilter || statusFilter || priorityFilter ? "Clear a filter or try a different search." : selectedTeamMember ? `${selectedTeamMember.name} has no assigned tasks yet.` : "Create a task to start organizing the work."}</p><button className="tw-primary-button" type="button" onClick={() => openNewTask(selectedTeamMember?._id || "", Boolean(selectedTeamMember))}><Plus size={16} />New task</button></div> : viewMode === "list" ? (
              <div className="tw-grouped-list">
                {Object.entries(groups).map(([groupName, groupTasks]) => groupTasks.length ? (
                  <section className="tw-task-group" key={groupName}>
                    <header><button type="button" className={collapsedGroups[groupName] ? "is-collapsed" : ""} onClick={() => setCollapsedGroups((previous) => ({ ...previous, [groupName]: !previous[groupName] }))} aria-expanded={!collapsedGroups[groupName]}><ChevronDown size={16} /><h2>{groupName}</h2><span>({groupTasks.length})</span></button></header>
                    {!collapsedGroups[groupName] ? groupTasks.map((task) => <TaskRow key={task._id} task={task} selected={selectedTask?._id === task._id} onSelect={() => openTask(task)} onToggle={() => patchTask(task, { status: task.status === "COMPLETED" ? "TODO" : "COMPLETED" })} onEdit={() => editTask(task)} onDelete={() => removeTask(task)} canEdit={canManageTask(task)} canDelete={canDeleteTask(task)} menuOpen={menuTaskId === task._id} setMenuOpen={setMenuTaskId} />) : null}
                  </section>
                ) : null)}
              </div>
            ) : (
              <div className="tw-board">
                {STATUSES.map(([status, label]) => {
                  const statusTasks = visibleTasks.filter((task) => task.status === status);
                  return <section key={status} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { const task = tasks.find((item) => item._id === event.dataTransfer.getData("text/task-id")); if (task && task.status !== status) patchTask(task, { status }); }}><header><i className={`tw-status-dot-${status.toLowerCase()}`} />{label}<span>{statusTasks.length}</span></header><div>{statusTasks.map((task) => <TaskRow key={task._id} task={task} selected={selectedTask?._id === task._id} onSelect={() => openTask(task)} onToggle={() => patchTask(task, { status: task.status === "COMPLETED" ? "TODO" : "COMPLETED" })} onEdit={() => editTask(task)} onDelete={() => removeTask(task)} canEdit={canManageTask(task)} canDelete={canDeleteTask(task)} menuOpen={menuTaskId === task._id} setMenuOpen={setMenuTaskId} draggable onDragStart={(event) => event.dataTransfer.setData("text/task-id", task._id)} />)}</div></section>;
                })}
              </div>
            )}
          </section>

          <div className="tw-detail-shell" key={selectedTask?._id || "empty"}>
            <TaskDetails task={selectedTask} users={assignableUsers} leads={leads} currentUserId={currentUserId} canManage={canManageTask(selectedTask)} canDelete={canDeleteTask(selectedTask)} productionRole={productionRole} expandedSubtask={expandedSubtask} setExpandedSubtask={setExpandedSubtask} onCloseMobile={() => setMobileDetails(false)} onEdit={() => editTask(selectedTask)} onDelete={() => removeTask(selectedTask)} onPatchTask={(patch) => patchTask(selectedTask, patch)} onPatchSubtask={(index, patch, localOnly) => patchSubtask(selectedTask, index, patch, localOnly)} onDeleteSubtask={(index) => removeSubtask(selectedTask, index)} onAddSubtask={(draft) => addSubtask(selectedTask, draft)} />
          </div>
        </div>
        </>
      )}

      {editorOpen ? <TaskFormModal task={editingTask} users={assignableUsers} leads={leads} currentUserId={currentUserId} defaultAssigneeId={creationAssigneeId} lockAssignee={!editingTask && lockCreationAssignee} productionRole={productionRole} busy={submitting} onClose={() => { if (!submitting) { setEditorOpen(false); setEditingTask(null); setCreationAssigneeId(""); setLockCreationAssignee(false); } }} onSave={saveTask} /> : null}
    </main>
  );
}
