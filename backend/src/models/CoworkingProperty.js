const mongoose = require("mongoose");
const { PROPERTY_STATUSES } = require("../constants/coworking.constants");

const MOBILE_PATTERN = /^[0-9]{10}$/;

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

const contactSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: "", maxlength: 120 },
    phone: {
      type: String,
      trim: true,
      default: "",
      validate: {
        validator: (value) => !value || MOBILE_PATTERN.test(value),
        message: "contact.phone must be a valid 10-digit mobile number",
      },
    },
    email: { type: String, trim: true, lowercase: true, default: "", maxlength: 200 },
  },
  { _id: false },
);

const coworkingPropertySchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Company",
      index: true,
    },
    propertyCode: {
      type: String,
      required: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    status: {
      type: String,
      enum: PROPERTY_STATUSES,
      default: "ACTIVE",
    },
    managerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    address: {
      type: addressSchema,
      default: () => ({}),
    },
    contact: {
      type: contactSchema,
      default: () => ({}),
    },
    description: {
      type: String,
      trim: true,
      default: "",
      maxlength: 2000,
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

coworkingPropertySchema.index({ companyId: 1, propertyCode: 1 }, { unique: true });
coworkingPropertySchema.index({ companyId: 1, name: 1 });
coworkingPropertySchema.index({ companyId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model("CoworkingProperty", coworkingPropertySchema);
