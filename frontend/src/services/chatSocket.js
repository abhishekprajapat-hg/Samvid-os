import { io } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || window.location.origin;
const SOCKET_PATH = import.meta.env.VITE_SOCKET_PATH || "/socket.io";

export const createChatSocket = (token) =>
  io(SOCKET_URL, {
    path: SOCKET_PATH,
    transports: ["websocket", "polling"],
    auth: {
      token,
    },
  });
