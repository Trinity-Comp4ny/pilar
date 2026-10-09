import { defineConfig, devices } from "@playwright/test";

/**
 * Config dos checks sintéticos de PRODUÇÃO (workflow monitor-producao.yml). Separada
 * do playwright.config.ts da raiz de propósito: aqui não há webServer nem build, o
 * alvo é o site no ar. Uma nova tentativa por check: a primeira chamada a uma Edge
 * Function fria pode responder 503 (visto em 08/10) sem haver incidente.
 */
export default defineConfig({
  testDir: ".",
  testMatch: /.*\.spec\.ts/,
  retries: 1,
  workers: 1,
  timeout: 30_000,
  reporter: process.env.CI ? [["list"], ["github"]] : "list",
  use: { ...devices["Desktop Chrome"], trace: "retain-on-failure", screenshot: "only-on-failure" },
});
