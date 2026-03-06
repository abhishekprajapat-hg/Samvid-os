import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Pressable, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../context/AuthContext";
import type { UserRole } from "../types";

import { ManagerDashboardScreen } from "../modules/manager/ManagerDashboardScreen";
import { ExecutiveDashboardScreen } from "../modules/executive/ExecutiveDashboardScreen";
import { FieldDashboardScreen } from "../modules/field/FieldDashboardScreen";
import { LeadsMatrixScreen } from "../modules/leads/LeadsMatrixScreen";
import { LeadDetailsScreen } from "../modules/leads/LeadDetailsScreen";
import { AssetVaultScreen } from "../modules/inventory/AssetVaultScreen";
import { InventoryDetailsScreen } from "../modules/inventory/InventoryDetailsScreen";
import { TeamChatScreen } from "../modules/chat/TeamChatScreen";
import { SamvidBotScreen } from "../modules/chat/SamvidBotScreen";
import { ChatConversationScreen } from "../modules/chat/ChatConversationScreen";
import { CallScreen } from "../modules/chat/CallScreen";
import { IntelligenceReportsScreen } from "../modules/reports/IntelligenceReportsScreen";
import { PerformanceScreen } from "../modules/reports/PerformanceScreen";
import { MasterScheduleScreen } from "../modules/calendar/MasterScheduleScreen";
import { FieldOpsScreen } from "../modules/field/FieldOpsScreen";
import { TeamManagerScreen } from "../modules/admin/TeamManagerScreen";
import { SystemSettingsScreen } from "../modules/admin/SystemSettingsScreen";
import { UserDetailsEditorScreen } from "../modules/admin/UserDetailsEditorScreen";
import { AdminCommandConsoleScreen } from "../modules/admin/AdminCommandConsoleScreen";
import { FinancialCoreScreen } from "../modules/finance/FinancialCoreScreen";
import { NotificationsScreen } from "../modules/notifications/NotificationsScreen";
import { ProfileScreen } from "../modules/profile/ProfileScreen";
import { MoreMenuScreen } from "../modules/more/MoreMenuScreen";

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const getTabIconName = (routeName: string, focused: boolean) => {
  const iconMap: Record<string, { focused: React.ComponentProps<typeof Ionicons>["name"]; unfocused: React.ComponentProps<typeof Ionicons>["name"] }> = {
    Dashboard: { focused: "speedometer", unfocused: "speedometer-outline" },
    Leads: { focused: "people", unfocused: "people-outline" },
    Inventory: { focused: "cube", unfocused: "cube-outline" },
    Reports: { focused: "bar-chart", unfocused: "bar-chart-outline" },
    Finance: { focused: "wallet", unfocused: "wallet-outline" },
    Chat: { focused: "chatbubble", unfocused: "chatbubble-outline" },
    Users: { focused: "person-circle", unfocused: "person-circle-outline" },
    Settings: { focused: "settings", unfocused: "settings-outline" },
    Targets: { focused: "trophy", unfocused: "trophy-outline" },
    Notifications: { focused: "notifications", unfocused: "notifications-outline" },
    Profile: { focused: "person", unfocused: "person-outline" },
    More: { focused: "menu", unfocused: "menu-outline" },
    Calendar: { focused: "calendar", unfocused: "calendar-outline" },
    "Field Ops": { focused: "map", unfocused: "map-outline" },
  };

  const selected = iconMap[routeName] ?? { focused: "ellipse", unfocused: "ellipse-outline" };
  return focused ? selected.focused : selected.unfocused;
};

const RoleMainTabs = ({ role }: { role: UserRole }) => {
  const { logout, user } = useAuth();
  const insets = useSafeAreaInsets();
  const bottomSpacing = Math.max(insets.bottom, 10);

  const sharedOptions = {
    headerRight: () => (
      <Pressable onPress={logout} style={{ marginRight: 12 }}>
        <Text style={{ color: "#0f172a", fontWeight: "600" }}>Logout</Text>
      </Pressable>
    ),
    tabBarLabelStyle: { fontSize: 11, marginBottom: 2 },
    tabBarIconStyle: { marginTop: -2 },
    tabBarStyle: {
      height: 56 + bottomSpacing,
      paddingBottom: bottomSpacing,
      paddingTop: 6,
    },
    tabBarActiveTintColor: "#0f172a",
    tabBarInactiveTintColor: "#64748b",
  };

  if (role === "ADMIN" || role === "MANAGER" || role === "ASSISTANT_MANAGER" || role === "TEAM_LEADER") {
    return (
      <Tab.Navigator
        screenOptions={({ route }) => ({
          ...sharedOptions,
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons
              name={getTabIconName(route.name, focused)}
              size={size}
              color={color}
            />
          ),
        })}
      >
        <Tab.Screen name="Dashboard" component={ManagerDashboardScreen} />
        <Tab.Screen name="Leads" component={LeadsMatrixScreen} />
        <Tab.Screen name="Inventory" component={AssetVaultScreen} />
        <Tab.Screen name="Reports" component={IntelligenceReportsScreen} />
        <Tab.Screen name="Targets" component={PerformanceScreen} />
        <Tab.Screen name="Calendar" component={MasterScheduleScreen} />
        <Tab.Screen name="Field Ops" component={FieldOpsScreen} />
        <Tab.Screen name="Finance" component={FinancialCoreScreen} />
        <Tab.Screen name="Chat" component={TeamChatScreen} />
        <Tab.Screen name="More" component={MoreMenuScreen} />
      </Tab.Navigator>
    );
  }

  if (role === "CHANNEL_PARTNER") {
    const canViewInventory = Boolean((user as any)?.canViewInventory);
    return (
      <Tab.Navigator
        screenOptions={({ route }) => ({
          ...sharedOptions,
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons
              name={getTabIconName(route.name, focused)}
              size={size}
              color={color}
            />
          ),
        })}
      >
        <Tab.Screen name="Leads" component={LeadsMatrixScreen} />
        {canViewInventory ? <Tab.Screen name="Inventory" component={AssetVaultScreen} /> : null}
        <Tab.Screen name="More" component={MoreMenuScreen} />
      </Tab.Navigator>
    );
  }

  if (role === "EXECUTIVE") {
    return (
      <Tab.Navigator
        screenOptions={({ route }) => ({
          ...sharedOptions,
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons
              name={getTabIconName(route.name, focused)}
              size={size}
              color={color}
            />
          ),
        })}
      >
        <Tab.Screen name="Dashboard" component={ExecutiveDashboardScreen} />
        <Tab.Screen name="Leads" component={LeadsMatrixScreen} />
        <Tab.Screen name="Inventory" component={AssetVaultScreen} />
        <Tab.Screen name="Targets" component={PerformanceScreen} />
        <Tab.Screen name="Calendar" component={MasterScheduleScreen} />
        <Tab.Screen name="Chat" component={TeamChatScreen} />
        <Tab.Screen name="More" component={MoreMenuScreen} />
      </Tab.Navigator>
    );
  }

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        ...sharedOptions,
        tabBarIcon: ({ focused, color, size }) => (
          <Ionicons
            name={getTabIconName(route.name, focused)}
            size={size}
            color={color}
          />
        ),
      })}
    >
      <Tab.Screen name="Dashboard" component={FieldDashboardScreen} />
      <Tab.Screen name="Leads" component={LeadsMatrixScreen} />
      <Tab.Screen name="Inventory" component={AssetVaultScreen} />
      <Tab.Screen name="Targets" component={PerformanceScreen} />
      <Tab.Screen name="Field Ops" component={FieldOpsScreen} />
      <Tab.Screen name="Calendar" component={MasterScheduleScreen} />
      <Tab.Screen name="Chat" component={TeamChatScreen} />
      <Tab.Screen name="More" component={MoreMenuScreen} />
    </Tab.Navigator>
  );
};

export const RoleTabs = ({ role }: { role: UserRole }) => (
  <Stack.Navigator>
    <Stack.Screen
      name="MainTabs"
      options={{ headerShown: false }}
    >
      {() => <RoleMainTabs role={role} />}
    </Stack.Screen>
    <Stack.Screen
      name="LeadDetails"
      component={LeadDetailsScreen}
      options={{ title: "Lead Details" }}
    />
    <Stack.Screen
      name="InventoryDetails"
      component={InventoryDetailsScreen}
      options={{ title: "Inventory Details" }}
    />
    <Stack.Screen
      name="ChatConversation"
      component={ChatConversationScreen}
      options={{ headerShown: false }}
    />
    <Stack.Screen
      name="Samvid Bot"
      component={SamvidBotScreen}
      options={{ title: "Samvid Bot" }}
    />
    <Stack.Screen
      name="CallScreen"
      component={CallScreen}
      options={{ headerShown: false }}
    />
    <Stack.Screen
      name="Notifications"
      component={NotificationsScreen}
      options={{ title: "Notifications" }}
    />
    <Stack.Screen
      name="Users"
      component={TeamManagerScreen}
      options={{ title: "Users" }}
    />
    <Stack.Screen
      name="UserDetailsEditor"
      component={UserDetailsEditorScreen}
      options={{ title: "User Editor" }}
    />
    <Stack.Screen
      name="AdminConsole"
      component={AdminCommandConsoleScreen}
      options={{ title: "Admin Console" }}
    />
    <Stack.Screen
      name="Profile"
      component={ProfileScreen}
      options={{ title: "Profile" }}
    />
    <Stack.Screen
      name="Settings"
      component={SystemSettingsScreen}
      options={{ title: "Settings" }}
    />
    <Stack.Screen
      name="Field Ops"
      component={FieldOpsScreen}
      options={{ title: "Field Ops" }}
    />
  </Stack.Navigator>
);
