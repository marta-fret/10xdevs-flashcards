import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
  reporter: [["html", { open: "never" }], ["list"]],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});

// ---------------------------------------------------------------------------
// Future E2E configuration improvements (not yet enabled)
// ---------------------------------------------------------------------------
/*
  Medium-term:
  - Introduce dedicated setup/cleanup projects and shared auth state:
    projects: [
      {
        name: "setup",
        testMatch: /.*\.setup\.ts/,
        teardown: "cleanup",
      },
      {
        name: "cleanup",
        testMatch: /global\.teardown\.ts/,
      },
      {
        name: "chromium",
        use: {
          ...devices["Desktop Chrome"],
          storageState: "playwright/.auth/user.json",
        },
        dependencies: ["setup"],
      },
    ];

  Longer-term:
  - Use a dedicated env file for E2E (e.g. .env.e2e or .env.integration) and/or
    a dedicated dev:e2e server script:
    - Load it at the top of this file with dotenv.
    - Point webServer.command to "npm run dev:e2e" when such a script exists.
*/
