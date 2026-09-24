const webpush = require("web-push");
const Subscription = require("../models/PushSubscription");
const logger = require("../config/logger");

/*
 * Push notifications to a phone.
 *
 * The CRM already tells people things over socket.io, but a socket only reaches
 * a tab that is open. The whole point of a notification is to reach someone who
 * is not looking at the screen, which is what this does.
 *
 * Push is best-effort by design. A phone that is off, a revoked permission or a
 * push service having a bad afternoon must never fail the action that triggered
 * the alert - assigning a task has to succeed whether or not the assignee's
 * phone rings. So every send here swallows its errors and reports rather than
 * throws, and callers do not await it.
 */

const publicKey = String(process.env.VAPID_PUBLIC_KEY || "").trim();
const privateKey = String(process.env.VAPID_PRIVATE_KEY || "").trim();
const contact = String(process.env.VAPID_CONTACT || "mailto:theofficeonrent.ws@gmail.com").trim();

const configured = Boolean(publicKey && privateKey);
if (configured) {
  webpush.setVapidDetails(contact, publicKey, privateKey);
} else {
  logger.warn({ message: "Push notifications disabled: VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY are not set" });
}

const isPushConfigured = () => configured;
const getPublicKey = () => publicKey;

// A push payload is capped (4KB on most services) and shown on a lock screen,
// so it carries a headline and a link, never a record.
const buildPayload = ({ title, body, url = "/", tag = "", data = {} }) => JSON.stringify({
  title: String(title || "Samvid OS").slice(0, 120),
  body: String(body || "").slice(0, 300),
  url: String(url || "/"),
  tag: String(tag || ""),
  data,
});

const GONE_STATUSES = new Set([404, 410]);

/**
 * Sends to every device a user has registered. Never throws.
 * @returns {Promise<{sent: number, removed: number, failed: number}>}
 */
const sendToUser = async (userId, notification) => {
  const result = { sent: 0, removed: 0, failed: 0 };
  if (!configured || !userId) return result;

  try {
    const subscriptions = await Subscription.find({ userId }).lean();
    if (!subscriptions.length) return result;

    const payload = buildPayload(notification);
    await Promise.all(subscriptions.map(async (row) => {
      try {
        await webpush.sendNotification(
          { endpoint: row.endpoint, keys: row.keys },
          payload,
          { TTL: 60 * 60 * 24 },
        );
        result.sent += 1;
        await Subscription.updateOne({ _id: row._id }, { $set: { lastSentAt: new Date(), failureCount: 0 } });
      } catch (error) {
        // The browser revoked this subscription; it will never work again.
        if (GONE_STATUSES.has(error?.statusCode)) {
          await Subscription.deleteOne({ _id: row._id });
          result.removed += 1;
          return;
        }
        result.failed += 1;
        await Subscription.updateOne({ _id: row._id }, { $inc: { failureCount: 1 } });
        logger.warn({ endpoint: row.endpoint.slice(0, 60), statusCode: error?.statusCode, message: "Push delivery failed" });
      }
    }));
  } catch (error) {
    logger.error({ error: error.message, message: "sendToUser failed" });
  }
  return result;
};

const sendToUsers = async (userIds = [], notification) => {
  const unique = [...new Set(userIds.map((id) => String(id || "")).filter(Boolean))];
  const results = await Promise.all(unique.map((id) => sendToUser(id, notification)));
  return results.reduce(
    (total, row) => ({ sent: total.sent + row.sent, removed: total.removed + row.removed, failed: total.failed + row.failed }),
    { sent: 0, removed: 0, failed: 0 },
  );
};

/*
 * Fire-and-forget. Callers use this so a slow or dead push service cannot hold
 * up the request that triggered it.
 */
const notify = (userId, notification) => {
  sendToUser(userId, notification).catch(() => {});
};

module.exports = { isPushConfigured, getPublicKey, sendToUser, sendToUsers, notify };
