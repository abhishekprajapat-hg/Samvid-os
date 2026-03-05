const mongoose = require("mongoose");

const leadDiarySchema = new mongoose.Schema(
  {
    lead: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lead",
      required: true,
    },
    note: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },
    conversation: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },
    visitDetails: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },
    nextStep: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },
    conversionDetails: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },
    voiceNoteUrl: {
      type: String,
      trim: true,
      default: "",
    },
    voiceNoteName: {
      type: String,
      trim: true,
      default: "",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    isEdited: {
      type: Boolean,
      default: false,
    },
    lastEditedAt: {
      type: Date,
      default: null,
    },
    lastEditedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    editHistory: [
      {
        previousNote: {
          type: String,
          trim: true,
          maxlength: 2000,
          default: "",
        },
        updatedNote: {
          type: String,
          trim: true,
          maxlength: 2000,
          default: "",
        },
        editedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          default: null,
        },
        editedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  { timestamps: true },
);

leadDiarySchema.index({ lead: 1, createdAt: -1 });

module.exports = mongoose.model("LeadDiary", leadDiarySchema);
