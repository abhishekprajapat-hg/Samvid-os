const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Company = require("../models/Company");
const { USER_ROLES } = require("../constants/role.constants");
const {
  sendDirectMessage,
  sendRoomMessage,
  markMessageDelivered,
  markMessageSeen,
  markRoomAsRead,
  getRoomByIdForUser,
} = require("../services/chatRoom.service");
const {
  startCallForUserWithId,
  updateCallForUser,
  getAuthorizedCallSignalContext,
} = require("../services/chatCall.service");
const { getTeamIdForUser } = require("../services/chatAccess.service");

const toId = (value) => String(value || "").trim();
const SOCKET_TYPING_THROTTLE_MS =
  Number.parseInt(process.env.SOCKET_TYPING_THROTTLE_MS, 10) || 700;
const SOCKET_RECEIPT_THROTTLE_MS =
  Number.parseInt(process.env.SOCKET_RECEIPT_THROTTLE_MS, 10) || 1200;

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

const emitToCallParticipants = (io, participantIds = [], eventName, payload, options = {}) => {
  const skipUserId = toId(options.skipUserId);
  participantIds
    .map((participantId) => toId(participantId?._id || participantId))
    .filter(Boolean)
    .filter((participantId) => participantId !== skipUserId)
    .forEach((participantId) => {
      io.to(`user:${participantId}`).emit(eventName, payload);
    });
};

const authenticateSocket = async (socket, next) => {
  try {
    const token = extractSocketToken(socket);
    if (!token) {
      return next(new Error("Unauthorized: token missing"));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id)
      .select("_id name role parentId companyId isActive")
      .lean();

    if (!user || !user.isActive) {
      return next(new Error("Unauthorized: invalid user"));
    }

    if (user.role !== USER_ROLES.SUPER_ADMIN) {
      if (!user.companyId) {
        return next(new Error("Unauthorized: company missing"));
      }
      const company = await Company.findById(user.companyId).select("_id status").lean();
      if (company?.status !== "ACTIVE") {
        return next(new Error("Unauthorized: company inactive"));
      }
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
    const lastEventAtByKey = new Map();
    const typingStateByRoom = new Map();

    const userRoom = `user:${socket.user._id}`;
    const companyId = socket.user.companyId ? String(socket.user.companyId) : null;
    const companyRoom = companyId ? `company:${companyId}` : null;
    const companyRoleRoom = companyId ? `company:${companyId}:role:${socket.user.role}` : null;
    const teamId = getTeamIdForUser(socket.user);
    const teamRoom = teamId ? `team:${teamId}` : null;

    socket.join(userRoom);
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

    const resolveAccessibleRoom = async (rawRoomId, options = {}) => {
      const requestedRoomId = toId(rawRoomId);
      if (!requestedRoomId) {
        throw new Error("roomId is required");
      }

      const room = await getRoomByIdForUser({
        user: socket.user,
        roomId: requestedRoomId,
        requireParticipantForSend: options.requireParticipantForSend === true,
      });

      const resolvedRoomId = toId(room?._id || requestedRoomId);
      accessibleRoomIds.add(requestedRoomId);
      accessibleRoomIds.add(resolvedRoomId);
      socket.join(`room:${resolvedRoomId}`);
      return room;
    };

    const resolveAccessibleRoomId = async (rawRoomId) => {
      const requestedRoomId = toId(rawRoomId);
      if (accessibleRoomIds.has(requestedRoomId)) {
        return requestedRoomId;
      }

      const room = await resolveAccessibleRoom(requestedRoomId);
      return toId(room?._id || requestedRoomId);
    };

    const shouldProcessThrottledEvent = (key, windowMs) => {
      const now = Date.now();
      const previousAt = lastEventAtByKey.get(key) || 0;
      if (now - previousAt < windowMs) return false;
      lastEventAtByKey.set(key, now);
      if (lastEventAtByKey.size > 500) {
        lastEventAtByKey.clear();
      }
      return true;
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
        const previousTypingState = typingStateByRoom.get(roomId);
        if (
          previousTypingState === isTyping
          && !shouldProcessThrottledEvent(
            `typing:${roomId}:${isTyping ? "1" : "0"}`,
            SOCKET_TYPING_THROTTLE_MS,
          )
        ) {
          return sendAck(ack, {
            ok: true,
            roomId,
            userId: String(socket.user._id),
            isTyping,
          });
        }

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
        typingStateByRoom.set(roomId, isTyping);

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
        const messageId = toId(payload.messageId);
        if (
          messageId
          && !shouldProcessThrottledEvent(
            `delivered:${messageId}`,
            SOCKET_RECEIPT_THROTTLE_MS,
          )
        ) {
          return sendAck(ack, { ok: true, throttled: true });
        }
        const result = await markMessageDelivered({
          user: socket.user,
          messageId,
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
        const messageId = toId(payload.messageId);
        if (
          messageId
          && !shouldProcessThrottledEvent(
            `seen:${messageId}`,
            SOCKET_RECEIPT_THROTTLE_MS,
          )
        ) {
          return sendAck(ack, { ok: true, throttled: true });
        }
        const result = await markMessageSeen({
          user: socket.user,
          messageId,
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

    socket.on("chat:call:initiate", async (payload = {}, ack) => {
      try {
        const result = await startCallForUserWithId({
          user: socket.user,
          roomId: payload.roomId || payload.conversationId,
          callId: payload.callId,
          mode: payload.mode || payload.callType,
        });
        const participantIds = (result.call.participants || []).map((participant) => participant._id);
        const eventPayload = {
          callId: result.call._id,
          roomId: result.conversationId,
          conversationId: result.conversationId,
          mode: result.call.mode,
          callType: result.call.mode === "video" ? "VIDEO" : "VOICE",
          caller: result.call.caller,
          call: result.call,
        };

        emitToCallParticipants(io, participantIds, "chat:call:incoming", eventPayload, {
          skipUserId: socket.user._id,
        });
        emitToCallParticipants(io, participantIds, "messenger:call:incoming", eventPayload, {
          skipUserId: socket.user._id,
        });
        return sendAck(ack, { ok: true, ...result });
      } catch (error) {
        return sendAck(ack, {
          ok: false,
          error: error.message || "Failed to start call",
        });
      }
    });

    socket.on("messenger:call:initiate", async (payload = {}, ack) => {
      try {
        const result = await startCallForUserWithId({
          user: socket.user,
          roomId: payload.roomId || payload.conversationId,
          callId: payload.callId,
          mode: payload.mode || payload.callType,
        });
        const participantIds = (result.call.participants || []).map((participant) => participant._id);
        const eventPayload = {
          callId: result.call._id,
          roomId: result.conversationId,
          conversationId: result.conversationId,
          mode: result.call.mode,
          callType: result.call.mode === "video" ? "VIDEO" : "VOICE",
          caller: result.call.caller,
          call: result.call,
        };

        emitToCallParticipants(io, participantIds, "chat:call:incoming", eventPayload, {
          skipUserId: socket.user._id,
        });
        emitToCallParticipants(io, participantIds, "messenger:call:incoming", eventPayload, {
          skipUserId: socket.user._id,
        });
        return sendAck(ack, { ok: true, ...result });
      } catch (error) {
        return sendAck(ack, {
          ok: false,
          error: error.message || "Failed to start call",
        });
      }
    });

    const relayCallSignal = async (payload = {}, ack) => {
      try {
        const targetUserId = payload.targetUserId || payload.recipientId || payload.toUserId;
        const context = await getAuthorizedCallSignalContext({
          user: socket.user,
          callId: payload.callId,
          roomId: payload.roomId || payload.conversationId,
          targetUserId,
          signal: payload.signalType
            ? {
                type: payload.signalType,
                ...(payload.signal && typeof payload.signal === "object" ? payload.signal : {}),
                candidate: payload.signalType === "ice-candidate" ? payload.signal : payload.signal?.candidate,
              }
            : payload.signal,
        });

        const chatPayload = {
          callId: context.call._id,
          roomId: toId(context.room._id),
          conversationId: toId(context.room._id),
          fromUserId: context.senderId,
          toUserId: context.targetUserId,
          signal: context.signal,
          call: context.call,
        };
        const messengerPayload = {
          ...chatPayload,
          recipientId: context.targetUserId,
          signalType: context.signal.type === "candidate" ? "ice-candidate" : context.signal.type,
        };

        io.to(`user:${context.targetUserId}`).emit("chat:call:signal", chatPayload);
        io.to(`user:${context.targetUserId}`).emit("messenger:call:signal", messengerPayload);
        return sendAck(ack, { ok: true, ...chatPayload });
      } catch (error) {
        return sendAck(ack, {
          ok: false,
          error: error.message || "Failed to relay call signal",
        });
      }
    };

    socket.on("chat:call:signal", relayCallSignal);
    socket.on("messenger:call:signal", relayCallSignal);

    const updateCall = async (payload = {}, ack, status) => {
      try {
        const result = await updateCallForUser({
          user: socket.user,
          callId: payload.callId,
          status,
          reason: payload.reason,
        });
        const eventName =
          status === "ACCEPTED"
            ? "chat:call:accepted"
            : status === "REJECTED"
              ? "chat:call:rejected"
              : "chat:call:ended";

        const eventPayload = {
          callId: result.call._id,
          roomId: result.conversationId,
          conversationId: result.conversationId,
          status: result.call.status,
          call: result.call,
        };
        const participantIds = (result.call.participants || []).map((participant) => participant._id);
        emitToCallParticipants(io, participantIds, eventName, eventPayload);
        emitToCallParticipants(io, participantIds, "messenger:call:update", eventPayload);
        return sendAck(ack, { ok: true, ...result });
      } catch (error) {
        return sendAck(ack, {
          ok: false,
          error: error.message || "Failed to update call",
        });
      }
    };

    socket.on("chat:call:accept", (payload = {}, ack) => updateCall(payload, ack, "ACCEPTED"));
    socket.on("chat:call:reject", (payload = {}, ack) => updateCall(payload, ack, "REJECTED"));
    socket.on("chat:call:end", (payload = {}, ack) => updateCall(payload, ack, "ENDED"));
    socket.on("messenger:call:update", (payload = {}, ack) => {
      const status = String(payload.status || "").trim().toUpperCase();
      if (status === "ACCEPTED" || status === "CONNECTED") return updateCall(payload, ack, "ACCEPTED");
      if (status === "REJECTED" || status === "MISSED" || status === "FAILED") {
        return updateCall(payload, ack, status);
      }
      return updateCall(payload, ack, "ENDED");
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
      typingStateByRoom.clear();
      lastEventAtByKey.clear();
    });
  });
};

module.exports = {
  registerChatSocketHandlers,
};
