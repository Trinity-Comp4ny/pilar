import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

// Config só do tour de telas (e2e/tour). Os nomes de projeto repetem os do config principal
// ("chromium" e "authenticated") porque o scripts/e2e-local.sh roda esses dois.
const PORT = process.env.PORT ? Number(process.env.PORT) : 4174;
const RAIZ = process.cwd();
const viewport = { width: 1440, height: 900 };

export default defineConfig({
  testDir: "..",
  fullyParallel: true,
  workers: 2,
  retries: 0,
  reporter: [["list"]],
  timeout: 10 * 60_000,
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    acceptDownloads: false,
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts$/, use: { ...devices["Desktop Chrome"] } },
    {
      name: "chromium",
      testMatch: /tour[\\/]publico\.tour\.ts$/,
      use: { ...devices["Desktop Chrome"], viewport },
    },
    {
      name: "authenticated",
      testMatch: /tour[\\/](app|ultra|portal|campo|roteiros|medidas)\.tour\.ts$/,
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        viewport,
        storageState: path.join(RAIZ, ".auth", "admin.json"),
        launchOptions: { args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] },
      },
    },
  ],
  webServer: {
    command: `npm run preview -- --port ${PORT}`,
    cwd: RAIZ,
    port: PORT,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
