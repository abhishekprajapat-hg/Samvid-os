import { test, expect } from "@playwright/test";

const stagingBaseUrl = process.env.STAGING_BASE_URL || "";
const stagingEmail = process.env.STAGING_E2E_EMAIL || "";
const stagingPassword = process.env.STAGING_E2E_PASSWORD || "";

test.describe("staging-backed smoke", () => {
  test.skip(!stagingBaseUrl || !stagingEmail || !stagingPassword, "Set STAGING_BASE_URL, STAGING_E2E_EMAIL and STAGING_E2E_PASSWORD to run staging smoke tests.");

  test("login, deep link refresh and logout against staging", async ({ page }) => {
    await page.goto(new URL("/login", stagingBaseUrl).toString());
    await page.getByPlaceholder(/email/i).fill(stagingEmail);
    await page.getByPlaceholder(/password/i).fill(stagingPassword);
    await page.getByRole("button", { name: /login/i }).click();
    await expect(page.locator(".workspace-shell")).toBeVisible({ timeout: 30000 });
    await page.reload();
    await expect(page.locator(".workspace-shell")).toBeVisible({ timeout: 30000 });
    await page.getByLabel("Logout").first().click();
    await expect(page).toHaveURL(/\/login$/);
  });
});
