const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    status: {
      type: String,
      enum: ["TODO", "IN_PROGRESS", "COMPLETED", "BACKLOG"],
      default: "TODO",
    },
    priority: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH"],
      default: "MEDIUM",
    },
    dueDate: {
      type: Date,
      default: null,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lead",
      default: null,
      index: true,
    },
    subtasks: [
      {
        title: { type: String, required: true, trim: true },
        isCompleted: { type: Boolean, default: false },
        description: { type: String, default: "", maxlength: 5000 },
        dueDate: { type: Date, default: null }
      }
    ],
    assignmentHistory: [{
      fromUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      toUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
      at: { type: Date, default: Date.now },
    }],
    tags: [
      {
        type: String,
        trim: true
      }
    ],
  },
  { timestamps: true }
);

taskSchema.index({ companyId: 1, status: 1 });
taskSchema.index({ companyId: 1, assignedTo: 1 });
taskSchema.index({ companyId: 1, createdBy: 1 });
taskSchema.index({ companyId: 1, assignedTo: 1, status: 1, dueDate: 1 });
taskSchema.index({ companyId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model("Task", taskSchema);
