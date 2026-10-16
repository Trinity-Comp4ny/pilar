import { assert, assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { lerEntrada } from "./entrada.ts";
import {
  aterrar,
  briefingPorRegra,
  candidatosClientes,
  candidatosReceita,
  custoUsd,
  estourouTeto,
  FORA_DA_AREA,
  limparTexto,
  mudancasDesde,
  resumoEfeito,
  semanaIso,
  semContatoDuplo,
  novosCandidatos,
  quandoVence,
  type Receita,
  resumoDoDia,
  type SaudeEmpresa,
} from "./regras.ts";

// 15/10/2026 10h em Brasília (13h UTC).
const AGORA = new Date("2026-10-15T13:00:00Z");

function receita(parcial: Partial<Receita> = {}): Receita {
  return {
    mrr: 980,
    pagantes: 2,
    cadastros: 3,
    cadastros_anterior: 1,
    ativados: 2,
    novos_pagantes: 1,
    em_teste: 2,
    checkout_pendente: 0,
    testes_vencendo: [],
    em_atraso: [],
    ...parcial,
  };
}

function saude(parcial: Partial<SaudeEmpresa>): SaudeEmpresa {
  return {
    empresa_id: "e1",
    empresa_nome: "Escritório Um",
    situacao_cobranca: "pagante",
    nota: 80,
    faixa: "saudavel",
    ultimo_acesso: "2026-10-15T10:00:00Z",
    dias_sem_acesso: 0,
    feedback_aberto: 0,
    contato_nome: "Ana Souza",
    contato_telefone: "(14) 99999-0000",
    ...parcial,
  };
}

Deno.test("entrada: só aceita os agentes executáveis", () => {
  assertEquals(lerEntrada({ agente_id: "receita" }).ok, true);
  assertEquals(lerEntrada({ agente_id: "marketing" }).ok, false);
  assertEquals(lerEntrada(null).ok, false);
});

Deno.test("quandoVence usa o dia de Brasília", () => {
  // 16/10 01h UTC ainda é 15/10 em Brasília.
  assertEquals(quandoVence("2026-10-16T01:00:00Z", AGORA), "hoje");
  assertEquals(quandoVence("2026-10-16T15:00:00Z", AGORA), "amanhã");
});

Deno.test("receita: teste vencendo e atraso viram candidatos com chave e evidência", () => {
  const c = candidatosReceita(
    receita({
      testes_vencendo: [
        {
          empresa_id: "t1",
          empresa_nome: "Vieira Estrutural",
          vence_em: "2026-10-16T15:00:00Z",
          projetos: 0,
          contato_nome: "Carla Vieira",
          contato_telefone: "14998112233",
        },
      ],
      em_atraso: [
        {
          empresa_id: "a1",
          empresa_nome: "Lopes MEP",
          desde: "2026-10-01T00:00:00Z",
          contato_nome: null,
          contato_telefone: null,
        },
      ],
    }),
    "Matheus",
    AGORA
  );
  assertEquals(
    c.map((x) => x.ref),
    ["c1", "c2"]
  );
  assertEquals(c[0].chave, "teste:t1:2026-10-16");
  assertEquals(c[0].fatos.projetos_reais, 0);
  assert(c[0].textoPadrao.startsWith("Oi Carla, aqui é Matheus, da Pilar."));
  assert(c[0].textoPadrao.includes("ainda não deu tempo de cadastrar um projeto"));
  assertEquals(c[1].chave, "atraso:a1:2026-10-01");
  assert(c[1].textoPadrao.startsWith("Oi, aqui é Matheus"));
});

Deno.test("clientes: só quem importa, sumido há 7+ dias e feedback parado", () => {
  const c = candidatosClientes(
    [
      saude({ empresa_id: "s1", empresa_nome: "Sumida", dias_sem_acesso: 9, ultimo_acesso: "2026-10-06T10:00:00Z" }),
      saude({ empresa_id: "v1", situacao_cobranca: "teste_vencido", dias_sem_acesso: 40 }),
      saude({ empresa_id: "f1", empresa_nome: "Com feedback", feedback_aberto: 2 }),
    ],
    "Matheus"
  );
  assertEquals(
    c.map((x) => x.chave),
    ["sem_acesso:s1:2026-10-06", "feedback:f1:2"]
  );
  assertEquals(c[1].tipo, "alerta");
});

Deno.test("novosCandidatos não repete o que já está pendente", () => {
  const c = candidatosClientes([saude({ empresa_id: "s1", dias_sem_acesso: 9 })], "Matheus");
  assertEquals(novosCandidatos(c, new Set([c[0].chave])), []);
  assertEquals(novosCandidatos(c, new Set()).length, 1);
});

Deno.test("aterrar: descarta referência inventada e texto proibido, completa com o padrão", () => {
  const candidatos = candidatosReceita(
    receita({
      testes_vencendo: [
        {
          empresa_id: "t1",
          empresa_nome: "Um",
          vence_em: "2026-10-16T15:00:00Z",
          projetos: 2,
          contato_nome: "Bia",
          contato_telefone: "14988887777",
        },
        {
          empresa_id: "t2",
          empresa_nome: "Dois",
          vence_em: "2026-10-16T15:00:00Z",
          projetos: 1,
          contato_nome: "Rui",
          contato_telefone: "14988886666",
        },
      ],
    }),
    "Matheus",
    AGORA
  );
  const r = aterrar(
    {
      resumo: "Dois testes vencem amanhã — um com 2 projetos.",
      destaques: [
        { texto: "Um vence amanhã", refs: ["c1"] },
        { texto: "Inventado", refs: ["c9"] },
        { texto: "MRR estável", refs: ["mrr"] },
      ],
      mensagens: [
        { ref: "c1", texto: "Oi Bia, aqui é Matheus, da Pilar. Posso ajudar a seguir com os 2 projetos?" },
        { ref: "c2", texto: "Oi Rui, te dou 20% de desconto se assinar hoje." },
        { ref: "c7", texto: "Oi, quem é você?" },
      ],
    },
    candidatos,
    ["mrr", "cadastros"]
  );
  assertEquals(r.briefing.resumo, "Dois testes vencem amanhã, um com 2 projetos.");
  assertEquals(
    r.briefing.destaques.map((d) => d.refs[0]),
    ["c1", "mrr"]
  );
  assertEquals(r.textos.get("c1"), "Oi Bia, aqui é Matheus, da Pilar. Posso ajudar a seguir com os 2 projetos?");
  assertEquals(r.textos.get("c2"), candidatos[1].textoPadrao);
  assertEquals(r.descartes.map((d) => d.ref).sort(), ["briefing", "c2", "c7"]);
});

Deno.test("briefing por regra quando o modelo falha", () => {
  const b = briefingPorRegra("clientes", [], "3 escritórios: 0 em risco, 1 em atenção.");
  assertEquals(b.fonte, "regra");
  assertEquals(b.resumo, "3 escritórios: 0 em risco, 1 em atenção. Nenhum escritório sumido e nenhum feedback parado.");
});

Deno.test("teto de custo em reais a partir do gasto em USD", () => {
  assertEquals(estourouTeto(5, 30), false);
  assertEquals(estourouTeto(6, 30), true);
  assertEquals(estourouTeto(100, null), false);
  assertEquals(custoUsd(1_000_000, 100_000, { preco_input_por_milhao: 0.3, preco_output_por_milhao: 2.5 }), 0.55);
  assertEquals(custoUsd(10, 10, null), null);
});

Deno.test("resumo do dia: três prioridades, hoje antes de esta semana", () => {
  const r = resumoDoDia(
    [
      { agente_id: "clientes", titulo: "Sumida: sem acesso há 9 dias", prioridade: 2, prazo: null },
      { agente_id: "receita", titulo: "Um: teste termina amanhã", prioridade: 1, prazo: "2026-10-16T15:00:00Z" },
      { agente_id: "receita", titulo: "Lopes: pagamento em atraso", prioridade: 1, prazo: null },
      { agente_id: "clientes", titulo: "Outra", prioridade: 2, prazo: null },
    ],
    ["MRR R$ 980,00, 2 pagantes."]
  );
  assertEquals(r.titulo, "Bom dia: 4 decisões esperam você");
  assertEquals(
    r.prioridades.map((p) => p.titulo),
    ["Um: teste termina amanhã", "Lopes: pagamento em atraso", "Sumida: sem acesso há 9 dias"]
  );
  assert(r.mensagem.startsWith("Para hoje:\n1. Um: teste termina amanhã"));
  assertEquals(resumoDoDia([], []).titulo, "Bom dia: nenhuma decisão esperando você");
});

Deno.test("limparTexto tira travessão", () => {
  assertEquals(limparTexto("Oi — tudo bem?  Sim – claro."), "Oi, tudo bem? Sim, claro.");
});

Deno.test("aterrar: mensagem de Clientes que fala de pagamento volta para o texto padrão", () => {
  const candidatos = candidatosClientes(
    [saude({ empresa_id: "s1", empresa_nome: "Lopes MEP", dias_sem_acesso: 9, situacao_cobranca: "em_atraso" })],
    "Matheus"
  );
  const r = aterrar(
    {
      resumo: "Um escritório sumido.",
      destaques: [],
      mensagens: [{ ref: "c1", texto: "Oi Ana, o escritório está em atraso e precisamos resolver isso." }],
    },
    candidatos,
    [],
    FORA_DA_AREA.clientes
  );
  assertEquals(r.textos.get("c1"), candidatos[0].textoPadrao);
  assertEquals(r.descartes, [{ ref: "c1", motivo: "texto fora da regra, usado o padrão" }]);
});

Deno.test("clientes: queda de 20+ pontos em 7 dias vira check-in, um por semana", () => {
  const c = candidatosClientes(
    [
      saude({ empresa_id: "q1", empresa_nome: "Caiu", nota: 50, nota_7d: 75, dias_sem_acesso: 1, estagio: "adocao" }),
      saude({ empresa_id: "q2", empresa_nome: "Oscilou", nota: 70, nota_7d: 80, dias_sem_acesso: 1 }),
      saude({ empresa_id: "q3", empresa_nome: "Sumiu", nota: 20, nota_7d: 60, dias_sem_acesso: 10 }),
    ],
    "Matheus",
    AGORA
  );
  assertEquals(c.map((x) => x.chave), ["queda:q1:2026-W42", "sem_acesso:q3:2026-10-15"]);
  assertEquals(c[0].fatos.nota_7_dias_atras, 75);
  assert(c[0].titulo.includes("nota 75 para 50"));
});

Deno.test("semana ISO", () => {
  assertEquals(semanaIso(new Date("2026-10-15T13:00:00Z")), "2026-W42");
  assertEquals(semanaIso(new Date("2027-01-01T12:00:00Z")), "2026-W53");
});

Deno.test("um contato por escritório: outra área já fala com ele, este WhatsApp sai", () => {
  const c = candidatosClientes(
    [
      saude({ empresa_id: "a1", empresa_nome: "Lopes", dias_sem_acesso: 9, feedback_aberto: 1 }),
      saude({ empresa_id: "b1", empresa_nome: "Livre", dias_sem_acesso: 9 }),
    ],
    "Matheus"
  );
  const r = semContatoDuplo(c, new Map([["a1", "receita"]]));
  assertEquals(r.manter.map((x) => x.chave), ["feedback:a1:1", "sem_acesso:b1:2026-10-15"]);
  assertEquals(r.descartes, [{ ref: "c1", motivo: "escritório já tem contato de receita" }]);
});

Deno.test("o que mudou desde ontem", () => {
  assertEquals(
    mudancasDesde(
      { "receita.mrr": 980, "receita.pagantes": 2, "clientes.risco": 3, "receita.em_teste": 1 },
      { "receita.mrr": 490, "receita.pagantes": 1, "clientes.risco": 1, "receita.em_teste": 1 }
    ),
    "Desde ontem: MRR +R$\u00a0490,00, pagantes +1, escritórios em risco +2."
  );
  assertEquals(mudancasDesde({ "receita.mrr": 980 }, {}), "");
});

Deno.test("resultado dos contatos", () => {
  assertEquals(resumoEfeito([]), "");
  assertEquals(
    resumoEfeito(["funcionou", "nao_funcionou", "funcionou"]),
    "Contatos dos últimos 30 dias com resultado medido: 2 de 3 funcionaram."
  );
});
