import AsyncStorage from "@react-native-async-storage/async-storage";
import { sessionStorage } from "./sessionStorage";
import { makeUser } from "../test/fixtures";

describe("sessionStorage", () => {
  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    await AsyncStorage.clear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("stores token, refresh token, role, user and expiry", async () => {
    const user = makeUser("INSIDE_EXECUTIVE");

    await sessionStorage.setSession("access-token", user, "refresh-token");

    expect(await sessionStorage.getToken()).toBe("access-token");
    expect(await sessionStorage.getRefreshToken()).toBe("refresh-token");
    expect(await sessionStorage.getRole()).toBe("INSIDE_EXECUTIVE");
    expect(await sessionStorage.getUser()).toEqual(user);
    expect(await sessionStorage.getRemainingSessionMs()).toBe(12 * 60 * 60 * 1000);
  });

  it("clears and rejects expired sessions", async () => {
    await sessionStorage.setSession("expired-access", makeUser("ADMIN"), "expired-refresh");

    jest.setSystemTime(new Date("2026-01-01T13:00:00.000Z"));

    expect(await sessionStorage.getToken()).toBeNull();
    expect(await sessionStorage.getUser()).toBeNull();
    expect(await sessionStorage.getRefreshToken()).toBeNull();
  });

  it("removes malformed users without throwing", async () => {
    await AsyncStorage.setItem("user", "{bad-json");

    await expect(sessionStorage.getUser()).resolves.toBeNull();
  });
});
