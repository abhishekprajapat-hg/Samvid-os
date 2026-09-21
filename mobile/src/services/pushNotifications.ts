import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import api from "./api";

/*
 * Native push, through Expo.
 *
 * This file used to be a set of console.log stubs while RootNavigator called it
 * as though it worked - the app asked for a token, registered a tap listener
 * and got nothing. It is real now.
 *
 * The backend keeps browser subscriptions and Expo devices in one collection
 * and fans out to both (backend/src/services/push.service.js). Expo needs no
 * server credentials, so a deployment without VAPID keys can still reach a
 * phone even though its web push is switched off.
 */

// Foreground behaviour: web shows an in-app toast, so a banner here as well
// would say the same thing twice. Sound and badge still fire.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: false,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

const projectId = () =>
  (Constants.expoConfig?.extra as { eas?: { projectId?: string } })?.eas?.projectId
  || (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId
  || "";

let registeredToken: string | null = null;

/*
 * Android needs a channel before anything can be delivered, and the channel
 * carries the importance that decides whether a notification makes a sound at
 * all. "default" matches the channelId the server sends.
 */
const ensureAndroidChannel = async () => {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("default", {
    name: "Alerts",
    importance: Notifications.AndroidImportance.DEFAULT,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
    sound: "default",
  });
};

/** Asks for permission, gets a token, and registers it. Never throws. */
export async function ensureNotificationSetup(): Promise<void> {
  try {
    await ensureAndroidChannel();

    // A simulator cannot receive push, and asking there just logs a confusing
    // permission error.
    if (!Device.isDevice) return;

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== "granted") {
      const asked = await Notifications.requestPermissionsAsync();
      status = asked.status;
    }
    if (status !== "granted") return;

    const id = projectId();
    const tokenResponse = await Notifications.getExpoPushTokenAsync(
      id ? { projectId: id } : undefined,
    );
    const token = String(tokenResponse?.data || "").trim();
    if (!token || token === registeredToken) return;

    await api.post("/push/subscribe", { kind: "EXPO", token });
    registeredToken = token;
  } catch {
    /*
     * Push is a convenience, not a precondition. A refused permission, a
     * missing projectId or an offline registration must never stop someone
     * using the app - the same stance the server takes when a send fails.
     */
  }
}

/** Removes this device so it stops receiving alerts. Used on logout. */
export async function removeNotificationRegistration(): Promise<void> {
  if (!registeredToken) return;
  try {
    await api.post("/push/unsubscribe", { endpoint: registeredToken });
  } catch {
    // The row expires on its own once Expo reports the token as dead.
  } finally {
    registeredToken = null;
  }
}

export type NotificationPayload = {
  url?: string;
  conversationId?: string;
  contactId?: string;
  contactName?: string;
  contactRole?: string;
  contactAvatar?: string;
  [key: string]: unknown;
};

/**
 * Fires when someone taps a notification, including when that tap is what
 * launched the app - `getLastNotificationResponseAsync` covers the cold start
 * that the listener alone would miss.
 */
export function registerNotificationTapListener(
  callback: (payload: NotificationPayload) => void,
): { remove: () => void } {
  let active = true;

  const handle = (response: Notifications.NotificationResponse | null) => {
    if (!active || !response) return;
    const data = (response.notification.request.content.data || {}) as NotificationPayload;
    callback(data);
  };

  Notifications.getLastNotificationResponseAsync().then(handle).catch(() => {});
  const subscription = Notifications.addNotificationResponseReceivedListener(handle);

  return {
    remove: () => {
      active = false;
      subscription.remove();
    },
  };
}

/** Replies straight from the notification, matching the web drawer's reply. */
export async function replyFromNotification(payload: {
  conversationId: string;
  message: string;
  token?: string;
}): Promise<void> {
  await api.post("/push/reply", payload);
}

/*
 * Kept for the call sites that already use it. Chat alerts are delivered by the
 * server now, so raising a local notification here as well would double up -
 * this only schedules one when the app itself needs to say something.
 */
export async function notifyLocally(payload: { title: string; body: string; data?: NotificationPayload }): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title: payload.title, body: payload.body, data: payload.data || {} },
      trigger: null,
    });
  } catch {
    // Not worth surfacing; the in-app toast has already said it.
  }
}
