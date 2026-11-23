import { expect, test } from "@playwright/test";

test("preview mantém a sessão e consulta o painel de staging após recarregar", async ({ page, baseURL }) => {
  const origemSupabase = new URL(process.env.VITE_SUPABASE_URL!).origin;
  const endpointPainel = origemSupabase + "/rest/v1/rpc/get_painel_gestao";

  for (const navegar of [() => page.goto("/inicio"), () => page.reload()]) {
    const [respostaPainel] = await Promise.all([
      page.waitForResponse((response) => response.url() === endpointPainel && response.request().method() === "POST", {
        timeout: 20_000,
      }),
      navegar(),
    ]);
    expect(respostaPainel.ok(), "O navegador deve carregar os dados do painel de staging.").toBe(true);
    await expect(page).toHaveURL(new URL("/inicio", baseURL).href);
    await expect(page.locator("#main-content")).toBeVisible();
  }
});
