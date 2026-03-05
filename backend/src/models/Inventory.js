const mongoose = require("mongoose");
const { INVENTORY_STATUSES } = require("../constants/inventory.constants");

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
    status: {
      type: String,
      enum: INVENTORY_STATUSES,
      default: "Available",
      index: true,
    },
    saleMeta: {
      leadId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Lead",
        default: null,
      },
      paymentMode: {
        type: String,
        enum: ["Cash", "Cheque", "Bank Transfer", "Net Banking", "UPI"],
        default: null,
      },
      totalAmount: {
        type: Number,
        default: null,
      },
      partialAmount: {
        type: Number,
        default: null,
      },
      remainingAmount: {
        type: Number,
        default: null,
      },
      remainingDueDate: {
        type: String,
        trim: true,
        default: "",
      },
      paymentDate: {
        type: String,
        trim: true,
        default: "",
      },
      paidTo: {
        type: String,
        trim: true,
        default: "",
      },
      notes: {
        type: String,
        trim: true,
        default: "",
      },
      voiceNoteUrl: {
        type: String,
        trim: true,
        default: "",
      },
      voiceNoteName: {
        type: String,
        trim: true,
        default: "",
      },
      cheque: {
        bankName: { type: String, trim: true, default: "" },
        chequeNumber: { type: String, trim: true, default: "" },
        ifsc: { type: String, trim: true, default: "" },
        accountHolder: { type: String, trim: true, default: "" },
        branch: { type: String, trim: true, default: "" },
        chequeDate: { type: String, trim: true, default: "" },
      },
      netBanking: {
        bankName: { type: String, trim: true, default: "" },
        accountNumber: { type: String, trim: true, default: "" },
        ifsc: { type: String, trim: true, default: "" },
        transactionId: { type: String, trim: true, default: "" },
        accountHolder: { type: String, trim: true, default: "" },
      },
      bankTransfer: {
        transferType: { type: String, trim: true, default: "" },
        utrNumber: { type: String, trim: true, default: "" },
      },
      upi: {
        upiId: { type: String, trim: true, default: "" },
        transactionId: { type: String, trim: true, default: "" },
        receiverName: { type: String, trim: true, default: "" },
      },
    },
    location: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    type: {
      type: String,
      enum: ["Sale", "Rent"],
      default: "Sale",
      trim: true,
    },
    category: {
      type: String,
      default: "Apartment",
      trim: true,
      maxlength: 80,
    },
    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1000,
    },
    amenities: {
      type: [String],
      default: [],
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

module.exports = mongoose.model("Inventory", inventorySchema);
