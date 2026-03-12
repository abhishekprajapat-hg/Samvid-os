import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Audio } from "expo-av";
import { Vibration } from "react-native";
import { createChatSocket } from "../services/chatSocket";
import { getMessengerConversations, updateCallLog } from "../services/chatService";
import { getLeadPaymentRequests, getPendingLeadStatusRequests } from "../services/leadService";
import { getPendingInventoryRequests } from "../services/inventoryService";
import { notifyChatMessage } from "../services/pushNotifications";
import { useAuth } from "./AuthContext";
import type { ChatConversation } from "../types";
import { navigateFromAnywhere } from "../navigation/navigationRef";

type PopupKind = "CHAT" | "CALL" | "NOTIFICATION";

export type RealtimePopup = {
  id: string;
  kind: PopupKind;
  title: string;
  message: string;
  createdAt: string;
  callMeta?: {
    callId: string;
    callType: "VOICE" | "VIDEO";
    conversationId: string;
    callerId: string;
    callerName: string;
  };
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
  acceptCallPopup: (popupId: string) => void;
  rejectCallPopup: (popupId: string) => void;
  dismissCallPopups: () => void;
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
  acceptCallPopup: noop,
  rejectCallPopup: noop,
  dismissCallPopups: noop,
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
    const paymentRequests = await getLeadPaymentRequests({ approvalStatus: "PENDING", limit: 200 });
    total += Array.isArray(paymentRequests) ? paymentRequests.length : 0;
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
  const socketRef = useRef<ReturnType<typeof createChatSocket> | null>(null);
  const ringtoneRef = useRef<Audio.Sound | null>(null);
  const activeRingtoneCallIdRef = useRef("");

  const pushPopup = useCallback((popup: RealtimePopup) => {
    setPopupItems((prev) => [popup, ...prev].slice(0, MAX_POPUPS));
  }, []);

  const dismissPopup = useCallback((popupId: string) => {
    const id = String(popupId || "").trim();
    if (!id) return;
    setPopupItems((prev) => prev.filter((row) => row.id !== id));
  }, []);

  const stopIncomingRingtone = useCallback(async () => {
    try {
      Vibration.cancel();
      if (ringtoneRef.current) {
        await ringtoneRef.current.stopAsync().catch(() => {});
        await ringtoneRef.current.unloadAsync().catch(() => {});
      }
    } finally {
      ringtoneRef.current = null;
      activeRingtoneCallIdRef.current = "";
    }
  }, []);

  const playIncomingRingtone = useCallback(async (callId: string) => {
    if (!callId || activeRingtoneCallIdRef.current === callId) return;
    await stopIncomingRingtone();
    Vibration.vibrate([0, 450, 250, 450], true);
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
      const { sound } = await Audio.Sound.createAsync(
        { uri: "https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg" },
        { shouldPlay: true, isLooping: true, volume: 1.0 },
      );
      ringtoneRef.current = sound;
      activeRingtoneCallIdRef.current = callId;
    } catch {
      // ringtone is optional
    }
  }, [stopIncomingRingtone]);

  const dismissCallPopups = useCallback(() => {
    setPopupItems((prev) => prev.filter((row) => row.kind !== "CALL"));
    void stopIncomingRingtone();
  }, [stopIncomingRingtone]);

  const acceptCallPopup = useCallback((popupId: string) => {
    const popup = popupItems.find((row) => row.id === popupId && row.kind === "CALL");
    if (!popup?.callMeta) return;

    const { callId, callType, conversationId, callerId, callerName } = popup.callMeta;
    void stopIncomingRingtone();
    setPopupItems((prev) => prev.filter((row) => row.id !== popupId));

    socketRef.current?.emit("chat:call:accept", {
      callId,
      conversationId: conversationId || null,
    });
    socketRef.current?.emit("messenger:call:update", {
      callId,
      conversationId: conversationId || null,
      recipientId: callerId || null,
      status: "ACCEPTED",
    });
    void updateCallLog({ callId, status: "ACCEPTED" }).catch(() => {});

    navigateFromAnywhere("CallScreen", {
      callId,
      callType,
      peerId: callerId,
      peerName: callerName,
      conversationId,
      incoming: true,
    });
  }, [popupItems, stopIncomingRingtone]);

  const rejectCallPopup = useCallback((popupId: string) => {
    const popup = popupItems.find((row) => row.id === popupId && row.kind === "CALL");
    if (!popup?.callMeta) return;

    const { callId, conversationId, callerId } = popup.callMeta;
    void stopIncomingRingtone();
    setPopupItems((prev) => prev.filter((row) => row.id !== popupId));

    socketRef.current?.emit("chat:call:reject", {
      callId,
      conversationId: conversationId || null,
    });
    socketRef.current?.emit("messenger:call:update", {
      callId,
      conversationId: conversationId || null,
      recipientId: callerId || null,
      status: "REJECTED",
    });
    void updateCallLog({ callId, status: "REJECTED", durationSec: 0 }).catch(() => {});
  }, [popupItems, stopIncomingRingtone]);

  const clearPopups = useCallback(() => {
    setPopupItems([]);
    void stopIncomingRingtone();
  }, [stopIncomingRingtone]);

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
    void stopIncomingRingtone();
  }, [stopIncomingRingtone]);

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
    socketRef.current = socket;

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

      const participants = Array.isArray(conversation?.participants) ? conversation.participants : [];
      const peer = participants.find((participant: any) => String(participant?._id || "").trim() !== userId) || null;
      const conversationContactId = String(peer?._id || senderId || "").trim();
      const conversationContactName =
        String(peer?.name || message?.sender?.name || "").trim() || "New message";
      const conversationContactRole = String(peer?.role || "").trim();
      const conversationContactAvatar = String(peer?.avatarUrl || peer?.profileImageUrl || "").trim();

      if (conversationId && activeConversationIdRef.current === conversationId) return;

      void notifyChatMessage({
        conversationId,
        contactId: conversationContactId,
        contactName: conversationContactName,
        contactRole: conversationContactRole,
        contactAvatar: conversationContactAvatar,
        message: getMessagePreview(message),
      }).catch(() => {});
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
      const isVideo = String(payload?.callType || payload?.mode || "VOICE").toUpperCase() === "VIDEO";
      const callType = isVideo ? "Video" : "Voice";
      const callerName = String(caller?.name || "").trim() || "Unknown";
      const conversationId = String(payload?.conversationId || payload?.roomId || "").trim();
      const callerIdResolved = String(caller?._id || "").trim();

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
        callMeta: {
          callId,
          callType: isVideo ? "VIDEO" : "VOICE",
          conversationId,
          callerId: callerIdResolved,
          callerName,
        },
      });
      void playIncomingRingtone(callId);
    };

    const onNotification = (eventName: string, payload: any) => {
      const eventId = buildNotificationEventId(eventName, payload);
      if (seenNotificationIdsRef.current.has(eventId)) return;

      seenNotificationIdsRef.current.add(eventId);
      if (seenNotificationIdsRef.current.size > 2000) {
        seenNotificationIdsRef.current.clear();
      }

      setNotificationUnreadTotal((prev) => prev + 1);
      // Notification center badge only; in-app popup is intentionally disabled for mobile UX.
    };

    const onAdminRequest = (payload: any) => onNotification("admin:request:new", payload);
    const onLeadPayment = (payload: any) => onNotification("lead:payment:request:created", payload);
    const onInventoryCreated = (payload: any) => onNotification("inventory:request:created", payload);
    const onInventoryReviewed = (payload: any) => onNotification("inventory:request:reviewed", payload);
    const onCallUpdate = (payload: any) => {
      const status = String(payload?.status || payload?.event || "").toUpperCase();
      const callId = String(payload?.callId || "").trim();
      if (!callId || !status) return;
      if (!["ACCEPTED", "CONNECTED", "REJECTED", "MISSED", "ENDED", "FAILED", "CANCELLED", "DISCONNECTED"].includes(status)) return;
      setPopupItems((prev) => prev.filter((row) => row.kind !== "CALL" || row.callMeta?.callId !== callId));
      void stopIncomingRingtone();
    };

    socket.on("messenger:message:new", onMessage);
    socket.on("chat:message:new", onMessage);
    socket.on("chat:room:read", onRoomRead);
    socket.on("messenger:call:incoming", onIncomingCall);
    socket.on("chat:call:incoming", onIncomingCall);
    socket.on("admin:request:new", onAdminRequest);
    socket.on("lead:payment:request:created", onLeadPayment);
    socket.on("inventory:request:created", onInventoryCreated);
    socket.on("inventory:request:reviewed", onInventoryReviewed);
    socket.on("messenger:call:update", onCallUpdate);
    socket.on("chat:call:accepted", onCallUpdate);
    socket.on("chat:call:rejected", onCallUpdate);
    socket.on("chat:call:ended", onCallUpdate);

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
      socket.off("messenger:call:update", onCallUpdate);
      socket.off("chat:call:accepted", onCallUpdate);
      socket.off("chat:call:rejected", onCallUpdate);
      socket.off("chat:call:ended", onCallUpdate);
      socket.disconnect();
      socketRef.current = null;
      activeConversationIdRef.current = "";
      void stopIncomingRingtone();
    };
  }, [isLoggedIn, markChatConversationRead, playIncomingRingtone, pushPopup, resetState, stopIncomingRingtone, syncInitialCounts, token, userId]);

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
      acceptCallPopup,
      rejectCallPopup,
      dismissCallPopups,
      clearPopups,
    }),
    [
      chatUnreadTotal,
      clearPopups,
      acceptCallPopup,
      dismissPopup,
      dismissCallPopups,
      markAllChatRead,
      markChatConversationRead,
      markNotificationsRead,
      notificationUnreadTotal,
      popupItems,
      rejectCallPopup,
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
