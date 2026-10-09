import { createClient } from "@supabase/supabase-js";
import { test, expect } from "./fixtures";
import { loginComo } from "./helpers/loginComo";

/**
 * Matriz de acesso pelo olhar do usuário comum (ADR 0046, docs/security/MATRIZ_DE_ACESSO.md).
 *
 * A matriz completa por papel está no pgTAP supabase/tests/acesso_dinheiro.sql. Aqui
 * se prova o mesmo de fora: pela tela (a rota do financeiro não abre) e pela API
 * pública que o navegador usa (PostgREST com a chave anon e o JWT do usuário), que é
 * o caminho de quem tentar contornar a tela.
 *
 * Depende dos usuários do seed local (user@local.test); em staging é pulado.
 */

test.skip(process.env.E2E_SEED_DEMO !== "1", "Depende do seed local (user@local.test)");

test("usuário comum não abre o financeiro pela rota", async ({ browser }) => {
  const page = await loginComo(browser, "user@local.test");
  await page.goto("/gestao/financeiro");
  await expect(page).toHaveURL(/\/sem-acesso/);
  await page.context().close();
});

test("usuário comum não lê dinheiro pela API", async () => {
  const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: loginError } = await supabase.auth.signInWithPassword({
    email: "user@local.test",
    password: "123456",
  });
  expect(loginError).toBeNull();

  const receitas = await supabase.from("receitas").select("id, valor");
  expect(receitas.error).toBeNull();
  expect(receitas.data).toEqual([]);

  const valorAditivo = await supabase.from("escopos").select("valor_aditivo");
  expect(valorAditivo.error?.code).toBe("42501");

  const valorLead = await supabase.from("leads").select("valor_estimado");
  expect(valorLead.error?.code).toBe("42501");

  const leadsSafe = await supabase.from("leads_safe").select("valor_estimado").not("valor_estimado", "is", null);
  expect(leadsSafe.data).toEqual([]);

  const grafico = await supabase.rpc("get_financial_chart_data", {
    p_empresa_id: "00000000-0000-0000-0000-000000000001",
    p_data_inicio: "2026-01-01",
    p_data_fim: "2026-12-31",
  });
  expect(grafico.error?.code).toBe("42501");

  const salario = await supabase.from("pessoas_safe").select("salario_fixo").not("salario_fixo", "is", null);
  expect(salario.data).toEqual([]);
});
