const mongoose = require("mongoose");

const SUBSCRIPTION_STATUSES = ["TRIAL", "ACTIVE", "PAST_DUE", "CANCELED", "EXPIRED"];
const BILLING_CYCLES = ["MONTHLY", "YEARLY"];

const tenantSubscriptionSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubscriptionPlan",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: SUBSCRIPTION_STATUSES,
      default: "TRIAL",
      index: true,
    },
    billingCycle: {
      type: String,
      enum: BILLING_CYCLES,
      default: "MONTHLY",
    },
    seats: {
      type: Number,
      default: 5,
      min: 1,
    },
    isCurrent: {
      type: Boolean,
      default: true,
      index: true,
    },
    startsAt: {
      type: Date,
      default: Date.now,
    },
    endsAt: {
      type: Date,
      default: null,
    },
    trialEndsAt: {
      type: Date,
      default: null,
    },
    nextBillingAt: {
      type: Date,
      default: null,
    },
    autoRenew: {
      type: Boolean,
      default: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true },
);

tenantSubscriptionSchema.index({ companyId: 1, isCurrent: 1 });
tenantSubscriptionSchema.index(
  { companyId: 1, isCurrent: 1 },
  {
    unique: true,
    partialFilterExpression: { isCurrent: true },
  },
);

module.exports = mongoose.model("TenantSubscription", tenantSubscriptionSchema);

