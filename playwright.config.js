import { defineConfig, devices } from "playwright/test";

const baseURL = process.env.E2E_BASE_URL || "http://127.0.0.1:5173";
const apiURL = process.env.E2E_API_URL || `http://127.0.0.1:${process.env.API_PORT || 3001}`;
const reuseExistingServer = !process.env.CI && !process.env.E2E_BASE_URL;
const webServer = process.env.E2E_BASE_URL ? undefined : [
  {
    command: "pnpm dev:api",
    url: `${apiURL}/api/health/live`,
    reuseExistingServer,
    timeout: 120_000,
  },
  {
    command: "pnpm dev:web",
    url: baseURL,
    reuseExistingServer,
    timeout: 120_000,
  },
];

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.E2E_WORKERS ? Math.max(1, Number(process.env.E2E_WORKERS)) : undefined,
  reporter: process.env.CI ? [["html", { open: "never" }], ["line"]] : "line",
  use: {
    baseURL,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  ...(webServer ? { webServer } : {}),
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
