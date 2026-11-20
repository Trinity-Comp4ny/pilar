import { defineConfig, devices } from "@playwright/test";

const preview = URL.parse(process.env.FIREBASE_PREVIEW_URL ?? "");
const site = process.env.SITE_ID;
if (
  !site ||
  !preview ||
  preview.href !== preview.origin + "/" ||
  preview.protocol !== "https:" ||
  preview.port ||
  !preview.hostname.startsWith(site + "--") ||
  !preview.hostname.endsWith(".web.app")
) {
  throw new Error("Informe a URL HTTPS do canal de preview do app Firebase.");
}
if (process.env.VITE_SUPABASE_URL?.replace(/\/$/, "") !== "https://rizaklgstyfrwgmdsldf.supabase.co") {
  throw new Error("O teste autenticado do preview exige o Supabase de staging.");
}

export default defineConfig({
  testDir: "./e2e",
  forbidOnly: true,
  workers: 1,
  reporter: "list",
  timeout: 60_000,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: preview.origin,
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "firebase-preview",
      testMatch: /firebase-preview-authenticated\.spec\.ts/,
      dependencies: ["setup"],
      use: { storageState: ".auth/admin.json" },
    },
  ],
});
