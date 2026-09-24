const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

// A login-capable contact for a coworking client — entirely separate from
// the staff-facing User model. A CoworkingClient (company) can have
// multiple portal users (e.g. more than one of its contacts[] wants
// access), each with their own credentials, scoped to that one client only.
const clientPortalUserSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Company",
      index: true,
    },
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "CoworkingClient",
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

// Email must be unique per operator company, not globally — two different
// coworking operators could plausibly have clients that reuse an email.
clientPortalUserSchema.index({ companyId: 1, email: 1 }, { unique: true });
clientPortalUserSchema.index({ companyId: 1, clientId: 1, isActive: 1 });

clientPortalUserSchema.pre("save", async function hashPassword() {
  if (!this.isModified("password")) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

clientPortalUserSchema.methods.matchPassword = async function matchPassword(enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model("ClientPortalUser", clientPortalUserSchema);
