import type { Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { test } from "../fixtures";
import { SAIDA } from "./explorar";

// Como o app aparece hoje no celular (390×844), para a proposta mobile. Só prints.
const ID = "00000000-0000-0000-0000-000000000";
type Acao = { nome: string; fazer: (p: Page) => Promise<unknown> };
const TELAS: [string, string, Acao[]][] = [
  ["inicio", "/inicio", [{ nome: "menu", fazer: (p) => p.getByRole("button", { name: /menu|navega/i }).first().click() }]],
  ["leads", "/gestao/leads", [{ nome: "lead", fazer: (p) => p.getByText("Patrícia").first().click() }]],
  ["propostas", "/gestao/propostas", []],
  ["clientes", "/gestao/clientes", []],
  ["tarefas", "/gestao/tarefas", []],
  ["agenda", "/gestao/agenda", []],
  ["projetos", "/projetos", [{ nome: "filtros", fazer: (p) => p.getByRole("button", { name: /Filtros/ }).first().click() }]],
  ["projeto", `/projetos/${ID}401`, []],
  ["cronograma", "/projetos/cronograma", []],
  ["obras", "/obras", []],
  ["obra", `/obras/${ID}a01`, []],
  ["financeiro", "/gestao/financeiro", []],
  ["lancamentos", "/gestao/financeiro?tab=lancamentos&fp=tudo", [{ nome: "novo", fazer: (p) => p.getByRole("button", { name: /Novo lançamento/ }).first().click() }]],
  ["equipe", "/gestao/equipe", []],
  ["estimativas", "/obras/estimativas", []],
  ["fornecedores", "/gestao/fornecedores", []],
];

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });

for (const [tela, rota, acoes] of TELAS) {
  test(`celular · ${tela}`, async ({ page }) => {
    test.setTimeout(90_000);
    const dir = path.join(SAIDA, "celular");
    fs.mkdirSync(dir, { recursive: true });
    await page.goto(rota);
    await page.waitForLoadState("networkidle").catch(() => undefined);
    await page.waitForFunction(() => !document.querySelector('.animate-pulse, [aria-busy="true"]'), null, { timeout: 10_000 }).catch(() => undefined);
    await page.waitForTimeout(900);
    await page.screenshot({ path: path.join(dir, `${tela}-1-tela.jpg`), type: "jpeg", quality: 75 });
    const alt = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.screenshot({ path: path.join(dir, `${tela}-2-inteira.jpg`), type: "jpeg", quality: 70, fullPage: true, clip: { x: 0, y: 0, width: 390, height: Math.min(alt, 2600) } }).catch(() => undefined);
    const larg = await page.evaluate(() => document.documentElement.scrollWidth);
    fs.writeFileSync(path.join(dir, `${tela}.json`), JSON.stringify({ rota, alturaPagina: alt, larguraPagina: larg }));
    for (const a of acoes) {
      try {
        await a.fazer(page);
        await page.waitForTimeout(900);
        await page.screenshot({ path: path.join(dir, `${tela}-3-${a.nome}.jpg`), type: "jpeg", quality: 75 });
      } catch {
        /* ação não achada no celular: fica sem o print */
      }
    }
  });
}
