import { useContext } from "react";
import ChatNotificationContext from "./chatNotificationContext";

export const useChatNotifications = () => {
  const context = useContext(ChatNotificationContext);
  if (!context) {
    return {
      unreadByConversation: {},
      unreadTotal: 0,
      recentNotifications: [],
      socketConnected: false,
      permission: "unsupported",
      setActiveConversationId: () => {},
      syncUnreadFromConversations: () => {},
      markConversationRead: async () => {},
      markAllRead: async () => {},
      clearRecentNotifications: () => {},
      requestBrowserPermission: async () => "unsupported",
    };
  }

  return context;
};

