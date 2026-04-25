import { test, expect } from "@playwright/test";

test("landing page carrega sem erros", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("pageerror", (err) => consoleErrors.push(String(err)));
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  await page.goto("/");

  await expect(page).toHaveTitle(/Pilar/);
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();

  // Filtra warnings benignos (React Router v7)
  const critical = consoleErrors.filter((e) => !/React Router Future Flag/i.test(e));
  expect(critical).toEqual([]);
});

test("landing → login navegação", async ({ page }) => {
  await page.goto("/");
  await page.goto("/login");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByPlaceholder("seu@empresa.com")).toBeVisible();
});
