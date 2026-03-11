import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../../components/common/Screen";
import { AppCard } from "../../components/common/ui";
import { useAuth } from "../../context/AuthContext";
import { useRealtimeAlerts } from "../../context/RealtimeAlertsContext";

const Row = ({
  label,
  badgeCount = 0,
  onPress,
}: {
  label: string;
  badgeCount?: number;
  onPress: () => void;
}) => (
  <Pressable style={styles.row} onPress={onPress}>
    <Text style={styles.rowText}>{label}</Text>
    <View style={styles.rowRight}>
      {badgeCount > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badgeCount > 99 ? "99+" : badgeCount}</Text>
        </View>
      ) : null}
      <Ionicons name="chevron-forward" size={16} color="#64748b" />
    </View>
  </Pressable>
);

export const MoreMenuScreen = ({ navigation }: any) => {
  const { role } = useAuth();
  const { chatUnreadTotal, markAllChatRead } = useRealtimeAlerts();
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
        {isAdmin ? (
          <Row
            label="Chat"
            badgeCount={chatUnreadTotal}
            onPress={() => {
              markAllChatRead();
              open("Chat");
            }}
          />
        ) : null}
        <Row label="Profile" onPress={() => open("Profile")} />
        {isManagement ? <Row label="Users" onPress={() => open("Users")} /> : null}
        {isManagement ? <Row label="Settings" onPress={() => open("Settings")} /> : null}
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
  rowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  rowText: {
    color: "#0f172a",
    fontWeight: "600",
    fontSize: 13,
  },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0f172a",
  },
  badgeText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "700",
  },
});
