import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { MoreMenuScreen } from "./MoreMenuScreen";
import type { UserRole } from "../../types";

let mockRole: UserRole | null = "ADMIN";
const mockNavigate = jest.fn();
const mockParentNavigate = jest.fn();
const mockMarkAllChatRead = jest.fn();
const mockLogout = jest.fn();

jest.mock("../../context/AuthContext", () => ({
  useAuth: () => ({
    role: mockRole,
    user: { name: "Demo User", canViewInventory: true },
    logout: mockLogout,
  }),
}));

jest.mock("../../context/PermissionContext", () => ({
  usePermissions: () => ({ permissions: null, enforcePageAccess: false }),
}));

jest.mock("../../context/RealtimeAlertsContext", () => ({
  useRealtimeAlerts: () => ({
    chatUnreadTotal: 4,
    notificationUnreadTotal: 0,
    markAllChatRead: mockMarkAllChatRead,
  }),
}));

// RoleTabs pulls in every screen; the menu only needs these two exports.
jest.mock("../../navigation/RoleTabs", () => ({
  isScreenBuilt: () => true,
  MORE_EXCLUDED_SCREENS: ["Dashboard", "Leads", "Inventory", "Chat"],
}));

jest.mock("../../theme/ThemeContext", () => ({
  useTheme: () => ({ mode: "light", setMode: jest.fn() }),
}));

const renderMenu = () =>
  render(
    <MoreMenuScreen
      navigation={{
        navigate: mockNavigate,
        getParent: () => ({ navigate: mockParentNavigate }),
      }}
    />,
  );

describe("MoreMenuScreen", () => {
  beforeEach(() => {
    mockRole = "ADMIN";
    mockNavigate.mockReset();
    mockParentNavigate.mockReset();
    mockMarkAllChatRead.mockReset();
    mockLogout.mockReset();
  });

  it("keeps the Samvid Assistant and account rows for every role", () => {
    for (const role of ["SUPER_ADMIN", "ADMIN", "MANAGER", "EXECUTIVE", "CHANNEL_PARTNER"] as UserRole[]) {
      mockRole = role;
      const screen = renderMenu();
      expect(screen.getByTestId("more-menu-samvid-assistant")).toBeTruthy();
      expect(screen.getByText("Privacy Policy")).toBeTruthy();
      expect(screen.getByText("Log out")).toBeTruthy();
      screen.unmount();
    }
  });

  it("gives a Super Admin the same management rows as an Admin", () => {
    mockRole = "ADMIN";
    const adminRows = renderMenu().queryAllByRole("button").length;
    mockRole = "SUPER_ADMIN";
    const superAdminRows = renderMenu().queryAllByRole("button").length;
    expect(superAdminRows).toBe(adminRows);
  });

  it("opens the assistant through the parent navigator", () => {
    const screen = renderMenu();
    fireEvent.press(screen.getByTestId("more-menu-samvid-assistant"));
    expect(mockParentNavigate).toHaveBeenCalledWith("Office Assistant");
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("logs out from the account section", () => {
    const screen = renderMenu();
    fireEvent.press(screen.getByText("Log out"));
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });
});
