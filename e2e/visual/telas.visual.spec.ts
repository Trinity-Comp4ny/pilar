import path from "node:path";
import { test, expect, type Page } from "@playwright/test";

/**
 * Regressão visual das telas mais usadas (plano de engenharia 2026-10, onda 2).
 *
 * Pega o que typecheck e teste de fluxo não pegam: CSS que desloca layout, card que
 * estoura, componente que some. Roda no job "E2E (Supabase local)" do CI, ANTES dos
 * specs de escrita, contra o banco recém-semeado (scripts/seed-demo.sql).
 *
 * O que muda sozinho de um dia pro outro (datas, "há N dias", valores do mês, linhas
 * de tabela) é mascarado. A máscara pinta a área mas mantém a posição, então
 * deslocamento de layout continua aparecendo.
 *
 * Mudou a tela de propósito? Atualize a referência no CI (ver e2e/visual/README.md).
 */

const MESES = "janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro";
const TEXTO_VARIAVEL = new RegExp(
  [
    String.raw`\d{2}/\d{2}(/\d{2,4})?`, // datas
    // "12 out" (prazo na lista de tarefas): o seed gera prazos relativos a hoje, então o
    // dia muda a cada 24 h e a foto do dia anterior reprova.
    String.raw`\b\d{1,2}\s(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\b`,
    String.raw`\bhá\s+(menos de\s+)?(um|\d+)`, // "venceu há 68 d", "Atualizado há menos de um minuto"
    String.raw`\b\d+\s?d\b`, // "em 12 d", "92d"
    String.raw`R\$\s?-?[\d.]+,\d{2}`, // dinheiro (soma do mês muda com o calendário)
    String.raw`\b(${MESES})\s+de\s+\d{4}`, // "outubro de 2026"
    String.raw`^\d+ de \d+$`, // contador de linhas "14 de 14"
  ].join("|"),
  "i"
);

function mascaras(page: Page) {
  return [
    page.getByText(TEXTO_VARIAVEL),
    // Botão de data inteiro (DatePicker do prazo): mascarar só o texto deixava sobrar a
    // borda, porque a largura do texto muda com os dígitos do dia ("11/10" é mais
    // estreito que "28/10") e o seed gera datas relativas a hoje. O botão tem largura fixa.
    page.getByRole("button", { name: /\d{2}\/\d{2}\/\d{2,4}/ }),
    // Tabela inteira, não só o corpo: a largura das colunas acompanha o conteúdo, que
    // muda com a data do seed, e o cabeçalho descia 1px de um dia para o outro. A
    // borda do card em volta continua na foto, então tabela que desloca ainda aparece.
    page.locator("table"),
    // Gráfico inteiro (Curva S): a linha e o marcador "Hoje" andam com a data do
    // calendário contra o seed, então a foto de um dia reprova no seguinte. O card em
    // volta continua na foto.
    page.locator(".recharts-responsive-container"),
    // Card de KPI inteiro: o valor estoura a caixa e passa por baixo do ícone (bug
    // conhecido do KPICard), então mascarar só o texto deixaria pedaço variável.
    page.getByRole("button", { name: /^(Recebido|Pago|A receber|A pagar)\b/i }),
  ];
}

async function abrir(page: Page, rota: string) {
  await page.goto(rota);
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
}

const opcoes = (page: Page) => ({
  mask: mascaras(page),
  animations: "disabled" as const,
  // Toasts fora da foto (aparecem e somem com tempo próprio).
  stylePath: path.resolve("e2e/visual/estabilizar.css"),
  caret: "hide" as const,
  // Limite absoluto, não proporcional: alargar a sidebar em 24px muda só ~1.200
  // pixels (cores parecidas), e 1% da tela (9.216) deixava passar. A referência é
  // gerada no mesmo runner, então o ruído entre execuções é ~0.
  maxDiffPixels: 100,
});

test.describe("Telas do app (desktop 1280×720)", () => {
  const telas = [
    ["inicio", "/inicio"],
    ["projetos-quadro", "/projetos"],
    ["projeto-detalhe", "/projetos/00000000-0000-0000-0000-000000000401"],
    // Período "tudo": com o padrão "Este mês", o número de linhas mudaria com o dia.
    ["lancamentos", "/financeiro?tab=lancamentos&fp=tudo"],
    // Ampliação de 13/10: os módulos que tinham só teste de fluxo, sem foto da tela.
    ["obras", "/obras"],
    ["obra-detalhe", "/obras/00000000-0000-0000-0000-000000000a01"],
    ["tarefas", "/gestao/tarefas"],
    ["leads", "/gestao/leads"],
    ["cliente-detalhe", "/gestao/clientes/00000000-0000-0000-0000-000000000101"],
    ["propostas", "/gestao/propostas"],
  ] as const;

  for (const [nome, rota] of telas) {
    test(nome, async ({ page }) => {
      await abrir(page, rota);
      await expect(page.locator("#main-content")).toBeVisible();
      await expect(page).toHaveScreenshot(`${nome}.png`, opcoes(page));
    });
  }
});

test.describe("Celular (390×844)", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("inicio-celular", async ({ page }) => {
    await abrir(page, "/inicio");
    await expect(page.locator("#main-content")).toBeVisible();
    await expect(page).toHaveScreenshot("inicio-celular.png", opcoes(page));
  });
});

test.describe("Login (sem sessão)", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("login", async ({ page }) => {
    await abrir(page, "/login");
    await expect(page.locator('input[type="email"]')).toBeVisible();
    // O widget do captcha (iframe de terceiro) muda sozinho: fora da comparação.
    await expect(page).toHaveScreenshot("login.png", {
      ...opcoes(page),
      mask: [...mascaras(page), page.locator("iframe")],
    });
  });
});

test.describe("Portal do cliente", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("portal-dashboard", async ({ page }) => {
    test.skip(!process.env.E2E_PORTAL_EMAIL, "Sem usuário de portal (E2E_PORTAL_EMAIL)");
    await page.goto("/cliente/login");
    await page.fill('input[type="email"]', process.env.E2E_PORTAL_EMAIL!);
    await page.fill('input[type="password"]', process.env.E2E_PORTAL_PASSWORD!);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/cliente\/dashboard/, { timeout: 15_000 });
    // Sem novo goto: a sessão do portal vive na página, recarregar volta pro login.
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => document.fonts.ready);
    await expect(page.getByRole("heading", { level: 1, name: /Olá/i })).toBeVisible();
    await expect(page).toHaveScreenshot("portal-dashboard.png", opcoes(page));
  });
});
