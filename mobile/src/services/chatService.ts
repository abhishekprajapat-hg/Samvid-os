import api from "./api";
import { sessionStorage } from "../storage/sessionStorage";
import type { ChatCallLog, ChatContact, ChatConversation, ChatMessage } from "../types";

const isMissingRouteError = (error: unknown) => {
  const status = (error as { response?: { status?: number } })?.response?.status;
  return status === 404;
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
  return res.data?.contacts || [];
};

export const getMessengerConversations = async (): Promise<ChatConversation[]> => {
  const res = await api.get("/chat/conversations");
  return res.data?.conversations || [];
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

  const res = await api.get(`/chat/conversations/${conversationId}/messages`, { params });
  return res.data?.messages || [];
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
  if (attachment) payload.attachment = attachment;

  const res = await api.post("/chat/messages", payload);
  return {
    conversation: res.data?.conversation || null,
    message: res.data?.message || null,
  };
};

export const uploadChatFile = async ({
  uri,
  name,
  mimeType,
}: {
  uri: string;
  name: string;
  mimeType?: string;
}) => {
  const formData = new FormData();
  formData.append("file", {
    uri,
    name,
    type: mimeType || "application/octet-stream",
  } as any);

  try {
    const res = await api.post("/chat/uploads", formData);
    return res.data?.attachment || null;
  } catch (error: any) {
    const isNetworkError = String(error?.message || "").toLowerCase().includes("network");
    if (!isNetworkError) throw error;

    const token = await sessionStorage.getToken();
    const baseUrl = String(api.defaults.baseURL || "").replace(/\/$/, "");
    const response = await fetch(`${baseUrl}/chat/uploads`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: formData as any,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(String(data?.message || "File upload failed"));
    }
    return data?.attachment || null;
  }
};

export const getCallLogs = async ({
  conversationId,
  limit = 50,
}: {
  conversationId?: string;
  limit?: number;
} = {}): Promise<ChatCallLog[]> => {
  const params: Record<string, string | number> = { limit };
  if (conversationId) params.conversationId = conversationId;

  try {
    const res = await api.get("/chat/calls", { params });
    return res.data?.calls || [];
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
    if (isMissingRouteError(error)) {
      return {
        call: createLocalCallLog({
          conversationId,
          recipientId,
          callType,
          e2ee,
          metadata,
        }),
        conversationId: String(conversationId || ""),
      };
    }
    throw error;
  }
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
  try {
    const res = await api.patch(`/chat/calls/${callId}`, {
      status,
      durationSec,
      metadata,
      e2ee,
    });
    return (res.data?.call || null) as ChatCallLog | null;
  } catch (error) {
    if (isMissingRouteError(error)) {
      return null;
    }
    throw error;
  }
};
