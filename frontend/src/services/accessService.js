import api from "./api";

const unwrapList = (value) => (Array.isArray(value) ? value : []);

/** The signed-in account's effective permissions, page access and data scope. */
export const getMyAccess = async () => {
  const res = await api.get("/access/me");
  const access = res.data?.access || {};
  return {
    role: access.role || "",
    isAdmin: Boolean(access.isAdmin),
    permissions: unwrapList(access.permissions),
    pages: unwrapList(access.pages),
    dataScope: access.dataScope || "ASSIGNED",
    enforcePageAccess: Boolean(access.enforcePageAccess),
  };
};
