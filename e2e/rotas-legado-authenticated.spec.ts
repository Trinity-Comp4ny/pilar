import { test, expect } from "./fixtures";

/**
 * Links antigos salvos pelo usuário depois do upgrade do React Router 6 → 7 (13/10).
 *
 * O `sidebar-navigation` já cobre o redirect da raiz de cada módulo. O que faltava é
 * o que o `RedirectPrefix` promete e um major de router pode quebrar sem ninguém ver:
 * preservar o sufixo (/:id) e a query do link antigo, e o voltar do navegador não
 * prender o usuário num redirect em loop (todos usam `replace`).
 */

// UUID fixo e inexistente: só a URL importa aqui, não o registro.
const ID = "00000000-0000-4000-8000-000000000000";

// `query` é o mínimo que precisa sobreviver: a tela de destino pode acrescentar
// parâmetros próprios (o Financeiro grava from/to), então não comparamos a URL inteira.
const REDIRECTS: Array<{ de: string; path: string; query?: Record<string, string> }> = [
  { de: `/clientes/${ID}?aba=projetos`, path: `/gestao/clientes/${ID}`, query: { aba: "projetos" } },
  { de: "/financeiro?tab=carteira", path: "/gestao/financeiro", query: { tab: "carteira" } },
  { de: "/meu-trabalho?view=quadro", path: "/gestao/tarefas", query: { view: "quadro" } },
  { de: "/gestao/meu-trabalho", path: "/gestao/tarefas" },
  { de: "/fornecedores", path: "/obras/fornecedores" },
  { de: "/calendario/2026/10", path: "/projetos/cronograma" },
  { de: "/projetos/calendario", path: "/projetos/cronograma" },
];

test.describe("Links antigos (React Router 7)", () => {
  for (const { de, path, query = {} } of REDIRECTS) {
    test(`${de} → ${path}`, async ({ page }) => {
      const erros: string[] = [];
      page.on("pageerror", (err) => erros.push(String(err)));

      await page.goto(de);
      await page.waitForURL(
        (url) => url.pathname === path && Object.entries(query).every(([k, v]) => url.searchParams.get(k) === v)
      );
      await expect(page.locator("#main-content")).toBeVisible();
      expect(erros).toHaveLength(0);
    });
  }

  test("voltar depois de um redirect não volta pro link antigo", async ({ page }) => {
    await page.goto("/inicio");
    await expect(page.locator("#main-content")).toBeVisible();

    await page.goto("/leads");
    await expect(page).toHaveURL(/\/gestao\/leads$/);

    // O redirect usa `replace`: o histórico tem /inicio → /gestao/leads, sem /leads
    // no meio. Se o replace se perder, o voltar cai em /leads e redireciona de novo.
    await page.goBack();
    await expect(page).toHaveURL(/\/inicio$/);
  });

  test("rota inexistente com sessão mostra a 404", async ({ page }) => {
    await page.goto("/gestao/nao-existe");
    await expect(page.getByRole("heading", { name: "Página não encontrada" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Ir para o Dashboard" })).toBeVisible();
  });
});
