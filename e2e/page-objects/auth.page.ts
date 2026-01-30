import type { Locator, Page } from "@playwright/test";

export class AuthPage {
  constructor(private readonly page: Page) {}

  async gotoRoot() {
    await this.page.goto("/");
  }

  getLoginEmailInput(): Locator {
    return this.page.getByTestId("login-email");
  }

  getLoginPasswordInput(): Locator {
    return this.page.getByTestId("login-password");
  }

  getLoginSubmitButton(): Locator {
    return this.page.getByTestId("login-submit");
  }

  getLogoutButton(): Locator {
    return this.page.getByTestId("logout-button");
  }

  async login(email: string, password: string) {
    const emailInput = this.getLoginEmailInput();
    const passwordInput = this.getLoginPasswordInput();

    // Wait for React hydration - ensure inputs are editable
    await emailInput.waitFor({ state: "visible" });
    await this.page.waitForLoadState("networkidle");

    await emailInput.click();
    await emailInput.pressSequentially(email);
    await emailInput.blur();

    await passwordInput.click();
    await passwordInput.pressSequentially(password);
    await passwordInput.blur();

    await this.getLoginSubmitButton().click();
  }
}
