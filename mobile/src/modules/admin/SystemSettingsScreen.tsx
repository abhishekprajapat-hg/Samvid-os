import React, { useState } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { Screen } from "../../components/common/Screen";

export const SystemSettingsScreen = () => {
  const [leadAlerts, setLeadAlerts] = useState(true);
  const [chatAlerts, setChatAlerts] = useState(true);
  const [inventoryAlerts, setInventoryAlerts] = useState(true);

  return (
    <Screen title="System Settings" subtitle="App Preferences">
      <View style={styles.card}>
        <SettingRow label="Lead Alerts" value={leadAlerts} onChange={setLeadAlerts} />
        <SettingRow label="Chat Alerts" value={chatAlerts} onChange={setChatAlerts} />
        <SettingRow label="Inventory Alerts" value={inventoryAlerts} onChange={setInventoryAlerts} />

        <Pressable style={styles.button}>
          <Text style={styles.buttonText}>Save Settings</Text>
        </Pressable>
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
    borderColor: "#e2e8f0",
    borderRadius: 12,
    backgroundColor: "#fff",
    padding: 12,
  },
  row: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  label: {
    color: "#0f172a",
    fontWeight: "600",
  },
  button: {
    marginTop: 12,
    height: 42,
    borderRadius: 10,
    backgroundColor: "#0f172a",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
  },
});