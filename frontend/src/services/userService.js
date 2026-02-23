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
