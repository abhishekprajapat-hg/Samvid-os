import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../../components/common/Screen";
import { AppCard } from "../../components/common/ui";
import { useAuth } from "../../context/AuthContext";

const Row = ({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) => (
  <Pressable style={styles.row} onPress={onPress}>
    <Text style={styles.rowText}>{label}</Text>
    <Ionicons name="chevron-forward" size={16} color="#64748b" />
  </Pressable>
);

export const MoreMenuScreen = ({ navigation }: any) => {
  const { role } = useAuth();
  const isAdmin = role === "ADMIN";
  const isManagement = role === "ADMIN" || role === "MANAGER" || role === "ASSISTANT_MANAGER" || role === "TEAM_LEADER";
  const open = (screen: string) => {
    const parent = navigation?.getParent?.();
    if (parent?.navigate) {
      parent.navigate(screen);
      return;
    }
    navigation.navigate(screen);
  };

  return (
    <Screen title="More" subtitle="Quick Access">
      <AppCard style={styles.card as object}>
        <Row label="Samvid Bot" onPress={() => open("Samvid Bot")} />
        {isManagement ? <Row label="Notifications" onPress={() => open("Notifications")} /> : null}
        <Row label="Profile" onPress={() => open("Profile")} />
        {isManagement ? <Row label="Users" onPress={() => open("Users")} /> : null}
        {isManagement ? <Row label="Settings" onPress={() => open("Settings")} /> : null}
        {isAdmin ? <Row label="Admin Console" onPress={() => open("AdminConsole")} /> : null}
        {isAdmin ? <Row label="Field Ops" onPress={() => open("Field Ops")} /> : null}
      </AppCard>
    </Screen>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: 12,
  },
  row: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowText: {
    color: "#0f172a",
    fontWeight: "600",
    fontSize: 13,
  },
});
