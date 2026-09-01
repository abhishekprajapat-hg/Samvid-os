import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { installApiMocks, resetE2EState } from "./fixtures/apiMock.js";
import { installFailureGuards } from "./fixtures/guards.js";
import { forbiddenRouteSamples, routeMatrix, ROLES } from "./fixtures/seedData.js";

const openAsRole = async (browser, role, path = "/dashboard", options = {}) => {
  const context = await browser.newContext({
    storageState: `e2e/.auth/${role}.json`,
    viewport: options.viewport || { width: 1440, height: 900 },
    permissions: options.permissions || [],
    geolocation: options.geolocation,
  });
  const page = await context.newPage();
  const assertClean = installFailureGuards(page, options);
  await installApiMocks(page, { mode: options.mode || "populated", role });
  await page.goto(new URL(path, "http://127.0.0.1:4173").toString());
  await expect(page.locator(".workspace-shell, main, form").first()).toBeVisible({ timeout: 15000 });
  return { context, page, assertClean };
};

test("login, session restore and logout @smoke", async ({ page }) => {
  const assertClean = installFailureGuards(page);
  await installApiMocks(page);
  await page.goto("/login");
  await page.getByPlaceholder(/email/i).fill("admin@example.com");
  await page.getByPlaceholder(/password/i).fill("password123");
  await page.getByRole("button", { name: /login/i }).click();
  await expect(page).toHaveURL(/\/company-a\/dashboard$/);
  await expect(page.locator(".workspace-shell")).toBeVisible();

  await page.reload();
  await expect(page.locator(".workspace-shell")).toBeVisible();

  await page.getByLabel("Logout").first().click();
  await expect(page).toHaveURL(/\/company-a\/login$/);
  await assertClean();
});

test("token refresh rotates stored browser session during restoration", async ({ page }) => {
  const assertClean = installFailureGuards(page, {
    allowConsolePatterns: [
      /Failed to load resource: the server responded with a status of 401/i,
    ],
  });
  await page.addInitScript(() => {
    window.localStorage.setItem("token", "expired-token");
    window.localStorage.setItem("refreshToken", "valid-refresh");
    window.localStorage.setItem("role", "ADMIN");
    window.localStorage.setItem("user", JSON.stringify({ _id: "e2e-admin", role: "ADMIN" }));
  });
  await installApiMocks(page, { mode: "refresh" });
  await page.goto("/dashboard");
  await expect(page.locator(".workspace-shell")).toBeVisible({ timeout: 15000 });

  await expect(page.evaluate(() => window.localStorage.getItem("token"))).resolves.toBe("token-refreshed");
  await expect(page.evaluate(() => window.localStorage.getItem("refreshToken"))).resolves.toBe("refresh-rotated");
  await expect(page.evaluate(() => JSON.parse(window.localStorage.getItem("tenant") || "{}").subdomain)).resolves.toBe("company-a");
  await assertClean();
});

test("tenant-prefixed route, deep link, refresh, back/forward and unknown route @smoke", async ({ browser }) => {
  const { context, page, assertClean } = await openAsRole(browser, "ADMIN", "/company-a/leads");
  await expect(page).toHaveURL(/company-a\/leads/);
  await expect(page.locator(".workspace-shell")).toBeVisible();
  await expect(page.locator("body")).toContainText("Asha Lead");
  await page.goto("/company-a/inventory/inv-1");
  await expect(page).toHaveURL(/company-a\/inventory\/inv-1/);
  await expect(page.locator(".workspace-shell")).toBeVisible();
  await page.reload();
  await expect(page.locator(".workspace-shell")).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/company-a\/leads/);
  await expect(page.locator(".workspace-shell")).toBeVisible();
  await expect(page.locator("body")).toContainText("Asha Lead");
  await page.goForward();
  await expect(page).toHaveURL(/company-a\/inventory\/inv-1/);
  await expect(page.locator(".workspace-shell")).toBeVisible();
  await page.goto("/company-a/not-a-real-page");
  await expect(page).toHaveURL(/\/company-a\/dashboard$/);
  await expect(page.locator(".workspace-shell")).toBeVisible();
  await assertClean();
  await context.close();
});

test("role route matrix enforces allowed and forbidden pages", async ({ browser }) => {
  test.setTimeout(240000);
  for (const role of ROLES) {
    const allowedPath = routeMatrix[role][0];
    const allowed = await openAsRole(browser, role, allowedPath);
    await expect(allowed.page).not.toHaveURL(/\/login$/);
    await expect(allowed.page.locator(".workspace-shell")).toBeVisible({ timeout: 15000 });
    await allowed.assertClean();
    await allowed.context.close();

    const forbiddenPath = forbiddenRouteSamples[role]?.[0];
    if (forbiddenPath) {
      const forbidden = await openAsRole(browser, role, forbiddenPath);
      await expect(forbidden.page).not.toHaveURL(new RegExp(`${forbiddenPath.replaceAll("/", "\\/")}$`));
      await expect(forbidden.page.locator(".workspace-shell")).toBeVisible({ timeout: 15000 });
      await forbidden.assertClean();
      await forbidden.context.close();
    }
  }
});

test("navigation exposes Finance for Inside Executive and hides forbidden admin tools", async ({ browser }) => {
  const { context, page, assertClean } = await openAsRole(browser, "INSIDE_EXECUTIVE", "/dashboard");
  await expect(page.getByRole("link", { name: /finance/i }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /access/i })).toHaveCount(0);
  await assertClean();
  await context.close();
});

test("hidden navigation does not grant direct-route permission", async ({ browser }) => {
  const { context, page, assertClean } = await openAsRole(browser, "CHANNEL_PARTNER", "/dashboard");
  await expect(page.getByRole("link", { name: /chat/i })).toHaveCount(0);
  await page.goto("/company-a/chat");
  await expect(page).not.toHaveURL(/\/company-a\/chat$/);
  await expect(page.locator(".workspace-shell")).toBeVisible();
  await assertClean();
  await context.close();
});

test("critical routes pass axe checks", async ({ browser }) => {
  for (const routePath of ["/dashboard", "/leads", "/inventory", "/attendance", "/profile"]) {
    const { context, page, assertClean } = await openAsRole(browser, "ADMIN", routePath);
    const results = await new AxeBuilder({ page })
      .exclude("[data-axe-skip]")
      .analyze();
    expect(results.violations).toEqual([]);
    await assertClean();
    await context.close();
  }
});

test("responsive smoke at 360px, 768px and 1440px", async ({ browser }) => {
  for (const viewport of [
    { width: 360, height: 740 },
    { width: 768, height: 1024 },
    { width: 1440, height: 900 },
  ]) {
    const { context, page, assertClean } = await openAsRole(browser, "ADMIN", "/leads", { viewport });
    await expect(page.locator(".workspace-shell")).toBeVisible();
    await expect(page.locator("body")).toBeVisible();
    await assertClean();
    await context.close();
  }
});

test("geolocation granted and denied paths do not crash attendance", async ({ browser }) => {
  for (const geolocation of [
    { latitude: 22.7196, longitude: 75.8577 },
    { latitude: 22.7196, longitude: 75.8594 },
    { latitude: 22.751, longitude: 75.91 },
  ]) {
    const granted = await openAsRole(browser, "EXECUTIVE", "/attendance", {
      permissions: ["geolocation"],
      geolocation,
    });
    await expect(granted.page.locator(".workspace-shell")).toBeVisible();
    await granted.assertClean();
    await granted.context.close();
  }

  const denied = await openAsRole(browser, "EXECUTIVE", "/attendance");
  await expect(denied.page.locator(".workspace-shell")).toBeVisible();
  await denied.assertClean();
  await denied.context.close();
});

test("inactivity timeout clears restored sessions", async ({ browser }) => {
  const context = await browser.newContext({
    storageState: "e2e/.auth/ADMIN.json",
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  const assertClean = installFailureGuards(page);
  await page.addInitScript(() => {
    window.localStorage.setItem("samvid-os.e2e.sessionTimeoutMs", "5000");
  });
  await installApiMocks(page);
  await page.goto("/dashboard");
  await expect(page.locator(".workspace-shell")).toBeVisible({ timeout: 15000 });
  await expect(page).toHaveURL(/\/company-a\/login$/, { timeout: 10000 });
  await expect(page.evaluate(() => window.localStorage.getItem("token"))).resolves.toBeNull();
  await assertClean();
  await context.close();
});

test("API error states render without unhandled page failures", async ({ browser }) => {
  const { context, page, assertClean } = await openAsRole(browser, "ADMIN", "/leads", {
    mode: "error",
    allowServerErrors: true,
    allowConsolePatterns: [
      /Failed to load resource: the server responded with a status of 500/i,
      /Load leads failed: E2E forced API error/i,
      /Load transfer users failed: E2E forced API error/i,
      /Load inventory for leads failed: E2E forced API error/i,
    ],
  });
  await expect(page.locator(".workspace-shell")).toBeVisible();
  await assertClean();
  await context.close();
});

test("seed reset helper restores deterministic authenticated state", async ({ page }) => {
  const assertClean = installFailureGuards(page);
  await installApiMocks(page);
  await resetE2EState(page, "MANAGER");
  await page.goto("/dashboard");
  await expect(page.locator(".workspace-shell")).toBeVisible();
  await expect(page.evaluate(() => window.localStorage.getItem("role"))).resolves.toBe("MANAGER");
  await assertClean();
});
