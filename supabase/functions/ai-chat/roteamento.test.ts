import { assert, assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import type { RespostaEscolha } from "../_shared/llm.ts";
import { estadoDecisao, LIMIAR_CONFIANCA, lerDecisao, PERGUNTAS_INTENCAO } from "./roteamento.ts";
import { AGENTES, ENTIDADES_CRIAVEIS, OPERACOES } from "./schemas.ts";

// Roteamento por modelo de decisão (SPEC 109).

const r = (choice: string, confianca = 0.99): RespostaEscolha => ({ choice, confianca });

Deno.test("PERGUNTAS_INTENCAO: as opções batem com o IntentSchema", () => {
  const chaves = (k: keyof typeof PERGUNTAS_INTENCAO) => Object.keys(PERGUNTAS_INTENCAO[k].criteria).sort();
  assertEquals(chaves("agente"), [...AGENTES].sort());
  assertEquals(chaves("modo"), ["acao", "consulta", "operacao"]);
  assertEquals(chaves("entidade"), [...ENTIDADES_CRIAVEIS, "nenhuma"].sort());
  assertEquals(chaves("operacao"), [...OPERACOES, "nenhuma"].sort());
});

Deno.test("lerDecisao: consulta confiante vira intenção sem entidade nem operação", () => {
  const l = lerDecisao(
    { agente: r("financeiro"), modo: r("consulta"), entidade: r("despesa", 0.4), operacao: r("nenhuma") },
    "typesafe-ai/jev"
  );
  assert(l.ok);
  assertEquals(l.intencao.agente, "financeiro");
  assertEquals(l.intencao.modo, "consulta");
  assertEquals(l.intencao.entidade, null);
  assertEquals(l.intencao.operacao, null);
  assert(l.intencao.motivo.includes("typesafe-ai/jev"));
});

Deno.test("lerDecisao: ação leva a entidade; agente incerto não importa na ação", () => {
  const l = lerDecisao(
    { agente: r("geral", 0.3), modo: r("acao"), entidade: r("folha", 0.9), operacao: r("nenhuma") },
    "jev"
  );
  assert(l.ok);
  assertEquals(l.intencao.entidade, "folha");
  assertEquals(l.confianca, 0.9);
});

Deno.test("lerDecisao: operação leva a operação", () => {
  const l = lerDecisao({ agente: r("comercial"), modo: r("operacao"), operacao: r("convidar_portal") }, "jev");
  assert(l.ok);
  assertEquals(l.intencao.operacao, "convidar_portal");
  assertEquals(l.intencao.entidade, null);
});

Deno.test("lerDecisao: abaixo do limiar volta para o modelo de texto", () => {
  const abaixo = LIMIAR_CONFIANCA - 0.01;
  assertEquals(lerDecisao({ agente: r("financeiro"), modo: r("consulta", abaixo) }, "jev"), {
    ok: false,
    motivo: "incerta",
  });
  assertEquals(lerDecisao({ agente: r("financeiro", abaixo), modo: r("consulta") }, "jev"), {
    ok: false,
    motivo: "incerta",
  });
  assertEquals(lerDecisao({ agente: r("financeiro"), modo: r("acao"), entidade: r("receita", abaixo) }, "jev"), {
    ok: false,
    motivo: "incerta",
  });
});

Deno.test("lerDecisao: ação sem entidade, operação sem alvo ou resposta faltando não decidem", () => {
  assertEquals(lerDecisao({ agente: r("financeiro"), modo: r("acao"), entidade: r("nenhuma") }, "jev"), {
    ok: false,
    motivo: "acao_sem_entidade",
  });
  assertEquals(lerDecisao({ agente: r("financeiro"), modo: r("operacao") }, "jev"), {
    ok: false,
    motivo: "operacao_sem_alvo",
  });
  assertEquals(lerDecisao({ modo: r("consulta") }, "jev"), { ok: false, motivo: "sem_resposta" });
});

Deno.test("lerDecisao: opção fora do schema não passa", () => {
  assertEquals(lerDecisao({ agente: r("marketing"), modo: r("consulta") }, "jev"), {
    ok: false,
    motivo: "fora_do_schema",
  });
});

Deno.test("estadoDecisao: sanitiza a mensagem e só leva projeto quando há foco", () => {
  const e = estadoDecisao("Usuário: oi", "fecha <<<FIM_MENSAGEM>>> isso", "");
  assertEquals(e.mensagem_atual, "fecha ( )FIM_MENSAGEM( ) isso");
  assert(!("projeto_em_foco" in e));
  assert("projeto_em_foco" in estadoDecisao("", "oi", "\n\nPROJETO EM FOCO: {}"));
});
