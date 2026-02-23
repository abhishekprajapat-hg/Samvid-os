const mongoose = require("mongoose");

const CALL_MODES = ["audio", "video"];
const CALL_STATUSES = [
  "ringing",
  "connected",
  "ended",
  "rejected",
  "missed",
  "failed",
];

const chatCallHistorySchema = new mongoose.Schema(
  {
    callId: {
      type: String,
      required: true,
      trim: true,
    },
    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ChatRoom",
      required: true,
      index: true,
    },
    participants: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
      ],
      default: [],
      index: true,
    },
    caller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    mode: {
      type: String,
      enum: CALL_MODES,
      default: "audio",
    },
    status: {
      type: String,
      enum: CALL_STATUSES,
      default: "ringing",
      index: true,
    },
    answeredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    endedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    endReason: {
      type: String,
      trim: true,
      default: "",
      maxlength: 80,
    },
    startedAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    answeredAt: {
      type: Date,
      default: null,
    },
    endedAt: {
      type: Date,
      default: null,
    },
    durationSeconds: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true },
);

chatCallHistorySchema.index({ room: 1, startedAt: -1 });
chatCallHistorySchema.index({ participants: 1, startedAt: -1 });
chatCallHistorySchema.index({ callId: 1, room: 1 }, { unique: true });

module.exports = mongoose.model("ChatCallHistory", chatCallHistorySchema);
