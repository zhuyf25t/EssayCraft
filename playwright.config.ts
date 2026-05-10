import { defineConfig, devices } from "@playwright/test";

const port = process.env.PLAYWRIGHT_PORT ?? "3210";
const baseURL = `http://127.0.0.1:${port}`;
const distDir = process.env.PLAYWRIGHT_NEXT_DIST_DIR ?? `.next-playwright-${port}`;
const webServerCommand = process.env.PLAYWRIGHT_WEB_SERVER_COMMAND ??
  `npm run build && npm run start -- --port ${port}`;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: {
    timeout: 10_000
  },
  webServer: {
    command: webServerCommand,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      ...process.env,
      NEXT_DIST_DIR: distDir,
      ESSAYCRAFT_FORCE_MOCK_AI: "1"
    }
  },
  use: {
    baseURL,
    trace: "retain-on-failure"
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
