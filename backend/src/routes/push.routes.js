const router = require("express").Router();
const Subscription = require("../models/PushSubscription");
const { protect } = require("../middleware/auth.middleware");
const { requireCompanyContext } = require("../middleware/company.middleware");
const { writeLimiter } = require("../middleware/rateLimit.middleware");
const { isPushConfigured, getPublicKey, sendToUser } = require("../services/push.service");
const { replyFromNotification } = require("../controllers/chat.controller");

/*
 * Device registration for push notifications.
 *
 * Deliberately not behind a page permission: this is about the device a person
 * is holding, not about anything they can see in the CRM. Anyone who can log in
 * can ask to be told when something happens to them.
 */
/*
 * Replying from the notification drawer sits ABOVE protect on purpose.
 *
 * A service worker has no session to present - the access token is in
 * localStorage, out of its reach - so this route authenticates on the
 * single-purpose token that came down inside the push payload. Everything
 * below this line is ordinary, session-authenticated CRM API.
 */
router.post("/reply", writeLimiter, replyFromNotification);

router.use(protect);
router.use(requireCompanyContext);

// The browser needs this before it can subscribe. Public by design - it is the
// public half of the VAPID pair.
router.get("/public-key", (req, res) => {
  res.json({ enabled: isPushConfigured(), publicKey: getPublicKey() });
});

router.get("/status", async (req, res) => {
  try {
    const devices = await Subscription.countDocuments({ userId: req.user._id });
    res.json({ enabled: isPushConfigured(), devices });
  } catch (error) {
    req.log?.error(error);
    res.status(500).json({ message: "Could not read notification settings" });
  }
});

router.post("/subscribe", writeLimiter, async (req, res) => {
  try {
    if (!isPushConfigured()) {
      return res.status(503).json({ message: "Push notifications are not configured on the server" });
    }
    const { endpoint, keys } = req.body || {};
    if (!endpoint || typeof endpoint !== "string" || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ message: "A push subscription with endpoint and keys is required" });
    }

    /*
     * Keyed on endpoint, not on user: a shared phone that a second person signs
     * in on must move the subscription to them, not leave the first person
     * receiving the second one's alerts.
     */
    const saved = await Subscription.findOneAndUpdate(
      { endpoint },
      {
        $set: {
          userId: req.user._id,
          companyId: req.user.companyId,
          keys: { p256dh: String(keys.p256dh), auth: String(keys.auth) },
          userAgent: String(req.headers["user-agent"] || "").slice(0, 400),
          failureCount: 0,
        },
      },
      { upsert: true, new: true, runValidators: true },
    );
    res.json({ message: "This device will now receive notifications", subscriptionId: saved._id });
  } catch (error) {
    if (error.code === 11000) return res.json({ message: "This device is already registered" });
    req.log?.error(error);
    res.status(500).json({ message: "Could not register this device" });
  }
});

router.post("/unsubscribe", writeLimiter, async (req, res) => {
  try {
    const endpoint = String(req.body?.endpoint || "");
    if (!endpoint) return res.status(400).json({ message: "An endpoint is required" });
    await Subscription.deleteOne({ endpoint, userId: req.user._id });
    res.json({ message: "This device will no longer receive notifications" });
  } catch (error) {
    req.log?.error(error);
    res.status(500).json({ message: "Could not remove this device" });
  }
});

// Lets someone confirm the whole chain works from their own phone, rather than
// waiting for a real event and wondering whether it was the setup or the event.
router.post("/test", writeLimiter, async (req, res) => {
  try {
    const result = await sendToUser(req.user._id, {
      title: "Samvid OS",
      body: "Notifications are working on this device.",
      url: "/",
      tag: "push-test",
    });
    if (!result.sent) {
      return res.status(400).json({
        message: result.removed
          ? "This device's permission was revoked. Turn notifications on again."
          : "No registered device received it. Enable notifications on this device first.",
        ...result,
      });
    }
    res.json({ message: `Sent to ${result.sent} device(s)`, ...result });
  } catch (error) {
    req.log?.error(error);
    res.status(500).json({ message: "Could not send the test notification" });
  }
});

module.exports = router;
