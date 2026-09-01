import { createMobileCallSession } from "./chatService";

describe("mobile call lifecycle service", () => {
  it("creates one REST call and initiates socket signaling with the returned stable call ID", async () => {
    const createCallLog = jest.fn().mockResolvedValue({
      conversationId: "room-1",
      call: {
        _id: "call-1",
        callId: "call-1",
        status: "INITIATED",
      },
    });
    const socket = {
      emit: jest.fn(),
    };

    const result = await createMobileCallSession({
      conversationId: "room-1",
      recipientId: "user-2",
      callType: "VIDEO",
      socket,
      createCallLog,
      e2ee: { enabled: true, protocol: "X25519-AES-256-GCM" },
    });

    expect(createCallLog).toHaveBeenCalledTimes(1);
    expect(createCallLog).toHaveBeenCalledWith({
      conversationId: "room-1",
      recipientId: "user-2",
      callType: "VIDEO",
      e2ee: { enabled: true, protocol: "X25519-AES-256-GCM" },
    });
    expect(socket.emit).toHaveBeenCalledWith("chat:call:initiate", {
      callId: "call-1",
      conversationId: "room-1",
      mode: "video",
    });
    expect(socket.emit).toHaveBeenCalledWith("messenger:call:initiate", {
      callId: "call-1",
      conversationId: "room-1",
      recipientId: "user-2",
      callType: "VIDEO",
      e2ee: { enabled: true, protocol: "X25519-AES-256-GCM" },
    });
    expect(result.callId).toBe("call-1");
    expect(result.conversationId).toBe("room-1");
    expect(result.call?._id).toBe("call-1");
  });

  it("does not emit socket initiation when REST does not return a stable call ID", async () => {
    const createCallLog = jest.fn().mockResolvedValue({
      conversationId: "room-1",
      call: {
        status: "INITIATED",
      },
    });
    const socket = {
      emit: jest.fn(),
    };

    await expect(
      createMobileCallSession({
        conversationId: "room-1",
        recipientId: "user-2",
        callType: "VOICE",
        socket,
        createCallLog,
      }),
    ).rejects.toThrow("Failed to create call");

    expect(createCallLog).toHaveBeenCalledTimes(1);
    expect(socket.emit).not.toHaveBeenCalled();
  });
});
