import api from "./api";

export const getRoleCatalogue = async () => (await api.get("/roles/catalogue")).data;
export const getCustomRoles = async () => (await api.get("/roles")).data;
export const createCustomRole = async (payload) => (await api.post("/roles", payload)).data;
export const updateCustomRole = async (roleId, payload) => (await api.patch(`/roles/${roleId}`, payload)).data;
export const deleteCustomRole = async (roleId) => (await api.delete(`/roles/${roleId}`)).data;
