import api from "./api";
import { sessionStorage } from "../storage/sessionStorage";
import type { User } from "../types";

export const getUsers = async (params: Record<string, unknown> = {}): Promise<{ users: User[] }> => {
  const res = await api.get("/users", { params });
  return res.data;
};

export const getMyProfile = async (): Promise<{
  profile: {
    _id?: string;
    name?: string;
    email?: string;
    phone?: string;
    role?: string;
    companyId?: string | null;
    profileImageUrl?: string;
    manager?: { _id?: string; name?: string; email?: string; phone?: string; role?: string } | null;
    createdAt?: string | null;
    updatedAt?: string | null;
    lastAssignedAt?: string | null;
  } | null;
  summary: Record<string, number>;
}> => {
  const res = await api.get("/users/profile");
  return {
    profile: res.data?.profile || null,
    summary: res.data?.summary || {},
  };
};

export const getUserProfileById = async (userId: string): Promise<{
  profile: {
    _id?: string;
    id?: string;
    name?: string;
    email?: string;
    phone?: string;
    role?: string;
    companyId?: string | null;
    profileImageUrl?: string;
    parentId?: { _id?: string; name?: string; email?: string; role?: string } | string | null;
    manager?: { _id?: string; name?: string; email?: string; phone?: string; role?: string } | null;
    canViewInventory?: boolean;
    isActive?: boolean;
    partnerCode?: string;
    liveLocation?: { updatedAt?: string } | null;
    createdAt?: string | null;
    updatedAt?: string | null;
    lastAssignedAt?: string | null;
  } | null;
  summary: Record<string, number>;
  performance: Record<string, number>;
}> => {
  const res = await api.get(`/users/${userId}/profile`);
  return {
    profile: res.data?.profile || null,
    summary: res.data?.summary || {},
    performance: res.data?.performance || {},
  };
};

export const updateMyProfile = async (payload: {
  name?: string;
  phone?: string;
  profileImageUrl?: string;
}) => {
  const res = await api.patch("/users/profile", payload);
  return {
    profile: res.data?.profile || null,
    summary: res.data?.summary || {},
  };
};

export const createUser = async (payload: Partial<User> & { password?: string }) => {
  const res = await api.post("/users/create", payload);
  return res.data;
};

export const rebalanceExecutives = async () => {
  const res = await api.post("/users/rebalance-executives");
  return res.data;
};

export const getFieldExecutiveLocations = async (params: Record<string, unknown> = {}) => {
  const res = await api.get("/users/field-locations", { params });
  return res.data?.users || [];
};

export const updateMyLiveLocation = async (payload: {
  lat: number;
  lng: number;
  accuracy?: number | null;
  heading?: number | null;
  speed?: number | null;
}) => {
  const res = await api.patch("/users/location", payload);
  return res.data?.user || null;
};

export const deleteUser = async (userId: string) => {
  const res = await api.delete(`/users/${userId}`);
  return res.data;
};

export const updateUserById = async (
  userId: string,
  payload: {
    name?: string;
    phone?: string;
    role?: string;
    managerId?: string;
    reportingToId?: string;
    parentId?: string;
    isActive?: boolean;
  },
) => {
  const res = await api.patch(`/users/${userId}`, payload);
  return res.data?.user || null;
};

export const updateUserByAdmin = async (
  userId: string,
  payload: {
    name?: string;
    email?: string;
    phone?: string;
    role?: string;
    reportingToId?: string | null;
    managerId?: string | null;
    parentId?: string | null;
    isActive?: boolean;
    canViewInventory?: boolean;
    password?: string;
  },
) => {
  const res = await api.patch(`/users/${userId}`, payload);
  return res.data?.user || null;
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

export type LeaderboardEntry = {
  _id?: string;
  name?: string;
  role?: string;
  profileImageUrl?: string;
  leads?: number;
  converted?: number;
  siteVisits?: number;
  revenue?: number;
  conversionRate?: number;
  rank?: number;
  [key: string]: unknown;
};

// Mirrors getRoleLeaderboard in frontend/src/services/userService.js.
export const getRoleLeaderboard = async (params: Record<string, unknown> = {}) => {
  const res = await api.get("/users/leaderboard", { params });
  return {
    role: String(res.data?.role || ""),
    roleLabel: String(res.data?.roleLabel || ""),
    allowedRoleFilters: Array.isArray(res.data?.allowedRoleFilters)
      ? (res.data.allowedRoleFilters as string[])
      : [],
    windowDays: Number(res.data?.windowDays || 30),
    since: String(res.data?.since || ""),
    count: Number(res.data?.count || 0),
    leaderboard: (Array.isArray(res.data?.leaderboard) ? res.data.leaderboard : []) as LeaderboardEntry[],
  };
};

/* ------------------------------------------- user deletion, by request -- */

/*
 * Removing a person is an approval workflow, not a direct delete - the same
 * shape inventory uses. `deleteUser` above is the privileged path; everyone
 * else raises a request here and an admin reviews it.
 *
 * Mirrors createUserDeleteRequest / getAdminUserDeleteRequests /
 * reviewUserDeleteRequest in frontend/src/services/userService.js.
 */
export const createUserDeleteRequest = async (
  userId: string,
  payload: Record<string, unknown> = {},
) => {
  const res = await api.post(`/users/${userId}/delete-request`, payload);
  return res.data;
};

export const getAdminUserDeleteRequests = async (params: Record<string, unknown> = {}) => {
  const res = await api.get("/users/delete-requests/admin", { params });
  return Array.isArray(res.data?.requests) ? res.data.requests : [];
};

export const reviewUserDeleteRequest = async (
  requestId: string,
  payload: Record<string, unknown> = {},
) => {
  const res = await api.patch(`/users/delete-requests/${requestId}/review`, payload);
  return res.data;
};

/** Channel partners only see inventory when this is switched on for them. */
export const updateChannelPartnerInventoryAccess = async (
  userId: string,
  canViewInventory: boolean,
) => {
  const res = await api.patch(`/users/${userId}/channel-partner/inventory-access`, {
    canViewInventory: Boolean(canViewInventory),
  });
  return res.data?.user || null;
};

export const updateUserDesignation = async (
  userId: string,
  payload: Record<string, unknown> = {},
) => {
  const res = await api.patch(`/users/${userId}/designation`, payload);
  return res.data;
};
