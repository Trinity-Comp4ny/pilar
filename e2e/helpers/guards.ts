import { expect, type Page } from "@playwright/test";

/**
 * Desde o ADR 0021/0025 o app não tem landing própria: a rota `/` é um
 * `ExternalRedirect` para o site de marketing (`pilarsoft.com.br`). Os testes
 * de guard nasceram antes disso e asseveravam `toHaveURL("/")`, então passaram
 * a falhar por defasagem, não por regressão de segurança. Ninguém viu porque o
 * job de E2E dependia de um deploy que vinha falhando.
 *
 * A propriedade que interessa continua a mesma: anônimo em rota protegida sai
 * da rota. A requisição para o domínio de marketing é interceptada de
 * propósito: depender do site real deixaria o CI refém da disponibilidade dele
 * (e de 300+ violações de acessibilidade que são problema de outro lugar).
 */
const MARKETING_URL_RE = /pilarsoft\.com\.br/;

async function stubMarketingSite(page: Page): Promise<void> {
  await page.route(MARKETING_URL_RE, (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<html><body data-testid='marketing-stub'>marketing (stub de teste)</body></html>",
    })
  );
}

/** Rota protegida sem sessão: o app manda o anônimo para fora, não renderiza a tela. */
export async function expectAnonRedirectedOut(page: Page, path: string): Promise<void> {
  await stubMarketingSite(page);
  await page.goto(path);

  await expect(page).toHaveURL(MARKETING_URL_RE);
  await expect(page).not.toHaveURL(new RegExp(`${path.replace("/", "\\/")}$`));
}
