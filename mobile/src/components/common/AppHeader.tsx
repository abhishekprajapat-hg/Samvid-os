import React, { useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Glyph } from "../ui/Glyph";
import { useAuth } from "../../context/AuthContext";
import { useRealtimeAlerts } from "../../context/RealtimeAlertsContext";
import { brand, brandStyles, layout, round, type } from "../../theme/brand";
import { GlobalPageSearch } from "./GlobalPageSearch";
import { toAbsoluteUrl } from "../../services/uploadService";

/*
 * The app bar every tab sits under, drawn to the comp: the mark and wordmark
 * with its strapline on the left, an alert bell and the signed-in person's
 * avatar on the right.
 *
 * It is registered as the navigator's `header` rather than rendered inside
 * each screen, which is what keeps it identical across tabs and lets React
 * Navigation go on treating the top inset as consumed. A custom header gets no
 * safe-area handling of its own, so the inset is applied here by hand.
 *
 * The bell carries a dot rather than a count: the count lives on the More tab
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
  const [searchVisible, setSearchVisible] = useState(false);

  return (
    <>
      <View style={[styles.root, { paddingTop: insets.top + 2 }]}>
        <View style={styles.brandRow}>
          <Glyph name="business" size={32} color={brand.deep} />
          <View style={styles.wordmarkWrap}>
            <Text style={styles.wordmark} numberOfLines={1}>
              Office on Rent
            </Text>
            <Text style={styles.tagline} numberOfLines={1}>
              Spaces. People. Progress.
            </Text>
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable
            onPress={() => setSearchVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Search pages"
            hitSlop={10}
          >
            <Glyph name="search-outline" size={23} color={brand.text} />
          </Pressable>

          <Pressable
            onPress={() => navigation.navigate("Notifications")}
            accessibilityRole="button"
            accessibilityLabel={hasAlerts ? "Notifications, unread" : "Notifications"}
            hitSlop={12}
          >
            <Glyph name="notifications-outline" size={24} color={brand.text} />
            {hasAlerts ? <View style={styles.bellDot} /> : null}
          </Pressable>

          <Pressable
            style={styles.avatar}
            onPress={() => navigation.navigate("Profile")}
            accessibilityRole="button"
            accessibilityLabel="Your profile"
            hitSlop={8}
          >
            {avatarUrl ? (
              <Image source={{ uri: toAbsoluteUrl(String(avatarUrl)) }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>{initialsOf(user?.name)}</Text>
            )}
          </Pressable>
        </View>
      </View>
      <GlobalPageSearch
        visible={searchVisible}
        onClose={() => setSearchVisible(false)}
        navigation={navigation}
      />
    </>
  );
};

const styles = brandStyles((b) =>
  StyleSheet.create({
    root: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: layout.gutter,
      paddingBottom: 10,
      backgroundColor: b.bg,
    },
    brandRow: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      /* 4, not the comp's apparent 6: the comp's mark fills its box, while
         this glyph is inset within its own, so the wordmark lands in the
         same place. */
      gap: 4,
    },
    wordmarkWrap: {
      flexShrink: 1,
    },
    wordmark: {
      fontSize: type.wordmark,
      lineHeight: 22,
      fontWeight: "700",
      letterSpacing: -0.3,
      color: b.ink,
    },
    tagline: {
      fontSize: type.tagline,
      lineHeight: 13,
      fontWeight: "500",
      color: b.textMuted,
    },
    actions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    bellDot: {
      position: "absolute",
      top: -1,
      right: -1,
      width: 9,
      height: 9,
      borderRadius: round.pill,
      backgroundColor: b.alert,
      borderWidth: 1.5,
      borderColor: b.bg,
    },
    avatar: {
      width: 34,
      height: 34,
      borderRadius: round.pill,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
      backgroundColor: b.tintAvatar,
    },
    avatarImage: {
      width: "100%",
      height: "100%",
    },
    avatarText: {
      fontSize: 15,
      fontWeight: "700",
      color: b.ink,
    },
  }),
);

export default AppHeader;
