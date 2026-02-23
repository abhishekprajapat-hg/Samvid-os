const ChatCallHistory = require("../models/ChatCallHistory");
const { getRoomByIdForUser } = require("./chatRoom.service");
const { toObjectIdString, uniqueIds } = require("./chatAccess.service");

const CALL_MODES = new Set(["audio", "video"]);
const CALL_TERMINAL_STATUSES = new Set(["ended", "rejected", "missed", "failed"]);

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

const findCallHistoryRow = async ({ callId, roomId }) => {
  const normalizedCallId = String(callId || "").trim();
  const normalizedRoomId = toId(roomId);
  if (!normalizedCallId || !normalizedRoomId) return null;
  return ChatCallHistory.findOne({
    callId: normalizedCallId,
    room: normalizedRoomId,
  });
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

  return ChatCallHistory.findOneAndUpdate(
    {
      callId: normalizedCallId,
      room: normalizedRoomId,
    },
    {
      $setOnInsert: {
        participants,
        caller: callerId,
        mode: sanitizeMode(mode),
        status: "ringing",
        startedAt: now,
        durationSeconds: 0,
      },
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
  row.status = normalizedReason === "busy" ? "missed" : "rejected";
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

  const rows = await ChatCallHistory.find({
    room: room._id,
  })
    .sort({ startedAt: -1, createdAt: -1 })
    .limit(toPositiveInt(limit, 30, 200))
    .populate("caller", "name role")
    .populate("answeredBy", "name role")
    .populate("endedBy", "name role")
    .populate("participants", "name role")
    .lean();

  return rows.map(toCallHistoryDto);
};

module.exports = {
  recordCallInitiated,
  markCallAccepted,
  markCallRejected,
  markCallEnded,
  listConversationCallHistory,
};
