import { records, roleUsers, tenant } from "./seedData.js";

const json = (body, status = 200) => ({
  status,
  contentType: "application/json",
  body: JSON.stringify(body),
});

const delay = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms);
});

export const resetE2EState = async (page, role = "ADMIN") => {
  await page.addInitScript(({ user, tenantRow, tokenRole }) => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem("token", `token-${tokenRole}`);
    window.localStorage.setItem("refreshToken", `refresh-${tokenRole}`);
    window.localStorage.setItem("role", tokenRole);
    window.localStorage.setItem("user", JSON.stringify(user));
    if (tenantRow) window.localStorage.setItem("tenant", JSON.stringify(tenantRow));
  }, {
    user: roleUsers[role],
    tenantRow: role === "SUPER_ADMIN" ? null : tenant,
    tokenRole: role,
  });
};

export const installApiMocks = async (page, { mode = "populated", role = "ADMIN" } = {}) => {
  const target = page.context();
  let authMeExpiredOnce = false;
  await target.route("**/socket.io/**", (route) => route.fulfill(json({ ok: true })));
  await target.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname.replace(/^\/api\/client/, "").replace(/^\/api/, "");

    if (mode === "offline" && !pathname.startsWith("/auth/")) {
      return route.abort("internetdisconnected");
    }

    if (mode === "unauthorized" && !pathname.startsWith("/auth/")) {
      return route.fulfill(json({ message: "Unauthorized fixture" }, 401));
    }

    if (mode === "error" && !pathname.startsWith("/auth/")) {
      return route.fulfill(json({ message: "E2E forced API error" }, 500));
    }

    if (mode === "loading" && !pathname.startsWith("/auth/")) {
      await delay(1000);
    }

    if (pathname === "/auth/me") {
      const authorization = request.headers().authorization || "";
      if (mode === "refresh" && authorization.includes("expired-token") && !authMeExpiredOnce) {
        authMeExpiredOnce = true;
        return route.fulfill(json({ message: "Expired" }, 401));
      }
      const user = roleUsers[role] || roleUsers.ADMIN;
      return route.fulfill(json({ user, tenant: user.role === "SUPER_ADMIN" ? null : tenant }));
    }
    if (pathname === "/auth/login" && request.method() === "POST") {
      const body = JSON.parse(request.postData() || "{}");
      const role = String(body.email || "admin").split("@")[0].toUpperCase();
      const user = roleUsers[role] || roleUsers.ADMIN;
      return route.fulfill(json({
        token: `token-${user.role}`,
        refreshToken: `refresh-${user.role}`,
        user,
        tenant: user.role === "SUPER_ADMIN" ? null : tenant,
      }));
    }
    if (pathname === "/auth/logout") return route.fulfill(json({ ok: true }));
    if (pathname === "/auth/refresh") {
      return route.fulfill(json({ token: "token-refreshed", refreshToken: "refresh-rotated", user: roleUsers.ADMIN, tenant }));
    }

    if (pathname === "/protected-refresh-fixture") {
      const authorization = request.headers().authorization || "";
      if (authorization.includes("expired-token")) {
        return route.fulfill(json({ message: "Expired" }, 401));
      }
      return route.fulfill(json({ ok: true }));
    }

    const empty = mode === "empty";
    if (pathname === "/leads") return route.fulfill(json({ leads: empty ? [] : records.leads, count: empty ? 0 : records.leads.length }));
    if (pathname.startsWith("/leads/")) return route.fulfill(json({ lead: records.leads[0], activity: [] }));
    if (pathname === "/inventory") return route.fulfill(json({ inventory: empty ? [] : records.inventory, count: empty ? 0 : records.inventory.length }));
    if (pathname.startsWith("/inventory/")) return route.fulfill(json({ inventory: records.inventory[0], activities: [] }));
    if (pathname === "/users") return route.fulfill(json({ users: empty ? [] : records.users, count: empty ? 0 : records.users.length }));
    if (pathname === "/users/profile") return route.fulfill(json({ user: roleUsers.ADMIN }));
    if (pathname === "/tasks") return route.fulfill(json({ tasks: empty ? [] : records.tasks, count: empty ? 0 : records.tasks.length }));
    if (pathname.startsWith("/attendance")) return route.fulfill(json({ attendance: { status: "PRESENT" }, records: [] }));
    if (pathname.startsWith("/targets")) return route.fulfill(json({ targets: [], leaderboard: records.leaderboard }));
    if (pathname.startsWith("/saas")) return route.fulfill(json({ companies: records.companies, plans: [] }));
    if (pathname === "/chat/contacts") return route.fulfill(json({ contacts: records.contacts }));
    if (pathname === "/chat/conversations") return route.fulfill(json({ conversations: empty ? [] : records.conversations }));
    if (pathname === "/chat/rooms/direct" && request.method() === "POST") return route.fulfill(json({ room: records.conversations[0] }));
    if (pathname.includes("/messages")) return route.fulfill(json({ messages: [] }));
    if (pathname === "/chat/uploads" && request.method() === "POST") {
      if (mode === "upload-error") {
        return route.fulfill(json({ message: "Unsupported file type" }, 415));
      }
      return route.fulfill(json({
        attachment: {
          fileName: "fixture.png",
          fileUrl: "https://cdn.test/samvid/fixture.png",
          mimeType: "image/png",
          size: 7,
          storagePath: "test/company-a/fixture.png",
        },
      }));
    }
    if (pathname.startsWith("/chat")) return route.fulfill(json({ contacts: records.contacts, conversations: records.conversations, rooms: records.conversations, messages: [] }));
    if (pathname === "/assistant/ask") return route.fulfill(json({ answer: "Assistant fixture answer" }));

    return route.fulfill(json({ ok: true, rows: [] }));
  });
};
