const ChatConversation = require("../models/ChatConversation");
const ChatMessage = require("../models/ChatMessage");
const User = require("../models/User");

const EXECUTIVE_ROLES = ["EXECUTIVE", "FIELD_EXECUTIVE"];
const ADMIN_ROLE = "ADMIN";
const MANAGER_ROLE = "MANAGER";

const ROLE_LABELS = {
  ADMIN: "Admin",
  MANAGER: "Manager",
  EXECUTIVE: "Executive",
  FIELD_EXECUTIVE: "Field Executive",
  CHANNEL_PARTNER: "Channel Partner",
};

const toPositiveInt = (value, fallback, max) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
};

const sanitizeText = (value) => {
  if (typeof value !== "string") return "";
  return value.trim();
};

const toRoleLabel = (role) => ROLE_LABELS[role] || role;

const toUserDto = (user) => ({
  _id: user._id,
  name: user.name,
  role: user.role,
  roleLabel: toRoleLabel(user.role),
});

const toConversationDto = (conversation) => ({
  _id: conversation._id,
  participants: (conversation.participants || []).map((p) => toUserDto(p)),
  lastMessage: conversation.lastMessage || "",
  lastMessageAt: conversation.lastMessageAt || conversation.updatedAt,
  lastMessageSender: conversation.lastMessageSender || null,
  createdAt: conversation.createdAt,
  updatedAt: conversation.updatedAt,
});

const toMessageDto = (message) => ({
  _id: message._id,
  conversation: message.conversation,
  sender: message.sender ? toUserDto(message.sender) : null,
  text: message.text,
  createdAt: message.createdAt,
  updatedAt: message.updatedAt,
});

const sortByName = (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" });

const toObjectIdString = (id) => String(id || "");

const buildParticipantHash = (idA, idB) => {
  const [a, b] = [toObjectIdString(idA), toObjectIdString(idB)].sort();
  return `${a}:${b}`;
};

const buildContactCriteria = (user) => {
  if (user.role === ADMIN_ROLE) {
    return {
      isActive: true,
      role: MANAGER_ROLE,
    };
  }

  if (user.role === MANAGER_ROLE) {
    return {
      isActive: true,
      $or: [
        { role: ADMIN_ROLE },
        { role: MANAGER_ROLE },
        { role: { $in: EXECUTIVE_ROLES }, parentId: user._id },
      ],
    };
  }

  if (EXECUTIVE_ROLES.includes(user.role)) {
    if (!user.parentId) {
      return { _id: null };
    }

    return {
      isActive: true,
      $or: [
        { role: MANAGER_ROLE, _id: user.parentId },
        { role: { $in: EXECUTIVE_ROLES }, parentId: user.parentId },
      ],
    };
  }

  return { _id: null };
};

const ensureCanTalkToRecipient = async (user, recipientId) => {
  const recipientIdString = toObjectIdString(recipientId);
  if (!recipientIdString) {
    throw new Error("Recipient is required");
  }
  if (recipientIdString === toObjectIdString(user._id)) {
    throw new Error("Cannot message yourself");
  }

  const criteria = buildContactCriteria(user);
  const recipient = await User.findOne({
    ...criteria,
    _id: recipientId,
    isActive: true,
  })
    .select("_id name role")
    .lean();

  if (!recipient) {
    throw new Error("You are not allowed to message this user");
  }

  return recipient;
};

const getOrCreateConversationByRecipient = async ({ user, recipientId }) => {
  const recipient = await ensureCanTalkToRecipient(user, recipientId);
  const hash = buildParticipantHash(user._id, recipient._id);

  let conversation = await ChatConversation.findOne({ participantHash: hash })
    .populate("participants", "name role")
    .lean();

  if (!conversation) {
    const created = await ChatConversation.create({
      participants: [user._id, recipient._id],
      participantHash: hash,
      lastMessage: "",
      lastMessageAt: new Date(),
      lastMessageSender: null,
    });

    conversation = await ChatConversation.findById(created._id)
      .populate("participants", "name role")
      .lean();
  }

  return conversation;
};

const getConversationForUser = async ({ user, conversationId }) => {
  const conversation = await ChatConversation.findOne({
    _id: conversationId,
    participants: user._id,
  })
    .populate("participants", "name role")
    .lean();

  if (!conversation) {
    throw new Error("Conversation not found");
  }

  const otherParticipant = (conversation.participants || []).find(
    (participant) => toObjectIdString(participant._id) !== toObjectIdString(user._id),
  );

  if (otherParticipant) {
    await ensureCanTalkToRecipient(user, otherParticipant._id);
  }

  return conversation;
};

const resolveConversationForSend = async ({ user, conversationId, recipientId }) => {
  if (conversationId) {
    return getConversationForUser({ user, conversationId });
  }

  return getOrCreateConversationByRecipient({ user, recipientId });
};

const touchConversation = async ({ conversationId, senderId, text }) => {
  await ChatConversation.updateOne(
    { _id: conversationId },
    {
      $set: {
        lastMessage: text,
        lastMessageAt: new Date(),
        lastMessageSender: senderId,
      },
    },
  );
};

const getContactUsers = async (user) => {
  const criteria = buildContactCriteria(user);

  const users = await User.find({
    ...criteria,
    isActive: true,
    _id: { $ne: user._id },
  })
    .select("_id name role")
    .lean();

  return users.map(toUserDto).sort(sortByName);
};

const getUserConversations = async (user) => {
  const allowedContacts = await getContactUsers(user);
  const allowedContactSet = new Set(
    allowedContacts.map((contact) => toObjectIdString(contact._id)),
  );

  const conversations = await ChatConversation.find({
    participants: user._id,
  })
    .sort({ lastMessageAt: -1, updatedAt: -1 })
    .populate("participants", "name role")
    .lean();

  return conversations
    .filter((conversation) => {
      const otherParticipant = (conversation.participants || []).find(
        (participant) => toObjectIdString(participant._id) !== toObjectIdString(user._id),
      );
      if (!otherParticipant) return false;
      return allowedContactSet.has(toObjectIdString(otherParticipant._id));
    })
    .map(toConversationDto);
};

const getConversationMessages = async ({ user, conversationId, limit, before }) => {
  const conversation = await getConversationForUser({ user, conversationId });
  const resolvedLimit = toPositiveInt(limit, 60, 200);

  const query = { conversation: conversation._id };
  if (before) {
    const beforeDate = new Date(before);
    if (!Number.isNaN(beforeDate.getTime())) {
      query.createdAt = { $lt: beforeDate };
    }
  }

  const rows = await ChatMessage.find(query)
    .sort({ createdAt: -1 })
    .limit(resolvedLimit)
    .populate("sender", "name role")
    .lean();

  return rows.reverse().map(toMessageDto);
};

const sendDirectMessage = async ({ user, text, conversationId, recipientId }) => {
  const cleanText = sanitizeText(text);
  if (!cleanText) {
    throw new Error("Message text is required");
  }
  if (cleanText.length > 1200) {
    throw new Error("Message too long (max 1200 chars)");
  }

  const conversation = await resolveConversationForSend({
    user,
    conversationId,
    recipientId,
  });

  const created = await ChatMessage.create({
    conversation: conversation._id,
    sender: user._id,
    text: cleanText,
  });

  await touchConversation({
    conversationId: conversation._id,
    senderId: user._id,
    text: cleanText,
  });

  const [savedMessage, updatedConversation] = await Promise.all([
    ChatMessage.findById(created._id)
      .populate("sender", "name role")
      .lean(),
    ChatConversation.findById(conversation._id)
      .populate("participants", "name role")
      .lean(),
  ]);

  const conversationDto = toConversationDto(updatedConversation);
  const messageDto = toMessageDto(savedMessage);

  return {
    conversation: conversationDto,
    message: messageDto,
    participantIds: conversationDto.participants.map((participant) => participant._id),
  };
};

module.exports = {
  getContactUsers,
  getUserConversations,
  getConversationMessages,
  sendDirectMessage,
  toPositiveInt,
};
