import type { Page, Locator } from "@playwright/test";

export class HomePage {
  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto("/");
  }

  getHeading(): Locator {
    return this.page.getByRole("heading", {
      name: "Log in",
    });
  }
}
