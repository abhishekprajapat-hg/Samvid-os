import axios from "axios";
import Constants from "expo-constants";
import { sessionStorage } from "../storage/sessionStorage";

const DEFAULT_API_BASE_URL = "https://nemnidhi.cloud/api";
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

const resolveApiBaseUrl = () => {
  const useLocalDevApi = isTruthy(process.env.EXPO_PUBLIC_USE_LOCAL_API || "");
  const disableWebLocalApi = isTruthy(process.env.EXPO_PUBLIC_DISABLE_WEB_LOCAL_API || "");

  if (__DEV__ && useLocalDevApi && !disableWebLocalApi) {
    const webHost = resolveWebDevHost();
    if (webHost) return `http://${webHost}:${resolveLocalApiPort()}/api`;
  }

  if (__DEV__ && useLocalDevApi) {
    const hostUri =
      Constants.expoConfig?.hostUri ||
      (Constants as any)?.manifest2?.extra?.expoGo?.debuggerHost ||
      (Constants as any)?.manifest?.debuggerHost ||
      "";

    if (typeof hostUri === "string" && hostUri) {
      const host = hostUri.split(":")[0];
      if (host) return `http://${host}:${resolveLocalApiPort()}/api`;
    }
  }

  const explicit = (process.env.EXPO_PUBLIC_API_BASE_URL || "").trim();
  if (explicit) return explicit;

  if (!__DEV__) return DEFAULT_API_BASE_URL;

  return explicit || DEFAULT_API_BASE_URL;
};

const API_BASE_URL = resolveApiBaseUrl();

const api = axios.create({
  baseURL: API_BASE_URL,
});

let refreshPromise: Promise<string | null> | null = null;

let unauthorizedHandler: null | (() => void | Promise<void>) = null;

export const setUnauthorizedHandler = (handler: null | (() => void | Promise<void>)) => {
  unauthorizedHandler = handler;
};

api.interceptors.request.use(async (config) => {
  const token = await sessionStorage.getToken();
  if (token && !config.headers?.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const refreshAccessToken = async (): Promise<string | null> => {
  const refreshToken = await sessionStorage.getRefreshToken();
  if (!refreshToken) return null;

  const response = await axios.post(
    `${API_BASE_URL}/auth/refresh`,
    { refreshToken },
    {
      headers: {
        "Content-Type": "application/json",
      },
    },
  );

  const nextAccessToken = String(response?.data?.accessToken || response?.data?.token || "").trim();
  const nextRefreshToken = String(response?.data?.refreshToken || "").trim();
  const nextUser = response?.data?.user || (await sessionStorage.getUser());

  if (!nextAccessToken || !nextUser) {
    return null;
  }

  await sessionStorage.setSession(nextAccessToken, nextUser, nextRefreshToken || refreshToken);
  return nextAccessToken;
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error?.config || {};
    if (error?.response?.status === 401 && !originalRequest?._retry) {
      originalRequest._retry = true;

      try {
        if (!refreshPromise) {
          refreshPromise = refreshAccessToken();
        }
        const newAccessToken = await refreshPromise;
        refreshPromise = null;

        if (newAccessToken) {
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          return api(originalRequest);
        }
      } catch {
        refreshPromise = null;
      }

      await sessionStorage.clearSession();
      if (unauthorizedHandler) {
        await unauthorizedHandler();
      }
    }
    return Promise.reject(error);
  },
);

export default api;
