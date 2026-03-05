import AsyncStorage from "@react-native-async-storage/async-storage";
import type { User } from "../types";

const TOKEN_KEY = "token";
const REFRESH_TOKEN_KEY = "refresh_token";
const ROLE_KEY = "role";
const USER_KEY = "user";

export const sessionStorage = {
  async getToken() {
    return AsyncStorage.getItem(TOKEN_KEY);
  },

  async getRole() {
    return AsyncStorage.getItem(ROLE_KEY);
  },

  async getRefreshToken() {
    return AsyncStorage.getItem(REFRESH_TOKEN_KEY);
  },

  async getUser(): Promise<User | null> {
    const raw = await AsyncStorage.getItem(USER_KEY);
    if (!raw) return null;

    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  async setSession(token: string, user: User, refreshToken?: string | null) {
    const pairs: [string, string][] = [
      [TOKEN_KEY, token],
      [ROLE_KEY, user.role],
      [USER_KEY, JSON.stringify(user)],
    ];

    if (refreshToken) {
      pairs.push([REFRESH_TOKEN_KEY, refreshToken]);
    }

    await AsyncStorage.multiSet(pairs);
  },

  async setRefreshToken(refreshToken: string | null) {
    if (!refreshToken) {
      await AsyncStorage.removeItem(REFRESH_TOKEN_KEY);
      return;
    }
    await AsyncStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  },

  async clearSession() {
    await AsyncStorage.multiRemove([TOKEN_KEY, REFRESH_TOKEN_KEY, ROLE_KEY, USER_KEY]);
  },
};
