import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import api from "./api";
import { getRefreshCalls, resetRefreshCalls, server } from "../test/testServer";

describe("api auth client", () => {
  it("retries simultaneous 401 responses through one refresh request", async () => {
    localStorage.setItem("token", "expired-token");
    localStorage.setItem("refreshToken", "valid-refresh");
    localStorage.setItem("role", "ADMIN");
    localStorage.setItem("user", JSON.stringify({ _id: "admin", role: "ADMIN" }));
    resetRefreshCalls();

    let protectedHits = 0;
    server.use(
      http.get("*/api/client/protected", ({ request }) => {
        protectedHits += 1;
        const authorization = request.headers.get("authorization") || "";
        if (authorization.includes("expired-token")) {
          return HttpResponse.json({ message: "Expired" }, { status: 401 });
        }
        return HttpResponse.json({ ok: true });
      }),
    );

    const [first, second] = await Promise.all([
      api.get("/protected", { cache: false }),
      api.get("/protected", { cache: false }),
    ]);

    expect(first.data.ok).toBe(true);
    expect(second.data.ok).toBe(true);
    expect(getRefreshCalls()).toBe(1);
    expect(protectedHits).toBe(4);
    expect(localStorage.getItem("token")).toBe("token-refreshed");
  });

  it("attaches bearer tokens to protected requests", async () => {
    localStorage.setItem("token", "token-admin");

    server.use(
      http.get("*/api/client/protected-header", ({ request }) =>
        HttpResponse.json({
          authorization: request.headers.get("authorization"),
        }),
      ),
    );

    const response = await api.get("/protected-header", { cache: false });
    expect(response.data.authorization).toBe("Bearer token-admin");
  });

  it("clears local session when refresh-token retry fails", async () => {
    localStorage.setItem("token", "expired-token");
    localStorage.setItem("refreshToken", "bad-refresh");
    localStorage.setItem("role", "ADMIN");
    localStorage.setItem("user", JSON.stringify({ _id: "admin", role: "ADMIN" }));
    localStorage.setItem("tenant", JSON.stringify({ _id: "company-a" }));

    server.use(
      http.get("*/api/client/requires-valid-session", () =>
        HttpResponse.json({ message: "Expired" }, { status: 401 }),
      ),
      http.post("*/api/client/auth/refresh", () =>
        HttpResponse.json({ message: "Refresh expired" }, { status: 401 }),
      ),
    );

    await expect(api.get("/requires-valid-session", { cache: false })).rejects.toBeTruthy();
    expect(localStorage.getItem("token")).toBeNull();
    expect(localStorage.getItem("refreshToken")).toBeNull();
    expect(localStorage.getItem("role")).toBeNull();
    expect(localStorage.getItem("user")).toBeNull();
    expect(localStorage.getItem("tenant")).toBeNull();
  });
});
