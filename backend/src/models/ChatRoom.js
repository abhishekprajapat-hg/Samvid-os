const mongoose = require("mongoose");
const {
  CHAT_ROOM_TYPES,
  BROADCAST_TARGET_ROLES,
} = require("../constants/chat.constants");

const unreadCountSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    count: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: false },
);

const userClearedAtSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    at: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false },
);

const escalationSchema = new mongoose.Schema(
  {
    isEscalation: {
      type: Boolean,
      default: false,
    },
    escalatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    managerToNotify: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    managerNotifiedAt: {
      type: Date,
      default: null,
    },
    escalatedAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false },
);

const broadcastTargetSchema = new mongoose.Schema(
  {
    targetRole: {
      type: String,
      enum: [...Object.values(BROADCAST_TARGET_ROLES), null],
      default: null,
    },
    targetTeamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { _id: false },
);

const chatRoomSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: Object.values(CHAT_ROOM_TYPES),
      required: true,
      index: true,
    },
    name: {
      type: String,
      trim: true,
      default: "",
      maxlength: 120,
    },
    participants: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
      ],
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
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    directKey: {
      type: String,
      trim: true,
      default: null,
      unique: true,
      sparse: true,
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
    unreadCounts: {
      type: [unreadCountSchema],
      default: [],
    },
    clearedMessagesAt: {
      type: [userClearedAtSchema],
      default: [],
    },
    clearedCallsAt: {
      type: [userClearedAtSchema],
      default: [],
    },
    escalation: {
      type: escalationSchema,
      default: () => ({}),
    },
    broadcastTarget: {
      type: broadcastTargetSchema,
      default: () => ({}),
    },
  },
  { timestamps: true },
);

chatRoomSchema.index({ participants: 1, lastMessageAt: -1 });
chatRoomSchema.index({ type: 1, lastMessageAt: -1 });
chatRoomSchema.index({ leadId: 1, type: 1 });

chatRoomSchema.path("participants").validate(function validateParticipants(value) {
  if (!Array.isArray(value) || value.length < 1) return false;

  if (
    [CHAT_ROOM_TYPES.DIRECT, CHAT_ROOM_TYPES.ESCALATION].includes(this.type)
    && value.length !== 2
  ) {
    return false;
  }

  if (this.type === CHAT_ROOM_TYPES.LEAD && !this.leadId) {
    return false;
  }

  return true;
}, "Invalid participants/lead configuration for room type");

module.exports = mongoose.model("ChatRoom", chatRoomSchema);
