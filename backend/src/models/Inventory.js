const mongoose = require("mongoose");
const {
  INVENTORY_STATUSES,
  INVENTORY_TYPES,
  INVENTORY_SALE_PAYMENT_MODES,
  INVENTORY_SALE_PAYMENT_TYPES,
} = require("../constants/inventory.constants");

const MAX_SALE_PAYMENT_NOTE_LENGTH = 1000;
const MAX_SALE_PAYMENT_REFERENCE_LENGTH = 120;

const saleDetailsSchema = new mongoose.Schema(
  {
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lead",
      default: null,
      index: true,
    },
    paymentMode: {
      type: String,
      enum: INVENTORY_SALE_PAYMENT_MODES,
      default: "",
      trim: true,
    },
    paymentType: {
      type: String,
      enum: INVENTORY_SALE_PAYMENT_TYPES,
      default: "",
      trim: true,
    },
    totalAmount: {
      type: Number,
      min: 0,
      default: null,
    },
    remainingAmount: {
      type: Number,
      min: 0,
      default: null,
    },
    paymentReference: {
      type: String,
      trim: true,
      default: "",
      maxlength: MAX_SALE_PAYMENT_REFERENCE_LENGTH,
    },
    note: {
      type: String,
      trim: true,
      default: "",
      maxlength: MAX_SALE_PAYMENT_NOTE_LENGTH,
    },
    soldAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false },
);

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
    saleDetails: {
      type: saleDetailsSchema,
      default: null,
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

inventorySchema.pre("validate", function enforceStatusDetails() {
  const cleanReason = String(this.reservationReason || "").trim();
  const enforceReasonCheck =
    this.isNew || this.isModified("status") || this.isModified("reservationReason");
  const saleDetails = this.saleDetails || null;

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

  if (this.status !== "Sold") {
    if (saleDetails) {
      this.saleDetails = null;
    }
    return;
  }

  const leadId = saleDetails?.leadId || null;
  const paymentMode = String(saleDetails?.paymentMode || "").trim().toUpperCase();
  const paymentType = String(saleDetails?.paymentType || "").trim().toUpperCase();
  const totalAmount = Number(saleDetails?.totalAmount);
  const remainingAmountRaw = saleDetails?.remainingAmount;
  const remainingAmount =
    remainingAmountRaw === null || remainingAmountRaw === undefined || remainingAmountRaw === ""
      ? null
      : Number(remainingAmountRaw);
  const paymentReference = String(saleDetails?.paymentReference || "").trim();
  const note = String(saleDetails?.note || "").trim();

  if (!leadId) {
    this.invalidate("saleDetails.leadId", "Lead is required when status is Sold");
  }

  if (!paymentMode || !INVENTORY_SALE_PAYMENT_MODES.includes(paymentMode)) {
    this.invalidate(
      "saleDetails.paymentMode",
      `paymentMode must be one of: ${INVENTORY_SALE_PAYMENT_MODES.join(", ")}`,
    );
  }

  if (!paymentType || !INVENTORY_SALE_PAYMENT_TYPES.includes(paymentType)) {
    this.invalidate(
      "saleDetails.paymentType",
      `paymentType must be one of: ${INVENTORY_SALE_PAYMENT_TYPES.join(", ")}`,
    );
  }

  if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
    this.invalidate("saleDetails.totalAmount", "totalAmount must be greater than 0");
  }

  if (paymentType === "PARTIAL") {
    if (!Number.isFinite(remainingAmount) || remainingAmount <= 0) {
      this.invalidate(
        "saleDetails.remainingAmount",
        "remainingAmount must be greater than 0 for partial payment",
      );
    }
  } else if (remainingAmount !== null && (!Number.isFinite(remainingAmount) || remainingAmount < 0)) {
    this.invalidate("saleDetails.remainingAmount", "remainingAmount must be a valid number");
  }

  if (paymentMode && paymentMode !== "CASH" && !paymentReference) {
    this.invalidate(
      "saleDetails.paymentReference",
      "paymentReference is required for non-cash sold payments",
    );
  }

  if (note.length > MAX_SALE_PAYMENT_NOTE_LENGTH) {
    this.invalidate(
      "saleDetails.note",
      `note cannot exceed ${MAX_SALE_PAYMENT_NOTE_LENGTH} characters`,
    );
  }

  if (this.saleDetails) {
    this.saleDetails.paymentMode = paymentMode;
    this.saleDetails.paymentType = paymentType;
    this.saleDetails.totalAmount = Number.isFinite(totalAmount) ? totalAmount : null;
    this.saleDetails.remainingAmount =
      paymentType === "PARTIAL"
        ? (Number.isFinite(remainingAmount) ? remainingAmount : null)
        : 0;
    this.saleDetails.paymentReference = paymentMode === "CASH" ? "" : paymentReference;
    this.saleDetails.note = note;
    this.saleDetails.soldAt = this.saleDetails.soldAt || new Date();
  }
});

module.exports = mongoose.model("Inventory", inventorySchema);
