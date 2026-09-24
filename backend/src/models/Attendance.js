const mongoose = require("mongoose");

const ATTENDANCE_DATE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

const ATTENDANCE_STATUS = Object.freeze({
  PENDING: "PENDING",
  PRESENT: "PRESENT",
  LATE: "LATE",
  HALF_DAY: "HALF_DAY",
  LEAVE: "LEAVE",
  MISSED_CHECK_OUT: "MISSED_CHECK_OUT",
  ABSENT: "ABSENT",
});

const ATTENDANCE_SOURCE = Object.freeze({
  WEB: "WEB",
  MOBILE: "MOBILE",
  KIOSK: "KIOSK",
  MANUAL: "MANUAL",
});

const attendanceLocationSchema = new mongoose.Schema(
  {
    latitude: {
      type: Number,
      min: -90,
      max: 90,
      default: null,
    },
    longitude: {
      type: Number,
      min: -180,
      max: 180,
      default: null,
    },
    accuracy: {
      type: Number,
      min: 0,
      default: null,
    },
    distanceMeters: {
      type: Number,
      min: 0,
      default: null,
    },
    effectiveDistanceMeters: {
      type: Number,
      min: 0,
      default: null,
    },
    accuracyBufferMeters: {
      type: Number,
      min: 0,
      default: null,
    },
  },
  { _id: false },
);

const breakSessionSchema = new mongoose.Schema(
  {
    correctedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    correctedByName: { type: String, default: "" },
    correctedByRole: { type: String, default: "" },
    correctedAt: { type: Date, default: null },
    correctionReason: { type: String, maxlength: 240, default: "" },
    startAt: {
      type: Date,
      required: true,
    },
    endAt: {
      type: Date,
      default: null,
    },
    durationMinutes: {
      type: Number,
      min: 0,
      default: 0,
    },
    breakType: { type: String, enum: ["LUNCH", "TEA", "COFFEE", "UTILITY"], default: "UTILITY" },
    expectedMinutes: { type: Number, default: null },
    startNote: {
      type: String,
      trim: true,
      maxlength: 240,
      default: "",
    },
    endNote: {
      type: String,
      trim: true,
      maxlength: 240,
      default: "",
    },
  },
  { _id: false },
);

const attendanceSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    attendanceDate: {
      type: String,
      required: true,
      match: ATTENDANCE_DATE_PATTERN,
      index: true,
    },
    checkInAt: {
      type: Date,
      default: null,
    },
    checkOutAt: {
      type: Date,
      default: null,
    },
    checkInLocation: {
      type: attendanceLocationSchema,
      default: null,
    },
    checkOutLocation: {
      type: attendanceLocationSchema,
      default: null,
    },
    workedMinutes: {
      type: Number,
      min: 0,
      default: 0,
    },
    totalBreakMinutes: {
      type: Number,
      min: 0,
      default: 0,
    },
    breakSessions: {
      type: [breakSessionSchema],
      default: [],
    },
    breakAudit: {
      type: [new mongoose.Schema({
        actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        actorName: String,
        actorRole: String,
        changedAt: { type: Date, required: true },
        reason: { type: String, required: true, maxlength: 240 },
        sessionIndex: Number,
        before: { type: breakSessionSchema, default: null },
        after: { type: breakSessionSchema, required: true },
      }, { _id: false })],
      default: [],
    },
    status: {
      type: String,
      enum: Object.values(ATTENDANCE_STATUS),
      default: ATTENDANCE_STATUS.PENDING,
      index: true,
    },
    source: {
      type: String,
      enum: Object.values(ATTENDANCE_SOURCE),
      default: ATTENDANCE_SOURCE.WEB,
    },
    checkInNote: {
      type: String,
      trim: true,
      maxlength: 240,
      default: "",
    },
    checkOutNote: {
      type: String,
      trim: true,
      maxlength: 240,
      default: "",
    },
    metadata: {
      checkInIp: {
        type: String,
        trim: true,
        default: "",
      },
      checkOutIp: {
        type: String,
        trim: true,
        default: "",
      },
      checkInUserAgent: {
        type: String,
        trim: true,
        default: "",
      },
      checkOutUserAgent: {
        type: String,
        trim: true,
        default: "",
      },
      manualStatusBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      manualStatusAt: {
        type: Date,
        default: null,
      },
      manualStatusNote: {
        type: String,
        trim: true,
        maxlength: 240,
        default: "",
      },
      autoCheckOutAt: {
        type: Date,
        default: null,
      },
      autoCheckOutReason: {
        type: String,
        trim: true,
        maxlength: 120,
        default: "",
      },
    },
  },
  { timestamps: true },
);

attendanceSchema.index(
  { companyId: 1, userId: 1, attendanceDate: 1 },
  { unique: true },
);
attendanceSchema.index({ companyId: 1, attendanceDate: 1, status: 1 });
attendanceSchema.index({ companyId: 1, attendanceDate: 1, userId: 1 });

const Attendance = mongoose.model("Attendance", attendanceSchema);

module.exports = Attendance;
module.exports.ATTENDANCE_STATUS = ATTENDANCE_STATUS;
module.exports.ATTENDANCE_SOURCE = ATTENDANCE_SOURCE;
