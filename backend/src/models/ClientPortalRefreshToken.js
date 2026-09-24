const mongoose = require("mongoose");

// Mirrors models/RefreshToken.js exactly, but for ClientPortalUser — kept
// as a fully separate collection so the client portal's session lifecycle
// never touches (or can be confused with) staff sessions.
const clientPortalRefreshTokenSchema = new mongoose.Schema(
  {
    portalUserId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "ClientPortalUser",
      index: true,
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    familyId: {
      type: String,
      required: true,
      index: true,
    },
    replacedByTokenHash: {
      type: String,
      default: null,
    },
    revokedAt: {
      type: Date,
      default: null,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    createdByIp: {
      type: String,
      default: "",
    },
    revokedByIp: {
      type: String,
      default: "",
    },
    userAgent: {
      type: String,
      default: "",
      maxlength: 300,
    },
  },
  { timestamps: true },
);

clientPortalRefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
clientPortalRefreshTokenSchema.index({ portalUserId: 1, revokedAt: 1, expiresAt: -1 });

module.exports = mongoose.model("ClientPortalRefreshToken", clientPortalRefreshTokenSchema);
