import { io } from "socket.io-client";
import { setTimeout as delay } from "node:timers/promises";

const BASE_URL = process.env.BASE_URL || "http://localhost:5000";
const ACCESS_TOKEN = process.env.ACCESS_TOKEN || "";
const CLIENTS = Number(process.env.SOCKET_CLIENTS || 25);
const DURATION_MS = Number(process.env.SOCKET_DURATION_MS || 120000);

if (!ACCESS_TOKEN) {
  throw new Error("ACCESS_TOKEN is required for socket load tests");
}

let connected = 0;
let delivered = 0;
let reconnects = 0;
const sockets = [];

for (let index = 0; index < CLIENTS; index += 1) {
  const socket = io(BASE_URL, {
    path: "/socket.io",
    auth: { token: ACCESS_TOKEN },
    transports: ["websocket"],
    reconnection: true,
  });

  socket.on("connect", () => {
    connected += 1;
  });
  socket.io.on("reconnect", () => {
    reconnects += 1;
  });
  socket.onAny(() => {
    delivered += 1;
  });
  sockets.push(socket);
}

await delay(DURATION_MS);

for (const socket of sockets) {
  socket.disconnect();
}

console.log(JSON.stringify({ connected, delivered, reconnects, clients: CLIENTS }, null, 2));

if (connected < CLIENTS) {
  process.exitCode = 1;
}
