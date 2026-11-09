import { assert, assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { ENTIDADE_CFG } from "./entidades.ts";
import { EXTRAIR_DESPESA_PROMPT, EXTRAIR_RECEITA_PROMPT, promptCadastro, REGRA_PARCELAS } from "./prompts.ts";

// Contrato entre o prompt de extração e o parser: o JSON pedido ao modelo usa a mesma chave
// que o schema lê (entityKey), e todo prompt manda não inventar dado. Se o prompt pedir
// "cliente" e o schema ler "clientes", o rascunho sai vazio sem erro nenhum.

Deno.test("promptCadastro: monta o pedido com campos, obrigatórios e a chave do JSON", () => {
  const p = promptCadastro("CADASTRAR UM TESTE", "teste", "nome, email", "nome");
  assert(p.includes("O usuário quer CADASTRAR UM TESTE."));
  assert(p.includes("Campos: nome, email."));
  assert(p.includes("Obrigatório(s): nome."));
  assert(p.includes('"teste": {'));
  assert(p.includes("não invente"));
});

Deno.test("todo prompt de extração pede o objeto na mesma chave que o schema lê", () => {
  for (const [entidade, cfg] of Object.entries(ENTIDADE_CFG)) {
    assert(cfg.prompt.includes(`"${cfg.entityKey}"`), `${entidade}: prompt não pede "${cfg.entityKey}"`);
    assert(cfg.prompt.includes('"tem_nome"'), `${entidade}: prompt não pede tem_nome`);
    assert(/APENAS em JSON/.test(cfg.prompt), `${entidade}: prompt não exige JSON`);
    // A folha só resolve mês/ano pela data de hoje: não há dado de negócio a inventar.
    if (entidade !== "folha") assert(/n[ãa]o invente/i.test(cfg.prompt), `${entidade}: prompt não proíbe inventar`);
  }
});

Deno.test("todo campo obrigatório aparece no prompt da entidade", () => {
  for (const [entidade, cfg] of Object.entries(ENTIDADE_CFG)) {
    for (const campo of cfg.requiredKeys) {
      assert(cfg.prompt.includes(campo), `${entidade}: prompt não menciona o obrigatório "${campo}"`);
    }
  }
});

Deno.test("receita e despesa: valor é o TOTAL e a regra de parcelas vai junto", () => {
  for (const p of [EXTRAIR_RECEITA_PROMPT, EXTRAIR_DESPESA_PROMPT]) {
    assert(p.includes(REGRA_PARCELAS));
    assert(p.includes("TOTAL"));
  }
  assert(EXTRAIR_DESPESA_PROMPT.includes("cartao_nome"));
  assert(!EXTRAIR_RECEITA_PROMPT.includes("cartao_nome"));
  assertEquals(REGRA_PARCELAS.includes("VALOR TOTAL"), true);
});
