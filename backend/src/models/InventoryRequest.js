const mongoose = require("mongoose");
const { INVENTORY_REQUEST_STATUSES } = require("../constants/inventory.constants");

const inventoryRequestSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Company",
      index: true,
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["create", "update"],
      default: "create",
      required: true,
      index: true,
    },
    proposedData: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      default: {},
    },
    // Legacy field kept for backward compatibility.
    proposedChanges: {
      type: mongoose.Schema.Types.Mixed,
      default: undefined,
    },
    status: {
      type: String,
      enum: INVENTORY_REQUEST_STATUSES,
      default: "pending",
      index: true,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    rejectionReason: {
      type: String,
      trim: true,
      default: "",
      maxlength: 500,
    },
    managerPreApprovedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    managerPreApprovedAt: {
      type: Date,
      default: null,
    },
    // Optional team visibility for managers under the same company.
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    inventoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Inventory",
      default: null,
      index: true,
    },
  },
  { timestamps: true },
);

inventoryRequestSchema.index({ status: 1, companyId: 1, createdAt: -1 });
inventoryRequestSchema.index({ companyId: 1, requestedBy: 1, createdAt: -1 });

inventoryRequestSchema.pre("validate", function syncLegacyProposedFields() {
  if (!this.proposedData && this.proposedChanges) {
    this.proposedData = this.proposedChanges;
  }

  if (!this.proposedChanges && this.proposedData) {
    this.proposedChanges = this.proposedData;
  }
});

inventoryRequestSchema.set("toJSON", { virtuals: true });
inventoryRequestSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("InventoryRequest", inventoryRequestSchema);
