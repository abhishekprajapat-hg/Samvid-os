import { io } from "socket.io-client";
import Constants from "expo-constants";

const DEFAULT_SOCKET_URL = "https://nemnidhi.cloud";

const resolveSocketUrl = () => {
  const explicit = (process.env.EXPO_PUBLIC_SOCKET_URL || process.env.EXPO_PUBLIC_API_ORIGIN || "").trim();
  if (explicit) return explicit;

  if (!__DEV__) return DEFAULT_SOCKET_URL;

  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as any)?.manifest2?.extra?.expoGo?.debuggerHost ||
    (Constants as any)?.manifest?.debuggerHost ||
    "";

  if (typeof hostUri === "string" && hostUri) {
    const host = hostUri.split(":")[0];
    if (host) return `http://${host}:5000`;
  }

  return DEFAULT_SOCKET_URL;
};

const SOCKET_URL = resolveSocketUrl();
const SOCKET_PATH = process.env.EXPO_PUBLIC_SOCKET_PATH || "/socket.io";

export const createChatSocket = (token: string) =>
  io(SOCKET_URL, {
    path: SOCKET_PATH,
    transports: ["websocket", "polling"],
    auth: { token },
  });
