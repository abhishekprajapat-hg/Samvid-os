import { useContext } from "react";
import ChatNotificationContext from "./chatNotificationContext";

export const useChatNotifications = () => {
  const context = useContext(ChatNotificationContext);
  if (!context) {
    return {
      unreadByConversation: {},
      unreadTotal: 0,
      recentNotifications: [],
      adminRequestUnread: 0,
      recentAdminRequests: [],
      adminRequestPulseAt: 0,
      socketConnected: false,
      permission: "unsupported",
      setActiveConversationId: () => {},
      syncUnreadFromConversations: () => {},
      markConversationRead: async () => {},
      markAllRead: async () => {},
      clearRecentNotifications: () => {},
      markAdminRequestsRead: () => {},
      clearAdminRequestNotifications: () => {},
      requestBrowserPermission: async () => "unsupported",
    };
  }

  return context;
};
