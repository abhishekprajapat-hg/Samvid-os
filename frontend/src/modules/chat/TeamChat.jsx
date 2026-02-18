import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  MessageSquare,
  RefreshCw,
  Send,
  UserRound,
  Users,
} from "lucide-react";
import {
  getConversationMessages,
  getMessengerContacts,
  getMessengerConversations,
  sendDirectMessage,
} from "../../services/chatService";
import { createChatSocket } from "../../services/chatSocket";
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

const TeamChat = ({ theme = "dark" }) => {
  const isDark = theme === "dark";
  const currentUser = useMemo(() => getCurrentUser(), []);
  const socketRef = useRef(null);
  const selectedConversationRef = useRef("");
  const bottomRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [error, setError] = useState("");

  const [contacts, setContacts] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [selectedConversationId, setSelectedConversationId] = useState("");
  const [selectedContactId, setSelectedContactId] = useState("");
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    selectedConversationRef.current = selectedConversationId;
  }, [selectedConversationId]);

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
  }, []);

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
  }, []);

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
    setSelectedConversationId(String(conversationId));
    setSelectedContactId("");
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

  const handleSend = async (e) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || sending || !activeContact) return;

    setSending(true);
    setDraft("");

    const payload = selectedConversationId
      ? { conversationId: selectedConversationId, text }
      : { recipientId: activeContact._id, text };

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
      className={`h-full w-full overflow-y-auto px-4 pt-20 pb-8 sm:px-6 md:pt-24 lg:px-10 ${isDark ? "bg-slate-950/35" : "bg-slate-50/70"}`}
    >
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-3xl border p-5 sm:p-6 ${isDark ? "border-slate-700 bg-slate-900/70" : "border-slate-200 bg-white/90"}`}
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.18em] ${isDark ? "border-cyan-400/35 bg-cyan-500/10 text-cyan-200" : "border-cyan-200 bg-cyan-50 text-cyan-700"}`}>
              <MessageSquare size={12} />
              Samvid Messenger
            </div>
            <h1 className={`mt-3 text-2xl font-display ${isDark ? "text-slate-100" : "text-slate-900"}`}>
              Direct Team Chat
            </h1>
            <p className={`mt-1 text-xs uppercase tracking-[0.18em] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              One-to-one realtime messaging
            </p>
          </div>

          <button
            onClick={() => loadMessenger(true)}
            disabled={refreshing}
            className={`h-10 rounded-xl border px-4 text-sm font-semibold transition-colors ${isDark ? "border-slate-700 bg-slate-900 text-slate-200 hover:border-cyan-300/35" : "border-slate-300 bg-white text-slate-700 hover:border-cyan-400"} disabled:opacity-60`}
          >
            <span className="inline-flex items-center gap-2">
              <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
              Refresh
            </span>
          </button>
        </div>

        <div className="mt-3">
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] ${
            socketConnected
              ? isDark
                ? "bg-emerald-500/15 text-emerald-200"
                : "bg-emerald-100 text-emerald-700"
              : isDark
                ? "bg-amber-500/15 text-amber-200"
                : "bg-amber-100 text-amber-700"
          }`}>
            <span className={`h-1.5 w-1.5 rounded-full ${socketConnected ? "bg-emerald-500" : "bg-amber-500"}`} />
            {socketConnected ? "Realtime Connected" : "Realtime Reconnecting"}
          </span>
        </div>
      </motion.div>

      {error && (
        <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${isDark ? "border-amber-500/35 bg-amber-500/10 text-amber-200" : "border-amber-300 bg-amber-50 text-amber-700"}`}>
          {error}
        </div>
      )}

      <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-[340px_1fr]">
        <aside className={`rounded-2xl border p-4 ${isDark ? "border-slate-700 bg-slate-900/70" : "border-slate-200 bg-white/90"} space-y-4`}>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h2 className={`text-sm font-semibold uppercase tracking-[0.16em] ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                Chats
              </h2>
              <span className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                {conversations.length}
              </span>
            </div>

            <div className="space-y-2">
              {conversations.map((conversation) => {
                const peer = getOtherParticipant(conversation, currentUser.id);
                if (!peer) return null;
                const active = String(conversation._id) === String(selectedConversationId);

                return (
                  <button
                    key={conversation._id}
                    type="button"
                    onClick={() => handlePickConversation(conversation._id)}
                    className={`w-full rounded-xl border px-3 py-2 text-left transition-colors ${
                      active
                        ? isDark
                          ? "border-cyan-400/35 bg-cyan-500/12"
                          : "border-cyan-300 bg-cyan-50"
                        : isDark
                          ? "border-slate-700 bg-slate-950/65 hover:border-slate-600"
                          : "border-slate-200 bg-slate-50 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-sm font-semibold ${isDark ? "text-slate-100" : "text-slate-900"}`}>
                        {peer.name}
                      </p>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${roleBadgeClass(peer.role, isDark)}`}>
                        {peer.roleLabel || peer.role}
                      </span>
                    </div>
                    <p className={`mt-1 truncate text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                      {conversation.lastMessage || "No messages yet"}
                    </p>
                  </button>
                );
              })}
              {conversations.length === 0 && (
                <div className={`rounded-xl border border-dashed px-3 py-4 text-center text-xs ${isDark ? "border-slate-700 text-slate-400" : "border-slate-300 text-slate-500"}`}>
                  No conversations yet
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h2 className={`text-sm font-semibold uppercase tracking-[0.16em] ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                Contacts
              </h2>
              <span className={`inline-flex items-center gap-1 text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                <Users size={12} />
                {contacts.length}
              </span>
            </div>
            <div className="max-h-[260px] space-y-2 overflow-y-auto custom-scrollbar">
              {contacts.map((contact) => {
                const active = !selectedConversationId && String(contact._id) === String(selectedContactId);
                return (
                  <button
                    key={contact._id}
                    type="button"
                    onClick={() => handlePickContact(contact._id)}
                    className={`w-full rounded-xl border px-3 py-2 text-left transition-colors ${
                      active
                        ? isDark
                          ? "border-cyan-400/35 bg-cyan-500/12"
                          : "border-cyan-300 bg-cyan-50"
                        : isDark
                          ? "border-slate-700 bg-slate-950/65 hover:border-slate-600"
                          : "border-slate-200 bg-slate-50 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-sm font-semibold ${isDark ? "text-slate-100" : "text-slate-900"}`}>
                        {contact.name}
                      </p>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${roleBadgeClass(contact.role, isDark)}`}>
                        {contact.roleLabel || contact.role}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        <section className={`rounded-2xl border ${isDark ? "border-slate-700 bg-slate-900/70" : "border-slate-200 bg-white/90"} flex min-h-[560px] flex-col overflow-hidden`}>
          <div className={`border-b px-4 py-3 ${isDark ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-slate-50"} flex items-center justify-between`}>
            {activeContact ? (
              <div className="flex items-center gap-2">
                <UserRound size={14} className={isDark ? "text-cyan-300" : "text-cyan-700"} />
                <p className={`text-sm font-semibold ${isDark ? "text-slate-100" : "text-slate-900"}`}>
                  {activeContact.name}
                </p>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${roleBadgeClass(activeContact.role, isDark)}`}>
                  {activeContact.roleLabel || activeContact.role}
                </span>
              </div>
            ) : (
              <p className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                Select a contact to start chatting
              </p>
            )}

            <span className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              {messages.length} messages
            </span>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-4 custom-scrollbar">
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
                No messages yet. Say hi.
              </div>
            ) : (
              timeline.map(({ message, showDayBreak, dayLabel }) => {
                const mine = String(message.sender?._id || "") === currentUser.id;
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
                      <div className={`max-w-[85%] rounded-2xl border px-3 py-2 sm:max-w-[72%] ${
                        mine
                          ? isDark
                            ? "border-cyan-400/30 bg-cyan-500/12 text-slate-100"
                            : "border-cyan-200 bg-cyan-50 text-slate-900"
                          : isDark
                            ? "border-slate-700 bg-slate-950/70 text-slate-100"
                            : "border-slate-200 bg-slate-50 text-slate-900"
                      }`}>
                        <div className="mb-1 flex items-center justify-between gap-3">
                          <p className={`text-xs font-semibold ${mine ? (isDark ? "text-cyan-200" : "text-cyan-700") : (isDark ? "text-slate-300" : "text-slate-600")}`}>
                            {mine ? "You" : message.sender?.name || "Unknown"}
                          </p>
                          <p className={`text-[10px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                            {toLocalTime(message.createdAt)}
                          </p>
                        </div>
                        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.text}</p>
                      </div>
                    </div>
                  </React.Fragment>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>

          <form onSubmit={handleSend} className={`border-t p-3 ${isDark ? "border-slate-700 bg-slate-900/80" : "border-slate-200 bg-white"}`}>
            <div className="flex items-end gap-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={activeContact ? `Message ${activeContact.name}...` : "Select a contact first"}
                rows={2}
                maxLength={1200}
                disabled={!activeContact}
                className={`w-full resize-none rounded-xl border px-3 py-2 text-sm outline-none ${isDark ? "border-slate-700 bg-slate-950 text-slate-100 placeholder:text-slate-500 focus:border-cyan-400/50" : "border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-cyan-500"} disabled:cursor-not-allowed disabled:opacity-60`}
              />
              <button
                type="submit"
                disabled={sending || !draft.trim() || !activeContact}
                className="h-11 rounded-xl bg-cyan-600 px-4 text-sm font-semibold text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="inline-flex items-center gap-1.5">
                  <Send size={14} />
                  {sending ? "Sending..." : "Send"}
                </span>
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
};

export default TeamChat;
