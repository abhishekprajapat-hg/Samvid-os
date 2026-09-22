import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "../components/ui/Icon";
import { PageAccessGate, CoworkingPermissionGate } from "../components/auth/PageAccessGate";
import { ErrorBoundary } from "../components/common/ErrorBoundary";
import { useRealtimeAlerts } from "../context/RealtimeAlertsContext";
import type { UserRole } from "../types";
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
import { TaskDetailsScreen } from "../modules/tasks/TaskDetailsScreen";
import { NewTaskScreen } from "../modules/tasks/NewTaskScreen";
import { ContactsScreen } from "../modules/contacts/ContactsScreen";
import { AttendanceStack } from "./AttendanceStack";
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
import { AppHeader } from "../components/common/AppHeader";
import { themePalette } from "../theme/themedStyles";

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
  "CoworkingBooking", "CoworkingClients", "Contacts",
]);

export const isScreenBuilt = (item: NavItem) => BUILT_SCREENS.has(item.screen);

/*
 * The bottom bar the mobile comps draw: five fixed destinations, the same for
 * every role, rather than the four the access algorithm used to pick.
 *
 * Choosing the tabs by role kept the bar in step with the web sidebar, and
 * giving that up is a deliberate trade the design asks for. Access itself is
 * not given up: each tab is still wrapped in its PageAccessGate, so a role
 * without the grant lands on the gate rather than a screen it may not read,
 * and everything that is no longer a tab stays reachable from More.
 *
 * Contacts covers both contact directories, so Owner and Broker are listed
 * here too - otherwise More would offer a second door to the same screen.
 */
export const TAB_SCREENS = ["Dashboard", "Tasks", "Calendar", "Attendance"] as const;

/*
 * Contacts is no longer a tab, so it is not excluded from More any more -
 * but the two directories it wraps still are, otherwise More would offer
 * three doors to the same screen.
 */
export const MORE_EXCLUDED_SCREENS = [
  ...TAB_SCREENS,
  "OwnerDatabase",
  "BrokerDatabase",
];

type FixedTab = {
  name: string;
  label: string;
  icon: string;
  page: string;
  component?: React.ComponentType<any>;
};

const FIXED_TABS: FixedTab[] = [
  { name: "Dashboard", label: "Home", icon: "dashboard", page: "dashboard" },
  { name: "Tasks", label: "Tasks", icon: "checkbox", page: "tasks", component: TaskManagerScreen },
  { name: "Calendar", label: "Calendar", icon: "calendar", page: "calendar", component: MasterScheduleScreen },
  { name: "Attendance", label: "Attendance", icon: "attendance", page: "attendance", component: AttendanceStack },
];

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
    <ErrorBoundary label={page}>
      <PageAccessGate page={page}>
        <CoworkingPermissionGate permission={permission}>
          <Component {...props} />
        </CoworkingPermissionGate>
      </PageAccessGate>
    </ErrorBoundary>
  );
  Gated.displayName = `CoworkingGated(${page})`;
  return Gated;
};

/** Wraps a tab's screen in its page gate, so a deep link cannot bypass it. */
const gated = (Component: React.ComponentType<any>, page: string) => {
  const Gated = (props: any) => (
    <ErrorBoundary label={page}>
      <PageAccessGate page={page}>
        <Component {...props} />
      </PageAccessGate>
    </ErrorBoundary>
  );
  Gated.displayName = `Gated(${page})`;
  return Gated;
};

const RoleMainTabs = ({ role }: { role: UserRole }) => {
  const { chatUnreadTotal, notificationUnreadTotal } = useRealtimeAlerts();
  const insets = useSafeAreaInsets();

  const bottomSpacing = Math.max(insets.bottom, Platform.OS === "android" ? 16 : 10);

  const moreBadge = (() => {
    const count = Math.max(0, Number(notificationUnreadTotal || 0) + Number(chatUnreadTotal || 0));
    if (!count) return undefined;
    return count > 99 ? 99 : count;
  })();

  return (
    <Tab.Navigator
      screenOptions={{
        /*
         * The wordmark bar replaces the default title bar. React Navigation
         * still treats the top inset as consumed by a custom header, so the
         * screens below keep laying out the way they did.
         */
        header: () => <AppHeader />,
        tabBarLabelStyle: { fontSize: 11, marginBottom: 2 },
        tabBarIconStyle: { marginTop: -2 },
        tabBarStyle: {
          height: 58 + bottomSpacing,
          paddingBottom: bottomSpacing,
          paddingTop: 6,
          borderTopColor: themePalette.slate[200],
          backgroundColor: themePalette.surface,
        },
        tabBarActiveTintColor: themePalette.blue[600],
        tabBarInactiveTintColor: themePalette.slate[500],
      }}
    >
      {FIXED_TABS.map((item) => {
        const Component =
          item.name === "Dashboard" ? dashboardFor(role) : (item.component as React.ComponentType<any>);

        return (
          <Tab.Screen
            key={item.name}
            name={item.name}
            component={gated(Component, item.page)}
            options={{
              title: item.label,
              tabBarIcon: ({ focused, color, size }) => (
                <Icon
                  name={item.icon}
                  size={size ?? 22}
                  color={color}
                  strokeWidth={focused ? 2.4 : 1.9}
                />
              ),
            }}
          />
        );
      })}

      <Tab.Screen
        name="More"
        component={MoreMenuScreen}
        options={{
          tabBarBadge: moreBadge,
          tabBarIcon: ({ focused, color, size }) => (
            <Icon
              name="ellipsis-horizontal"
              size={size ?? 22}
              color={color}
              strokeWidth={focused ? 2.4 : 1.9}
            />
          ),
        }}
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
      <Stack.Screen name="Attendance" component={gated(AttendanceStack, "attendance")} options={{ headerShown: false }} />
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
      <Stack.Screen
        name="TaskDetails"
        component={TaskDetailsScreen}
        options={{ header: () => <AppHeader /> }}
      />
      {/* The form is a full-page sheet in the comp - no wordmark bar above it. */}
      <Stack.Screen name="NewTask" component={NewTaskScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Contacts" component={gated(ContactsScreen, "inventory")} options={{ title: "Contacts" }} />
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
