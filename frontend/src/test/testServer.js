import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { pagePayloads, roleUsers, tenant } from "./testData";

let apiMode = "populated";
let refreshCalls = 0;

export const setApiMode = (mode) => {
  apiMode = mode;
};

export const getRefreshCalls = () => refreshCalls;
export const resetRefreshCalls = () => {
  refreshCalls = 0;
};

const apiUrl = (path) => `*/api/client${path}`;

const maybeError = () => {
  if (apiMode === "error") {
    return HttpResponse.json({ message: "Fixture API failure" }, { status: 500 });
  }
  return null;
};

const listPayload = (key, responseKey = key) => {
  const error = maybeError();
  if (error) return error;
  const rows = apiMode === "empty" ? [] : pagePayloads[key] || [];
  return HttpResponse.json({ [responseKey]: rows, count: rows.length });
};

export const handlers = [
  http.get(apiUrl("/auth/me"), () =>
    HttpResponse.json({
      user: roleUsers.ADMIN,
      tenant,
    }),
  ),
  http.post(apiUrl("/auth/login"), async ({ request }) => {
    const body = await request.json();
    const role = String(body.email || "").split("@")[0].toUpperCase() || "ADMIN";
    const user = roleUsers[role] || roleUsers.ADMIN;
    return HttpResponse.json({
      token: `token-${user.role}`,
      refreshToken: `refresh-${user.role}`,
      user,
      tenant: user.role === "SUPER_ADMIN" ? null : tenant,
    });
  }),
  http.post(apiUrl("/auth/refresh"), async () => {
    refreshCalls += 1;
    await new Promise((resolve) => setTimeout(resolve, 20));
    return HttpResponse.json({
      token: "token-refreshed",
      refreshToken: "refresh-rotated",
      user: roleUsers.ADMIN,
      tenant,
    });
  }),
  http.post(apiUrl("/auth/logout"), () => HttpResponse.json({ ok: true })),
  http.get(apiUrl("/leads"), () => listPayload("leads")),
  http.get(apiUrl("/leads/:id"), () => HttpResponse.json({ lead: pagePayloads.leads[0] })),
  http.get(apiUrl("/inventory"), () => listPayload("inventory")),
  http.get(apiUrl("/inventory/:id"), () => HttpResponse.json({ inventory: pagePayloads.inventory[0] })),
  http.get(apiUrl("/users"), () => listPayload("users")),
  http.get(apiUrl("/users/profile"), () => HttpResponse.json({ user: roleUsers.ADMIN })),
  http.get(apiUrl("/tasks"), () => listPayload("tasks")),
  http.get(apiUrl("/attendance/me"), () => HttpResponse.json({ attendance: pagePayloads.attendance })),
  http.get(apiUrl("/attendance/daily"), () => HttpResponse.json({ records: [] })),
  http.get(apiUrl("/targets/my"), () => HttpResponse.json({ targets: [] })),
  http.get(apiUrl("/targets/leaderboard"), () => HttpResponse.json({ leaderboard: [] })),
  http.get(apiUrl("/saas/companies"), () => HttpResponse.json({ companies: [tenant] })),
  http.get(apiUrl("/saas/plans"), () => HttpResponse.json({ plans: [] })),
  http.get(apiUrl("/chat/contacts"), () => HttpResponse.json({ contacts: [] })),
  http.get(apiUrl("/chat/conversations"), () => HttpResponse.json({ conversations: [] })),
  http.post(apiUrl("/chat/uploads"), async ({ request }) => {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || Number(file.size || 0) === 0) {
      return HttpResponse.json({ message: "File is required" }, { status: 400 });
    }

    return HttpResponse.json({
      attachment: {
        fileName: file.name || "attachment.bin",
        fileUrl: "https://cdn.test/samvid/attachment.png",
        mimeType: file.type || "application/octet-stream",
        size: file.size || 0,
        storagePath: "test/company-a/attachment.png",
      },
    });
  }),
  http.get(apiUrl("/assistant/ask"), () => HttpResponse.json({ answer: "ok" })),
];

export const server = setupServer(...handlers);
