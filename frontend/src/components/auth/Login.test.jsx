import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import Login from "./Login";

describe("Login", () => {
  it("stores the authenticated session and calls onLogin", async () => {
    const onLogin = vi.fn();
    render(
      <MemoryRouter>
        <Login onLogin={onLogin} />
      </MemoryRouter>,
    );

    await userEvent.type(screen.getByPlaceholderText(/email/i), "admin@example.com");
    await userEvent.type(screen.getByPlaceholderText(/password/i), "password123");
    await userEvent.click(screen.getByRole("button", { name: /login/i }));

    expect(await screen.findByRole("button", { name: /login/i })).toBeEnabled();
    expect(localStorage.getItem("token")).toBe("token-ADMIN");
    expect(localStorage.getItem("refreshToken")).toBe("refresh-ADMIN");
    expect(JSON.parse(localStorage.getItem("user"))).toMatchObject({ role: "ADMIN" });
    expect(onLogin).toHaveBeenCalledWith("ADMIN", expect.any(Object));
  });
});
