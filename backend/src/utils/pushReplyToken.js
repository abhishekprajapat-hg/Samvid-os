const jwt = require("jsonwebtoken");

/*
 * The credential a notification carries so it can be replied to.
 *
 * A service worker cannot read the access token: the CRM keeps it in
 * localStorage (see frontend/src/services/api.js) and no worker can reach that.
 * The alternative most apps reach for - parking a long-lived token in
 * IndexedDB, which a worker can read - leaves a full session sitting on disk
 * for anything on the origin to find. So the reply credential travels inside
 * the push payload instead: already encrypted end to end by the push service,
 * decrypted only on the device that subscribed, and never stored anywhere.
 *
 * It is deliberately the narrowest thing that still works - one user, one room,
 * expiring with the usefulness of the notification that carried it - and
 * authMiddleware.protect refuses any scoped token, so it can never stand in for
 * a session.
 */

const PUSH_REPLY_SCOPE = "push-reply";

// Matches the 24h TTL push.service sends with: a token that outlives the
// notification it arrived on is only extra exposure.
const getTtl = () => process.env.PUSH_REPLY_TOKEN_TTL || "24h";

const signPushReplyToken = ({ userId, roomId }) => jwt.sign(
  { id: String(userId), roomId: String(roomId), scope: PUSH_REPLY_SCOPE },
  process.env.JWT_SECRET,
  { expiresIn: getTtl() },
);

/**
 * @returns {{userId: string, roomId: string}|null} null for anything that is
 * not a live reply token - missing, malformed, expired, or a token minted for
 * some other purpose replayed here.
 */
const verifyPushReplyToken = (token) => {
  if (!token || typeof token !== "string") return null;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.scope !== PUSH_REPLY_SCOPE) return null;
    if (!decoded.id || !decoded.roomId) return null;
    return { userId: String(decoded.id), roomId: String(decoded.roomId) };
  } catch {
    return null;
  }
};

module.exports = { signPushReplyToken, verifyPushReplyToken, PUSH_REPLY_SCOPE };
