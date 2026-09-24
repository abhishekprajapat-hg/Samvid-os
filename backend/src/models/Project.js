const mongoose = require("mongoose");
const {
  PROJECT_CATEGORIES,
  PROJECT_TYPES,
  PLOT_BASED_PROJECT_TYPES,
  PROJECT_PLOT_SIZES,
  PROJECT_BHK_TYPES,
  PROJECT_STATUSES,
  PROJECT_AMENITIES,
  PROJECT_COMMERCIAL_AMENITIES,
  PROJECT_HOUSING_CATEGORIES,
  PROJECT_OFFICE_TYPES,
  PROJECT_FACING_OPTIONS,
  PROJECT_UNIT_STATUSES,
} = require("../constants/project.constants");

const MOBILE_PATTERN = /^[0-9]{10}$/;

const bhkConfigurationSchema = new mongoose.Schema(
  {
    bhk: {
      type: String,
      required: true,
      enum: PROJECT_BHK_TYPES,
    },
    size: {
      type: Number,
      required: true,
      min: 0.01,
    },
    bedrooms: {
      type: Number,
      default: 0,
      min: 0,
    },
    kitchens: {
      type: Number,
      default: 0,
      min: 0,
    },
    washrooms: {
      type: Number,
      default: 0,
      min: 0,
    },
    drawingRooms: {
      type: Number,
      default: 0,
      min: 0,
    },
    balconies: {
      type: Number,
      default: 0,
      min: 0,
    },
    servantRoom: {
      type: Boolean,
      default: false,
    },
    reservedParking: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: false },
);

// Offices/Shops/Showrooms keep their auto-generated _id — each unit needs a stable
// unique identifier the frontend can key edit/duplicate/delete actions off of.
const officeSchema = new mongoose.Schema({
  officeCode: {
    type: String,
    required: true,
    trim: true,
    maxlength: 40,
  },
  officeName: {
    type: String,
    trim: true,
    default: "",
    maxlength: 120,
  },
  floorNumber: {
    type: Number,
    required: true,
    min: 0,
  },
  officeType: {
    type: String,
    enum: [...PROJECT_OFFICE_TYPES, ""],
    default: "",
  },
  length: {
    type: Number,
    required: true,
    min: 0.01,
  },
  breadth: {
    type: Number,
    required: true,
    min: 0.01,
  },
  height: {
    type: Number,
    default: null,
    min: 0,
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
  superBuiltUpArea: {
    type: Number,
    default: null,
    min: 0,
  },
  facing: {
    type: String,
    enum: [...PROJECT_FACING_OPTIONS, ""],
    default: "",
  },
  reservedParking: {
    type: Number,
    default: 0,
    min: 0,
  },
  status: {
    type: String,
    enum: PROJECT_UNIT_STATUSES,
    default: "AVAILABLE",
  },
  startingRate: {
    type: Number,
    default: null,
    min: 0,
  },
  currentRate: {
    type: Number,
    default: null,
    min: 0,
  },
  plc: {
    type: String,
    trim: true,
    default: "",
    maxlength: 60,
  },
  remarks: {
    type: String,
    trim: true,
    default: "",
    maxlength: 1000,
  },
});

const shopSchema = new mongoose.Schema({
  shopCode: {
    type: String,
    required: true,
    trim: true,
    maxlength: 40,
  },
  floorNumber: {
    type: Number,
    required: true,
    min: 0,
  },
  length: {
    type: Number,
    required: true,
    min: 0.01,
  },
  breadth: {
    type: Number,
    required: true,
    min: 0.01,
  },
  height: {
    type: Number,
    default: null,
    min: 0,
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
  facing: {
    type: String,
    enum: [...PROJECT_FACING_OPTIONS, ""],
    default: "",
  },
  parking: {
    type: Number,
    default: 0,
    min: 0,
  },
  status: {
    type: String,
    enum: PROJECT_UNIT_STATUSES,
    default: "AVAILABLE",
  },
  startingRate: {
    type: Number,
    default: null,
    min: 0,
  },
  currentRate: {
    type: Number,
    default: null,
    min: 0,
  },
});

const showroomSchema = new mongoose.Schema({
  showroomCode: {
    type: String,
    required: true,
    trim: true,
    maxlength: 40,
  },
  floorNumber: {
    type: Number,
    required: true,
    min: 0,
  },
  length: {
    type: Number,
    required: true,
    min: 0.01,
  },
  breadth: {
    type: Number,
    required: true,
    min: 0.01,
  },
  height: {
    type: Number,
    default: null,
    min: 0,
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
  entranceWidth: {
    type: Number,
    default: null,
    min: 0,
  },
  ceilingHeight: {
    type: Number,
    default: null,
    min: 0,
  },
  parking: {
    type: Number,
    default: 0,
    min: 0,
  },
  status: {
    type: String,
    enum: PROJECT_UNIT_STATUSES,
    default: "AVAILABLE",
  },
  startingRate: {
    type: Number,
    default: null,
    min: 0,
  },
  currentRate: {
    type: Number,
    default: null,
    min: 0,
  },
});

const projectSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Company",
      index: true,
    },
    projectId: {
      type: String,
      required: true,
      trim: true,
    },
    projectCategory: {
      type: String,
      required: true,
      enum: PROJECT_CATEGORIES,
    },
    // Residential-only sub-type. Commercial projects have no project-type dropdown
    // at all, so this stays "" for them (see pre-validate hook for the conditional requirement).
    projectType: {
      type: String,
      enum: [...PROJECT_TYPES, ""],
      default: "",
    },
    projectName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    totalLandArea: {
      type: String,
      required: true,
      trim: true,
      maxlength: 60,
    },
    // Plotting / Villas & Farmhouse fields (required only for those project types; see pre-validate hook).
    totalPlots: {
      type: Number,
      default: null,
      min: 0,
    },
    plotSize: {
      type: String,
      enum: [...PROJECT_PLOT_SIZES, ""],
      default: "",
    },
    customPlotSize: {
      type: String,
      trim: true,
      default: "",
      maxlength: 60,
    },
    // Building fields (required only when projectType === "BUILDING"; see pre-validate hook).
    numberOfFlats: {
      type: Number,
      default: null,
      min: 0,
    },
    numberOfFloors: {
      type: Number,
      default: null,
      min: 0,
    },
    flatsPerFloor: {
      type: Number,
      default: null,
      min: 0,
    },
    bhkConfigurations: {
      type: [bhkConfigurationSchema],
      default: [],
    },
    // Commercial fields (required only when projectCategory === "COMMERCIAL"; see pre-validate hook).
    totalFloors: {
      type: Number,
      default: null,
      min: 0,
    },
    totalOffices: {
      type: Number,
      default: null,
      min: 0,
    },
    officesPerFloor: {
      type: Number,
      default: null,
      min: 0,
    },
    totalShops: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalShowrooms: {
      type: Number,
      default: 0,
      min: 0,
    },
    offices: {
      type: [officeSchema],
      default: [],
    },
    shops: {
      type: [shopSchema],
      default: [],
    },
    showrooms: {
      type: [showroomSchema],
      default: [],
    },
    plc: {
      type: String,
      trim: true,
      default: "",
      maxlength: 60,
    },
    group: {
      type: String,
      trim: true,
      default: "",
      maxlength: 120,
    },
    startingRate: {
      type: Number,
      required: true,
      min: 0,
    },
    currentRate: {
      type: Number,
      required: true,
      min: 0,
    },
    otherCharges: {
      type: String,
      trim: true,
      default: "",
      maxlength: 2000,
    },
    status: {
      type: String,
      required: true,
      enum: PROJECT_STATUSES,
    },
    amenities: {
      type: [{ type: String, enum: [...PROJECT_AMENITIES, ...PROJECT_COMMERCIAL_AMENITIES] }],
      default: [],
    },
    images: {
      type: [String],
      default: [],
    },
    housingCategory: {
      type: String,
      enum: [...PROJECT_HOUSING_CATEGORIES, ""],
      default: "",
    },
    location: {
      type: String,
      trim: true,
      default: "",
      maxlength: 500,
    },
    landmark: {
      type: String,
      trim: true,
      default: "",
      maxlength: 200,
    },
    city: {
      type: String,
      trim: true,
      default: "",
      maxlength: 100,
    },
    state: {
      type: String,
      trim: true,
      default: "",
      maxlength: 100,
    },
    pincode: {
      type: String,
      trim: true,
      default: "",
      maxlength: 10,
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
    ownerManagerName: {
      type: String,
      trim: true,
      default: "",
      maxlength: 120,
    },
    ownerManagerMobile: {
      type: String,
      trim: true,
      default: "",
      validate: {
        validator: (value) => !value || MOBILE_PATTERN.test(value),
        message: "ownerManagerMobile must be a valid 10-digit mobile number",
      },
    },
    brokerManagerName: {
      type: String,
      trim: true,
      default: "",
      maxlength: 120,
    },
    brokerManagerMobile: {
      type: String,
      trim: true,
      default: "",
      validate: {
        validator: (value) => !value || MOBILE_PATTERN.test(value),
        message: "brokerManagerMobile must be a valid 10-digit mobile number",
      },
    },
    plotsAvailable: {
      type: Number,
      default: 0,
      min: 0,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    deletedAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  { timestamps: true },
);

projectSchema.index({ companyId: 1, projectId: 1 }, { unique: true });
projectSchema.index(
  { companyId: 1, projectName: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);
projectSchema.index({ companyId: 1, deletedAt: 1, updatedAt: -1 });
projectSchema.index({ companyId: 1, projectCategory: 1, status: 1, updatedAt: -1 });

const invalidateIfRateInverted = (doc, path, entry) => {
  if (
    entry.startingRate !== null
    && entry.startingRate !== undefined
    && entry.currentRate !== null
    && entry.currentRate !== undefined
    && entry.currentRate < entry.startingRate
  ) {
    doc.invalidate(path, "currentRate cannot be less than startingRate");
  }
};

projectSchema.pre("validate", function enforceProjectTypeRules() {
  if (this.currentRate < this.startingRate) {
    this.invalidate("currentRate", "currentRate cannot be less than startingRate");
  }

  const isResidential = this.projectCategory === "RESIDENTIAL";
  const isCommercial = this.projectCategory === "COMMERCIAL";
  const isPlotBased = isResidential && PLOT_BASED_PROJECT_TYPES.includes(this.projectType);
  const isBuilding = isResidential && this.projectType === "BUILDING";

  if (isResidential && !this.projectType) {
    this.invalidate("projectType", "projectType is required for Residential projects");
  }

  if (isPlotBased) {
    if (this.totalPlots === null || this.totalPlots === undefined) {
      this.invalidate("totalPlots", "totalPlots is required for this project type");
    } else if (this.plotsAvailable > this.totalPlots) {
      this.invalidate("plotsAvailable", "plotsAvailable cannot exceed totalPlots");
    }
    if (this.plotSize === "CUSTOM" && !String(this.customPlotSize || "").trim()) {
      this.invalidate("customPlotSize", "customPlotSize is required when plotSize is Custom");
    }
  }

  if (isBuilding) {
    if (!this.numberOfFlats) {
      this.invalidate("numberOfFlats", "numberOfFlats must be greater than 0");
    }
    if (!this.numberOfFloors) {
      this.invalidate("numberOfFloors", "numberOfFloors must be greater than 0");
    }
    if (!this.flatsPerFloor) {
      this.invalidate("flatsPerFloor", "flatsPerFloor must be greater than 0");
    }
    if (!Array.isArray(this.bhkConfigurations) || this.bhkConfigurations.length === 0) {
      this.invalidate("bhkConfigurations", "At least one BHK configuration is required");
    }
  }

  if (isCommercial) {
    if (!this.totalFloors) {
      this.invalidate("totalFloors", "totalFloors must be greater than 0");
    }
    if (!this.officesPerFloor) {
      this.invalidate("officesPerFloor", "officesPerFloor must be greater than 0");
    }
    (this.offices || []).forEach((office, index) => {
      invalidateIfRateInverted(this, `offices.${index}.currentRate`, office);
    });
    (this.shops || []).forEach((shop, index) => {
      invalidateIfRateInverted(this, `shops.${index}.currentRate`, shop);
    });
    (this.showrooms || []).forEach((showroom, index) => {
      invalidateIfRateInverted(this, `showrooms.${index}.currentRate`, showroom);
    });
  }
});

module.exports = mongoose.model("Project", projectSchema);
