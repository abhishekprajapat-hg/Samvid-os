import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { Screen } from "../../components/common/Screen";
import { useAuth } from "../../context/AuthContext";
import {
  DEFAULT_SYSTEM_SETTINGS,
  readSystemSettings,
  resetSystemSettings,
  writeSystemSettings,
} from "../../utils/systemSettings";

export const SystemSettingsScreen = () => {
  const { role } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savedSnapshot, setSavedSnapshot] = useState(JSON.stringify(DEFAULT_SYSTEM_SETTINGS));
  const [saveState, setSaveState] = useState<"idle" | "saved">("idle");
  const [settings, setSettings] = useState(DEFAULT_SYSTEM_SETTINGS);

  useEffect(() => {
    readSystemSettings()
      .then((row) => {
        setSettings(row);
        setSavedSnapshot(JSON.stringify(row));
      })
      .catch(() => setError("Failed to load settings"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (saveState !== "saved") return;
    const timer = setTimeout(() => setSaveState("idle"), 1600);
    return () => clearTimeout(timer);
  }, [saveState]);

  const isDirty = useMemo(() => JSON.stringify(settings) !== savedSnapshot, [settings, savedSnapshot]);

  const updateGroup = (group: "appearance" | "security" | "notifications", key: string, value: any) => {
    setSettings((prev: any) => ({
      ...prev,
      [group]: {
        ...prev[group],
        [key]: value,
      },
    }));
  };

  const save = async () => {
    try {
      const saved = await writeSystemSettings(settings);
      setSettings(saved);
      setSavedSnapshot(JSON.stringify(saved));
      setSaveState("saved");
      setError("");
    } catch {
      setError("Failed to save settings");
    }
  };

  const restore = async () => {
    const saved = await readSystemSettings();
    setSettings(saved);
    setSavedSnapshot(JSON.stringify(saved));
    setSaveState("idle");
  };

  const factoryReset = async () => {
    const reset = await resetSystemSettings();
    setSettings(reset);
    setSavedSnapshot(JSON.stringify(reset));
    setSaveState("saved");
  };

  if (loading) {
    return (
      <Screen title="System Settings" subtitle="Loading..." loading>
        <View />
      </Screen>
    );
  }

  const canAccessSettings = role === "ADMIN" || role === "MANAGER";

  if (!canAccessSettings) {
    return (
      <Screen title="System Settings" subtitle="Access Denied">
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <Text style={{ color: "#d64545", fontWeight: "600" }}>Access denied. Only ADMIN/MANAGER can configure system settings.</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen title="System Settings" subtitle="Runtime + Security" loading={loading} error={error}>
      <View style={styles.card}>
        <View style={styles.topRow}>
          <Text style={styles.title}>System Controls</Text>
          <Text style={[styles.badge, isDirty ? styles.badgeWarn : styles.badgeOk]}>{isDirty ? "Unsaved" : "Saved"}</Text>
        </View>

        <Text style={styles.section}>Accessibility & UI</Text>
        <SettingRow
          label="Compact Tables"
          value={settings.appearance.compactTables}
          onChange={(next) => updateGroup("appearance", "compactTables", next)}
        />
        <SettingRow
          label="Reduce Motion"
          value={settings.appearance.reduceMotion}
          onChange={(next) => updateGroup("appearance", "reduceMotion", next)}
        />
        <SettingRow
          label="High Contrast"
          value={settings.appearance.highContrast}
          onChange={(next) => updateGroup("appearance", "highContrast", next)}
        />

        <Text style={styles.section}>Notifications</Text>
        <SettingRow
          label="Lead Alerts"
          value={settings.notifications.leadAlerts}
          onChange={(next) => updateGroup("notifications", "leadAlerts", next)}
        />
        <SettingRow
          label="Chat Alerts"
          value={settings.notifications.chatAlerts}
          onChange={(next) => updateGroup("notifications", "chatAlerts", next)}
        />
        <SettingRow
          label="Inventory Alerts"
          value={settings.notifications.inventoryAlerts}
          onChange={(next) => updateGroup("notifications", "inventoryAlerts", next)}
        />

        <Text style={styles.section}>Session Security</Text>
        <View style={styles.timeoutWrap}>
          {[
            { label: "15m", value: "15" },
            { label: "30m", value: "30" },
            { label: "1h", value: "60" },
            { label: "2h", value: "120" },
            { label: "4h", value: "240" },
          ].map((row) => {
            const active = settings.security.sessionTimeoutMinutes === row.value;
            return (
              <Pressable
                key={row.value}
                onPress={() => updateGroup("security", "sessionTimeoutMinutes", row.value)}
                style={[styles.timeoutChip, active && styles.timeoutChipActive]}
              >
                <Text style={[styles.timeoutChipText, active && styles.timeoutChipTextActive]}>{row.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {saveState === "saved" ? <Text style={styles.savedText}>Settings saved</Text> : null}

        <View style={styles.buttonRow}>
          <Pressable style={[styles.button, styles.ghostBtn]} onPress={restore}>
            <Text style={[styles.buttonText, styles.ghostBtnText]}>Restore</Text>
          </Pressable>
          <Pressable style={[styles.button, styles.ghostBtn]} onPress={factoryReset}>
            <Text style={[styles.buttonText, styles.ghostBtnText]}>Reset</Text>
          </Pressable>
          <Pressable style={[styles.button, !isDirty && styles.buttonDisabled]} onPress={save} disabled={!isDirty}>
            <Text style={styles.buttonText}>Save</Text>
          </Pressable>
        </View>

      </View>
    </Screen>
  );
};

const SettingRow = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) => (
  <View style={styles.row}>
    <Text style={styles.label}>{label}</Text>
    <Switch value={value} onValueChange={onChange} />
  </View>
);

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: "#e0e5ed",
    borderRadius: 12,
    backgroundColor: "#fff",
    padding: 12,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  title: {
    color: "#161c24",
    fontWeight: "700",
  },
  badge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    overflow: "hidden",
  },
  badgeOk: {
    color: "#084f36",
    borderColor: "#6ecdaa",
    backgroundColor: "#e8f7f0",
  },
  badgeWarn: {
    color: "#614304",
    borderColor: "#eebf51",
    backgroundColor: "#fdf4e3",
  },
  section: {
    marginTop: 10,
    marginBottom: 4,
    fontWeight: "700",
    color: "#39424f",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.9,
  },
  row: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#edf0f5",
  },
  label: {
    color: "#161c24",
    fontWeight: "600",
  },
  timeoutWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 6,
  },
  timeoutChip: {
    borderWidth: 1,
    borderColor: "#c8d0dd",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#fff",
  },
  timeoutChipActive: {
    borderColor: "#161c24",
    backgroundColor: "#161c24",
  },
  timeoutChipText: {
    color: "#39424f",
    fontWeight: "600",
    fontSize: 11,
  },
  timeoutChipTextActive: {
    color: "#fff",
  },
  savedText: {
    marginTop: 10,
    color: "#084f36",
    fontSize: 12,
    fontWeight: "600",
  },
  buttonRow: {
    marginTop: 12,
    flexDirection: "row",
    gap: 8,
  },
  button: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    backgroundColor: "#161c24",
    alignItems: "center",
    justifyContent: "center",
  },
  ghostBtn: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#c8d0dd",
  },
  ghostBtnText: {
    color: "#39424f",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
  },
});
