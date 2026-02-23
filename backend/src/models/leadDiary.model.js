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
      required: true,
      trim: true,
      maxlength: 2000,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true },
);

leadDiarySchema.index({ lead: 1, createdAt: -1 });

module.exports = mongoose.model("LeadDiary", leadDiarySchema);
