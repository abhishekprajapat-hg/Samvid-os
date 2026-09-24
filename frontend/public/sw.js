/*
 * Service worker: the part of the CRM that runs when nobody has it open.
 *
 * Its only jobs are push and replying to push. It deliberately does not cache
 * anything: an offline cache for a CRM whose every screen is live data would
 * serve yesterday's leads and yesterday's cabin bookings, which is worse than
 * an error. If offline support is ever wanted it needs its own thinking, not a
 * default.
 */

const ICON = "/favicon.png";
const BADGE = "/favicon.png";

/*
 * The direct /api mount, not the /api/client one the app's axios uses. A worker
 * cannot read import.meta.env, and both mounts serve this route (see
 * routes/client.routes.js), so the path that does not depend on the frontend's
 * configured base URL is the one that cannot drift out of sync with it.
 */
const REPLY_ENDPOINT = "/api/push/reply";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "Samvid OS", body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "Samvid OS";
  const data = { url: payload.url || "/", ...(payload.data || {}) };

  /*
   * A text action turns the drawer entry into a reply box on Android Chrome.
   * Only offered when the payload carried a reply token, because only a chat
   * message is a thing you can reply to - a task or a lead alert is not.
   * Platforms without text actions (iOS, and some desktop builds) ignore this
   * and just show the notification, which is why notificationclick below still
   * has to cope with a "reply" that arrives with no text.
   */
  const actions = data.replyToken
    ? [{ action: "reply", type: "text", title: "Reply", placeholder: "Type a reply" }]
    : [];

  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || "",
      icon: ICON,
      badge: BADGE,
      // Same tag replaces rather than stacks, so ten messages in one chat are
      // one notification that updates instead of ten to swipe away.
      tag: payload.tag || undefined,
      renotify: Boolean(payload.tag),
      actions,
      data,
    }),
  );
});

/*
 * Posts the reply the person typed in the drawer.
 *
 * Success is silent: the drawer entry closing is the confirmation, and a
 * "sent!" notification for something you just watched send is noise. Failure is
 * not silent - a typed message that vanishes with no trace is the worst
 * outcome here, so the text comes back in a notification the person can read
 * and retype rather than being swallowed.
 */
const sendReply = async (data, text) => {
  try {
    const response = await fetch(REPLY_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: data.replyToken, text }),
    });
    if (!response.ok) throw new Error(`reply failed: ${response.status}`);
  } catch {
    await self.registration.showNotification("Reply not sent", {
      body: text,
      icon: ICON,
      badge: BADGE,
      // A tag of its own so the failure cannot quietly replace, or be replaced
      // by, the conversation's own notification.
      tag: `${data.tag || "chat"}:reply-failed`,
      data: { url: data.url || "/chat" },
    });
  }
};

const openApp = async (target) => {
  /*
   * Focus the app if it is already open rather than opening a second copy, and
   * navigate the existing window to whatever the notification was about.
   */
  const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  for (const client of all) {
    if ("focus" in client) {
      await client.focus();
      if ("navigate" in client && target) {
        try { await client.navigate(target); } catch { /* cross-origin or blocked */ }
      }
      return;
    }
  }
  if (self.clients.openWindow) await self.clients.openWindow(target);
};

self.addEventListener("notificationclick", (event) => {
  const data = event.notification.data || {};
  const target = data.url || "/";

  if (event.action === "reply") {
    const text = String(event.reply || "").trim();
    if (text && data.replyToken) {
      event.notification.close();
      event.waitUntil(sendReply(data, text));
      return;
    }
    /*
     * A browser that rendered the text action as a plain button, or an empty
     * reply. Opening the chat is the only useful thing left to do.
     */
  }

  event.notification.close();
  event.waitUntil(openApp(target));
});
