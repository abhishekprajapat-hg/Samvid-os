const mongoose = require("mongoose");

const coworkingIdCounterSchema = new mongoose.Schema(
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
      enum: ["PROPERTY", "CABIN", "CLIENT", "BOOKING", "CONTRACT", "INVOICE", "PAYMENT", "EXPENSE"],
    },
    seq: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true },
);

coworkingIdCounterSchema.index({ companyId: 1, category: 1 }, { unique: true });

module.exports = mongoose.model("CoworkingIdCounter", coworkingIdCounterSchema);
