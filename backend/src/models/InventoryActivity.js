const mongoose = require("mongoose");

const inventoryActivitySchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Company",
      index: true,
    },
    inventoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Inventory",
      required: true,
      index: true,
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    role: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    actionType: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    oldValue: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    newValue: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    requestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InventoryRequest",
      default: null,
      index: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { versionKey: false },
);

inventoryActivitySchema.index({ companyId: 1, inventoryId: 1, timestamp: -1 });

module.exports = mongoose.model("InventoryActivity", inventoryActivitySchema);
