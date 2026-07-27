import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { getTasks } from "./taskService";
import { server } from "../test/testServer";

describe("taskService", () => {
  it("normalizes object-wrapped task lists to arrays", async () => {
    server.use(
      http.get("*/api/client/tasks", () =>
        HttpResponse.json({
          tasks: [{ _id: "task-1", title: "Follow up" }],
          count: 1,
        }),
      ),
    );

    await expect(getTasks()).resolves.toEqual([
      expect.objectContaining({ _id: "task-1" }),
    ]);
  });
});
