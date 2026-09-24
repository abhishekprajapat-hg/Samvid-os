import api from "./api";

/*
 * The coworking role/user/audit-log admin screens were removed along with the
 * rest of the module, taking their callers with them. What remains is the one
 * call the app still makes: PermissionProvider resolving the signed-in user's
 * coworking permissions, which is what gates the booking board.
 *
 * The /coworking/roles, /coworking/users and /coworking/audit-logs endpoints
 * still exist on the API; nothing in the frontend calls them any more.
 */

export const getMyPermissions = async () => {
  const res = await api.get("/coworking/permissions/me");
  return {
    role: res.data?.role || "",
    isAdmin: Boolean(res.data?.isAdmin),
    permissions: Array.isArray(res.data?.permissions) ? res.data.permissions : [],
  };
};
