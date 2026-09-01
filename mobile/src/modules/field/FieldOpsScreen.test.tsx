import React from "react";
import { render, waitFor } from "@testing-library/react-native";
import { FieldOpsScreen } from "./FieldOpsScreen";

const mockNavigate = jest.fn();
const mockGetInventoryAssets = jest.fn((): Promise<any[]> => Promise.resolve([]));

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

jest.mock("../../services/leadService", () => ({
  getAllLeads: jest.fn(() => Promise.resolve([])),
}));

jest.mock("../../services/inventoryService", () => ({
  getInventoryAssets: () => mockGetInventoryAssets(),
}));

jest.mock("../../services/userService", () => ({
  getFieldExecutiveLocations: jest.fn(() => Promise.resolve([])),
  getUsers: jest.fn(() => Promise.resolve({ users: [] })),
}));

jest.mock("react-native-webview", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    WebView: jest.fn((props) => React.createElement(View, { ...props, testID: "field-map-webview" })),
  };
});

const { WebView } = jest.requireMock("react-native-webview");

describe("FieldOpsScreen map WebView security", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetInventoryAssets.mockResolvedValue([]);
  });

  it("renders local map HTML without wildcard navigation or DOM storage", async () => {
    render(<FieldOpsScreen />);

    await waitFor(() => expect(WebView).toHaveBeenCalled());

    const props = WebView.mock.calls.at(-1)?.[0];
    expect(props.originWhitelist).toEqual(["about:blank"]);
    expect(props.domStorageEnabled).toBe(false);
    expect(props.javaScriptEnabled).toBe(true);
    expect(props.source.html).toContain("<!doctype html>");
  });

  it("escapes map popup data and avoids inline popup event handlers", async () => {
    mockGetInventoryAssets.mockResolvedValueOnce([
      {
        _id: "asset-x' onclick='alert(1)",
        projectName: "<img src=x onerror=alert(1)>",
        location: "<svg onload=alert(2)>",
        status: "<b>Available</b>",
        siteLocation: { lat: 22.72, lng: 75.86 },
      },
    ]);

    render(<FieldOpsScreen />);

    await waitFor(() => expect(WebView).toHaveBeenCalled());

    const props = WebView.mock.calls.at(-1)?.[0];
    expect(props.source.html).toContain("const escapeHtml =");
    expect(props.source.html).toContain("data-direction-id");
    expect(props.source.html).not.toContain("onclick=\"window.__goDirection");
  });
});
