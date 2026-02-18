const mongoose = require("mongoose");

const inventoryAssetSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    location: {
      type: String,
      default: "",
      trim: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    type: {
      type: String,
      enum: ["Sale", "Rent"],
      default: "Sale",
    },
    category: {
      type: String,
      enum: ["Apartment", "Villa", "Office", "Plot"],
      default: "Apartment",
    },
    status: {
      type: String,
      enum: ["Available", "Reserved", "Sold", "Rented"],
      default: "Available",
    },
    images: {
      type: [String],
      default: [],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true },
);

inventoryAssetSchema.index({ type: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model("InventoryAsset", inventoryAssetSchema);
