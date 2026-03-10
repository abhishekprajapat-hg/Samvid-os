const mongoose = require("mongoose");

const leadStatusRequestSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Company",
      index: true,
    },
    lead: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lead",
      required: true,
      index: true,
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    proposedStatus: {
      type: String,
      enum: ["NEW", "CONTACTED", "INTERESTED", "SITE_VISIT", "REQUESTED", "CLOSED", "LOST"],
      required: true,
    },
    proposedNextFollowUp: {
      type: Date,
      default: null,
    },
    proposedSaleMeta: {
      leadId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Lead",
        default: null,
      },
      leadName: {
        type: String,
        trim: true,
        default: "",
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
      cheque: {
        bankName: { type: String, trim: true, default: "" },
        chequeNumber: { type: String, trim: true, default: "" },
        chequeDate: { type: String, trim: true, default: "" },
      },
      bankTransfer: {
        transferType: { type: String, trim: true, default: "" },
        utrNumber: { type: String, trim: true, default: "" },
      },
      upi: {
        transactionId: { type: String, trim: true, default: "" },
      },
    },
    attachment: {
      fileName: { type: String, trim: true, default: "" },
      fileUrl: { type: String, trim: true, default: "" },
      mimeType: { type: String, trim: true, default: "" },
      size: { type: Number, default: 0 },
      storagePath: { type: String, trim: true, default: "" },
    },
    closureDocuments: [
      {
        url: { type: String, trim: true, required: true },
        kind: {
          type: String,
          enum: ["image", "pdf", "file"],
          default: "file",
        },
        mimeType: { type: String, trim: true, default: "" },
        name: { type: String, trim: true, default: "" },
        size: { type: Number, default: 0 },
      },
    ],
    requestNote: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    reviewNote: {
      type: String,
      trim: true,
      default: "",
      maxlength: 500,
    },
    rejectionReason: {
      type: String,
      trim: true,
      default: "",
      maxlength: 500,
    },
  },
  { timestamps: true },
);

leadStatusRequestSchema.index({ companyId: 1, status: 1, createdAt: -1 });
leadStatusRequestSchema.index({ lead: 1, status: 1, createdAt: -1 });
leadStatusRequestSchema.index({ requestedBy: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model("LeadStatusRequest", leadStatusRequestSchema);
