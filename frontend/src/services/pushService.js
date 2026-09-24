import api from "./api";

/*
 * Turning phone notifications on for this device.
 *
 * Three things have to line up and any of them can be the reason it does not
 * work, so each is reported separately rather than as one "failed": the browser
 * has to support push at all, the person has to grant permission, and the
 * server has to have VAPID keys. A single error message here would send someone
 * hunting through the wrong one.
 */

const urlBase64ToUint8Array = (base64String) => {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
};

export const isPushSupported = () =>
  typeof window !== "undefined"
  && "serviceWorker" in navigator
  && "PushManager" in window
  && "Notification" in window;

export const getPermission = () => (isPushSupported() ? Notification.permission : "unsupported");

/*
 * iOS only delivers push to an app added to the Home Screen, and only from
 * Safari. Detected so the UI can say that instead of showing a button that
 * cannot work.
 */
export const isIosWithoutHomeScreen = () => {
  if (typeof window === "undefined") return false;
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = window.navigator.standalone === true
    || window.matchMedia?.("(display-mode: standalone)")?.matches;
  return ios && !standalone;
};

export const registerServiceWorker = async () => {
  if (!isPushSupported()) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch {
    return null;
  }
};

/*
 * Whether THIS device holds a live subscription.
 *
 * Distinct from Notification.permission on purpose: permission is granted to
 * the origin and survives everything, so a device can sit at "granted" while
 * holding no subscription at all - after the server's records were cleared, or
 * after the subscription was dropped by the browser. Deciding the UI on
 * permission alone strands exactly that device, showing it "turn off" and no
 * way back on.
 */
export const isSubscribedOnThisDevice = async () => {
  if (!isPushSupported()) return false;
  try {
    const registration = await navigator.serviceWorker.getRegistration("/");
    return Boolean(await registration?.pushManager?.getSubscription());
  } catch {
    return false;
  }
};

export const getPushStatus = async () => (await api.get("/push/status")).data;

export const enablePush = async () => {
  if (!isPushSupported()) {
    throw new Error("This browser cannot receive push notifications.");
  }

  const { data } = await api.get("/push/public-key");
  if (!data.enabled || !data.publicKey) {
    throw new Error("Push notifications are not configured on the server yet.");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error(
      permission === "denied"
        ? "Notifications are blocked for this site. Allow them in your browser settings, then try again."
        : "Notification permission was not granted.",
    );
  }

  const registration = (await navigator.serviceWorker.getRegistration("/"))
    || (await registerServiceWorker());
  if (!registration) throw new Error("Could not start the background service for notifications.");
  await navigator.serviceWorker.ready;

  // An existing subscription is reused: re-subscribing would issue a new
  // endpoint and quietly leave the old one on the server, ringing twice.
  const subscription = (await registration.pushManager.getSubscription())
    || (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(data.publicKey),
    }));

  const raw = subscription.toJSON();
  await api.post("/push/subscribe", { endpoint: raw.endpoint, keys: raw.keys });
  return { endpoint: raw.endpoint };
};

export const disablePush = async () => {
  const registration = await navigator.serviceWorker?.getRegistration("/");
  const subscription = await registration?.pushManager?.getSubscription();
  if (subscription) {
    await api.post("/push/unsubscribe", { endpoint: subscription.endpoint }).catch(() => {});
    await subscription.unsubscribe().catch(() => {});
  }
};

export const sendTestPush = async () => (await api.post("/push/test")).data;
