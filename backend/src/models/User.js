const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    phone: {
      type: String,
      trim: true,
    },

    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false,
    },

    role: {
      type: String,
      enum: [
        "ADMIN",
        "MANAGER",
        "EXECUTIVE",
        "FIELD_EXECUTIVE",
        "CHANNEL_PARTNER",
      ],
      required: true,
    },

    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
      ref: "Company",
    },

    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    partnerCode: {
      type: String,
      unique: true,
      sparse: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    lastAssignedIndex: {
      type: Number,
      default: 0,
    },

    lastAssignedAt: {
      type: Date,
      default: null,
    },

    liveLocation: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
      accuracy: { type: Number, default: null },
      heading: { type: Number, default: null },
      speed: { type: Number, default: null },
      updatedAt: { type: Date, default: null },
    },
  },
  { timestamps: true },
);

userSchema.index({ companyId: 1, role: 1, isActive: 1, createdAt: 1 });
userSchema.index({ companyId: 1, parentId: 1, role: 1, isActive: 1 });
userSchema.index({ companyId: 1, role: 1, "liveLocation.updatedAt": -1 });

userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

userSchema.methods.isAdmin = function () {
  return this.role === "ADMIN";
};

userSchema.methods.isManager = function () {
  return this.role === "MANAGER";
};

userSchema.methods.isExecutive = function () {
  return ["EXECUTIVE", "FIELD_EXECUTIVE"].includes(this.role);
};

module.exports = mongoose.model("User", userSchema);
