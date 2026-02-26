import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getCurrentUser, loginUser } from "../services/authService";
import { setUnauthorizedHandler } from "../services/api";
import { sessionStorage } from "../storage/sessionStorage";
import type { User, UserRole } from "../types";

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
    const restore = async () => {
      const [storedToken, storedUser] = await Promise.all([
        sessionStorage.getToken(),
        sessionStorage.getUser(),
      ]);

      if (storedToken && storedUser) {
        try {
          const me = await getCurrentUser();
          if (me?.user) {
            setToken(storedToken);
            setUser(me.user as User);
            await sessionStorage.setSession(storedToken, me.user as User);
          } else {
            await sessionStorage.clearSession();
            setToken(null);
            setUser(null);
          }
        } catch {
          await sessionStorage.clearSession();
          setToken(null);
          setUser(null);
        }
      } else {
        setToken(null);
        setUser(null);
      }

      setLoading(false);
    };

    restore();
  }, []);

  const login = async ({ email, password, portal = "GENERAL" }: { email: string; password: string; portal?: "GENERAL" | "ADMIN" }) => {
    const payload = await loginUser({ email, password, portal });
    await sessionStorage.setSession(payload.token, payload.user);
    setToken(payload.token);
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
        sessionStorage.setSession(token, next);
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
