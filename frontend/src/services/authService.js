import api from "./api";

export const loginUser = async (data) => {
  const res = await api.post("/auth/login", data);
  return res.data;
};

export const refreshSession = async (refreshToken) => {
  const res = await api.post("/auth/refresh", { refreshToken });
  return res.data;
};

export const logoutUser = async (refreshToken) => {
  const res = await api.post("/auth/logout", { refreshToken });
  return res.data;
};
