const ChatRoom = require("../models/ChatRoom");
const mongoose = require("mongoose");
const ChatMessage = require("../models/ChatMessage");
const ChatEscalationLog = require("../models/ChatEscalationLog");
const Lead = require("../models/Lead");
const User = require("../models/User");
const {
  USER_ROLES,
  MANAGEMENT_ROLES,
  EXECUTIVE_ROLES,
  CHAT_ROOM_TYPES,
  CHAT_MESSAGE_TYPES,
  BROADCAST_TARGET_ROLES,
  ROLE_LABELS,
  MAX_MESSAGE_LENGTH,
  MAX_GROUP_PARTICIPANTS,
} = require("../constants/chat.constants");
const { getInventoryById } = require("./inventoryWorkflow.service");
const {
  toObjectIdString,
  uniqueIds,
  isAdminRole,
  isManagerRole,
  isExecutiveRole,
  getTeamIdForUser,
  buildDirectKey,
  canInitiateDirectChat,
  buildContactQueryForUser,
  getLeadParticipantIdsFromLeadDoc,
} = require("./chatAccess.service");

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

const MEDIA_KINDS = new Set(["image", "video", "audio", "file"]);
const MAX_MEDIA_ATTACHMENTS = 8;
const MAX_MEDIA_ATTACHMENT_SIZE_BYTES = 25 * 1024 * 1024;

const buildPropertyShareText = (sharedProperty) => {
  const title = sanitizeText(sharedProperty?.title);
  const fallback = title ? `Shared property: ${title}` : "Shared a property";
  return fallback.slice(0, MAX_MESSAGE_LENGTH);
};

const buildMediaShareText = (mediaAttachments) => {
  const count = Array.isArray(mediaAttachments) ? mediaAttachments.length : 0;
  if (count <= 1) return "Shared a media file";
  return `Shared ${count} media files`;
};

const sanitizeOptionalLimitedString = (value, maxLength) =>
  sanitizeText(value).slice(0, maxLength);

const sanitizePrice = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
};

const detectMediaKind = ({ kind, mimeType }) => {
  const cleanKind = sanitizeText(kind).toLowerCase();
  if (MEDIA_KINDS.has(cleanKind)) return cleanKind;

  const cleanMimeType = sanitizeText(mimeType).toLowerCase();
  if (cleanMimeType.startsWith("image/")) return "image";
  if (cleanMimeType.startsWith("video/")) return "video";
  if (cleanMimeType.startsWith("audio/")) return "audio";
  return "file";
};

const ensureHttpUrl = (value) => {
  const url = sanitizeText(value);
  if (!url) {
    throw createHttpError(400, "Media URL is required");
  }

  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw createHttpError(400, "Media URL must be HTTP/HTTPS");
    }
  } catch (error) {
    if (error?.statusCode) {
      throw error;
    }
    throw createHttpError(400, "Invalid media URL");
  }

  return url.slice(0, 2048);
};

const resolveMediaAttachmentsPayload = (mediaAttachments) => {
  if (mediaAttachments === undefined || mediaAttachments === null) {
    return [];
  }

  if (!Array.isArray(mediaAttachments)) {
    throw createHttpError(400, "mediaAttachments must be an array");
  }

  if (mediaAttachments.length > MAX_MEDIA_ATTACHMENTS) {
    throw createHttpError(
      400,
      `Too many attachments (max ${MAX_MEDIA_ATTACHMENTS})`,
    );
  }

  return mediaAttachments.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw createHttpError(400, `Invalid media attachment at index ${index}`);
    }

    const url = ensureHttpUrl(item.url || item.secure_url || "");
    const mimeType = sanitizeOptionalLimitedString(item.mimeType || item.type || "", 120);
    const name = sanitizeOptionalLimitedString(item.name || item.original_filename || "", 180);

    let size = Number(item.size || 0);
    if (!Number.isFinite(size) || size < 0) {
      size = 0;
    }
    if (size > MAX_MEDIA_ATTACHMENT_SIZE_BYTES) {
      throw createHttpError(
        400,
        `Attachment too large (max ${MAX_MEDIA_ATTACHMENT_SIZE_BYTES} bytes)`,
      );
    }

    return {
      url,
      kind: detectMediaKind({ kind: item.kind, mimeType }),
      mimeType,
      name,
      size: Math.round(size),
    };
  });
};

const resolveSharedPropertyPayload = async ({ sender, sharedProperty }) => {
  if (!sharedProperty || typeof sharedProperty !== "object" || Array.isArray(sharedProperty)) {
    return null;
  }

  const inventoryId =
    sharedProperty.inventoryId || sharedProperty._id || sharedProperty.id || null;

  if (!inventoryId) {
    throw createHttpError(400, "sharedProperty.inventoryId is required");
  }

  const inventory = await getInventoryById({
    user: sender,
    inventoryId: toObjectIdString(inventoryId),
  });

  const titleParts = [inventory.projectName, inventory.towerName, inventory.unitNumber]
    .map((value) => sanitizeText(value))
    .filter(Boolean);
  const title = titleParts.join(" - ") || "Inventory Unit";
  const firstImage = Array.isArray(inventory.images)
    ? sanitizeText(inventory.images[0] || "")
    : "";

  return {
    inventoryId: inventory._id,
    title: sanitizeOptionalLimitedString(title, 200),
    projectName: sanitizeOptionalLimitedString(inventory.projectName, 120),
    towerName: sanitizeOptionalLimitedString(inventory.towerName, 120),
    unitNumber: sanitizeOptionalLimitedString(inventory.unitNumber, 80),
    location: sanitizeOptionalLimitedString(inventory.location, 240),
    price: sanitizePrice(inventory.price),
    status: sanitizeOptionalLimitedString(inventory.status, 40),
    image: sanitizeOptionalLimitedString(firstImage, 2048),
  };
};

const resolveOutgoingMessagePayload = async ({
  sender,
  text,
  sharedProperty,
  mediaAttachments,
}) => {
  const cleanText = sanitizeText(text);
  const resolvedSharedProperty = await resolveSharedPropertyPayload({
    sender,
    sharedProperty,
  });
  const resolvedMediaAttachments = resolveMediaAttachmentsPayload(mediaAttachments);

  if (resolvedSharedProperty && resolvedMediaAttachments.length > 0) {
    throw createHttpError(400, "Cannot send property and media together in one message");
  }

  if (!cleanText && !resolvedSharedProperty && !resolvedMediaAttachments.length) {
    throw createHttpError(400, "Message text is required");
  }

  if (cleanText.length > MAX_MESSAGE_LENGTH) {
    throw createHttpError(400, `Message too long (max ${MAX_MESSAGE_LENGTH} chars)`);
  }

  const hasSharedProperty = Boolean(resolvedSharedProperty);
  const hasMediaAttachments = resolvedMediaAttachments.length > 0;
  const resolvedText =
    cleanText
    || (hasSharedProperty
      ? buildPropertyShareText(resolvedSharedProperty)
      : hasMediaAttachments
        ? buildMediaShareText(resolvedMediaAttachments)
        : "");

  return {
    text: resolvedText,
    type: hasSharedProperty
      ? CHAT_MESSAGE_TYPES.PROPERTY
      : hasMediaAttachments
        ? CHAT_MESSAGE_TYPES.MEDIA
        : CHAT_MESSAGE_TYPES.TEXT,
    sharedProperty: resolvedSharedProperty,
    mediaAttachments: resolvedMediaAttachments,
  };
};

const toRoleLabel = (role) => ROLE_LABELS[role] || role;

const toUserDto = (user) => ({
  _id: user?._id || null,
  name: user?.name || "",
  role: user?.role || "",
  roleLabel: toRoleLabel(user?.role || ""),
});

const resolveUserId = (value) => {
  if (!value) return "";
  if (typeof value === "object" && value._id) return toObjectIdString(value._id);
  return toObjectIdString(value);
};

const getUnreadCountForUser = (room, userId) => {
  const id = toObjectIdString(userId);
  const row = (room.unreadCounts || []).find(
    (item) => toObjectIdString(item.user) === id,
  );
  return Number(row?.count || 0);
};

const getUserClearedAt = (rows, userId) => {
  const id = toObjectIdString(userId);
  if (!id || !Array.isArray(rows)) return null;
  const row = rows.find((item) => toObjectIdString(item.user) === id);
  if (!row?.at) return null;
  const marker = new Date(row.at);
  return Number.isNaN(marker.getTime()) ? null : marker;
};

const isOnOrBeforeMarker = ({ value, marker }) => {
  if (!value || !marker) return false;
  const timestamp = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(timestamp.getTime())) return false;
  return timestamp.getTime() <= marker.getTime();
};

const toRoomDto = (room, viewerId = null) => {
  const rawLastMessageAt = room.lastMessageAt || room.updatedAt || null;
  const clearMarker = viewerId ? getUserClearedAt(room.clearedMessagesAt, viewerId) : null;
  const isLastMessageCleared = isOnOrBeforeMarker({
    value: rawLastMessageAt,
    marker: clearMarker,
  });

  return {
    _id: room._id,
    type: room.type,
    name: room.name || "",
    participants: (room.participants || []).map((participant) => toUserDto(participant)),
    createdBy: room.createdBy ? toUserDto(room.createdBy) : null,
    leadId: room.leadId || null,
    teamId: room.teamId || null,
    lastMessage: isLastMessageCleared ? "" : room.lastMessage || "",
    lastMessageAt: isLastMessageCleared
      ? clearMarker || room.updatedAt
      : rawLastMessageAt,
    lastMessageSender: isLastMessageCleared ? null : room.lastMessageSender || null,
    unreadCount: viewerId
      ? (isLastMessageCleared ? 0 : getUnreadCountForUser(room, viewerId))
      : 0,
    escalation: room.escalation || null,
    broadcastTarget: room.broadcastTarget || null,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
  };
};

const toMessageDto = (message) => ({
  _id: message._id,
  room: message.room,
  sender: message.sender ? toUserDto(message.sender) : null,
  type: message.type || CHAT_MESSAGE_TYPES.TEXT,
  text: message.text,
  sharedProperty: message.sharedProperty || null,
  mediaAttachments: message.mediaAttachments || [],
  deliveredTo: message.deliveredTo || [],
  seenBy: message.seenBy || [],
  createdAt: message.createdAt,
  updatedAt: message.updatedAt,
});

const sortByName = (left, right) =>
  (left.name || "").localeCompare(right.name || "", undefined, {
    sensitivity: "base",
  });

const applyRoomPopulates = (query) =>
  query
    .populate("participants", "name role parentId isActive")
    .populate("createdBy", "name role parentId isActive")
    .populate("lastMessageSender", "name role parentId isActive");

const applyMessagePopulates = (query) =>
  query.populate("sender", "name role parentId isActive");

const buildDefaultUnreadCounts = (participantIds) =>
  participantIds.map((participantId) => ({
    user: participantId,
    count: 0,
  }));

const updateUnreadCountsForNewMessage = ({ room, senderId }) => {
  const senderIdString = toObjectIdString(senderId);
  const unreadByUserId = new Map(
    (room.unreadCounts || []).map((row) => [
      toObjectIdString(row.user),
      Number(row.count || 0),
    ]),
  );

  (room.participants || []).forEach((participantId) => {
    const participantIdString = resolveUserId(participantId);
    if (!participantIdString) return;

    if (participantIdString === senderIdString) {
      unreadByUserId.set(participantIdString, 0);
      return;
    }

    unreadByUserId.set(
      participantIdString,
      (unreadByUserId.get(participantIdString) || 0) + 1,
    );
  });

  room.unreadCounts = [...unreadByUserId.entries()].map(([user, count]) => ({
    user,
    count,
  }));
};

const resetUnreadCountForUser = ({ room, userId }) => {
  const userIdString = toObjectIdString(userId);
  const unreadByUserId = new Map(
    (room.unreadCounts || []).map((row) => [
      toObjectIdString(row.user),
      Number(row.count || 0),
    ]),
  );

  if (!unreadByUserId.has(userIdString)) {
    unreadByUserId.set(userIdString, 0);
  } else {
    unreadByUserId.set(userIdString, 0);
  }

  room.unreadCounts = [...unreadByUserId.entries()].map(([user, count]) => ({
    user,
    count,
  }));
};

const ensureRoomMembership = async ({ room, user, requireParticipantForSend = false }) => {
  const userId = toObjectIdString(user?._id);
  const participantIds = (room.participants || []).map((participantId) =>
    resolveUserId(participantId),
  );

  const isParticipant = participantIds.includes(userId);
  const adminEscalationObserver =
    isAdminRole(user?.role) && room.type === CHAT_ROOM_TYPES.ESCALATION;

  if (!isParticipant && !adminEscalationObserver) {
    throw createHttpError(403, "You are not allowed to access this chat room");
  }

  if (requireParticipantForSend && !isParticipant) {
    throw createHttpError(403, "Only participants can send messages in this room");
  }
};

const appendMessageToRoom = async ({
  room,
  sender,
  text,
  type = CHAT_MESSAGE_TYPES.TEXT,
  sharedProperty = null,
  mediaAttachments = [],
}) => {
  const now = new Date();

  const message = await ChatMessage.create({
    room: room._id,
    sender: sender._id,
    type,
    text,
    sharedProperty: sharedProperty || null,
    mediaAttachments: Array.isArray(mediaAttachments) ? mediaAttachments : [],
    deliveredTo: [{ user: sender._id, at: now }],
    seenBy: [{ user: sender._id, at: now }],
  });

  updateUnreadCountsForNewMessage({ room, senderId: sender._id });
  room.lastMessage = text;
  room.lastMessageAt = now;
  room.lastMessageSender = sender._id;
  await room.save();

  const [updatedRoom, savedMessage] = await Promise.all([
    applyRoomPopulates(ChatRoom.findById(room._id)).lean(),
    applyMessagePopulates(ChatMessage.findById(message._id)).lean(),
  ]);

  return {
    room: updatedRoom,
    message: savedMessage,
    participantIds: (updatedRoom?.participants || []).map((participant) => participant._id),
  };
};

const logEscalation = async ({
  roomId,
  initiatedBy,
  managerId = null,
  adminId = null,
  action,
  note = "",
  meta = null,
}) =>
  ChatEscalationLog.create({
    room: roomId,
    initiatedBy,
    managerId,
    adminId,
    action,
    note,
    meta,
  });

const resolveLeadChatContext = async (leadId) => {
  const lead = await Lead.findById(leadId)
    .select(
      "_id assignedManager assignedExecutive assignedFieldExecutive assignedTo createdBy",
    )
    .lean();

  if (!lead) {
    throw createHttpError(404, "Lead not found");
  }

  const candidateUserIds = uniqueIds([
    ...getLeadParticipantIdsFromLeadDoc(lead),
    lead.assignedTo,
    lead.createdBy,
  ]);

  const users = await User.find({
    _id: { $in: candidateUserIds },
    isActive: true,
  })
    .select("_id role parentId isActive")
    .lean();

  const byId = new Map(users.map((user) => [toObjectIdString(user._id), user]));

  const assignedManager = byId.get(toObjectIdString(lead.assignedManager)) || null;
  let managerId = assignedManager?._id || null;

  let executiveId = null;
  const assignedExecutive = byId.get(toObjectIdString(lead.assignedExecutive));
  if (assignedExecutive?.role === USER_ROLES.EXECUTIVE) {
    executiveId = assignedExecutive._id;
  }

  let fieldExecutiveId = null;
  const assignedFieldExecutive = byId.get(toObjectIdString(lead.assignedFieldExecutive));
  if (assignedFieldExecutive?.role === USER_ROLES.FIELD_EXECUTIVE) {
    fieldExecutiveId = assignedFieldExecutive._id;
  }

  const assignedTo = byId.get(toObjectIdString(lead.assignedTo));
  if (!executiveId && assignedTo?.role === USER_ROLES.EXECUTIVE) {
    executiveId = assignedTo._id;
  }
  if (!fieldExecutiveId && assignedTo?.role === USER_ROLES.FIELD_EXECUTIVE) {
    fieldExecutiveId = assignedTo._id;
  }

  if (!managerId) {
    const managerFromExecutive = byId.get(toObjectIdString(assignedTo?.parentId));
    if (isManagerRole(managerFromExecutive?.role)) {
      managerId = managerFromExecutive._id;
    }
  }

  if (!managerId) {
    const creator = byId.get(toObjectIdString(lead.createdBy));
    if (isManagerRole(creator?.role)) {
      managerId = creator._id;
    }
  }

  const participantIds = uniqueIds([managerId, executiveId, fieldExecutiveId]);

  return {
    lead,
    managerId: managerId || null,
    executiveId: executiveId || null,
    fieldExecutiveId: fieldExecutiveId || null,
    participantIds,
  };
};

const ensureLeadRoomAccess = async ({ user, room }) => {
  if (room.type !== CHAT_ROOM_TYPES.LEAD || !room.leadId) {
    return;
  }

  const context = await resolveLeadChatContext(room.leadId);
  const allowed = context.participantIds.includes(toObjectIdString(user._id));

  if (!allowed) {
    throw createHttpError(403, "You are not assigned to this lead chat");
  }
};

const getContactUsers = async (user) => {
  const criteria = buildContactQueryForUser(user);
  const users = await User.find(criteria)
    .select("_id name role parentId")
    .lean();

  return users.map(toUserDto).sort(sortByName);
};

const getRoomByIdForUser = async ({ user, roomId, requireParticipantForSend = false }) => {
  const room = await applyRoomPopulates(ChatRoom.findById(roomId));

  if (!room) {
    throw createHttpError(404, "Chat room not found");
  }

  await ensureRoomMembership({ room, user, requireParticipantForSend });
  await ensureLeadRoomAccess({ user, room });

  return room;
};

const listRoomsForUser = async ({ user, type = null }) => {
  const query = {};

  if (type) {
    query.type = type;
  }

  if (isAdminRole(user.role)) {
    query.$or = [
      { participants: user._id },
      { type: CHAT_ROOM_TYPES.ESCALATION },
    ];
  } else {
    query.participants = user._id;
  }

  const rooms = await applyRoomPopulates(
    ChatRoom.find(query).sort({ lastMessageAt: -1, updatedAt: -1 }),
  ).lean();

  return rooms.map((room) => toRoomDto(room, user._id));
};

const createOrGetDirectRoom = async ({ initiator, recipientId }) => {
  if (!recipientId) {
    throw createHttpError(400, "Recipient is required");
  }

  const recipient = await User.findOne({ _id: recipientId, isActive: true })
    .select("_id name role parentId isActive")
    .lean();

  if (!recipient) {
    throw createHttpError(404, "Recipient not found");
  }

  const permission = canInitiateDirectChat({
    initiator,
    recipient,
  });

  if (!permission.allowed) {
    throw createHttpError(403, permission.reason || "You are not allowed to message this user");
  }

  const directKey = buildDirectKey(initiator._id, recipient._id);
  const now = new Date();
  let managerNotificationUserId = null;

  let room = await ChatRoom.findOne({
    directKey,
    type: { $in: [CHAT_ROOM_TYPES.DIRECT, CHAT_ROOM_TYPES.ESCALATION] },
  });

  if (!room) {
    const participantIds = [initiator._id, recipient._id];
    const teamId = getTeamIdForUser(initiator) || getTeamIdForUser(recipient) || null;
    const isEscalation = permission.type === CHAT_ROOM_TYPES.ESCALATION;

    room = await ChatRoom.create({
      type: permission.type,
      participants: participantIds,
      createdBy: initiator._id,
      teamId: teamId || null,
      directKey,
      unreadCounts: buildDefaultUnreadCounts(participantIds),
      escalation: {
        isEscalation,
        escalatedBy: isEscalation ? initiator._id : null,
        managerToNotify: isEscalation ? permission.escalation?.managerToNotify || null : null,
        managerNotifiedAt: isEscalation && permission.escalation?.managerToNotify ? now : null,
        escalatedAt: isEscalation ? now : null,
      },
    });

    if (isEscalation) {
      const managerId = permission.escalation?.managerToNotify || null;
      const adminId = isAdminRole(recipient.role) ? recipient._id : null;
      managerNotificationUserId = managerId ? toObjectIdString(managerId) : null;

      await logEscalation({
        roomId: room._id,
        initiatedBy: initiator._id,
        managerId,
        adminId,
        action: "ESCALATION_CREATED",
        note: "Executive escalation room created",
      });

      if (managerId) {
        await logEscalation({
          roomId: room._id,
          initiatedBy: initiator._id,
          managerId,
          adminId,
          action: "MANAGER_NOTIFIED",
          note: "Manager notified for new escalation",
        });
      }
    }
  } else if (
    permission.type === CHAT_ROOM_TYPES.ESCALATION
    && room.type !== CHAT_ROOM_TYPES.ESCALATION
  ) {
    room.type = CHAT_ROOM_TYPES.ESCALATION;
    room.escalation = {
      isEscalation: true,
      escalatedBy: initiator._id,
      managerToNotify: permission.escalation?.managerToNotify || null,
      managerNotifiedAt: permission.escalation?.managerToNotify ? now : null,
      escalatedAt: now,
    };
    await room.save();

    const managerId = permission.escalation?.managerToNotify || null;
    managerNotificationUserId = managerId ? toObjectIdString(managerId) : null;

    await logEscalation({
      roomId: room._id,
      initiatedBy: initiator._id,
      managerId,
      adminId: null,
      action: "ESCALATION_CREATED",
      note: "Direct room upgraded to escalation",
    });

    if (managerId) {
      await logEscalation({
        roomId: room._id,
        initiatedBy: initiator._id,
        managerId,
        adminId: null,
        action: "MANAGER_NOTIFIED",
        note: "Manager notified for escalation upgrade",
      });
    }
  }

  const populatedRoom = await applyRoomPopulates(ChatRoom.findById(room._id)).lean();
  return {
    room: toRoomDto(populatedRoom, initiator._id),
    rawRoom: populatedRoom,
    managerNotificationUserId,
  };
};

const ensureGroupCreatorCanCreate = (creator) => {
  if (!(isAdminRole(creator.role) || isManagerRole(creator.role))) {
    throw createHttpError(403, "Only admin or leadership roles can create group chats");
  }
};

const createGroupRoom = async ({ creator, name, participantIds = [], teamId = null }) => {
  ensureGroupCreatorCanCreate(creator);

  const cleanName = sanitizeText(name);
  if (!cleanName) {
    throw createHttpError(400, "Group name is required");
  }

  const finalParticipants = uniqueIds([creator._id, ...participantIds]);

  if (finalParticipants.length < 2) {
    throw createHttpError(400, "At least 2 participants are required for a group");
  }

  if (finalParticipants.length > MAX_GROUP_PARTICIPANTS) {
    throw createHttpError(
      400,
      `Group too large (max ${MAX_GROUP_PARTICIPANTS} participants)`,
    );
  }

  const participants = await User.find({
    _id: { $in: finalParticipants },
    isActive: true,
  })
    .select("_id role parentId isActive")
    .lean();

  if (participants.length !== finalParticipants.length) {
    throw createHttpError(400, "Some participants are invalid or inactive");
  }

  const byId = new Map(
    participants.map((participant) => [toObjectIdString(participant._id), participant]),
  );

  if (isManagerRole(creator.role)) {
    finalParticipants.forEach((participantId) => {
      const participant = byId.get(toObjectIdString(participantId));
      const isCreator = toObjectIdString(participant._id) === toObjectIdString(creator._id);
      const isOwnTeamMember =
        EXECUTIVE_ROLES.includes(participant.role)
        && toObjectIdString(participant.parentId) === toObjectIdString(creator._id);

      if (!isCreator && !isOwnTeamMember) {
        throw createHttpError(
          403,
          "Leadership can create groups only with users from their own team",
        );
      }
    });

    teamId = creator._id;
  }

  if (creator.role === USER_ROLES.ADMIN && teamId) {
    finalParticipants.forEach((participantId) => {
      const participant = byId.get(toObjectIdString(participantId));
      const isCreator = toObjectIdString(participant._id) === toObjectIdString(creator._id);
      if (isCreator) {
        return;
      }

      const inTeam =
        toObjectIdString(participant._id) === toObjectIdString(teamId)
        || toObjectIdString(participant.parentId) === toObjectIdString(teamId);
      if (!inTeam) {
        throw createHttpError(403, "Admin team group cannot include cross-team users");
      }
    });
  }

  const room = await ChatRoom.create({
    type: CHAT_ROOM_TYPES.GROUP,
    name: cleanName,
    participants: finalParticipants,
    createdBy: creator._id,
    teamId: teamId || null,
    unreadCounts: buildDefaultUnreadCounts(finalParticipants),
  });

  const populatedRoom = await applyRoomPopulates(ChatRoom.findById(room._id)).lean();
  return toRoomDto(populatedRoom, creator._id);
};

const createOrGetLeadRoom = async ({ creator, leadId }) => {
  if (!leadId) {
    throw createHttpError(400, "Lead ID is required");
  }

  const leadContext = await resolveLeadChatContext(leadId);
  const creatorId = toObjectIdString(creator._id);

  if (!leadContext.participantIds.length) {
    throw createHttpError(
      400,
      "Lead chat requires assigned manager/executive/field executive participants",
    );
  }

  if (!leadContext.participantIds.includes(creatorId)) {
    throw createHttpError(403, "You are not assigned to this lead chat");
  }

  let room = await ChatRoom.findOne({
    type: CHAT_ROOM_TYPES.LEAD,
    leadId,
  });

  if (!room) {
    room = await ChatRoom.create({
      type: CHAT_ROOM_TYPES.LEAD,
      participants: leadContext.participantIds,
      createdBy: creator._id,
      leadId: leadContext.lead._id,
      teamId: leadContext.managerId || null,
      unreadCounts: buildDefaultUnreadCounts(leadContext.participantIds),
    });
  } else {
    const existingParticipantIds = uniqueIds(room.participants);
    const latestParticipantIds = uniqueIds(leadContext.participantIds);
    const hasParticipantChange =
      existingParticipantIds.length !== latestParticipantIds.length
      || existingParticipantIds.some((id) => !latestParticipantIds.includes(id));

    if (hasParticipantChange) {
      const unreadByUserId = new Map(
        (room.unreadCounts || []).map((row) => [
          toObjectIdString(row.user),
          Number(row.count || 0),
        ]),
      );

      room.participants = latestParticipantIds;
      room.unreadCounts = latestParticipantIds.map((participantId) => ({
        user: participantId,
        count: unreadByUserId.get(toObjectIdString(participantId)) || 0,
      }));
      room.teamId = leadContext.managerId || null;
      await room.save();
    }
  }

  const populatedRoom = await applyRoomPopulates(ChatRoom.findById(room._id)).lean();
  return toRoomDto(populatedRoom, creator._id);
};

const resolveBroadcastRecipients = async ({ creator, targetRole, targetTeamId }) => {
  const cleanTargetRole = sanitizeText(targetRole || "").toUpperCase() || null;
  const cleanTargetTeamId = targetTeamId || null;

  if (creator.role === USER_ROLES.ADMIN) {
    if (cleanTargetTeamId) {
      const recipients = await User.find({
        isActive: true,
        _id: { $ne: creator._id },
        $or: [
          { _id: cleanTargetTeamId, role: { $in: MANAGEMENT_ROLES } },
          { parentId: cleanTargetTeamId, role: { $in: EXECUTIVE_ROLES } },
        ],
      })
        .select("_id")
        .lean();

      return {
        recipientIds: recipients.map((user) => user._id),
        targetRole: cleanTargetRole,
        targetTeamId: cleanTargetTeamId,
      };
    }

    if (cleanTargetRole && cleanTargetRole !== BROADCAST_TARGET_ROLES.ALL_USERS) {
      if (
        ![
          ...MANAGEMENT_ROLES,
          USER_ROLES.EXECUTIVE,
          USER_ROLES.FIELD_EXECUTIVE,
        ].includes(cleanTargetRole)
      ) {
        throw createHttpError(400, "Invalid broadcast target role");
      }

      const recipients = await User.find({
        isActive: true,
        role: cleanTargetRole,
        _id: { $ne: creator._id },
      })
        .select("_id")
        .lean();

      return {
        recipientIds: recipients.map((user) => user._id),
        targetRole: cleanTargetRole,
        targetTeamId: null,
      };
    }

    const allRecipients = await User.find({
      isActive: true,
      _id: { $ne: creator._id },
    })
      .select("_id")
      .lean();

    return {
      recipientIds: allRecipients.map((user) => user._id),
      targetRole: cleanTargetRole || BROADCAST_TARGET_ROLES.ALL_USERS,
      targetTeamId: null,
    };
  }

  if (isManagerRole(creator.role)) {
    if (
      cleanTargetTeamId
      && toObjectIdString(cleanTargetTeamId) !== toObjectIdString(creator._id)
    ) {
      throw createHttpError(403, "Leadership can broadcast only to own team");
    }

    if (
      cleanTargetRole
      && ![
        USER_ROLES.EXECUTIVE,
        USER_ROLES.FIELD_EXECUTIVE,
        BROADCAST_TARGET_ROLES.ALL_USERS,
      ].includes(cleanTargetRole)
    ) {
      throw createHttpError(403, "Leadership can target only team executives/field executives");
    }

    const roleFilter =
      cleanTargetRole && cleanTargetRole !== BROADCAST_TARGET_ROLES.ALL_USERS
        ? { role: cleanTargetRole }
        : { role: { $in: EXECUTIVE_ROLES } };

    const recipients = await User.find({
      isActive: true,
      parentId: creator._id,
      ...roleFilter,
    })
      .select("_id")
      .lean();

    return {
      recipientIds: recipients.map((user) => user._id),
      targetRole: cleanTargetRole || BROADCAST_TARGET_ROLES.ALL_USERS,
      targetTeamId: creator._id,
    };
  }

  throw createHttpError(403, "Only admin or leadership roles can create broadcast messages");
};

const createBroadcastMessage = async ({
  creator,
  text,
  targetRole = null,
  targetTeamId = null,
}) => {
  const cleanText = sanitizeText(text);
  if (!cleanText) {
    throw createHttpError(400, "Message text is required");
  }
  if (cleanText.length > MAX_MESSAGE_LENGTH) {
    throw createHttpError(400, `Message too long (max ${MAX_MESSAGE_LENGTH} chars)`);
  }

  const resolution = await resolveBroadcastRecipients({
    creator,
    targetRole,
    targetTeamId,
  });

  if (!resolution.recipientIds.length) {
    throw createHttpError(400, "No recipients available for this broadcast");
  }

  const participants = uniqueIds([creator._id, ...resolution.recipientIds]);
  const room = await ChatRoom.create({
    type: CHAT_ROOM_TYPES.BROADCAST,
    name: "Broadcast",
    participants,
    createdBy: creator._id,
    teamId: resolution.targetTeamId || null,
    unreadCounts: buildDefaultUnreadCounts(participants),
    broadcastTarget: {
      targetRole: resolution.targetRole || null,
      targetTeamId: resolution.targetTeamId || null,
    },
  });

  const result = await appendMessageToRoom({
    room,
    sender: creator,
    text: cleanText,
  });

  return {
    room: toRoomDto(result.room, creator._id),
    message: toMessageDto(result.message),
    participantIds: result.participantIds,
  };
};

const sendRoomMessage = async ({
  sender,
  roomId,
  text,
  sharedProperty = null,
  mediaAttachments = [],
}) => {
  const outgoingMessage = await resolveOutgoingMessagePayload({
    sender,
    text,
    sharedProperty,
    mediaAttachments,
  });

  const room = await getRoomByIdForUser({
    user: sender,
    roomId,
    requireParticipantForSend: true,
  });

  if (
    room.type === CHAT_ROOM_TYPES.BROADCAST
    && toObjectIdString(room.createdBy?._id || room.createdBy) !== toObjectIdString(sender._id)
  ) {
    throw createHttpError(403, "Broadcast rooms are one-way. Replies are not allowed");
  }

  const result = await appendMessageToRoom({
    room,
    sender,
    text: outgoingMessage.text,
    type: outgoingMessage.type,
    sharedProperty: outgoingMessage.sharedProperty,
    mediaAttachments: outgoingMessage.mediaAttachments,
  });

  if (
    room.type === CHAT_ROOM_TYPES.ESCALATION
    && isExecutiveRole(sender.role)
  ) {
    await logEscalation({
      roomId: room._id,
      initiatedBy: sender._id,
      managerId: room.escalation?.managerToNotify || null,
      adminId: null,
      action: "ESCALATION_MESSAGE_POSTED",
      note: "Escalation message sent",
    });
  }

  return {
    room: toRoomDto(result.room, sender._id),
    message: toMessageDto(result.message),
    participantIds: result.participantIds,
    managerNotificationUserId: room.escalation?.managerToNotify
      ? toObjectIdString(room.escalation.managerToNotify)
      : null,
  };
};

const sendDirectMessage = async ({
  sender,
  text,
  roomId = null,
  recipientId = null,
  sharedProperty = null,
  mediaAttachments = [],
}) => {
  let resolvedRoomId = roomId;
  let managerNotificationUserId = null;

  if (!resolvedRoomId) {
    const direct = await createOrGetDirectRoom({
      initiator: sender,
      recipientId,
    });
    resolvedRoomId = direct.room._id;
    managerNotificationUserId = direct.managerNotificationUserId || null;
  }

  const result = await sendRoomMessage({
    sender,
    roomId: resolvedRoomId,
    text,
    sharedProperty,
    mediaAttachments,
  });

  return {
    ...result,
    managerNotificationUserId:
      managerNotificationUserId || result.managerNotificationUserId || null,
  };
};

const getRoomMessages = async ({ user, roomId, limit, before }) => {
  const room = await getRoomByIdForUser({ user, roomId });
  const resolvedLimit = toPositiveInt(limit, 60, 200);
  const query = { room: room._id };
  const createdAtQuery = {};
  const clearedAt = getUserClearedAt(room.clearedMessagesAt, user._id);

  if (clearedAt) {
    createdAtQuery.$gt = clearedAt;
  }

  if (before) {
    const beforeDate = new Date(before);
    if (!Number.isNaN(beforeDate.getTime())) {
      createdAtQuery.$lt = beforeDate;
    }
  }

  if (Object.keys(createdAtQuery).length > 0) {
    query.createdAt = createdAtQuery;
  }

  const messages = await applyMessagePopulates(
    ChatMessage.find(query).sort({ createdAt: -1 }).limit(resolvedLimit),
  ).lean();

  return messages.reverse().map(toMessageDto);
};

const markRoomAsRead = async ({ user, roomId }) => {
  const room = await getRoomByIdForUser({
    user,
    roomId,
    requireParticipantForSend: true,
  });

  resetUnreadCountForUser({ room, userId: user._id });
  await room.save();

  const seenQuery = {
    room: room._id,
    sender: { $ne: user._id },
    "seenBy.user": { $ne: user._id },
  };
  const clearedAt = getUserClearedAt(room.clearedMessagesAt, user._id);
  if (clearedAt) {
    seenQuery.createdAt = { $gt: clearedAt };
  }

  await ChatMessage.updateMany(
    seenQuery,
    {
      $push: { seenBy: { user: user._id, at: new Date() } },
    },
  );

  const populatedRoom = await applyRoomPopulates(ChatRoom.findById(room._id)).lean();
  return toRoomDto(populatedRoom, user._id);
};

const markMessageDelivered = async ({ user, messageId }) => {
  ensureObjectId(messageId, "message id");
  const message = await ChatMessage.findById(messageId);
  if (!message) {
    throw createHttpError(404, "Message not found");
  }

  const room = await getRoomByIdForUser({
    user,
    roomId: message.room,
    requireParticipantForSend: true,
  });

  const clearedAt = getUserClearedAt(room.clearedMessagesAt, user._id);
  if (isOnOrBeforeMarker({ value: message.createdAt, marker: clearedAt })) {
    throw createHttpError(404, "Message not found");
  }

  const alreadyDelivered = (message.deliveredTo || []).some(
    (row) => toObjectIdString(row.user) === toObjectIdString(user._id),
  );

  if (!alreadyDelivered) {
    message.deliveredTo.push({ user: user._id, at: new Date() });
    await message.save();
  }

  const populatedMessage = await applyMessagePopulates(ChatMessage.findById(message._id)).lean();
  return {
    roomId: room._id,
    message: toMessageDto(populatedMessage),
  };
};

const markMessageSeen = async ({ user, messageId }) => {
  ensureObjectId(messageId, "message id");
  const message = await ChatMessage.findById(messageId);
  if (!message) {
    throw createHttpError(404, "Message not found");
  }

  const room = await getRoomByIdForUser({
    user,
    roomId: message.room,
    requireParticipantForSend: true,
  });

  const clearedAt = getUserClearedAt(room.clearedMessagesAt, user._id);
  if (isOnOrBeforeMarker({ value: message.createdAt, marker: clearedAt })) {
    throw createHttpError(404, "Message not found");
  }

  const seenAt = new Date();

  const alreadyDelivered = (message.deliveredTo || []).some(
    (row) => toObjectIdString(row.user) === toObjectIdString(user._id),
  );
  if (!alreadyDelivered) {
    message.deliveredTo.push({ user: user._id, at: seenAt });
  }

  const alreadySeen = (message.seenBy || []).some(
    (row) => toObjectIdString(row.user) === toObjectIdString(user._id),
  );
  if (!alreadySeen) {
    message.seenBy.push({ user: user._id, at: seenAt });
  }
  await message.save();

  resetUnreadCountForUser({ room, userId: user._id });
  await room.save();

  const populatedMessage = await applyMessagePopulates(ChatMessage.findById(message._id)).lean();

  return {
    roomId: room._id,
    message: toMessageDto(populatedMessage),
  };
};

const listEscalationRooms = async ({ user }) => {
  const query = { type: CHAT_ROOM_TYPES.ESCALATION };

  if (!isAdminRole(user.role)) {
    query.$or = [
      { participants: user._id },
      { "escalation.managerToNotify": user._id },
    ];
  }

  const rooms = await applyRoomPopulates(
    ChatRoom.find(query).sort({ lastMessageAt: -1, updatedAt: -1 }),
  ).lean();

  return rooms.map((room) => toRoomDto(room, user._id));
};

const listEscalationLogs = async ({ user, roomId = null, limit = 80 }) => {
  const query = {};

  if (roomId) {
    const room = await ChatRoom.findById(roomId).select("_id type participants escalation");
    if (!room || room.type !== CHAT_ROOM_TYPES.ESCALATION) {
      throw createHttpError(404, "Escalation room not found");
    }

    const canView =
      isAdminRole(user.role)
      || (room.participants || []).some(
        (participantId) => toObjectIdString(participantId) === toObjectIdString(user._id),
      )
      || toObjectIdString(room.escalation?.managerToNotify)
        === toObjectIdString(user._id);

    if (!canView) {
      throw createHttpError(403, "You are not allowed to view this escalation log");
    }

    query.room = roomId;
  } else if (!isAdminRole(user.role)) {
    query.$or = [{ managerId: user._id }, { initiatedBy: user._id }];
  }

  const rows = await ChatEscalationLog.find(query)
    .sort({ createdAt: -1 })
    .limit(toPositiveInt(limit, 80, 300))
    .populate("initiatedBy", "name role")
    .populate("managerId", "name role")
    .populate("adminId", "name role")
    .lean();

  return rows;
};

module.exports = {
  createHttpError,
  toPositiveInt,
  getContactUsers,
  listRoomsForUser,
  createOrGetDirectRoom,
  createGroupRoom,
  createOrGetLeadRoom,
  createBroadcastMessage,
  sendRoomMessage,
  sendDirectMessage,
  getRoomMessages,
  markRoomAsRead,
  markMessageDelivered,
  markMessageSeen,
  listEscalationRooms,
  listEscalationLogs,
  getRoomByIdForUser,
};
