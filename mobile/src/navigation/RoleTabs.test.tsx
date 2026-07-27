import type React from "react";
import { render } from "@testing-library/react-native";
import { RoleTabs } from "./RoleTabs";
import { supportedRoles } from "../test/fixtures";
import type { UserRole } from "../types";

jest.mock("@react-navigation/bottom-tabs", () => ({
  createBottomTabNavigator: () => ({
    Navigator: ({ children }: { children: React.ReactNode }) => {
      const React = require("react");
      return React.createElement(React.Fragment, null, children);
    },
    Screen: ({ name }: { name: string }) => {
      const React = require("react");
      const { Text } = require("react-native");
      return React.createElement(Text, { testID: `tab-${name}` }, name);
    },
  }),
}));

jest.mock("@react-navigation/native-stack", () => ({
  createNativeStackNavigator: () => ({
    Navigator: ({ children }: { children: React.ReactNode }) => {
      const React = require("react");
      return React.createElement(React.Fragment, null, children);
    },
    Screen: ({ name, children }: { name: string; children?: () => React.ReactNode }) => {
      const React = require("react");
      return name === "MainTabs" && children ? React.createElement(React.Fragment, null, children()) : null;
    },
  }),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ bottom: 0 }),
}));

jest.mock("../context/AuthContext", () => ({
  useAuth: () => ({
    logout: jest.fn(),
  }),
}));

jest.mock("../context/RealtimeAlertsContext", () => ({
  useRealtimeAlerts: () => ({
    chatUnreadTotal: 0,
    notificationUnreadTotal: 0,
  }),
}));

jest.mock("../components/common/RealtimePopupOverlay", () => ({
  RealtimePopupOverlay: () => null,
}));

jest.mock("../modules/manager/ManagerDashboardScreen", () => ({ ManagerDashboardScreen: () => null }));
jest.mock("../modules/executive/ExecutiveDashboardScreen", () => ({ ExecutiveDashboardScreen: () => null }));
jest.mock("../modules/field/FieldDashboardScreen", () => ({ FieldDashboardScreen: () => null }));
jest.mock("../modules/leads/LeadsMatrixScreen", () => ({ LeadsMatrixScreen: () => null }));
jest.mock("../modules/leads/LeadDetailsScreen", () => ({ LeadDetailsScreen: () => null }));
jest.mock("../modules/inventory/AssetVaultScreen", () => ({ AssetVaultScreen: () => null }));
jest.mock("../modules/inventory/InventoryDetailsScreen", () => ({ InventoryDetailsScreen: () => null }));
jest.mock("../modules/chat/TeamChatScreen", () => ({ TeamChatScreen: () => null }));
jest.mock("../modules/chat/OfficeAssistantScreen", () => ({ OfficeAssistantScreen: () => null }));
jest.mock("../modules/chat/ChatConversationScreen", () => ({ ChatConversationScreen: () => null }));
jest.mock("../modules/chat/CallScreen", () => ({ CallScreen: () => null }));
jest.mock("../modules/reports/IntelligenceReportsScreen", () => ({ IntelligenceReportsScreen: () => null }));
jest.mock("../modules/reports/PerformanceScreen", () => ({ PerformanceScreen: () => null }));
jest.mock("../modules/reports/RoleLeaderboardScreen", () => ({ RoleLeaderboardScreen: () => null }));
jest.mock("../modules/calendar/MasterScheduleScreen", () => ({ MasterScheduleScreen: () => null }));
jest.mock("../modules/field/FieldOpsScreen", () => ({ FieldOpsScreen: () => null }));
jest.mock("../modules/attendance/AttendanceScreen", () => ({ AttendanceScreen: () => null }));
jest.mock("../modules/admin/TeamManagerScreen", () => ({ TeamManagerScreen: () => null }));
jest.mock("../modules/admin/SystemSettingsScreen", () => ({ SystemSettingsScreen: () => null }));
jest.mock("../modules/admin/AdminMetaAdsScreen", () => ({ AdminMetaAdsScreen: () => null }));
jest.mock("../modules/finance/FinancialCoreScreen", () => ({ FinancialCoreScreen: () => null }));
jest.mock("../modules/notifications/NotificationsScreen", () => ({ NotificationsScreen: () => null }));
jest.mock("../modules/profile/ProfileScreen", () => ({ ProfileScreen: () => null }));
jest.mock("../modules/more/MoreMenuScreen", () => ({ MoreMenuScreen: () => null }));
jest.mock("../modules/tasks/TaskManagerScreen", () => ({ TaskManagerScreen: () => null }));

const expectedTabs: Record<UserRole, string[]> = {
  SUPER_ADMIN: ["Dashboard", "Leads", "Inventory", "Notifications", "More"],
  ADMIN: ["Dashboard", "Leads", "Inventory", "Notifications", "More"],
  MANAGER: ["Dashboard", "Leads", "Inventory", "Chat", "More"],
  INSIDE_EXECUTIVE: ["Dashboard", "Leads", "Inventory", "Chat", "More"],
  EXECUTIVE: ["Dashboard", "Leads", "Inventory", "Chat", "More"],
  FIELD_EXECUTIVE: ["Dashboard", "Leads", "Field Ops", "Chat", "More"],
  PRODUCTION_EXECUTIVE: ["Dashboard", "Tasks", "Attendance", "Chat", "More"],
  CHANNEL_PARTNER: ["Leads", "Inventory", "Targets", "More"],
};

describe("RoleTabs", () => {
  it.each(supportedRoles)("renders the correct primary tabs for %s", (role) => {
    const screen = render(<RoleTabs role={role} />);

    for (const tabName of expectedTabs[role]) {
      expect(screen.getByTestId(`tab-${tabName}`)).toBeTruthy();
    }

    const forbiddenTabs = Object.values(expectedTabs)
      .flat()
      .filter((tabName, index, all) => all.indexOf(tabName) === index)
      .filter((tabName) => !expectedTabs[role].includes(tabName));

    for (const tabName of forbiddenTabs) {
      expect(screen.queryByTestId(`tab-${tabName}`)).toBeNull();
    }
  });
});
