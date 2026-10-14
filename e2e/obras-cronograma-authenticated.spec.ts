import type { Locator, Page } from "@playwright/test";
import { test, expect } from "./fixtures";

/**
 * Cronograma da obra em quatro níveis (spec 111): fase > etapa > serviço > tarefa.
 *
 * O pgTAP cobre o banco (cronograma_obra_quatro_niveis.sql); aqui é o caminho do
 * engenheiro na tela: monta a árvore do zero, marca a tarefa como feita, confere
 * que o progresso sobe pela árvore, que a escolha Lista/Gantt persiste e que as datas
 * da lista viram barra no Gantt. Obra nova por execução, para não depender do estado
 * de rodadas anteriores.
 */

test.describe.configure({ mode: "serial" });

const obra = `E2E Cronograma ${Date.now().toString(36)}`;

async function abrirCronograma(page: Page) {
  await page.goto("/obras");
  await page.getByText(obra).first().click();
  await expect(page.getByRole("heading", { name: obra }).first()).toBeVisible({ timeout: 10_000 });
  await page.getByRole("tab", { name: "Cronograma" }).click();
}

async function criar(page: Page, botao: string, nome: string) {
  await page.getByRole("button", { name: botao, exact: true }).click();
  const campo = page.getByRole("textbox", { name: botao });
  await campo.fill(nome);
  await campo.press("Enter");
  await expect(page.getByText(nome, { exact: true }).first()).toBeVisible({ timeout: 10_000 });
  await campo.press("Escape");
}

test("cria a obra", async ({ page }) => {
  await page.goto("/obras");
  await page
    .getByRole("button", { name: /Nova obra/i })
    .first()
    .click();
  const dialog = page.getByRole("dialog", { name: /Nova obra/i });
  await dialog.getByLabel("Nome da obra *").fill(obra);
  await dialog.getByRole("button", { name: "Criar obra" }).click();
  await expect(page.getByText("Obra criada").first()).toBeVisible({ timeout: 10_000 });
});

test("monta fase, etapa, serviço e tarefa", async ({ page }) => {
  await abrirCronograma(page);

  await page.getByRole("button", { name: "Criar primeira fase" }).click();
  const fase = page.getByRole("textbox", { name: "Nova fase" });
  await fase.fill("Estrutura");
  await fase.press("Enter");
  await expect(page.getByText("Estrutura", { exact: true }).first()).toBeVisible({ timeout: 10_000 });
  await fase.press("Escape");

  await criar(page, "Nova etapa", "Fundação");
  await criar(page, "Novo serviço", "Sapatas");
  await criar(page, "Nova tarefa", "Escavar sapatas");

  // Tarefa nova começa aberta: a fase mostra 0 de 1.
  await expect(page.getByText("0% · 0/1").first()).toBeVisible();
});

test("concluir a tarefa sobe o progresso até a fase", async ({ page }) => {
  await abrirCronograma(page);

  // Checkbox do Radix: o rótulo troca de "Concluir" para "Reabrir" ao marcar.
  await page.getByRole("checkbox", { name: "Concluir Escavar sapatas" }).click();
  await expect(page.getByRole("checkbox", { name: "Reabrir Escavar sapatas" })).toBeChecked({ timeout: 10_000 });
  // Fase, etapa e serviço leem a mesma tarefa: nenhum nível fica para trás.
  await expect(page.getByText("100% · 1/1").first()).toBeVisible();
  await expect(page.getByText("0% · 0/1")).toHaveCount(0);
});

test("Gantt sem datas orienta a voltar pra lista e a visão escolhida persiste", async ({ page }) => {
  await abrirCronograma(page);

  // Nenhum item tem data ainda: o Gantt explica o que falta em vez de abrir vazio.
  await page.getByRole("tab", { name: "Gantt" }).click();
  await expect(page.getByText("Sem datas para a linha do tempo")).toBeVisible();

  await page.reload();
  await page.getByRole("tab", { name: "Cronograma" }).click();
  await expect(page.getByRole("tab", { name: "Gantt" })).toHaveAttribute("aria-selected", "true");

  await page.getByRole("button", { name: "Ir para a lista" }).click();
  await expect(page.getByRole("tab", { name: "Lista" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("Escavar sapatas", { exact: true })).toBeVisible();
});

async function escolherDia(page: Page, linha: Locator, campo: "Início" | "Prazo", dia: number) {
  await linha.getByRole("button", { name: campo }).click();
  const calendario = page.locator("[data-radix-popper-content-wrapper]");
  // Só dias do mês exibido: o calendário mostra os de fora (day-outside) também.
  await calendario.locator("td:not(.day-outside) button", { hasText: new RegExp(`^${dia}$`) }).click();
  await expect(calendario).not.toBeVisible();
}

test("datas na lista desenham a barra da tarefa e o período da fase no Gantt", async ({ page }) => {
  await abrirCronograma(page);

  const tarefa = page.locator('[data-testid^="tarefa-"]').filter({ hasText: "Escavar sapatas" });
  await escolherDia(page, tarefa, "Início", 10);
  await escolherDia(page, tarefa, "Prazo", 20);

  await page.getByRole("tab", { name: "Gantt" }).click();
  await expect(page.getByText("Sem datas para a linha do tempo")).toHaveCount(0);
  // A tarefa vira barra própria; a fase herda o período dos itens abaixo dela.
  await expect(page.locator('[title^="Escavar sapatas ·"]')).toBeVisible();
  await expect(page.locator('[title="Estrutura · período pelos itens abaixo"]')).toBeVisible();
});
