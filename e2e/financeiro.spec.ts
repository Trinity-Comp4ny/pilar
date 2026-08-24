import { test } from "@playwright/test";
import { expectAnonRedirectedOut } from "./helpers/guards";

/**
 * Financeiro — testes que rodam sem auth fixture (smoke).
 *
 * Rota protegida sem sessão manda o anônimo para fora do app (ADR 0021/0025:
 * a raiz é um redirect para o site de marketing). Isso valida que o
 * PrivateRoute não deixa a tela renderizar sem sessão.
 *
 * Fluxos autenticados (smoke + happy paths) ficam em
 * `financeiro-authenticated.spec.ts`, que roda no projeto "authenticated" e
 * reutiliza o storageState gerado por `auth.setup.ts`.
 *
 * TODO: portar os specs marcados com `test.skip` abaixo (criar receita,
 *       idempotência de pagamento, MFA step-up) para o spec autenticado.
 */

test.describe("Financeiro — guard de rota sem sessão", () => {
  test("/financeiro sem sessão sai do app", async ({ page }) => {
    await expectAnonRedirectedOut(page, "/financeiro");
  });

  test("/relatorios sem sessão sai do app", async ({ page }) => {
    await expectAnonRedirectedOut(page, "/relatorios");
  });

  test("/admin sem sessão sai do app", async ({ page }) => {
    await expectAnonRedirectedOut(page, "/admin");
  });

  test("/ultra-admin sem sessão sai do app", async ({ page }) => {
    await expectAnonRedirectedOut(page, "/ultra-admin");
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
