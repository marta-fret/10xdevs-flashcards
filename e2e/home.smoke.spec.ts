import { test, expect } from "@playwright/test";
import { HomePage } from "./page-objects/home.page";

test.describe("Home page", () => {
  test("displays welcome heading", async ({ page }) => {
    const homePage = new HomePage(page);

    // Arrange
    await homePage.goto();

    // Assert
    await expect(homePage.getHeading()).toBeVisible();
  });
});
