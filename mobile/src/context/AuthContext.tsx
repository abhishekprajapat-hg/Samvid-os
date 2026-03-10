import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { AppState } from "react-native";
import { getCurrentUser, loginUser } from "../services/authService";
import { setUnauthorizedHandler } from "../services/api";
import { sessionStorage } from "../storage/sessionStorage";
import type { User, UserRole } from "../types";
import { getSessionTimeoutMs, readSystemSettings } from "../utils/systemSettings";

type AuthContextValue = {
  loading: boolean;
  isLoggedIn: boolean;
  token: string | null;
  user: User | null;
  role: UserRole | null;
  login: (input: { email: string; password: string; portal?: "GENERAL" | "ADMIN" }) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (patch: Partial<User>) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    setUnauthorizedHandler(async () => {
      setToken(null);
      setUser(null);
    });

    return () => {
      setUnauthorizedHandler(null);
    };
  }, []);

  useEffect(() => {
    let alive = true;
    let wentBackgroundAt = 0;
    let timeoutMs = getSessionTimeoutMs(30);

    const boot = async () => {
      try {
        const settings = await readSystemSettings();
        timeoutMs = getSessionTimeoutMs(settings.security.sessionTimeoutMinutes);
      } catch {
        timeoutMs = getSessionTimeoutMs(30);
      }
    };

    boot();

    const sub = AppState.addEventListener("change", async (nextState) => {
      if (!alive) return;
      if (nextState === "background" || nextState === "inactive") {
        wentBackgroundAt = Date.now();
        return;
      }

      if (nextState === "active" && wentBackgroundAt > 0) {
        const now = Date.now();
        const elapsed = now - wentBackgroundAt;
        wentBackgroundAt = 0;

        const currentToken = await sessionStorage.getToken();
        if (!currentToken) return;
        if (elapsed < timeoutMs) return;

        await sessionStorage.clearSession();
        setToken(null);
        setUser(null);
      }
    });

    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  useEffect(() => {
    const restore = async () => {
      const expired = await sessionStorage.isSessionExpired();
      if (expired) {
        await sessionStorage.clearSession();
        setToken(null);
        setUser(null);
        setLoading(false);
        return;
      }

      const [storedToken, storedUser] = await Promise.all([
        sessionStorage.getToken(),
        sessionStorage.getUser(),
      ]);

      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(storedUser);
        try {
          const me = await getCurrentUser();
          if (me?.user) {
            setUser(me.user as User);
            const storedRefreshToken = await sessionStorage.getRefreshToken();
            await sessionStorage.setSession(storedToken, me.user as User, storedRefreshToken);
          }
        } catch (error: any) {
          const status = Number(error?.response?.status || 0);
          if (status === 401 || status === 403) {
            await sessionStorage.clearSession();
            setToken(null);
            setUser(null);
          }
        }
      } else {
        setToken(null);
        setUser(null);
      }

      setLoading(false);
    };

    restore();
  }, []);

  useEffect(() => {
    if (!token || !user) return;
    let timer: ReturnType<typeof setTimeout> | null = null;

    sessionStorage.getRemainingSessionMs().then((remaining) => {
      if (remaining === null) return;
      if (remaining <= 0) {
        sessionStorage.clearSession().then(() => {
          setToken(null);
          setUser(null);
        });
        return;
      }
      timer = setTimeout(() => {
        sessionStorage.clearSession().then(() => {
          setToken(null);
          setUser(null);
        });
      }, remaining);
    });

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [token, user]);

  const login = async ({ email, password, portal = "GENERAL" }: { email: string; password: string; portal?: "GENERAL" | "ADMIN" }) => {
    const payload = await loginUser({ email, password, portal });
    const accessToken = String(payload.accessToken || payload.token || "").trim();
    const refreshToken = String(payload.refreshToken || "").trim();
    await sessionStorage.setSession(accessToken, payload.user, refreshToken || null);
    setToken(accessToken);
    setUser(payload.user);
  };

  const logout = async () => {
    await sessionStorage.clearSession();
    setToken(null);
    setUser(null);
  };

  const updateUser = async (patch: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      if (token) {
        sessionStorage.getRefreshToken().then((refreshToken) => {
          sessionStorage.setSession(token, next, refreshToken);
        });
      }
      return next;
    });
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      loading,
      isLoggedIn: Boolean(token && user),
      token,
      user,
      role: (user?.role as UserRole | undefined) || null,
      login,
      logout,
      updateUser,
    }),
    [loading, token, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
};
