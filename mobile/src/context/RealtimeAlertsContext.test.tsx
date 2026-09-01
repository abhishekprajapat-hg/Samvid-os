import React from "react";
import { Pressable, Text, Vibration } from "react-native";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { RealtimeAlertsProvider, useRealtimeAlerts } from "./RealtimeAlertsContext";

const mockSocketHandlers: Record<string, (payload: any) => void> = {};
const mockSocket: {
  on: jest.Mock<void, [string, (payload: any) => void]>;
  off: jest.Mock<void, [string, (payload: any) => void]>;
  emit: jest.Mock<void, [string, any?]>;
  disconnect: jest.Mock<void, []>;
} = {
  on: jest.fn((event: string, handler: (payload: any) => void) => {
    mockSocketHandlers[event] = handler;
  }),
  off: jest.fn(),
  emit: jest.fn(),
  disconnect: jest.fn(),
};

const mockSound = {
  stopAsync: jest.fn(() => Promise.resolve()),
  unloadAsync: jest.fn(() => Promise.resolve()),
};

jest.mock("expo-av", () => ({
  Audio: {
    setAudioModeAsync: jest.fn(() => Promise.resolve()),
    Sound: {
      createAsync: jest.fn(() => Promise.resolve({ sound: mockSound })),
    },
  },
}));

jest.mock("../services/chatSocket", () => ({
  createChatSocket: jest.fn(() => mockSocket),
}));

jest.mock("../services/chatService", () => ({
  getMessengerConversations: jest.fn(() => Promise.resolve([])),
  updateCallLog: jest.fn(() => Promise.resolve({ _id: "call-1", status: "ACCEPTED" })),
}));

jest.mock("../services/leadService", () => ({
  getLeadPaymentRequests: jest.fn(() => Promise.resolve([])),
  getPendingLeadStatusRequests: jest.fn(() => Promise.resolve([])),
}));

jest.mock("../services/inventoryService", () => ({
  getPendingInventoryRequests: jest.fn(() => Promise.resolve([])),
}));

jest.mock("../services/pushNotifications", () => ({
  notifyChatMessage: jest.fn(() => Promise.resolve()),
}));

jest.mock("./AuthContext", () => ({
  useAuth: () => ({
    isLoggedIn: true,
    token: "socket-token",
    user: { _id: "user-1", name: "Current User", role: "ADMIN" },
  }),
}));

jest.mock("../navigation/navigationRef", () => ({
  navigateFromAnywhere: jest.fn(),
}));

const chatService = jest.requireMock("../services/chatService");
const pushNotifications = jest.requireMock("../services/pushNotifications");
const navigationRef = jest.requireMock("../navigation/navigationRef");

const Probe = () => {
  const alerts = useRealtimeAlerts();
  const firstPopup = alerts.popupItems[0];
  return (
    <>
      <Text testID="chatUnread">{alerts.chatUnreadTotal}</Text>
      <Text testID="notificationUnread">{alerts.notificationUnreadTotal}</Text>
      <Text testID="popupTitle">{firstPopup?.title || "none"}</Text>
      <Text testID="popupMessage">{firstPopup?.message || "none"}</Text>
      <Pressable testID="acceptCall" onPress={() => alerts.acceptCallPopup(firstPopup?.id || "")}>
        <Text>Accept</Text>
      </Pressable>
      <Pressable testID="rejectCall" onPress={() => alerts.rejectCallPopup(firstPopup?.id || "")}>
        <Text>Reject</Text>
      </Pressable>
    </>
  );
};

const renderProvider = () =>
  render(
    <RealtimeAlertsProvider>
      <Probe />
    </RealtimeAlertsProvider>,
  );

describe("RealtimeAlertsContext", () => {
  beforeEach(() => {
    Object.keys(mockSocketHandlers).forEach((key) => delete mockSocketHandlers[key]);
    mockSocket.on.mockClear();
    mockSocket.off.mockClear();
    mockSocket.emit.mockClear();
    mockSocket.disconnect.mockClear();
    mockSound.stopAsync.mockClear();
    mockSound.unloadAsync.mockClear();
    chatService.getMessengerConversations.mockClear();
    chatService.updateCallLog.mockClear();
    pushNotifications.notifyChatMessage.mockClear();
    navigationRef.navigateFromAnywhere.mockClear();
    jest.spyOn(Vibration, "vibrate").mockImplementation(() => undefined);
    jest.spyOn(Vibration, "cancel").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("counts chat messages from other users and triggers the local notification bridge", async () => {
    const screen = renderProvider();
    await waitFor(() => expect(mockSocket.on).toHaveBeenCalledWith("chat:message:new", expect.any(Function)));

    await act(async () => {
      mockSocketHandlers["chat:message:new"]({
        message: {
          _id: "message-1",
          text: "Please check this lead",
          sender: { _id: "user-2", name: "Peer User" },
        },
        conversation: {
          _id: "conversation-1",
          participants: [
            { _id: "user-1", name: "Current User", role: "ADMIN" },
            { _id: "user-2", name: "Peer User", role: "EXECUTIVE" },
          ],
        },
      });
    });

    expect(screen.getByTestId("chatUnread").props.children).toBe(1);
    expect(pushNotifications.notifyChatMessage).toHaveBeenCalledWith({
      conversationId: "conversation-1",
      contactId: "user-2",
      contactName: "Peer User",
      contactRole: "EXECUTIVE",
      contactAvatar: "",
      message: "Please check this lead",
    });
  });

  it("ignores echoed chat messages from the logged-in user", async () => {
    const screen = renderProvider();
    await waitFor(() => expect(mockSocketHandlers["chat:message:new"]).toBeTruthy());

    await act(async () => {
      mockSocketHandlers["chat:message:new"]({
        message: {
          _id: "message-self",
          text: "My own message",
          sender: { _id: "user-1", name: "Current User" },
        },
        conversation: { _id: "conversation-1", participants: [] },
      });
    });

    expect(screen.getByTestId("chatUnread").props.children).toBe(0);
    expect(pushNotifications.notifyChatMessage).not.toHaveBeenCalled();
  });

  it("shows an incoming call from another screen and accepts it with the stable call ID", async () => {
    const screen = renderProvider();
    await waitFor(() => expect(mockSocketHandlers["chat:call:incoming"]).toBeTruthy());

    await act(async () => {
      mockSocketHandlers["chat:call:incoming"]({
        callId: "call-123",
        conversationId: "conversation-1",
        callType: "VIDEO",
        caller: { _id: "user-2", name: "Peer User" },
      });
    });

    expect(screen.getByTestId("popupTitle").props.children).toBe("Incoming Video call");
    expect(screen.getByTestId("popupMessage").props.children).toBe("Peer User");

    fireEvent.press(screen.getByTestId("acceptCall"));

    await waitFor(() =>
      expect(mockSocket.emit).toHaveBeenCalledWith("chat:call:accept", {
        callId: "call-123",
        conversationId: "conversation-1",
      }),
    );
    expect(mockSocket.emit).toHaveBeenCalledWith("messenger:call:update", {
      callId: "call-123",
      conversationId: "conversation-1",
      recipientId: "user-2",
      status: "ACCEPTED",
    });
    expect(chatService.updateCallLog).toHaveBeenCalledWith({ callId: "call-123", status: "ACCEPTED" });
    expect(navigationRef.navigateFromAnywhere).toHaveBeenCalledWith("CallScreen", {
      callId: "call-123",
      callType: "VIDEO",
      peerId: "user-2",
      peerName: "Peer User",
      conversationId: "conversation-1",
      incoming: true,
    });
  });

  it("ignores incoming call echoes from the logged-in user", async () => {
    const screen = renderProvider();
    await waitFor(() => expect(mockSocketHandlers["chat:call:incoming"]).toBeTruthy());

    await act(async () => {
      mockSocketHandlers["chat:call:incoming"]({
        callId: "call-self",
        conversationId: "conversation-1",
        callType: "VOICE",
        caller: { _id: "user-1", name: "Current User" },
      });
    });

    expect(screen.getByTestId("popupTitle").props.children).toBe("none");
    expect(mockSocket.emit).not.toHaveBeenCalled();
  });

  it("increments background notification badges once per event", async () => {
    const screen = renderProvider();
    await waitFor(() => expect(mockSocketHandlers["lead:status:request:created"]).toBeTruthy());

    await act(async () => {
      mockSocketHandlers["lead:status:request:created"]({ eventId: "request-1" });
      mockSocketHandlers["lead:status:request:created"]({ eventId: "request-1" });
      mockSocketHandlers["inventory:request:created"]({ eventId: "request-2" });
    });

    expect(screen.getByTestId("notificationUnread").props.children).toBe(2);
  });
});
