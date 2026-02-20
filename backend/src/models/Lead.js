const mongoose = require("mongoose");

const leadSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    phone: { type: String, required: true, index: true },
    email: String,
    city: String,
    projectInterested: String,

    source: {
      type: String,
      enum: ["META", "MANUAL"],
      required: true
    },

    status: {
      type: String,
      enum: [
        "NEW",
        "CONTACTED",
        "INTERESTED",
        "SITE_VISIT",
        "CLOSED",
        "LOST"
      ],
      default: "NEW"
    },

    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },

    assignedManager: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true
    },

    assignedExecutive: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true
    },

    assignedFieldExecutive: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },

    // 🔥 NEW FIELDS
    nextFollowUp: {
      type: Date,
      default: null
    },

    lastContactedAt: {
      type: Date,
      default: null
    }

  },
  { timestamps: true }
);

leadSchema.index({ createdAt: -1 });
leadSchema.index({ createdBy: 1, createdAt: -1 });
leadSchema.index({ assignedTo: 1, createdAt: -1 });
leadSchema.index({ assignedManager: 1, createdAt: -1 });
leadSchema.index({ assignedExecutive: 1, createdAt: -1 });
leadSchema.index({ assignedFieldExecutive: 1, createdAt: -1 });
leadSchema.index({ nextFollowUp: 1, assignedTo: 1 });

module.exports = mongoose.model("Lead", leadSchema);
