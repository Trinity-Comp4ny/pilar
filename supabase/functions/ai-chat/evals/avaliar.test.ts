import { assert, assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { errosDeCampos, errosDeIntencao, resumir, type ResultadoCaso } from "./avaliar.ts";
import { CASOS } from "./casos.ts";
import { AGENTES, ENTIDADES_CRIAVEIS, OPERACOES } from "../schemas.ts";

// Pontuação dos evals (sem chamar o modelo) e coerência do dataset com os schemas.

Deno.test("errosDeIntencao: acerto completo não tem erro", () => {
  assertEquals(
    errosDeIntencao(
      { agente: "financeiro", modo: "acao", entidade: "receita" },
      { agente: "financeiro", modo: "acao", entidade: "receita", operacao: null }
    ),
    []
  );
});

Deno.test("errosDeIntencao: aponta modo e entidade trocados", () => {
  const erros = errosDeIntencao(
    { agente: "obras", modo: "acao", entidade: "despesa" },
    { agente: "projetos", modo: "consulta", entidade: null }
  );
  assertEquals(erros.length, 2);
});

Deno.test("errosDeIntencao: agente só conta em consulta", () => {
  assertEquals(
    errosDeIntencao({ agente: "obras", modo: "consulta" }, { agente: "projetos", modo: "consulta" }).length,
    1
  );
  assertEquals(
    errosDeIntencao(
      { agente: "financeiro", modo: "acao", entidade: "fornecedor" },
      { agente: "obras", modo: "acao", entidade: "fornecedor" }
    ),
    []
  );
});

Deno.test("errosDeCampos: número com tolerância de centavo, texto sem acento e caixa", () => {
  assertEquals(
    errosDeCampos({ valor: 1250.5, cliente_nome: "omega" }, { valor: 1250.5, cliente_nome: "Grupo Ômega" }),
    []
  );
  assertEquals(errosDeCampos({ valor: 5000 }, { valor: 500 }).length, 1);
  assertEquals(errosDeCampos({ valor: 5000 }, { valor: "5000" }).length, 1);
  assertEquals(errosDeCampos({ nome: "Carlos" }, {}).length, 1);
});

Deno.test("resumir: aprova só acima dos dois limites", () => {
  const base = { erros: [], latenciaMs: 100, tokens: 10 };
  const r: ResultadoCaso[] = [
    { id: "a", intencaoOk: true, camposOk: true, ...base },
    { id: "b", intencaoOk: true, camposOk: null, ...base },
    { id: "c", intencaoOk: false, camposOk: null, ...base },
  ];
  const s = resumir(r, { intencao: 0.6, campos: 0.9 });
  assertEquals(s.casos, 3);
  assert(Math.abs(s.intencao - 2 / 3) < 1e-9);
  assertEquals(s.campos, 1);
  assertEquals(s.aprovado, true);
  assertEquals(resumir(r, { intencao: 0.9, campos: 0.9 }).aprovado, false);
});

Deno.test("dataset: ids únicos e valores válidos nos schemas do ai-chat", () => {
  const ids = new Set<string>();
  for (const c of CASOS) {
    assert(!ids.has(c.id), `id repetido: ${c.id}`);
    ids.add(c.id);
    assert((AGENTES as readonly string[]).includes(c.esperado.agente), `${c.id}: agente inválido`);
    if (c.esperado.entidade) {
      assert((ENTIDADES_CRIAVEIS as readonly string[]).includes(c.esperado.entidade), `${c.id}: entidade inválida`);
    }
    if (c.esperado.operacao) {
      assert((OPERACOES as readonly string[]).includes(c.esperado.operacao), `${c.id}: operação inválida`);
    }
    if (c.campos) assertEquals(c.esperado.modo, "acao", `${c.id}: campos só em ação`);
  }
  assert(CASOS.length >= 40, "suíte com pelo menos 40 casos");
});
