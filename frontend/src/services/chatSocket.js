import { io } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || window.location.origin;
const SOCKET_PATH = import.meta.env.VITE_SOCKET_PATH || "/socket.io";
const SOCKET_DISABLED = String(import.meta.env.VITE_DISABLE_SOCKET || "").toLowerCase() === "true";

const createDisabledSocket = () => ({
  connected: false,
  on() { return this; },
  off() { return this; },
  once() { return this; },
  emit(_event, _payload, ack) {
    if (typeof ack === "function") ack({ ok: false, error: "Realtime disabled" });
    return this;
  },
  removeAllListeners() { return this; },
  disconnect() { return this; },
});

const buildSocketOptions = (token) => ({
  path: SOCKET_PATH,
  transports: ["websocket", "polling"],
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 700,
  reconnectionDelayMax: 6000,
  timeout: 10000,
  auth: (callback) => {
    const latestToken =
      typeof window !== "undefined"
        ? localStorage.getItem("token")
        : "";
    callback({
      token: latestToken || token,
    });
  },
});

export const createChatSocket = (token) =>
  SOCKET_DISABLED ? createDisabledSocket() : io(SOCKET_URL, buildSocketOptions(token));

let sharedSocket = null;
let sharedToken = "";
let sharedRefCount = 0;

export const acquireChatSocket = (token) => {
  const normalizedToken = String(token || "").trim();
  if (!normalizedToken) return null;

  if (sharedSocket && sharedToken === normalizedToken) {
    sharedRefCount += 1;
    return sharedSocket;
  }

  if (sharedSocket) {
    sharedSocket.removeAllListeners();
    sharedSocket.disconnect();
  }

  sharedToken = normalizedToken;
  sharedRefCount = 1;
  sharedSocket = createChatSocket(normalizedToken);
  return sharedSocket;
};

export const releaseChatSocket = (socket) => {
  if (!socket || socket !== sharedSocket) {
    socket?.disconnect?.();
    return;
  }

  sharedRefCount = Math.max(0, sharedRefCount - 1);
  if (sharedRefCount > 0) return;

  sharedSocket.removeAllListeners();
  sharedSocket.disconnect();
  sharedSocket = null;
  sharedToken = "";
};
