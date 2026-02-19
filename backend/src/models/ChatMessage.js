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

const sharedPropertySchema = new mongoose.Schema(
  {
    inventoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Inventory",
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    projectName: {
      type: String,
      trim: true,
      default: "",
      maxlength: 120,
    },
    towerName: {
      type: String,
      trim: true,
      default: "",
      maxlength: 120,
    },
    unitNumber: {
      type: String,
      trim: true,
      default: "",
      maxlength: 80,
    },
    location: {
      type: String,
      trim: true,
      default: "",
      maxlength: 240,
    },
    price: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      trim: true,
      default: "",
      maxlength: 40,
    },
    image: {
      type: String,
      trim: true,
      default: "",
      maxlength: 2048,
    },
  },
  { _id: false },
);

const mediaAttachmentSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2048,
    },
    kind: {
      type: String,
      enum: ["image", "video", "audio", "file"],
      default: "file",
    },
    mimeType: {
      type: String,
      trim: true,
      default: "",
      maxlength: 120,
    },
    name: {
      type: String,
      trim: true,
      default: "",
      maxlength: 180,
    },
    size: {
      type: Number,
      min: 0,
      default: 0,
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
    sharedProperty: {
      type: sharedPropertySchema,
      default: null,
    },
    mediaAttachments: {
      type: [mediaAttachmentSchema],
      default: [],
    },
  },
  { timestamps: true },
);

chatMessageSchema.index({ room: 1, createdAt: -1 });

module.exports = mongoose.model("ChatMessage", chatMessageSchema);
