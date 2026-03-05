import { io } from "socket.io-client";
import Constants from "expo-constants";

const DEFAULT_SOCKET_URL = "https://nemnidhi.cloud";
const DEFAULT_LOCAL_API_PORT = 5000;
const isTruthy = (value: string) => ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
const resolveLocalApiPort = () => {
  const parsed = Number.parseInt(String(process.env.EXPO_PUBLIC_LOCAL_API_PORT || "").trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_LOCAL_API_PORT;
};
const resolveWebDevHost = () => {
  if (typeof window === "undefined") return "";
  const host = String(window.location?.hostname || "").trim().toLowerCase();
  if (!host) return "";
  if (host === "localhost" || host === "127.0.0.1") return host;
  return "";
};

const resolveSocketUrl = () => {
  const disableWebLocalApi = isTruthy(process.env.EXPO_PUBLIC_DISABLE_WEB_LOCAL_API || "");
  if (__DEV__ && !disableWebLocalApi) {
    const webHost = resolveWebDevHost();
    if (webHost) return `http://${webHost}:${resolveLocalApiPort()}`;
  }

  const explicit = (process.env.EXPO_PUBLIC_SOCKET_URL || process.env.EXPO_PUBLIC_API_ORIGIN || "").trim();
  if (explicit) return explicit;

  const useLocalDevApi = isTruthy(process.env.EXPO_PUBLIC_USE_LOCAL_API || "");
  if (!__DEV__ || !useLocalDevApi) return DEFAULT_SOCKET_URL;

  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as any)?.manifest2?.extra?.expoGo?.debuggerHost ||
    (Constants as any)?.manifest?.debuggerHost ||
    "";

  if (typeof hostUri === "string" && hostUri) {
    const host = hostUri.split(":")[0];
    if (host) return `http://${host}:${resolveLocalApiPort()}`;
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
