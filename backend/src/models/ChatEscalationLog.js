const mongoose = require("mongoose");

const chatEscalationLogSchema = new mongoose.Schema(
  {
    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ChatRoom",
      required: true,
      index: true,
    },
    initiatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    managerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lead",
      default: null,
      index: true,
    },
    action: {
      type: String,
      enum: [
        "ESCALATION_CREATED",
        "MANAGER_NOTIFIED",
        "ESCALATION_MESSAGE_POSTED",
      ],
      required: true,
    },
    note: {
      type: String,
      trim: true,
      default: "",
      maxlength: 400,
    },
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  { timestamps: true },
);

chatEscalationLogSchema.index({ room: 1, createdAt: -1 });

module.exports = mongoose.model("ChatEscalationLog", chatEscalationLogSchema);
