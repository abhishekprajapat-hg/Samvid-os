import api, { clearSession, getStoredRefreshToken, persistSession } from "./api";

export const login = async (email, password) => {
  const res = await api.post("/auth/login", { email, password });
  persistSession({
    accessToken: res.data.accessToken,
    refreshToken: res.data.refreshToken,
    user: res.data.user,
    client: res.data.client,
  });
  return res.data;
};

export const logout = async () => {
  const refreshToken = getStoredRefreshToken();
  try {
    await api.post("/auth/logout", { refreshToken });
  } catch {
    // Always clear the local session even if the network call fails.
  }
  clearSession();
};

export const getMe = async () => {
  const res = await api.get("/auth/me");
  return res.data.user;
};
