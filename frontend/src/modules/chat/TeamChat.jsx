import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion as Motion } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  CheckCheck,
  ExternalLink,
  FileText,
  MessageSquare,
  Paperclip,
  Phone,
  PhoneOff,
  RefreshCw,
  Search,
  Share2,
  Send,
  Users,
  Video,
  X,
} from "lucide-react";
import {
  createDirectRoom,
  getConversationMessages,
  getMessengerContacts,
  getMessengerConversations,
  markMessageDelivered,
  markMessageSeen,
  sendDirectMessage,
} from "../../services/chatService";
import { createChatSocket } from "../../services/chatSocket";
import { useChatNotifications } from "../../context/useChatNotifications";
import { toErrorMessage } from "../../utils/errorMessage";

const roleBadgeClass = (role, isDark) => {
  if (role === "ADMIN") {
    return isDark ? "bg-rose-500/15 text-rose-200" : "bg-rose-100 text-rose-700";
  }
  if (role === "MANAGER") {
    return isDark ? "bg-cyan-500/15 text-cyan-200" : "bg-cyan-100 text-cyan-700";
  }
  if (role === "ASSISTANT_MANAGER") {
    return isDark ? "bg-sky-500/15 text-sky-200" : "bg-sky-100 text-sky-700";
  }
  if (role === "TEAM_LEADER") {
    return isDark ? "bg-indigo-500/15 text-indigo-200" : "bg-indigo-100 text-indigo-700";
  }
  if (role === "FIELD_EXECUTIVE") {
    return isDark ? "bg-violet-500/15 text-violet-200" : "bg-violet-100 text-violet-700";
  }
  return isDark ? "bg-emerald-500/15 text-emerald-200" : "bg-emerald-100 text-emerald-700";
};

const toLocalTime = (value) =>
  new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const toDayLabel = (value) =>
  new Date(value).toLocaleDateString([], { day: "2-digit", month: "short", year: "numeric" });

const toSidebarTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const now = new Date();
  const sameDay =
    now.getFullYear() === date.getFullYear()
    && now.getMonth() === date.getMonth()
    && now.getDate() === date.getDate();

  if (sameDay) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  return date.toLocaleDateString([], { day: "2-digit", month: "short" });
};

const getInitials = (name = "") =>
  String(name)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("")
    || "U";

const formatCurrency = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "-";
  return `Rs ${parsed.toLocaleString("en-IN")}`;
};

const CLOUDINARY_CLOUD_NAME = "djfiq8kiy";
const CLOUDINARY_UPLOAD_PRESET = "samvid_upload";
const MAX_MEDIA_ATTACHMENTS = 8;
const MAX_MEDIA_SIZE_BYTES = 25 * 1024 * 1024;
const TYPING_IDLE_TIMEOUT_MS = 1200;
const REMOTE_TYPING_TIMEOUT_MS = 3200;
const CALL_SIGNAL_QUEUE_LIMIT = 60;
const WEBRTC_ICE_SERVERS = [{ urls: ["stun:stun.l.google.com:19302"] }];

const CALL_MODES = {
  AUDIO: "audio",
  VIDEO: "video",
};

const CALL_PHASES = {
  DIALING: "dialing",
  CONNECTING: "connecting",
  ACTIVE: "active",
};

const detectMediaKind = ({ kind, mimeType = "" } = {}) => {
  const normalized = String(kind || "").trim().toLowerCase();
  if (["image", "video", "audio", "file"].includes(normalized)) return normalized;

  const type = String(mimeType || "").trim().toLowerCase();
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("video/")) return "video";
  if (type.startsWith("audio/")) return "audio";
  return "file";
};

const sanitizeMediaAttachment = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const url = String(value.url || value.secure_url || "").trim();
  if (!url) return null;

  return {
    url: url.slice(0, 2048),
    kind: detectMediaKind({
      kind: value.kind,
      mimeType: value.mimeType || value.type,
    }),
    mimeType: String(value.mimeType || value.type || "").trim().slice(0, 120),
    name: String(value.name || value.original_filename || "").trim().slice(0, 180),
    size: Math.max(0, Math.round(Number(value.size) || 0)),
  };
};

const sanitizeMediaAttachments = (value) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => sanitizeMediaAttachment(item))
    .filter(Boolean)
    .slice(0, MAX_MEDIA_ATTACHMENTS);
};

const buildMediaLabel = (media) => {
  const label = String(media?.name || "").trim();
  if (label) return label;
  if (media?.kind === "image") return "Image";
  if (media?.kind === "video") return "Video";
  if (media?.kind === "audio") return "Audio";
  return "Attachment";
};

const sanitizeSharePayload = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const inventoryId = String(value.inventoryId || value._id || value.id || "").trim();
  if (!inventoryId) return null;

  return {
    inventoryId,
    title: String(value.title || "").trim().slice(0, 200),
    location: String(value.location || "").trim().slice(0, 240),
    price: Number(value.price) || 0,
    status: String(value.status || "").trim().slice(0, 40),
    image: String(value.image || "").trim().slice(0, 2048),
  };
};

const isPropertyMessage = (message) =>
  String(message?.type || "") === "property" && Boolean(message?.sharedProperty?.inventoryId);

const isAutoPropertyText = (message) => {
  if (!isPropertyMessage(message)) return false;
  const title = String(message.sharedProperty?.title || "").trim();
  const text = String(message.text || "").trim();
  if (!text) return true;
  if (!title) return text === "Shared a property";
  return text === `Shared property: ${title}`;
};

const isMediaMessage = (message) => {
  const media = sanitizeMediaAttachments(message?.mediaAttachments);
  return String(message?.type || "") === "media" && media.length > 0;
};

const isAutoMediaText = (message) => {
  if (!isMediaMessage(message)) return false;
  const media = sanitizeMediaAttachments(message?.mediaAttachments);
  const text = String(message.text || "").trim();
  if (!text) return true;
  if (media.length <= 1) return text === "Shared a media file";
  return text === `Shared ${media.length} media files`;
};

const getCurrentUser = () => {
  try {
    const raw = JSON.parse(localStorage.getItem("user") || "{}");
    return {
      id: String(raw.id || raw._id || ""),
      name: raw.name || "You",
      role: raw.role || "",
    };
  } catch {
    return { id: "", name: "You", role: "" };
  }
};

const uploadMediaFile = async (file) => {
  const data = new FormData();
  data.append("file", file);
  data.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  data.append("cloud_name", CLOUDINARY_CLOUD_NAME);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`,
    {
      method: "POST",
      body: data,
    },
  );

  const payload = await res.json();
  if (!res.ok || !payload?.secure_url) {
    throw new Error(payload?.error?.message || "Failed to upload media");
  }

  const uploaded = sanitizeMediaAttachment({
    url: payload.secure_url,
    kind: detectMediaKind({ mimeType: file.type }),
    mimeType: file.type,
    name: file.name,
    size: file.size,
  });

  if (!uploaded) {
    throw new Error("Invalid media upload response");
  }

  return uploaded;
};

const mergeMessages = (prev, incoming) => {
  const map = new Map();
  [...prev, ...(incoming || [])].forEach((item) => {
    if (!item?._id) return;
    map.set(item._id, item);
  });
  return [...map.values()].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
};

const getOtherParticipant = (conversation, currentUserId) =>
  (conversation?.participants || []).find((p) => String(p._id) !== String(currentUserId)) || null;

const upsertConversation = (prev, incoming) => {
  if (!incoming?._id) return prev;
  const map = new Map(prev.map((c) => [String(c._id), c]));
  map.set(String(incoming._id), incoming);
  return [...map.values()].sort(
    (a, b) => new Date(b.lastMessageAt || b.updatedAt || 0) - new Date(a.lastMessageAt || a.updatedAt || 0),
  );
};

const findConversationByContact = (conversations, contactId) =>
  conversations.find((conversation) =>
    (conversation.participants || []).some((participant) => String(participant._id) === String(contactId)),
  );

const toId = (value) => String(value || "").trim();

const hasUserAck = (rows, userId) => {
  const normalizedUserId = toId(userId);
  if (!normalizedUserId || !Array.isArray(rows)) return false;

  return rows.some((row) => {
    const rowUserId = toId(row?.user || row?._id || row);
    return rowUserId === normalizedUserId;
  });
};

const hasOtherUserAck = (rows, currentUserId) => {
  const normalizedCurrentUserId = toId(currentUserId);
  if (!Array.isArray(rows)) return false;

  return rows.some((row) => {
    const rowUserId = toId(row?.user || row?._id || row);
    return Boolean(rowUserId) && rowUserId !== normalizedCurrentUserId;
  });
};

const withAckUser = (rows, userId) => {
  const normalizedUserId = toId(userId);
  if (!normalizedUserId) return Array.isArray(rows) ? rows : [];
  if (hasUserAck(rows, normalizedUserId)) return Array.isArray(rows) ? rows : [];

  const next = Array.isArray(rows) ? [...rows] : [];
  next.push({ user: normalizedUserId, at: new Date().toISOString() });
  return next;
};

const isMessageForConversation = (message, conversationId) => {
  const messageConversationId = toId(message?.room || message?.conversation);
  const targetConversationId = toId(conversationId);
  if (!targetConversationId) return false;
  if (!messageConversationId) return true;
  return messageConversationId === targetConversationId;
};

const getOutgoingMessageStatus = (message, currentUserId) => {
  if (hasOtherUserAck(message?.seenBy, currentUserId)) return "seen";
  if (hasOtherUserAck(message?.deliveredTo, currentUserId)) return "delivered";
  return "sent";
};

const applyRoomReadToMessages = ({ rows, roomId, readerUserId, currentUserId }) => {
  if (!Array.isArray(rows)) return [];
  const normalizedRoomId = toId(roomId);
  const normalizedReaderUserId = toId(readerUserId);
  const normalizedCurrentUserId = toId(currentUserId);
  if (!normalizedRoomId || !normalizedReaderUserId) return rows;

  return rows.map((message) => {
    if (!isMessageForConversation(message, normalizedRoomId)) return message;

    const senderId = toId(message?.sender?._id || message?.sender);
    if (!senderId || senderId !== normalizedCurrentUserId) return message;
    if (normalizedReaderUserId === normalizedCurrentUserId) return message;

    return {
      ...message,
      deliveredTo: withAckUser(message?.deliveredTo, normalizedReaderUserId),
      seenBy: withAckUser(message?.seenBy, normalizedReaderUserId),
    };
  });
};

const isDocumentVisible = () =>
  typeof document === "undefined" || document.visibilityState === "visible";

const extractIncomingMessageEvent = (payload = {}) => {
  const message = payload?.message || null;
  const conversation = payload?.conversation || payload?.room || null;
  const conversationId = String(
    conversation?._id || message?.conversation || message?.room || "",
  );

  return {
    conversation,
    conversationId,
    message,
  };
};

const normalizeCallMode = (value) => {
  const mode = toId(value).toLowerCase();
  return mode === CALL_MODES.VIDEO ? CALL_MODES.VIDEO : CALL_MODES.AUDIO;
};

const buildCallId = () => {
  if (typeof globalThis?.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const getCallMediaConstraints = (mode) => ({
  audio: true,
  video: normalizeCallMode(mode) === CALL_MODES.VIDEO,
});

const normalizeCallReason = (reason) => {
  const value = toId(reason).toLowerCase();
  if (value === "busy") return "User is busy on another call";
  if (value === "disconnected") return "Call ended due to network disconnect";
  if (value === "rejected") return "Call was declined";
  return "Call ended";
};

const updateTypingUsers = (prev, { roomId, userId, isTyping }) => {
  const normalizedRoomId = toId(roomId);
  const normalizedUserId = toId(userId);
  if (!normalizedRoomId || !normalizedUserId) return prev;

  const currentUsers = Array.isArray(prev[normalizedRoomId]) ? prev[normalizedRoomId] : [];
  let nextUsers = currentUsers;

  if (isTyping) {
    if (currentUsers.includes(normalizedUserId)) return prev;
    nextUsers = [...currentUsers, normalizedUserId];
  } else {
    nextUsers = currentUsers.filter((id) => id !== normalizedUserId);
    if (nextUsers.length === currentUsers.length) return prev;
  }

  const next = { ...prev };
  if (nextUsers.length) {
    next[normalizedRoomId] = nextUsers;
  } else {
    delete next[normalizedRoomId];
  }
  return next;
};

const TeamChat = ({ theme = "light" }) => {
  const isDark = theme === "dark";
  const location = useLocation();
  const navigate = useNavigate();
  const currentUser = useMemo(() => getCurrentUser(), []);
  const {
    unreadByConversation,
    syncUnreadFromConversations,
    setActiveConversationId,
    markConversationRead,
    markAllRead,
  } = useChatNotifications();
  const socketRef = useRef(null);
  const selectedConversationRef = useRef("");
  const chatOpenReadSyncRef = useRef(false);
  const typingStateRef = useRef({ roomId: "", isTyping: false });
  const bottomRef = useRef(null);
  const mediaInputRef = useRef(null);
  const typingStopTimeoutRef = useRef(null);
  const remoteTypingTimeoutsRef = useRef(new Map());
  const seenSocketMessageIdsRef = useRef(new Set());
  const deliveredReceiptIdsRef = useRef(new Set());
  const seenReceiptIdsRef = useRef(new Set());
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const queuedSignalsByCallRef = useRef(new Map());
  const activeCallRef = useRef(null);
  const incomingCallRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [error, setError] = useState("");

  const [contacts, setContacts] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [selectedConversationId, setSelectedConversationId] = useState("");
  const [selectedContactId, setSelectedContactId] = useState("");
  const [messages, setMessages] = useState([]);
  const [typingByRoom, setTypingByRoom] = useState({});
  const [draft, setDraft] = useState("");
  const [queuedShare, setQueuedShare] = useState(null);
  const [queuedMedia, setQueuedMedia] = useState([]);
  const [chatSearch, setChatSearch] = useState("");
  const [incomingCall, setIncomingCall] = useState(null);
  const [activeCall, setActiveCall] = useState(null);
  const [callError, setCallError] = useState("");

  useEffect(() => {
    const host = document.querySelector("main.app-page-bg");
    if (host) {
      host.scrollTop = 0;
    }
  }, []);

  useEffect(() => {
    selectedConversationRef.current = selectedConversationId;
  }, [selectedConversationId]);

  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);

  useEffect(() => {
    incomingCallRef.current = incomingCall;
  }, [incomingCall]);

  const emitConversationRead = useCallback(
    async (conversationId, options = {}) => {
      const id = toId(conversationId);
      if (!id) return;

      const allowHttpFallback = options.allowHttpFallback !== false;
      await markConversationRead(id, { persist: false }).catch(() => null);

      const socket = socketRef.current;
      if (socket?.connected) {
        const ack = await new Promise((resolve) => {
          socket.emit("chat:room:read", { roomId: id }, (response) => {
            resolve(response || {});
          });
        });

        if (ack?.ok) {
          if (ack.room?._id) {
            setConversations((prev) => upsertConversation(prev, ack.room));
          }
          return;
        }
      }

      if (allowHttpFallback) {
        await markConversationRead(id).catch(() => null);
      }
    },
    [markConversationRead],
  );

  const emitMessageReceipt = useCallback(async (messageId, mode = "delivered") => {
    const id = toId(messageId);
    if (!id) return;

    const isSeenMode = mode === "seen";
    const cache = isSeenMode ? seenReceiptIdsRef.current : deliveredReceiptIdsRef.current;
    if (cache.has(id)) return;
    cache.add(id);

    const socket = socketRef.current;
    const socketEvent = isSeenMode ? "chat:message:seen" : "chat:message:delivered";
    const fallbackApiCall = isSeenMode ? markMessageSeen : markMessageDelivered;

    try {
      if (socket?.connected) {
        const ack = await new Promise((resolve) => {
          socket.emit(socketEvent, { messageId: id }, (response) => {
            resolve(response || {});
          });
        });

        if (!ack?.ok) {
          throw new Error(ack?.error || `Failed to mark message ${mode}`);
        }

        const updatedMessage = ack?.message || null;
        if (updatedMessage && isMessageForConversation(updatedMessage, selectedConversationRef.current)) {
          setMessages((prev) => mergeMessages(prev, [updatedMessage]));
        }
        return;
      }

      const updatedMessage = await fallbackApiCall(id);
      if (updatedMessage && isMessageForConversation(updatedMessage, selectedConversationRef.current)) {
        setMessages((prev) => mergeMessages(prev, [updatedMessage]));
      }
    } catch {
      cache.delete(id);
    }
  }, []);

  const queueCallSignal = useCallback((callId, signal) => {
    const normalizedCallId = toId(callId);
    if (!normalizedCallId || !signal || typeof signal !== "object") return;

    const store = queuedSignalsByCallRef.current;
    const current = Array.isArray(store.get(normalizedCallId))
      ? store.get(normalizedCallId)
      : [];
    current.push(signal);
    if (current.length > CALL_SIGNAL_QUEUE_LIMIT) {
      current.shift();
    }
    store.set(normalizedCallId, current);
  }, []);

  const consumeQueuedCallSignals = useCallback((callId) => {
    const normalizedCallId = toId(callId);
    if (!normalizedCallId) return [];

    const store = queuedSignalsByCallRef.current;
    const list = Array.isArray(store.get(normalizedCallId))
      ? store.get(normalizedCallId)
      : [];
    store.delete(normalizedCallId);
    return list;
  }, []);

  const clearQueuedCallSignals = useCallback((callId = "") => {
    const store = queuedSignalsByCallRef.current;
    const normalizedCallId = toId(callId);
    if (normalizedCallId) {
      store.delete(normalizedCallId);
      return;
    }
    store.clear();
  }, []);

  const closePeerConnection = useCallback(() => {
    const peer = peerConnectionRef.current;
    if (!peer) return;

    peer.onicecandidate = null;
    peer.ontrack = null;
    peer.onconnectionstatechange = null;
    peer.oniceconnectionstatechange = null;
    peer.close();
    peerConnectionRef.current = null;
  }, []);

  const stopMediaTracks = useCallback(() => {
    const localStream = localStreamRef.current;
    if (localStream) {
      localStream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // Ignore track shutdown errors.
        }
      });
    }

    const remoteStream = remoteStreamRef.current;
    if (remoteStream) {
      remoteStream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // Ignore track shutdown errors.
        }
      });
    }

    localStreamRef.current = null;
    remoteStreamRef.current = null;

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
  }, []);

  const clearActiveCallLocally = useCallback((callId = "") => {
    clearQueuedCallSignals(callId);
    closePeerConnection();
    stopMediaTracks();
    setActiveCall(null);
    setIncomingCall(null);
  }, [clearQueuedCallSignals, closePeerConnection, stopMediaTracks]);

  const emitCallAck = useCallback(async (eventName, payload = {}) => {
    const socket = socketRef.current;
    if (!socket?.connected) {
      throw new Error("Realtime connection is not available");
    }

    return new Promise((resolve, reject) => {
      socket.emit(eventName, payload, (response = {}) => {
        if (!response?.ok) {
          reject(new Error(response?.error || `Failed to process ${eventName}`));
          return;
        }
        resolve(response);
      });
    });
  }, []);

  const captureLocalMediaForCall = useCallback(async (mode) => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      throw new Error("Browser does not support voice/video calling");
    }

    stopMediaTracks();
    const stream = await navigator.mediaDevices.getUserMedia(getCallMediaConstraints(mode));
    localStreamRef.current = stream;
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }
    return stream;
  }, [stopMediaTracks]);

  const attachMediaToCallPeer = useCallback((peer, stream) => {
    if (!peer || !stream) return;
    stream.getTracks().forEach((track) => {
      peer.addTrack(track, stream);
    });
  }, []);

  const applyCallSignal = useCallback(async ({ callId, roomId, signal }) => {
    const peer = peerConnectionRef.current;
    const normalizedCallId = toId(callId);
    const normalizedRoomId = toId(roomId);
    if (!peer || !normalizedCallId || !normalizedRoomId || !signal) return;

    if (signal.type === "offer" && signal.sdp) {
      await peer.setRemoteDescription(new RTCSessionDescription(signal));
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      socketRef.current?.emit("chat:call:signal", {
        roomId: normalizedRoomId,
        callId: normalizedCallId,
        signal: answer,
      });

      const queuedSignals = consumeQueuedCallSignals(normalizedCallId);
      for (const queuedSignal of queuedSignals) {
        if (queuedSignal?.type === "candidate" && queuedSignal?.candidate && peer.remoteDescription) {
          await peer.addIceCandidate(new RTCIceCandidate(queuedSignal.candidate));
        }
      }
      return;
    }

    if (signal.type === "answer" && signal.sdp) {
      await peer.setRemoteDescription(new RTCSessionDescription(signal));

      const queuedSignals = consumeQueuedCallSignals(normalizedCallId);
      for (const queuedSignal of queuedSignals) {
        if (queuedSignal?.type === "candidate" && queuedSignal?.candidate && peer.remoteDescription) {
          await peer.addIceCandidate(new RTCIceCandidate(queuedSignal.candidate));
        }
      }
      return;
    }

    if (signal.type === "candidate" && signal.candidate) {
      if (!peer.remoteDescription) {
        queueCallSignal(normalizedCallId, signal);
        return;
      }
      await peer.addIceCandidate(new RTCIceCandidate(signal.candidate));
    }
  }, [consumeQueuedCallSignals, queueCallSignal]);

  const createCallPeerConnection = useCallback((callContext) => {
    const roomId = toId(callContext?.roomId);
    const callId = toId(callContext?.callId);
    if (!roomId || !callId) {
      throw new Error("Invalid call context");
    }

    const peer = new RTCPeerConnection({ iceServers: WEBRTC_ICE_SERVERS });
    peer.onicecandidate = (event) => {
      if (!event.candidate) return;
      socketRef.current?.emit("chat:call:signal", {
        roomId,
        callId,
        signal: {
          type: "candidate",
          candidate: event.candidate,
        },
      });
    };

    peer.ontrack = (event) => {
      const [stream] = event.streams || [];
      if (!stream) return;
      remoteStreamRef.current = stream;
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream;
      }
    };

    peer.onconnectionstatechange = () => {
      if (peer.connectionState === "connected") {
        setActiveCall((prev) => (prev ? { ...prev, phase: CALL_PHASES.ACTIVE } : prev));
        setCallError("");
        return;
      }

      if (["failed", "disconnected", "closed"].includes(peer.connectionState)) {
        setCallError("Call connection ended");
        clearActiveCallLocally(callId);
      }
    };

    peerConnectionRef.current = peer;
    return peer;
  }, [clearActiveCallLocally]);

  const endActiveCall = useCallback(async (options = {}) => {
    const notifyRemote = options.notifyRemote !== false;
    const reason = toId(options.reason) || "ended";
    const currentCall = activeCallRef.current;
    if (!currentCall) return;

    if (notifyRemote && socketRef.current?.connected) {
      try {
        await emitCallAck("chat:call:end", {
          roomId: currentCall.roomId,
          callId: currentCall.callId,
          reason,
        });
      } catch {
        // Ignore remote end-notification failures; local cleanup still must happen.
      }
    }

    clearActiveCallLocally(currentCall.callId);
  }, [clearActiveCallLocally, emitCallAck]);

  useEffect(() => {
    setActiveConversationId(selectedConversationId || "");

    if (selectedConversationId) {
      emitConversationRead(selectedConversationId).catch(() => null);
    }

    return () => {
      setActiveConversationId("");
    };
  }, [emitConversationRead, selectedConversationId, setActiveConversationId]);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;

    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      if (!selectedConversationRef.current) return;
      emitConversationRead(selectedConversationRef.current, { allowHttpFallback: false }).catch(() => null);
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [emitConversationRead]);

  useEffect(() => {
    if (chatOpenReadSyncRef.current) return;
    chatOpenReadSyncRef.current = true;
    markAllRead().catch(() => null);
  }, [markAllRead]);

  const activeConversation = useMemo(
    () => conversations.find((conversation) => String(conversation._id) === String(selectedConversationId)) || null,
    [conversations, selectedConversationId],
  );

  const activeContact = useMemo(() => {
    if (activeConversation) {
      return getOtherParticipant(activeConversation, currentUser.id);
    }
    return contacts.find((contact) => String(contact._id) === String(selectedContactId)) || null;
  }, [activeConversation, contacts, currentUser.id, selectedContactId]);

  const searchQuery = chatSearch.trim().toLowerCase();

  const filteredConversations = useMemo(() => {
    if (!searchQuery) return conversations;

    return conversations.filter((conversation) => {
      const peer = getOtherParticipant(conversation, currentUser.id);
      return String(peer?.name || "").toLowerCase().includes(searchQuery);
    });
  }, [conversations, currentUser.id, searchQuery]);

  const filteredContacts = useMemo(() => {
    if (!searchQuery) return contacts;

    return contacts.filter((contact) =>
      String(contact?.name || "").toLowerCase().includes(searchQuery));
  }, [contacts, searchQuery]);

  const unreadTotal = useMemo(
    () =>
      Object.values(unreadByConversation).reduce(
        (sum, value) => sum + Math.max(0, Number(value || 0)),
        0,
      ),
    [unreadByConversation],
  );

  const clearLocalTypingStopTimer = useCallback(() => {
    if (typingStopTimeoutRef.current) {
      clearTimeout(typingStopTimeoutRef.current);
      typingStopTimeoutRef.current = null;
    }
  }, []);

  const emitTypingState = useCallback((roomId, isTyping) => {
    const normalizedRoomId = toId(roomId);
    if (!normalizedRoomId) return;

    const socket = socketRef.current;
    if (!socket?.connected) return;

    const currentTypingState = typingStateRef.current;
    if (
      currentTypingState.roomId === normalizedRoomId
      && currentTypingState.isTyping === isTyping
    ) {
      return;
    }

    typingStateRef.current = { roomId: normalizedRoomId, isTyping };
    socket.emit("chat:typing", { roomId: normalizedRoomId, isTyping });
  }, []);

  const stopLocalTyping = useCallback((roomId = "") => {
    clearLocalTypingStopTimer();
    const targetRoomId = toId(roomId || typingStateRef.current.roomId);
    if (!targetRoomId) return;
    emitTypingState(targetRoomId, false);
  }, [clearLocalTypingStopTimer, emitTypingState]);

  const queueLocalTypingStop = useCallback((roomId) => {
    const normalizedRoomId = toId(roomId);
    clearLocalTypingStopTimer();
    if (!normalizedRoomId) return;

    typingStopTimeoutRef.current = setTimeout(() => {
      emitTypingState(normalizedRoomId, false);
    }, TYPING_IDLE_TIMEOUT_MS);
  }, [clearLocalTypingStopTimer, emitTypingState]);

  const activeTypingUsers = useMemo(() => {
    const roomId = toId(selectedConversationId);
    if (!roomId) return [];
    return typingByRoom[roomId] || [];
  }, [selectedConversationId, typingByRoom]);

  const isActiveContactTyping = activeTypingUsers.length > 0;

  const canUseCalls = useMemo(
    () =>
      typeof window !== "undefined"
      && typeof window.RTCPeerConnection !== "undefined"
      && typeof navigator !== "undefined"
      && Boolean(navigator.mediaDevices?.getUserMedia),
    [],
  );

  const activeCallPeerName = useMemo(() => {
    if (activeCall?.peer?.name) return activeCall.peer.name;
    if (incomingCall?.from?.name) return incomingCall.from.name;
    return activeContact?.name || "User";
  }, [activeCall, activeContact, incomingCall]);

  const activeCallLabel = useMemo(() => {
    if (!activeCall) return "";
    if (activeCall.phase === CALL_PHASES.DIALING) return "Ringing...";
    if (activeCall.phase === CALL_PHASES.CONNECTING) return "Connecting...";
    return "On call";
  }, [activeCall]);

  const callTimelineOffsetClass = useMemo(() => {
    if (!activeCall) return "";
    return activeCall.mode === CALL_MODES.VIDEO ? "pt-64 sm:pt-72" : "pt-28";
  }, [activeCall]);

  const handleStartCall = useCallback(async (mode = CALL_MODES.AUDIO) => {
    const normalizedMode = normalizeCallMode(mode);
    if (!activeContact) {
      setCallError("Select a contact to start a call");
      return;
    }

    if (!canUseCalls) {
      setCallError("Voice/video calls are not supported in this browser");
      return;
    }

    if (activeCallRef.current || incomingCallRef.current) {
      setCallError("Finish the current call first");
      return;
    }

    const socket = socketRef.current;
    if (!socket?.connected) {
      setCallError("Realtime connection is not available");
      return;
    }

    let roomId = toId(selectedConversationId);
    if (!roomId) {
      const recipientId = toId(activeContact?._id || selectedContactId);
      if (!recipientId) {
        setCallError("Select a valid contact to start a call");
        return;
      }

      try {
        const room = await createDirectRoom({ recipientId });
        roomId = toId(room?._id);
        if (!roomId) {
          throw new Error("Failed to create conversation for this contact");
        }

        setConversations((prev) => upsertConversation(prev, room));
        setSelectedConversationId(roomId);
        setSelectedContactId("");
        await loadMessagesForConversation(roomId);
      } catch (err) {
        setCallError(toErrorMessage(err, "Failed to open conversation for call"));
        return;
      }
    }

    const callId = buildCallId();
    const baseCall = {
      callId,
      roomId,
      mode: normalizedMode,
      phase: CALL_PHASES.DIALING,
      direction: "outgoing",
      peer: {
        _id: toId(activeContact?._id),
        name: toId(activeContact?.name),
        role: toId(activeContact?.role),
      },
    };

    try {
      setCallError("");
      setIncomingCall(null);
      setActiveCall(baseCall);

      const stream = await captureLocalMediaForCall(normalizedMode);
      const peer = createCallPeerConnection(baseCall);
      attachMediaToCallPeer(peer, stream);

      const ack = await emitCallAck("chat:call:initiate", {
        roomId,
        mode: normalizedMode,
        callId,
      });

      const resolvedCallId = toId(ack?.callId) || callId;
      const resolvedRoomId = toId(ack?.roomId) || roomId;
      setActiveCall((prev) =>
        prev
          ? {
              ...prev,
              callId: resolvedCallId,
              roomId: resolvedRoomId,
              phase: CALL_PHASES.CONNECTING,
            }
          : prev);

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      socket.emit("chat:call:signal", {
        roomId: resolvedRoomId,
        callId: resolvedCallId,
        signal: offer,
      });
    } catch (err) {
      setCallError(toErrorMessage(err, "Failed to start call"));
      clearActiveCallLocally(callId);
    }
  }, [
    activeContact,
    attachMediaToCallPeer,
    canUseCalls,
    captureLocalMediaForCall,
    clearActiveCallLocally,
    createCallPeerConnection,
    emitCallAck,
    selectedConversationId,
  ]);

  const handleAcceptIncomingCall = useCallback(async () => {
    const pendingCall = incomingCallRef.current;
    if (!pendingCall) return;

    if (!canUseCalls) {
      setCallError("Voice/video calls are not supported in this browser");
      return;
    }

    const roomId = toId(pendingCall.roomId);
    const callId = toId(pendingCall.callId);
    const mode = normalizeCallMode(pendingCall.mode);

    try {
      setCallError("");
      setIncomingCall(null);
      setActiveCall({
        callId,
        roomId,
        mode,
        phase: CALL_PHASES.CONNECTING,
        direction: "incoming",
        peer: pendingCall.from || null,
      });

      const stream = await captureLocalMediaForCall(mode);
      const peer = createCallPeerConnection({ callId, roomId, mode });
      attachMediaToCallPeer(peer, stream);

      await emitCallAck("chat:call:accept", { roomId, callId });

      const queuedSignals = consumeQueuedCallSignals(callId);
      for (const signal of queuedSignals) {
        await applyCallSignal({ callId, roomId, signal });
      }
    } catch (err) {
      setCallError(toErrorMessage(err, "Failed to accept call"));
      if (socketRef.current?.connected) {
        socketRef.current.emit("chat:call:reject", {
          roomId,
          callId,
          reason: "rejected",
        });
      }
      clearActiveCallLocally(callId);
    }
  }, [
    applyCallSignal,
    attachMediaToCallPeer,
    canUseCalls,
    captureLocalMediaForCall,
    clearActiveCallLocally,
    consumeQueuedCallSignals,
    createCallPeerConnection,
    emitCallAck,
  ]);

  const handleRejectIncomingCall = useCallback(async () => {
    const pendingCall = incomingCallRef.current;
    if (!pendingCall) return;

    const roomId = toId(pendingCall.roomId);
    const callId = toId(pendingCall.callId);

    try {
      if (socketRef.current?.connected) {
        await emitCallAck("chat:call:reject", {
          roomId,
          callId,
          reason: "rejected",
        });
      }
    } catch {
      // Ignore reject-ack failures.
    } finally {
      clearQueuedCallSignals(callId);
      setIncomingCall(null);
    }
  }, [clearQueuedCallSignals, emitCallAck]);

  const handleEndCall = useCallback(() => {
    endActiveCall({ notifyRemote: true, reason: "ended" }).catch(() => null);
  }, [endActiveCall]);

  useEffect(() => {
    const nextRoomId = toId(selectedConversationId);
    const previousTypingState = typingStateRef.current;

    if (
      previousTypingState.isTyping
      && previousTypingState.roomId
      && previousTypingState.roomId !== nextRoomId
    ) {
      emitTypingState(previousTypingState.roomId, false);
    }

    typingStateRef.current = {
      roomId: nextRoomId,
      isTyping:
        previousTypingState.roomId === nextRoomId
        ? previousTypingState.isTyping
        : false,
    };
    clearLocalTypingStopTimer();
  }, [clearLocalTypingStopTimer, emitTypingState, selectedConversationId]);

  useEffect(() => () => {
    clearLocalTypingStopTimer();
    remoteTypingTimeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
    remoteTypingTimeoutsRef.current.clear();
  }, [clearLocalTypingStopTimer]);

  useEffect(() => {
    const incomingShare = sanitizeSharePayload(location.state?.shareProperty);
    const openConversationId = String(location.state?.openConversationId || "").trim();
    if (!incomingShare && !openConversationId) return;

    if (incomingShare) {
      setQueuedShare(incomingShare);
      setQueuedMedia([]);
    }

    if (openConversationId) {
      setSelectedConversationId(openConversationId);
      setSelectedContactId("");
    }

    navigate(location.pathname, { replace: true, state: {} });
  }, [location.pathname, location.state, navigate]);

  const loadMessagesForConversation = useCallback(async (conversationId) => {
    if (!conversationId) {
      setMessages([]);
      return;
    }

    try {
      setMessagesLoading(true);
      const list = await getConversationMessages({ conversationId, limit: 120 });
      setMessages(Array.isArray(list) ? list : []);
    } catch (err) {
      setError(toErrorMessage(err, "Failed to load messages"));
      setMessages([]);
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  const loadMessenger = useCallback(async (silent = false) => {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const [nextContacts, nextConversations] = await Promise.all([
        getMessengerContacts(),
        getMessengerConversations(),
      ]);

      setContacts(Array.isArray(nextContacts) ? nextContacts : []);
      setConversations(Array.isArray(nextConversations) ? nextConversations : []);
      syncUnreadFromConversations(nextConversations);

      if (!selectedConversationRef.current && nextConversations.length > 0) {
        setSelectedConversationId(nextConversations[0]._id);
        setSelectedContactId("");
      } else if (!selectedConversationRef.current && nextContacts.length > 0) {
        setSelectedConversationId("");
        setSelectedContactId(nextContacts[0]._id);
      }

      setError("");
    } catch (err) {
      setError(toErrorMessage(err, "Failed to load messenger"));
      if (!silent) {
        setContacts([]);
        setConversations([]);
      }
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [syncUnreadFromConversations]);

  useEffect(() => {
    loadMessenger(false);
  }, [loadMessenger]);

  useEffect(() => {
    loadMessagesForConversation(selectedConversationId);
  }, [loadMessagesForConversation, selectedConversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  useEffect(() => {
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current || null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStreamRef.current || null;
    }
  }, [activeCall]);

  useEffect(() => {
    if (!selectedConversationId || !messages.length) return;

    const visible = isDocumentVisible();
    messages.forEach((message) => {
      const messageId = toId(message?._id);
      const senderId = toId(message?.sender?._id || message?.sender);
      if (!messageId || !senderId) return;
      if (senderId === currentUser.id) return;
      if (!isMessageForConversation(message, selectedConversationId)) return;

      if (visible) {
        if (!hasUserAck(message?.seenBy, currentUser.id)) {
          emitMessageReceipt(messageId, "seen").catch(() => null);
        }
      } else if (!hasUserAck(message?.deliveredTo, currentUser.id)) {
        emitMessageReceipt(messageId, "delivered").catch(() => null);
      }
    });
  }, [currentUser.id, emitMessageReceipt, messages, selectedConversationId]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return undefined;

    const socket = createChatSocket(token);
    socketRef.current = socket;

    const onConnect = () => {
      setSocketConnected(true);
      if (selectedConversationRef.current) {
        emitConversationRead(selectedConversationRef.current, { allowHttpFallback: false }).catch(() => null);
      }
    };

    const onDisconnect = () => {
      setSocketConnected(false);
      clearLocalTypingStopTimer();
      typingStateRef.current = { roomId: "", isTyping: false };
      remoteTypingTimeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
      remoteTypingTimeoutsRef.current.clear();
      setTypingByRoom({});
      if (activeCallRef.current || incomingCallRef.current) {
        setCallError("Call ended due to realtime disconnect");
      }
      clearActiveCallLocally();
    };

    const onConnectError = () => {
      setSocketConnected(false);
    };

    const onNewMessage = (payload = {}) => {
      const { conversation, conversationId, message } = extractIncomingMessageEvent(payload);
      const messageId = String(message?._id || "");
      if (!conversationId || !messageId) return;

      if (seenSocketMessageIdsRef.current.has(messageId)) {
        return;
      }
      seenSocketMessageIdsRef.current.add(messageId);
      if (seenSocketMessageIdsRef.current.size > 2000) {
        seenSocketMessageIdsRef.current.clear();
      }

      if (conversation?._id) {
        setConversations((prev) => upsertConversation(prev, conversation));
      } else {
        setConversations((prev) => {
          const existing = prev.find((row) => String(row?._id) === conversationId);
          if (!existing) return prev;

          const patched = {
            ...existing,
            lastMessage: String(message?.text || "").trim() || existing.lastMessage || "",
            lastMessageAt: message?.createdAt || existing.lastMessageAt || existing.updatedAt,
            updatedAt: message?.createdAt || existing.updatedAt,
          };
          return upsertConversation(prev, patched);
        });
      }

      if (!selectedConversationRef.current) {
        setSelectedConversationId(conversationId);
        setSelectedContactId("");
      }

      const activeConversationId = toId(selectedConversationRef.current);
      const isActiveConversation = activeConversationId === conversationId;
      const senderId = toId(message?.sender?._id || message?.sender);
      const isIncoming = Boolean(senderId) && senderId !== currentUser.id;

      if (senderId) {
        const typingKey = `${conversationId}:${senderId}`;
        const existingTypingTimeout = remoteTypingTimeoutsRef.current.get(typingKey);
        if (existingTypingTimeout) {
          clearTimeout(existingTypingTimeout);
          remoteTypingTimeoutsRef.current.delete(typingKey);
        }
        setTypingByRoom((prev) =>
          updateTypingUsers(prev, { roomId: conversationId, userId: senderId, isTyping: false }));
      }

      if (isActiveConversation) {
        setMessages((prev) => mergeMessages(prev, [message]));

        if (isIncoming) {
          const shouldMarkSeen = isDocumentVisible();
          emitMessageReceipt(messageId, shouldMarkSeen ? "seen" : "delivered").catch(() => null);
          if (shouldMarkSeen) {
            emitConversationRead(conversationId, { allowHttpFallback: false }).catch(() => null);
          }
        }
      } else if (isIncoming) {
        emitMessageReceipt(messageId, "delivered").catch(() => null);
      }
    };

    const onMessageDelivered = (payload = {}) => {
      const updatedMessage = payload?.message || null;
      if (!updatedMessage?._id) return;
      if (!isMessageForConversation(updatedMessage, selectedConversationRef.current)) return;
      setMessages((prev) => mergeMessages(prev, [updatedMessage]));
    };

    const onMessageSeen = (payload = {}) => {
      const updatedMessage = payload?.message || null;
      if (!updatedMessage?._id) return;
      if (!isMessageForConversation(updatedMessage, selectedConversationRef.current)) return;
      setMessages((prev) => mergeMessages(prev, [updatedMessage]));
    };

    const onRoomRead = (payload = {}) => {
      const roomId = toId(payload?.roomId);
      const readerUserId = toId(payload?.userId);
      if (!roomId || !readerUserId) return;
      if (toId(selectedConversationRef.current) !== roomId) return;

      setMessages((prev) =>
        applyRoomReadToMessages({
          rows: prev,
          roomId,
          readerUserId,
          currentUserId: currentUser.id,
        }),
      );
    };

    const onTyping = (payload = {}) => {
      const roomId = toId(payload?.roomId || payload?.conversationId);
      const userId = toId(payload?.userId);
      if (!roomId || !userId || userId === currentUser.id) return;

      const isTyping = payload?.isTyping !== false;
      const typingKey = `${roomId}:${userId}`;
      const existingTypingTimeout = remoteTypingTimeoutsRef.current.get(typingKey);
      if (existingTypingTimeout) {
        clearTimeout(existingTypingTimeout);
        remoteTypingTimeoutsRef.current.delete(typingKey);
      }

      setTypingByRoom((prev) => updateTypingUsers(prev, { roomId, userId, isTyping }));

      if (!isTyping) return;

      const timeoutId = setTimeout(() => {
        setTypingByRoom((prev) =>
          updateTypingUsers(prev, { roomId, userId, isTyping: false }));
        remoteTypingTimeoutsRef.current.delete(typingKey);
      }, REMOTE_TYPING_TIMEOUT_MS);
      remoteTypingTimeoutsRef.current.set(typingKey, timeoutId);
    };

    const onCallIncoming = (payload = {}) => {
      const roomId = toId(payload?.roomId || payload?.conversationId);
      const callId = toId(payload?.callId);
      const fromUserId = toId(payload?.from?._id || payload?.fromUserId);
      if (!roomId || !callId || fromUserId === currentUser.id) return;

      if (activeCallRef.current || incomingCallRef.current) {
        socket.emit("chat:call:reject", {
          roomId,
          callId,
          reason: "busy",
        });
        return;
      }

      setCallError("");
      setIncomingCall({
        callId,
        roomId,
        mode: normalizeCallMode(payload?.mode),
        from: payload?.from || null,
        at: payload?.at || new Date().toISOString(),
      });

      if (toId(selectedConversationRef.current) !== roomId) {
        setSelectedConversationId(roomId);
        setSelectedContactId("");
      }
    };

    const onCallAccepted = (payload = {}) => {
      const callId = toId(payload?.callId);
      if (!callId) return;

      const currentCall = activeCallRef.current;
      if (!currentCall || toId(currentCall.callId) !== callId) return;

      setCallError("");
      setActiveCall((prev) =>
        prev
          ? {
              ...prev,
              phase: CALL_PHASES.CONNECTING,
            }
          : prev);
    };

    const onCallRejected = (payload = {}) => {
      const callId = toId(payload?.callId);
      if (!callId) return;

      if (toId(incomingCallRef.current?.callId) === callId) {
        setIncomingCall(null);
      }

      if (toId(activeCallRef.current?.callId) !== callId) {
        clearQueuedCallSignals(callId);
        return;
      }

      setCallError(normalizeCallReason(payload?.reason || "rejected"));
      clearActiveCallLocally(callId);
    };

    const onCallEnded = (payload = {}) => {
      const callId = toId(payload?.callId);
      if (!callId) return;

      if (toId(incomingCallRef.current?.callId) === callId) {
        setIncomingCall(null);
      }

      if (toId(activeCallRef.current?.callId) !== callId) {
        clearQueuedCallSignals(callId);
        return;
      }

      setCallError(normalizeCallReason(payload?.reason || "ended"));
      clearActiveCallLocally(callId);
    };

    const onCallSignal = (payload = {}) => {
      const roomId = toId(payload?.roomId || payload?.conversationId);
      const callId = toId(payload?.callId);
      const signal = payload?.signal;
      if (!roomId || !callId || !signal || typeof signal !== "object") return;

      const activeCallId = toId(activeCallRef.current?.callId);
      const incomingCallId = toId(incomingCallRef.current?.callId);

      if (activeCallId !== callId) {
        if (incomingCallId === callId) {
          queueCallSignal(callId, signal);
        }
        return;
      }

      if (!peerConnectionRef.current) {
        queueCallSignal(callId, signal);
        return;
      }

      applyCallSignal({ callId, roomId, signal }).catch(() => {
        queueCallSignal(callId, signal);
      });
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);
    socket.on("messenger:message:new", onNewMessage);
    socket.on("chat:message:new", onNewMessage);
    socket.on("chat:message:delivered", onMessageDelivered);
    socket.on("chat:message:seen", onMessageSeen);
    socket.on("chat:room:read", onRoomRead);
    socket.on("chat:typing", onTyping);
    socket.on("chat:call:incoming", onCallIncoming);
    socket.on("chat:call:accepted", onCallAccepted);
    socket.on("chat:call:rejected", onCallRejected);
    socket.on("chat:call:ended", onCallEnded);
    socket.on("chat:call:signal", onCallSignal);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      socket.off("messenger:message:new", onNewMessage);
      socket.off("chat:message:new", onNewMessage);
      socket.off("chat:message:delivered", onMessageDelivered);
      socket.off("chat:message:seen", onMessageSeen);
      socket.off("chat:room:read", onRoomRead);
      socket.off("chat:typing", onTyping);
      socket.off("chat:call:incoming", onCallIncoming);
      socket.off("chat:call:accepted", onCallAccepted);
      socket.off("chat:call:rejected", onCallRejected);
      socket.off("chat:call:ended", onCallEnded);
      socket.off("chat:call:signal", onCallSignal);
      clearLocalTypingStopTimer();
      typingStateRef.current = { roomId: "", isTyping: false };
      remoteTypingTimeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
      remoteTypingTimeoutsRef.current.clear();
      setTypingByRoom({});
      clearActiveCallLocally();
      socket.disconnect();
      socketRef.current = null;
      setSocketConnected(false);
    };
  }, [
    applyCallSignal,
    clearActiveCallLocally,
    clearLocalTypingStopTimer,
    clearQueuedCallSignals,
    currentUser.id,
    emitConversationRead,
    emitMessageReceipt,
    queueCallSignal,
  ]);

  const timeline = useMemo(() => {
    let lastDayKey = "";
    return messages.map((message) => {
      const dayKey = new Date(message.createdAt).toDateString();
      const showDayBreak = dayKey !== lastDayKey;
      lastDayKey = dayKey;
      return {
        message,
        showDayBreak,
        dayLabel: toDayLabel(message.createdAt),
      };
    });
  }, [messages]);

  const handlePickConversation = (conversationId) => {
    stopLocalTyping(selectedConversationId);
    const id = String(conversationId);
    setSelectedConversationId(id);
    setSelectedContactId("");
    markConversationRead(id, { persist: false }).catch(() => null);
  };

  const handlePickContact = (contactId) => {
    stopLocalTyping(selectedConversationId);
    const existing = findConversationByContact(conversations, contactId);
    if (existing) {
      handlePickConversation(existing._id);
      return;
    }

    setSelectedConversationId("");
    setSelectedContactId(String(contactId));
    setMessages([]);
  };

  const openPropertyDetails = (inventoryId) => {
    if (!inventoryId) return;
    navigate(`/inventory/${inventoryId}`);
  };

  const handleMobileBack = () => {
    if (activeCallRef.current) {
      setCallError("End the current call before leaving this chat");
      return;
    }

    if (incomingCallRef.current) {
      handleRejectIncomingCall().catch(() => null);
    }

    stopLocalTyping(selectedConversationId);
    setSelectedConversationId("");
    setSelectedContactId("");
    setMessages([]);
  };

  const handleOpenMediaPicker = () => {
    mediaInputRef.current?.click();
  };

  const handleRemoveQueuedMedia = (url) => {
    setQueuedMedia((prev) => prev.filter((item) => item.url !== url));
  };

  const handleDraftChange = (e) => {
    const nextValue = String(e.target.value || "");
    setDraft(nextValue);

    const roomId = toId(selectedConversationId);
    if (!roomId) return;

    if (nextValue.trim()) {
      emitTypingState(roomId, true);
      queueLocalTypingStop(roomId);
    } else {
      stopLocalTyping(roomId);
    }
  };

  const handleDraftBlur = () => {
    stopLocalTyping(selectedConversationId);
  };

  const handleMediaSelected = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = null;
    if (!files.length) return;

    if (queuedShare) {
      setError("Remove shared property before attaching media");
      return;
    }

    const remainingSlots = Math.max(0, MAX_MEDIA_ATTACHMENTS - queuedMedia.length);
    if (!remainingSlots) {
      setError(`You can attach up to ${MAX_MEDIA_ATTACHMENTS} files`);
      return;
    }

    const selectedFiles = files.slice(0, remainingSlots);
    if (files.length > remainingSlots) {
      setError(`Only ${remainingSlots} more attachment(s) can be added`);
    }

    const oversized = selectedFiles.find((file) => Number(file.size || 0) > MAX_MEDIA_SIZE_BYTES);
    if (oversized) {
      setError(`"${oversized.name}" exceeds ${Math.round(MAX_MEDIA_SIZE_BYTES / (1024 * 1024))}MB`);
      return;
    }

    setUploadingMedia(true);
    try {
      const uploaded = [];
      for (const file of selectedFiles) {
        const media = await uploadMediaFile(file);
        uploaded.push(media);
      }

      setQueuedMedia((prev) => [...prev, ...uploaded].slice(0, MAX_MEDIA_ATTACHMENTS));
      setError("");
    } catch (uploadError) {
      setError(toErrorMessage(uploadError, "Failed to upload media"));
    } finally {
      setUploadingMedia(false);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    const text = draft.trim();
    if ((!text && !queuedShare && queuedMedia.length === 0) || sending || !activeContact) return;
    stopLocalTyping(selectedConversationId);

    setSending(true);
    setDraft("");

    const payload = selectedConversationId
      ? { conversationId: selectedConversationId }
      : { recipientId: activeContact._id };
    if (text) payload.text = text;
    if (queuedShare) payload.sharedProperty = queuedShare;
    if (queuedMedia.length > 0) payload.mediaAttachments = queuedMedia;

    try {
      const socket = socketRef.current;
      let result = null;

      if (socket?.connected) {
        const ack = await new Promise((resolve) => {
          socket.emit("messenger:send", payload, (response) => {
            resolve(response || {});
          });
        });

        if (!ack?.ok) {
          throw new Error(ack?.error || "Failed to send message");
        }
        result = {
          conversation: ack.conversation || null,
          message: ack.message || null,
        };
      } else {
        result = await sendDirectMessage(payload);
      }

      if (result?.conversation) {
        setConversations((prev) => upsertConversation(prev, result.conversation));
      }

      if (!selectedConversationId && result?.conversation?._id) {
        setSelectedConversationId(result.conversation._id);
        setSelectedContactId("");
      }

      if (result?.message) {
        setMessages((prev) => mergeMessages(prev, [result.message]));
      }

      if (queuedShare) {
        setQueuedShare(null);
      }
      if (queuedMedia.length > 0) {
        setQueuedMedia([]);
      }

      setError("");
    } catch (err) {
      setDraft(text);
      setError(toErrorMessage(err, "Failed to send message"));
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className={`flex h-full w-full items-center justify-center ${isDark ? "text-slate-400" : "text-slate-500"}`}>
        Loading messenger...
      </div>
    );
  }

  return (
    <div
      className={`h-full min-h-0 w-full overflow-hidden p-2 sm:p-3 ${isDark ? "bg-slate-950/35" : "bg-slate-100/75"}`}
    >
      <Motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className={`mx-auto grid h-full min-h-0 w-full max-w-[1520px] grid-cols-1 overflow-hidden rounded-2xl border shadow-sm md:grid-cols-[360px_1fr] ${
          isDark ? "border-slate-700 bg-slate-900/70" : "border-slate-200 bg-white/90"
        }`}
      >
        <aside className={`${activeContact ? "hidden md:flex" : "flex"} min-h-0 flex-col overflow-hidden border-r p-3 ${
          isDark ? "border-slate-700 bg-slate-900/85" : "border-slate-200 bg-white"
        }`}>
          <div className={`rounded-xl border px-3 py-2.5 ${isDark ? "border-slate-700 bg-slate-950/60" : "border-slate-200 bg-slate-50"}`}>
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className={`inline-flex items-center gap-1.5 text-sm font-semibold ${isDark ? "text-slate-100" : "text-slate-900"}`}>
                  <MessageSquare size={14} />
                  Chats
                </p>
                <p className={`text-[11px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  {conversations.length} conversations
                </p>
              </div>
              <div className="flex items-center gap-2">
                {unreadTotal > 0 && (
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    isDark ? "bg-rose-500 text-white" : "bg-rose-600 text-white"
                  }`}>
                    {unreadTotal > 99 ? "99+" : unreadTotal}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => loadMessenger(true)}
                  disabled={refreshing}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg border ${
                    isDark
                      ? "border-slate-700 text-slate-300 hover:border-cyan-300/40 hover:text-cyan-200"
                      : "border-slate-300 text-slate-600 hover:border-cyan-400 hover:text-cyan-700"
                  } disabled:opacity-60`}
                  title="Refresh chats"
                >
                  <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
                </button>
              </div>
            </div>

            <div className={`mt-2 flex items-center gap-2 rounded-lg border px-2.5 py-2 ${
              isDark
                ? "border-slate-700 bg-slate-900/90 text-slate-300"
                : "border-slate-300 bg-white text-slate-600"
            }`}>
              <Search size={14} />
              <input
                value={chatSearch}
                onChange={(e) => setChatSearch(e.target.value)}
                placeholder="Search chats or contacts"
                className={`w-full bg-transparent text-sm outline-none ${
                  isDark ? "placeholder:text-slate-500" : "placeholder:text-slate-400"
                }`}
              />
            </div>

            <p className={`mt-2 text-[10px] uppercase tracking-[0.14em] ${
              socketConnected
                ? isDark
                  ? "text-emerald-300"
                  : "text-emerald-700"
                : isDark
                  ? "text-amber-300"
                  : "text-amber-700"
            }`}>
              {socketConnected ? "Realtime connected" : "Reconnecting..."}
            </p>
          </div>

          <div className="mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1 custom-scrollbar">
            <div>
              <p className={`pb-1 pl-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                Conversations
              </p>
              <div className="space-y-1.5">
                {filteredConversations.map((conversation) => {
                const peer = getOtherParticipant(conversation, currentUser.id);
                if (!peer) return null;
                const active = String(conversation._id) === String(selectedConversationId);
                const unreadCount = Math.max(
                  0,
                  Number(unreadByConversation[String(conversation._id)] ?? 0),
                );

                return (
                  <button
                    key={conversation._id}
                    type="button"
                    onClick={() => handlePickConversation(conversation._id)}
                    className={`w-full rounded-2xl border p-2.5 text-left transition ${
                      active
                        ? isDark
                          ? "border-cyan-400/45 bg-cyan-500/12"
                          : "border-cyan-300 bg-cyan-50"
                        : isDark
                          ? "border-transparent hover:border-slate-700 hover:bg-slate-950/70"
                          : "border-slate-200 bg-slate-50 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${
                        isDark ? "bg-slate-800 text-slate-200" : "bg-slate-200 text-slate-700"
                      }`}>
                        {getInitials(peer.name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`truncate text-sm font-semibold ${isDark ? "text-slate-100" : "text-slate-900"}`}>
                            {peer.name}
                          </p>
                          <p className={`shrink-0 text-[10px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                            {toSidebarTime(conversation.lastMessageAt || conversation.updatedAt)}
                          </p>
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <p className={`truncate text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                            {conversation.lastMessage || "Start chatting"}
                          </p>
                          {unreadCount > 0 && (
                            <span className={`ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                              isDark ? "bg-cyan-500 text-slate-950" : "bg-cyan-600 text-white"
                            }`}>
                              {unreadCount > 99 ? "99+" : unreadCount}
                            </span>
                          )}
                        </div>
                        <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${roleBadgeClass(peer.role, isDark)}`}>
                          {peer.roleLabel || peer.role}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
              {filteredConversations.length === 0 && (
                <div className={`rounded-xl border border-dashed px-3 py-4 text-center text-xs ${isDark ? "border-slate-700 text-slate-400" : "border-slate-300 text-slate-500"}`}>
                  No chats found
                </div>
              )}
            </div>
          </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <p className={`pb-1 pl-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  Start New Chat
                </p>
                <span className={`inline-flex items-center gap-1 text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  <Users size={12} />
                  {contacts.length}
                </span>
              </div>
              <div className="space-y-1.5">
                {filteredContacts.map((contact) => {
                const active = !selectedConversationId && String(contact._id) === String(selectedContactId);
                return (
                  <button
                    key={contact._id}
                    type="button"
                    onClick={() => handlePickContact(contact._id)}
                    className={`w-full rounded-xl border px-2.5 py-2 text-left transition-colors ${
                      active
                        ? isDark
                          ? "border-cyan-400/35 bg-cyan-500/12"
                          : "border-cyan-300 bg-cyan-50"
                        : isDark
                          ? "border-transparent hover:border-slate-700 hover:bg-slate-950/70"
                          : "border-transparent hover:border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-semibold ${
                          isDark ? "bg-slate-800 text-slate-200" : "bg-slate-200 text-slate-700"
                        }`}>
                          {getInitials(contact.name)}
                        </div>
                        <p className={`text-sm font-semibold ${isDark ? "text-slate-100" : "text-slate-900"}`}>
                          {contact.name}
                        </p>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${roleBadgeClass(contact.role, isDark)}`}>
                        {contact.roleLabel || contact.role}
                      </span>
                    </div>
                  </button>
                );
              })}
                {filteredContacts.length === 0 && (
                  <div className={`rounded-xl border border-dashed px-3 py-4 text-center text-xs ${
                    isDark ? "border-slate-700 text-slate-400" : "border-slate-300 text-slate-500"
                  }`}>
                    No contacts found
                  </div>
                )}
              </div>
            </div>
          </div>
        </aside>

        <section className={`${!activeContact ? "hidden md:flex" : "flex"} min-h-0 min-w-0 flex-col overflow-hidden ${isDark ? "bg-slate-900/65" : "bg-white/90"}`}>
          <div className={`sticky top-0 z-20 flex items-center gap-2.5 border-b px-3 py-2.5 sm:px-4 ${
            isDark ? "border-slate-700 bg-slate-900/90" : "border-slate-200 bg-white"
          }`}>
            <button
              type="button"
              onClick={handleMobileBack}
              className={`inline-flex h-8 w-8 items-center justify-center rounded-lg md:hidden ${
                isDark ? "text-slate-300 hover:bg-slate-800" : "text-slate-600 hover:bg-slate-100"
              }`}
              aria-label="Back to chats"
            >
              <ArrowLeft size={16} />
            </button>

            {activeContact ? (
              <div className="flex min-w-0 items-center gap-2">
                <div className={`flex h-9 w-9 items-center justify-center rounded-full text-[10px] font-semibold ${
                  isDark ? "bg-slate-800 text-slate-200" : "bg-slate-200 text-slate-700"
                }`}>
                  {getInitials(activeContact.name)}
                </div>
                <div className="min-w-0">
                  <p className={`truncate text-sm font-semibold ${isDark ? "text-slate-100" : "text-slate-900"}`}>
                    {activeContact.name}
                  </p>
                  <p className={`truncate text-[11px] ${
                    isActiveContactTyping
                      ? isDark
                        ? "text-emerald-300"
                        : "text-emerald-600"
                      : isDark
                        ? "text-slate-400"
                        : "text-slate-500"
                  }`}>
                    {isActiveContactTyping ? "typing..." : (activeContact.roleLabel || activeContact.role)}
                  </p>
                </div>
              </div>
            ) : (
              <p className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                Select a chat to start messaging
              </p>
            )}

            <div className="ml-auto flex items-center gap-2">
              {activeContact && (
                activeCall ? (
                  <button
                    type="button"
                    onClick={handleEndCall}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-rose-600 text-white transition-colors hover:bg-rose-500"
                    title="End call"
                  >
                    <PhoneOff size={14} />
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => handleStartCall(CALL_MODES.AUDIO)}
                      disabled={Boolean(incomingCall)}
                      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-colors ${
                        isDark
                          ? "border-slate-700 text-slate-200 hover:border-cyan-400/50 hover:text-cyan-200"
                          : "border-slate-300 text-slate-600 hover:border-cyan-400 hover:text-cyan-700"
                      } disabled:cursor-not-allowed disabled:opacity-60`}
                      title="Start voice call"
                    >
                      <Phone size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStartCall(CALL_MODES.VIDEO)}
                      disabled={Boolean(incomingCall)}
                      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-colors ${
                        isDark
                          ? "border-slate-700 text-slate-200 hover:border-cyan-400/50 hover:text-cyan-200"
                          : "border-slate-300 text-slate-600 hover:border-cyan-400 hover:text-cyan-700"
                      } disabled:cursor-not-allowed disabled:opacity-60`}
                      title="Start video call"
                    >
                      <Video size={14} />
                    </button>
                  </>
                )
              )}
              <span className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                {messages.length} messages
              </span>
            </div>
          </div>

          {error && (
            <div className={`mx-3 mt-2 rounded-xl border px-3 py-2 text-xs sm:mx-4 ${
              isDark ? "border-amber-500/35 bg-amber-500/10 text-amber-200" : "border-amber-300 bg-amber-50 text-amber-700"
            }`}>
              {error}
            </div>
          )}

          {callError && (
            <div className={`mx-3 mt-2 rounded-xl border px-3 py-2 text-xs sm:mx-4 ${
              isDark ? "border-rose-500/35 bg-rose-500/10 text-rose-100" : "border-rose-300 bg-rose-50 text-rose-700"
            }`}>
              {callError}
            </div>
          )}

          {incomingCall && (
            <div className={`mx-3 mt-2 rounded-xl border px-3 py-2 sm:mx-4 ${
              isDark ? "border-cyan-400/30 bg-cyan-500/10" : "border-cyan-300 bg-cyan-50"
            }`}>
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                  isDark ? "bg-slate-900 text-cyan-200" : "bg-white text-cyan-700"
                }`}>
                  {incomingCall.mode === CALL_MODES.VIDEO ? <Video size={16} /> : <Phone size={16} />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-sm font-semibold ${isDark ? "text-slate-100" : "text-slate-900"}`}>
                    {incomingCall?.from?.name || "Incoming call"}
                  </p>
                  <p className={`text-xs ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                    {incomingCall.mode === CALL_MODES.VIDEO ? "Video call" : "Voice call"} incoming
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAcceptIncomingCall}
                  className="inline-flex h-8 items-center justify-center rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-500"
                >
                  Accept
                </button>
                <button
                  type="button"
                  onClick={handleRejectIncomingCall}
                  className="inline-flex h-8 items-center justify-center rounded-lg bg-rose-600 px-3 text-xs font-semibold text-white hover:bg-rose-500"
                >
                  Decline
                </button>
              </div>
            </div>
          )}

          <div className={`relative min-h-0 flex-1 overflow-hidden ${isDark ? "bg-slate-950/45" : "bg-slate-50"}`}>
            <div className={`pointer-events-none absolute inset-0 opacity-45 ${
              isDark
                ? "bg-[radial-gradient(circle_at_20%_20%,rgba(34,211,238,0.14),transparent_40%),radial-gradient(circle_at_80%_0%,rgba(14,165,233,0.12),transparent_35%),linear-gradient(45deg,rgba(15,23,42,0.75)_25%,transparent_25%,transparent_50%,rgba(15,23,42,0.75)_50%,rgba(15,23,42,0.75)_75%,transparent_75%,transparent)] bg-[length:220px_220px]"
                : "bg-[radial-gradient(circle_at_25%_20%,rgba(6,182,212,0.13),transparent_45%),radial-gradient(circle_at_85%_0%,rgba(56,189,248,0.12),transparent_35%),linear-gradient(45deg,rgba(226,232,240,0.6)_25%,transparent_25%,transparent_50%,rgba(226,232,240,0.6)_50%,rgba(226,232,240,0.6)_75%,transparent_75%,transparent)] bg-[length:220px_220px]"
            }`}
            />
            {activeCall && (
              <div className={`absolute left-3 right-3 top-3 z-20 overflow-hidden rounded-2xl border sm:left-5 sm:right-5 ${
                isDark ? "border-cyan-400/25 bg-slate-900/95" : "border-cyan-300 bg-white/95"
              }`}>
                <div className="flex items-center justify-between gap-3 border-b px-3 py-2.5 sm:px-4">
                  <div className="min-w-0">
                    <p className={`truncate text-sm font-semibold ${isDark ? "text-slate-100" : "text-slate-900"}`}>
                      {activeCallPeerName}
                    </p>
                    <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                      {activeCall.mode === CALL_MODES.VIDEO ? "Video call" : "Voice call"} | {activeCallLabel}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleEndCall}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-rose-600 text-white hover:bg-rose-500"
                    title="End call"
                  >
                    <PhoneOff size={14} />
                  </button>
                </div>
                {activeCall.mode === CALL_MODES.VIDEO ? (
                  <div className={`relative h-56 sm:h-64 ${isDark ? "bg-slate-950" : "bg-slate-100"}`}>
                    <video
                      ref={remoteVideoRef}
                      autoPlay
                      playsInline
                      className="h-full w-full bg-black object-cover"
                    />
                    <video
                      ref={localVideoRef}
                      autoPlay
                      muted
                      playsInline
                      className="absolute bottom-2 right-2 h-24 w-32 rounded-lg border border-white/40 bg-black object-cover shadow-lg"
                    />
                  </div>
                ) : (
                  <div className={`flex items-center gap-2 px-3 py-3 text-sm sm:px-4 ${isDark ? "text-slate-200" : "text-slate-700"}`}>
                    <Phone size={14} />
                    <span>Microphone call in progress. Keep this chat open.</span>
                  </div>
                )}
              </div>
            )}

            <div className={`relative h-full min-h-0 space-y-3 overflow-y-auto px-3 py-4 sm:px-5 custom-scrollbar ${callTimelineOffsetClass}`}>
            {messagesLoading ? (
              <div className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                Loading messages...
              </div>
            ) : !activeContact ? (
              <div className={`rounded-xl border border-dashed p-6 text-center text-sm ${isDark ? "border-slate-700 text-slate-400" : "border-slate-300 text-slate-500"}`}>
                Pick a contact from the left panel.
              </div>
            ) : timeline.length === 0 ? (
              <div className={`rounded-xl border border-dashed p-6 text-center text-sm ${isDark ? "border-slate-700 text-slate-400" : "border-slate-300 text-slate-500"}`}>
                No messages yet. Start the conversation.
              </div>
            ) : (
              timeline.map(({ message, showDayBreak, dayLabel }) => {
                const mine = String(message.sender?._id || "") === currentUser.id;
                const outgoingStatus = mine ? getOutgoingMessageStatus(message, currentUser.id) : "";
                const sharedProperty = isPropertyMessage(message)
                  ? sanitizeSharePayload(message.sharedProperty)
                  : null;
                const mediaAttachments = sanitizeMediaAttachments(message.mediaAttachments);
                const showText =
                  Boolean(String(message.text || "").trim())
                  && !isAutoPropertyText(message)
                  && !isAutoMediaText(message);
                return (
                  <React.Fragment key={message._id}>
                    {showDayBreak && (
                      <div className="py-1 text-center">
                        <span className={`rounded-full px-2 py-1 text-[10px] uppercase tracking-[0.16em] ${isDark ? "bg-slate-800 text-slate-400" : "bg-slate-100 text-slate-500"}`}>
                          {dayLabel}
                        </span>
                      </div>
                    )}
                    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[88%] rounded-2xl border px-3 py-2.5 shadow-sm sm:max-w-[72%] ${
                        mine
                          ? isDark
                            ? "border-cyan-400/35 bg-cyan-500/20 text-slate-100"
                            : "border-cyan-300 bg-cyan-100 text-slate-900"
                          : isDark
                            ? "border-slate-700 bg-slate-900/95 text-slate-100"
                            : "border-slate-200 bg-white text-slate-900"
                      }`}>
                        <div className="mb-1 flex items-center justify-between gap-3">
                          <p className={`text-xs font-semibold ${mine ? (isDark ? "text-cyan-200" : "text-cyan-700") : (isDark ? "text-slate-300" : "text-slate-600")}`}>
                            {mine ? "You" : message.sender?.name || "Unknown"}
                          </p>
                          <div className="flex items-center gap-1.5">
                            <p className={`text-[10px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                              {toLocalTime(message.createdAt)}
                            </p>
                            {mine && (
                              <span
                                title={outgoingStatus}
                                className={`inline-flex items-center ${
                                  outgoingStatus === "seen"
                                    ? isDark ? "text-cyan-200" : "text-cyan-700"
                                    : isDark
                                      ? "text-slate-400"
                                      : "text-slate-500"
                                }`}
                              >
                                {outgoingStatus === "sent" ? <Check size={11} /> : <CheckCheck size={11} />}
                              </span>
                            )}
                          </div>
                        </div>
                        {sharedProperty && (
                          <div className={`mb-2 overflow-hidden rounded-xl border ${isDark ? "border-slate-700 bg-slate-900/90" : "border-slate-200 bg-white"}`}>
                            <div className="flex gap-3 p-2.5">
                              <div className={`h-14 w-16 shrink-0 overflow-hidden rounded-lg ${isDark ? "bg-slate-800" : "bg-slate-100"}`}>
                                {sharedProperty.image ? (
                                  <img
                                    src={sharedProperty.image}
                                    alt={sharedProperty.title || "Shared Property"}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <div className={`flex h-full w-full items-center justify-center ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                                    <Share2 size={14} />
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className={`truncate text-xs font-semibold ${isDark ? "text-slate-100" : "text-slate-900"}`}>
                                  {sharedProperty.title || "Shared Property"}
                                </p>
                                <p className={`mt-0.5 truncate text-[11px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                                  {sharedProperty.location || "Location unavailable"}
                                </p>
                                <p className={`mt-0.5 text-[11px] ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                                  {formatCurrency(sharedProperty.price)}
                                  {sharedProperty.status ? ` | ${sharedProperty.status}` : ""}
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => openPropertyDetails(sharedProperty.inventoryId)}
                              className={`flex w-full items-center justify-center gap-1 border-t px-2 py-1.5 text-[11px] font-semibold ${
                                isDark
                                  ? "border-slate-700 text-cyan-200 hover:bg-slate-800"
                                  : "border-slate-200 text-cyan-700 hover:bg-cyan-50"
                              }`}
                            >
                              Open Property
                              <ExternalLink size={12} />
                            </button>
                          </div>
                        )}
                        {mediaAttachments.length > 0 && (
                          <div className="mb-2 space-y-2">
                            {mediaAttachments.map((media, index) => (
                              <div
                                key={`${media.url}-${index}`}
                                className={`overflow-hidden rounded-xl border ${
                                  isDark ? "border-slate-700 bg-slate-900/90" : "border-slate-200 bg-white"
                                }`}
                              >
                                {media.kind === "image" ? (
                                  <a href={media.url} target="_blank" rel="noreferrer">
                                    <img
                                      src={media.url}
                                      alt={buildMediaLabel(media)}
                                      className="max-h-64 w-full object-cover"
                                    />
                                  </a>
                                ) : media.kind === "video" ? (
                                  <video className="w-full" controls preload="metadata">
                                    <source src={media.url} type={media.mimeType || "video/mp4"} />
                                  </video>
                                ) : media.kind === "audio" ? (
                                  <div className="p-2.5">
                                    <audio className="w-full" controls preload="metadata">
                                      <source src={media.url} type={media.mimeType || "audio/mpeg"} />
                                    </audio>
                                  </div>
                                ) : (
                                  <a
                                    href={media.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className={`flex items-center gap-2 px-3 py-2 ${
                                      isDark ? "text-cyan-200 hover:bg-slate-800" : "text-cyan-700 hover:bg-cyan-50"
                                    }`}
                                  >
                                    <FileText size={14} />
                                    <span className="truncate text-xs font-semibold">
                                      {buildMediaLabel(media)}
                                    </span>
                                    <ExternalLink size={12} className="ml-auto shrink-0" />
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        {showText && (
                          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                            {message.text}
                          </p>
                        )}
                      </div>
                    </div>
                  </React.Fragment>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>
          </div>

          <form
            onSubmit={handleSend}
            className={`border-t px-3 pt-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))] sm:px-4 ${isDark ? "border-slate-700 bg-slate-900/85" : "border-slate-200 bg-white"}`}
          >
            {queuedShare && (
              <div className={`mb-3 rounded-xl border p-2.5 ${isDark ? "border-cyan-400/25 bg-cyan-500/10" : "border-cyan-200 bg-cyan-50/80"}`}>
                <div className="flex items-start gap-2.5">
                  <div className={`h-12 w-14 shrink-0 overflow-hidden rounded-lg ${isDark ? "bg-slate-800" : "bg-white"}`}>
                    {queuedShare.image ? (
                      <img
                        src={queuedShare.image}
                        alt={queuedShare.title || "Property"}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className={`flex h-full w-full items-center justify-center ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                        <Share2 size={14} />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-xs font-semibold ${isDark ? "text-slate-100" : "text-slate-900"}`}>
                      {queuedShare.title || "Property selected"}
                    </p>
                    <p className={`mt-0.5 truncate text-[11px] ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                      {queuedShare.location || "Location unavailable"}
                    </p>
                    <p className={`mt-0.5 text-[11px] ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                      {formatCurrency(queuedShare.price)}
                      {queuedShare.status ? ` | ${queuedShare.status}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setQueuedShare(null)}
                    className={`rounded-lg p-1 transition-colors ${isDark ? "text-slate-300 hover:bg-slate-800" : "text-slate-500 hover:bg-white"}`}
                    title="Remove shared property"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            )}
            {queuedMedia.length > 0 && (
              <div className={`mb-3 rounded-xl border p-2.5 ${isDark ? "border-cyan-400/25 bg-cyan-500/10" : "border-cyan-200 bg-cyan-50/80"}`}>
                <div className="mb-2 flex items-center justify-between">
                  <p className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${isDark ? "text-cyan-200" : "text-cyan-700"}`}>
                    Media Attachments
                  </p>
                  <span className={`text-[10px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                    {queuedMedia.length}/{MAX_MEDIA_ATTACHMENTS}
                  </span>
                </div>
                <div className="space-y-2">
                  {queuedMedia.map((media, index) => (
                    <div
                      key={`${media.url}-${index}`}
                      className={`rounded-lg border p-2 ${
                        isDark ? "border-slate-700 bg-slate-900/80" : "border-slate-200 bg-white"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`flex h-9 w-9 items-center justify-center rounded ${isDark ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-500"}`}>
                          {media.kind === "image" ? <Share2 size={14} /> : <FileText size={14} />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={`truncate text-xs font-semibold ${isDark ? "text-slate-100" : "text-slate-900"}`}>
                            {buildMediaLabel(media)}
                          </p>
                          <p className={`text-[11px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                            {media.kind.toUpperCase()}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveQueuedMedia(media.url)}
                          className={`rounded-lg p-1 transition-colors ${isDark ? "text-slate-300 hover:bg-slate-800" : "text-slate-500 hover:bg-slate-100"}`}
                          title="Remove media"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex items-end gap-2">
              <input
                ref={mediaInputRef}
                type="file"
                multiple
                onChange={handleMediaSelected}
                className="hidden"
                accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar"
              />
              <button
                type="button"
                onClick={handleOpenMediaPicker}
                disabled={!activeContact || uploadingMedia || sending || Boolean(queuedShare)}
                className={`h-11 w-11 shrink-0 rounded-full border transition-colors ${
                  isDark
                    ? "border-slate-700 bg-slate-950 text-slate-200 hover:border-cyan-400/40 hover:text-cyan-200"
                    : "border-slate-300 bg-white text-slate-600 hover:border-cyan-400 hover:text-cyan-700"
                } disabled:cursor-not-allowed disabled:opacity-60`}
                title={queuedShare ? "Remove property share to attach media" : "Attach media"}
              >
                {uploadingMedia ? (
                  <RefreshCw size={15} className="mx-auto animate-spin" />
                ) : (
                  <Paperclip size={15} className="mx-auto" />
                )}
              </button>
              <textarea
                value={draft}
                onChange={handleDraftChange}
                onBlur={handleDraftBlur}
                placeholder={
                  activeContact
                    ? queuedShare
                      ? `Add a note for ${activeContact.name} (optional)...`
                      : queuedMedia.length > 0
                        ? `Add a note for ${activeContact.name} (optional)...`
                      : `Message ${activeContact.name}...`
                    : "Select a contact first"
                }
                rows={2}
                maxLength={1200}
                disabled={!activeContact}
                className={`w-full resize-none rounded-2xl border px-3 py-2 text-sm outline-none ${isDark ? "border-slate-700 bg-slate-950 text-slate-100 placeholder:text-slate-500 focus:border-cyan-400/50" : "border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-cyan-500"} disabled:cursor-not-allowed disabled:opacity-60`}
              />
              <button
                type="submit"
                disabled={sending || uploadingMedia || (!draft.trim() && !queuedShare && queuedMedia.length === 0) || !activeContact}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-cyan-600 text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
                title="Send message"
              >
                {sending ? <RefreshCw size={15} className="animate-spin" /> : <Send size={15} />}
              </button>
            </div>
          </form>
        </section>
      </Motion.div>
    </div>
  );
};

export default TeamChat;
