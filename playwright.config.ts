import { defineConfig, devices } from "@playwright/test";

const expoWeb = process.env.EXPO_WEB_URL ?? "http://localhost:8081";
const shopWeb = process.env.SHOP_WEB_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chrome",
      use: {
        ...devices["Desktop Chrome"],
        channel: "chrome",
        baseURL: expoWeb,
      },
    },
  ],
  metadata: { shopWeb },
});
