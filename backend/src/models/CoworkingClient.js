const mongoose = require("mongoose");
const {
  CLIENT_STATUSES,
  CLIENT_TYPES,
  KYC_STATUSES,
  DOCUMENT_CATEGORIES,
  GST_PATTERN,
  PAN_PATTERN,
  MOBILE_PATTERN,
} = require("../constants/client.constants");

const addressSchema = new mongoose.Schema(
  {
    line1: { type: String, trim: true, default: "", maxlength: 200 },
    line2: { type: String, trim: true, default: "", maxlength: 200 },
    city: { type: String, trim: true, default: "", maxlength: 100 },
    state: { type: String, trim: true, default: "", maxlength: 100 },
    pincode: { type: String, trim: true, default: "", maxlength: 10 },
    country: { type: String, trim: true, default: "India", maxlength: 100 },
  },
  { _id: false },
);

// Secondary points of contact beyond the primary contactPerson/phone/email
// fields on the client itself.
const contactSchema = new mongoose.Schema({
  name: { type: String, trim: true, required: true, maxlength: 120 },
  designation: { type: String, trim: true, default: "", maxlength: 120 },
  phone: {
    type: String,
    trim: true,
    default: "",
    validate: {
      validator: (value) => !value || MOBILE_PATTERN.test(value),
      message: "contact phone must be a valid 10-digit mobile number",
    },
  },
  email: { type: String, trim: true, lowercase: true, default: "", maxlength: 200 },
});

const documentSchema = new mongoose.Schema({
  name: { type: String, trim: true, required: true, maxlength: 200 },
  category: { type: String, enum: DOCUMENT_CATEGORIES, default: "OTHER" },
  fileUrl: { type: String, trim: true, required: true },
  fileType: { type: String, trim: true, default: "" },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  uploadedAt: { type: Date, default: Date.now },
});

const coworkingClientSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Company",
      index: true,
    },
    clientCode: {
      type: String,
      required: true,
      trim: true,
    },
    companyName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    dateOfBirth: { type: Date, default: null },
    contactPerson: {
      type: String,
      trim: true,
      default: "",
      maxlength: 120,
    },
    phone: {
      type: String,
      trim: true,
      default: "",
      validate: {
        validator: (value) => !value || MOBILE_PATTERN.test(value),
        message: "phone must be a valid 10-digit mobile number",
      },
    },
    alternatePhone: {
      type: String,
      trim: true,
      default: "",
      validate: {
        validator: (value) => !value || MOBILE_PATTERN.test(value),
        message: "alternatePhone must be a valid 10-digit mobile number",
      },
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
      maxlength: 200,
    },
    address: {
      type: addressSchema,
      default: () => ({}),
    },
    gstNumber: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
      validate: {
        validator: (value) => !value || GST_PATTERN.test(value),
        message: "gstNumber is not a valid GSTIN",
      },
    },
    panNumber: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
      validate: {
        validator: (value) => !value || PAN_PATTERN.test(value),
        message: "panNumber is not a valid PAN",
      },
    },
    kycStatus: {
      type: String,
      enum: KYC_STATUSES,
      default: "PENDING",
    },
    clientType: {
      type: String,
      enum: CLIENT_TYPES,
      default: "SME",
    },
    industry: {
      type: String,
      trim: true,
      default: "",
      maxlength: 120,
    },
    notes: {
      type: String,
      trim: true,
      default: "",
      maxlength: 2000,
    },
    status: {
      type: String,
      enum: CLIENT_STATUSES,
      default: "LEAD",
    },
    contacts: {
      type: [contactSchema],
      default: [],
    },
    documents: {
      type: [documentSchema],
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

coworkingClientSchema.index({ companyId: 1, clientCode: 1 }, { unique: true });
coworkingClientSchema.index({ companyId: 1, companyName: 1 });
coworkingClientSchema.index({ companyId: 1, status: 1, createdAt: -1 });
coworkingClientSchema.index(
  { companyId: 1, gstNumber: 1 },
  { unique: true, partialFilterExpression: { gstNumber: { $type: "string", $ne: "" } } },
);

module.exports = mongoose.model("CoworkingClient", coworkingClientSchema);
