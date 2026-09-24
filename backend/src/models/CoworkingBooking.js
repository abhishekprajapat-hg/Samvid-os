const mongoose = require("mongoose");
const {
  BOOKING_STATUSES,
  BOOKING_TYPES,
  RECURRENCE_PATTERNS,
  TIME_PATTERN,
} = require("../constants/booking.constants");

const coworkingBookingSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Company",
      index: true,
    },
    bookingCode: {
      type: String,
      required: true,
      trim: true,
    },
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "CoworkingClient",
      index: true,
    },
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "CoworkingProperty",
    },
    floorId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "CoworkingFloor",
    },
    cabinId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "CoworkingCabin",
      index: true,
    },
    // Present for SEAT bookings, absent for CABIN (whole-cabin) bookings —
    // stored as the seatCode string since seats are embedded subdocuments
    // on Cabin, not a separately addressable collection.
    seatCode: {
      type: String,
      trim: true,
      default: "",
    },
    bookingType: {
      type: String,
      enum: BOOKING_TYPES,
      required: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    startTime: {
      type: String,
      trim: true,
      default: "",
    },
    endTime: {
      type: String,
      trim: true,
      default: "",
    },
    price: {
      type: Number,
      default: 0,
      min: 0,
    },
    deposit: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: BOOKING_STATUSES,
      default: "PENDING",
    },
    notes: {
      type: String,
      trim: true,
      default: "",
      maxlength: 2000,
    },
    isRecurring: {
      type: Boolean,
      default: false,
    },
    recurrencePattern: {
      type: String,
      enum: RECURRENCE_PATTERNS,
      default: "NONE",
    },
    recurrenceGroupId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    recurrenceEndDate: {
      type: Date,
      default: null,
    },
    cancelledAt: { type: Date, default: null },
    cancelledReason: { type: String, trim: true, default: "", maxlength: 500 },
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

coworkingBookingSchema.index({ companyId: 1, bookingCode: 1 }, { unique: true });
coworkingBookingSchema.index({ companyId: 1, cabinId: 1, seatCode: 1, status: 1, startDate: 1, endDate: 1 });
coworkingBookingSchema.index({ companyId: 1, clientId: 1, status: 1, createdAt: -1 });
coworkingBookingSchema.index({ companyId: 1, status: 1, startDate: 1 });

coworkingBookingSchema.pre("validate", function enforceBookingInvariants() {
  if (this.bookingType === "SEAT" && !this.seatCode) {
    this.invalidate("seatCode", "seatCode is required for a SEAT booking");
  }
  if (this.bookingType === "CABIN" && this.seatCode) {
    this.invalidate("seatCode", "seatCode must be empty for a CABIN (whole-cabin) booking");
  }

  if (this.startDate && this.endDate && this.endDate < this.startDate) {
    this.invalidate("endDate", "endDate cannot be before startDate");
  }

  if (this.startTime && !TIME_PATTERN.test(this.startTime)) {
    this.invalidate("startTime", "startTime must be in HH:MM 24-hour format");
  }
  if (this.endTime && !TIME_PATTERN.test(this.endTime)) {
    this.invalidate("endTime", "endTime must be in HH:MM 24-hour format");
  }
  if (
    this.startTime &&
    this.endTime &&
    this.startDate &&
    this.endDate &&
    this.startDate.getTime() === this.endDate.getTime() &&
    this.endTime <= this.startTime
  ) {
    this.invalidate("endTime", "endTime must be after startTime for a same-day booking");
  }

  if (this.isRecurring && this.recurrencePattern === "NONE") {
    this.invalidate("recurrencePattern", "recurrencePattern is required when isRecurring is true");
  }
});

module.exports = mongoose.model("CoworkingBooking", coworkingBookingSchema);
