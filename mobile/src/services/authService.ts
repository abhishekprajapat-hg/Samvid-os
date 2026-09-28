import api from "./api";
import type { AuthPayload } from "../types";

export const loginUser = async (data: {
  email: string;
  password: string;
  portal?: "GENERAL" | "ADMIN";
}): Promise<AuthPayload> => {
  const res = await api.post("/auth/login", data);
  return res.data;
};

export const registerUser = async (data: {
  name: string;
  email: string;
  phone?: string;
  password: string;
  portal?: "GENERAL" | "ADMIN";
  companyAdminEmail?: string;
}): Promise<{ message: string; user?: { id: string; email: string; role: string } }> => {
  const res = await api.post("/auth/register", data);
  return res.data;
};

export const getCurrentUser = async (): Promise<{ user: AuthPayload["user"] | null }> => {
  const res = await api.get("/auth/me");
  return {
    user: res.data?.user || null,
  };
};

/*
 * Revokes this device's refresh token on the server. Clearing local storage
 * alone signs the phone out but leaves the token valid for its full lifetime,
 * so anyone who had copied it could keep minting access tokens. Web has always
 * sent this; the body names the one token so other devices stay signed in.
 */
export const logoutUser = async (refreshToken: string | null) => {
  const res = await api.post("/auth/logout", { refreshToken: refreshToken || undefined });
  return res.data;
};
