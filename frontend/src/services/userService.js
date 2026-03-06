import api from "./api";

export const getUsers = async (params = {}) => {
  const res = await api.get("/users", { params });
  return res.data;
};

export const getMyProfile = async () => {
  const res = await api.get("/users/profile");
  return {
    profile: res.data?.profile || null,
    summary: res.data?.summary || {},
  };
};

export const getUserProfileById = async (userId) => {
  const res = await api.get(`/users/${userId}/profile`);
  return {
    profile: res.data?.profile || null,
    summary: res.data?.summary || {},
    performance: res.data?.performance || {},
  };
};

export const updateMyProfile = async (payload) => {
  const res = await api.patch("/users/profile", payload);
  return {
    profile: res.data?.profile || null,
    summary: res.data?.summary || {},
  };
};

export const createUser = async (payload) => {
  const res = await api.post("/users/create", payload);
  return res.data;
};

export const rebalanceExecutives = async () => {
  const res = await api.post("/users/rebalance-executives");
  return res.data;
};

export const deleteUser = async (userId) => {
  const res = await api.delete(`/users/${userId}`);
  return res.data;
};

export const updateUserDesignation = async (userId, payload = {}) => {
  const res = await api.patch(`/users/${userId}/designation`, payload);
  return res.data?.user || null;
};

export const updateUserByAdmin = async (userId, payload = {}) => {
  const res = await api.patch(`/users/${userId}`, payload);
  return res.data?.user || null;
};

export const updateChannelPartnerInventoryAccess = async (userId, canViewInventory) => {
  const res = await api.patch(
    `/users/${userId}/channel-partner/inventory-access`,
    { canViewInventory: Boolean(canViewInventory) },
  );
  return res.data?.user || null;
};

export const updateMyLiveLocation = async (payload) => {
  const res = await api.patch("/users/location", payload);
  return res.data?.user;
};

export const getFieldExecutiveLocations = async (params = {}) => {
  const res = await api.get("/users/field-locations", { params });
  return res.data?.users || [];
};

export const getFieldExecutiveLocationsWithMeta = async (params = {}) => {
  const res = await api.get("/users/field-locations", { params });
  return {
    users: res.data?.users || [],
    pagination: res.data?.pagination || null,
    staleMinutes: res.data?.staleMinutes || null,
  };
};

export const getRoleLeaderboard = async (params = {}) => {
  const res = await api.get("/users/leaderboard", { params });
  return {
    role: res.data?.role || "",
    roleLabel: res.data?.roleLabel || "",
    allowedRoleFilters: Array.isArray(res.data?.allowedRoleFilters)
      ? res.data.allowedRoleFilters
      : [],
    windowDays: Number(res.data?.windowDays || 30),
    since: res.data?.since || "",
    count: Number(res.data?.count || 0),
    leaderboard: Array.isArray(res.data?.leaderboard) ? res.data.leaderboard : [],
  };
};
