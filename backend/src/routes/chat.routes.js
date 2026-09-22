const express = require("express");

const router = express.Router();
const chatController = require("../controllers/chat.controller");
const broadcastController = require("../controllers/broadcast.controller");
const authMiddleware = require("../middleware/auth.middleware");
const { requireChatRoles } = require("../middleware/chatPermission.middleware");
const { chatMessageLimiter } = require("../middleware/rateLimit.middleware");
const {
  requirePageAccess,
  requirePageActionForMethod,
  checkRoleOrPageAccess,
} = require("../middleware/pageAccess.middleware");

/*
 * Internal staff only. CHANNEL_PARTNER is an external broker account and
 * COWORKING_ADMIN runs the coworking desk; neither has the Team Chat page in
 * its defaults, and without this gate both could read the full staff directory
 * through /chat/contacts.
 */
const CHAT_ROLES = [
  "ADMIN",
  "MANAGER",
  "EXECUTIVE",
  "INSIDE_EXECUTIVE",
  "FIELD_EXECUTIVE",
  "PRODUCTION_EXECUTIVE",
  "COMMUNITY_MANAGER",
];

router.use(authMiddleware.protect);
router.use(checkRoleOrPageAccess(CHAT_ROLES, "chat"));
router.use(requirePageAccess("chat"));
router.use(requirePageActionForMethod("chat"));

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
router.post("/messages", chatMessageLimiter, chatController.sendMessage);

module.exports = router;
