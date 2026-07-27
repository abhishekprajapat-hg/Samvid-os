import { test, expect } from "@playwright/test";
import { installApiMocks } from "./fixtures/apiMock.js";
import { installFailureGuards } from "./fixtures/guards.js";

test.describe("stable visual regression", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "Visual baselines are scoped to Chromium.");

  test("login form visual baseline", async ({ page }) => {
    const assertClean = installFailureGuards(page);
    await installApiMocks(page);
    await page.goto("/login");
    await expect(page.locator("form")).toBeVisible();
    await expect(page.locator("form")).toHaveScreenshot("login-form.png", {
      animations: "disabled",
      maxDiffPixelRatio: 0.02,
    });
    await assertClean();
  });

  test("admin dashboard shell visual baseline", async ({ browser }) => {
    const context = await browser.newContext({
      storageState: "e2e/.auth/ADMIN.json",
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();
    const assertClean = installFailureGuards(page);
    await installApiMocks(page);
    await page.goto("/dashboard");
    await expect(page.locator(".workspace-shell")).toBeVisible({ timeout: 15000 });
    await expect(page.locator(".workspace-shell")).toHaveScreenshot("admin-dashboard-shell.png", {
      animations: "disabled",
      maxDiffPixelRatio: 0.02,
    });
    await assertClean();
    await context.close();
  });
});
