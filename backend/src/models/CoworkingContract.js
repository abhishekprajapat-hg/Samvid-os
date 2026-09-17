const mongoose = require("mongoose");
const { CONTRACT_STATUSES, CONTRACT_TYPES, DOCUMENT_CATEGORIES } = require("../constants/contract.constants");

const documentSchema = new mongoose.Schema({
  name: { type: String, trim: true, required: true, maxlength: 200 },
  category: { type: String, enum: DOCUMENT_CATEGORIES, default: "OTHER" },
  fileUrl: { type: String, trim: true, required: true },
  fileType: { type: String, trim: true, default: "" },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  uploadedAt: { type: Date, default: Date.now },
});

const coworkingContractSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Company",
      index: true,
    },
    contractCode: { type: String, required: true, trim: true },
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "CoworkingClient",
      index: true,
    },
    propertyId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: "CoworkingProperty" },
    floorId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: "CoworkingFloor" },
    cabinId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: "CoworkingCabin", index: true },
    seatCode: { type: String, trim: true, default: "" },
    contractType: { type: String, enum: CONTRACT_TYPES, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    rent: { type: Number, required: true, min: 0 },
    tokenAmount: { type: Number, default: 0, min: 0 },
    securityCheque: { number: { type: String, default: "", maxlength: 80 }, bank: { type: String, default: "", maxlength: 200 }, amount: { type: Number, default: 0, min: 0 }, date: { type: Date, default: null }, notes: { type: String, default: "", maxlength: 1000 } },
    deposit: { type: Number, default: 0, min: 0 },
    lockInPeriodMonths: { type: Number, default: 0, min: 0 },
    noticePeriodDays: { type: Number, default: 30, min: 0 },
    status: { type: String, enum: CONTRACT_STATUSES, default: "DRAFT" },
    notes: { type: String, trim: true, default: "", maxlength: 2000 },
    documents: { type: [documentSchema], default: [] },
    renewalOf: { type: mongoose.Schema.Types.ObjectId, ref: "CoworkingContract", default: null },
    supersededBy: { type: mongoose.Schema.Types.ObjectId, ref: "CoworkingContract", default: null },
    terminatedAt: { type: Date, default: null },
    terminationReason: { type: String, trim: true, default: "", maxlength: 500 },
    terminatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

coworkingContractSchema.index({ companyId: 1, contractCode: 1 }, { unique: true });
coworkingContractSchema.index({ companyId: 1, status: 1, endDate: 1 });
coworkingContractSchema.index({ companyId: 1, clientId: 1, status: 1 });

coworkingContractSchema.pre("validate", function enforceContractInvariants() {
  if (this.contractType === "SEAT" && !this.seatCode) {
    this.invalidate("seatCode", "seatCode is required for a SEAT contract");
  }
  if (this.contractType === "CABIN" && this.seatCode) {
    this.invalidate("seatCode", "seatCode must be empty for a CABIN (whole-cabin) contract");
  }
  if (this.startDate && this.endDate && this.endDate <= this.startDate) {
    this.invalidate("endDate", "endDate must be after startDate");
  }
});

module.exports = mongoose.model("CoworkingContract", coworkingContractSchema);
