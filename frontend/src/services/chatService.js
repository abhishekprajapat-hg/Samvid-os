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

export const sendDirectMessage = async ({ text, conversationId, recipientId }) => {
  const payload = { text };
  if (conversationId) payload.conversationId = conversationId;
  if (recipientId) payload.recipientId = recipientId;

  const res = await api.post("/chat/messages", payload);
  return {
    conversation: res.data?.conversation || null,
    message: res.data?.message || null,
  };
};
