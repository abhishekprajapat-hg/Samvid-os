const {
  getContactUsers,
  listRoomsForUser,
  createOrGetDirectRoom,
  createGroupRoom,
  createOrGetLeadRoom,
  sendDirectMessage,
  sendRoomMessage,
  getRoomMessages,
  markRoomAsRead,
  markMessageDelivered,
  markMessageSeen,
  listEscalationRooms,
  listEscalationLogs,
  toPositiveInt,
} = require("../services/chatRoom.service");
const {
  listConversationCallHistory,
} = require("../services/chatCall.service");

const emitRealtimeMessage = (io, payload) => {
  if (!io || !payload?.room || !payload?.message) return;

  const roomId = payload.room._id;
  const participantIds = payload.participantIds || [];
  const eventPayload = {
    room: payload.room,
    message: payload.message,
  };

  io.to(`room:${roomId}`).emit("chat:message:new", eventPayload);

  participantIds.forEach((participantId) => {
    io.to(`user:${participantId}`).emit("chat:message:new", eventPayload);
    io.to(`user:${participantId}`).emit("messenger:message:new", {
      conversation: payload.room,
      message: payload.message,
    });
  });

  if (payload.managerNotificationUserId) {
    io.to(`user:${payload.managerNotificationUserId}`).emit("chat:escalation:notified", {
      room: payload.room,
      message: payload.message,
    });
  }
};

const handleControllerError = (res, error, fallbackMessage) => {
  const isCastError =
    error?.name === "CastError"
    || error?.name === "BSONTypeError"
    || /cast to objectid/i.test(String(error?.message || ""));

  const statusCode = error.statusCode || (isCastError ? 400 : 500);
  const message = statusCode >= 500 ? fallbackMessage : error.message;

  if (statusCode >= 500) {
    console.error(fallbackMessage, error);
  }

  return res.status(statusCode).json({ message });
};

exports.getContacts = async (req, res) => {
  try {
    const contacts = await getContactUsers(req.user);
    return res.json({
      count: contacts.length,
      contacts,
    });
  } catch (error) {
    return handleControllerError(res, error, "Failed to load contacts");
  }
};

exports.getRooms = async (req, res) => {
  try {
    const type = req.query?.type || null;
    const rooms = await listRoomsForUser({ user: req.user, type });
    return res.json({
      count: rooms.length,
      rooms,
    });
  } catch (error) {
    return handleControllerError(res, error, "Failed to load chat rooms");
  }
};

exports.createDirectRoom = async (req, res) => {
  try {
    const result = await createOrGetDirectRoom({
      initiator: req.user,
      recipientId: req.body?.recipientId,
    });

    if (result.managerNotificationUserId) {
      req.app.get("io")?.to(`user:${result.managerNotificationUserId}`).emit(
        "chat:escalation:notified",
        { room: result.room },
      );
    }

    return res.status(201).json({
      room: result.room,
      managerNotificationUserId: result.managerNotificationUserId || null,
    });
  } catch (error) {
    return handleControllerError(res, error, "Failed to create direct room");
  }
};

exports.createGroup = async (req, res) => {
  try {
    const room = await createGroupRoom({
      creator: req.user,
      name: req.body?.name,
      participantIds: req.body?.participantIds || [],
      teamId: req.body?.teamId || null,
    });

    return res.status(201).json({ room });
  } catch (error) {
    return handleControllerError(res, error, "Failed to create group chat");
  }
};

exports.createLeadRoom = async (req, res) => {
  try {
    const room = await createOrGetLeadRoom({
      creator: req.user,
      leadId: req.body?.leadId,
    });

    return res.status(201).json({ room });
  } catch (error) {
    return handleControllerError(res, error, "Failed to create lead chat");
  }
};

exports.getRoomMessages = async (req, res) => {
  try {
    const messages = await getRoomMessages({
      user: req.user,
      roomId: req.params.roomId,
      limit: toPositiveInt(req.query.limit, 60, 200),
      before: req.query.before,
    });

    return res.json({
      count: messages.length,
      messages,
    });
  } catch (error) {
    return handleControllerError(res, error, "Failed to load room messages");
  }
};

exports.sendRoomMessage = async (req, res) => {
  try {
    const payload = await sendRoomMessage({
      sender: req.user,
      roomId: req.params.roomId,
      text: req.body?.text,
      sharedProperty: req.body?.sharedProperty || null,
      mediaAttachments: req.body?.mediaAttachments || [],
    });

    emitRealtimeMessage(req.app.get("io"), payload);
    return res.status(201).json(payload);
  } catch (error) {
    return handleControllerError(res, error, "Failed to send message");
  }
};

exports.markRoomRead = async (req, res) => {
  try {
    const room = await markRoomAsRead({
      user: req.user,
      roomId: req.params.roomId,
    });

    req.app.get("io")?.to(`room:${room._id}`).emit("chat:room:read", {
      roomId: room._id,
      userId: req.user._id,
    });

    return res.json({ room });
  } catch (error) {
    return handleControllerError(res, error, "Failed to mark room as read");
  }
};

exports.markDelivered = async (req, res) => {
  try {
    const payload = await markMessageDelivered({
      user: req.user,
      messageId: req.params.messageId,
    });

    req.app.get("io")?.to(`room:${payload.roomId}`).emit("chat:message:delivered", payload);
    return res.json(payload);
  } catch (error) {
    return handleControllerError(res, error, "Failed to update delivery status");
  }
};

exports.markSeen = async (req, res) => {
  try {
    const payload = await markMessageSeen({
      user: req.user,
      messageId: req.params.messageId,
    });

    req.app.get("io")?.to(`room:${payload.roomId}`).emit("chat:message:seen", payload);
    return res.json(payload);
  } catch (error) {
    return handleControllerError(res, error, "Failed to update seen status");
  }
};

exports.getEscalations = async (req, res) => {
  try {
    const rooms = await listEscalationRooms({ user: req.user });
    return res.json({ count: rooms.length, rooms });
  } catch (error) {
    return handleControllerError(res, error, "Failed to load escalations");
  }
};

exports.getEscalationLogs = async (req, res) => {
  try {
    const logs = await listEscalationLogs({
      user: req.user,
      roomId: req.params?.roomId || null,
      limit: req.query?.limit,
    });

    return res.json({ count: logs.length, logs });
  } catch (error) {
    return handleControllerError(res, error, "Failed to load escalation logs");
  }
};

// Legacy compatibility endpoints
exports.getConversations = async (req, res) => {
  try {
    const rooms = await listRoomsForUser({ user: req.user, type: null });
    return res.json({
      count: rooms.length,
      conversations: rooms,
    });
  } catch (error) {
    return handleControllerError(res, error, "Failed to load conversations");
  }
};

exports.getConversationMessages = async (req, res) => {
  try {
    const messages = await getRoomMessages({
      user: req.user,
      roomId: req.params.conversationId,
      limit: toPositiveInt(req.query.limit, 60, 200),
      before: req.query.before,
    });

    return res.json({
      count: messages.length,
      messages,
    });
  } catch (error) {
    return handleControllerError(res, error, "Failed to load messages");
  }
};

exports.getConversationCalls = async (req, res) => {
  try {
    const calls = await listConversationCallHistory({
      user: req.user,
      roomId: req.params.conversationId,
      limit: req.query?.limit,
    });

    return res.json({
      count: calls.length,
      calls,
    });
  } catch (error) {
    return handleControllerError(res, error, "Failed to load call history");
  }
};

exports.sendMessage = async (req, res) => {
  try {
    const payload = await sendDirectMessage({
      sender: req.user,
      text: req.body?.text,
      roomId: req.body?.conversationId || req.body?.roomId || null,
      recipientId: req.body?.recipientId || null,
      sharedProperty: req.body?.sharedProperty || null,
      mediaAttachments: req.body?.mediaAttachments || [],
    });

    emitRealtimeMessage(req.app.get("io"), payload);
    return res.status(201).json({
      ...payload,
      conversation: payload.room,
    });
  } catch (error) {
    return handleControllerError(res, error, "Failed to send message");
  }
};
