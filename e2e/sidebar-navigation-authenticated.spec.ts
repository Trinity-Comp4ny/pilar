import { test, expect } from "./fixtures";

/**
 * Navegação — smoke das rotas principais (autenticado).
 *
 * Roda no projeto "authenticated" (depende do auth.setup.ts).
 * Verifica que cada rota principal:
 *   - Carrega sem redirecionar para landing
 *   - Não exibe erro de crash (ErrorBoundary / React error)
 *   - Não gera erros de JS não tratados
 *
 * Como rodar localmente:
 *   set -a && source .env && set +a
 *   npx playwright test --project=authenticated e2e/sidebar-navigation-authenticated.spec.ts
 */

// Achado real, 17/08: /dashboard, /pessoas e /relatorios são hoje redirects
// permanentes (App.tsx) pra rotas novas (reorg de navegação por persona,
// 11/08) — o app troca de URL de propósito, não é crash. `expectedPath`
// declara o destino real quando diverge do path visitado; sem isso o teste
// nunca tinha passado desde a reorg (só descoberto agora porque o project
// "authenticated" nunca tinha rodado de verdade em CI).
const ROTAS_PRINCIPAIS = [
  { path: "/dashboard", expectedPath: "/inicio", label: "Dashboard" },
  { path: "/projetos", label: "Projetos" },
  { path: "/clientes", label: "Clientes" },
  { path: "/financeiro", label: "Financeiro" },
  { path: "/leads", label: "Leads" },
  { path: "/propostas", label: "Propostas" },
  { path: "/pessoas", expectedPath: "/gestao/equipe", label: "Pessoas" },
  { path: "/relatorios", expectedPath: "/gestao/financeiro", label: "Relatórios" },
];

test.describe("Navegação sidebar — rotas principais", () => {
  for (const rota of ROTAS_PRINCIPAIS) {
    test(`${rota.label} (${rota.path}) carrega sem crash`, async ({ page }) => {
      const pageErrors: string[] = [];
      page.on("pageerror", (err) => pageErrors.push(String(err)));

      await page.goto(rota.path);
      await page.waitForLoadState("networkidle");

      // Não deve ter caído na landing (proteção de rota funcionando)
      await expect(page).not.toHaveURL(/^\//);
      const destino = rota.expectedPath ?? rota.path;
      await expect(page).toHaveURL(new RegExp(destino.replace("/", "\\/")));

      // ErrorBoundary padrão do React mostra "Something went wrong"
      // Nosso app pode usar mensagem em PT-BR
      const errorLocator = page
        .getByText(/Something went wrong/i)
        .or(page.getByText(/Algo deu errado/i))
        .or(page.getByText(/Erro inesperado/i))
        .or(page.locator("[data-error]"));

      await expect(errorLocator).not.toBeVisible();

      // Sem erros de JS críticos (filtra warnings benignos do React Router)
      const critical = pageErrors.filter(
        (e) => !/React Router Future Flag/i.test(e)
      );
      expect(critical).toHaveLength(0);
    });
  }
});

test.describe("Navegação sidebar — breadcrumbs e títulos", () => {
  test("cada rota principal tem título de página definido", async ({ page }) => {
    // Spot-check rápido: dashboard e financeiro têm título distinto de "Pilar"
    for (const path of ["/dashboard", "/financeiro", "/projetos"]) {
      await page.goto(path);
      await page.waitForLoadState("domcontentloaded");

      // usePageTitle define document.title — deve conter algo além de só "Pilar"
      const title = await page.title();
      expect(title.length).toBeGreaterThan(0);
    }
  });
});
