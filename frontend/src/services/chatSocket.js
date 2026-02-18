import { io } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

export const createChatSocket = (token) =>
  io(SOCKET_URL, {
    transports: ["websocket", "polling"],
    auth: {
      token,
    },
  });
