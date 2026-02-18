const mongoose = require("mongoose");

const chatConversationSchema = new mongoose.Schema(
  {
    participants: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
      ],
      validate: {
        validator(value) {
          return Array.isArray(value) && value.length === 2;
        },
        message: "Direct conversation must have exactly 2 participants",
      },
      index: true,
    },
    participantHash: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    lastMessage: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1200,
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    lastMessageSender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true },
);

chatConversationSchema.index({ participants: 1, lastMessageAt: -1 });

module.exports = mongoose.model("ChatConversation", chatConversationSchema);
