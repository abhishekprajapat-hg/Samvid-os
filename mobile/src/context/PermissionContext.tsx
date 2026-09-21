import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { AppState } from "react-native";
import { getMyAccess } from "../services/accessService";
import { toPagePermission } from "../services/permissionService";
import { useAuth } from "./AuthContext";

/*
 * Mirrors frontend/src/context/PermissionProvider.jsx.
 *
 * Web refreshes access on window focus, on visibilitychange and every 30s,
 * because an admin may change someone's page access from another session. The
 * mobile equivalent of "the tab came back" is AppState returning to active, so
 * that is what drives the refresh here.
 */

const EMPTY = {
  permissions: [] as string[],
  pages: [] as string[],
  dataScope: "ASSIGNED",
  enforcePageAccess: false,
};

type PermissionValue = {
  role: string;
  isAdmin: boolean;
  permissions: string[];
  pages: string[];
  dataScope: string;
  enforcePageAccess: boolean;
  loading: boolean;
  error: string | null;
  can: (permission: string) => boolean;
  canPage: (pageKeys: string | string[]) => boolean;
  canPageAction: (pageKey: string, action: string) => boolean;
  refresh: (options?: { background?: boolean }) => Promise<void>;
};

const PermissionContext = createContext<PermissionValue | undefined>(undefined);

const REFRESH_INTERVAL_MS = 30000;

export const PermissionProvider = ({ children }: { children: React.ReactNode }) => {
  const { isLoggedIn, role } = useAuth();
  const [access, setAccess] = useState(EMPTY);
  const [loading, setLoading] = useState(Boolean(isLoggedIn));
  const [error, setError] = useState<string | null>(null);

  const isAdmin = role === "ADMIN";

  const refresh = useCallback(
    async ({ background = false }: { background?: boolean } = {}) => {
      if (!isLoggedIn) return;

      if (!background) setLoading(true);
      try {
        const data = await getMyAccess();
        setError(null);
        setAccess({
          permissions: data.permissions,
          pages: data.pages,
          dataScope: data.dataScope,
          enforcePageAccess: data.enforcePageAccess,
        });
      } catch {
        /*
         * Fail closed on permissions, but never on page access: leaving
         * enforcePageAccess false means a transient network error - far more
         * likely on a phone than in a browser - cannot lock a user out of pages
         * their role legitimately has. The backend guard is the real gate.
         */
        if (!background) setAccess(EMPTY);
        setError("permissions_unavailable");
      } finally {
        if (!background) setLoading(false);
      }
    },
    [isLoggedIn],
  );

  useEffect(() => {
    if (!isLoggedIn) {
      setAccess(EMPTY);
      setLoading(false);
      return;
    }
    void refresh();
  }, [isLoggedIn, role, refresh]);

  useEffect(() => {
    if (!isLoggedIn) return;

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh({ background: true });
    });
    const timer = setInterval(() => void refresh({ background: true }), REFRESH_INTERVAL_MS);

    return () => {
      subscription.remove();
      clearInterval(timer);
    };
  }, [isLoggedIn, refresh]);

  const permissionSet = useMemo(() => new Set(access.permissions), [access.permissions]);

  const can = useCallback(
    (permission: string) => isAdmin || permissionSet.has(permission),
    [isAdmin, permissionSet],
  );

  // Explicit employee selections drive navigation; otherwise use role defaults.
  const canPage = useCallback(
    (pageKeys: string | string[]) => {
      if (isAdmin || !access.enforcePageAccess) return true;
      const keys = Array.isArray(pageKeys) ? pageKeys : [pageKeys];
      return keys.some((pageKey) => permissionSet.has(toPagePermission(pageKey, "view")));
    },
    [isAdmin, access.enforcePageAccess, permissionSet],
  );

  const canPageAction = useCallback(
    (pageKey: string, action: string) =>
      isAdmin || !access.enforcePageAccess || permissionSet.has(toPagePermission(pageKey, action)),
    [isAdmin, access.enforcePageAccess, permissionSet],
  );

  const value = useMemo<PermissionValue>(
    () => ({
      role: role || "",
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
    [role, isAdmin, access, loading, error, can, canPage, canPageAction, refresh],
  );

  return <PermissionContext.Provider value={value}>{children}</PermissionContext.Provider>;
};

export const usePermissions = (): PermissionValue => {
  const context = useContext(PermissionContext);
  if (!context) {
    throw new Error("usePermissions must be used inside PermissionProvider");
  }
  return context;
};

export default PermissionProvider;
