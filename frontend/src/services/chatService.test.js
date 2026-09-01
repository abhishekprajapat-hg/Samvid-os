import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../test/testServer";
import { uploadChatFile } from "./chatService";

describe("chatService uploads", () => {
  it("returns the canonical attachment contract after upload success", async () => {
    localStorage.setItem("token", "token-admin");

    const attachment = await uploadChatFile(
      new File(["hello"], "hello.png", { type: "image/png" }),
    );

    expect(attachment).toEqual({
      fileName: expect.any(String),
      fileUrl: "https://cdn.test/samvid/attachment.png",
      mimeType: "image/png",
      size: expect.any(Number),
      storagePath: "test/company-a/attachment.png",
    });
    expect(attachment.fileName).not.toHaveLength(0);
    expect(attachment.size).toBeGreaterThan(0);
  });

  it("propagates controlled upload failures instead of swallowing them", async () => {
    server.use(
      http.post("*/api/client/chat/uploads", () =>
        HttpResponse.json({ message: "Unsupported file type" }, { status: 415 }),
      ),
    );

    await expect(uploadChatFile(new File(["x"], "x.exe", { type: "application/x-msdownload" })))
      .rejects.toMatchObject({
        response: expect.objectContaining({ status: 415 }),
      });
  });
});
