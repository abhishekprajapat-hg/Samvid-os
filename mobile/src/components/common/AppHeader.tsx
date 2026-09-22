import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Icon } from "../ui/Icon";
import { useAuth } from "../../context/AuthContext";
import { useRealtimeAlerts } from "../../context/RealtimeAlertsContext";
import { radii, spacing, typography } from "../../theme/tokens";
import { themedStyles, themePalette } from "../../theme/themedStyles";

/*
 * The app bar every tab sits under: the wordmark, an alert bell and the
 * signed-in person's avatar.
 *
 * It is registered as the navigator's `header`, not rendered inside each
 * screen, which is what keeps it identical across tabs and lets React
 * Navigation go on treating the top inset as consumed. A custom header gets no
 * safe-area handling of its own, so the inset is applied here by hand.
 *
 * The bell carries a dot rather than a count. The count lives on the More tab
 * badge already, and the comp draws a dot.
 */

const initialsOf = (name = "") =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "NA";

export const AppHeader = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const { notificationUnreadTotal } = useRealtimeAlerts();
  const hasAlerts = Number(notificationUnreadTotal || 0) > 0;
  const avatarUrl = user?.profileImageUrl;

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.md }]}>
      <Image
        source={require("../../../assets/brand-wordmark.png")}
        style={styles.logo}
        resizeMode="contain"
        accessibilityLabel="Office on Rent"
      />

      <View style={styles.actions}>
        <Pressable
          style={styles.bell}
          onPress={() => navigation.navigate("Notifications")}
          accessibilityRole="button"
          accessibilityLabel={hasAlerts ? "Notifications, unread" : "Notifications"}
          hitSlop={6}
        >
          <Icon name="notifications" size={20} color={themePalette.slate[700]} />
          {hasAlerts ? <View style={styles.bellDot} /> : null}
        </Pressable>

        <Pressable
          style={styles.avatar}
          onPress={() => navigation.navigate("Profile")}
          accessibilityRole="button"
          accessibilityLabel="Your profile"
          hitSlop={6}
        >
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarText}>{initialsOf(user?.name)}</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
};

const styles = themedStyles((c) => StyleSheet.create({
  root: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
    backgroundColor: c.bg,
  },
  logo: {
    width: 84,
    height: 40,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
  },
  bell: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.surfaceMuted,
    borderWidth: 1,
    borderColor: c.border,
  },
  bellDot: {
    position: "absolute",
    top: 8,
    right: 9,
    width: 9,
    height: 9,
    borderRadius: radii.pill,
    backgroundColor: c.rose[500],
    borderWidth: 1.5,
    borderColor: c.surface,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: c.blue[600],
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarText: {
    fontSize: typography.section,
    fontWeight: "700",
    color: "#ffffff",
  },
}));

export default AppHeader;
