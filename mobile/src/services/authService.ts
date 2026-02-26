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
