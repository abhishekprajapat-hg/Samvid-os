const mongoose = require("mongoose");

const subscriptionPlanSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      maxlength: 40,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },
    pricing: {
      currency: { type: String, default: "USD", trim: true, uppercase: true },
      monthly: { type: Number, default: 0, min: 0 },
      yearly: { type: Number, default: 0, min: 0 },
    },
    limits: {
      users: { type: Number, default: 0, min: 0 },
      leads: { type: Number, default: 0, min: 0 },
      inventory: { type: Number, default: 0, min: 0 },
      apiRequestsPerDay: { type: Number, default: 0, min: 0 },
      storageMb: { type: Number, default: 0, min: 0 },
    },
    features: {
      type: [String],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true },
);

subscriptionPlanSchema.index({ isActive: 1, updatedAt: -1 });

module.exports = mongoose.model("SubscriptionPlan", subscriptionPlanSchema);

