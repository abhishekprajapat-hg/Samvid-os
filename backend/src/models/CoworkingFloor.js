const mongoose = require("mongoose");
const { FLOOR_STATUSES } = require("../constants/coworking.constants");

const coworkingFloorSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Company",
      index: true,
    },
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "CoworkingProperty",
      index: true,
    },
    floorNumber: {
      type: Number,
      required: true,
    },
    name: {
      type: String,
      trim: true,
      default: "",
      maxlength: 120,
    },
    status: {
      type: String,
      enum: FLOOR_STATUSES,
      default: "ACTIVE",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true },
);

coworkingFloorSchema.index({ companyId: 1, propertyId: 1, floorNumber: 1 }, { unique: true });

module.exports = mongoose.model("CoworkingFloor", coworkingFloorSchema);
