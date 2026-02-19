const jwt = require("jsonwebtoken");
const User = require("../models/User");
const {
  sendDirectMessage,
  sendRoomMessage,
  markMessageDelivered,
  markMessageSeen,
  markRoomAsRead,
  getRoomByIdForUser,
} = require("../services/chatRoom.service");
const { getTeamIdForUser } = require("../services/chatAccess.service");

const parseToken = (raw) => {
  if (typeof raw !== "string") return "";
  if (raw.startsWith("Bearer ")) return raw.slice(7).trim();
  return raw.trim();
};

const extractSocketToken = (socket) => {
  const authToken = parseToken(socket.handshake?.auth?.token);
  if (authToken) return authToken;

  const headerToken = parseToken(socket.handshake?.headers?.authorization);
  if (headerToken) return headerToken;

  const queryToken = parseToken(socket.handshake?.query?.token);
  return queryToken || "";
};

const sendAck = (ack, payload) => {
  if (typeof ack === "function") {
    ack(payload);
  }
};

const emitRealtimeMessageEvent = (io, payload) => {
  const participantIds = payload.participantIds || [];
  const roomId = payload.room?._id;

  if (roomId) {
    io.to(`room:${roomId}`).emit("chat:message:new", {
      room: payload.room,
      message: payload.message,
    });
  }

  participantIds.forEach((participantId) => {
    io.to(`user:${participantId}`).emit("chat:message:new", {
      room: payload.room,
      message: payload.message,
    });
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

const authenticateSocket = async (socket, next) => {
  try {
    const token = extractSocketToken(socket);
    if (!token) {
      return next(new Error("Unauthorized: token missing"));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password");

    if (!user || !user.isActive) {
      return next(new Error("Unauthorized: invalid user"));
    }

    socket.user = user;
    next();
  } catch {
    next(new Error("Unauthorized"));
  }
};

const registerChatSocketHandlers = (io) => {
  io.use(authenticateSocket);

  io.on("connection", (socket) => {
    const accessibleRoomIds = new Set();
    const activelyTypingRoomIds = new Set();

    const userRoom = `user:${socket.user._id}`;
    const roleRoom = `role:${socket.user.role}`;
    const companyId = socket.user.companyId ? String(socket.user.companyId) : null;
    const companyRoom = companyId ? `company:${companyId}` : null;
    const companyRoleRoom = companyId ? `company:${companyId}:role:${socket.user.role}` : null;
    const teamId = getTeamIdForUser(socket.user);
    const teamRoom = teamId ? `team:${teamId}` : null;

    socket.join(userRoom);
    socket.join(roleRoom);
    if (companyRoom) socket.join(companyRoom);
    if (companyRoleRoom) socket.join(companyRoleRoom);
    if (teamRoom) socket.join(teamRoom);

    socket.emit("chat:ready", {
      userId: socket.user._id,
      role: socket.user.role,
      companyId: companyId || null,
      teamId: teamId || null,
    });
    socket.emit("messenger:ready", { userId: socket.user._id });

    const resolveAccessibleRoomId = async (rawRoomId) => {
      const requestedRoomId = String(rawRoomId || "").trim();
      if (!requestedRoomId) {
        throw new Error("roomId is required");
      }

      if (accessibleRoomIds.has(requestedRoomId)) {
        return requestedRoomId;
      }

      const room = await getRoomByIdForUser({
        user: socket.user,
        roomId: requestedRoomId,
      });
      const resolvedRoomId = String(room?._id || requestedRoomId);
      accessibleRoomIds.add(requestedRoomId);
      accessibleRoomIds.add(resolvedRoomId);
      socket.join(`room:${resolvedRoomId}`);
      return resolvedRoomId;
    };

    socket.on("chat:room:join", async (payload = {}, ack) => {
      try {
        const roomId = await resolveAccessibleRoomId(payload.roomId);
        return sendAck(ack, { ok: true, roomId });
      } catch (error) {
        return sendAck(ack, {
          ok: false,
          error: error.message || "Failed to join room",
        });
      }
    });

    socket.on("chat:typing", async (payload = {}, ack) => {
      try {
        const roomId = await resolveAccessibleRoomId(payload.roomId || payload.conversationId);
        const isTyping = payload.isTyping !== false;
        const eventPayload = {
          roomId,
          userId: String(socket.user._id),
          isTyping,
          at: new Date().toISOString(),
        };

        if (isTyping) {
          activelyTypingRoomIds.add(roomId);
        } else {
          activelyTypingRoomIds.delete(roomId);
        }

        socket.to(`room:${roomId}`).emit("chat:typing", eventPayload);
        return sendAck(ack, { ok: true, ...eventPayload });
      } catch (error) {
        return sendAck(ack, {
          ok: false,
          error: error.message || "Failed to update typing state",
        });
      }
    });

    socket.on("chat:message:send", async (payload = {}, ack) => {
      try {
        const roomId = payload.roomId || payload.conversationId || null;
        const result = roomId
          ? await sendRoomMessage({
              sender: socket.user,
              roomId,
              text: payload.text,
              sharedProperty: payload.sharedProperty || null,
              mediaAttachments: payload.mediaAttachments || [],
            })
          : await sendDirectMessage({
              sender: socket.user,
              text: payload.text,
              recipientId: payload.recipientId,
              sharedProperty: payload.sharedProperty || null,
              mediaAttachments: payload.mediaAttachments || [],
            });

        const resultRoomId = String(result?.room?._id || "");
        if (resultRoomId) {
          accessibleRoomIds.add(resultRoomId);
          socket.join(`room:${resultRoomId}`);
          if (activelyTypingRoomIds.has(resultRoomId)) {
            activelyTypingRoomIds.delete(resultRoomId);
            socket.to(`room:${resultRoomId}`).emit("chat:typing", {
              roomId: resultRoomId,
              userId: String(socket.user._id),
              isTyping: false,
              at: new Date().toISOString(),
            });
          }
        }

        emitRealtimeMessageEvent(io, result);
        return sendAck(ack, {
          ok: true,
          room: result.room,
          message: result.message,
        });
      } catch (error) {
        return sendAck(ack, {
          ok: false,
          error: error.message || "Failed to send message",
        });
      }
    });

    socket.on("chat:message:delivered", async (payload = {}, ack) => {
      try {
        const result = await markMessageDelivered({
          user: socket.user,
          messageId: payload.messageId,
        });

        io.to(`room:${result.roomId}`).emit("chat:message:delivered", result);
        return sendAck(ack, { ok: true, ...result });
      } catch (error) {
        return sendAck(ack, {
          ok: false,
          error: error.message || "Failed to update delivery status",
        });
      }
    });

    socket.on("chat:message:seen", async (payload = {}, ack) => {
      try {
        const result = await markMessageSeen({
          user: socket.user,
          messageId: payload.messageId,
        });

        io.to(`room:${result.roomId}`).emit("chat:message:seen", result);
        return sendAck(ack, { ok: true, ...result });
      } catch (error) {
        return sendAck(ack, {
          ok: false,
          error: error.message || "Failed to update seen status",
        });
      }
    });

    socket.on("chat:room:read", async (payload = {}, ack) => {
      try {
        const room = await markRoomAsRead({
          user: socket.user,
          roomId: payload.roomId,
        });

        io.to(`room:${room._id}`).emit("chat:room:read", {
          roomId: room._id,
          userId: socket.user._id,
        });

        return sendAck(ack, { ok: true, room });
      } catch (error) {
        return sendAck(ack, {
          ok: false,
          error: error.message || "Failed to mark room as read",
        });
      }
    });

    socket.on("messenger:send", async (payload = {}, ack) => {
      try {
        const result = await sendDirectMessage({
          sender: socket.user,
          text: payload.text,
          roomId: payload.conversationId || payload.roomId || null,
          recipientId: payload.recipientId,
          sharedProperty: payload.sharedProperty || null,
          mediaAttachments: payload.mediaAttachments || [],
        });

        emitRealtimeMessageEvent(io, result);
        return sendAck(ack, {
          ok: true,
          conversation: result.room,
          message: result.message,
        });
      } catch (error) {
        return sendAck(ack, {
          ok: false,
          error: error.message || "Failed to send message",
        });
      }
    });

    socket.on("disconnect", () => {
      const userId = String(socket.user?._id || "");
      activelyTypingRoomIds.forEach((roomId) => {
        socket.to(`room:${roomId}`).emit("chat:typing", {
          roomId,
          userId,
          isTyping: false,
          at: new Date().toISOString(),
        });
      });
      activelyTypingRoomIds.clear();
    });
  });
};

module.exports = {
  registerChatSocketHandlers,
};
