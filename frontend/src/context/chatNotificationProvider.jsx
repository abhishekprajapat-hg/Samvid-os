import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createChatSocket } from "../services/chatSocket";
import { getMessengerConversations, markConversationRead as markConversationReadApi } from "../services/chatService";
import ChatNotificationContext from "./chatNotificationContext";

const MAX_RECENT_NOTIFICATIONS = 20;
const MAX_RECENT_ADMIN_REQUESTS = 30;
const ADMIN_REQUEST_TONE_COOLDOWN_MS = 1200;

let lastAdminRequestToneAt = 0;

const playAdminRequestTone = () => {
  if (typeof window === "undefined") return;

  const now = Date.now();
  if (now - lastAdminRequestToneAt < ADMIN_REQUEST_TONE_COOLDOWN_MS) {
    return;
  }

  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextCtor) return;

  lastAdminRequestToneAt = now;

  try {
    const audioContext = new AudioContextCtor();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    const startAt = audioContext.currentTime;

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, startAt);
    oscillator.frequency.exponentialRampToValueAtTime(660, startAt + 0.16);

    gainNode.gain.setValueAtTime(0.0001, startAt);
    gainNode.gain.exponentialRampToValueAtTime(0.18, startAt + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.24);

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.start(startAt);
    oscillator.stop(startAt + 0.25);

    oscillator.onended = () => {
      audioContext.close().catch(() => null);
    };
  } catch {
    // Sound playback can fail due to browser autoplay restrictions.
  }
};

const getCurrentUserId = () => {
  try {
    const raw = JSON.parse(localStorage.getItem("user") || "{}");
    return String(raw.id || raw._id || "");
  } catch {
    return "";
  }
};

const getCurrentUserRole = () => {
  try {
    const fromStorage = String(localStorage.getItem("role") || "").trim().toUpperCase();
    if (fromStorage) return fromStorage;
    const raw = JSON.parse(localStorage.getItem("user") || "{}");
    return String(raw.role || "").trim().toUpperCase();
  } catch {
    return "";
  }
};

const buildPreviewText = (message) => {
  const text = String(message?.text || "").trim();
  if (text) return text;

  if (String(message?.type || "") === "property") {
    const title = String(message?.sharedProperty?.title || "").trim();
    return title ? `Shared property: ${title}` : "Shared a property";
  }

  if (String(message?.type || "") === "media") {
    const count = Array.isArray(message?.mediaAttachments)
      ? message.mediaAttachments.length
      : 0;
    return count > 1 ? `Shared ${count} media files` : "Shared a media file";
  }

  return "New message";
};

const normalizeUnreadMapFromConversations = (conversations) => {
  if (!Array.isArray(conversations)) return {};

  return conversations.reduce((acc, row) => {
    const id = String(row?._id || "");
    const count = Number(row?.unreadCount || 0);
    if (id && count > 0) {
      acc[id] = count;
    }
    return acc;
  }, {});
};

const extractIncomingMessageEvent = (payload = {}) => {
  const message = payload?.message || null;
  const conversation = payload?.conversation || payload?.room || null;
  const conversationId = String(
    conversation?._id || message?.conversation || message?.room || "",
  );

  return {
    message,
    conversationId,
  };
};

const normalizeAdminRequestEvent = (payload = {}) => {
  if (!payload || typeof payload !== "object") return null;

  const source = String(payload.source || "").trim().toLowerCase()
    || (payload.leadId || payload.lead ? "lead" : "inventory");

  if (source === "lead") {
    const leadId = String(payload.leadId || payload.lead?._id || "");
    if (!leadId) return null;

    const leadName = String(payload.lead?.name || "").trim() || "Lead";
    const paymentMode = String(payload.payment?.mode || "").trim();
    const paymentType = String(payload.payment?.paymentType || "").trim();
    const createdAt = payload.createdAt || new Date().toISOString();
    const eventId =
      String(payload.eventId || "").trim()
      || `lead-payment:${leadId}:${new Date(createdAt).getTime()}`;

    return {
      eventId,
      source: "lead",
      requestType: "LEAD_PAYMENT_APPROVAL",
      createdAt,
      preview: `${leadName} payment request (${paymentMode || "Mode NA"}${paymentType ? `, ${paymentType}` : ""})`,
      leadId,
      requestId: "",
      inventoryId: "",
      payload,
    };
  }

  const requestId = String(payload.requestId || "").trim();
  if (!requestId) return null;
  const rawInventoryId =
    payload.inventoryId
    || payload.inventory?._id
    || payload.inventory?.id
    || payload.inventoryId?._id
    || payload.request?.inventoryId?._id
    || payload.request?.inventoryId
    || "";
  const inventoryId =
    typeof rawInventoryId === "object"
      ? String(rawInventoryId._id || rawInventoryId.id || "").trim()
      : String(rawInventoryId || "").trim();
  const inventoryRequestType = String(payload.inventoryRequestType || payload.type || "update")
    .trim()
    .toLowerCase();
  const createdAt = payload.createdAt || new Date().toISOString();
  const eventId = String(payload.eventId || "").trim() || `inventory:${requestId}`;

  return {
    eventId,
    source: "inventory",
    requestType: "INVENTORY",
    createdAt,
    preview: `Inventory ${inventoryRequestType} request raised`,
    leadId: "",
    requestId,
    inventoryId,
    payload,
  };
};

export const ChatNotificationProvider = ({ children, enabled = true }) => {
  const [unreadByConversation, setUnreadByConversation] = useState({});
  const [recentNotifications, setRecentNotifications] = useState([]);
  const [adminRequestUnread, setAdminRequestUnread] = useState(0);
  const [recentAdminRequests, setRecentAdminRequests] = useState([]);
  const [adminRequestPulseAt, setAdminRequestPulseAt] = useState(0);
  const [socketConnected, setSocketConnected] = useState(false);
  const [permission, setPermission] = useState(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return "unsupported";
    }
    return Notification.permission || "default";
  });

  const activeConversationIdRef = useRef("");
  const seenMessageIdsRef = useRef(new Set());
  const seenAdminRequestIdsRef = useRef(new Set());

  const unreadTotal = useMemo(
    () =>
      Object.values(unreadByConversation).reduce(
        (sum, value) => sum + Math.max(0, Number(value || 0)),
        0,
      ),
    [unreadByConversation],
  );

  const setActiveConversationId = useCallback((conversationId) => {
    activeConversationIdRef.current = String(conversationId || "");
  }, []);

  const syncUnreadFromConversations = useCallback((conversations) => {
    const next = normalizeUnreadMapFromConversations(conversations);
    setUnreadByConversation(next);
  }, []);

  const markConversationReadLocal = useCallback((conversationId) => {
    const id = String(conversationId || "");
    if (!id) return;

    setUnreadByConversation((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const markConversationRead = useCallback(
    async (conversationId, options = {}) => {
      const id = String(conversationId || "");
      if (!id) return;

      markConversationReadLocal(id);
      if (options.persist === false) return;

      try {
        await markConversationReadApi(id);
      } catch {
        // best effort
      }
    },
    [markConversationReadLocal],
  );

  const markAllRead = useCallback(async () => {
    const ids = Object.keys(unreadByConversation);
    if (!ids.length) return;

    setUnreadByConversation({});
    await Promise.all(ids.map((id) => markConversationReadApi(id).catch(() => null)));
  }, [unreadByConversation]);

  const clearRecentNotifications = useCallback(() => {
    setRecentNotifications([]);
  }, []);

  const markAdminRequestsRead = useCallback(() => {
    setAdminRequestUnread(0);
  }, []);

  const clearAdminRequestNotifications = useCallback(() => {
    setAdminRequestUnread(0);
    setRecentAdminRequests([]);
  }, []);

  const requestBrowserPermission = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return "unsupported";
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result;
    } catch {
      return permission;
    }
  }, [permission]);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      return undefined;
    }

    let disposed = false;

    const loadUnread = async () => {
      try {
        const conversations = await getMessengerConversations();
        if (disposed) return;
        syncUnreadFromConversations(conversations);
      } catch {
        if (!disposed) {
          setUnreadByConversation({});
        }
      }
    };

    loadUnread();

    const socket = createChatSocket(token);

    const onConnect = () => {
      setSocketConnected(true);
    };

    const onDisconnect = () => {
      setSocketConnected(false);
    };

    const onConnectError = () => {
      setSocketConnected(false);
    };

    const onRoomRead = (payload = {}) => {
      const roomId = String(payload.roomId || "");
      const userId = String(payload.userId || "");
      if (!roomId || userId !== getCurrentUserId()) return;
      markConversationReadLocal(roomId);
    };

    const onNewMessage = (payload = {}) => {
      const { conversationId, message } = extractIncomingMessageEvent(payload);
      const messageId = String(message?._id || "");
      if (!messageId) return;

      if (seenMessageIdsRef.current.has(messageId)) {
        return;
      }
      seenMessageIdsRef.current.add(messageId);
      if (seenMessageIdsRef.current.size > 2000) {
        seenMessageIdsRef.current.clear();
      }

      if (!conversationId) return;

      const senderId = String(message?.sender?._id || "");
      const isOwnMessage = Boolean(senderId) && senderId === getCurrentUserId();
      const isActiveConversation =
        activeConversationIdRef.current
        && activeConversationIdRef.current === conversationId;

      if (!isOwnMessage && !isActiveConversation) {
        setUnreadByConversation((prev) => ({
          ...prev,
          [conversationId]: (prev[conversationId] || 0) + 1,
        }));
      }

      if (!isOwnMessage) {
        const senderName = String(message?.sender?.name || "").trim() || "New message";
        const preview = buildPreviewText(message);

        setRecentNotifications((prev) => [
          {
            id: `${messageId}:${Date.now()}`,
            conversationId,
            messageId,
            senderName,
            preview,
            createdAt: message?.createdAt || new Date().toISOString(),
          },
          ...prev,
        ].slice(0, MAX_RECENT_NOTIFICATIONS));

        if (
          typeof window !== "undefined"
          && "Notification" in window
          && Notification.permission === "granted"
          && document.hidden
        ) {
          try {
            new Notification(senderName, {
              body: preview,
              tag: `chat:${messageId}`,
            });
          } catch {
            // ignore browser notification errors
          }
        }
      }
    };

    const onAdminRequestEvent = (payload = {}) => {
      if (getCurrentUserRole() !== "ADMIN") return;

      const event = normalizeAdminRequestEvent(payload);
      if (!event) return;

      const eventId = String(event.eventId || "").trim();
      if (!eventId) return;

      if (seenAdminRequestIdsRef.current.has(eventId)) {
        return;
      }

      seenAdminRequestIdsRef.current.add(eventId);
      if (seenAdminRequestIdsRef.current.size > 2000) {
        seenAdminRequestIdsRef.current.clear();
      }

      setAdminRequestUnread((prev) => prev + 1);
      setAdminRequestPulseAt(Date.now());
      setRecentAdminRequests((prev) => [
        {
          id: eventId,
          source: event.source,
          requestType: event.requestType,
          preview: event.preview,
          createdAt: event.createdAt,
          leadId: event.leadId,
          requestId: event.requestId,
          inventoryId: event.inventoryId,
          payload: event.payload,
        },
        ...prev,
      ].slice(0, MAX_RECENT_ADMIN_REQUESTS));

      playAdminRequestTone();

      if (
        typeof window !== "undefined"
        && "Notification" in window
        && Notification.permission === "granted"
        && document.hidden
      ) {
        try {
          new Notification("New admin request", {
            body: event.preview,
            tag: `admin-request:${eventId}`,
          });
        } catch {
          // ignore browser notification errors
        }
      }
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);
    socket.on("messenger:message:new", onNewMessage);
    socket.on("chat:message:new", onNewMessage);
    socket.on("chat:room:read", onRoomRead);
    socket.on("admin:request:new", onAdminRequestEvent);
    socket.on("lead:payment:request:created", onAdminRequestEvent);
    socket.on("inventory:request:created", onAdminRequestEvent);

    return () => {
      disposed = true;
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      socket.off("messenger:message:new", onNewMessage);
      socket.off("chat:message:new", onNewMessage);
      socket.off("chat:room:read", onRoomRead);
      socket.off("admin:request:new", onAdminRequestEvent);
      socket.off("lead:payment:request:created", onAdminRequestEvent);
      socket.off("inventory:request:created", onAdminRequestEvent);
      socket.disconnect();
      setSocketConnected(false);
      setActiveConversationId("");
    };
  }, [enabled, markConversationReadLocal, setActiveConversationId, syncUnreadFromConversations]);

  const value = useMemo(
    () => ({
      unreadByConversation: enabled ? unreadByConversation : {},
      unreadTotal: enabled ? unreadTotal : 0,
      recentNotifications: enabled ? recentNotifications : [],
      adminRequestUnread: enabled ? adminRequestUnread : 0,
      recentAdminRequests: enabled ? recentAdminRequests : [],
      adminRequestPulseAt: enabled ? adminRequestPulseAt : 0,
      socketConnected: enabled ? socketConnected : false,
      permission,
      setActiveConversationId,
      syncUnreadFromConversations,
      markConversationRead,
      markAllRead,
      clearRecentNotifications,
      markAdminRequestsRead,
      clearAdminRequestNotifications,
      requestBrowserPermission,
    }),
    [
      enabled,
      unreadByConversation,
      unreadTotal,
      recentNotifications,
      socketConnected,
      permission,
      setActiveConversationId,
      syncUnreadFromConversations,
      markConversationRead,
      markAllRead,
      clearRecentNotifications,
      adminRequestUnread,
      recentAdminRequests,
      adminRequestPulseAt,
      markAdminRequestsRead,
      clearAdminRequestNotifications,
      requestBrowserPermission,
    ],
  );

  return (
    <ChatNotificationContext.Provider value={value}>
      {children}
    </ChatNotificationContext.Provider>
  );
};
