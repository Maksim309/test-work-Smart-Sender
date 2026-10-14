import { defineConfig } from "@playwright/test";

const port = process.env.PREVIEW_PORT ?? "4187";
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "preview.spec.ts",
  use: { baseURL, trace: "retain-on-failure" },
  webServer: {
    command: `npm run preview -- --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: Boolean(process.env.PREVIEW_PORT),
  },
});
