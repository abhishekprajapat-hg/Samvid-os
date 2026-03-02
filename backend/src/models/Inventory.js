const mongoose = require("mongoose");
const { INVENTORY_STATUSES, INVENTORY_TYPES } = require("../constants/inventory.constants");

const inventorySchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Company",
      index: true,
    },
    projectName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    towerName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    unitNumber: {
      type: String,
      required: true,
      trim: true,
      maxlength: 60,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    type: {
      type: String,
      enum: INVENTORY_TYPES,
      default: "Sale",
      index: true,
    },
    category: {
      type: String,
      default: "Apartment",
      trim: true,
      maxlength: 120,
    },
    status: {
      type: String,
      enum: INVENTORY_STATUSES,
      default: "Available",
      index: true,
    },
    reservationReason: {
      type: String,
      trim: true,
      default: "",
      maxlength: 300,
    },
    location: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    siteLocation: {
      lat: {
        type: Number,
        default: null,
      },
      lng: {
        type: Number,
        default: null,
      },
    },
    images: {
      type: [String],
      default: [],
    },
    documents: {
      type: [String],
      default: [],
    },
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true },
);

inventorySchema.index(
  { companyId: 1, projectName: 1, towerName: 1, unitNumber: 1 },
  { unique: true },
);
inventorySchema.index({ companyId: 1, status: 1, updatedAt: -1 });
inventorySchema.index({ companyId: 1, teamId: 1, updatedAt: -1 });

inventorySchema.pre("validate", function enforceReservationReason() {
  const cleanReason = String(this.reservationReason || "").trim();
  const enforceReasonCheck =
    this.isNew || this.isModified("status") || this.isModified("reservationReason");

  if (enforceReasonCheck && this.status === "Blocked" && !cleanReason) {
    this.invalidate(
      "reservationReason",
      "reservationReason is required when status is Reserved",
    );
  }

  if (this.status !== "Blocked" && cleanReason) {
    this.reservationReason = "";
  } else if (this.status === "Blocked") {
    this.reservationReason = cleanReason;
  }
});

module.exports = mongoose.model("Inventory", inventorySchema);
