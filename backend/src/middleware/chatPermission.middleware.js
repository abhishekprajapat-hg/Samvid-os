const { getRoomByIdForUser } = require("../services/chatRoom.service");

const requireChatRoles = (roles = []) => (req, res, next) => {
  if (!roles.includes(req.user?.role)) {
    return res.status(403).json({ message: "Access denied" });
  }
  return next();
};

const attachRoomAccess =
  ({ roomParam = "roomId", requireParticipantForSend = false } = {}) =>
  async (req, res, next) => {
    try {
      const roomId = req.params?.[roomParam] || req.body?.[roomParam] || req.query?.[roomParam];
      if (!roomId) {
        return res.status(400).json({ message: "roomId is required" });
      }

      const room = await getRoomByIdForUser({
        user: req.user,
        roomId,
        requireParticipantForSend,
      });

      req.chatRoom = room;
      return next();
    } catch (error) {
      const statusCode = error.statusCode || 500;
      return res.status(statusCode).json({ message: error.message || "Chat access denied" });
    }
  };

module.exports = {
  requireChatRoles,
  attachRoomAccess,
};
