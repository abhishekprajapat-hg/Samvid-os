import React from "react";
import { Linking } from "react-native";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import type { UserRole } from "../types";
import { LeadsMatrixScreen } from "./leads/LeadsMatrixScreen";
import { AssetVaultScreen } from "./inventory/AssetVaultScreen";
import { AttendanceScreen } from "./attendance/AttendanceScreen";
import { TaskManagerScreen } from "./tasks/TaskManagerScreen";
import { ProfileScreen } from "./profile/ProfileScreen";
import { NotificationsScreen } from "./notifications/NotificationsScreen";

let mockRole: UserRole = "ADMIN";
const mockUpdateUser = jest.fn();
const mockNavigate = jest.fn();
const mockSetParams = jest.fn();
const mockRouteParams: Record<string, unknown> = {};

const mockRequestMediaLibraryPermissionsAsync = jest.fn();
const mockLaunchImageLibraryAsync = jest.fn();
const mockGetDocumentAsync = jest.fn();

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    setParams: mockSetParams,
    getParent: () => ({ navigate: mockNavigate }),
  }),
  useRoute: () => ({ params: mockRouteParams }),
}));

jest.mock("../context/AuthContext", () => ({
  useAuth: () => ({
    role: mockRole,
    user: {
      _id: "user-1",
      name: `${mockRole} User`,
      email: `${String(mockRole).toLowerCase()}@example.com`,
      role: mockRole,
      isActive: true,
    },
    updateUser: mockUpdateUser,
  }),
}));

jest.mock("expo-image-picker", () => ({
  __esModule: true,
  MediaTypeOptions: { Images: "Images" },
  requestMediaLibraryPermissionsAsync: (...args: unknown[]) => mockRequestMediaLibraryPermissionsAsync(...args),
  launchImageLibraryAsync: (...args: unknown[]) => mockLaunchImageLibraryAsync(...args),
}));

jest.mock("expo-document-picker", () => ({
  __esModule: true,
  getDocumentAsync: (...args: unknown[]) => mockGetDocumentAsync(...args),
}));

jest.mock("@react-native-community/datetimepicker", () => ({
  __esModule: true,
  default: () => null,
  DateTimePickerAndroid: { open: jest.fn() },
}));

jest.mock("../services/api", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
  },
}));

jest.mock("../services/leadService", () => ({
  getAllLeads: jest.fn(),
  getLeadActivity: jest.fn(),
  createLead: jest.fn(),
  updateLeadStatus: jest.fn(),
  assignLead: jest.fn(),
  addLeadDiaryEntry: jest.fn(),
  getPendingLeadStatusRequests: jest.fn(),
  getLeadStatusRequests: jest.fn(),
  approveLeadStatusRequest: jest.fn(),
  rejectLeadStatusRequest: jest.fn(),
  getLeadPaymentRequests: jest.fn(),
  reviewLeadPaymentRequest: jest.fn(),
}));

jest.mock("../services/inventoryService", () => ({
  getInventoryAssets: jest.fn(),
  createInventoryAsset: jest.fn(),
  updateInventoryAsset: jest.fn(),
  deleteInventoryAsset: jest.fn(),
  requestInventoryUpdate: jest.fn(),
  requestInventoryStatusChange: jest.fn(),
  getPendingInventoryRequests: jest.fn(),
  approveInventoryRequest: jest.fn(),
  rejectInventoryRequest: jest.fn(),
}));

jest.mock("../services/taskService", () => ({
  getTasks: jest.fn(),
  getTaskStats: jest.fn(),
  createTask: jest.fn(),
  updateTask: jest.fn(),
  deleteTask: jest.fn(),
}));

jest.mock("../services/userService", () => ({
  getUsers: jest.fn(),
  getMyProfile: jest.fn(),
  updateMyProfile: jest.fn(),
}));

jest.mock("../services/chatService", () => ({
  uploadChatFile: jest.fn(),
}));

const api = jest.requireMock("../services/api").default;
const leadService = jest.requireMock("../services/leadService");
const inventoryService = jest.requireMock("../services/inventoryService");
const taskService = jest.requireMock("../services/taskService");
const userService = jest.requireMock("../services/userService");
const chatService = jest.requireMock("../services/chatService");

const defaultStats = {
  TODO: 1,
  IN_PROGRESS: 0,
  COMPLETED: 0,
  BACKLOG: 0,
  total: 1,
  pending: 1,
  overdue: 0,
  LOW: 0,
  MEDIUM: 1,
  HIGH: 0,
};

const resetScreenMocks = () => {
  mockRole = "ADMIN";
  mockUpdateUser.mockReset();
  mockNavigate.mockReset();
  mockSetParams.mockReset();
  Object.keys(mockRouteParams).forEach((key) => delete mockRouteParams[key]);
  mockRequestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: true });
  mockLaunchImageLibraryAsync.mockResolvedValue({ canceled: true, assets: [] });
  mockGetDocumentAsync.mockResolvedValue({ canceled: true, assets: [] });

  api.get.mockReset();
  api.get.mockImplementation((path: string) => {
    if (path === "/attendance/me") {
      return Promise.resolve({
        data: {
          attendance: {
            status: "Present",
            checkInAt: "2026-01-01T04:30:00.000Z",
            workingMinutes: 240,
          },
        },
      });
    }
    if (path === "/attendance/leave-balance/my") {
      return Promise.resolve({ data: { balance: { paidLeave: 5, sickLeave: 2, casualLeave: 1 } } });
    }
    return Promise.resolve({ data: {} });
  });

  leadService.getAllLeads.mockResolvedValue([
    {
      _id: "lead-1",
      name: "Asha Lead",
      phone: "9876543210",
      email: "asha@example.com",
      city: "Indore",
      status: "NEW",
      projectInterested: "Samvid Tower",
      createdAt: "2026-01-01T00:00:00.000Z",
    },
  ]);
  leadService.getLeadActivity.mockResolvedValue([]);
  leadService.getPendingLeadStatusRequests.mockResolvedValue([]);
  leadService.getLeadStatusRequests.mockImplementation(({ status }: { status?: string } = {}) =>
    Promise.resolve(
      status === "approved"
        ? [
            {
              _id: "review-1",
              status: "approved",
              proposedStatus: "CLOSED",
              requestNote: "Closed with documents",
              reviewedAt: "2026-01-02T00:00:00.000Z",
              createdAt: "2026-01-01T00:00:00.000Z",
              requestedBy: { name: "Executive", role: "EXECUTIVE" },
              reviewedBy: { name: "Admin", role: "ADMIN" },
              lead: { _id: "lead-1", name: "Asha Lead", status: "CLOSED" },
              closureDocuments: [{ url: "https://cdn.test/closure.pdf", name: "closure.pdf" }],
            },
          ]
        : [],
    ),
  );
  leadService.getLeadPaymentRequests.mockResolvedValue([]);

  inventoryService.getInventoryAssets.mockResolvedValue([
    {
      _id: "asset-1",
      title: "Samvid Tower",
      location: "Indore",
      category: "Apartment",
      type: "Sale",
      status: "Available",
      price: 2500000,
      images: ["https://cdn.test/asset.jpg"],
      amenities: ["Parking"],
    },
  ]);
  inventoryService.getPendingInventoryRequests.mockResolvedValue([]);

  taskService.getTasks.mockResolvedValue([
    {
      _id: "task-1",
      title: "Call Asha",
      description: "Confirm site visit",
      status: "TODO",
      priority: "MEDIUM",
      createdAt: "2026-01-01T00:00:00.000Z",
      subtasks: [{ title: "Dial lead", isCompleted: false }],
      tags: ["Call"],
    },
  ]);
  taskService.getTaskStats.mockResolvedValue(defaultStats);

  userService.getUsers.mockResolvedValue({
    users: [{ _id: "exec-1", name: "Executive One", role: "EXECUTIVE", isActive: true }],
  });
  userService.getMyProfile.mockResolvedValue({
    profile: {
      _id: "user-1",
      name: "Admin User",
      phone: "9000000000",
      email: "admin@example.com",
      role: "ADMIN",
      companyId: "company-1",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    },
    summary: { assignedLeads: 3, closedLeads: 1 },
  });
  userService.updateMyProfile.mockResolvedValue({
    profile: { name: "Admin User", phone: "9000000000", profileImageUrl: "https://cdn.test/profile.jpg" },
    summary: { assignedLeads: 3, closedLeads: 1 },
  });

  chatService.uploadChatFile.mockResolvedValue({
    fileName: "profile.jpg",
    fileUrl: "https://cdn.test/profile.jpg",
    mimeType: "image/jpeg",
    size: 10,
    storagePath: "uploads/profile.jpg",
  });
};

describe("mobile business screens", () => {
  beforeEach(() => {
    resetScreenMocks();
  });

  it("loads leads and filters to the empty state", async () => {
    const screen = render(<LeadsMatrixScreen />);

    expect(await screen.findByText("Asha Lead")).toBeTruthy();
    fireEvent.changeText(screen.getByPlaceholderText("Search name, phone, city"), "not-present");

    expect(screen.getByText("No leads found for current filter")).toBeTruthy();
  });

  it("shows a controlled leads error when the API is offline", async () => {
    leadService.getAllLeads.mockRejectedValueOnce(new Error("Network Error"));

    const screen = render(<LeadsMatrixScreen />);

    expect(await screen.findByText("Network Error")).toBeTruthy();
  });

  it("loads inventory and hides creation from production executives", async () => {
    mockRole = "PRODUCTION_EXECUTIVE";
    const screen = render(<AssetVaultScreen />);

    expect(await screen.findByText("Samvid Tower")).toBeTruthy();
    expect(screen.queryByText("+ Add Asset")).toBeNull();
  });

  it("surfaces denied gallery permission before uploading inventory photos", async () => {
    mockRequestMediaLibraryPermissionsAsync.mockResolvedValueOnce({ granted: false });
    const screen = render(<AssetVaultScreen />);

    await screen.findByText("Samvid Tower");
    fireEvent.press(screen.getByText("+ Add Asset"));
    fireEvent.press(await screen.findByText("+ Upload Photos"));

    expect(await screen.findByText("Media permission is required to upload photos")).toBeTruthy();
  });

  it("loads attendance and leave balances", async () => {
    const screen = render(<AttendanceScreen />);

    expect(await screen.findByText("Current Status")).toBeTruthy();
    expect(screen.getByText("Present")).toBeTruthy();
    expect(screen.getByText("Paid Leave")).toBeTruthy();
    expect(screen.getByText("5")).toBeTruthy();
  });

  it("shows a controlled attendance error when the API rejects", async () => {
    api.get.mockRejectedValueOnce({ response: { data: { message: "Attendance unavailable" } } });

    const screen = render(<AttendanceScreen />);

    expect(await screen.findByText("Attendance unavailable")).toBeTruthy();
  });

  it("loads tasks, stats and checklist items", async () => {
    const screen = render(<TaskManagerScreen />);

    expect(await screen.findByText("Call Asha")).toBeTruthy();
    expect(screen.getByText("Confirm site visit")).toBeTruthy();
    expect(screen.getByText("Pending")).toBeTruthy();
    expect(screen.getByText("Checklist: 0/1")).toBeTruthy();
  });

  it("loads profile and handles denied photo permissions without uploading", async () => {
    mockRequestMediaLibraryPermissionsAsync.mockResolvedValueOnce({ granted: false });
    const screen = render(<ProfileScreen />);

    expect(await screen.findByDisplayValue("Admin User")).toBeTruthy();
    fireEvent.press(screen.getByText("Upload Photo"));

    await waitFor(() =>
      expect(screen.getAllByText("Media permission is required to upload profile image").length).toBeGreaterThan(0),
    );
    expect(chatService.uploadChatFile).not.toHaveBeenCalled();
  });

  it("updates the profile after a successful photo upload", async () => {
    mockLaunchImageLibraryAsync.mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: "file:///profile.jpg", fileName: "profile.jpg", mimeType: "image/jpeg" }],
    });

    const screen = render(<ProfileScreen />);

    await screen.findByDisplayValue("Admin User");
    fireEvent.press(screen.getByText("Upload Photo"));

    await waitFor(() => expect(chatService.uploadChatFile).toHaveBeenCalledTimes(1));
    expect(userService.updateMyProfile).toHaveBeenCalledWith(
      expect.objectContaining({ profileImageUrl: "https://cdn.test/profile.jpg" }),
    );
    expect(mockUpdateUser).toHaveBeenCalledWith({ profileImageUrl: "https://cdn.test/profile.jpg" });
  });

  it("opens approved review documents through the native download path", async () => {
    const openUrlSpy = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
    const screen = render(<NotificationsScreen />);

    expect(await screen.findByText("closure.pdf")).toBeTruthy();
    const downloadButtons = screen.getAllByText("Download");
    fireEvent.press(downloadButtons[0]);

    await waitFor(() => expect(openUrlSpy).toHaveBeenCalledWith("https://cdn.test/closure.pdf"));
    openUrlSpy.mockRestore();
  });
});
