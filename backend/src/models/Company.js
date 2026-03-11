const mongoose = require("mongoose");

const COMPANY_STATUSES = ["ACTIVE", "SUSPENDED", "ARCHIVED"];

const companySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    legalName: {
      type: String,
      default: "",
      trim: true,
      maxlength: 180,
    },
    subdomain: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      match: /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/,
    },
    customDomain: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
    },
    status: {
      type: String,
      enum: COMPANY_STATUSES,
      default: "ACTIVE",
      index: true,
    },
    ownerUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    settings: {
      timezone: { type: String, default: "UTC", trim: true },
      locale: { type: String, default: "en-US", trim: true },
      currency: { type: String, default: "USD", trim: true },
      dateFormat: { type: String, default: "DD/MM/YYYY", trim: true },
      branding: {
        primaryColor: { type: String, default: "#0f172a", trim: true },
        logoUrl: { type: String, default: "", trim: true },
      },
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true },
);

companySchema.index(
  { customDomain: 1 },
  {
    unique: true,
    sparse: true,
    partialFilterExpression: { customDomain: { $type: "string", $ne: "" } },
  },
);
companySchema.index({ status: 1, updatedAt: -1 });

module.exports = mongoose.model("Company", companySchema);

