import api from "./api";
import type { ChatCallLog, ChatContact, ChatConversation, ChatMessage } from "../types";

const isMissingRouteError = (error: unknown) => {
  const status = (error as { response?: { status?: number } })?.response?.status;
  return status === 404;
};

const toRole = (value: unknown) => String(value || "").toUpperCase();

const pickUrlString = (value: unknown): string => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    const row = value as Record<string, unknown>;
    const nested =
      row.url
      || row.uri
      || row.secure_url
      || row.href
      || row.location
      || (row.file as any)?.url
      || (row.file as any)?.uri
      || "";
    return typeof nested === "string" ? nested : "";
  }
  return "";
};

const normalizeContact = (row: any): ChatContact => ({
  _id: String(row?._id || row?.id || ""),
  name: String(row?.name || "Unknown"),
  role: (toRole(row?.role) || "EXECUTIVE") as ChatContact["role"],
  roleLabel: String(row?.roleLabel || ""),
  avatarUrl: String(row?.avatarUrl || row?.profileImageUrl || ""),
});

const toLegacyAttachment = (attachment: any) => {
  if (!attachment || typeof attachment !== "object") return null;
  return {
    fileName: String(attachment.fileName || attachment.name || ""),
    fileUrl: pickUrlString(attachment.fileUrl || attachment.url || attachment.secure_url || ""),
    mimeType: String(attachment.mimeType || attachment.type || ""),
    size: Number(attachment.size || 0) || 0,
    storagePath: String(attachment.storagePath || ""),
  };
};

const normalizeMessage = (row: any): ChatMessage => {
  const mediaRows = Array.isArray(row?.mediaAttachments) ? row.mediaAttachments : [];
  const firstMedia = mediaRows[0] || null;
  const attachment = toLegacyAttachment(row?.attachment || firstMedia);

  return {
    _id: String(row?._id || row?.id || `message-${Date.now()}`),
    text: String(row?.text || ""),
    type: String(row?.type || "TEXT"),
    attachment,
    createdAt: String(row?.createdAt || new Date().toISOString()),
    sender: row?.sender
      ? {
          _id: String(row.sender._id || row.sender.id || ""),
          name: String(row.sender.name || ""),
          avatarUrl: String(row.sender.avatarUrl || row.sender.profileImageUrl || ""),
        }
      : undefined,
  };
};

const normalizeConversation = (row: any): ChatConversation => ({
  _id: String(row?._id || row?.id || ""),
  participants: Array.isArray(row?.participants) ? row.participants.map((participant: any) => normalizeContact(participant)) : [],
  lastMessage: String(row?.lastMessage || ""),
  lastMessageAt: String(row?.lastMessageAt || row?.updatedAt || ""),
  updatedAt: String(row?.updatedAt || ""),
  unreadCount: Math.max(0, Number(row?.unreadCount || 0)),
});

const normalizeCallLog = (row: any): ChatCallLog => {
  const statusMap: Record<string, ChatCallLog["status"]> = {
    RINGING: "INITIATED",
    CONNECTED: "ACCEPTED",
    ENDED: "ENDED",
    REJECTED: "REJECTED",
    MISSED: "MISSED",
    FAILED: "FAILED",
    CANCELLED: "CANCELLED",
    INITIATED: "INITIATED",
    ACCEPTED: "ACCEPTED",
  };

  const mode = String(row?.mode || row?.callType || "audio").toUpperCase();
  const normalizedStatus = statusMap[String(row?.status || "").toUpperCase()] || "INITIATED";
  const callerRow = row?.caller || row?.from || null;
  const calleeRow = row?.callee || row?.to || null;
  const metadata = row?.metadata || {};

  return {
    _id: String(row?._id || row?.callId || `call-${Date.now()}`),
    conversationId: String(row?.conversationId || row?.roomId || ""),
    caller: callerRow
      ? {
          _id: String(callerRow._id || metadata?.callerId || ""),
          name: String(callerRow.name || metadata?.callerName || ""),
          role: String(callerRow.role || ""),
          profileImageUrl: String(callerRow.profileImageUrl || ""),
        }
      : undefined,
    callee: calleeRow
      ? {
          _id: String(calleeRow._id || metadata?.calleeId || ""),
          name: String(calleeRow.name || metadata?.calleeName || ""),
          role: String(calleeRow.role || ""),
          profileImageUrl: String(calleeRow.profileImageUrl || ""),
        }
      : undefined,
    callType: mode === "VIDEO" ? "VIDEO" : "VOICE",
    status: normalizedStatus,
    startedAt: String(row?.startedAt || ""),
    answeredAt: String(row?.answeredAt || ""),
    endedAt: String(row?.endedAt || ""),
    durationSec: Number(row?.durationSec || row?.durationSeconds || 0),
    metadata,
    e2ee: row?.e2ee || { enabled: true, protocol: "X25519-AES-256-GCM" },
  };
};

const isWebRuntime = () => typeof window !== "undefined" && typeof document !== "undefined";

const toFormFileValue = async ({
  uri,
  name,
  mimeType,
  file,
}: {
  uri: string;
  name: string;
  mimeType: string;
  file?: any;
}) => {
  if (file) return file;

  const safeUri = String(uri || "");
  if (!isWebRuntime()) {
    return {
      uri: safeUri,
      name,
      type: mimeType,
    } as any;
  }

  // On web, FormData needs Blob/File; `{ uri, type }` throws "Unsupported source URL".
  if (/^(blob:|data:|https?:)/i.test(safeUri)) {
    const response = await fetch(safeUri);
    const blob = await response.blob();
    return new File([blob], name, { type: mimeType || blob.type || "application/octet-stream" });
  }

  return {
    uri: safeUri,
    name,
    type: mimeType,
  } as any;
};

const createLocalCallLog = ({
  conversationId,
  recipientId,
  callType,
  e2ee,
  metadata,
}: {
  conversationId?: string;
  recipientId?: string;
  callType: "VOICE" | "VIDEO";
  e2ee?: {
    enabled?: boolean;
    protocol?: string;
    senderKeyFingerprint?: string;
    receiverKeyFingerprint?: string;
  };
  metadata?: Record<string, unknown>;
}): ChatCallLog => ({
  _id: `local-call-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  conversationId: conversationId || "",
  callType,
  status: "INITIATED",
  startedAt: new Date().toISOString(),
  durationSec: 0,
  e2ee: e2ee || { enabled: true, protocol: "X25519-AES-256-GCM" },
  metadata: {
    ...(metadata || {}),
    localFallback: true,
    recipientId: recipientId || "",
  },
});

export const getMessengerContacts = async (): Promise<ChatContact[]> => {
  const res = await api.get("/chat/contacts");
  return Array.isArray(res.data?.contacts) ? res.data.contacts.map((row: any) => normalizeContact(row)) : [];
};

export const getMessengerConversations = async (): Promise<ChatConversation[]> => {
  try {
    const res = await api.get("/chat/conversations");
    return Array.isArray(res.data?.conversations) ? res.data.conversations.map((row: any) => normalizeConversation(row)) : [];
  } catch (error) {
    if (!isMissingRouteError(error)) throw error;
    const fallback = await api.get("/chat/rooms");
    const rooms = fallback.data?.rooms || [];
    return Array.isArray(rooms) ? rooms.map((row: any) => normalizeConversation(row)) : [];
  }
};

export const getConversationMessages = async ({
  conversationId,
  limit = 80,
  before,
}: {
  conversationId?: string;
  limit?: number;
  before?: string;
} = {}): Promise<ChatMessage[]> => {
  if (!conversationId) return [];

  const params: Record<string, string | number> = { limit };
  if (before) params.before = before;

  try {
    const res = await api.get(`/chat/conversations/${conversationId}/messages`, { params });
    return Array.isArray(res.data?.messages) ? res.data.messages.map((row: any) => normalizeMessage(row)) : [];
  } catch (error) {
    if (!isMissingRouteError(error)) throw error;
    const fallback = await api.get(`/chat/rooms/${conversationId}/messages`, { params });
    const rows = fallback.data?.messages || [];
    return Array.isArray(rows) ? rows.map((row: any) => normalizeMessage(row)) : [];
  }
};

export const sendDirectMessage = async ({
  text,
  conversationId,
  recipientId,
  attachment,
}: {
  text?: string;
  conversationId?: string;
  recipientId?: string;
  attachment?: {
    fileName?: string;
    fileUrl?: string;
    mimeType?: string;
    size?: number;
    storagePath?: string;
  } | null;
}) => {
  const payload: {
    text?: string;
    conversationId?: string;
    recipientId?: string;
    attachment?: {
      fileName?: string;
      fileUrl?: string;
      mimeType?: string;
      size?: number;
      storagePath?: string;
    } | null;
  } = {};

  if (typeof text === "string") payload.text = text;
  if (conversationId) payload.conversationId = conversationId;
  if (recipientId) payload.recipientId = recipientId;
  if (attachment) {
    payload.attachment = attachment;
    (payload as any).mediaAttachments = [
      {
        url: attachment.fileUrl || "",
        name: attachment.fileName || "",
        mimeType: attachment.mimeType || "",
        size: Number(attachment.size || 0) || 0,
      },
    ];
  }

  const res = await api.post("/chat/messages", payload);
  return {
    conversation: res.data?.conversation ? normalizeConversation(res.data.conversation) : null,
    message: res.data?.message ? normalizeMessage(res.data.message) : null,
  };
};

export const uploadChatFile = async ({
  uri,
  name,
  mimeType,
  file,
}: {
  uri: string;
  name: string;
  mimeType?: string;
  file?: any;
}) => {
  const formData = new FormData();
  const fileValue = await toFormFileValue({
    uri,
    name,
    mimeType: mimeType || "application/octet-stream",
    file,
  });
  formData.append("file", fileValue as any);

  try {
    const res = await api.post("/chat/uploads", formData);
    return toLegacyAttachment(res.data?.attachment || null);
  } catch (error: any) {
    throw error;
  }
};

export const getCallLogs = async ({
  conversationId,
  limit = 50,
}: {
  conversationId?: string;
  limit?: number;
} = {}): Promise<ChatCallLog[]> => {
  try {
    if (conversationId) {
      const res = await api.get(`/chat/conversations/${conversationId}/calls`, { params: { limit } });
      return Array.isArray(res.data?.calls) ? res.data.calls.map((row: any) => normalizeCallLog(row)) : [];
    }

    const rooms = await getMessengerConversations();
    const slicedRooms = rooms.slice(0, 5);
    const allRows = await Promise.all(
      slicedRooms.map((room) =>
        api
          .get(`/chat/conversations/${room._id}/calls`, { params: { limit: Math.max(5, Math.floor(limit / Math.max(slicedRooms.length, 1))) } })
          .then((res) => (Array.isArray(res.data?.calls) ? res.data.calls : []))
          .catch(() => []),
      ),
    );
    return allRows.flat().map((row: any) => normalizeCallLog(row));
  } catch (error) {
    if (isMissingRouteError(error)) {
      return [];
    }
    throw error;
  }
};

export const createCallLog = async ({
  conversationId,
  recipientId,
  callType,
  e2ee,
  metadata,
}: {
  conversationId?: string;
  recipientId?: string;
  callType: "VOICE" | "VIDEO";
  e2ee?: {
    enabled?: boolean;
    protocol?: string;
    senderKeyFingerprint?: string;
    receiverKeyFingerprint?: string;
  };
  metadata?: Record<string, unknown>;
}) => {
  if (!conversationId) {
    throw new Error("Conversation is required before starting a call");
  }

  try {
    const res = await api.post("/chat/calls", {
      conversationId,
      recipientId,
      callType,
      e2ee: e2ee || { enabled: true, protocol: "X25519-AES-256-GCM" },
      metadata: metadata || {},
    });
    return {
      call: (res.data?.call || null) as ChatCallLog | null,
      conversationId: String(res.data?.conversationId || ""),
    };
  } catch (error) {
    throw error;
  }
};

export const createMobileCallSession = async ({
  conversationId,
  recipientId,
  callType,
  e2ee,
  socket,
  createCallLog: createCallLogImpl = createCallLog,
}: {
  conversationId: string;
  recipientId?: string;
  callType: "VOICE" | "VIDEO";
  e2ee?: {
    enabled?: boolean;
    protocol?: string;
    senderKeyFingerprint?: string;
    receiverKeyFingerprint?: string;
  };
  socket?: {
    emit: (event: string, payload?: any, ack?: (payload: any) => void) => void;
  } | null;
  createCallLog?: typeof createCallLog;
}) => {
  const created = await createCallLogImpl({
    conversationId,
    recipientId,
    callType,
    e2ee,
  });
  const call = created.call || null;
  const stableCallId = String((call as any)?._id || (call as any)?.callId || "").trim();
  const stableConversationId = String(created.conversationId || conversationId || "").trim();
  if (!stableCallId || !stableConversationId) {
    throw new Error("Failed to create call");
  }

  socket?.emit("chat:call:initiate", {
    callId: stableCallId,
    conversationId: stableConversationId,
    mode: callType === "VIDEO" ? "video" : "audio",
  });
  socket?.emit("messenger:call:initiate", {
    callId: stableCallId,
    conversationId: stableConversationId,
    recipientId,
    callType,
    e2ee,
  });

  return {
    ...created,
    call,
    callId: stableCallId,
    conversationId: stableConversationId,
  };
};

export const updateCallLog = async ({
  callId,
  status,
  durationSec,
  metadata,
  e2ee,
}: {
  callId: string;
  status?: ChatCallLog["status"];
  durationSec?: number;
  metadata?: Record<string, unknown>;
  e2ee?: {
    enabled?: boolean;
    protocol?: string;
    senderKeyFingerprint?: string;
    receiverKeyFingerprint?: string;
  };
}) => {
  if (!callId) return null;

  try {
    const res = await api.patch(`/chat/calls/${callId}`, {
      status,
      durationSec,
      metadata,
      e2ee,
    });
    return (res.data?.call || null) as ChatCallLog | null;
  } catch (error) {
    throw error;
  }
};
