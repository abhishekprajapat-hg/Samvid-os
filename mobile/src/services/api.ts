import axios from "axios";
import Constants from "expo-constants";
import { sessionStorage } from "../storage/sessionStorage";

const DEFAULT_API_BASE_URL = "https://nemnidhi.cloud/api/client";

const resolveApiBaseUrl = () => {
  const explicit = (process.env.EXPO_PUBLIC_API_BASE_URL || "").trim();
  if (explicit) return explicit;

  if (!__DEV__) return DEFAULT_API_BASE_URL;

  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as any)?.manifest2?.extra?.expoGo?.debuggerHost ||
    (Constants as any)?.manifest?.debuggerHost ||
    "";

  if (typeof hostUri === "string" && hostUri) {
    const host = hostUri.split(":")[0];
    if (host) return `http://${host}:5000/api/client`;
  }

  return DEFAULT_API_BASE_URL;
};

const API_BASE_URL = resolveApiBaseUrl();

const api = axios.create({
  baseURL: API_BASE_URL,
});

let unauthorizedHandler: null | (() => void | Promise<void>) = null;

export const setUnauthorizedHandler = (handler: null | (() => void | Promise<void>)) => {
  unauthorizedHandler = handler;
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
