import { useCallback, useEffect, useMemo, useState } from "react";
import { getMyAccess } from "../services/accessService";
import { toPagePermission } from "../constants/permissions";
import PermissionContext from "./permissionContext";

const EMPTY_ACCESS = {
  permissions: [],
  pages: [],
  dataScope: "ASSIGNED",
  enforcePageAccess: false,
};

export const PermissionProvider = ({ children, enabled = true, userRole }) => {
  const [access, setAccess] = useState(EMPTY_ACCESS);
  const [loading, setLoading] = useState(Boolean(enabled));
  const [error, setError] = useState(null);

  const isAdmin = userRole === "ADMIN";

  const refresh = useCallback(async ({ background = false } = {}) => {
    if (!enabled) return;

    if (!background) setLoading(true);
    try {
      // /api/access/me answers for every signed-in role, unlike the
      // coworking-only endpoint this used to call, so a lead-side account now
      // gets its real page grants instead of an empty list.
      const data = await getMyAccess();
      setError(null);
      setAccess({
        permissions: data.permissions,
        pages: data.pages,
        dataScope: data.dataScope,
        enforcePageAccess: data.enforcePageAccess,
      });
    } catch {
      // Fail closed on permissions, but never on page access: leaving
      // enforcePageAccess false means a transient network error cannot lock a
      // user out of pages their role legitimately has. The backend guard is
      // the real gate either way.
      if (!background) setAccess(EMPTY_ACCESS);
      setError("permissions_unavailable");
    } finally {
      if (!background) setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setAccess(EMPTY_ACCESS);
      setLoading(false);
      return;
    }
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, userRole]);

  useEffect(() => {
    if (!enabled) return;
    // Admin changes may happen in a different browser or employee session.
    // Refresh without unmounting the employee's current page or form.
    const syncAccess = () => {
      if (document.visibilityState === "visible") refresh({ background: true });
    };
    window.addEventListener("focus", syncAccess);
    document.addEventListener("visibilitychange", syncAccess);
    const timer = window.setInterval(syncAccess, 30000);
    return () => {
      window.removeEventListener("focus", syncAccess);
      document.removeEventListener("visibilitychange", syncAccess);
      window.clearInterval(timer);
    };
  }, [enabled, refresh]);

  const permissionSet = useMemo(() => new Set(access.permissions), [access.permissions]);

  const can = useCallback(
    (permission) => isAdmin || permissionSet.has(permission),
    [isAdmin, permissionSet],
  );

  // Explicit employee selections drive navigation; otherwise use role defaults.
  const canPage = useCallback(
    (pageKeys) => {
      if (isAdmin || !access.enforcePageAccess) return true;
      const keys = Array.isArray(pageKeys) ? pageKeys : [pageKeys];
      return keys.some((pageKey) => permissionSet.has(toPagePermission(pageKey, "view")));
    },
    [isAdmin, access.enforcePageAccess, permissionSet],
  );

  const canPageAction = useCallback(
    (pageKey, action) =>
      isAdmin || !access.enforcePageAccess || permissionSet.has(toPagePermission(pageKey, action)),
    [isAdmin, access.enforcePageAccess, permissionSet],
  );

  const value = useMemo(
    () => ({
      role: userRole || "",
      isAdmin,
      permissions: access.permissions,
      pages: access.pages,
      dataScope: access.dataScope,
      enforcePageAccess: access.enforcePageAccess,
      loading,
      error,
      can,
      canPage,
      canPageAction,
      refresh,
    }),
    [userRole, isAdmin, access, loading, error, can, canPage, canPageAction, refresh],
  );

  return <PermissionContext.Provider value={value}>{children}</PermissionContext.Provider>;
};

export default PermissionProvider;
