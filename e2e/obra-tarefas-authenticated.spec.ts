import { test, expect } from "./fixtures";
import { abrirNovaObra } from "./helpers/novaObra";

/**
 * Aba Tarefas da obra (SPEC 140): a obra tem a própria lista de tarefas. Começa vazia com o caminho
 * para criar ou montar o cronograma, a tarefa nasce na obra, e a mesma tarefa aparece em
 * Gestão > Tarefas (é a mesma linha de `tarefas`). Obra nova por execução, como nos outros specs.
 */

test.describe.configure({ mode: "serial" });

const sufixo = Date.now().toString(36);
const obra = `E2E Tarefas ${sufixo}`;
const tarefa = `Tarefa da obra ${sufixo}`;

test("cria a obra", async ({ page }) => {
  await page.goto("/obras");
  const dialog = await abrirNovaObra(page);
  await dialog.getByLabel("Nome da obra *").fill(obra);
  await dialog.getByRole("button", { name: "Criar obra" }).click();
  await expect(page.getByText("Obra criada").first()).toBeVisible({ timeout: 10_000 });
});

test("a aba Tarefas começa vazia e cria a tarefa na obra", async ({ page }) => {
  await page.goto("/obras");
  await page.getByText(obra).first().click();
  await expect(page.getByRole("heading", { name: obra }).first()).toBeVisible({ timeout: 10_000 });
  await page.getByRole("tab", { name: "Tarefas" }).click();

  await expect(page.getByText("Esta obra ainda não tem tarefas")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("button", { name: "Montar no cronograma" })).toBeVisible();

  await page.getByRole("button", { name: "Nova tarefa" }).first().click();
  await page.getByPlaceholder("Nome da tarefa").fill(tarefa);
  await page.getByRole("button", { name: "Salvar" }).click();

  await expect(page.getByText(tarefa).first()).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Esta obra ainda não tem tarefas")).toBeHidden();
});

test("a tarefa da obra aparece em Gestão > Tarefas", async ({ page }) => {
  await page.goto("/gestao/tarefas");
  await expect(page.getByText(tarefa).first()).toBeVisible({ timeout: 10_000 });
});
