import AsyncStorage from "@react-native-async-storage/async-storage";
import type { User } from "../types";

const TOKEN_KEY = "token";
const REFRESH_TOKEN_KEY = "refresh_token";
const ROLE_KEY = "role";
const USER_KEY = "user";
const SESSION_EXPIRES_AT_KEY = "session_expires_at";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

export const sessionStorage = {
  async getToken() {
    const expired = await this.isSessionExpired();
    if (expired) {
      await this.clearSession();
      return null;
    }
    return AsyncStorage.getItem(TOKEN_KEY);
  },

  async getRole() {
    return AsyncStorage.getItem(ROLE_KEY);
  },

  async getRefreshToken() {
    return AsyncStorage.getItem(REFRESH_TOKEN_KEY);
  },

  async getUser(): Promise<User | null> {
    const expired = await this.isSessionExpired();
    if (expired) {
      await this.clearSession();
      return null;
    }

    const raw = await AsyncStorage.getItem(USER_KEY);
    if (!raw) return null;

    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  async setSession(token: string, user: User, refreshToken?: string | null) {
    const expiresAt = String(Date.now() + SESSION_TTL_MS);
    const pairs: [string, string][] = [
      [TOKEN_KEY, token],
      [ROLE_KEY, user.role],
      [USER_KEY, JSON.stringify(user)],
      [SESSION_EXPIRES_AT_KEY, expiresAt],
    ];

    if (refreshToken) {
      pairs.push([REFRESH_TOKEN_KEY, refreshToken]);
    }

    await AsyncStorage.multiSet(pairs);
  },

  async getSessionExpiresAt() {
    const raw = await AsyncStorage.getItem(SESSION_EXPIRES_AT_KEY);
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return parsed;
  },

  async isSessionExpired() {
    const expiresAt = await this.getSessionExpiresAt();
    if (!expiresAt) return false;
    return Date.now() >= expiresAt;
  },

  async getRemainingSessionMs() {
    const expiresAt = await this.getSessionExpiresAt();
    if (!expiresAt) return null;
    return Math.max(0, expiresAt - Date.now());
  },

  async setRefreshToken(refreshToken: string | null) {
    if (!refreshToken) {
      await AsyncStorage.removeItem(REFRESH_TOKEN_KEY);
      return;
    }
    await AsyncStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  },

  async clearSession() {
    await AsyncStorage.multiRemove([TOKEN_KEY, REFRESH_TOKEN_KEY, ROLE_KEY, USER_KEY, SESSION_EXPIRES_AT_KEY]);
  },
};
