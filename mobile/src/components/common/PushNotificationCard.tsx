import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { AppButton, AppCard } from "./ui";
import { Icon } from "../ui/Icon";
import {
  disablePushOnThisDevice,
  enablePushOnThisDevice,
  getDevicePushPermission,
  getPushStatus,
  isRegisteredOnThisDevice,
  sendTestPush,
  type DevicePushPermission,
} from "../../services/pushNotifications";
import { toErrorMessage } from "../../utils/errorMessage";
import { themedStyles, themeColor } from "../../theme/themedStyles";

/*
 * Turning on phone notifications, per device - web's PushNotificationCard.
 *
 * "On" means this phone actually holds a registration, not merely that the
 * phone would permit one; the count of other registered devices is shown
 * separately so someone can tell "this phone is off" from "nothing anywhere".
 *
 * Web's two extra warnings do not apply here: the iOS "add to Home Screen"
 * step is a browser limitation, and the server's VAPID keys are for browser
 * push only - a phone registers through Expo and needs neither.
 */
export const PushNotificationCard = () => {
  const [permission, setPermission] = useState<DevicePushPermission>("undetermined");
  const [registered, setRegistered] = useState(isRegisteredOnThisDevice());
  const [devices, setDevices] = useState<number | null>(null);
  const [busy, setBusy] = useState<"" | "enable" | "disable" | "test">("");
  const [message, setMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  const refresh = useCallback(() => {
    getDevicePushPermission().then(setPermission);
    setRegistered(isRegisteredOnThisDevice());
    getPushStatus()
      .then((status) => setDevices(status.devices))
      .catch(() => setDevices(null));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const run = async (kind: "enable" | "disable" | "test", action: () => Promise<string>) => {
    setBusy(kind);
    setMessage(null);
    try {
      const text = await action();
      setMessage({ type: kind === "disable" ? "info" : "success", text });
      refresh();
    } catch (error) {
      setMessage({ type: "error", text: toErrorMessage(error, "Something went wrong.") });
    } finally {
      setBusy("");
    }
  };

  const active = permission === "granted" && registered;
  const unsupported = permission === "unsupported";

  return (
    <AppCard style={styles.card as object}>
      <View style={styles.head}>
        <View style={styles.icon}>
          <Icon name="notifications" size={17} color={themeColor("#2549d6")} />
        </View>
        <View style={styles.headText}>
          <Text style={styles.title}>Phone notifications</Text>
          <Text style={styles.subtitle}>
            Get told about new tasks, messages and leads even when the app is closed
          </Text>
        </View>
      </View>

      <Text style={styles.status}>
        {active ? "On for this device" : "Off for this device"}
        {devices !== null ? ` · ${devices} device${devices === 1 ? "" : "s"} registered to your account` : ""}
      </Text>

      {unsupported ? (
        <Text style={styles.note}>Push notifications need a physical phone. They cannot be turned on here.</Text>
      ) : permission === "denied" && !active ? (
        <Text style={styles.note}>
          Notifications are blocked for this app. Allow them in your phone's settings, then turn them on here.
        </Text>
      ) : null}

      {message ? (
        <Text
          style={[
            styles.message,
            message.type === "error" ? styles.messageError : message.type === "success" ? styles.messageSuccess : null,
          ]}
        >
          {message.text}
        </Text>
      ) : null}

      <View style={styles.actions}>
        {active ? (
          <AppButton
            title={busy === "disable" ? "Turning off..." : "Turn off on this device"}
            variant="secondary"
            disabled={Boolean(busy)}
            onPress={() =>
              run("disable", async () => {
                await disablePushOnThisDevice();
                return "This device will no longer receive notifications.";
              })
            }
          />
        ) : (
          <AppButton
            title={busy === "enable" ? "Turning on..." : "Turn on for this device"}
            disabled={Boolean(busy) || unsupported}
            onPress={() =>
              run("enable", async () => {
                await enablePushOnThisDevice();
                return "This device will now receive notifications.";
              })
            }
          />
        )}
        {active ? (
          <AppButton
            title={busy === "test" ? "Sending..." : "Send a test"}
            variant="ghost"
            disabled={Boolean(busy)}
            onPress={() => run("test", async () => (await sendTestPush()).message)}
          />
        ) : null}
      </View>
    </AppCard>
  );
};

const styles = themedStyles((c) =>
  StyleSheet.create({
    card: { marginBottom: 12, gap: 8 },
    head: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
    icon: {
      width: 34,
      height: 34,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.blue[50],
    },
    headText: { flex: 1, minWidth: 0 },
    title: { fontSize: 14, fontWeight: "700", color: c.text },
    subtitle: { marginTop: 2, fontSize: 12, lineHeight: 17, color: c.textMuted },
    status: { fontSize: 12, fontWeight: "600", color: c.slate[700] },
    note: { fontSize: 12, lineHeight: 17, color: c.amber[800] },
    message: {
      padding: 8,
      borderRadius: 8,
      fontSize: 12,
      color: c.slate[700],
      backgroundColor: c.surfaceMuted,
      overflow: "hidden",
    },
    messageError: { color: c.rose[700], backgroundColor: c.errorBg },
    messageSuccess: { color: c.emerald[800], backgroundColor: c.emerald[50] },
    actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  }),
);
