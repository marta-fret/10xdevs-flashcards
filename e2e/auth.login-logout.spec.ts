import { test, expect } from "@playwright/test";
import { AuthPage } from "./page-objects/auth.page";

const E2E_EMAIL = process.env.E2E_EMAIL;
const E2E_PASSWORD = process.env.E2E_PASSWORD;

test.describe("Auth flow", () => {
  test.skip(!E2E_EMAIL || !E2E_PASSWORD, "E2E_EMAIL and E2E_PASSWORD must be set for auth flow tests");

  test("login and logout success redirects between login and generate pages", async ({ page }) => {
    const authPage = new AuthPage(page);

    // Arrange: open application as unauthenticated user
    await authPage.gotoRoot();

    // Assert: should redirect to /login
    await expect(page).toHaveURL(/\/login(\?.*)?$/);
    await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();

    // Act: perform login with valid credentials
    await authPage.login(E2E_EMAIL as string, E2E_PASSWORD as string);

    // Assert: redirected to /generate after successful login
    await expect(page).toHaveURL(/\/generate(\?.*)?$/);

    // Act: click logout from navigation bar
    await authPage.getLogoutButton().click();

    // Assert: redirected back to login page
    await expect(page).toHaveURL(/\/login(\?.*)?$/);
    await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
  });
});
