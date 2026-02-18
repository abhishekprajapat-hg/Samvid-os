const {
  createBroadcastMessage,
  listRoomsForUser,
} = require("../services/chatRoom.service");
const { CHAT_ROOM_TYPES } = require("../constants/chat.constants");

const handleControllerError = (res, error, fallbackMessage) => {
  const statusCode = error.statusCode || 500;
  const message = statusCode >= 500 ? fallbackMessage : error.message;

  if (statusCode >= 500) {
    console.error(fallbackMessage, error);
  }

  return res.status(statusCode).json({ message });
};

const emitBroadcastRealtime = (io, payload) => {
  if (!io || !payload?.room || !payload?.message) return;

  const eventPayload = {
    room: payload.room,
    message: payload.message,
  };

  io.to(`room:${payload.room._id}`).emit("chat:message:new", eventPayload);
  (payload.participantIds || []).forEach((userId) => {
    io.to(`user:${userId}`).emit("chat:broadcast:new", eventPayload);
  });
};

exports.createBroadcast = async (req, res) => {
  try {
    const payload = await createBroadcastMessage({
      creator: req.user,
      text: req.body?.text,
      targetRole: req.body?.targetRole || null,
      targetTeamId: req.body?.targetTeamId || null,
    });

    emitBroadcastRealtime(req.app.get("io"), payload);
    return res.status(201).json(payload);
  } catch (error) {
    return handleControllerError(res, error, "Failed to create broadcast");
  }
};

exports.getBroadcastRooms = async (req, res) => {
  try {
    const rooms = await listRoomsForUser({
      user: req.user,
      type: CHAT_ROOM_TYPES.BROADCAST,
    });

    return res.json({ count: rooms.length, rooms });
  } catch (error) {
    return handleControllerError(res, error, "Failed to load broadcasts");
  }
};
