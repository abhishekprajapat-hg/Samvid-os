import api from "./api";

export const getMessengerContacts = async () => {
  const res = await api.get("/chat/contacts");
  return res.data?.contacts || [];
};

export const getMessengerConversations = async () => {
  const res = await api.get("/chat/conversations");
  return res.data?.conversations || [];
};

export const getConversationMessages = async ({ conversationId, limit = 80, before } = {}) => {
  if (!conversationId) return [];

  const params = { limit };
  if (before) params.before = before;

  const res = await api.get(`/chat/conversations/${conversationId}/messages`, { params });
  return res.data?.messages || [];
};

export const markConversationRead = async (conversationId) => {
  const id = String(conversationId || "").trim();
  if (!id) return null;

  const res = await api.patch(`/chat/rooms/${id}/read`);
  return res.data?.room || null;
};

export const markMessageDelivered = async (messageId) => {
  const id = String(messageId || "").trim();
  if (!id) return null;

  const res = await api.patch(`/chat/messages/${id}/delivered`);
  return res.data?.message || null;
};

export const markMessageSeen = async (messageId) => {
  const id = String(messageId || "").trim();
  if (!id) return null;

  const res = await api.patch(`/chat/messages/${id}/seen`);
  return res.data?.message || null;
};

export const sendDirectMessage = async ({
  text,
  conversationId,
  recipientId,
  sharedProperty,
  mediaAttachments,
}) => {
  const payload = {};
  if (typeof text === "string") payload.text = text;
  if (conversationId) payload.conversationId = conversationId;
  if (recipientId) payload.recipientId = recipientId;
  if (sharedProperty) payload.sharedProperty = sharedProperty;
  if (Array.isArray(mediaAttachments) && mediaAttachments.length > 0) {
    payload.mediaAttachments = mediaAttachments;
  }

  const res = await api.post("/chat/messages", payload);
  return {
    conversation: res.data?.conversation || null,
    message: res.data?.message || null,
  };
};
