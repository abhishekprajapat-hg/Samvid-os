const ChatCallHistory = require("../models/ChatCallHistory");
const mongoose = require("mongoose");
const { getRoomByIdForUser } = require("./chatRoom.service");
const { toObjectIdString, uniqueIds } = require("./chatAccess.service");

const CALL_MODES = new Set(["audio", "video"]);
const CALL_TERMINAL_STATUSES = new Set(["ended", "rejected", "missed", "failed"]);
const ACTIVE_CALL_STATUSES = new Set(["ringing", "connected"]);

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
        _id: toId(user._id),
        name: String(user.name || "").trim(),
        role: String(user.role || "").trim(),
      }
    : null;

const toCallHistoryDto = (row) => ({
  _id: toId(row?._id),
  callId: String(row?.callId || "").trim(),
  roomId: toId(row?.room?._id || row?.room),
  mode: sanitizeMode(row?.mode),
  status: String(row?.status || "").trim(),
  caller: toUserDto(row?.caller),
  answeredBy: toUserDto(row?.answeredBy),
  endedBy: toUserDto(row?.endedBy),
  endReason: String(row?.endReason || "").trim(),
  participants: Array.isArray(row?.participants)
    ? row.participants
        .map((participant) => toUserDto(participant))
        .filter(Boolean)
    : [],
  startedAt: row?.startedAt || row?.createdAt || null,
  answeredAt: row?.answeredAt || null,
  endedAt: row?.endedAt || null,
  durationSeconds: Math.max(0, Number(row?.durationSeconds || 0)),
  createdAt: row?.createdAt || null,
  updatedAt: row?.updatedAt || null,
});

const calculateDurationSeconds = (fromDate, toDate) => {
  const start = fromDate instanceof Date ? fromDate : new Date(fromDate || 0);
  const end = toDate instanceof Date ? toDate : new Date(toDate || 0);
  const delta = Math.round((end.getTime() - start.getTime()) / 1000);
  return Math.max(0, Number.isFinite(delta) ? delta : 0);
};

const resolveParticipantsFromRoom = (room, callerId = "") => {
  const participantIds = uniqueIds(
    (room?.participants || []).map((participant) => participant?._id || participant),
  );
  const normalizedCallerId = toId(callerId);
  if (normalizedCallerId && !participantIds.includes(normalizedCallerId)) {
    participantIds.push(normalizedCallerId);
  }
  return participantIds;
};

const getUserClearedAt = (rows, userId) => {
  const id = toId(userId);
  if (!id || !Array.isArray(rows)) return null;
  const row = rows.find((item) => toId(item?.user) === id);
  if (!row?.at) return null;
  const marker = new Date(row.at);
  return Number.isNaN(marker.getTime()) ? null : marker;
};

const findCallHistoryRow = async ({ callId, roomId }) => {
  const normalizedCallId = String(callId || "").trim();
  const normalizedRoomId = toId(roomId);
  if (!normalizedCallId || !normalizedRoomId) return null;
  return ChatCallHistory.findOne({
    callId: normalizedCallId,
    room: normalizedRoomId,
  });
};

const populateCallHistoryRow = (query) =>
  query
    .populate("caller", "name role")
    .populate("answeredBy", "name role")
    .populate("endedBy", "name role")
    .populate("participants", "name role");

const findCallHistoryRowByPublicId = async (callId) => {
  const normalizedCallId = String(callId || "").trim();
  if (!normalizedCallId) return null;

  const criteria = [{ callId: normalizedCallId }];
  if (mongoose.Types.ObjectId.isValid(normalizedCallId)) {
    criteria.push({ _id: normalizedCallId });
  }

  return ChatCallHistory.findOne({ $or: criteria });
};

const findActiveCallForParticipants = async ({ participantIds = [], excludeCallId = "" }) => {
  const ids = uniqueIds(participantIds);
  if (!ids.length) return null;

  const query = {
    participants: { $in: ids },
    status: { $in: [...ACTIVE_CALL_STATUSES] },
  };
  const normalizedExcludeCallId = String(excludeCallId || "").trim();
  if (normalizedExcludeCallId) {
    query.callId = { $ne: normalizedExcludeCallId };
  }

  return ChatCallHistory.findOne(query).sort({ startedAt: -1 });
};

const recordCallInitiated = async ({
  callId,
  room,
  caller,
  mode = "audio",
  startedAt = new Date(),
}) => {
  const normalizedCallId = String(callId || "").trim();
  const normalizedRoomId = toId(room?._id || room);
  const callerId = toId(caller?._id || caller);
  if (!normalizedCallId || !normalizedRoomId || !callerId) {
    return null;
  }

  const participants = resolveParticipantsFromRoom(room, callerId);
  const now = startedAt instanceof Date ? startedAt : new Date(startedAt || Date.now());
  const setOnInsert = {
    participants,
    caller: callerId,
    mode: sanitizeMode(mode),
    status: "ringing",
    startedAt: now,
    durationSeconds: 0,
  };
  if (mongoose.Types.ObjectId.isValid(normalizedCallId)) {
    setOnInsert._id = new mongoose.Types.ObjectId(normalizedCallId);
  }

  return ChatCallHistory.findOneAndUpdate(
    {
      callId: normalizedCallId,
      room: normalizedRoomId,
    },
    {
      $setOnInsert: setOnInsert,
    },
    { new: true, upsert: true },
  );
};

const markCallAccepted = async ({
  callId,
  roomId,
  userId,
  answeredAt = new Date(),
}) => {
  const row = await findCallHistoryRow({ callId, roomId });
  if (!row) return null;
  if (CALL_TERMINAL_STATUSES.has(String(row.status || "").trim().toLowerCase())) {
    return row;
  }

  const now = answeredAt instanceof Date ? answeredAt : new Date(answeredAt || Date.now());
  row.status = "connected";
  if (!row.answeredAt) {
    row.answeredAt = now;
  }
  if (!row.answeredBy && userId) {
    row.answeredBy = toId(userId);
  }
  await row.save();
  return row;
};

const markCallRejected = async ({
  callId,
  roomId,
  userId,
  reason = "rejected",
  endedAt = new Date(),
}) => {
  const row = await findCallHistoryRow({ callId, roomId });
  if (!row) return null;
  if (CALL_TERMINAL_STATUSES.has(String(row.status || "").trim().toLowerCase())) {
    return row;
  }

  const now = endedAt instanceof Date ? endedAt : new Date(endedAt || Date.now());
  const normalizedReason = sanitizeReason(reason) || "rejected";
  if (normalizedReason === "failed") {
    row.status = "failed";
  } else if (["busy", "missed", "no-answer", "no_answer"].includes(normalizedReason)) {
    row.status = "missed";
  } else {
    row.status = "rejected";
  }
  row.endReason = normalizedReason;
  row.endedAt = now;
  row.endedBy = userId ? toId(userId) : null;
  row.durationSeconds = calculateDurationSeconds(row.startedAt, now);
  await row.save();
  return row;
};

const markCallEnded = async ({
  callId,
  roomId,
  userId,
  reason = "ended",
  endedAt = new Date(),
}) => {
  const row = await findCallHistoryRow({ callId, roomId });
  if (!row) return null;
  if (CALL_TERMINAL_STATUSES.has(String(row.status || "").trim().toLowerCase())) {
    return row;
  }

  const now = endedAt instanceof Date ? endedAt : new Date(endedAt || Date.now());
  const normalizedReason = sanitizeReason(reason) || "ended";

  if (row.status === "ringing") {
    row.status = "missed";
  } else if (row.status === "connected") {
    row.status = "ended";
  } else {
    row.status = "ended";
  }

  row.endReason = normalizedReason;
  row.endedAt = now;
  row.endedBy = userId ? toId(userId) : null;

  const durationStart = row.answeredAt || row.startedAt;
  row.durationSeconds = calculateDurationSeconds(durationStart, now);
  await row.save();
  return row;
};

const listConversationCallHistory = async ({ user, roomId, limit = 30 }) => {
  const room = await getRoomByIdForUser({
    user,
    roomId,
  });

  const query = { room: room._id };
  const clearedAt = getUserClearedAt(room.clearedCallsAt, user._id);
  if (clearedAt) {
    query.startedAt = { $gt: clearedAt };
  }

  const rows = await ChatCallHistory.find(query)
    .sort({ startedAt: -1, createdAt: -1 })
    .limit(toPositiveInt(limit, 30, 200))
    .populate("caller", "name role")
    .populate("answeredBy", "name role")
    .populate("endedBy", "name role")
    .populate("participants", "name role")
    .lean();

  return rows.map(toCallHistoryDto);
};

const normalizeRequestedCallMode = (value) => {
  const mode = String(value || "").trim().toUpperCase();
  return mode === "VIDEO" || mode === "video" ? "video" : "audio";
};

const createHttpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const startCallForUser = async ({ user, roomId, mode = "audio" }) => {
  const room = await getRoomByIdForUser({
    user,
    roomId,
    requireParticipantForSend: true,
  });
  const callId = new mongoose.Types.ObjectId().toString();
  return startCallForUserWithId({ user, roomId: room._id, callId, mode });
};

const startCallForUserWithId = async ({ user, roomId, callId, mode = "audio" }) => {
  const normalizedCallId = String(callId || "").trim() || new mongoose.Types.ObjectId().toString();
  if (!mongoose.Types.ObjectId.isValid(normalizedCallId)) {
    throw createHttpError(400, "Invalid call ID");
  }

  const room = await getRoomByIdForUser({
    user,
    roomId,
    requireParticipantForSend: true,
  });
  const participantIds = resolveParticipantsFromRoom(room, user._id);
  const busyCall = await findActiveCallForParticipants({
    participantIds: participantIds.filter((participantId) => participantId !== toId(user._id)),
    excludeCallId: normalizedCallId,
  });
  if (busyCall) {
    throw createHttpError(409, "Recipient is busy on another call");
  }

  const row = await recordCallInitiated({
    callId: normalizedCallId,
    room,
    caller: user,
    mode: normalizeRequestedCallMode(mode),
  });
  const populated = await populateCallHistoryRow(ChatCallHistory.findById(row._id)).lean();
  return {
    conversationId: toId(room._id),
    call: toCallHistoryDto(populated),
  };
};

const updateCallForUser = async ({ user, callId, status = "", reason = "" }) => {
  const row = await findCallHistoryRowByPublicId(callId);
  if (!row) {
    throw createHttpError(404, "Call not found");
  }

  const room = await getRoomByIdForUser({
    user,
    roomId: row.room,
    requireParticipantForSend: true,
  });

  const normalizedStatus = String(status || "").trim().toUpperCase();
  let updated = row;
  if (normalizedStatus === "ACCEPTED" || normalizedStatus === "CONNECTED") {
    updated = await markCallAccepted({
      callId: row.callId,
      roomId: row.room,
      userId: user._id,
    });
  } else if (
    normalizedStatus === "REJECTED"
    || normalizedStatus === "MISSED"
    || normalizedStatus === "FAILED"
  ) {
    updated = await markCallRejected({
      callId: row.callId,
      roomId: row.room,
      userId: user._id,
      reason: reason || normalizedStatus.toLowerCase(),
    });
  } else if (normalizedStatus === "ENDED" || normalizedStatus === "END") {
    updated = await markCallEnded({
      callId: row.callId,
      roomId: row.room,
      userId: user._id,
      reason: reason || "ended",
    });
  } else {
    throw createHttpError(400, "Invalid call status");
  }

  const populated = await populateCallHistoryRow(ChatCallHistory.findById(updated._id)).lean();
  return {
    conversationId: toId(room._id),
    call: toCallHistoryDto(populated),
  };
};

const normalizeSignalPayload = (signal) => {
  if (!signal || typeof signal !== "object" || Array.isArray(signal)) {
    throw createHttpError(400, "Signal payload is required");
  }

  const type = String(signal.type || "").trim().toLowerCase();
  if (type === "offer" || type === "answer") {
    const sdp = String(signal.sdp || "");
    if (!sdp || sdp.length > 200000) {
      throw createHttpError(400, "Invalid SDP payload");
    }
    return {
      type,
      sdp,
    };
  }

  if (type === "candidate" || type === "ice-candidate") {
    const candidateInput = signal.candidate && typeof signal.candidate === "object"
      ? signal.candidate
      : signal;
    const candidate = String(candidateInput?.candidate || "").trim();
    if (!candidate || candidate.length > 8192) {
      throw createHttpError(400, "Invalid ICE candidate payload");
    }
    return {
      type: "candidate",
      candidate: {
        candidate,
        sdpMid: typeof candidateInput?.sdpMid === "string" ? candidateInput.sdpMid : null,
        sdpMLineIndex: Number.isInteger(candidateInput?.sdpMLineIndex)
          ? candidateInput.sdpMLineIndex
          : null,
        usernameFragment:
          typeof candidateInput?.usernameFragment === "string"
            ? candidateInput.usernameFragment.slice(0, 256)
            : undefined,
      },
    };
  }

  throw createHttpError(400, "Unsupported call signal type");
};

const getAuthorizedCallSignalContext = async ({
  user,
  callId,
  roomId = "",
  targetUserId = "",
  signal,
}) => {
  const row = await findCallHistoryRowByPublicId(callId);
  if (!row) {
    throw createHttpError(404, "Call not found");
  }

  const requestedRoomId = toId(roomId);
  if (requestedRoomId && requestedRoomId !== toId(row.room)) {
    throw createHttpError(403, "Call does not belong to this conversation");
  }

  const room = await getRoomByIdForUser({
    user,
    roomId: row.room,
    requireParticipantForSend: true,
  });

  const participantIds = resolveParticipantsFromRoom(room, row.caller);
  const senderId = toId(user._id);
  let normalizedTargetUserId = toId(targetUserId);
  if (!participantIds.includes(senderId)) {
    throw createHttpError(403, "Caller is not a call participant");
  }
  if (!normalizedTargetUserId) {
    const otherParticipants = participantIds.filter((participantId) => participantId !== senderId);
    if (otherParticipants.length === 1) {
      normalizedTargetUserId = otherParticipants[0];
    }
  }
  if (!normalizedTargetUserId || normalizedTargetUserId === senderId) {
    throw createHttpError(400, "Target participant is required");
  }
  if (!participantIds.includes(normalizedTargetUserId)) {
    throw createHttpError(403, "Target is not a call participant");
  }
  if (CALL_TERMINAL_STATUSES.has(String(row.status || "").trim().toLowerCase())) {
    throw createHttpError(409, "Call has already ended");
  }

  return {
    call: toCallHistoryDto(await populateCallHistoryRow(ChatCallHistory.findById(row._id)).lean()),
    room,
    participantIds,
    senderId,
    targetUserId: normalizedTargetUserId,
    signal: normalizeSignalPayload(signal),
  };
};

module.exports = {
  getAuthorizedCallSignalContext,
  recordCallInitiated,
  markCallAccepted,
  markCallRejected,
  markCallEnded,
  listConversationCallHistory,
  startCallForUser,
  startCallForUserWithId,
  updateCallForUser,
};
