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

/**
 * Onde o anônimo pode legitimamente cair. Fora de app.pilarsoft.com.br o
 * `ExternalRedirect` manda pro `/login` local de propósito, pra não jogar quem
 * testa em staging/preview/localhost no marketing de PRODUÇÃO (App.tsx). O E2E
 * roda em localhost, então exigir só a URL de marketing fazia estes 4 testes
 * falharem em todo push, por construção: o job ficou vermelho por defasagem e
 * parou de valer como sinal.
 */
const REDIRECTED_OUT_RE = /pilarsoft\.com\.br|\/login(\?|$)/;

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

  // A propriedade que interessa: saiu da rota protegida (e não renderizou nada
  // dela), seja pro marketing em produção, seja pro /login fora dela.
  await expect(page).toHaveURL(REDIRECTED_OUT_RE);
  await expect(page).not.toHaveURL(new RegExp(`${path.replace("/", "\\/")}$`));
}
