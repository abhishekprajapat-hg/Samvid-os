const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const {
  getOutgoingMessageStatus,
  applyRoomReadToMessages,
  hasUserAck,
  withAckUser,
  isMessageForConversation,
  matchesMessageSearch,
} = require("../.test-build/modules/chat/chatReceipts.js");

/*
 * Read receipts as web's TeamChat computes them. The tick a sender sees must
 * mean the same thing on both apps, or someone on a phone reads "seen" where
 * the desktop says "delivered".
 */

const ME = "u-me";
const THEM = "u-them";
const mine = (over = {}) => ({ _id: "m1", room: "r1", sender: { _id: ME }, deliveredTo: [], seenBy: [], ...over });

describe("getOutgoingMessageStatus", () => {
  test("nobody else has acked: one tick", () => {
    assert.equal(getOutgoingMessageStatus(mine(), ME), "sent");
  });
  test("my own ack does not count", () => {
    assert.equal(getOutgoingMessageStatus(mine({ seenBy: [{ user: ME }] }), ME), "sent");
  });
  test("delivered to the other side", () => {
    assert.equal(getOutgoingMessageStatus(mine({ deliveredTo: [{ user: THEM }] }), ME), "delivered");
  });
  test("seen wins over delivered", () => {
    assert.equal(getOutgoingMessageStatus(mine({ deliveredTo: [THEM], seenBy: [THEM] }), ME), "seen");
  });
});

describe("applyRoomReadToMessages", () => {
  test("the other side reading the room marks my messages seen", () => {
    const [row] = applyRoomReadToMessages({ rows: [mine()], roomId: "r1", readerUserId: THEM, currentUserId: ME });
    assert.equal(getOutgoingMessageStatus(row, ME), "seen");
  });
  test("my own read changes nothing", () => {
    const rows = [mine()];
    const [row] = applyRoomReadToMessages({ rows, roomId: "r1", readerUserId: ME, currentUserId: ME });
    assert.equal(row, rows[0]);
  });
  test("their messages are left alone", () => {
    const theirs = { _id: "m2", room: "r1", sender: { _id: THEM }, deliveredTo: [], seenBy: [] };
    const [row] = applyRoomReadToMessages({ rows: [theirs], roomId: "r1", readerUserId: THEM, currentUserId: ME });
    assert.equal(row, theirs);
  });
  test("another room's read does not leak in", () => {
    const [row] = applyRoomReadToMessages({ rows: [mine()], roomId: "r2", readerUserId: THEM, currentUserId: ME });
    assert.equal(getOutgoingMessageStatus(row, ME), "sent");
  });
});

test("withAckUser adds a user once", () => {
  const once = withAckUser([], THEM);
  assert.equal(withAckUser(once, THEM), once);
  assert.equal(hasUserAck(once, THEM), true);
});

test("a message with no room belongs to whichever conversation is open", () => {
  assert.equal(isMessageForConversation({ _id: "x" }, "r9"), true);
  assert.equal(isMessageForConversation({ _id: "x", room: "r1" }, "r9"), false);
});

test("message search reads text, file names and shared properties", () => {
  assert.equal(matchesMessageSearch({ text: "Site visit at 4" }, "visit"), true);
  assert.equal(matchesMessageSearch({ text: "", attachment: { fileName: "Brochure.pdf" } }, "brochure"), true);
  assert.equal(matchesMessageSearch({ text: "", sharedProperty: { title: "Skye Tower" } }, "skye"), true);
  assert.equal(matchesMessageSearch({ text: "hello" }, "bye"), false);
});
