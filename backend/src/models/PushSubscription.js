const mongoose = require("mongoose");

/*
 * One browser's permission to reach a person's phone.
 *
 * A subscription belongs to a device, not to a person: the same user installing
 * the app on a phone and a desktop produces two, and both should ring. The
 * endpoint is what the push service issues and is unique per device, so it is
 * the key - re-subscribing on the same device updates the row rather than
 * stacking duplicates that would deliver the same alert three times.
 *
 * Subscriptions die on their own: a browser can revoke one at any time, and the
 * push service then answers 404/410. `sendToUser` deletes those as it finds
 * them, which is the only cleanup this collection gets or needs.
 */
const schema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    endpoint: { type: String, required: true, unique: true },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
    userAgent: { type: String, default: "", maxlength: 400 },
    lastSentAt: { type: Date, default: null },
    failureCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

module.exports = mongoose.model("PushSubscription", schema);
