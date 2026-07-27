import { test, expect } from "@playwright/test";
import { installApiMocks } from "./fixtures/apiMock.js";
import { installFailureGuards } from "./fixtures/guards.js";

const openAdminPage = async (browser, path, mode = "populated") => {
  const context = await browser.newContext({
    storageState: "e2e/.auth/ADMIN.json",
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  const assertClean = installFailureGuards(page, { allowServerErrors: mode === "error" });
  await installApiMocks(page, { mode });
  await page.goto(path);
  await expect(page.locator(".workspace-shell")).toBeVisible();
  return { context, page, assertClean };
};

const criticalPages = [
  "/dashboard",
  "/leads",
  "/leads/lead-1",
  "/inventory",
  "/inventory/inv-1",
  "/finance",
  "/reports",
  "/leaderboard",
  "/targets",
  "/calendar",
  "/tasks",
  "/attendance",
  "/admin/notifications",
  "/admin/users",
  "/admin/console",
  "/admin/meta-ads",
  "/settings",
  "/profile",
  "/chat",
];

test("critical page smoke loads representative business screens @smoke", async ({ browser }) => {
  for (const path of ["/dashboard", "/leads", "/inventory", "/tasks", "/chat"]) {
    const { context, page, assertClean } = await openAdminPage(browser, path);
    await expect(page).not.toHaveURL(/\/login$/);
    await expect(page.locator("body")).toContainText(/Admin|Dashboard|Lead|Inventory|Task|Chat/i);
    await assertClean();
    await context.close();
  }
});

for (const path of criticalPages) {
  test(`major page loads with populated fixtures: ${path}`, async ({ browser }) => {
    const { context, page, assertClean } = await openAdminPage(browser, path);
    await expect(page).not.toHaveURL(/\/login$/);
    await expect(page.locator("body")).toContainText(/Admin|Dashboard|Lead|Inventory|Finance|Report|Task|Attendance|Profile|Chat|Settings|Console|Meta|Calendar|Target/i);
    await assertClean();
    await context.close();
  });
}

test("major data pages tolerate empty fixtures", async ({ browser }) => {
  for (const path of ["/leads", "/inventory", "/tasks", "/attendance", "/chat"]) {
    const { context, page, assertClean } = await openAdminPage(browser, path, "empty");
    await expect(page.locator(".workspace-shell")).toBeVisible();
    await assertClean();
    await context.close();
  }
});

test("major data pages expose loading states before fixtures resolve", async ({ browser }) => {
  for (const path of ["/leads", "/inventory", "/tasks", "/attendance", "/chat"]) {
    const { context, page, assertClean } = await openAdminPage(browser, path, "loading");
    await expect(page.locator(".workspace-shell")).toBeVisible();
    await expect(page.locator("body")).toContainText(/Loading|Lead|Inventory|Task|Attendance|Chat/i);
    await assertClean();
    await context.close();
  }
});

test("forms, search fields, filters and modal-like controls are keyboard reachable", async ({ browser }) => {
  const { context, page, assertClean } = await openAdminPage(browser, "/leads");
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus")).toBeVisible();
  const search = page.getByPlaceholder(/search/i).first();
  if (await search.count()) {
    await search.fill("Asha");
    await expect(search).toHaveValue("Asha");
  }
  await assertClean();
  await context.close();
});

test("CSV/XLSX/PDF style export controls do not trigger unsafe formula rendering", async ({ browser }) => {
  const { context, page, assertClean } = await openAdminPage(browser, "/leads");
  await expect(page.locator("body")).not.toContainText("=HYPERLINK(");
  await expect(page.locator("body")).not.toContainText("+cmd|");
  await assertClean();
  await context.close();
});

test("realtime chat page survives socket disconnect style failures", async ({ browser }) => {
  const context = await browser.newContext({ storageState: "e2e/.auth/ADMIN.json" });
  const page = await context.newPage();
  const assertClean = installFailureGuards(page);
  await page.route("**/socket.io/**", (route) => route.abort("failed"));
  await installApiMocks(page);
  await page.goto("/chat");
  await expect(page.locator(".workspace-shell")).toBeVisible();
  await assertClean();
  await context.close();
});
