const mongoose = require("mongoose");
const { CHAT_MESSAGE_TYPES } = require("../constants/chat.constants");

const recipientStatusSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    at: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false },
);

const chatMessageSchema = new mongoose.Schema(
  {
    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ChatRoom",
      required: true,
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1200,
    },
    type: {
      type: String,
      enum: Object.values(CHAT_MESSAGE_TYPES),
      default: CHAT_MESSAGE_TYPES.TEXT,
      index: true,
    },
    deliveredTo: {
      type: [recipientStatusSchema],
      default: [],
    },
    seenBy: {
      type: [recipientStatusSchema],
      default: [],
    },
  },
  { timestamps: true },
);

chatMessageSchema.index({ room: 1, createdAt: -1 });

module.exports = mongoose.model("ChatMessage", chatMessageSchema);
