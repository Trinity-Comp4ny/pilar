import { defineConfig, devices } from "@playwright/test";

const PORT = process.env.PORT ? Number(process.env.PORT) : 4173;
const BASE_URL = process.env.BASE_URL ?? `http://localhost:${PORT}`;

const STORAGE_STATE = ".auth/admin.json";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["html"], ["github"]] : "list",
  timeout: 30_000,
  expect: { timeout: 5_000 },

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "chromium",
      testIgnore: [/auth\.setup\.ts/, /.*-authenticated\.spec\.ts/],
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "authenticated",
      testMatch: /.*-authenticated\.spec\.ts/,
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: STORAGE_STATE,
      },
    },
  ],

  // Variáveis de ambiente documentadas — carregue via .env antes de rodar.
  // set -a && source .env && set +a && npx playwright test
  //
  // E2E_TEST_EMAIL     — usuário de teste (admin/gestor)
  // E2E_TEST_PASSWORD  — senha do usuário de teste
  // E2E_ADMIN_EMAIL    — usuário com perfil admin (opcional, fallback para TEST)
  // E2E_ADMIN_PASSWORD — senha do admin (opcional, fallback para TEST)
  // E2E_PORTAL_EMAIL   — usuário do portal cliente (opcional, specs são skipped sem ele)
  // E2E_PORTAL_PASSWORD — senha do portal cliente

  webServer: {
    command: "npm run preview -- --port " + PORT,
    port: PORT,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
