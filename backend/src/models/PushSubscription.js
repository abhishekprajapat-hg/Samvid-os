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
 *
 * Two kinds live here. WEB is a browser Push API subscription and carries the
 * encryption keys web-push needs. EXPO is a native device registered through
 * Expo, whose token is itself the address and needs no keys - so `keys` is
 * required for WEB only. Everything else about a row is the same either way,
 * which is why they share a collection rather than forking the send path in
 * two.
 */
// Expo tokens carry no encryption keys, so the requirement is conditional.
function requiredForWeb() {
  return this.kind !== "EXPO";
}

const schema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    kind: { type: String, enum: ["WEB", "EXPO"], default: "WEB", index: true },
    // For WEB this is the push service endpoint; for EXPO, the device token.
    endpoint: { type: String, required: true, unique: true },
    keys: {
      p256dh: { type: String, required: requiredForWeb },
      auth: { type: String, required: requiredForWeb },
    },
    userAgent: { type: String, default: "", maxlength: 400 },
    lastSentAt: { type: Date, default: null },
    failureCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

module.exports = mongoose.model("PushSubscription", schema);
