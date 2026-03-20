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

const commercialDetailsSchema = new mongoose.Schema(
  {
    officeType: {
      type: String,
      enum: [
        "BARE_SHELL",
        "WARM_SHELL",
        "SEMI_FURNISHED",
        "FULLY_FURNISHED",
        "MANAGED_OFFICE",
        "COWORKING",
      ],
      default: "",
      trim: true,
    },
    officeLayout: {
      totalCabins: { type: Number, default: null, min: 0 },
      workstations: { type: Number, default: null, min: 0 },
      seats: { type: Number, default: null, min: 0 },
      conferenceRooms: { type: Number, default: null, min: 0 },
      meetingRooms: { type: Number, default: null, min: 0 },
      receptionArea: { type: Boolean, default: false },
      waitingArea: { type: Boolean, default: false },
    },
    amenities: {
      pantry: { type: Boolean, default: false },
      cafeteria: { type: Boolean, default: false },
      washroomType: {
        type: String,
        enum: ["ATTACHED", "COMMON", "BOTH", ""],
        default: "",
        trim: true,
      },
      serverRoom: { type: Boolean, default: false },
      storageRoom: { type: Boolean, default: false },
      breakoutArea: { type: Boolean, default: false },
      liftAvailable: { type: Boolean, default: false },
      powerBackup: { type: Boolean, default: false },
      centralAC: { type: Boolean, default: false },
    },
    buildingDetails: {
      totalFloors: { type: Number, default: null, min: 0 },
      parkingType: {
        type: String,
        enum: ["COVERED", "OPEN", "BOTH", "NONE", ""],
        default: "",
        trim: true,
      },
      parkingSlots: { type: Number, default: null, min: 0 },
      securityType: {
        type: String,
        enum: ["SECURITY_24X7", "CCTV", "BOTH", "NONE", ""],
        default: "",
        trim: true,
      },
      fireSafety: { type: Boolean, default: false },
    },
    availability: {
      readyToMove: { type: Boolean, default: false },
      underConstruction: { type: Boolean, default: false },
      availableFrom: { type: Date, default: null },
    },
  },
  { _id: false },
);

const residentialDetailsSchema = new mongoose.Schema(
  {
    propertyType: {
      type: String,
      enum: ["FLAT", "VILLA", "BUILDER_FLOOR", "PLOT", "OTHER", ""],
      default: "",
      trim: true,
    },
    bhkType: {
      type: String,
      enum: ["1BHK", "2BHK", "3BHK", "4BHK", "5BHK", "STUDIO", "OTHER", ""],
      default: "",
      trim: true,
    },
    bedrooms: { type: Number, default: null, min: 0 },
    bathrooms: { type: Number, default: null, min: 0 },
    balcony: { type: Number, default: null, min: 0 },
    studyRoom: { type: Boolean, default: false },
    servantRoom: { type: Boolean, default: false },
    parking: { type: Number, default: null, min: 0 },
    amenities: {
      modularKitchen: { type: Boolean, default: false },
      lift: { type: Boolean, default: false },
      security: { type: Boolean, default: false },
      powerBackup: { type: Boolean, default: false },
      gym: { type: Boolean, default: false },
      swimmingPool: { type: Boolean, default: false },
      clubhouse: { type: Boolean, default: false },
    },
    utilities: {
      waterSupply: {
        type: String,
        enum: ["MUNICIPAL", "BOREWELL", "TANKER", "BOTH", "OTHER", ""],
        default: "",
        trim: true,
      },
      electricityBackup: { type: Boolean, default: false },
      gasPipeline: { type: Boolean, default: false },
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
    propertyId: {
      type: String,
      trim: true,
      maxlength: 80,
      default: "",
      index: true,
    },
    inventoryType: {
      type: String,
      enum: ["COMMERCIAL", "RESIDENTIAL"],
      default: "COMMERCIAL",
      index: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    deposit: {
      type: Number,
      default: null,
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
    furnishingStatus: {
      type: String,
      enum: [
        "UNFURNISHED",
        "SEMI_FURNISHED",
        "FULLY_FURNISHED",
        "BARE_SHELL",
        "WARM_SHELL",
        "MANAGED_OFFICE",
        "COWORKING",
        "",
      ],
      default: "",
      trim: true,
      index: true,
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
    reservationLeadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lead",
      default: null,
      index: true,
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
    city: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
      index: true,
    },
    area: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
      index: true,
    },
    pincode: {
      type: String,
      default: "",
      trim: true,
      maxlength: 20,
      index: true,
    },
    buildingName: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
    },
    floorNumber: {
      type: Number,
      default: null,
    },
    totalFloors: {
      type: Number,
      default: null,
      min: 0,
    },
    totalArea: {
      type: Number,
      default: null,
      min: 0,
      index: true,
    },
    carpetArea: {
      type: Number,
      default: null,
      min: 0,
    },
    builtUpArea: {
      type: Number,
      default: null,
      min: 0,
    },
    areaUnit: {
      type: String,
      enum: ["SQ_FT", "SQ_M"],
      default: "SQ_FT",
    },
    maintenanceCharges: {
      type: Number,
      default: null,
      min: 0,
    },
    commercialDetails: {
      type: commercialDetailsSchema,
      default: undefined,
    },
    residentialDetails: {
      type: residentialDetailsSchema,
      default: undefined,
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
    floorPlans: {
      type: [String],
      default: [],
    },
    videoTours: {
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
inventorySchema.index({ companyId: 1, inventoryType: 1, status: 1, updatedAt: -1 });
inventorySchema.index({ companyId: 1, furnishingStatus: 1, updatedAt: -1 });

inventorySchema.pre("validate", function enforceStatusDetails() {
  const cleanReason = String(this.reservationReason || "").trim();
  const reservationLeadId = this.reservationLeadId || null;
  const enforceReasonCheck =
    this.isNew || this.isModified("status") || this.isModified("reservationReason") || this.isModified("reservationLeadId");
  const saleDetails = this.saleDetails || null;

  if (enforceReasonCheck && this.status === "Blocked" && !cleanReason) {
    this.invalidate(
      "reservationReason",
      "reservationReason is required when status is Reserved",
    );
  }
  if (enforceReasonCheck && this.status === "Blocked" && !reservationLeadId) {
    this.invalidate(
      "reservationLeadId",
      "Lead is required when status is Reserved",
    );
  }

  if (this.status !== "Blocked" && cleanReason) {
    this.reservationReason = "";
  } else if (this.status === "Blocked") {
    this.reservationReason = cleanReason;
  }

  if (this.status !== "Blocked" && reservationLeadId) {
    this.reservationLeadId = null;
  }

  if (this.status !== "Sold") {
    if (saleDetails) {
      this.saleDetails = null;
    }
  } else {
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
  }

  if (this.type !== "Rent" && this.deposit !== null && this.deposit !== undefined) {
    this.deposit = null;
  }
  if (this.type === "Rent" && (this.deposit === undefined || this.deposit === "")) {
    this.deposit = null;
  }
});

module.exports = mongoose.model("Inventory", inventorySchema);
