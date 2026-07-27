import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { LoginScreen } from "./LoginScreen";

const mockLogin = jest.fn();

jest.mock("../../context/AuthContext", () => ({
  useAuth: () => ({
    login: mockLogin,
  }),
}));

describe("LoginScreen", () => {
  beforeEach(() => {
    mockLogin.mockReset();
  });

  it("normalizes email and submits the selected portal", async () => {
    const screen = render(<LoginScreen />);

    fireEvent.changeText(screen.getByTestId("login-email"), "  User@Example.COM  ");
    fireEvent.changeText(screen.getByTestId("login-password"), "secret");
    fireEvent.press(screen.getByTestId("login-general-portal"));
    fireEvent.press(screen.getByTestId("login-submit"));

    await waitFor(() =>
      expect(mockLogin).toHaveBeenCalledWith({
        email: "user@example.com",
        password: "secret",
        portal: "GENERAL",
      }),
    );
  });

  it("forces the seeded admin account through the admin portal", async () => {
    const screen = render(<LoginScreen />);

    fireEvent.changeText(screen.getByTestId("login-email"), "admin@test.com");
    fireEvent.changeText(screen.getByTestId("login-password"), "secret");
    fireEvent.press(screen.getByTestId("login-general-portal"));
    fireEvent.press(screen.getByTestId("login-submit"));

    await waitFor(() =>
      expect(mockLogin).toHaveBeenCalledWith({
        email: "admin@test.com",
        password: "secret",
        portal: "ADMIN",
      }),
    );
  });
});
