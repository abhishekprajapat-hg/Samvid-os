import { createRequire } from "node:module";
import { setTimeout as delay } from "node:timers/promises";
import { performance } from "node:perf_hooks";

const requireFromBackend = createRequire(new URL("../../backend/package.json", import.meta.url));
const { io } = requireFromBackend("socket.io-client");

const required = (name) => {
  const value = String(process.env[name] || "").trim();
  if (!value) {
    throw new Error(`${name} is required for isolated Socket.IO performance tests.`);
  }
  return value;
};

const envNumber = (name, fallback) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
};

const BASE_URL = required("BASE_URL").replace(/\/+$/, "");
const PERF_ENVIRONMENT = required("PERF_ENVIRONMENT");
const PERF_RUN_ID = required("PERF_RUN_ID");
const SENDER_ACCESS_TOKEN = required("SENDER_ACCESS_TOKEN");
const RECEIVER_ACCESS_TOKEN = required("RECEIVER_ACCESS_TOKEN");
const RECEIVER_USER_ID = required("RECEIVER_USER_ID");
const CONFIRM_ISOLATED = String(process.env.CONFIRM_ISOLATED_PERF_ENV || "").toLowerCase() === "true";
const SOCKET_PATH = process.env.SOCKET_PATH || "/socket.io";
const CLIENT_PAIRS = envNumber("SOCKET_CLIENT_PAIRS", 10);
const MESSAGES_PER_PAIR = envNumber("SOCKET_MESSAGES_PER_PAIR", 20);
const CONNECT_TIMEOUT_MS = envNumber("SOCKET_CONNECT_TIMEOUT_MS", 15000);
const ACK_TIMEOUT_MS = envNumber("SOCKET_ACK_TIMEOUT_MS", 5000);
const DELIVERY_WAIT_MS = envNumber("SOCKET_DELIVERY_WAIT_MS", 10000);
const DELIVERY_THRESHOLD = envNumber("SOCKET_DELIVERY_THRESHOLD", 0.99);
const RECONNECT_EVERY_MESSAGES = envNumber("SOCKET_RECONNECT_EVERY_MESSAGES", 0);
const SIMULATED_PACKET_LOSS_PERCENT = envNumber("SOCKET_SIMULATED_PACKET_LOSS_PERCENT", 0);

if (!CONFIRM_ISOLATED) {
  throw new Error("CONFIRM_ISOLATED_PERF_ENV=true is required so socket load cannot hit production by accident.");
}

if (!["performance", "staging", "isolated", "local-isolated"].includes(PERF_ENVIRONMENT)) {
  throw new Error("PERF_ENVIRONMENT must be one of: performance, staging, isolated, local-isolated.");
}

if (SIMULATED_PACKET_LOSS_PERCENT > 100) {
  throw new Error("SOCKET_SIMULATED_PACKET_LOSS_PERCENT must be 0-100.");
}

const sockets = [];
const expectedMessages = new Set();
const deliveredMessages = new Set();
const sentAt = new Map();
const deliveryLatencies = [];
const errors = [];
let connected = 0;
let connectFailures = 0;
let reconnects = 0;
let ackOk = 0;
let ackFailed = 0;
let simulatedDrops = 0;

const socketOptions = (token) => ({
  path: SOCKET_PATH,
  auth: { token },
  transports: ["websocket"],
  reconnection: true,
  reconnectionAttempts: 5,
  timeout: CONNECT_TIMEOUT_MS,
});

const connectSocket = (token, label) =>
  new Promise((resolve, reject) => {
    const socket = io(BASE_URL, socketOptions(token));
    sockets.push(socket);

    const timer = setTimeout(() => {
      connectFailures += 1;
      reject(new Error(`${label} did not connect within ${CONNECT_TIMEOUT_MS}ms`));
    }, CONNECT_TIMEOUT_MS);

    socket.on("connect", () => {
      clearTimeout(timer);
      connected += 1;
      resolve(socket);
    });

    socket.on("connect_error", (error) => {
      errors.push(`${label} connect_error: ${error.message}`);
    });

    socket.io.on("reconnect", () => {
      reconnects += 1;
    });
  });

const emitWithAck = (socket, event, payload) =>
  new Promise((resolve) => {
    socket.timeout(ACK_TIMEOUT_MS).emit(event, payload, (error, response) => {
      if (error || !response?.ok) {
        ackFailed += 1;
        resolve({ ok: false, error: error?.message || response?.error || "ack failed" });
        return;
      }
      ackOk += 1;
      resolve({ ok: true, response });
    });
  });

const maybeInjectPacketLoss = (receiver, sequence) => {
  if (!SIMULATED_PACKET_LOSS_PERCENT) return false;
  const bucket = (sequence * 37 + PERF_RUN_ID.length * 17) % 100;
  if (bucket >= SIMULATED_PACKET_LOSS_PERCENT) return false;
  simulatedDrops += 1;
  receiver.io.engine?.close();
  return true;
};

const waitForReconnect = async (socket) => {
  if (socket.connected) return;
  const start = Date.now();
  while (!socket.connected && Date.now() - start < CONNECT_TIMEOUT_MS) {
    await delay(100);
  }
};

const recordDelivery = (payload) => {
  const text = String(payload?.message?.text || payload?.text || "");
  if (!expectedMessages.has(text) || deliveredMessages.has(text)) return;
  deliveredMessages.add(text);
  const startedAt = sentAt.get(text);
  if (startedAt) {
    deliveryLatencies.push(performance.now() - startedAt);
  }
};

const percentile = (values, p) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[index];
};

const runPair = async (pairIndex) => {
  const receiver = await connectSocket(RECEIVER_ACCESS_TOKEN, `receiver-${pairIndex}`);
  receiver.on("chat:message:new", recordDelivery);
  receiver.on("messenger:message:new", recordDelivery);

  const sender = await connectSocket(SENDER_ACCESS_TOKEN, `sender-${pairIndex}`);

  for (let messageIndex = 0; messageIndex < MESSAGES_PER_PAIR; messageIndex += 1) {
    const text = `[perf:${PERF_RUN_ID}:pair:${pairIndex}:message:${messageIndex}]`;
    expectedMessages.add(text);
    sentAt.set(text, performance.now());

    if (RECONNECT_EVERY_MESSAGES > 0 && messageIndex > 0 && messageIndex % RECONNECT_EVERY_MESSAGES === 0) {
      receiver.io.engine?.close();
      sender.io.engine?.close();
      await Promise.all([waitForReconnect(receiver), waitForReconnect(sender)]);
    }

    maybeInjectPacketLoss(receiver, pairIndex * MESSAGES_PER_PAIR + messageIndex);
    await waitForReconnect(sender);

    const ack = await emitWithAck(sender, "chat:message:send", {
      recipientId: RECEIVER_USER_ID,
      text,
    });

    if (!ack.ok) {
      errors.push(`pair ${pairIndex} message ${messageIndex}: ${ack.error}`);
    }
  }
};

await Promise.all(Array.from({ length: CLIENT_PAIRS }, (_, index) => runPair(index)));
await delay(DELIVERY_WAIT_MS);

for (const socket of sockets) {
  socket.disconnect();
}

const expected = expectedMessages.size;
const delivered = deliveredMessages.size;
const deliveryRate = expected > 0 ? delivered / expected : 0;
const summary = {
  baseUrl: BASE_URL,
  environment: PERF_ENVIRONMENT,
  runId: PERF_RUN_ID,
  clientPairs: CLIENT_PAIRS,
  expectedConnections: CLIENT_PAIRS * 2,
  connected,
  connectFailures,
  reconnects,
  messagesAttempted: expected,
  ackOk,
  ackFailed,
  delivered,
  deliveryRate,
  deliveryRatePercent: Number((deliveryRate * 100).toFixed(3)),
  deliveryLatencyMs: {
    p50: Number(percentile(deliveryLatencies, 50).toFixed(2)),
    p95: Number(percentile(deliveryLatencies, 95).toFixed(2)),
    max: Number(Math.max(0, ...deliveryLatencies).toFixed(2)),
  },
  simulatedPacketLossPercent: SIMULATED_PACKET_LOSS_PERCENT,
  simulatedDrops,
  errors: errors.slice(0, 20),
};

console.log(JSON.stringify(summary, null, 2));

if (connected < CLIENT_PAIRS * 2) {
  process.exitCode = 1;
}

if (ackFailed > 0) {
  process.exitCode = 1;
}

if (deliveryRate < DELIVERY_THRESHOLD) {
  process.exitCode = 1;
}
