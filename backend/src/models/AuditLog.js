const mongoose = require("mongoose");

// Generic, polymorphic audit trail (unlike InventoryActivity, which is
// domain-specific). Intended to be reused by future coworking domains
// (bookings, contracts, billing, ...) instead of each spawning its own
// one-off activity model.
const auditLogSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
      ref: "Company",
    },
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
    actorRole: {
      type: String,
      required: true,
    },
    action: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    entityType: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    entityId: {
      type: String,
      trim: true,
      default: "",
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: undefined,
    },
    ip: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true, versionKey: false },
);

auditLogSchema.index({ companyId: 1, createdAt: -1 });
auditLogSchema.index({ companyId: 1, entityType: 1, createdAt: -1 });
auditLogSchema.index({ companyId: 1, actorId: 1, createdAt: -1 });

module.exports = mongoose.model("AuditLog", auditLogSchema);
