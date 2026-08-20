import { test, expect } from "@playwright/test";

/**
 * Financeiro — testes que rodam sem auth fixture (smoke).
 *
 * Rotas protegidas devem redirecionar para landing quando não há sessão.
 * Isso valida que PrivateRoute + RLS do Supabase não vazam dados sensíveis.
 *
 * Fluxos autenticados (smoke + happy paths) ficam em
 * `financeiro-authenticated.spec.ts`, que roda no projeto "authenticated" e
 * reutiliza o storageState gerado por `auth.setup.ts`.
 *
 * TODO: portar os specs marcados com `test.skip` abaixo (criar receita,
 *       idempotência de pagamento, MFA step-up) para o spec autenticado.
 */

test.describe("Financeiro — guard de rota sem sessão", () => {
  test("/financeiro redireciona para landing", async ({ page }) => {
    await page.goto("/financeiro");
    await expect(page).toHaveURL("/");
  });

  test("/relatorios redireciona para landing", async ({ page }) => {
    await page.goto("/relatorios");
    await expect(page).toHaveURL("/");
  });

  test("/admin redireciona para landing", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL("/");
  });

  test("/ultra-admin redireciona para landing", async ({ page }) => {
    await page.goto("/ultra-admin");
    await expect(page).toHaveURL("/");
  });
});

test.describe("Financeiro — fluxo completo (skip até fixture de auth)", () => {
  test.skip("admin cria receita e visualiza no dashboard", async ({ page: _page }) => {
    // Skeleton — habilitar quando fixture de login estiver pronta.
    // 1. login como admin (storageState)
    // 2. goto /financeiro?tab=visao
    // 3. clicar "Nova Receita"
    // 4. preencher form (descricao, valor, data, projeto/cliente)
    // 5. submeter
    // 6. assert toast de sucesso
    // 7. goto /dashboard
    // 8. assert KPI "A Receber" subiu
  });

  test.skip("dupla submissão de pagamento é bloqueada", async ({ page: _page }) => {
    // Valida fix de idempotência:
    // 1. abrir fatura pendente
    // 2. throttle network
    // 3. clicar "Pagar" 2x rapidamente
    // 4. assert que apenas um lançamento foi criado
  });

  // Trocado de "/admin exige step-up" para o que o ADR 0031 decidiu: aal2
  // obrigatório sobrou só no acesso cross-tenant do ultra-admin. Um placeholder
  // descrevendo a regra antiga ia enganar quem lesse depois.
  test.skip("aal2 é exigido em /ultra-admin, não em /admin", async ({ page: _page }) => {
    // 1. login com sessão AAL1 (sem completar o desafio de MFA)
    // 2. goto /admin → assert que carrega (admin de empresa não exige aal2)
    // 3. goto /ultra-admin → assert redirect para /mfa (ou /mfa/setup sem fator)
    // 4. completar o desafio
    // 5. assert que /ultra-admin agora carrega
  });
});
