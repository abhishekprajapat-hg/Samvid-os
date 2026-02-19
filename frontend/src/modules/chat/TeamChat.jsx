import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion as Motion } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ExternalLink,
  FileText,
  MessageSquare,
  Paperclip,
  RefreshCw,
  Search,
  Share2,
  Send,
  Users,
  X,
} from "lucide-react";
import {
  getConversationMessages,
  getMessengerContacts,
  getMessengerConversations,
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
  const bottomRef = useRef(null);
  const mediaInputRef = useRef(null);

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
  const [draft, setDraft] = useState("");
  const [queuedShare, setQueuedShare] = useState(null);
  const [queuedMedia, setQueuedMedia] = useState([]);
  const [chatSearch, setChatSearch] = useState("");

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
    setActiveConversationId(selectedConversationId || "");

    if (selectedConversationId) {
      markConversationRead(selectedConversationId).catch(() => null);
    }

    return () => {
      setActiveConversationId("");
    };
  }, [markConversationRead, selectedConversationId, setActiveConversationId]);

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
    const token = localStorage.getItem("token");
    if (!token) return undefined;

    const socket = createChatSocket(token);
    socketRef.current = socket;

    const onConnect = () => {
      setSocketConnected(true);
    };

    const onDisconnect = () => {
      setSocketConnected(false);
    };

    const onConnectError = () => {
      setSocketConnected(false);
    };

    const onNewMessage = ({ conversation, message }) => {
      if (!conversation?._id || !message?._id) return;

      setConversations((prev) => upsertConversation(prev, conversation));

      if (!selectedConversationRef.current) {
        setSelectedConversationId(conversation._id);
        setSelectedContactId("");
      }

      if (String(selectedConversationRef.current) === String(conversation._id)) {
        setMessages((prev) => mergeMessages(prev, [message]));
        const senderId = String(message?.sender?._id || "");
        if (senderId && senderId !== currentUser.id) {
          markConversationRead(conversation._id).catch(() => null);
        }
      }
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);
    socket.on("messenger:message:new", onNewMessage);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      socket.off("messenger:message:new", onNewMessage);
      socket.disconnect();
      socketRef.current = null;
      setSocketConnected(false);
    };
  }, [currentUser.id, markConversationRead]);

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
    const id = String(conversationId);
    setSelectedConversationId(id);
    setSelectedContactId("");
    markConversationRead(id, { persist: false }).catch(() => null);
  };

  const handlePickContact = (contactId) => {
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
                  <p className={`truncate text-[11px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                    {activeContact.roleLabel || activeContact.role}
                  </p>
                </div>
              </div>
            ) : (
              <p className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                Select a chat to start messaging
              </p>
            )}

            <span className={`ml-auto text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              {messages.length} messages
            </span>
          </div>

          {error && (
            <div className={`mx-3 mt-2 rounded-xl border px-3 py-2 text-xs sm:mx-4 ${
              isDark ? "border-amber-500/35 bg-amber-500/10 text-amber-200" : "border-amber-300 bg-amber-50 text-amber-700"
            }`}>
              {error}
            </div>
          )}

          <div className={`relative min-h-0 flex-1 overflow-hidden ${isDark ? "bg-slate-950/45" : "bg-slate-50"}`}>
            <div className={`pointer-events-none absolute inset-0 opacity-45 ${
              isDark
                ? "bg-[radial-gradient(circle_at_20%_20%,rgba(34,211,238,0.14),transparent_40%),radial-gradient(circle_at_80%_0%,rgba(14,165,233,0.12),transparent_35%),linear-gradient(45deg,rgba(15,23,42,0.75)_25%,transparent_25%,transparent_50%,rgba(15,23,42,0.75)_50%,rgba(15,23,42,0.75)_75%,transparent_75%,transparent)] bg-[length:220px_220px]"
                : "bg-[radial-gradient(circle_at_25%_20%,rgba(6,182,212,0.13),transparent_45%),radial-gradient(circle_at_85%_0%,rgba(56,189,248,0.12),transparent_35%),linear-gradient(45deg,rgba(226,232,240,0.6)_25%,transparent_25%,transparent_50%,rgba(226,232,240,0.6)_50%,rgba(226,232,240,0.6)_75%,transparent_75%,transparent)] bg-[length:220px_220px]"
            }`}
            />

            <div className="relative h-full min-h-0 space-y-3 overflow-y-auto px-3 py-4 sm:px-5 custom-scrollbar">
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
                          <p className={`text-[10px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                            {toLocalTime(message.createdAt)}
                          </p>
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

          <form onSubmit={handleSend} className={`border-t px-3 py-2.5 sm:px-4 ${isDark ? "border-slate-700 bg-slate-900/85" : "border-slate-200 bg-white"}`}>
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
                onChange={(e) => setDraft(e.target.value)}
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
