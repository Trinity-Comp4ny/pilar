import type { Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { test } from "../fixtures";
import { SAIDA } from "./explorar";

// Roteiros fixos para os modais que o tour automático não alcança (três níveis de profundidade):
// categoria e centro de custo dentro da despesa, disciplinas e fluxos, e nova obra.
type Reg = { arquivo: string; modulo: string; tela: string; rota: string; efeito: string; cadeia: string[]; titulo: string; url: string };

function roteiro(page: Page, tela: string, rota: string) {
  const regs: Reg[] = [];
  const cadeia: string[] = [];
  let n = 0;
  const dir = path.join(SAIDA, "roteiros", tela);
  fs.mkdirSync(dir, { recursive: true });
  const foto = async (efeito: string, titulo: string) => {
    await page.mouse.move(1435, 6).catch(() => undefined);
    await page.waitForTimeout(400);
    const arq = `${String(++n).padStart(3, "0")}-${efeito}.jpg`;
    await page
      .screenshot({ path: path.join(dir, arq), type: "jpeg", quality: 72, animations: "disabled" })
      .catch(() => undefined);
    regs.push({ arquivo: path.join("roteiros", tela, arq), modulo: "roteiros", tela, rota, efeito, cadeia: [...cadeia], titulo, url: page.url().replace(/^https?:\/\/[^/]+/, "") });
  };
  const passo = async (rotulo: string, acao: () => Promise<unknown>, efeito: string, titulo = rotulo) => {
    try {
      await acao();
      await page.waitForTimeout(700);
      await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => undefined);
      cadeia.push(rotulo);
      await foto(efeito, titulo);
      return true;
    } catch (e) {
      console.log(`[roteiro] ${tela}: falhou em "${rotulo}": ${(e as Error).message.split("\n")[0]}`);
      return false;
    }
  };
  const fim = () => {
    fs.mkdirSync(path.join(SAIDA, "_manifest"), { recursive: true });
    fs.writeFileSync(path.join(SAIDA, "_manifest", `roteiros--${tela}.json`), JSON.stringify(regs, null, 1));
    console.log(`[roteiro] ${tela}: ${regs.length} prints`);
  };
  return { passo, foto, fim, cadeia };
}

const dlg = (page: Page) => page.locator('[role="dialog"]:visible').last();

async function abrir(page: Page, rota: string) {
  await page.goto(rota);
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.waitForTimeout(800);
}

test("roteiro · categoria e centro de custo na despesa", async ({ page }) => {
  test.setTimeout(4 * 60_000);
  const rota = "/gestao/financeiro?tab=lancamentos&fp=tudo";
  const r = roteiro(page, "despesa-categoria", rota);
  await abrir(page, rota);
  await r.passo("Novo lançamento", () => page.getByRole("button", { name: "Novo lançamento" }).first().click(), "dialog", "Novo lançamento");
  await r.passo("Despesa", () => dlg(page).getByRole("button", { name: /Despesa/ }).first().click(), "dialog", "Nova despesa");
  await r.passo("Categoria (aberta)", () => dlg(page).getByRole("combobox", { name: "Categoria" }).click(), "lista", "Categoria: lista de hoje");
  await page.keyboard.press("Escape");
  await r.passo("gerenciar (categoria)", () => dlg(page).getByRole("button", { name: "gerenciar" }).first().click(), "dialog", "Categorias (modal sobre o modal)");
  await r.passo("digitar Marketing", () => dlg(page).getByPlaceholder("Ex: Aluguel, Software, Impostos").fill("Marketing"), "dialog", "Categorias: nova sendo digitada");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  r.cadeia.length = 2;
  const abriuMais = await r.passo("Mais opções", () => dlg(page).getByRole("button", { name: /mais|opç|detalh|avan/i }).last().click(), "dialog", "Despesa: mais campos");
  if (abriuMais) {
    await r.passo("gerenciar (centro de custo)", () => dlg(page).getByRole("button", { name: "gerenciar" }).nth(1).click(), "dialog", "Centros de custo (modal sobre o modal)");
  }
  r.fim();
});

test("roteiro · disciplinas e fluxos do projeto", async ({ page }) => {
  test.setTimeout(4 * 60_000);
  const r = roteiro(page, "disciplinas-fluxos", "/projetos");
  await abrir(page, "/projetos");
  await r.passo("Disciplinas", () => page.getByRole("button", { name: "Disciplinas" }).first().click(), "dialog", "Gerenciar disciplinas");
  await r.passo("Nova disciplina", () => dlg(page).getByRole("button", { name: /Nova disciplina|Adicionar/ }).first().click(), "dialog", "Nova disciplina");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await abrir(page, "/projetos");
  r.cadeia.length = 0;
  await r.passo("Fluxos", () => page.getByRole("button", { name: "Fluxos" }).first().click(), "dialog", "Fluxos de disciplinas");
  await r.passo("Novo fluxo", () => dlg(page).getByRole("button", { name: /Novo fluxo/ }).first().click(), "dialog", "Novo fluxo");
  await r.passo("Adicionar disciplina ao fluxo", () => dlg(page).getByRole("button", { name: /Adicionar|disciplina/i }).first().click(), "dialog", "Fluxo: adicionando disciplina");
  await r.passo("Lista de disciplinas", () => dlg(page).getByRole("combobox").first().click(), "lista", "Fluxo: escolher disciplina");
  r.fim();
});

test("roteiro · nova obra e fluxos de obra", async ({ page }) => {
  test.setTimeout(4 * 60_000);
  const r = roteiro(page, "nova-obra", "/obras");
  await abrir(page, "/obras");
  await r.passo("Nova obra", () => page.getByRole("button", { name: "Nova obra" }).first().click(), "dialog", "Como quer começar a obra?");
  await r.passo("Começar em branco", () => dlg(page).getByRole("button", { name: /em branco/i }).first().click(), "dialog", "Nova obra (formulário)");
  await page.keyboard.press("Escape");
  await abrir(page, "/obras");
  r.cadeia.length = 0;
  await r.passo("Fluxos", () => page.getByRole("button", { name: "Fluxos" }).first().click(), "dialog", "Fluxos de obra");
  await r.passo("Novo fluxo", () => dlg(page).getByRole("button", { name: /Novo fluxo/ }).first().click(), "dialog", "Novo fluxo de obra");
  r.fim();
});

test("roteiro · novo projeto e cliente", async ({ page }) => {
  test.setTimeout(3 * 60_000);
  const r = roteiro(page, "novo-projeto", "/projetos");
  await abrir(page, "/projetos");
  await r.passo("Novo projeto", () => page.getByRole("button", { name: "Novo projeto" }).first().click(), "dialog", "Novo projeto");
  await r.passo("Cliente", () => dlg(page).getByRole("combobox").first().click(), "lista", "Novo projeto: escolher cliente");
  r.fim();
});
