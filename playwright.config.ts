import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  // Every spec shares one test database and truncates it.
  workers: 1,
  // The suite runs against `npm run dev`, which compiles a route the first time
  // it is opened. On a cold cache that alone outlasts Playwright's 30s default.
  timeout: 120_000,
  reporter: [["list"]],
  // Assertions wait on `router.refresh()` and on a route the dev server has to
  // compile on first visit, both of which outrun the 5s default here.
  expect: { timeout: 20_000 },
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    // Unset, Playwright downloads its own pinned Chromium. Set
    // PLAYWRIGHT_CHANNEL=chrome locally to drive the installed browser
    // instead. CI leaves it unset so the pinned build stays authoritative.
    channel: process.env.PLAYWRIGHT_CHANNEL,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
    env: {
      MONGODB_DB: process.env.MONGODB_DB_TEST ?? "yca_sumsilui_test",
      BCRYPT_ROUNDS: "4",
    },
  },
});
