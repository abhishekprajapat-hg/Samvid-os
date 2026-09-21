import React, { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { ChevronRight, LogOut } from "lucide-react-native";
import { Screen } from "../../components/common/Screen";
import { AppCard, AppEmptyState } from "../../components/ui";
import { Icon } from "../../components/ui/Icon";
import { useAuth } from "../../context/AuthContext";
import { usePermissions } from "../../context/PermissionContext";
import { useRealtimeAlerts } from "../../context/RealtimeAlertsContext";
import { getMoreGroups, getTabItems, canSeeItem } from "../../navigation/access";
import { PROFILE_ITEM } from "../../navigation/navigationCatalogue";
import { isScreenBuilt } from "../../navigation/RoleTabs";
import { colors, palette, radii, spacing, typography } from "../../theme/tokens";

/*
 * Everything the role can reach that is not already a bottom tab, grouped the
 * way the web sidebar groups it (WORK / SALES / BUSINESS / TEAM / ADMIN /
 * COWORKING), with Profile in a footer chip exactly as web does.
 *
 * The previous version was a flat list with hardcoded `role === "ADMIN"` checks
 * and its own colours. Both are gone: the rows come from the shared visibility
 * algorithm, so this screen and the web sidebar cannot drift.
 */

const Row = ({
  label,
  icon,
  badge,
  onPress,
}: {
  label: string;
  icon: string;
  badge?: number;
  onPress: () => void;
}) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
  >
    <Icon name={icon} size={18} color={palette.slate[500]} />
    <Text style={styles.rowLabel} numberOfLines={1}>
      {label}
    </Text>
    {badge ? (
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{badge > 99 ? "99+" : badge}</Text>
      </View>
    ) : null}
    <ChevronRight size={16} color={palette.slate[400]} />
  </Pressable>
);

export const MoreMenuScreen = ({ navigation }: any) => {
  const { role, user, logout } = useAuth();
  const { permissions, enforcePageAccess } = usePermissions();
  const { chatUnreadTotal, notificationUnreadTotal, markAllChatRead } = useRealtimeAlerts();

  const accessUser = useMemo(
    () => ({ permissions, enforcePageAccess, canViewInventory: user?.canViewInventory }),
    [permissions, enforcePageAccess, user?.canViewInventory],
  );

  const tabScreens = useMemo(
    () => getTabItems(role, accessUser).filter(isScreenBuilt).map((item) => item.screen),
    [role, accessUser],
  );

  const groups = useMemo(
    () =>
      getMoreGroups(role, accessUser, tabScreens)
        .map((group) => ({ ...group, items: group.items.filter(isScreenBuilt) }))
        .filter((group) => group.items.length > 0),
    [role, accessUser, tabScreens],
  );

  const canSeeProfile = canSeeItem(PROFILE_ITEM, role, accessUser);

  // The More screen is nested in the tab navigator; pushed routes live on the
  // stack above it.
  const open = (screen: string) => {
    const parent = navigation?.getParent?.();
    if (parent?.navigate) parent.navigate(screen);
    else navigation.navigate(screen);
  };

  const badgeFor = (screen: string) => {
    if (screen === "Chat") return chatUnreadTotal;
    if (screen === "Notifications") return notificationUnreadTotal;
    return 0;
  };

  return (
    <Screen title="More" subtitle="Everything else">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
        {groups.length === 0 ? (
          <AppEmptyState
            title="Nothing else here"
            description="Every page your account can reach is already a tab."
          />
        ) : (
          groups.map((group) => (
            <View key={group.group} style={styles.group}>
              <Text style={styles.groupLabel}>{group.group}</Text>
              <AppCard style={styles.card}>
                {group.items.map((item) => (
                  <Row
                    key={`${group.group}-${item.page}`}
                    label={item.label}
                    icon={item.icon}
                    badge={badgeFor(item.screen)}
                    onPress={() => {
                      if (item.screen === "Chat") markAllChatRead();
                      open(item.screen);
                    }}
                  />
                ))}
              </AppCard>
            </View>
          ))
        )}

        <View style={styles.group}>
          <Text style={styles.groupLabel}>ACCOUNT</Text>
          <AppCard style={styles.card}>
            <Row label="Office Assistant" icon="chat" onPress={() => open("Office Assistant")} />
            {canSeeProfile ? (
              <Row label={user?.name || "Profile"} icon="profile" onPress={() => open("Profile")} />
            ) : null}
            <Row label="Privacy Policy" icon="admin" onPress={() => open("Privacy")} />
            <Row label="Terms & Conditions" icon="reports" onPress={() => open("Terms")} />
            <Pressable
              onPress={logout}
              accessibilityRole="button"
              style={({ pressed }) => [styles.row, styles.rowLast, pressed && styles.rowPressed]}
            >
              <LogOut size={18} color={palette.rose[600]} />
              <Text style={[styles.rowLabel, styles.logoutLabel]}>Log out</Text>
            </Pressable>
          </AppCard>
        </View>
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  body: {
    paddingBottom: spacing.xxl,
  },
  group: {
    marginBottom: spacing.xl,
  },
  groupLabel: {
    fontSize: typography.caption,
    fontWeight: "700",
    color: palette.slate[500],
    letterSpacing: 0.8,
    marginBottom: spacing.md,
  },
  card: {
    padding: 0,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    minHeight: 48,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowPressed: {
    backgroundColor: palette.slate[50],
  },
  rowLabel: {
    flex: 1,
    fontSize: typography.body,
    fontWeight: "600",
    color: palette.slate[800],
  },
  logoutLabel: {
    color: palette.rose[600],
  },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: radii.pill,
    paddingHorizontal: 5,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.blue[600],
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#ffffff",
  },
});
