import api from "./api";
import { sessionStorage } from "../storage/sessionStorage";
import type { User } from "../types";

export const getUsers = async (): Promise<{ users: User[] }> => {
  const res = await api.get("/users");
  return res.data;
};

export const createUser = async (payload: Partial<User> & { password?: string }) => {
  const res = await api.post("/users/create", payload);
  return res.data;
};

export const rebalanceExecutives = async () => {
  const res = await api.post("/users/rebalance-executives");
  return res.data;
};

export const deleteUser = async (userId: string) => {
  const res = await api.delete(`/users/${userId}`);
  return res.data;
};

export const uploadMyProfilePicture = async ({
  uri,
  name,
  mimeType,
}: {
  uri: string;
  name: string;
  mimeType?: string;
}) => {
  const formData = new FormData();
  formData.append("avatar", {
    uri,
    name,
    type: mimeType || "image/jpeg",
  } as any);

  try {
    const res = await api.post("/users/profile-picture", formData);
    return res.data?.user || null;
  } catch (error: any) {
    const isNetworkError = String(error?.message || "").toLowerCase().includes("network");
    if (!isNetworkError) throw error;

    const token = await sessionStorage.getToken();
    const baseUrl = String(api.defaults.baseURL || "").replace(/\/$/, "");
    const response = await fetch(`${baseUrl}/users/profile-picture`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: formData as any,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(String(data?.message || "Profile upload failed"));
    }
    return data?.user || null;
  }
};

export const deleteMyProfilePicture = async () => {
  const res = await api.delete("/users/profile-picture");
  return res.data?.user || null;
};
