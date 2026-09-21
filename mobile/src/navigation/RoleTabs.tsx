import React, { useMemo } from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Platform, Pressable, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "../components/ui/Icon";
import { PageAccessGate, CoworkingPermissionGate } from "../components/auth/PageAccessGate";
import { useAuth } from "../context/AuthContext";
import { usePermissions } from "../context/PermissionContext";
import { useRealtimeAlerts } from "../context/RealtimeAlertsContext";
import { palette, typography } from "../theme/tokens";
import type { UserRole } from "../types";
import { getTabItems } from "./access";
import type { NavItem } from "./navigationCatalogue";

import { ManagerDashboardScreen } from "../modules/manager/ManagerDashboardScreen";
import { ExecutiveDashboardScreen } from "../modules/executive/ExecutiveDashboardScreen";
import { FieldDashboardScreen } from "../modules/field/FieldDashboardScreen";
import { LeadsMatrixScreen } from "../modules/leads/LeadsMatrixScreen";
import { LeadDetailsScreen } from "../modules/leads/LeadDetailsScreen";
import { AssetVaultScreen } from "../modules/inventory/AssetVaultScreen";
import { InventoryDetailsScreen } from "../modules/inventory/InventoryDetailsScreen";
import { TeamChatScreen } from "../modules/chat/TeamChatScreen";
import { OfficeAssistantScreen } from "../modules/chat/OfficeAssistantScreen";
import { ChatConversationScreen } from "../modules/chat/ChatConversationScreen";
import { CallScreen } from "../modules/chat/CallScreen";
import { IntelligenceReportsScreen } from "../modules/reports/IntelligenceReportsScreen";
import { PerformanceScreen } from "../modules/reports/PerformanceScreen";
import { RoleLeaderboardScreen } from "../modules/reports/RoleLeaderboardScreen";
import { MasterScheduleScreen } from "../modules/calendar/MasterScheduleScreen";
import { FieldOpsScreen } from "../modules/field/FieldOpsScreen";
import { AttendanceScreen } from "../modules/attendance/AttendanceScreen";
import { TeamManagerScreen } from "../modules/admin/TeamManagerScreen";
import { SystemSettingsScreen } from "../modules/admin/SystemSettingsScreen";
import { AdminMetaAdsScreen } from "../modules/admin/AdminMetaAdsScreen";
import { AdminCommandConsoleScreen } from "../modules/admin/AdminCommandConsoleScreen";
import { UserDetailsEditorScreen } from "../modules/admin/UserDetailsEditorScreen";
import { FinancialCoreScreen } from "../modules/finance/FinancialCoreScreen";
import { NotificationsScreen } from "../modules/notifications/NotificationsScreen";
import { ProfileScreen } from "../modules/profile/ProfileScreen";
import { MoreMenuScreen } from "../modules/more/MoreMenuScreen";
import { TaskManagerScreen } from "../modules/tasks/TaskManagerScreen";
import { OwnerDatabaseScreen } from "../modules/inventory/OwnerDatabaseScreen";
import { BrokerDatabaseScreen } from "../modules/inventory/BrokerDatabaseScreen";
import { ProjectsScreen } from "../modules/inventory/ProjectsScreen";
import { ProjectDetailsScreen } from "../modules/inventory/ProjectDetailsScreen";
import { SharedInventoryViewScreen } from "../modules/inventory/SharedInventoryViewScreen";
import { ProductionDashboardScreen } from "../modules/production/ProductionDashboardScreen";
import { BookingBoardScreen } from "../modules/coworking/BookingBoardScreen";
import { CoworkingClientsScreen } from "../modules/coworking/CoworkingClientsScreen";
import { DataUseNoticeScreen, ServiceTermsNoticeScreen } from "../modules/legal/LegalNoticeScreen";
import { RealtimePopupOverlay } from "../components/common/RealtimePopupOverlay";

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

/*
 * Tabs are computed from what the role can actually reach, not hardcoded.
 *
 * The previous version had five per-role blocks of <Tab.Screen> and decided
 * visibility with `role === "ADMIN"`. That disagreed with the web app for any
 * account with customised page access, and left COWORKING_ADMIN and the two
 * production roles falling through to a generic tab set. Now the same
 * algorithm the web sidebar uses picks the tabs - see navigation/access.ts.
 */

/*
 * Every destination in the catalogue is now built. The set is kept because the
 * catalogue mirrors the web nav, so anything web adds shows up here first and
 * must not be offered as a route until mobile has it.
 */
const BUILT_SCREENS = new Set([
  "Dashboard", "Leads", "Inventory", "Chat", "Tasks", "Attendance", "Calendar",
  "Finance", "Reports", "Leaderboard", "Targets", "Field Ops", "Users",
  "Console", "MetaAds", "Notifications", "Settings", "Profile",
  "OwnerDatabase", "BrokerDatabase", "Projects",
  "CoworkingBooking", "CoworkingClients",
]);

export const isScreenBuilt = (item: NavItem) => BUILT_SCREENS.has(item.screen);

const dashboardFor = (role: UserRole) => {
  if (role === "EXECUTIVE") return ExecutiveDashboardScreen;
  if (role === "FIELD_EXECUTIVE") return FieldDashboardScreen;
  if (role === "PRODUCTION_EXECUTIVE" || role === "COMMUNITY_MANAGER") {
    return ProductionDashboardScreen;
  }
  return ManagerDashboardScreen;
};

const TAB_COMPONENTS: Record<string, React.ComponentType<any>> = {
  Leads: LeadsMatrixScreen,
  Inventory: AssetVaultScreen,
  Chat: TeamChatScreen,
  Tasks: TaskManagerScreen,
  Attendance: AttendanceScreen,
  Finance: FinancialCoreScreen,
  Reports: IntelligenceReportsScreen,
  CoworkingBooking: BookingBoardScreen,
};

/*
 * Coworking is the one module with per-action permissions on top of page
 * access, so its screens carry both gates - the same pairing web applies with
 * PageAccessGate + CoworkingPermissionGate.
 */
const coworkingGated = (Component: React.ComponentType<any>, page: string, permission: string) => {
  const Gated = (props: any) => (
    <PageAccessGate page={page}>
      <CoworkingPermissionGate permission={permission}>
        <Component {...props} />
      </CoworkingPermissionGate>
    </PageAccessGate>
  );
  Gated.displayName = `CoworkingGated(${page})`;
  return Gated;
};

/** Wraps a tab's screen in its page gate, so a deep link cannot bypass it. */
const gated = (Component: React.ComponentType<any>, page: string) => {
  const Gated = (props: any) => (
    <PageAccessGate page={page}>
      <Component {...props} />
    </PageAccessGate>
  );
  Gated.displayName = `Gated(${page})`;
  return Gated;
};

const RoleMainTabs = ({ role }: { role: UserRole }) => {
  const { logout, user } = useAuth();
  const { permissions, enforcePageAccess } = usePermissions();
  const { chatUnreadTotal, notificationUnreadTotal } = useRealtimeAlerts();
  const insets = useSafeAreaInsets();

  const bottomSpacing = Math.max(insets.bottom, Platform.OS === "android" ? 16 : 10);

  const tabs = useMemo(
    () =>
      getTabItems(role, {
        permissions,
        enforcePageAccess,
        canViewInventory: user?.canViewInventory,
      }).filter(isScreenBuilt),
    [role, permissions, enforcePageAccess, user?.canViewInventory],
  );

  const badgeFor = (screen: string) => {
    const count = screen === "Chat" ? chatUnreadTotal : 0;
    const normalized = Math.max(0, Number(count || 0));
    if (!normalized) return undefined;
    return normalized > 99 ? 99 : normalized;
  };

  const moreBadge = (() => {
    const count = Math.max(0, Number(notificationUnreadTotal || 0));
    if (!count) return undefined;
    return count > 99 ? 99 : count;
  })();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerRight: () => (
          <Pressable onPress={logout} hitSlop={10} style={{ marginRight: 14 }}>
            <Text style={{ color: palette.slate[700], fontWeight: "600", fontSize: typography.label }}>
              Logout
            </Text>
          </Pressable>
        ),
        tabBarLabelStyle: { fontSize: 11, marginBottom: 2 },
        tabBarIconStyle: { marginTop: -2 },
        tabBarStyle: {
          height: 56 + bottomSpacing,
          paddingBottom: bottomSpacing,
          paddingTop: 6,
          borderTopColor: palette.slate[200],
        },
        tabBarActiveTintColor: palette.blue[600],
        tabBarInactiveTintColor: palette.slate[500],
        tabBarIcon: ({ focused, color, size }) => (
          <Icon
            name={route.name === "More" ? "more" : tabs.find((t) => t.screen === route.name)?.icon || "ellipse"}
            size={size ?? 22}
            color={color}
            strokeWidth={focused ? 2.4 : 1.9}
          />
        ),
      })}
    >
      {tabs.map((item) => {
        const Component =
          item.screen === "Dashboard" ? dashboardFor(role) : TAB_COMPONENTS[item.screen];
        if (!Component) return null;

        return (
          <Tab.Screen
            key={item.screen}
            name={item.screen}
            component={gated(Component, item.page)}
            options={{ title: item.label, tabBarBadge: badgeFor(item.screen) }}
          />
        );
      })}

      <Tab.Screen
        name="More"
        component={MoreMenuScreen}
        options={{ tabBarBadge: moreBadge }}
      />
    </Tab.Navigator>
  );
};

export const RoleTabs = ({ role }: { role: UserRole }) => (
  <>
    <Stack.Navigator>
      <Stack.Screen name="MainTabs" options={{ headerShown: false }}>
        {() => <RoleMainTabs role={role} />}
      </Stack.Screen>

      {/* Every pushed destination carries the same gate its tab would. */}
      <Stack.Screen name="Attendance" component={gated(AttendanceScreen, "attendance")} options={{ title: "Attendance" }} />
      <Stack.Screen name="Finance" component={gated(FinancialCoreScreen, "finance")} options={{ title: "Finance" }} />
      <Stack.Screen name="Targets" component={gated(PerformanceScreen, "targets")} options={{ title: "Targets" }} />
      <Stack.Screen name="Calendar" component={gated(MasterScheduleScreen, "calendar")} options={{ title: "Calendar" }} />
      <Stack.Screen name="Reports" component={gated(IntelligenceReportsScreen, "reports")} options={{ title: "Reports" }} />
      <Stack.Screen name="Leaderboard" component={gated(RoleLeaderboardScreen, "leaderboard")} options={{ title: "Leaderboard" }} />
      <Stack.Screen name="Tasks" component={gated(TaskManagerScreen, "tasks")} options={{ title: "Tasks" }} />
      <Stack.Screen name="Leads" component={gated(LeadsMatrixScreen, "leads")} options={{ title: "Pipeline" }} />
      <Stack.Screen name="Inventory" component={gated(AssetVaultScreen, "inventory")} options={{ title: "Inventory" }} />
      <Stack.Screen name="Field Ops" component={gated(FieldOpsScreen, "field_ops")} options={{ title: "Field Ops" }} />
      <Stack.Screen name="OwnerDatabase" component={gated(OwnerDatabaseScreen, "inventory")} options={{ title: "Owner Database" }} />
      <Stack.Screen name="BrokerDatabase" component={gated(BrokerDatabaseScreen, "inventory")} options={{ title: "Broker Database" }} />
      <Stack.Screen name="Projects" component={gated(ProjectsScreen, "projects")} options={{ title: "Projects" }} />
      <Stack.Screen
        name="CoworkingBooking"
        component={coworkingGated(BookingBoardScreen, "coworking_booking", "cabins.view")}
        options={{ title: "Booking Board" }}
      />
      <Stack.Screen
        name="CoworkingClients"
        component={coworkingGated(CoworkingClientsScreen, "coworking_clients", "clients.view")}
        options={{ title: "Coworking Clients" }}
      />
      <Stack.Screen name="Users" component={gated(TeamManagerScreen, "admin_team")} options={{ title: "Team" }} />
      <Stack.Screen name="Console" component={gated(AdminCommandConsoleScreen, "admin_console")} options={{ title: "Console" }} />
      <Stack.Screen name="MetaAds" component={gated(AdminMetaAdsScreen, "admin_meta_ads")} options={{ title: "Meta Ads" }} />
      <Stack.Screen name="Notifications" component={gated(NotificationsScreen, "admin_notifications")} options={{ title: "Notifications" }} />
      <Stack.Screen name="Settings" component={gated(SystemSettingsScreen, "settings")} options={{ title: "Settings" }} />
      <Stack.Screen name="Profile" component={gated(ProfileScreen, "profile")} options={{ title: "Profile" }} />

      {/* Detail and modal routes: reached from a gated parent, so not gated again. */}
      <Stack.Screen name="LeadDetails" component={LeadDetailsScreen} options={{ title: "Lead Details" }} />
      <Stack.Screen name="InventoryDetails" component={InventoryDetailsScreen} options={{ title: "Inventory Details" }} />
      <Stack.Screen name="ProjectDetails" component={ProjectDetailsScreen} options={{ title: "Project" }} />
      {/* Reached by share token. Deliberately ungated - it is the one screen
          meant for someone outside the company. */}
      <Stack.Screen name="SharedInventory" component={SharedInventoryViewScreen} options={{ title: "Shared Listing" }} />
      <Stack.Screen name="UserDetails" component={UserDetailsEditorScreen} options={{ title: "User Details" }} />
      <Stack.Screen name="Chat" component={TeamChatScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ChatConversation" component={ChatConversationScreen} options={{ headerShown: false }} />
      <Stack.Screen name="CallScreen" component={CallScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Office Assistant" component={OfficeAssistantScreen} options={{ title: "Office Assistant" }} />
      <Stack.Screen name="Privacy" component={DataUseNoticeScreen} options={{ title: "Privacy Policy" }} />
      <Stack.Screen name="Terms" component={ServiceTermsNoticeScreen} options={{ title: "Terms & Conditions" }} />
    </Stack.Navigator>
    <RealtimePopupOverlay />
  </>
);
