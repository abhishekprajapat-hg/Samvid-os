import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api/portal";

// Namespaced localStorage keys (portal_*) so this app can run in the same
// browser profile as the staff frontend without ever colliding with its
// session storage — the two are meant to be fully independent.
const TOKEN_KEY = "portal_token";
const REFRESH_TOKEN_KEY = "portal_refreshToken";
const USER_KEY = "portal_user";
const CLIENT_KEY = "portal_client";

export const getStoredToken = () => localStorage.getItem(TOKEN_KEY) || "";
export const getStoredRefreshToken = () => localStorage.getItem(REFRESH_TOKEN_KEY) || "";
export const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || "null");
  } catch {
    return null;
  }
};
export const getStoredClient = () => {
  try {
    return JSON.parse(localStorage.getItem(CLIENT_KEY) || "null");
  } catch {
    return null;
  }
};

export const persistSession = ({ accessToken, refreshToken, user, client }) => {
  if (accessToken) localStorage.setItem(TOKEN_KEY, accessToken);
  if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  if (client) localStorage.setItem(CLIENT_KEY, JSON.stringify(client));
};

export const clearSession = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(CLIENT_KEY);
};

const api = axios.create({ baseURL: API_BASE_URL, timeout: 15000 });
const refreshClient = axios.create({ baseURL: API_BASE_URL, timeout: 15000 });

api.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshPromise = null;

const redirectToLogin = () => {
  if (window.location.pathname !== "/login") {
    window.location.href = "/login";
  }
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;

    if (status !== 401 || originalRequest?._retry || originalRequest?.url?.includes("/auth/refresh")) {
      return Promise.reject(error);
    }

    const rawRefreshToken = getStoredRefreshToken();
    if (!rawRefreshToken) {
      clearSession();
      redirectToLogin();
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      if (!refreshPromise) {
        refreshPromise = refreshClient
          .post("/auth/refresh", { refreshToken: rawRefreshToken })
          .then((res) => {
            persistSession({ accessToken: res.data.accessToken, refreshToken: res.data.refreshToken, user: res.data.user });
            return res.data.accessToken;
          })
          .finally(() => {
            refreshPromise = null;
          });
      }

      const newToken = await refreshPromise;
      originalRequest.headers.Authorization = `Bearer ${newToken}`;
      return api(originalRequest);
    } catch (refreshError) {
      clearSession();
      redirectToLogin();
      return Promise.reject(refreshError);
    }
  },
);

export default api;
