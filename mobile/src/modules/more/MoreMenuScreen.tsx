import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../../components/common/Screen";
import { AppCard } from "../../components/common/ui";
import { useAuth } from "../../context/AuthContext";
import { useRealtimeAlerts } from "../../context/RealtimeAlertsContext";
import type { UserRole } from "../../types";

export type MoreMenuItem = {
  label: string;
  screen: string;
  chatBadge?: boolean;
};

export const getMoreMenuItemsForRole = (role: UserRole | null): MoreMenuItem[] => {
  const isAdmin = role === "ADMIN" || role === "SUPER_ADMIN";
  const isManagement = isAdmin || role === "MANAGER";
  const isChannelPartner = role === "CHANNEL_PARTNER";

  return [
    { label: "Samvid Assistant", screen: "Samvid Assistant" },
    ...(isAdmin ? [{ label: "Chat", screen: "Chat", chatBadge: true }] : []),
    { label: "Profile", screen: "Profile" },
    { label: "Tasks", screen: "Tasks" },
    ...(isManagement ? [{ label: "Users", screen: "Users" }] : []),
    { label: "Leaderboard", screen: "Leaderboard" },
    ...(!isChannelPartner ? [{ label: "Attendance", screen: "Attendance" }] : []),
    ...(isManagement ? [{ label: "Reports", screen: "Reports" }] : []),
    ...(!isChannelPartner ? [{ label: "Finance", screen: "Finance" }] : []),
    { label: "Targets", screen: "Targets" },
    { label: "Calendar", screen: "Calendar" },
    ...(isManagement ? [{ label: "Settings", screen: "Settings" }] : []),
    ...(isManagement ? [{ label: "Meta Ads", screen: "MetaAds" }] : []),
    ...(isAdmin ? [{ label: "Field Ops", screen: "Field Ops" }] : []),
  ];
};

const Row = ({
  label,
  badgeCount = 0,
  onPress,
}: {
  label: string;
  badgeCount?: number;
  onPress: () => void;
}) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={label}
    testID={`more-menu-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`}
    style={styles.row}
    onPress={onPress}
  >
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
  const menuItems = getMoreMenuItemsForRole(role);
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
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        <AppCard style={styles.card as object}>
          {menuItems.map((item) => item.chatBadge ? (
            <Row
              key={item.screen}
              label={item.label}
              badgeCount={chatUnreadTotal}
              onPress={() => {
                markAllChatRead();
                open(item.screen);
              }}
            />
          ) : (
            <Row key={item.screen} label={item.label} onPress={() => open(item.screen)} />
          ))}
        </AppCard>
      </ScrollView>
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
