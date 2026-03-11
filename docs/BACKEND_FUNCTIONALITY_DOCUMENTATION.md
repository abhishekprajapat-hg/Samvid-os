# Samvid OS Backend Functionality Documentation

Generated from `backend/src` (Express app, routes, controllers, services).

## Coverage Summary
- Route files: 10
- Controller files: 12
- Service files: 9
- App route mounts parsed: 10

## Express Route Mounts (from `backend/src/app.js`)
| Mount Path | Route File Require Path |
| --- | --- |
| `/api/client` | `./routes/client.routes` |
| `/api/leads` | `./routes/lead.routes` |
| `/api/auth` | `./routes/auth.routes` |
| `/api/users` | `./routes/user.routes` |
| `/api/targets` | `./routes/target.routes` |
| `/api/inventory` | `./routes/inventory.routes` |
| `/api/inventory-request` | `./routes/inventoryRequest.routes` |
| `/api/webhook` | `./routes/webhook.routes` |
| `/api/chat` | `./routes/chat.routes` |
| `/api/samvid` | `./routes/samvid.routes` |

## Route Files and Endpoints

### auth.routes.js
- **Path:** `backend/src/routes/auth.routes.js`
- **Mounted under:** `/api/auth`
- **Endpoint count:** 4
- **Middleware profile:** No global middleware pattern detected in parser pass.
- **Endpoints:**
  - `POST /api/auth/login`
  - `POST /api/auth/refresh`
  - `GET /api/auth/me`
  - `POST /api/auth/logout`
- **Code snippet:**

```js
const express = require("express");
const router = express.Router();

const authController = require("../controllers/auth.controller");
const { protect } = require("../middleware/auth.middleware");
const { authLimiter } = require("../middleware/rateLimit.middleware");

// ================================
// 🔐 LOGIN
// ================================
router.post("/login", authLimiter, authController.login);
router.post("/refresh", authLimiter, authController.refresh);

// ================================
// 👤 GET CURRENT USER
// ================================
router.get("/me", protect, authController.getMe);

// ================================
// 🔓 LOGOUT (optional future ready)
// ================================
router.post("/logout", protect, authController.logout);
```

### chat.routes.js
- **Path:** `backend/src/routes/chat.routes.js`
- **Mounted under:** `/api/chat`
- **Endpoint count:** 19
- **Middleware profile:** Authenticated route surface (`authMiddleware.protect`). Rate-limited write/message endpoints.
- **Endpoints:**
  - `GET /api/chat/rooms`
  - `POST /api/chat/rooms/direct`
  - `POST /api/chat/rooms/group`
  - `POST /api/chat/rooms/lead`
  - `GET /api/chat/rooms/:roomId/messages`
  - `POST /api/chat/rooms/:roomId/messages`
  - `PATCH /api/chat/rooms/:roomId/read`
  - `PATCH /api/chat/messages/:messageId/delivered`
  - `PATCH /api/chat/messages/:messageId/seen`
  - `GET /api/chat/escalations`
  - `GET /api/chat/escalation-logs`
  - `GET /api/chat/escalations/:roomId/logs`
  - `POST /api/chat/broadcasts`
  - `GET /api/chat/broadcasts`
  - `GET /api/chat/contacts`
  - `GET /api/chat/conversations`
  - `GET /api/chat/conversations/:conversationId/messages`
  - `GET /api/chat/conversations/:conversationId/calls`
  - `POST /api/chat/messages`
- **Code snippet:**

```js
const express = require("express");

const router = express.Router();
const chatController = require("../controllers/chat.controller");
const broadcastController = require("../controllers/broadcast.controller");
const authMiddleware = require("../middleware/auth.middleware");
const { requireChatRoles } = require("../middleware/chatPermission.middleware");
const { chatMessageLimiter } = require("../middleware/rateLimit.middleware");

router.use(authMiddleware.protect);

router.get("/rooms", chatController.getRooms);
router.post("/rooms/direct", chatController.createDirectRoom);
router.post(
  "/rooms/group",
  requireChatRoles(["ADMIN", "MANAGER", "ASSISTANT_MANAGER", "TEAM_LEADER"]),
  chatController.createGroup,
);
router.post("/rooms/lead", chatController.createLeadRoom);
router.get("/rooms/:roomId/messages", chatController.getRoomMessages);
router.post("/rooms/:roomId/messages", chatMessageLimiter, chatController.sendRoomMessage);
router.patch("/rooms/:roomId/read", chatController.markRoomRead);
```

### client.routes.js
- **Path:** `backend/src/routes/client.routes.js`
- **Mounted under:** `/api/client`
- **Endpoint count:** 2
- **Middleware profile:** No global middleware pattern detected in parser pass.
- **Endpoints:**
  - `GET /api/client/health`
  - `GET /api/client/bootstrap`
- **Code snippet:**

```js
const express = require("express");

const { protect } = require("../middleware/auth.middleware");
const clientController = require("../controllers/client.controller");

const router = express.Router();

// Centralized API namespace used by both web and mobile clients.
router.get("/health", clientController.health);
router.get("/bootstrap", protect, clientController.bootstrap);

router.use("/auth", require("./auth.routes"));
router.use("/leads", require("./lead.routes"));
router.use("/users", require("./user.routes"));
router.use("/targets", require("./target.routes"));
router.use("/inventory", require("./inventory.routes"));
router.use("/inventory-request", require("./inventoryRequest.routes"));
router.use("/webhook", require("./webhook.routes"));
router.use("/chat", require("./chat.routes"));

module.exports = router;
```

### inventory.routes.js
- **Path:** `backend/src/routes/inventory.routes.js`
- **Mounted under:** `/api/inventory`
- **Endpoint count:** 7
- **Middleware profile:** Authenticated route surface (`authMiddleware.protect`). Role-gated handlers (`checkRole`). Rate-limited write/message endpoints.
- **Endpoints:**
  - `GET /api/inventory/`
  - `GET /api/inventory/:id/activity`
  - `GET /api/inventory/:id`
  - `POST /api/inventory/`
  - `POST /api/inventory/bulk`
  - `PATCH /api/inventory/:id`
  - `DELETE /api/inventory/:id`
- **Code snippet:**

```js
const express = require("express");
const router = express.Router();

const inventoryController = require("../controllers/inventory.controller");
const authMiddleware = require("../middleware/auth.middleware");
const companyMiddleware = require("../middleware/company.middleware");
const { writeLimiter } = require("../middleware/rateLimit.middleware");

router.use(authMiddleware.protect);
router.use(
  authMiddleware.checkRole([
    "ADMIN",
    "MANAGER",
    "ASSISTANT_MANAGER",
    "TEAM_LEADER",
    "EXECUTIVE",
    "FIELD_EXECUTIVE",
    "CHANNEL_PARTNER",
  ]),
);
router.use(companyMiddleware.requireCompanyContext);
```

### inventoryRequest.routes.js
- **Path:** `backend/src/routes/inventoryRequest.routes.js`
- **Mounted under:** `/api/inventory-request`
- **Endpoint count:** 8
- **Middleware profile:** Authenticated route surface (`authMiddleware.protect`). Role-gated handlers (`checkRole`). Rate-limited write/message endpoints.
- **Endpoints:**
  - `POST /api/inventory-request/`
  - `POST /api/inventory-request/create`
  - `GET /api/inventory-request/pending`
  - `PATCH /api/inventory-request/:id/pre-approve`
  - `PATCH /api/inventory-request/:id/approve`
  - `PATCH /api/inventory-request/:id/reject`
  - `GET /api/inventory-request/my`
  - `POST /api/inventory-request/update/:inventoryId`
- **Code snippet:**

```js
const express = require("express");

const router = express.Router();
const authMiddleware = require("../middleware/auth.middleware");
const companyMiddleware = require("../middleware/company.middleware");
const inventoryRequestController = require("../controllers/inventoryRequest.controller");
const inventoryApprovalController = require("../controllers/inventoryApproval.controller");
const { writeLimiter } = require("../middleware/rateLimit.middleware");

router.use(authMiddleware.protect);
router.use(companyMiddleware.requireCompanyContext);

router.post(
  "/",
  writeLimiter,
  authMiddleware.checkRole(["FIELD_EXECUTIVE", "EXECUTIVE"]),
  companyMiddleware.enforceBodyCompanyMatch("companyId"),
  inventoryRequestController.createRequest,
);

// Legacy alias for older clients.
router.post(
```

### lead.routes.js
- **Path:** `backend/src/routes/lead.routes.js`
- **Mounted under:** `/api/leads`
- **Endpoint count:** 12
- **Middleware profile:** Authenticated route surface (`authMiddleware.protect`). Role-gated handlers (`checkRole`). Rate-limited write/message endpoints.
- **Endpoints:**
  - `POST /api/leads/`
  - `GET /api/leads/`
  - `GET /api/leads/followups/today`
  - `GET /api/leads/payment-requests`
  - `PATCH /api/leads/:leadId/assign`
  - `PATCH /api/leads/:leadId/properties`
  - `PATCH /api/leads/:leadId/properties/:inventoryId/select`
  - `DELETE /api/leads/:leadId/properties/:inventoryId`
  - `PATCH /api/leads/:leadId/status`
  - `GET /api/leads/:leadId/activity`
  - `GET /api/leads/:leadId/diary`
  - `POST /api/leads/:leadId/diary`
- **Code snippet:**

```js
const express = require("express");
const router = express.Router();

const leadController = require("../controllers/lead.controller");
const authMiddleware = require("../middleware/auth.middleware");
const { writeLimiter } = require("../middleware/rateLimit.middleware");

// ======================================
// CREATE LEAD (All logged in users)
// ======================================
router.post(
  "/",
  writeLimiter,
  authMiddleware.protect,
  leadController.createLead
);

// ======================================
// GET ALL LEADS (ROLE BASED inside controller)
// ======================================
router.get(
  "/",
```

### samvid.routes.js
- **Path:** `backend/src/routes/samvid.routes.js`
- **Mounted under:** `/api/samvid`
- **Endpoint count:** 1
- **Middleware profile:** Authenticated route surface (`authMiddleware.protect`). Rate-limited write/message endpoints.
- **Endpoints:**
  - `POST /api/samvid/ask`
- **Code snippet:**

```js
const express = require("express");

const router = express.Router();
const samvidController = require("../controllers/samvid.controller");
const authMiddleware = require("../middleware/auth.middleware");
const { chatMessageLimiter } = require("../middleware/rateLimit.middleware");

router.use(authMiddleware.protect);

router.post("/ask", chatMessageLimiter, samvidController.askSamvid);

module.exports = router;
```

### target.routes.js
- **Path:** `backend/src/routes/target.routes.js`
- **Mounted under:** `/api/targets`
- **Endpoint count:** 2
- **Middleware profile:** Authenticated route surface (`authMiddleware.protect`). Rate-limited write/message endpoints.
- **Endpoints:**
  - `GET /api/targets/my`
  - `POST /api/targets/assign`
- **Code snippet:**

```js
const express = require("express");

const router = express.Router();
const targetController = require("../controllers/target.controller");
const authMiddleware = require("../middleware/auth.middleware");
const { writeLimiter } = require("../middleware/rateLimit.middleware");

router.use(authMiddleware.protect);

router.get(
  "/my",
  targetController.getMyTargets,
);

router.post(
  "/assign",
  writeLimiter,
  targetController.assignTarget,
);

module.exports = router;
```

### user.routes.js
- **Path:** `backend/src/routes/user.routes.js`
- **Mounted under:** `/api/users`
- **Endpoint count:** 15
- **Middleware profile:** Authenticated route surface (`authMiddleware.protect`). Rate-limited write/message endpoints.
- **Endpoints:**
  - `GET /api/users/`
  - `GET /api/users/leaderboard`
  - `POST /api/users/create`
  - `GET /api/users/my-team`
  - `GET /api/users/profile`
  - `GET /api/users/:userId/profile`
  - `PATCH /api/users/:userId/designation`
  - `PATCH /api/users/:userId/channel-partner/inventory-access`
  - `PATCH /api/users/profile`
  - `PATCH /api/users/location`
  - `PATCH /api/users/:userId`
  - `GET /api/users/field-locations`
  - `POST /api/users/rebalance-executives`
  - `PATCH /api/users/:userId`
  - `DELETE /api/users/:userId`
- **Code snippet:**

```js
const express = require("express");
const router = express.Router();

const userController = require("../controllers/user.controller");
const authMiddleware = require("../middleware/auth.middleware");
const { writeLimiter } = require("../middleware/rateLimit.middleware");

router.get(
  "/",
  authMiddleware.protect,
  userController.getUsers
);

router.get(
  "/leaderboard",
  authMiddleware.protect,
  userController.getRoleLeaderboard
);

router.post(
  "/create",
  writeLimiter,
```

### webhook.routes.js
- **Path:** `backend/src/routes/webhook.routes.js`
- **Mounted under:** `/api/webhook`
- **Endpoint count:** 2
- **Middleware profile:** No global middleware pattern detected in parser pass.
- **Endpoints:**
  - `GET /api/webhook/meta`
  - `POST /api/webhook/meta`
- **Code snippet:**

```js
const express = require("express");

const router = express.Router();
const webhookController = require("../controllers/webhook.controller");
const { webhookLimiter } = require("../middleware/rateLimit.middleware");

router.get("/meta", webhookController.verifyWebhook);
router.post("/meta", webhookLimiter, webhookController.handleWebhook);

module.exports = router;
```


## Controllers

### auth.controller.js
- **Path:** `backend/src/controllers/auth.controller.js`
- **Exported handlers:** login, refresh, logout, getMe
- **Top-level functions:** isValidObjectId, resolveClientIp, resolveCompanyContextForLogin, toAuthResponse
- **Code snippet:**

```js
const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const resolveClientIp = (req) =>
  String(
    req.headers["x-forwarded-for"]
    || req.ip
    || req.connection?.remoteAddress
    || "",
  )
    .split(",")[0]
    .trim();

const resolveCompanyContextForLogin = async (user) => {
  if (user.companyId) return user.companyId;

  if (user.role === "ADMIN") {
    user.companyId = user._id;
    await user.save();
    return user.companyId;
  }

  let cursor = user;
```

### broadcast.controller.js
- **Path:** `backend/src/controllers/broadcast.controller.js`
- **Exported handlers:** createBroadcast, getBroadcastRooms
- **Top-level functions:** handleControllerError, emitBroadcastRealtime
- **Code snippet:**

```js
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
```

### chat.controller.js
- **Path:** `backend/src/controllers/chat.controller.js`
- **Exported handlers:** getContacts, getRooms, createDirectRoom, createGroup, createLeadRoom, getRoomMessages, sendRoomMessage, markRoomRead, markDelivered, markSeen, getEscalations, getEscalationLogs, getConversations, getConversationMessages, getConversationCalls, sendMessage
- **Top-level functions:** emitRealtimeMessage, handleControllerError
- **Code snippet:**

```js
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
```

### client.controller.js
- **Path:** `backend/src/controllers/client.controller.js`
- **Exported handlers:** health, bootstrap
- **Top-level functions:** toUserView, toCapabilities
- **Code snippet:**

```js
const toUserView = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  companyId: user.companyId || null,
  parentId: user.parentId || null,
  partnerCode: user.partnerCode || null,
});

const toCapabilities = (role) => ({
  canManageUsers: MANAGEMENT_SET.has(role),
  canManageLeads: MANAGEMENT_SET.has(role) || EXECUTIVE_SET.has(role),
  canManageInventory: role === USER_ROLES.ADMIN,
  canApproveInventoryRequests: role === USER_ROLES.ADMIN,
  canCreateInventoryRequests: role === USER_ROLES.FIELD_EXECUTIVE,
  canUseRealtimeChat: true,
});

exports.health = (_req, res) => {
  res.json({
    ok: true,
```

### inventory.controller.js
- **Path:** `backend/src/controllers/inventory.controller.js`
- **Exported handlers:** getInventory, getInventoryById, createInventory, updateInventory, deleteInventory, bulkUploadInventory, getInventoryActivity, getInventoryAssets, createInventoryAsset, updateInventoryAsset, deleteInventoryAsset
- **Top-level functions:** toLegacyStatus, toLegacyType, toLegacyCategory, toLegacyAsset, toFieldExecutiveInventoryView, toRoleBasedInventory, resolveControllerErrorStatus, resolveControllerErrorMessage, handleControllerError
- **Code snippet:**

```js
const toLegacyStatus = (status) => {
  if (status === "Blocked") return "Reserved";
  return status || "Available";
};

const toLegacyType = (type) => {
  const cleanType = String(type || "").trim().toLowerCase();
  if (["rent", "rental", "for rent", "lease", "leasing"].includes(cleanType)) {
    return "Rent";
  }
  return "Sale";
};

const toLegacyCategory = (category) => {
  const cleanCategory = String(category || "").trim();
  return cleanCategory || "Apartment";
};

const toLegacyAsset = (inventory, role) => {
  if (!inventory) return null;

  const titleParts = [inventory.projectName, inventory.towerName, inventory.unitNumber]
```

### inventoryApproval.controller.js
- **Path:** `backend/src/controllers/inventoryApproval.controller.js`
- **Exported handlers:** getPending, preApprove, approve, reject
- **Top-level functions:** handleControllerError
- **Code snippet:**

```js
const handleControllerError = (res, error, fallbackMessage) => {
  const statusCode = error.statusCode || 500;
  const message = statusCode >= 500 ? fallbackMessage : error.message;

  if (statusCode >= 500) {
    console.error(fallbackMessage, error);
  }

  return res.status(statusCode).json({ message });
};

exports.getPending = async (req, res) => {
  try {
    const requests = await getPendingRequests({ user: req.user });
    return res.json({
      count: requests.length,
      requests,
    });
  } catch (error) {
    return handleControllerError(res, error, "Failed to load pending requests");
  }
};
```

### inventoryRequest.controller.js
- **Path:** `backend/src/controllers/inventoryRequest.controller.js`
- **Exported handlers:** createRequest, updateRequest, getMyInventoryRequests
- **Top-level functions:** handleControllerError
- **Code snippet:**

```js
const handleControllerError = (res, error, fallbackMessage) => {
  const statusCode = error.statusCode || 500;
  const message = statusCode >= 500 ? fallbackMessage : error.message;

  if (statusCode >= 500) {
    console.error(fallbackMessage, error);
  }

  return res.status(statusCode).json({ message });
};

exports.createRequest = async (req, res) => {
  try {
    const request = await createInventoryCreateRequest({
      user: req.user,
      payload: req.body?.proposedData || req.body?.proposedChanges || req.body,
      io: req.app.get("io"),
    });

    return res.status(201).json({
      message: "Inventory create request submitted",
      request,
```

### lead.controller.js
- **Path:** `backend/src/controllers/lead.controller.js`
- **Exported handlers:** createLead, getAllLeads, assignLead, addRelatedPropertyToLead, selectRelatedPropertyForLead, removeRelatedPropertyFromLead, getLeadPaymentRequests, updateLeadStatus, getLeadActivity, getTodayFollowUps, getLeadDiary, addLeadDiaryEntry
- **Top-level functions:** isValidObjectId, buildInventoryLeadProjectLabel, toObjectIdString, buildLeadRelatedInventoryRefs, pushUnique, toLeadView, buildCompanyInventoryQuery, applyLeadSelectionFromInventory, toFiniteNumber, normalizeLatitude, normalizeLongitude, normalizeRadiusMeters, parseSiteLocationPayload, normalizeEnumValue
- **Code snippet:**

```js
const isValidObjectId = (value) =>
  /^[a-fA-F0-9]{24}$/.test(String(value || "").trim());

const buildInventoryLeadProjectLabel = (inventory) =>
  [inventory?.projectName, inventory?.towerName, inventory?.unitNumber]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(" - ");

const toObjectIdString = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && value._id) return String(value._id);
  return String(value);
};

const buildLeadRelatedInventoryRefs = (lead = {}) => {
  const merged = [];
  const seen = new Set();
  const pushUnique = (value) => {
    const id = toObjectIdString(value);
    if (!id || seen.has(id)) return;
```

### samvid.controller.js
- **Path:** `backend/src/controllers/samvid.controller.js`
- **Exported handlers:** askSamvid
- **Top-level functions:** escapeRegex, normalizeQuery, formatMoney, formatInventoryLabel, getCompanyUserIds, getInventoryScopeForUser, getLeadScopeForUser, detectIntent, queryInventory, queryLeads, queryBestPerformer, querySalesInterestedSnapshot, queryOverview
- **Code snippet:**

```js
const escapeRegex = (value) => String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizeQuery = (value) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim();

const formatMoney = (value) => {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) return "0";
  return amount.toLocaleString("en-IN");
};

const formatInventoryLabel = (row) =>
  [row?.projectName, row?.towerName, row?.unitNumber]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(" - ");

const getCompanyUserIds = async (companyId) => {
  const users = await User.find({ companyId, isActive: true }).select("_id").lean();
  return users.map((row) => row._id);
```

### target.controller.js
- **Path:** `backend/src/controllers/target.controller.js`
- **Exported handlers:** getMyTargets, assignTarget
- **Top-level functions:** toMonthKey, toMonthRange, parseTargetNumber, toPercent, getLeadScopeQueryForUser, computeTargetAchievement, toUserRef, toTargetView, buildPopulationQuery, getAssignableUsersForActor
- **Code snippet:**

```js
const toMonthKey = (value = "") => {
  const clean = String(value || "").trim();
  if (clean) {
    if (!MONTH_KEY_PATTERN.test(clean)) return null;
    return clean;
  }

  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

const toMonthRange = (monthKey) => {
  const [yearRaw, monthRaw] = monthKey.split("-");
  const year = Number.parseInt(yearRaw, 10);
  const month = Number.parseInt(monthRaw, 10);

  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return { start, end };
};

const parseTargetNumber = (value) => {
```

### user.controller.js
- **Path:** `backend/src/controllers/user.controller.js`
- **Exported handlers:** getUsers, getRoleLeaderboard, getMyProfile, getUserProfileForAdmin, updateMyProfile, createUserByRole, updateUserByAdmin, updateUserDesignation, updateChannelPartnerInventoryAccess, rebalanceExecutives, deleteUser, updateUserByRole, getMyTeam, updateMyLocation, getFieldExecutiveLocations
- **Top-level functions:** toFiniteNumber, normalizeLatitude, normalizeLongitude, normalizeOptionalNumber, sanitizeName, sanitizePhone, sanitizeProfileImageUrl, sanitizeEmail, isValidEmail, isValidObjectId, toRoleExpectationLabel, getLeadScopeLabel, buildLeadScopeQuery, buildLeadStatusMap
- **Code snippet:**

```js
const toFiniteNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeLatitude = (value) => {
  const parsed = toFiniteNumber(value);
  if (parsed === null) return null;
  if (parsed < -90 || parsed > 90) return null;
  return parsed;
};

const normalizeLongitude = (value) => {
  const parsed = toFiniteNumber(value);
  if (parsed === null) return null;
  if (parsed < -180 || parsed > 180) return null;
  return parsed;
};

const normalizeOptionalNumber = (value) => {
  const parsed = toFiniteNumber(value);
  return parsed === null ? null : Math.max(0, parsed);
```

### webhook.controller.js
- **Path:** `backend/src/controllers/webhook.controller.js`
- **Exported handlers:** verifyWebhook, handleWebhook
- **Top-level functions:** toPositiveInt, normalizeFieldData, readFirst, extractLeadEvents, isDuplicateMetaLeadError, isInvalidMetaLeadError, ensureLeadAssignmentIfMissing
- **Code snippet:**

```js
const toPositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};
const META_GRAPH_TIMEOUT_MS = toPositiveInt(process.env.META_GRAPH_TIMEOUT_MS, 10_000);

const normalizeFieldData = (rows = []) => {
  const map = new Map();

  rows.forEach((field) => {
    const key = String(field?.name || "")
      .trim()
      .toLowerCase();
    if (!key) return;

    const rawValue = Array.isArray(field?.values) ? field.values[0] : field?.values;
    const value = String(rawValue || "").trim();
    if (!value) return;

    map.set(key, value);
  });
```


## Services

### authToken.service.js
- **Path:** `backend/src/services/authToken.service.js`
- **Exported service methods:** issueAuthTokens, rotateRefreshToken, revokeRefreshToken, revokeAllUserRefreshTokens
- **Top-level functions:** REFRESH_TOKEN_TTL_DAYS, buildTokenHash, createRawRefreshToken, buildRefreshExpiryDate, issueAuthTokens, rotateRefreshToken, revokeRefreshToken, revokeAllUserRefreshTokens
- **Code snippet:**

```js
const REFRESH_TOKEN_TTL_DAYS = (() => {
  const parsed = Number.parseInt(process.env.REFRESH_TOKEN_TTL_DAYS, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 30;
})();

const buildTokenHash = (rawToken) =>
  crypto
    .createHash("sha256")
    .update(String(rawToken || ""))
    .digest("hex");

const createRawRefreshToken = () => crypto.randomBytes(48).toString("hex");

const buildRefreshExpiryDate = () =>
  new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

const issueAuthTokens = async ({ user, ip = "", userAgent = "" }) => {
  const familyId = crypto.randomUUID();
  const rawRefreshToken = createRawRefreshToken();
  const refreshTokenHash = buildTokenHash(rawRefreshToken);
  const accessToken = generateToken(user);
```

### chatAccess.service.js
- **Path:** `backend/src/services/chatAccess.service.js`
- **Exported service methods:** toObjectIdString, uniqueIds, isExecutiveRole, isAdminRole, isManagerRole, getTeamIdForUser, isManagerOf, isSameManager, buildDirectKey, canInitiateDirectChat, buildContactQueryForUser, getLeadParticipantIdsFromLeadDoc
- **Top-level functions:** toObjectIdString, uniqueIds, isExecutiveRole, isAdminRole, isManagerRole, getTeamIdForUser, isManagerOf, isSameManager, buildDirectKey, canInitiateDirectChat, buildContactQueryForUser, getLeadParticipantIdsFromLeadDoc
- **Code snippet:**

```js
const toObjectIdString = (value) => String(value || "");

const uniqueIds = (ids = []) =>
  [...new Set(ids.map((id) => toObjectIdString(id)).filter(Boolean))];

const isExecutiveRole = (role) => EXECUTIVE_ROLES.includes(role);

const isAdminRole = (role) => role === USER_ROLES.ADMIN;

const isManagerRole = (role) => MANAGEMENT_ROLES.includes(role);

const getTeamIdForUser = (user) => {
  if (!user) return "";
  if (isManagerRole(user.role)) return toObjectIdString(user._id);
  if (isExecutiveRole(user.role)) return toObjectIdString(user.parentId);
  return "";
};

const isManagerOf = (managerUser, memberUser) =>
  isManagerRole(managerUser?.role)
  && toObjectIdString(memberUser?.parentId) === toObjectIdString(managerUser?._id);
```

### chatCall.service.js
- **Path:** `backend/src/services/chatCall.service.js`
- **Exported service methods:** recordCallInitiated, markCallAccepted, markCallRejected, markCallEnded, listConversationCallHistory
- **Top-level functions:** toId, toPositiveInt, sanitizeMode, sanitizeReason, toUserDto, toCallHistoryDto, calculateDurationSeconds, resolveParticipantsFromRoom, getUserClearedAt, findCallHistoryRow, listConversationCallHistory
- **Code snippet:**

```js
const toId = (value) => toObjectIdString(value || "");

const toPositiveInt = (value, fallback, max) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
};

const sanitizeMode = (value) => {
  const mode = String(value || "").trim().toLowerCase();
  return CALL_MODES.has(mode) ? mode : "audio";
};

const sanitizeReason = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .slice(0, 80);

const toUserDto = (user) =>
  user
    ? {
```

### chatRoom.service.js
- **Path:** `backend/src/services/chatRoom.service.js`
- **Exported service methods:** createHttpError, toPositiveInt, getContactUsers, listRoomsForUser, createOrGetDirectRoom, createGroupRoom, createOrGetLeadRoom, createBroadcastMessage, sendRoomMessage, sendDirectMessage, getRoomMessages, markRoomAsRead, markMessageDelivered, markMessageSeen, listEscalationRooms, listEscalationLogs, getRoomByIdForUser
- **Top-level functions:** createHttpError, ensureObjectId, toPositiveInt, sanitizeText, buildPropertyShareText, buildMediaShareText, sanitizeOptionalLimitedString, sanitizePrice, detectMediaKind, ensureHttpUrl, resolveMediaAttachmentsPayload, resolveSharedPropertyPayload, resolveOutgoingMessagePayload, toRoleLabel
- **Code snippet:**

```js
const createHttpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const ensureObjectId = (value, label) => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw createHttpError(400, `Invalid ${label}`);
  }
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
```

### hierarchy.service.js
- **Path:** `backend/src/services/hierarchy.service.js`
- **Exported service methods:** toId, getDescendantUsers, getDescendantExecutiveIds, getDescendantByRoleCount, getAncestorByRoles, getFirstLevelChildrenByRole
- **Top-level functions:** toId, uniqueObjectIds, getDescendantUsers, getDescendantExecutiveIds, getDescendantByRoleCount, getAncestorByRoles, getFirstLevelChildrenByRole
- **Code snippet:**

```js
const toId = (value) => String(value || "");

const uniqueObjectIds = (items = []) => {
  const seen = new Set();
  const deduped = [];

  items.forEach((item) => {
    const id = toId(item);
    if (!id || seen.has(id)) return;
    seen.add(id);
    deduped.push(item);
  });

  return deduped;
};

const getDescendantUsers = async ({
  rootUserId,
  companyId,
  maxDepth = DEFAULT_DESCENDANT_DEPTH,
  includeInactive = false,
  select = "_id role parentId isActive",
```

### inventoryNotification.service.js
- **Path:** `backend/src/services/inventoryNotification.service.js`
- **Exported service methods:** notifyRequestCreated, notifyRequestReviewed
- **Top-level functions:** emitToRoom, emitToUser, notifyRequestCreated, notifyRequestReviewed
- **Code snippet:**

```js
const emitToRoom = ({ io, room, event, payload }) => {
  if (!io || !room || !event) return;
  io.to(room).emit(event, payload);
};

const emitToUser = ({ io, userId, event, payload }) => {
  if (!io || !userId || !event) return;
  io.to(`user:${userId}`).emit(event, payload);
};

const notifyRequestCreated = ({ io, request, companyId, teamId }) => {
  if (!io || !request || !companyId) return;
  const adminRoom = `company:${companyId}:role:${USER_ROLES.ADMIN}`;
  const resolvedTeamId = teamId || request.teamId || null;
  const eventId = `inventory:${request._id}`;

  emitToRoom({
    io,
    room: adminRoom,
    event: "inventory:request:created",
    payload: {
      eventId,
```

### inventoryWorkflow.service.js
- **Path:** `backend/src/services/inventoryWorkflow.service.js`
- **Exported service methods:** createHttpError, getInventoryList, getInventoryById, createInventoryDirect, updateInventoryDirect, deleteInventoryDirect, bulkCreateInventoryDirect, createInventoryCreateRequest, createInventoryUpdateRequest, getPendingRequests, preApproveRequestByManager, approveRequest, rejectRequest, getMyRequests, getInventoryActivities
- **Top-level functions:** createHttpError, isValidObjectId, isSafeKey, sanitizeString, sanitizeReservationReason, toObjectIdString, normalizeSalePaymentMode, normalizeSalePaymentType, sanitizeSaleDetails, sanitizeFileList, sanitizePrice, toFiniteNumber, normalizeLatitude, normalizeLongitude
- **Code snippet:**

```js
const createHttpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const isSafeKey = (key) =>
  typeof key === "string"
  && key.length > 0
  && !key.startsWith("$")
  && !key.includes(".");

const sanitizeString = (value) => {
  if (typeof value !== "string") return "";
  return value.trim();
};

const sanitizeReservationReason = (value) => sanitizeString(value).slice(0, 300);

const toObjectIdString = (value) => {
```

### leadAssignment.service.js
- **Path:** `backend/src/services/leadAssignment.service.js`
- **Exported service methods:** EXECUTIVE_ROLES, PIPELINE_STATUSES, MAX_ACTIVE_LEADS_PER_EXECUTIVE, autoAssignLead, redistributePipelineLeads
- **Top-level functions:** toId, toTimestamp, buildCountMap, getStartOfDay, compareExecutiveCandidates, compareLeaders, buildAssignmentAction, getExecutiveMetrics, rankExecutiveCandidates, selectLeaderCandidate, persistAssignment, createNoAssignmentActivity, autoAssignLead, redistributePipelineLeads
- **Code snippet:**

```js
const toId = (value) => String(value || "");
const toTimestamp = (value) => (value ? new Date(value).getTime() : 0);

const buildCountMap = (rows) =>
  new Map(rows.map((row) => [toId(row._id), Number(row.count || 0)]));

const getStartOfDay = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return start;
};

const compareExecutiveCandidates = (left, right) => {
  if (left.metric.score !== right.metric.score) {
    return left.metric.score - right.metric.score;
  }

  if (left.metric.activeLeads !== right.metric.activeLeads) {
    return left.metric.activeLeads - right.metric.activeLeads;
  }

  const leftAssignedAt = toTimestamp(left.executive.lastAssignedAt);
```

### messenger.service.js
- **Path:** `backend/src/services/messenger.service.js`
- **Exported service methods:** getContactUsers, getUserConversations, getConversationMessages, sendDirectMessage, toPositiveInt
- **Top-level functions:** toPositiveInt, sanitizeText, toRoleLabel, toUserDto, toConversationDto, toMessageDto, sortByName, toObjectIdString, buildParticipantHash, buildContactCriteria, ensureCanTalkToRecipient, getOrCreateConversationByRecipient, getConversationForUser, resolveConversationForSend
- **Code snippet:**

```js
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
```

