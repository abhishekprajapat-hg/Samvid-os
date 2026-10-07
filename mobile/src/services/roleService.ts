import api from "./api";

/*
 * Custom roles. Mirrors frontend/src/services/roleService.js.
 *
 * A custom role is a named bundle of page grants an admin can define and then
 * assign, rather than editing each user's page access one at a time. The
 * catalogue is the list of grants a role may contain.
 */

export type CustomRole = {
  _id?: string;
  name?: string;
  description?: string;
  permissions?: string[];
  pages?: string[];
  userCount?: number;
  [key: string]: unknown;
};

export const getRoleCatalogue = async () => (await api.get("/roles/catalogue")).data;

export const getCustomRoles = async () => {
  const data = (await api.get("/roles")).data;
  return (Array.isArray(data?.roles) ? data.roles : Array.isArray(data) ? data : []) as CustomRole[];
};

export const createCustomRole = async (payload: Record<string, unknown>) =>
  (await api.post("/roles", payload)).data;

export const updateCustomRole = async (roleId: string, payload: Record<string, unknown>) =>
  (await api.patch(`/roles/${roleId}`, payload)).data;

export const deleteCustomRole = async (roleId: string) =>
  (await api.delete(`/roles/${roleId}`)).data;
