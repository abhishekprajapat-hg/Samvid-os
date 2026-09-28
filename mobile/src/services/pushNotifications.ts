import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
 * "Turn off on this device" has to survive a relaunch. Without a remembered
 * choice the automatic registration at sign-in would quietly turn it back on -
 * the phone equivalent of a browser that keeps its permission but has had its
 * subscription removed.
 */
const OPT_OUT_KEY = "pushOptOut:v1";
const isOptedOut = async () => (await AsyncStorage.getItem(OPT_OUT_KEY).catch(() => null)) === "1";

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
    if (await isOptedOut()) return;
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
/*
 * A reminder the device raises by itself at a given moment.
 *
 * The task model has no reminder column, so this is the honest half of the
 * comp's control: it holds on this device only, and does not follow the task
 * to anyone else it is assigned to. Stated on the control itself.
 */
export async function scheduleLocalReminder(
  at: Date,
  payload: { title: string; body: string; data?: NotificationPayload },
): Promise<void> {
  try {
    const seconds = Math.round((at.getTime() - Date.now()) / 1000);
    if (seconds <= 0) return;
    await Notifications.scheduleNotificationAsync({
      content: { title: payload.title, body: payload.body, data: payload.data || {} },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds, repeats: false },
    });
  } catch {
    // A reminder that could not be scheduled must not fail the save that
    // asked for it - the task itself is already written.
  }
}

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

/*
 * A scheduled reminder that can be taken back. Follow-up reminders need this:
 * a follow-up that is rescheduled or closed must not still ring at its old
 * time. Resolves to the notification id, or null when it could not be set.
 */
export async function scheduleCancellableReminder(
  at: Date,
  payload: { title: string; body: string; data?: NotificationPayload },
): Promise<string | null> {
  try {
    const seconds = Math.round((at.getTime() - Date.now()) / 1000);
    if (seconds <= 0) return null;
    return await Notifications.scheduleNotificationAsync({
      content: { title: payload.title, body: payload.body, data: payload.data || {} },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds, repeats: false },
    });
  } catch {
    return null;
  }
}

export async function cancelScheduledReminder(id: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // Already fired or already gone.
  }
}

/* Signing out takes this device's scheduled reminders with it - they belong to
   the person who signed out, not to whoever signs in next. */
export async function cancelAllScheduledReminders(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    // Nothing scheduled, or notifications unavailable on this platform.
  }
}


/* ------------------------------------------------- device push controls -- */
/*
 * The phone's counterpart of web's PushNotificationCard: whether this device
 * is registered, turning it on and off, and a test send. Deliberately per
 * device, as web's is - permission is granted by the device you are holding.
 */

export type DevicePushPermission = "granted" | "denied" | "undetermined" | "unsupported";

export async function getDevicePushPermission(): Promise<DevicePushPermission> {
  if (Platform.OS === "web" || !Device.isDevice) return "unsupported";
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status === "granted" ? "granted" : status === "denied" ? "denied" : "undetermined";
  } catch {
    return "unsupported";
  }
}

export const isRegisteredOnThisDevice = () => Boolean(registeredToken);

export async function getPushStatus(): Promise<{ enabled: boolean; devices: number }> {
  const res = await api.get("/push/status");
  return { enabled: Boolean(res.data?.enabled), devices: Number(res.data?.devices || 0) };
}

/** Turns push on for this device, saying why when it cannot. */
export async function enablePushOnThisDevice(): Promise<void> {
  if (Platform.OS === "web" || !Device.isDevice) {
    throw new Error("Push notifications need a physical phone.");
  }
  await AsyncStorage.removeItem(OPT_OUT_KEY).catch(() => {});
  await ensureAndroidChannel();

  let { status, canAskAgain } = await Notifications.getPermissionsAsync();
  if (status !== "granted") {
    if (!canAskAgain) {
      throw new Error("Notifications are blocked for this app. Allow them in your phone's settings, then try again.");
    }
    ({ status } = await Notifications.requestPermissionsAsync());
  }
  if (status !== "granted") {
    throw new Error("Notifications were not allowed on this phone.");
  }

  const id = projectId();
  const tokenResponse = await Notifications.getExpoPushTokenAsync(id ? { projectId: id } : undefined);
  const token = String(tokenResponse?.data || "").trim();
  if (!token) throw new Error("This phone did not return a push token.");
  await api.post("/push/subscribe", { kind: "EXPO", token });
  registeredToken = token;
}

/** Turns push off for this device and remembers the choice. */
export async function disablePushOnThisDevice(): Promise<void> {
  await AsyncStorage.setItem(OPT_OUT_KEY, "1").catch(() => {});
  await removeNotificationRegistration();
}

export async function sendTestPush(): Promise<{ message: string }> {
  const res = await api.post("/push/test");
  return { message: String(res.data?.message || "Test notification sent.") };
}
