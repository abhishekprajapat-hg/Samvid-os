import api from "./api";

/*
 * Mirrors frontend/src/services/permissionService.js: the one call the app
 * makes to resolve the signed-in user's coworking permissions, which is what
 * gates the booking board and the clients page.
 */

export const getMyPermissions = async () => {
  const res = await api.get("/coworking/permissions/me");
  return {
    role: String(res.data?.role || ""),
    isAdmin: Boolean(res.data?.isAdmin),
    permissions: Array.isArray(res.data?.permissions) ? (res.data.permissions as string[]) : [],
  };
};

/** Page access permission strings, mirroring backend/src/constants/page.constants.js. */
export const toPagePermission = (pageKey: string, action = "view") => `page.${pageKey}.${action}`;
