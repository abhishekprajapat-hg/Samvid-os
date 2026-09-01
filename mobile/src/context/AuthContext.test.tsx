import React from "react";
import { Pressable, Text } from "react-native";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AuthProvider, useAuth } from "./AuthContext";
import { sessionStorage } from "../storage/sessionStorage";
import { makeUser } from "../test/fixtures";

let mockUnauthorizedHandler: null | (() => Promise<void> | void) = null;

jest.mock("../services/api", () => ({
  setUnauthorizedHandler: jest.fn((handler) => {
    mockUnauthorizedHandler = handler;
  }),
}));

jest.mock("../services/authService", () => ({
  getCurrentUser: jest.fn(),
  loginUser: jest.fn(),
}));

jest.mock("../utils/systemSettings", () => ({
  getSessionTimeoutMs: jest.fn((minutes: number) => minutes * 60 * 1000),
  readSystemSettings: jest.fn(() => Promise.resolve({ security: { sessionTimeoutMinutes: 30 } })),
}));

const { getCurrentUser, loginUser } = jest.requireMock("../services/authService");

const Probe = () => {
  const auth = useAuth();
  return (
    <>
      <Text testID="loading">{auth.loading ? "loading" : "ready"}</Text>
      <Text testID="role">{auth.role || "none"}</Text>
      <Text testID="token">{auth.token || "none"}</Text>
      <Pressable
        testID="login"
        onPress={() => auth.login({ email: "admin@example.com", password: "secret", portal: "ADMIN" })}
      >
        <Text>login</Text>
      </Pressable>
      <Pressable testID="logout" onPress={auth.logout}>
        <Text>logout</Text>
      </Pressable>
    </>
  );
};

const textOf = (screen: ReturnType<typeof render>, testID: string) => screen.getByTestId(testID).props.children;

describe("AuthContext", () => {
  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    mockUnauthorizedHandler = null;
    getCurrentUser.mockReset();
    loginUser.mockReset();
    await AsyncStorage.clear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("restores a stored session and refreshes the user contract with /auth/me", async () => {
    const stored = makeUser("MANAGER", { name: "Stored Manager" });
    const fresh = makeUser("MANAGER", { name: "Fresh Manager" });
    await sessionStorage.setSession("stored-access", stored, "stored-refresh");
    getCurrentUser.mockResolvedValue({ user: fresh });

    const screen = render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => expect(textOf(screen, "loading")).toBe("ready"));
    expect(textOf(screen, "role")).toBe("MANAGER");
    expect(textOf(screen, "token")).toBe("stored-access");
    expect(await sessionStorage.getUser()).toEqual(fresh);
    expect(await sessionStorage.getRefreshToken()).toBe("stored-refresh");
  });

  it("persists login payloads and clears session on logout", async () => {
    const user = makeUser("PRODUCTION_EXECUTIVE");
    loginUser.mockResolvedValue({ accessToken: "next-access", refreshToken: "next-refresh", user });
    getCurrentUser.mockResolvedValue({ user: null });

    const screen = render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => expect(textOf(screen, "loading")).toBe("ready"));
    fireEvent.press(screen.getByTestId("login"));

    await waitFor(() => expect(textOf(screen, "role")).toBe("PRODUCTION_EXECUTIVE"));
    expect(await sessionStorage.getToken()).toBe("next-access");
    expect(await sessionStorage.getRefreshToken()).toBe("next-refresh");

    fireEvent.press(screen.getByTestId("logout"));
    await waitFor(() => expect(textOf(screen, "role")).toBe("none"));
    expect(await sessionStorage.getToken()).toBeNull();
  });

  it("logs out when the API unauthorized handler fires", async () => {
    await sessionStorage.setSession("stored-access", makeUser("ADMIN"), "stored-refresh");
    getCurrentUser.mockResolvedValue({ user: makeUser("ADMIN") });

    const screen = render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => expect(textOf(screen, "role")).toBe("ADMIN"));
    await act(async () => {
      await mockUnauthorizedHandler?.();
    });

    expect(textOf(screen, "role")).toBe("none");
  });

  it("does not restore expired local sessions", async () => {
    await sessionStorage.setSession("expired-access", makeUser("ADMIN"), "expired-refresh");
    jest.setSystemTime(new Date("2026-01-01T13:00:00.000Z"));

    const screen = render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => expect(textOf(screen, "loading")).toBe("ready"));
    expect(textOf(screen, "role")).toBe("none");
    expect(await sessionStorage.getToken()).toBeNull();
    expect(getCurrentUser).not.toHaveBeenCalled();
  });
});
