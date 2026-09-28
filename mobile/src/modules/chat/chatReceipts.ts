/*
 * Read receipts and typing, as web's TeamChat.jsx computes them.
 *
 * A message carries `deliveredTo` and `seenBy`, one row per user who has
 * acknowledged it. The sender's tick is worked out from whether anyone *other*
 * than the sender is in those lists - one tick sent, two delivered, two in
 * colour seen. Kept free of React so the rules can be tested on their own; see
 * test/chatReceipts.test.cjs.
 */

export const TYPING_IDLE_TIMEOUT_MS = 1200;
export const REMOTE_TYPING_TIMEOUT_MS = 3200;
export const ROOM_READ_EMIT_THROTTLE_MS = 1000;

type AckRow = { user?: string; _id?: string; at?: string } | string | null | undefined;

type ReceiptMessage = {
  _id?: string;
  sender?: { _id?: string } | string;
  deliveredTo?: AckRow[];
  seenBy?: AckRow[];
  room?: string;
  conversation?: string;
};

export const toId = (value: unknown) => String(value || "").trim();

const rowUserId = (row: AckRow) =>
  toId(typeof row === "object" && row ? row.user || row._id : row);

export const hasUserAck = (rows: AckRow[] | undefined, userId: string) => {
  const normalized = toId(userId);
  if (!normalized || !Array.isArray(rows)) return false;
  return rows.some((row) => rowUserId(row) === normalized);
};

export const hasOtherUserAck = (rows: AckRow[] | undefined, currentUserId: string) => {
  const current = toId(currentUserId);
  if (!Array.isArray(rows)) return false;
  return rows.some((row) => {
    const id = rowUserId(row);
    return Boolean(id) && id !== current;
  });
};

export const withAckUser = (rows: AckRow[] | undefined, userId: string): AckRow[] => {
  const normalized = toId(userId);
  const list = Array.isArray(rows) ? rows : [];
  if (!normalized || hasUserAck(list, normalized)) return list;
  return [...list, { user: normalized, at: new Date().toISOString() }];
};

export const senderIdOf = (message: ReceiptMessage) =>
  toId(typeof message?.sender === "object" ? message.sender?._id : message?.sender);

export const isMessageForConversation = (message: ReceiptMessage, conversationId: string) => {
  const messageConversationId = toId(message?.room || message?.conversation);
  const target = toId(conversationId);
  if (!target) return false;
  if (!messageConversationId) return true;
  return messageConversationId === target;
};

export type OutgoingStatus = "sent" | "delivered" | "seen";

export const getOutgoingMessageStatus = (message: ReceiptMessage, currentUserId: string): OutgoingStatus => {
  if (hasOtherUserAck(message?.seenBy, currentUserId)) return "seen";
  if (hasOtherUserAck(message?.deliveredTo, currentUserId)) return "delivered";
  return "sent";
};

/* Someone read the room: every message I sent in it now counts as seen by them. */
export const applyRoomReadToMessages = <T extends ReceiptMessage>({
  rows,
  roomId,
  readerUserId,
  currentUserId,
}: {
  rows: T[];
  roomId: string;
  readerUserId: string;
  currentUserId: string;
}): T[] => {
  const reader = toId(readerUserId);
  const current = toId(currentUserId);
  if (!toId(roomId) || !reader) return rows;
  return rows.map((message) => {
    if (!isMessageForConversation(message, roomId)) return message;
    if (senderIdOf(message) !== current || reader === current) return message;
    return {
      ...message,
      deliveredTo: withAckUser(message.deliveredTo, reader),
      seenBy: withAckUser(message.seenBy, reader),
    };
  });
};

/* Messages matching a search, as web filters its timeline. */
export const matchesMessageSearch = (
  message: { text?: string; attachment?: { fileName?: string } | null; sharedProperty?: { title?: string; location?: string } | null },
  query: string,
) => {
  const term = String(query || "").trim().toLowerCase();
  if (!term) return true;
  return [
    message.text,
    message.attachment?.fileName,
    message.sharedProperty?.title,
    message.sharedProperty?.location,
  ]
    .map((value) => String(value || "").toLowerCase())
    .some((value) => value.includes(term));
};
