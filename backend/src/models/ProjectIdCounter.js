const mongoose = require("mongoose");

const projectIdCounterSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Company",
      index: true,
    },
    category: {
      type: String,
      required: true,
      enum: ["COMMERCIAL", "RESIDENTIAL"],
    },
    seq: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true },
);

projectIdCounterSchema.index({ companyId: 1, category: 1 }, { unique: true });

module.exports = mongoose.model("ProjectIdCounter", projectIdCounterSchema);
