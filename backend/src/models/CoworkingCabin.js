const mongoose = require("mongoose");
const {
  CABIN_STATUSES,
  CABIN_MANUAL_OVERRIDES,
  SEAT_STATUSES,
  CABIN_TYPES,
  CABIN_AMENITIES,
  MIN_CABIN_CAPACITY,
  MAX_CABIN_CAPACITY,
} = require("../constants/coworking.constants");
const { deriveCabinStatus } = require("../services/coworkingOccupancy.service");

const seatAssignmentSchema = new mongoose.Schema(
  {
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: "CoworkingClient", default: null },
    // Denormalized snapshot of the client's companyName at assignment time,
    // so seat/cabin lists can render an occupant name without a join. The
    // client relationship (clientId) is always the source of truth.
    label: { type: String, trim: true, default: "", maxlength: 120 },
    assignedAt: { type: Date, default: null },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { _id: false },
);

const seatSchema = new mongoose.Schema(
  {
    seatCode: { type: String, required: true, trim: true },
    seatNumber: { type: Number, required: true, min: 1 },
    status: { type: String, enum: SEAT_STATUSES, default: "AVAILABLE" },
    assignedTo: { type: seatAssignmentSchema, default: null },
  },
  { _id: false },
);

const coworkingCabinSchema = new mongoose.Schema(
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
    floorId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "CoworkingFloor",
      index: true,
    },
    cabinCode: {
      type: String,
      required: true,
      trim: true,
    },
    name: {
      type: String,
      trim: true,
      default: "",
      maxlength: 120,
    },
    cabinType: {
      type: String,
      enum: CABIN_TYPES,
      default: "PRIVATE",
    },
    capacityPreset: {
      type: mongoose.Schema.Types.Mixed, // Number (4/6/8/10/12) or the string "CUSTOM"
      required: true,
    },
    capacity: {
      type: Number,
      required: true,
      min: MIN_CABIN_CAPACITY,
      max: MAX_CABIN_CAPACITY,
    },
    monthlyRent: {
      type: Number,
      default: 0,
      min: 0,
    },
    securityDeposit: {
      type: Number,
      default: 0,
      min: 0,
    },
    description: {
      type: String,
      trim: true,
      default: "",
      maxlength: 2000,
    },
    amenities: {
      type: [{ type: String, enum: CABIN_AMENITIES }],
      default: [],
    },
    // Manual override an operator sets explicitly; `status` below is always
    // derived from this + seats (see coworkingOccupancy.service.js) — never
    // written to directly outside that service.
    manualOverride: {
      type: String,
      enum: CABIN_MANUAL_OVERRIDES,
      default: "NONE",
    },
    blockReason: {
      type: String,
      trim: true,
      default: "",
      maxlength: 500,
    },
    status: {
      type: String,
      enum: CABIN_STATUSES,
      default: "AVAILABLE",
    },
    seats: {
      type: [seatSchema],
      default: [],
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

coworkingCabinSchema.index({ companyId: 1, cabinCode: 1 }, { unique: true });
coworkingCabinSchema.index({ companyId: 1, propertyId: 1, floorId: 1 });
coworkingCabinSchema.index({ companyId: 1, status: 1 });

coworkingCabinSchema.pre("validate", function enforceCabinInvariants() {
  const seatCodes = new Set();
  for (const seat of this.seats) {
    if (seatCodes.has(seat.seatCode)) {
      this.invalidate("seats", `Duplicate seat code detected: ${seat.seatCode}`);
      break;
    }
    seatCodes.add(seat.seatCode);
  }

  if (this.capacity !== this.seats.length && this.isNew) {
    this.invalidate("capacity", "capacity must match the number of generated seats");
  }

  // Status is always re-derived on save, so it can never drift from seat
  // state even if something upstream set it directly.
  this.status = deriveCabinStatus(this.manualOverride, this.seats);
});

module.exports = mongoose.model("CoworkingCabin", coworkingCabinSchema);
