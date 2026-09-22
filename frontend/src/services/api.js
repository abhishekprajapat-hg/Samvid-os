import axios from "axios";

const configuredBaseUrl = String(import.meta.env.VITE_API_BASE_URL || "").trim();
const defaultBaseUrl = "/api/client";
const API_BASE_URL = configuredBaseUrl || defaultBaseUrl;

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

const GET_CACHE_TTL_MS = 8000;
const GET_CACHE_MAX_ENTRIES = 80;
const getResponseCache = new Map();
const getInFlightRequests = new Map();

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

const buildGetCacheKey = (url, config = {}) => {
  const params = config.params ? JSON.stringify(config.params) : "";
  const role = localStorage.getItem("role") || "";
  const user = localStorage.getItem("user") || "";
  return `${API_BASE_URL}|${role}|${user}|${url}|${params}`;
};

const pruneGetCache = () => {
  if (getResponseCache.size <= GET_CACHE_MAX_ENTRIES) return;
  const overflow = getResponseCache.size - GET_CACHE_MAX_ENTRIES;
  Array.from(getResponseCache.keys()).slice(0, overflow).forEach((key) => {
    getResponseCache.delete(key);
  });
};

const clearGetCache = () => {
  getResponseCache.clear();
  getInFlightRequests.clear();
};

const redirectToLogin = () => {
  window.location.href = "/login";
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

// Attach auth for all API calls.
api.interceptors.request.use((config) => {
  if (String(config.method || "get").toLowerCase() !== "get") {
    clearGetCache();
  }

  if (config.headers?.Authorization) {
    return config;
  }

  const token = localStorage.getItem("token");
  if (token) {
    config.headers = {
      ...(config.headers || {}),
      Authorization: `Bearer ${token}`,
    };
  }

  return config;
});

/*
 * Uploaded-file URLs are stored on records, and older ones were saved with an
 * absolute host baked in (the API origin, which differs from the app origin in
 * development). An absolute URL makes the request cross-origin, so the browser
 * withholds the httpOnly file-access cookie and every <img> 401s.
 *
 * Rewriting them to relative here - once, on the way in - keeps all of them
 * same-origin without touching the ~25 components that render them. Any query
 * string is preserved, so a signed ?t= link still works.
 */
const UPLOAD_URL_PATTERN = /https?:\/\/[^/"\s]+(\/api\/uploads\/files\/)/g;

const toRelativeUploadUrls = (value) => {
  if (typeof value === "string") {
    return value.includes("/api/uploads/files/")
      ? value.replace(UPLOAD_URL_PATTERN, "$1")
      : value;
  }
  if (Array.isArray(value)) return value.map(toRelativeUploadUrls);
  if (value && typeof value === "object") {
    for (const key of Object.keys(value)) {
      value[key] = toRelativeUploadUrls(value[key]);
    }
  }
  return value;
};

api.interceptors.response.use(
  (response) => {
    if (response?.data) response.data = toRelativeUploadUrls(response.data);
    return response;
  },
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

const uncachedGet = api.get.bind(api);

api.get = (url, config = {}) => {
  if (config?.cache === false) {
    return uncachedGet(url, config);
  }

  const cacheKey = buildGetCacheKey(url, config);
  const cached = getResponseCache.get(cacheKey);
  const now = Date.now();

  if (cached && now - cached.storedAt < GET_CACHE_TTL_MS) {
    return Promise.resolve(cached.response);
  }

  const inFlight = getInFlightRequests.get(cacheKey);
  if (inFlight) {
    return inFlight;
  }

  const request = uncachedGet(url, config)
    .then((response) => {
      getResponseCache.set(cacheKey, {
        storedAt: Date.now(),
        response,
      });
      pruneGetCache();
      return response;
    })
    .finally(() => {
      getInFlightRequests.delete(cacheKey);
    });

  getInFlightRequests.set(cacheKey, request);
  return request;
};

export default api;
