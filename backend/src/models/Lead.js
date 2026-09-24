const mongoose = require("mongoose");

const leadSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    phone: { type: String, required: true, index: true },
    email: String,
    city: String,
    preferredLocations: {
      type: [String],
      default: [],
    },
    projectInterested: String,
    clientProfession: String,
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      default: null,
      index: true,
    },
    metaLeadId: {
      type: String,
      default: "",
      trim: true,
    },
    metaPageId: {
      type: String,
      default: "",
      trim: true,
    },
    metaFormId: {
      type: String,
      default: "",
      trim: true,
    },
    inventoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Inventory",
      default: null,
      index: true,
    },
    relatedInventoryIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Inventory",
      },
    ],
    siteLocation: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
      radiusMeters: { type: Number, default: 200 },
    },
    requirements: {
      inventoryType: {
        type: String,
        enum: ["COMMERCIAL", "RESIDENTIAL", ""],
        default: "",
        trim: true,
      },
      transactionType: {
        type: String,
        enum: ["SALE", "LEASE", "RENT", ""],
        default: "",
        trim: true,
      },
      furnishingStatus: {
        type: String,
        default: "",
        trim: true,
      },
      propertySubtype: {
        type: String,
        default: "",
        trim: true,
      },
      subtypeData: {
        type: mongoose.Schema.Types.Mixed,
        default: () => ({}),
      },
      budgetMin: {
        type: Number,
        min: 0,
        default: null,
      },
      budgetMax: {
        type: Number,
        min: 0,
        default: null,
      },
      areaMin: {
        type: Number,
        min: 0,
        default: null,
      },
      areaMax: {
        type: Number,
        min: 0,
        default: null,
      },
      areaUnit: {
        type: String,
        enum: ["SQ_FT", "SQ_M", ""],
        default: "SQ_FT",
        trim: true,
      },
      commercial: {
        seats: {
          type: Number,
          min: 0,
          default: null,
        },
        cabins: {
          type: Number,
          min: 0,
          default: null,
        },
        conferenceRooms: {
          type: Number,
          min: 0,
          default: null,
        },
        conferenceSeats: {
          type: Number,
          min: 0,
          default: null,
        },
        parkingAvailable: {
          type: Boolean,
          default: false,
        },
        pantry: {
          type: Boolean,
          default: false,
        },
        receptionArea: { type: Boolean, default: false },
        waitingArea: { type: Boolean, default: false },
        cafeteria: { type: Boolean, default: false },
        serverRoom: { type: Boolean, default: false },
        storageRoom: { type: Boolean, default: false },
        breakoutArea: { type: Boolean, default: false },
        liftAvailable: { type: Boolean, default: false },
        powerBackup: { type: Boolean, default: false },
        centralAC: { type: Boolean, default: false },
        fireSafety: { type: Boolean, default: false },
        readyToMove: { type: Boolean, default: false },
        underConstruction: { type: Boolean, default: false },
      },
      residential: {
        bhkType: {
          type: String,
          default: "",
          trim: true,
        },
        floor: {
          type: Number,
          min: 0,
          default: null,
        },
        amenities: {
          lift: { type: Boolean, default: false },
          security: { type: Boolean, default: false },
          gym: { type: Boolean, default: false },
          swimmingPool: { type: Boolean, default: false },
          clubhouse: { type: Boolean, default: false },
          powerBackup: { type: Boolean, default: false },
          parking: { type: Boolean, default: false },
          studyRoom: { type: Boolean, default: false },
          servantRoom: { type: Boolean, default: false },
          modularKitchen: { type: Boolean, default: false },
          electricityBackup: { type: Boolean, default: false },
          gasPipeline: { type: Boolean, default: false },
        },
      },
    },

    hotClient: { type: Boolean, default: false },
    brokerContactId: { type: mongoose.Schema.Types.ObjectId, ref: "CrmContact", default: null },
    source: {
      type: String,
      enum: ["META", "MANUAL"],
      required: true
    },

    status: {
      type: String,
      enum: [
        "NEW",
        "CONTACTED",
        "FOLLOW_UP_1",
        "FOLLOW_UP_2",
        "FOLLOW_UP_3",
        "INTERESTED",
        "SITE_VISIT_SCHEDULED",
        "SITE_VISIT",
        "SITE_VISIT_OVERDUE",
        "MISSING_IN_ACTION",
        "NOT_PICKING_CALLS",
        "INVALID",
        "OWNER",
        "BROKER",
        "REQUESTED",
        "CLOSED",
        "LOST"
      ],
      default: "NEW"
    },

    dealPayment: {
      mode: {
        type: String,
        enum: ["UPI", "CASH", "CHECK", "NET_BANKING_NEFTRTGSIMPS"],
        default: null,
      },
      paymentType: {
        type: String,
        enum: ["FULL", "PARTIAL"],
        default: null,
      },
      remainingAmount: {
        type: Number,
        min: 0,
        default: null,
      },
      paymentReference: {
        type: String,
        default: "",
        trim: true,
      },
      note: {
        type: String,
        default: "",
        trim: true,
      },
      approvalStatus: {
        type: String,
        enum: ["PENDING", "APPROVED", "REJECTED"],
        default: null,
      },
      approvalNote: {
        type: String,
        default: "",
        trim: true,
      },
      approvalRequestedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      approvalRequestedAt: {
        type: Date,
        default: null,
      },
      approvalReviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      approvalReviewedAt: {
        type: Date,
        default: null,
      },
      requestedFromStatus: {
        type: String,
        default: "",
        trim: true,
      },
      requestedTargetStatus: {
        type: String,
        default: "",
        trim: true,
      },
    },
    brokerageReceived: {
      type: Number,
      min: 0,
      default: null,
    },
    brokerageDistributed: {
      type: Number,
      min: 0,
      default: 0,
    },
    brokerageDistributionBreakdown: [
      {
        recipientName: {
          type: String,
          trim: true,
          default: "",
        },
        recipientType: {
          type: String,
          trim: true,
          default: "",
        },
        amount: {
          type: Number,
          min: 0,
          default: 0,
        },
        note: {
          type: String,
          trim: true,
          default: "",
        },
        paidDate: {
          type: Date,
          default: null,
        },
      },
    ],
    brokerageClosedAt: {
      type: Date,
      default: null,
    },
    brokerageClosedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    closureDocuments: [
      {
        url: {
          type: String,
          required: true,
          trim: true,
        },
        kind: {
          type: String,
          enum: ["image", "pdf", "file"],
          default: "file",
        },
        mimeType: {
          type: String,
          default: "",
          trim: true,
        },
        name: {
          type: String,
          default: "",
          trim: true,
        },
        size: {
          type: Number,
          min: 0,
          default: 0,
        },
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
        uploadedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          default: null,
        },
      },
    ],

    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },

    assignedManager: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true
    },

    assignedExecutive: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true
    },

    assignedFieldExecutive: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true
    },

    assignmentHistory: [
      {
        action: {
          type: String,
          required: true,
          trim: true,
        },
        fromUser: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          default: null,
        },
        toUser: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          default: null,
        },
        reason: {
          type: String,
          trim: true,
          default: "",
        },
        statusAtTransfer: {
          type: String,
          trim: true,
          default: "",
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
        createdBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          default: null,
        },
      },
    ],

    qualifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    qualifiedAt: {
      type: Date,
      default: null,
      index: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },

    // 🔥 NEW FIELDS
    nextFollowUp: {
      type: Date,
      default: null
    },

    lastContactedAt: {
      type: Date,
      default: null
    }

  },
  { timestamps: true }
);

leadSchema.index({ createdAt: -1 });
leadSchema.index({ companyId: 1, createdAt: -1 });
// Speeds duplicate checks and Meta webhook upserts scoped to one tenant.
leadSchema.index({ companyId: 1, phone: 1 });
leadSchema.index({ createdBy: 1, createdAt: -1 });
leadSchema.index({ assignedTo: 1, createdAt: -1 });
leadSchema.index({ companyId: 1, assignedTo: 1, createdAt: -1 });
leadSchema.index({ companyId: 1, status: 1, createdAt: -1 });
// Dashboard and Samvid OS report cards sort fresh leads by updatedAt within tenant/status scopes.
leadSchema.index({ companyId: 1, status: 1, updatedAt: -1 });
leadSchema.index({ companyId: 1, assignedTo: 1, updatedAt: -1 });
leadSchema.index({ companyId: 1, createdBy: 1, updatedAt: -1 });
leadSchema.index({ companyId: 1, assignedManager: 1, status: 1, createdAt: -1 });
leadSchema.index({ companyId: 1, assignedExecutive: 1, status: 1, createdAt: -1 });
leadSchema.index({ companyId: 1, assignedFieldExecutive: 1, status: 1, createdAt: -1 });
// Follow-up pages filter by tenant and nextFollowUp ranges, then exclude closed/lost statuses.
leadSchema.index({ companyId: 1, nextFollowUp: 1, status: 1 });
leadSchema.index({ assignedManager: 1, createdAt: -1 });
leadSchema.index({ assignedExecutive: 1, createdAt: -1 });
leadSchema.index({ assignedFieldExecutive: 1, createdAt: -1 });
leadSchema.index({ nextFollowUp: 1, assignedTo: 1 });
leadSchema.index({ relatedInventoryIds: 1, createdAt: -1 });
leadSchema.index(
  { companyId: 1, metaLeadId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      companyId: { $type: "objectId" },
      metaLeadId: { $exists: true, $ne: "" },
    },
  },
);

leadSchema.pre("save", async function syncContact() {
 if (!this.companyId || !(this.isNew || this.isModified("phone") || this.isModified("status") || this.isModified("name") || this.isModified("email"))) return;
 const { normalizePhone, upsertContact } = require("../services/crmContact.service");
 if (["OWNER", "BROKER"].includes(this.status)) {
   const contact = await upsertContact({ companyId: this.companyId, kind: this.status, phone: this.phone, name: this.name, email: this.email, leadId: this._id, inventoryId: this.inventoryId, actor: this.createdBy });
   if (this.status === "BROKER") this.brokerContactId = contact?._id || null;
 }
 this.brokerContactId = (await require("./CrmContact").findOne({ companyId: this.companyId, kind: "BROKER", phone: normalizePhone(this.phone) }).select("_id"))?._id || null;
});
module.exports = mongoose.model("Lead", leadSchema);
