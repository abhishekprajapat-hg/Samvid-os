import AsyncStorage from "@react-native-async-storage/async-storage";
import type { User } from "../types";

const TOKEN_KEY = "token";
const ROLE_KEY = "role";
const USER_KEY = "user";

export const sessionStorage = {
  async getToken() {
    return AsyncStorage.getItem(TOKEN_KEY);
  },

  async getRole() {
    return AsyncStorage.getItem(ROLE_KEY);
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

  async setSession(token: string, user: User) {
    await AsyncStorage.multiSet([
      [TOKEN_KEY, token],
      [ROLE_KEY, user.role],
      [USER_KEY, JSON.stringify(user)],
    ]);
  },

  async clearSession() {
    await AsyncStorage.multiRemove([TOKEN_KEY, ROLE_KEY, USER_KEY]);
  },
};