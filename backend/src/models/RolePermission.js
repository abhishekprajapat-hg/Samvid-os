const mongoose = require("mongoose");
const { USER_ROLES } = require("../constants/role.constants");
const { isValidPermission } = require("../constants/permission.constants");

// Per-company override of the default role -> permissions mapping.
// Absence of a document for a given {companyId, role} means the role
// uses DEFAULT_ROLE_PERMISSIONS from permission.constants.js.
const rolePermissionSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
      ref: "Company",
    },
    role: {
      type: String,
      enum: Object.values(USER_ROLES),
      required: true,
    },
    permissions: {
      type: [String],
      default: [],
      validate: {
        validator: (values) => values.every((value) => isValidPermission(value)),
        message: "One or more permissions are not recognized",
      },
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true },
);

rolePermissionSchema.index({ companyId: 1, role: 1 }, { unique: true });

module.exports = mongoose.model("RolePermission", rolePermissionSchema);
