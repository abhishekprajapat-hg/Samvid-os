const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const http = require("node:http");
const { createRequire } = require("node:module");

process.env.JWT_SECRET = process.env.JWT_SECRET || "push-reply-test-secret";

const jwt = require("jsonwebtoken");
const {
  signPushReplyToken,
  verifyPushReplyToken,
  PUSH_REPLY_SCOPE,
} = require("../src/utils/pushReplyToken");

const userId = "111111111111111111111111";
const roomId = "222222222222222222222222";

// Same isolation approach as page-access.test.cjs: the real modules, stubbed
// repositories, never a database.
const load = (relative, stubs = {}) => {
  const filename = path.resolve(__dirname, "../src", relative);
  const localRequire = createRequire(filename);
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(filename, "utf8"), {
    module,
    exports: module.exports,
    require: (name) => (name in stubs ? stubs[name] : localRequire(name)),
    process,
    console,
    Date,
    setTimeout,
    clearTimeout,
  }, { filename });
  return module.exports;
};

/* --------------------------------------------------------------- token --- */

test("a reply token round-trips to the user and room it was minted for", () => {
  assert.deepEqual(
    verifyPushReplyToken(signPushReplyToken({ userId, roomId })),
    { userId, roomId },
  );
});

test("a reply token is refused once it has expired", () => {
  const expired = jwt.sign(
    { id: userId, roomId, scope: PUSH_REPLY_SCOPE },
    process.env.JWT_SECRET,
    { expiresIn: -10 },
  );
  assert.equal(verifyPushReplyToken(expired), null);
});

test("a token minted for anything else is refused as a reply token", () => {
  // A staff access token (utils/generateToken carries no scope) and a
  // client-portal token both verify against this very same secret.
  assert.equal(verifyPushReplyToken(jwt.sign({ id: userId, role: "ADMIN" }, process.env.JWT_SECRET)), null);
  assert.equal(verifyPushReplyToken(jwt.sign({ id: userId, scope: "client-portal" }, process.env.JWT_SECRET)), null);
});

test("nonsense and a foreign signature are refused", () => {
  assert.equal(verifyPushReplyToken(""), null);
  assert.equal(verifyPushReplyToken(null), null);
  assert.equal(verifyPushReplyToken("not-a-token"), null);
  assert.equal(
    verifyPushReplyToken(jwt.sign({ id: userId, roomId, scope: PUSH_REPLY_SCOPE }, "someone-elses-secret")),
    null,
    "a token signed with another secret must not be accepted",
  );
});

/* ---------------------------------------------------- privilege escalation */

test("a reply token can never stand in for a session", async () => {
  const refuse = (what) => () => { throw new Error(`protect must reject before any ${what} lookup`); };
  const auth = load("middleware/auth.middleware.js", {
    "../models/User": { findById: refuse("user") },
    "../models/Company": { findById: refuse("company") },
  });

  let status = 0;
  let nexted = false;
  const res = { status(code) { status = code; return res; }, json() { return res; } };

  await auth.protect(
    { headers: { authorization: `Bearer ${signPushReplyToken({ userId, roomId })}` } },
    res,
    () => { nexted = true; },
  );

  assert.equal(nexted, false, "a push-reply token must never authenticate a CRM session");
  assert.equal(status, 401);
});

/* ------------------------------------------------ replying from the drawer */

const makeRes = () => {
  const out = { status: 0, body: null };
  const res = {
    out,
    status(code) { out.status = code; return res; },
    json(body) { out.body = body; return res; },
  };
  return res;
};

const loadChatController = ({ sendRoomMessage, user = null, pushes = [] }) =>
  load("controllers/chat.controller.js", {
    "../services/chatRoom.service": { sendRoomMessage },
    "../models/User": { findById: () => ({ select: async () => user }) },
    "../services/push.service": { notify: (id, notification) => pushes.push({ id, notification }) },
  });

const mustNotSend = async () => { throw new Error("no message may be sent"); };

test("a drawer reply goes through the same path as one typed in the app", async () => {
  let sent = null;
  const controller = loadChatController({
    sendRoomMessage: async (args) => {
      sent = args;
      return { room: { _id: roomId }, message: { sender: { _id: userId } }, participantIds: [userId] };
    },
    user: { _id: userId, isActive: true, role: "MANAGER" },
  });

  const res = makeRes();
  await controller.replyFromNotification(
    { body: { token: signPushReplyToken({ userId, roomId }), text: "  on my way  " }, app: { get: () => null } },
    res,
  );

  assert.equal(res.out.status, 201);
  assert.equal(sent.text, "on my way", "surrounding whitespace is trimmed");
  assert.equal(String(sent.sender._id), userId);
});

test("the room and sender come from the token, never from the request body", async () => {
  let sent = null;
  const controller = loadChatController({
    sendRoomMessage: async (args) => {
      sent = args;
      return { room: { _id: roomId }, message: { sender: { _id: userId } }, participantIds: [userId] };
    },
    user: { _id: userId, isActive: true, role: "MANAGER" },
  });

  await controller.replyFromNotification(
    {
      body: {
        token: signPushReplyToken({ userId, roomId }),
        text: "hello",
        // A caller trying to redirect the reply into a room they were never in.
        roomId: "999999999999999999999999",
        userId: "888888888888888888888888",
      },
      app: { get: () => null },
    },
    makeRes(),
  );

  assert.equal(sent.roomId, roomId);
  assert.equal(String(sent.sender._id), userId);
});

test("a missing, unreadable or expired token sends nothing", async () => {
  const controller = loadChatController({ sendRoomMessage: mustNotSend });

  for (const body of [{ text: "hi" }, { token: "not-a-token", text: "hi" }, { token: "", text: "hi" }]) {
    const res = makeRes();
    // eslint-disable-next-line no-await-in-loop
    await controller.replyFromNotification({ body, app: { get: () => null } }, res);
    assert.equal(res.out.status, 401, `expected 401 for ${JSON.stringify(body)}`);
  }
});

test("an empty reply is refused", async () => {
  const controller = loadChatController({
    sendRoomMessage: mustNotSend,
    user: { _id: userId, isActive: true },
  });

  const res = makeRes();
  await controller.replyFromNotification(
    { body: { token: signPushReplyToken({ userId, roomId }), text: "   " }, app: { get: () => null } },
    res,
  );
  assert.equal(res.out.status, 400);
});

test("a deactivated account cannot reply from a notification it still holds", async () => {
  const controller = loadChatController({
    sendRoomMessage: mustNotSend,
    user: { _id: userId, isActive: false },
  });

  const res = makeRes();
  await controller.replyFromNotification(
    { body: { token: signPushReplyToken({ userId, roomId }), text: "hi" }, app: { get: () => null } },
    res,
  );
  assert.equal(res.out.status, 401);
});

test("each recipient's notification carries a token minted for that recipient alone", async () => {
  const pushes = [];
  const alice = "333333333333333333333333";
  const bob = "444444444444444444444444";

  const controller = loadChatController({
    sendRoomMessage: async () => ({
      room: { _id: roomId },
      message: { sender: { _id: userId, name: "Sender" }, text: "hello" },
      participantIds: [userId, alice, bob],
    }),
    pushes,
  });

  await controller.sendRoomMessage(
    { user: { _id: userId }, params: { roomId }, body: { text: "hello" }, app: { get: () => null } },
    makeRes(),
  );

  assert.equal(pushes.length, 2, "the sender must not be notified about their own message");
  assert.deepEqual(pushes.map((p) => String(p.id)).sort(), [alice, bob].sort());

  pushes.forEach((push) => {
    const claims = verifyPushReplyToken(push.notification.data.replyToken);
    assert.equal(claims.userId, String(push.id), "a token must only ever let its own recipient reply");
    assert.equal(claims.roomId, roomId);
  });
});

/* ------------------------------------------------------------- mounting -- */

const listen = () => new Promise((resolve) => {
  const server = http.createServer(require("../src/app"));
  server.listen(0, "127.0.0.1", () => resolve(server));
});

const postStatus = (server, route) => new Promise((resolve, reject) => {
  const body = JSON.stringify({ text: "hi" });
  const request = http.request(
    {
      host: "127.0.0.1",
      port: server.address().port,
      path: route,
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
    },
    (response) => { response.resume(); response.on("end", () => resolve(response.statusCode)); },
  );
  request.on("error", reject);
  request.end(body);
});

test("the reply route is mounted in both namespaces and refuses a request with no token", async () => {
  const server = await listen();
  try {
    for (const route of ["/api/push/reply", "/api/client/push/reply"]) {
      // eslint-disable-next-line no-await-in-loop
      const status = await postStatus(server, route);
      assert.notEqual(status, 404, `POST ${route} is not mounted`);
      assert.equal(status, 401, `POST ${route} must refuse a request carrying no reply token`);
    }
  } finally {
    server.close();
  }
});
