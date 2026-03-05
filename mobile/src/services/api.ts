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

const normalizeBaseUrl = (value: string) => value.replace(/\/+$/, "");
const resolveWebDevHost = () => {
  if (typeof window === "undefined") return "";
  const host = String(window.location?.hostname || "").trim().toLowerCase();
  if (!host) return "";
  if (host === "localhost" || host === "127.0.0.1") return host;
  return "";
};

const resolveApiBaseUrl = () => {
  const disableWebLocalApi = isTruthy(process.env.EXPO_PUBLIC_DISABLE_WEB_LOCAL_API || "");
  if (__DEV__ && !disableWebLocalApi) {
    const webHost = resolveWebDevHost();
    if (webHost) return `http://${webHost}:${resolveLocalApiPort()}/api`;
  }

  const explicit = normalizeBaseUrl((process.env.EXPO_PUBLIC_API_BASE_URL || "").trim());
  if (explicit) return explicit;

  const useLocalDevApi = isTruthy(process.env.EXPO_PUBLIC_USE_LOCAL_API || "");
  if (!__DEV__ || !useLocalDevApi) return DEFAULT_API_BASE_URL;

  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as any)?.manifest2?.extra?.expoGo?.debuggerHost ||
    (Constants as any)?.manifest?.debuggerHost ||
    "";

  if (typeof hostUri === "string" && hostUri) {
    const host = hostUri.split(":")[0];
    if (host) return `http://${host}:${resolveLocalApiPort()}/api`;
  }

  return DEFAULT_API_BASE_URL;
};

const API_BASE_URL = resolveApiBaseUrl();

if (__DEV__) {
  // Helps debugging wrong env injection on Expo web/native.
  console.log(`[api] baseURL -> ${API_BASE_URL}`);
}

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
});

let unauthorizedHandler: null | (() => void | Promise<void>) = null;
let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

export const setUnauthorizedHandler = (handler: null | (() => void | Promise<void>)) => {
  unauthorizedHandler = handler;
};

const shouldSkipRefresh = (url: string) => {
  const safeUrl = String(url || "");
  return safeUrl.includes("/auth/login") || safeUrl.includes("/auth/register") || safeUrl.includes("/auth/refresh");
};

const refreshAccessToken = async () => {
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const refreshToken = await sessionStorage.getRefreshToken();
      if (!refreshToken) return null;

      const response = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken }, { timeout: 20000 });
      const accessToken = String(response.data?.accessToken || response.data?.token || "").trim();
      const nextRefreshToken = String(response.data?.refreshToken || "").trim();
      const nextUser = response.data?.user || null;

      if (!accessToken || !nextUser) return null;

      await sessionStorage.setSession(accessToken, nextUser, nextRefreshToken || refreshToken);
      return accessToken;
    } catch {
      return null;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
};

api.interceptors.request.use(async (config) => {
  const token = await sessionStorage.getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error?.config || {};
    const requestUrl = String(originalRequest?.url || "");
    const hasRetried = Boolean((originalRequest as any)?._retry);

    if (error?.response?.status === 401 && !hasRetried && !shouldSkipRefresh(requestUrl)) {
      (originalRequest as any)._retry = true;
      const newAccessToken = await refreshAccessToken();

      if (newAccessToken) {
        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      }
    }

    if (error?.response?.status === 401) {
      await sessionStorage.clearSession();
      if (unauthorizedHandler) {
        await unauthorizedHandler();
      }
    }
    return Promise.reject(error);
  },
);

export default api;
