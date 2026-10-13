import { test, expect } from "@playwright/test";
import { adminLocal, esperar, temFuncoesLocais } from "./helpers/supabaseAdmin";

/**
 * Jornada ponta a ponta: pagamento confirmado → conta criada → perfil preenchido.
 *
 * O checkout (pilar-checkout-create) fala com o Asaas de verdade e fica de fora: a
 * fixture grava o cadastro pendente como ele deixaria. Daí em diante é tudo real: o
 * Asaas avisa o pagamento (POST no webhook com o token), o webhook marca pago, cria o
 * convite do dono e dispara o e-mail de acesso pelo Auth; o dono entra, preenche o
 * perfil e cai no app com a empresa criada. O único atalho é o link de acesso, gerado
 * pela API admin no lugar de ler o e-mail (EMAIL_DRY_RUN no CI).
 */

test.skip(!temFuncoesLocais, "Precisa do stack local com Edge Functions (scripts/e2e-local.sh)");

test("pagamento confirmado vira conta com empresa e o dono entra pelo convite", async ({ page, baseURL }) => {
  const admin = adminLocal();
  const sufixo = Date.now().toString(36);
  const email = `jornada-${sufixo}@e2e.pilar.test`;
  const empresa = `E2E Escritório ${sufixo}`;

  const { data: plano } = await admin.from("pilar_subscription_plans").select("id").eq("slug", "starter").single();
  expect(plano?.id).toBeTruthy();

  const { data: signup, error } = await admin
    .from("pilar_pending_signups")
    .insert({
      email,
      nome: "Ana Jornada",
      company_name: empresa,
      cpf_cnpj: "12345678909",
      billing_type: "PIX",
      billing_cycle: "monthly",
      plan_id: plano!.id,
    })
    .select("id")
    .single();
  expect(error).toBeNull();

  const resp = await page.request.post(`${process.env.E2E_SUPABASE_URL}/functions/v1/pilar-checkout-webhook`, {
    headers: { "asaas-access-token": process.env.E2E_WEBHOOK_TOKEN!, "Content-Type": "application/json" },
    data: {
      event: "PAYMENT_CONFIRMED",
      payment: {
        id: `pay_e2e_${sufixo}`,
        status: "CONFIRMED",
        value: 297,
        billingType: "PIX",
        externalReference: signup!.id,
      },
    },
  });
  expect(resp.status(), await resp.text()).toBe(200);

  const pago = await esperar(
    async () =>
      (
        await admin
          .from("pilar_pending_signups")
          .select("payment_status, invite_dispatched_at")
          .eq("id", signup!.id)
          .single()
      ).data,
    (v) => v?.payment_status === "paid" && Boolean(v?.invite_dispatched_at)
  );
  expect(pago?.payment_status).toBe("paid");
  expect(pago?.invite_dispatched_at).toBeTruthy();

  // O convite já criou o usuário no Auth; o link de acesso substitui o e-mail.
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: `${baseURL}/profile-setup` },
  });
  expect(linkErr).toBeNull();
  const acesso = link?.properties?.action_link;
  expect(acesso).toBeTruthy();

  await page.goto(acesso!);
  await page.waitForURL(/\/profile-setup/, { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Seu perfil" })).toBeVisible({ timeout: 15_000 });

  await page.getByPlaceholder("Ex: Maria").fill("Ana");
  await page.getByPlaceholder("Ex: Souza").fill("Jornada");
  await page.getByPlaceholder("(00) 00000-0000").fill("11988887777");
  const senhas = page.getByPlaceholder("••••••••");
  if ((await senhas.count()) > 0) {
    await senhas.nth(0).fill("Pilar!Jornada2026");
    await senhas.nth(1).fill("Pilar!Jornada2026");
  }
  const termos = page.getByRole("checkbox");
  if (await termos.isVisible().catch(() => false)) await termos.check();
  await page.getByRole("button", { name: /Continuar/ }).click();

  await page.waitForURL(/\/(inicio|company-setup)/, { timeout: 20_000 });

  const { data: perfil } = await admin.from("profiles").select("empresa_id").eq("email", email).single();
  expect(perfil?.empresa_id).toBeTruthy();
  const { data: emp } = await admin.from("empresas").select("nome").eq("id", perfil!.empresa_id!).single();
  expect(emp?.nome).toBe(empresa);
});
