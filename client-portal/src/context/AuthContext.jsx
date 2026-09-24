import { useCallback, useEffect, useState } from "react";
import { getMe, login as loginRequest, logout as logoutRequest } from "../services/authService";
import { getStoredClient, getStoredRefreshToken, getStoredToken, getStoredUser } from "../services/api";
import AuthContext from "./authContext";

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(getStoredUser());
  const [client, setClient] = useState(getStoredClient());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;

    const init = async () => {
      const token = getStoredToken();
      const refreshToken = getStoredRefreshToken();
      if (!token || !refreshToken) {
        if (alive) setReady(true);
        return;
      }

      try {
        const freshUser = await getMe();
        if (alive) setUser(freshUser);
      } catch {
        if (alive) setUser(null);
      } finally {
        if (alive) setReady(true);
      }
    };

    init();
    return () => {
      alive = false;
    };
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await loginRequest(email, password);
    setUser(data.user);
    setClient(data.client);
    return data;
  }, []);

  const logout = useCallback(async () => {
    await logoutRequest();
    setUser(null);
    setClient(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, client, ready, isAuthenticated: Boolean(user), login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
