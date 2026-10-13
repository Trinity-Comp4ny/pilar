import { test, expect } from "@playwright/test";
import { adminLocal, esperar, temFuncoesLocais } from "./helpers/supabaseAdmin";

/**
 * Jornada ponta a ponta: proposta enviada → cliente aprova no portal → contrato fechado.
 *
 * O escritório já mandou a proposta (fixture: projeto em "Proposta" ligado a uma proposta
 * "enviada" do cliente demo). O cliente entra no portal, abre o projeto, aprova, e o
 * banco fica como o escritório espera: proposta "aceita" e projeto em "Planejamento".
 * Passa pelo portal_login, pela Edge Function portal-aprovar-proposta e pela RPC
 * atômica, que nenhum outro spec exercitava. Só no stack local (scripts/e2e-local.sh).
 */

const EMPRESA = "00000000-0000-0000-0000-000000000001";
const CLIENTE = "00000000-0000-0000-0000-000000000101"; // Construtora Horizonte, dona da conta portal@local.test

test.skip(!temFuncoesLocais, "Precisa do stack local com Edge Functions (scripts/e2e-local.sh)");

test("cliente aprova no portal a proposta enviada e o projeto avança", async ({ page }) => {
  const admin = adminLocal();
  const sufixo = Date.now().toString(36);
  const nomeProjeto = `E2E Jornada ${sufixo}`;

  const { data: projeto, error: pErr } = await admin
    .from("projetos")
    .insert({ empresa_id: EMPRESA, cliente_id: CLIENTE, nome: nomeProjeto, status: "Proposta", valor_contrato: 48000 })
    .select("id")
    .single();
  expect(pErr).toBeNull();
  const { data: proposta, error: prErr } = await admin
    .from("propostas")
    .insert({
      empresa_id: EMPRESA,
      cliente_id: CLIENTE,
      projeto_id: projeto!.id,
      titulo: `Proposta ${nomeProjeto}`,
      status: "enviada",
      valor_proposto: 48000,
    })
    .select("id")
    .single();
  expect(prErr).toBeNull();

  // Sem rate limit de login sobrando de outro spec.
  await admin.from("rate_limit_attempts").delete().like("key", "portal_login%");

  await page.goto("/cliente/login");
  await page.fill('input[type="email"]', process.env.E2E_PORTAL_EMAIL ?? "portal@local.test");
  await page.fill('input[type="password"]', process.env.E2E_PORTAL_PASSWORD ?? "123456");
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/cliente\/dashboard/, { timeout: 15_000 });

  // A sessão do portal vive na página: navegar por clique, não por goto.
  await page.locator(`a[href="/cliente/projeto/${projeto!.id}"]`).click();
  await expect(page.getByText("Proposta aguardando aprovação")).toBeVisible({ timeout: 10_000 });

  await page.getByRole("button", { name: "Aprovar proposta" }).click();
  await page.getByRole("button", { name: "Confirmar aprovação" }).click();
  await expect(page.getByText("Proposta aprovada!").first()).toBeVisible({ timeout: 15_000 });

  const final = await esperar(
    async () => {
      const [{ data: pr }, { data: pj }] = await Promise.all([
        admin.from("propostas").select("status").eq("id", proposta!.id).single(),
        admin.from("projetos").select("status").eq("id", projeto!.id).single(),
      ]);
      return { proposta: pr?.status, projeto: pj?.status };
    },
    (v) => v.proposta === "aceita"
  );
  expect(final).toEqual({ proposta: "aceita", projeto: "Planejamento" });
});
