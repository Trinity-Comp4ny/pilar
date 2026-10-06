import { expect, test } from "@playwright/test";

// Exercise compiled CSS: unit tests in jsdom cannot catch dropped token imports
// or changes to Tailwind's preflight during a compiler upgrade.
for (const width of [390, 1440]) {
  test(`login preserves Pilar colors and usable controls at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/login");
    const submit = page.getByRole("button", { name: "Entrar", exact: true });
    await expect(submit).toBeVisible();
    await expect(submit).toHaveCSS("background-color", "rgb(166, 236, 136)");
    await expect(submit).toHaveCSS("cursor", "pointer");
    await expect(page.locator("body")).toHaveCSS("background-color", "rgb(252, 252, 252)");
    await expect(page.locator("body")).toHaveCSS("font-family", "Inter, sans-serif");

    const email = page.getByPlaceholder("seu@empresa.com");
    await email.focus();
    await expect(email).not.toHaveCSS("box-shadow", "none");
    await page.emulateMedia({ forcedColors: "active" });
    await expect(email).toHaveCSS("outline-style", "solid");
    await page.emulateMedia({ forcedColors: "none" });
    const box = await submit.boundingBox();
    expect(box!.width).toBeGreaterThan(200);
    expect(box!.height).toBeGreaterThanOrEqual(40);
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);

    await page.locator("html").evaluate((el) => el.classList.add("dark"));
    await expect(page.locator("body")).not.toHaveCSS("background-color", "rgb(252, 252, 252)");
    await expect(page.locator("body")).not.toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  });
}
