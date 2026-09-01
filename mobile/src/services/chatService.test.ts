import api from "./api";
import { uploadChatFile } from "./chatService";

jest.mock("./api", () => ({
  __esModule: true,
  default: {
    post: jest.fn(),
  },
}));

describe("mobile chat upload service", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn() as never;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("uploads files through the authenticated backend contract", async () => {
    const postMock = api.post as jest.Mock;
    postMock.mockResolvedValueOnce({
      data: {
        attachment: {
          fileName: "photo.png",
          fileUrl: "https://cdn.example.test/photo.png",
          mimeType: "image/png",
          size: 128,
          storagePath: "samvid-os/company/user/photo",
        },
      },
    });
    const result = await uploadChatFile({
      uri: "file:///tmp/photo.png",
      name: "photo.png",
      mimeType: "image/png",
    });

    expect(postMock).toHaveBeenCalledWith("/chat/uploads", expect.any(FormData));
    expect(global.fetch as jest.Mock).not.toHaveBeenCalled();
    expect(result).toEqual({
      fileName: "photo.png",
      fileUrl: "https://cdn.example.test/photo.png",
      mimeType: "image/png",
      size: 128,
      storagePath: "samvid-os/company/user/photo",
    });
  });

  it("propagates controlled backend upload failures to the calling screen", async () => {
    const postMock = api.post as jest.Mock;
    postMock.mockRejectedValueOnce({
      response: {
        status: 415,
        data: { message: "Unsupported file type" },
      },
    });

    await expect(
      uploadChatFile({
        uri: "file:///tmp/malware.exe",
        name: "malware.exe",
        mimeType: "application/x-msdownload",
      }),
    ).rejects.toMatchObject({
      response: {
        status: 415,
        data: { message: "Unsupported file type" },
      },
    });

    expect(postMock).toHaveBeenCalledWith("/chat/uploads", expect.any(FormData));
  });

  it("normalizes modern backend attachment fields for legacy mobile callers", async () => {
    const postMock = api.post as jest.Mock;
    postMock.mockResolvedValueOnce({
      data: {
        attachment: {
          name: "document.pdf",
          url: { secure_url: "https://cdn.example.test/document.pdf" },
          type: "application/pdf",
          size: "4096",
          storagePath: "samvid-os/company/user/document",
        },
      },
    });

    await expect(
      uploadChatFile({
        uri: "file:///tmp/document.pdf",
        name: "document.pdf",
        mimeType: "application/pdf",
      }),
    ).resolves.toEqual({
      fileName: "document.pdf",
      fileUrl: "https://cdn.example.test/document.pdf",
      mimeType: "application/pdf",
      size: 4096,
      storagePath: "samvid-os/company/user/document",
    });
  });
});
