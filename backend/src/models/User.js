const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { USER_ROLES, EXECUTIVE_ROLES } = require("../constants/role.constants");

const brokerageConfigSchema = new mongoose.Schema(
  {
    mode: {
      type: String,
      enum: ["FLAT", "PERCENTAGE"],
      default: "FLAT",
    },
    value: {
      type: Number,
      min: 0,
      default: 50000,
    },
    notes: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { _id: false },
);

const userSchema = new mongoose.Schema(
  {
    // Null inherits the role. Entries may be legacy page-key strings or the
    // action-aware shape { pageKey, actions }, so existing employee grants
    // keep working while new grants can restrict create/edit/delete/etc.
    pageAccessOverride: { type: [mongoose.Schema.Types.Mixed], default: null },
    // The company-defined role this user was given, if any. Their role,
    // roleType and pageAccessOverride are copied from it on assignment.
    customRoleId: { type: mongoose.Schema.Types.ObjectId, ref: "CustomRole", default: null },
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

    // Legacy vertical, unchanged: lead routing and inventory ownership have
    // key off these three values.
    roleType: {
      type: String,
      enum: ["COMMERCIAL", "RESIDENTIAL", "BOTH", "COWORKING"],
      default: "COMMERCIAL",
    },

    profileImageUrl: {
      type: String,
      trim: true,
      default: "",
    },

    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false,
    },

    role: {
      type: String,
      enum: Object.values(USER_ROLES),
      required: true,
    },

    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      default: null,
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

    canViewInventory: {
      type: Boolean,
      default: false,
    },

    brokerageConfig: {
      type: brokerageConfigSchema,
      default: () => ({
        mode: "FLAT",
        value: 50000,
        notes: "",
      }),
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    /*
     * The company's own payroll number for this person, shown on the team
     * screens. Free text rather than a generated code: it has to match
     * whatever the company already prints on a contract. Blank falls back to
     * the derived EMP-XXXXXX in the profile view, so nobody has to fill it in.
     */
    employeeId: {
      type: String,
      trim: true,
      default: "",
      maxlength: 40,
    },

    joiningDate: {
      type: Date,
      default: null,
    },

    /*
     * Invitation state. An account exists from the moment it is created - the
     * password is set then - so these two only record whether the person has
     * been told about it and whether they have signed in since. That is what
     * the team list's "Invited" chip and its pending-invites count read.
     */
    invitedAt: {
      type: Date,
      default: null,
    },

    inviteAcceptedAt: {
      type: Date,
      default: null,
    },

    // Set when an account is created with a temporary password.
    mustChangePassword: {
      type: Boolean,
      default: false,
    },

    /*
     * How much work this person is meant to be carrying. The member screen
     * draws the load against these, so they are a target to compare with and
     * not a limit anything enforces - a lead router that refused to assign
     * past them would strand leads.
     */
    leadCapacity: {
      type: Number,
      min: 0,
      default: 25,
    },

    taskCapacity: {
      type: Number,
      min: 0,
      default: 10,
    },

    department: {
      type: String,
      trim: true,
      default: "",
      maxlength: 80,
    },

    branch: {
      type: String,
      trim: true,
      default: "",
      maxlength: 80,
    },

    shiftTiming: {
      type: String,
      trim: true,
      default: "",
      maxlength: 60,
    },

    monthlyTarget: {
      type: Number,
      min: 0,
      default: 10,
    },

    lastLoginAt: {
      type: Date,
      default: null,
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
// User/admin lists are tenant scoped and sorted newest-first without always filtering role.
userSchema.index({ companyId: 1, createdAt: -1 });
userSchema.index({ companyId: 1, parentId: 1, role: 1, isActive: 1 });
// Team pickers often filter direct reports and sort by display name.
userSchema.index({ companyId: 1, parentId: 1, isActive: 1, name: 1 });
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
  return this.role === USER_ROLES.ADMIN;
};

userSchema.methods.isManager = function () {
  return this.role === USER_ROLES.MANAGER;
};

userSchema.methods.isExecutive = function () {
  return EXECUTIVE_ROLES.includes(this.role);
};

module.exports = mongoose.model("User", userSchema);
