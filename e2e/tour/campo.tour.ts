import { test } from "@playwright/test";
import { Tour } from "./explorar";

// Pilar Campo no celular: a sessão vem pronta do seed-tour.sql (token no sessionStorage).
test("campo · app do canteiro", async ({ browser }) => {
  test.setTimeout(10 * 60_000);
  const ctx = await browser.newContext({
    storageState: { cookies: [], origins: [] },
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: "pt-BR",
    permissions: ["camera", "microphone", "geolocation"],
  });
  await ctx.addInitScript(() => {
    sessionStorage.setItem("pilar_campo_token", "tour-campo-token-0123456789abcdef");
    const v = encodeURIComponent(JSON.stringify({ analytics: false, decidedAt: new Date().toISOString() }));
    document.cookie = `pilar_cookie_consent=${v}; path=/; max-age=31536000; samesite=lax`;
  });
  const page = await ctx.newPage();
  for (const [tela, rota] of [
    ["inicio", "/campo"],
    ["registrar-dia", "/campo/dia"],
    ["gravar", "/campo/gravar"],
  ]) {
    await new Tour(page, "campo", tela, rota, { orcamentoMs: 150_000 }).rodar();
  }
  await ctx.close();
});
