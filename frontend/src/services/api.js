import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api/client";

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

// Attach auth token for requests unless already overridden.
api.interceptors.request.use((config) => {
  if (config.headers?.Authorization) {
    return config;
  }

  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

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
        window.location.href = "/";
        return Promise.reject(refreshError);
      }
    }

    if (statusCode === 401 && isAuthRefreshCall) {
      clearSession();
      window.location.href = "/";
    }

    return Promise.reject(error);
  },
);

export default api;
