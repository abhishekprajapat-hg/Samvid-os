import axios from "axios";
import { buildTenantAwarePath, resolveTenantSlugFromWindow } from "../utils/tenantRouting";

const configuredBaseUrl = String(import.meta.env.VITE_API_BASE_URL || "").trim();
const defaultBaseUrl = import.meta.env.DEV
  ? "/api/client"
  : "https://nemnidhi.cloud/api/client";
const API_BASE_URL = configuredBaseUrl || defaultBaseUrl;

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

const refreshClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

let refreshPromise = null;

const clearSession = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("role");
  localStorage.removeItem("user");
};

const applyTenantHeader = (config = {}) => {
  const tenantSlug = resolveTenantSlugFromWindow();
  const headers = { ...(config.headers || {}) };

  if (tenantSlug) {
    headers["X-Tenant-Slug"] = tenantSlug;
  } else {
    delete headers["X-Tenant-Slug"];
  }

  return { ...config, headers };
};

const redirectToLogin = () => {
  window.location.href = buildTenantAwarePath("/login");
};

const persistAuthPayload = (payload = {}) => {
  const accessToken = payload.token || payload.accessToken || "";
  const refreshToken = payload.refreshToken || "";
  const user = payload.user || null;

  if (accessToken) {
    localStorage.setItem("token", accessToken);
  }

  if (refreshToken) {
    localStorage.setItem("refreshToken", refreshToken);
  }

  if (user?.role) {
    localStorage.setItem("role", user.role);
  }

  if (user) {
    localStorage.setItem("user", JSON.stringify(user));
  }

  return accessToken;
};

const refreshAccessToken = async () => {
  const refreshToken = localStorage.getItem("refreshToken");
  if (!refreshToken) {
    throw new Error("Refresh token missing");
  }

  const response = await refreshClient.post("/auth/refresh", { refreshToken });
  const nextToken = persistAuthPayload(response.data || {});
  if (!nextToken) {
    throw new Error("Access token missing in refresh response");
  }

  return nextToken;
};

// Attach auth + tenant context for all API calls.
api.interceptors.request.use((config) => {
  const tenantAwareConfig = applyTenantHeader(config);
  if (tenantAwareConfig.headers?.Authorization) {
    return tenantAwareConfig;
  }

  const token = localStorage.getItem("token");
  if (token) {
    tenantAwareConfig.headers.Authorization = `Bearer ${token}`;
  }

  return tenantAwareConfig;
});

refreshClient.interceptors.request.use((config) => applyTenantHeader(config));

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const statusCode = error.response?.status;
    const originalRequest = error.config || {};
    const requestUrl = String(originalRequest.url || "");
    const isAuthRefreshCall = requestUrl.includes("/auth/refresh");
    const isAuthLoginCall = requestUrl.includes("/auth/login");

    if (
      statusCode === 401
      && !isAuthRefreshCall
      && !isAuthLoginCall
      && !originalRequest._retry
    ) {
      originalRequest._retry = true;

      try {
        if (!refreshPromise) {
          refreshPromise = refreshAccessToken().finally(() => {
            refreshPromise = null;
          });
        }

        const nextToken = await refreshPromise;
        originalRequest.headers = {
          ...(originalRequest.headers || {}),
          Authorization: `Bearer ${nextToken}`,
        };

        return api(originalRequest);
      } catch (refreshError) {
        clearSession();
        redirectToLogin();
        return Promise.reject(refreshError);
      }
    }

    if (statusCode === 401 && isAuthRefreshCall) {
      clearSession();
      redirectToLogin();
    }

    return Promise.reject(error);
  },
);

export default api;

