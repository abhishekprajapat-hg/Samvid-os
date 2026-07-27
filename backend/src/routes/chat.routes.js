const express = require("express");

const router = express.Router();
const chatController = require("../controllers/chat.controller");
const broadcastController = require("../controllers/broadcast.controller");
const uploadController = require("../controllers/upload.controller");
const authMiddleware = require("../middleware/auth.middleware");
const { requireChatRoles } = require("../middleware/chatPermission.middleware");
const { chatMessageLimiter } = require("../middleware/rateLimit.middleware");
const { chatUpload } = require("../middleware/upload.middleware");

router.use(authMiddleware.protect);

router.get("/rooms", chatController.getRooms);
router.post("/rooms/direct", chatController.createDirectRoom);
router.post(
  "/rooms/group",
  requireChatRoles(["ADMIN", "MANAGER"]),
  chatController.createGroup,
);
router.post("/rooms/lead", chatController.createLeadRoom);
router.get("/rooms/:roomId/messages", chatController.getRoomMessages);
router.post("/rooms/:roomId/messages", chatMessageLimiter, chatController.sendRoomMessage);
router.patch("/rooms/:roomId/read", chatController.markRoomRead);
router.patch("/rooms/:roomId/clear", chatController.clearRoomMessages);
router.patch("/messages/:messageId/delete", chatController.deleteMessage);
router.patch("/messages/:messageId/delivered", chatController.markDelivered);
router.patch("/messages/:messageId/seen", chatController.markSeen);
router.post("/calls", chatController.createCall);
router.patch("/calls/:callId", chatController.updateCall);
router.post("/uploads", chatUpload.single("file"), uploadController.handleChatUpload);
router.get("/escalations", chatController.getEscalations);
router.get("/escalation-logs", chatController.getEscalationLogs);
router.get("/escalations/:roomId/logs", chatController.getEscalationLogs);
router.post(
  "/broadcasts",
  chatMessageLimiter,
  requireChatRoles(["ADMIN", "MANAGER"]),
  broadcastController.createBroadcast,
);
router.get("/broadcasts", broadcastController.getBroadcastRooms);

// Legacy compatibility routes used by existing UI
router.get("/contacts", chatController.getContacts);
router.get("/conversations", chatController.getConversations);
router.get("/conversations/:conversationId/messages", chatController.getConversationMessages);
router.get("/conversations/:conversationId/calls", chatController.getConversationCalls);
router.post("/messages", chatMessageLimiter, chatController.sendMessage);

module.exports = router;
