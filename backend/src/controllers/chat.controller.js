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
  deleteMessageForUser,
  clearRoomMessagesForUser,
  listEscalationRooms,
  listEscalationLogs,
  toPositiveInt,
} = require("../services/chatRoom.service");
const User = require("../models/User");
// notify() is already fire-and-forget: a slow push service must not delay a message.
const { notify } = require("../services/push.service");
const { signPushReplyToken, verifyPushReplyToken } = require("../utils/pushReplyToken");

const emitRealtimeMessage = (io, payload) => {
  if (!payload?.room || !payload?.message) return;

  const roomId = payload.room._id;
  const participantIds = payload.participantIds || [];

  /*
   * Push runs whether or not a socket server is present, and goes to everyone
   * except the sender - their own phone buzzing for a message they just typed
   * is the fastest way to get notifications turned off.
   */
  const senderId = String(payload.message.sender?._id || payload.message.sender || "");
  const senderName = payload.message.sender?.name || "New message";
  const preview = String(payload.message.text || payload.message.content || "").trim();
  // One notification per conversation that updates, not one per message.
  const tag = `chat:${roomId}`;
  try {
    participantIds
      .filter((id) => String(id) !== senderId)
      .forEach((recipientId) => {
        /*
         * Minted per recipient rather than once for the room: the token carries
         * who is replying, so one shared token would let any recipient post as
         * any other.
         */
        notify(recipientId, {
          title: senderName,
          body: preview ? preview.slice(0, 160) : "Sent you a message",
          url: "/chat",
          tag,
          data: { tag, replyToken: signPushReplyToken({ userId: recipientId, roomId }) },
        });
      });
  } catch {
    /*
     * Signing is the only part of this that can throw synchronously, and push
     * is best-effort by design: a message still has to send and still has to
     * reach everyone's open sockets below.
     */
  }

  if (!io) return;
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
    const rooms = await listRoomsForUser({
      user: req.user,
      type,
      limit: req.query?.limit,
    });
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

/*
 * A reply typed straight into the notification drawer, without opening the app.
 *
 * This one is mounted above `protect` because a service worker has no session
 * to send: the access token lives in localStorage, which no worker can read.
 * It authenticates on the single-purpose token that arrived inside the push
 * payload instead (see utils/pushReplyToken). That token fixes both who is
 * replying and which room, so nothing here trusts the request body beyond the
 * text itself.
 */
exports.replyFromNotification = async (req, res) => {
  const claims = verifyPushReplyToken(req.body?.token);
  if (!claims) {
    return res.status(401).json({ message: "This notification has expired. Open the app to reply." });
  }

  const text = String(req.body?.text || "").trim();
  if (!text) {
    return res.status(400).json({ message: "A reply cannot be empty" });
  }

  try {
    const sender = await User.findById(claims.userId).select("-password");
    if (!sender || !sender.isActive) {
      return res.status(401).json({ message: "This account can no longer send messages" });
    }

    /*
     * Deliberately the same service call as a reply typed inside the app, so
     * room membership, broadcast rules and escalation logging all still apply.
     * A reply from the drawer is a normal message, not a privileged side door.
     */
    const payload = await sendRoomMessage({ sender, roomId: claims.roomId, text });
    emitRealtimeMessage(req.app.get("io"), payload);
    return res.status(201).json({ message: "Reply sent" });
  } catch (error) {
    return handleControllerError(res, error, "Failed to send reply");
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

exports.deleteMessage = async (req, res) => {
  try {
    const payload = await deleteMessageForUser({
      user: req.user,
      messageId: req.params.messageId,
      scope: req.body?.scope || "self",
    });

    const io = req.app.get("io");
    const eventPayload = {
      roomId: payload.roomId,
      messageId: payload.messageId,
      scope: payload.scope,
      deletedBy: payload.deletedBy,
      deletedAt: payload.deletedAt,
      room: payload.room || null,
    };

    if (payload.scope === "everyone") {
      io?.to(`room:${payload.roomId}`).emit("chat:message:deleted", eventPayload);
      (payload.participantIds || []).forEach((participantId) => {
        io?.to(`user:${participantId}`).emit("chat:message:deleted", eventPayload);
      });
    } else {
      io?.to(`user:${req.user._id}`).emit("chat:message:deleted", eventPayload);
    }

    return res.json(payload);
  } catch (error) {
    return handleControllerError(res, error, "Failed to delete message");
  }
};

exports.clearRoomMessages = async (req, res) => {
  try {
    const payload = await clearRoomMessagesForUser({
      user: req.user,
      roomId: req.params.roomId,
    });

    req.app.get("io")?.to(`user:${req.user._id}`).emit("chat:room:cleared", {
      roomId: payload.roomId,
      userId: payload.userId,
      clearedAt: payload.clearedAt,
      room: payload.room || null,
    });

    return res.json(payload);
  } catch (error) {
    return handleControllerError(res, error, "Failed to clear room chat");
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
    const rooms = await listRoomsForUser({
      user: req.user,
      type: null,
      limit: req.query?.limit,
    });
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
