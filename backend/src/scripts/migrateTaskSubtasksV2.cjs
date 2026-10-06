#!/usr/bin/env node
/*
 * Backfills legacy checklist entries with detailed fields and aligns every
 * subtask owner with its parent task owner. Legacy unassigned parent tasks use
 * their creator so the required-assignee invariant can be enforced safely.
 * Report-only by default; pass --apply after reviewing the output.
 *
 *   npm run migrate:task-subtasks-v2
 *   npm run migrate:task-subtasks-v2 -- --apply
 */
require("dotenv").config();
const mongoose = require("mongoose");

const APPLY = process.argv.includes("--apply");
const dateOnly = (value) => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
};

(async () => {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is required");
  await mongoose.connect(process.env.MONGO_URI, { autoIndex: false });
  const tasks = mongoose.connection.db.collection("tasks");
  const cursor = tasks.find({ $or: [{ "subtasks.0": { $exists: true } }, { assignedTo: null }, { assignedTo: { $exists: false } }] }, {
    projection: { title: 1, assignedTo: 1, createdBy: 1, dueDate: 1, priority: 1, createdAt: 1, subtasks: 1 },
  });

  let scanned = 0;
  let affected = 0;
  let changedSubtasks = 0;
  for await (const task of cursor) {
    scanned += 1;
    let changed = false;
    const parentAssignee = task.assignedTo || task.createdBy;
    if (!task.assignedTo && parentAssignee) changed = true;
    const subtasks = (task.subtasks || []).map((subtask) => {
      const next = { ...subtask };
      let subtaskChanged = false;
      if (!next.status) { next.status = next.isCompleted ? "COMPLETED" : "TODO"; subtaskChanged = true; }
      if (next.isCompleted !== (next.status === "COMPLETED")) { next.isCompleted = next.status === "COMPLETED"; subtaskChanged = true; }
      if (!next.priority) { next.priority = task.priority || "MEDIUM"; subtaskChanged = true; }
      if (String(next.assignedTo || "") !== String(parentAssignee || "")) { next.assignedTo = parentAssignee; subtaskChanged = true; }
      if (!next.dueDate) { next.dueDate = dateOnly(task.dueDate) || dateOnly(task.createdAt); subtaskChanged = true; }
      if (subtaskChanged) { changed = true; changedSubtasks += 1; }
      return next;
    });
    if (!changed) continue;
    affected += 1;
    console.log(`${APPLY ? "Updating" : "Would update"} ${task._id}  ${String(task.title || "Untitled").slice(0, 70)}`);
    if (APPLY) await tasks.updateOne({ _id: task._id }, { $set: { assignedTo: parentAssignee, subtasks } });
  }

  console.log(`\nScanned ${scanned} task(s); ${affected} task(s) and ${changedSubtasks} subtask value(s) need backfill.`);
  if (!APPLY) console.log("Report only. Re-run with --apply to persist the backfill.");
  await mongoose.disconnect();
})().catch(async (error) => {
  console.error("Task subtask migration failed:", error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
