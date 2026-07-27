import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { MoreMenuScreen, getMoreMenuItemsForRole } from "./MoreMenuScreen";
import { supportedRoles } from "../../test/fixtures";
import type { UserRole } from "../../types";

let mockRole: UserRole | null = "ADMIN";
const mockNavigate = jest.fn();
const mockParentNavigate = jest.fn();
const mockMarkAllChatRead = jest.fn();

jest.mock("../../context/AuthContext", () => ({
  useAuth: () => ({
    role: mockRole,
  }),
}));

jest.mock("../../context/RealtimeAlertsContext", () => ({
  useRealtimeAlerts: () => ({
    chatUnreadTotal: 4,
    markAllChatRead: mockMarkAllChatRead,
  }),
}));

describe("MoreMenuScreen", () => {
  beforeEach(() => {
    mockRole = "ADMIN";
    mockNavigate.mockReset();
    mockParentNavigate.mockReset();
    mockMarkAllChatRead.mockReset();
  });

  it.each(supportedRoles)("returns deterministic More menu items for %s", (role) => {
    const labels = getMoreMenuItemsForRole(role).map((item) => item.label);

    expect(labels).toContain("Samvid Assistant");
    expect(labels).toContain("Profile");
    expect(labels).toContain("Tasks");
    expect(labels).toContain("Leaderboard");
    expect(labels).toContain("Targets");
    expect(labels).toContain("Calendar");

    if (role === "ADMIN" || role === "SUPER_ADMIN" || role === "MANAGER") {
      expect(labels).toContain("Users");
      expect(labels).toContain("Reports");
      expect(labels).toContain("Settings");
      expect(labels).toContain("Meta Ads");
    } else {
      expect(labels).not.toContain("Users");
      expect(labels).not.toContain("Reports");
      expect(labels).not.toContain("Settings");
      expect(labels).not.toContain("Meta Ads");
    }

    if (role === "CHANNEL_PARTNER") {
      expect(labels).not.toContain("Attendance");
      expect(labels).not.toContain("Finance");
    } else {
      expect(labels).toContain("Attendance");
      expect(labels).toContain("Finance");
    }
  });

  it("renders the production executive menu without falling back to channel-partner restrictions", () => {
    mockRole = "PRODUCTION_EXECUTIVE";

    const screen = render(<MoreMenuScreen navigation={{ navigate: mockNavigate }} />);

    expect(screen.getByText("Attendance")).toBeTruthy();
    expect(screen.getByText("Finance")).toBeTruthy();
    expect(screen.queryByText("Users")).toBeNull();
    expect(screen.queryByText("Chat")).toBeNull();
  });

  it("opens Chat through the parent navigator and marks messages read", () => {
    mockRole = "ADMIN";
    const screen = render(
      <MoreMenuScreen
        navigation={{
          navigate: mockNavigate,
          getParent: () => ({ navigate: mockParentNavigate }),
        }}
      />,
    );

    fireEvent.press(screen.getByTestId("more-menu-chat"));

    expect(mockMarkAllChatRead).toHaveBeenCalledTimes(1);
    expect(mockParentNavigate).toHaveBeenCalledWith("Chat");
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
