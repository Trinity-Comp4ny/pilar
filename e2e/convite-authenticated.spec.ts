import { test, expect } from "./fixtures";

/**
 * Convite de membro (Administração > Usuários).
 *
 * A Edge Function `invite-user` é interceptada no navegador: convite de verdade manda
 * e-mail (Resend no ar, e o .env local de functions também tem chave real), e e-mail
 * de teste para domínio inexistente estraga a reputação do remetente. Aqui o que se
 * prova é o contrato da tela (o formulário manda e-mail, nome e papel certos) e o que o
 * usuário vê no sucesso e no erro. A regra de envio em si tem teste Deno em
 * supabase/functions/invite-user/delivery.test.ts.
 *
 * Sem efeito colateral nenhum, então roda em qualquer ambiente, staging incluso.
 */

const FUNCAO = "**/functions/v1/invite-user";

async function abrirConvite(page: import("@playwright/test").Page) {
  await page.goto("/admin?tab=usuarios");
  await page
    .getByRole("button", { name: /Convidar usuário/i })
    .first()
    .click();
  const dialog = page.getByRole("dialog", { name: /Convidar usuário/i });
  await expect(dialog).toBeVisible();
  return dialog;
}

test("convidar envia nome, e-mail e papel e confirma o envio", async ({ page }) => {
  const pedidos: Record<string, unknown>[] = [];
  await page.route(FUNCAO, async (route) => {
    pedidos.push(route.request().postDataJSON());
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, conta_existente: false }),
    });
  });

  const dialog = await abrirConvite(page);
  await dialog.getByLabel(/Nome/).first().fill("Fulana");
  await dialog.getByLabel("Sobrenome").fill("de Teste");
  await dialog.getByLabel(/E-?mail/i).fill("fulana.e2e@pilar.test");
  await dialog
    .getByRole("button", { name: /Convidar|Enviar convite/i })
    .last()
    .click();

  await expect(page.getByText("Convite enviado").first()).toBeVisible({ timeout: 10_000 });
  await expect(dialog).not.toBeVisible();
  expect(pedidos).toHaveLength(1);
  expect(pedidos[0]).toMatchObject({ email: "fulana.e2e@pilar.test", nome: "Fulana de Teste" });
  expect(typeof pedidos[0].role).toBe("string");
});

test("e-mail inválido não chega a chamar o servidor", async ({ page }) => {
  let chamadas = 0;
  await page.route(FUNCAO, async (route) => {
    chamadas += 1;
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });

  const dialog = await abrirConvite(page);
  await dialog.getByLabel(/Nome/).first().fill("Fulana");
  await dialog.getByLabel(/E-?mail/i).fill("fulana-sem-arroba");
  await dialog
    .getByRole("button", { name: /Convidar|Enviar convite/i })
    .last()
    .click();

  await expect(dialog.getByText("Email inválido")).toBeVisible();
  expect(chamadas).toBe(0);
});

test("erro do servidor aparece para o usuário e o formulário continua preenchido", async ({ page }) => {
  await page.route(FUNCAO, (route) =>
    route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({ error: "Limite de usuários do plano atingido" }),
    })
  );

  const dialog = await abrirConvite(page);
  await dialog.getByLabel(/Nome/).first().fill("Fulana");
  await dialog.getByLabel(/E-?mail/i).fill("fulana.e2e@pilar.test");
  await dialog
    .getByRole("button", { name: /Convidar|Enviar convite/i })
    .last()
    .click();

  await expect(page.getByText("Erro ao convidar").first()).toBeVisible({ timeout: 10_000 });
  // O motivo do servidor chega ao usuário, não só um "erro" genérico.
  await expect(page.getByText("Limite de usuários do plano atingido").first()).toBeVisible();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel(/E-?mail/i)).toHaveValue("fulana.e2e@pilar.test");
});
