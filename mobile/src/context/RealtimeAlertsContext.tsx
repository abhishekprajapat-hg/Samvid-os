import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createChatSocket } from "../services/chatSocket";
import { getMessengerConversations } from "../services/chatService";
import { getPendingLeadStatusRequests } from "../services/leadService";
import { getPendingInventoryRequests } from "../services/inventoryService";
import { useAuth } from "./AuthContext";
import type { ChatConversation } from "../types";

type PopupKind = "CHAT" | "CALL" | "NOTIFICATION";

export type RealtimePopup = {
  id: string;
  kind: PopupKind;
  title: string;
  message: string;
  createdAt: string;
};

type RealtimeAlertsContextValue = {
  chatUnreadTotal: number;
  notificationUnreadTotal: number;
  popupItems: RealtimePopup[];
  setActiveChatConversation: (conversationId: string) => void;
  syncChatUnreadFromConversations: (conversations: ChatConversation[]) => void;
  markChatConversationRead: (conversationId: string) => void;
  markAllChatRead: () => void;
  markNotificationsRead: () => void;
  dismissPopup: (popupId: string) => void;
  clearPopups: () => void;
};

const noop = () => {};

const RealtimeAlertsContext = createContext<RealtimeAlertsContextValue>({
  chatUnreadTotal: 0,
  notificationUnreadTotal: 0,
  popupItems: [],
  setActiveChatConversation: noop,
  syncChatUnreadFromConversations: noop,
  markChatConversationRead: noop,
  markAllChatRead: noop,
  markNotificationsRead: noop,
  dismissPopup: noop,
  clearPopups: noop,
});

const MAX_POPUPS = 4;

const toConversationUnreadMap = (rows: ChatConversation[]) =>
  rows.reduce<Record<string, number>>((acc, row) => {
    const id = String(row?._id || "").trim();
    const count = Math.max(0, Number((row as any)?.unreadCount || 0));
    if (id && count > 0) {
      acc[id] = count;
    }
    return acc;
  }, {});

const sumUnreadCounts = (rows: Record<string, number>) =>
  Object.values(rows).reduce((sum, value) => sum + Math.max(0, Number(value || 0)), 0);

const toErrorStatus = (error: unknown) =>
  Number((error as { response?: { status?: number } })?.response?.status || 0);

const isExpectedNotificationCountError = (error: unknown) => {
  const status = toErrorStatus(error);
  return status === 401 || status === 403 || status === 404;
};

const getMessagePreview = (message: any) => {
  const text = String(message?.text || "").trim();
  if (text) return text;

  const type = String(message?.type || "").trim().toLowerCase();
  if (type === "property") {
    const title = String(message?.sharedProperty?.title || "").trim();
    return title ? `Shared property: ${title}` : "Shared a property";
  }
  if (type === "media") {
    const total = Array.isArray(message?.mediaAttachments) ? message.mediaAttachments.length : 0;
    return total > 1 ? `Shared ${total} media files` : "Shared a media file";
  }
  return "New message";
};

const buildNotificationEventId = (eventName: string, payload: any) => {
  const rawId =
    payload?.eventId
    || payload?.requestId
    || payload?.leadId
    || payload?._id
    || payload?.id
    || `${eventName}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return String(rawId || "").trim() || `${eventName}-${Date.now()}`;
};

const buildNotificationText = (eventName: string, payload: any) => {
  const explicit = String(payload?.message || "").trim();
  if (explicit) return explicit;

  if (eventName === "inventory:request:reviewed") {
    const status = String(payload?.status || "").trim().toUpperCase() || "UPDATED";
    return `Inventory request ${status}`;
  }
  if (eventName === "inventory:request:created") {
    return "New inventory request submitted";
  }
  if (eventName === "lead:payment:request:created") {
    return "New lead payment approval request";
  }
  if (eventName === "admin:request:new") {
    return "New approval request";
  }
  return "New notification received";
};

const getPendingNotificationCount = async () => {
  let total = 0;

  try {
    const leadRequests = await getPendingLeadStatusRequests();
    total += Array.isArray(leadRequests) ? leadRequests.length : 0;
  } catch {
    // keep 0 for this source
  }

  try {
    const inventoryRequests = await getPendingInventoryRequests();
    total += Array.isArray(inventoryRequests) ? inventoryRequests.length : 0;
  } catch (error) {
    if (!isExpectedNotificationCountError(error)) {
      // keep 0 for this source
    }
  }

  return Math.max(0, total);
};

export const RealtimeAlertsProvider = ({ children }: { children: React.ReactNode }) => {
  const { isLoggedIn, token, user } = useAuth();
  const userId = useMemo(() => String(user?._id || user?.id || "").trim(), [user]);

  const [unreadByConversation, setUnreadByConversation] = useState<Record<string, number>>({});
  const [chatSignalCount, setChatSignalCount] = useState(0);
  const [notificationUnreadTotal, setNotificationUnreadTotal] = useState(0);
  const [popupItems, setPopupItems] = useState<RealtimePopup[]>([]);

  const activeConversationIdRef = useRef("");
  const seenMessageIdsRef = useRef(new Set<string>());
  const seenNotificationIdsRef = useRef(new Set<string>());
  const seenCallIdsRef = useRef(new Set<string>());

  const pushPopup = useCallback((popup: RealtimePopup) => {
    setPopupItems((prev) => [popup, ...prev].slice(0, MAX_POPUPS));
  }, []);

  const dismissPopup = useCallback((popupId: string) => {
    const id = String(popupId || "").trim();
    if (!id) return;
    setPopupItems((prev) => prev.filter((row) => row.id !== id));
  }, []);

  const clearPopups = useCallback(() => {
    setPopupItems([]);
  }, []);

  const setActiveChatConversation = useCallback((conversationId: string) => {
    activeConversationIdRef.current = String(conversationId || "").trim();
  }, []);

  const syncChatUnreadFromConversations = useCallback((conversations: ChatConversation[]) => {
    setUnreadByConversation(toConversationUnreadMap(Array.isArray(conversations) ? conversations : []));
  }, []);

  const markChatConversationRead = useCallback((conversationId: string) => {
    const id = String(conversationId || "").trim();
    if (!id) return;
    setUnreadByConversation((prev) => {
      if (!Object.prototype.hasOwnProperty.call(prev, id)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const markAllChatRead = useCallback(() => {
    setUnreadByConversation({});
    setChatSignalCount(0);
  }, []);

  const markNotificationsRead = useCallback(() => {
    setNotificationUnreadTotal(0);
  }, []);

  const resetState = useCallback(() => {
    setUnreadByConversation({});
    setChatSignalCount(0);
    setNotificationUnreadTotal(0);
    setPopupItems([]);
    activeConversationIdRef.current = "";
    seenMessageIdsRef.current.clear();
    seenNotificationIdsRef.current.clear();
    seenCallIdsRef.current.clear();
  }, []);

  const syncInitialCounts = useCallback(async () => {
    if (!token || !isLoggedIn) return;

    try {
      const conversations = await getMessengerConversations();
      setUnreadByConversation(toConversationUnreadMap(conversations));
    } catch {
      setUnreadByConversation({});
    }

    try {
      const count = await getPendingNotificationCount();
      setNotificationUnreadTotal(count);
    } catch {
      setNotificationUnreadTotal(0);
    }
  }, [isLoggedIn, token]);

  useEffect(() => {
    if (!isLoggedIn || !token || !userId) {
      resetState();
      return;
    }

    void syncInitialCounts();

    const socket = createChatSocket(token);

    const onMessage = (payload: any) => {
      const message = payload?.message || null;
      const conversation = payload?.conversation || payload?.room || null;
      const conversationId = String(conversation?._id || message?.conversation || message?.room || "").trim();
      const messageId = String(message?._id || "").trim();
      if (!messageId) return;

      if (seenMessageIdsRef.current.has(messageId)) return;
      seenMessageIdsRef.current.add(messageId);
      if (seenMessageIdsRef.current.size > 2000) {
        seenMessageIdsRef.current.clear();
      }

      const senderId = String(message?.sender?._id || "").trim();
      if (senderId && senderId === userId) return;

      if (conversationId && activeConversationIdRef.current !== conversationId) {
        setUnreadByConversation((prev) => ({
          ...prev,
          [conversationId]: Math.max(0, Number(prev[conversationId] || 0)) + 1,
        }));
      } else if (!conversationId) {
        setChatSignalCount((prev) => prev + 1);
      }

      const senderName = String(message?.sender?.name || "").trim() || "New message";
      pushPopup({
        id: `chat-${messageId}`,
        kind: "CHAT",
        title: senderName,
        message: getMessagePreview(message),
        createdAt: new Date().toISOString(),
      });
    };

    const onRoomRead = (payload: any) => {
      const roomId = String(payload?.roomId || "").trim();
      const actorId = String(payload?.userId || "").trim();
      if (!roomId || actorId !== userId) return;
      markChatConversationRead(roomId);
    };

    const onIncomingCall = (payload: any) => {
      const caller = payload?.caller || payload?.from || {};
      const callerId = String(caller?._id || "").trim();
      if (callerId && callerId === userId) return;

      const resolvedCallId = String(payload?.callId || "").trim();
      if (resolvedCallId && seenCallIdsRef.current.has(resolvedCallId)) return;
      if (resolvedCallId) {
        seenCallIdsRef.current.add(resolvedCallId);
        if (seenCallIdsRef.current.size > 1000) {
          seenCallIdsRef.current.clear();
        }
      }

      const callId = resolvedCallId || `call-${Date.now()}`;
      const callType = String(payload?.callType || payload?.mode || "VOICE").toUpperCase() === "VIDEO" ? "Video" : "Voice";
      const callerName = String(caller?.name || "").trim() || "Unknown";
      const conversationId = String(payload?.conversationId || payload?.roomId || "").trim();

      if (conversationId && activeConversationIdRef.current !== conversationId) {
        setUnreadByConversation((prev) => ({
          ...prev,
          [conversationId]: Math.max(0, Number(prev[conversationId] || 0)) + 1,
        }));
      } else {
        setChatSignalCount((prev) => prev + 1);
      }

      pushPopup({
        id: `call-${callId}`,
        kind: "CALL",
        title: `Incoming ${callType} call`,
        message: callerName,
        createdAt: new Date().toISOString(),
      });
    };

    const onNotification = (eventName: string, payload: any) => {
      const eventId = buildNotificationEventId(eventName, payload);
      if (seenNotificationIdsRef.current.has(eventId)) return;

      seenNotificationIdsRef.current.add(eventId);
      if (seenNotificationIdsRef.current.size > 2000) {
        seenNotificationIdsRef.current.clear();
      }

      setNotificationUnreadTotal((prev) => prev + 1);
      pushPopup({
        id: `notification-${eventId}`,
        kind: "NOTIFICATION",
        title: "Notification",
        message: buildNotificationText(eventName, payload),
        createdAt: new Date().toISOString(),
      });
    };

    const onAdminRequest = (payload: any) => onNotification("admin:request:new", payload);
    const onLeadPayment = (payload: any) => onNotification("lead:payment:request:created", payload);
    const onInventoryCreated = (payload: any) => onNotification("inventory:request:created", payload);
    const onInventoryReviewed = (payload: any) => onNotification("inventory:request:reviewed", payload);

    socket.on("messenger:message:new", onMessage);
    socket.on("chat:message:new", onMessage);
    socket.on("chat:room:read", onRoomRead);
    socket.on("messenger:call:incoming", onIncomingCall);
    socket.on("chat:call:incoming", onIncomingCall);
    socket.on("admin:request:new", onAdminRequest);
    socket.on("lead:payment:request:created", onLeadPayment);
    socket.on("inventory:request:created", onInventoryCreated);
    socket.on("inventory:request:reviewed", onInventoryReviewed);

    return () => {
      socket.off("messenger:message:new", onMessage);
      socket.off("chat:message:new", onMessage);
      socket.off("chat:room:read", onRoomRead);
      socket.off("messenger:call:incoming", onIncomingCall);
      socket.off("chat:call:incoming", onIncomingCall);
      socket.off("admin:request:new", onAdminRequest);
      socket.off("lead:payment:request:created", onLeadPayment);
      socket.off("inventory:request:created", onInventoryCreated);
      socket.off("inventory:request:reviewed", onInventoryReviewed);
      socket.disconnect();
      activeConversationIdRef.current = "";
    };
  }, [isLoggedIn, markChatConversationRead, pushPopup, resetState, syncInitialCounts, token, userId]);

  const chatUnreadTotal = useMemo(
    () => sumUnreadCounts(unreadByConversation) + chatSignalCount,
    [chatSignalCount, unreadByConversation],
  );

  const contextValue = useMemo<RealtimeAlertsContextValue>(
    () => ({
      chatUnreadTotal,
      notificationUnreadTotal,
      popupItems,
      setActiveChatConversation,
      syncChatUnreadFromConversations,
      markChatConversationRead,
      markAllChatRead,
      markNotificationsRead,
      dismissPopup,
      clearPopups,
    }),
    [
      chatUnreadTotal,
      clearPopups,
      dismissPopup,
      markAllChatRead,
      markChatConversationRead,
      markNotificationsRead,
      notificationUnreadTotal,
      popupItems,
      setActiveChatConversation,
      syncChatUnreadFromConversations,
    ],
  );

  return (
    <RealtimeAlertsContext.Provider value={contextValue}>
      {children}
    </RealtimeAlertsContext.Provider>
  );
};

export const useRealtimeAlerts = () => useContext(RealtimeAlertsContext);
