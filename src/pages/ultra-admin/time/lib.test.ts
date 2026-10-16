import { describe, expect, it } from "vitest";
import { ReceitaSchema, type Receita, type SaudeEmpresa } from "./api";
import type { OpsAcao } from "./api";
import {
  acaoParaDecisao,
  cadenciaLegivel,
  decisoesDoDia,
  ehExecutavel,
  filaDoTime,
  tendenciaNota,
  textoEfeito,
  ordenarDecisoes,
  linkWhatsApp,
  mensagemTesteVencendo,
  quandoVence,
  rotaDoAgente,
  rotuloDoLink,
  statusDoAgente,
  taxa,
  telefoneWhatsApp,
  variacao,
} from "./lib";

const AGORA = new Date(2026, 9, 15, 10, 0); // 15/10/2026 10h, hora local

function receita(parcial: Partial<Receita> = {}): Receita {
  return {
    dias: 30,
    gerado_em: AGORA.toISOString(),
    cadastros: 0,
    cadastros_anterior: 0,
    ativados: 0,
    ativados_anterior: 0,
    novos_pagantes: 0,
    novos_pagantes_anterior: 0,
    pagantes: 0,
    mrr: 0,
    em_teste: 0,
    checkout_pendente: 0,
    testes_vencendo: [],
    em_atraso: [],
    por_origem: [],
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
    ultimo_acesso: AGORA.toISOString(),
    dias_sem_acesso: 0,
    semanas_ativas: 4,
    projetos_ativos: 3,
    usuarios: 2,
    usuarios_ativos_14d: 2,
    feedback_aberto: 0,
    modulos_usados: 2,
    nota_7d: null,
    estagio: "maduro",
    em_atraso: false,
    contato_nome: "Ana Souza",
    contato_telefone: "(14) 99999-0000",
    criada_em: AGORA.toISOString(),
    ...parcial,
  };
}

describe("statusDoAgente", () => {
  it("fase 0: Receita e Clientes mostram números, os outros o plano", () => {
    expect(statusDoAgente({ id: "receita", ativo: false }, null, 0)).toBe("so_numeros");
    expect(statusDoAgente({ id: "clientes", ativo: false }, null, 0)).toBe("so_numeros");
    expect(statusDoAgente({ id: "produto", ativo: false }, null, 0)).toBe("planejado");
    expect(statusDoAgente({ id: "marketing", ativo: false }, null, 0)).toBe("externo");
  });

  it("agente ativo segue a última execução e a fila", () => {
    expect(statusDoAgente({ id: "receita", ativo: true }, { status: "falhou" }, 0)).toBe("falhou");
    expect(statusDoAgente({ id: "receita", ativo: true }, { status: "pausada_teto" }, 3)).toBe("pausado");
    expect(statusDoAgente({ id: "receita", ativo: true }, { status: "ok" }, 2)).toBe("atencao");
    expect(statusDoAgente({ id: "receita", ativo: true }, { status: "ok" }, 0)).toBe("ok");
  });

  it("Central é a ficha do chefe de gabinete", () => {
    expect(rotaDoAgente("chefe")).toBe("/ultra-admin/time");
    expect(rotaDoAgente("receita")).toBe("/ultra-admin/time/receita");
  });
});

describe("números", () => {
  it("variação contra o período anterior", () => {
    expect(variacao(12, 10)).toEqual({ value: 20 });
    expect(variacao(3, 0)).toEqual({ isNew: true });
    expect(variacao(0, 0)).toBeUndefined();
  });

  it("taxa sem base vira traço", () => {
    expect(taxa(1, 4)).toBe("25%");
    expect(taxa(0, 0)).toBe("-");
  });
});

describe("WhatsApp", () => {
  it("normaliza telefone brasileiro para o wa.me", () => {
    expect(telefoneWhatsApp("(14) 99999-0000")).toBe("5514999990000");
    expect(telefoneWhatsApp("+55 14 3333-0000")).toBe("551433330000");
    expect(telefoneWhatsApp("123")).toBeNull();
    expect(telefoneWhatsApp(null)).toBeNull();
  });

  it("monta o link com o texto codificado", () => {
    expect(linkWhatsApp("14999990000", "Oi, tudo bem?")).toBe("https://wa.me/5514999990000?text=Oi%2C%20tudo%20bem%3F");
    expect(linkWhatsApp("", "Oi")).toBeNull();
  });

  it("vencimento em dia do calendário", () => {
    expect(quandoVence(new Date(2026, 9, 15, 23, 0).toISOString(), AGORA)).toBe("hoje");
    expect(quandoVence(new Date(2026, 9, 16, 8, 0).toISOString(), AGORA)).toBe("amanhã");
    expect(quandoVence(new Date(2026, 9, 18, 8, 0).toISOString(), AGORA)).toBe("em 3 dias");
  });

  it("mensagem do teste muda quando ainda não há projeto", () => {
    const vence = new Date(2026, 9, 16, 8, 0).toISOString();
    const com = mensagemTesteVencendo({
      contato: "Ana Souza",
      remetente: "Matheus",
      projetos: 2,
      venceEm: vence,
      agora: AGORA,
    });
    const sem = mensagemTesteVencendo({
      contato: null,
      remetente: "Matheus",
      projetos: 0,
      venceEm: vence,
      agora: AGORA,
    });
    expect(com).toContain("Oi Ana, aqui é Matheus, da Pilar.");
    expect(com).toContain("2 projetos");
    expect(com).toContain("amanhã");
    expect(sem).toContain("Oi, aqui é Matheus");
    expect(sem).toContain("ainda não deu tempo de cadastrar um projeto");
    expect(`${com}${sem}`).not.toMatch(/[—–]/);
  });
});

describe("decisoesDoDia", () => {
  it("teste vencendo e atraso vêm antes de cliente sem acesso", () => {
    const decisoes = decisoesDoDia(
      receita({
        testes_vencendo: [
          {
            empresa_id: "t1",
            empresa_nome: "Teste Um",
            vence_em: new Date(2026, 9, 16, 8, 0).toISOString(),
            projetos: 1,
            contato_nome: "Bia",
            contato_telefone: "14988887777",
          },
        ],
        em_atraso: [
          { empresa_id: "a1", empresa_nome: "Atrasada", desde: null, contato_nome: null, contato_telefone: null },
        ],
      }),
      [saude({ empresa_id: "s1", empresa_nome: "Sumida", dias_sem_acesso: 9, nota: 30, faixa: "risco" })],
      "Matheus",
      AGORA
    );

    expect(decisoes.map((d) => d.id)).toEqual(["teste-t1", "atraso-a1", "acesso-s1"]);
    expect(decisoes[0].whatsapp).toContain("https://wa.me/5514988887777?text=");
    expect(decisoes[1].whatsapp).toBeNull();
    expect(decisoes[1].detalhe).toBe("Sem telefone no cadastro.");
    expect(decisoes[2].titulo).toBe("Sumida: sem acesso há 9 dias");
  });

  it("ignora empresa fora de uso e cliente que entrou há pouco", () => {
    const decisoes = decisoesDoDia(
      receita(),
      [
        saude({ empresa_id: "v1", situacao_cobranca: "teste_vencido", dias_sem_acesso: 40 }),
        saude({ empresa_id: "ok", dias_sem_acesso: 2 }),
      ],
      "Matheus",
      AGORA
    );
    expect(decisoes).toEqual([]);
  });

  it("feedback sem resposta leva para a triagem, sem WhatsApp", () => {
    const [d] = decisoesDoDia(receita(), [saude({ feedback_aberto: 2 })], "Matheus", AGORA);
    expect(d.link).toBe("/ultra-admin/feedback");
    expect(d.whatsapp).toBeNull();
    expect(d.titulo).toContain("2 feedbacks sem resposta");
  });
});

describe("ReceitaSchema", () => {
  it("aceita o numeric do Postgres que chega como string e recusa shape quebrado", () => {
    const ok = ReceitaSchema.parse({ ...receita(), mrr: "1470.00" });
    expect(ok.mrr).toBe(1470);
    expect(() => ReceitaSchema.parse({ ...receita(), testes_vencendo: [{ empresa_id: 1 }] })).toThrow();
  });
});

function acao(parcial: Partial<OpsAcao>): OpsAcao {
  return {
    id: "a1",
    agente_id: "receita",
    tipo: "whatsapp",
    titulo: "Vieira: teste termina amanhã",
    prioridade: 1,
    prazo: "2026-10-16T15:00:00Z",
    empresa_id: "e1",
    created_at: "2026-10-15T10:00:00Z",
    rascunho: { canal: "whatsapp", texto: "Oi Carla, aqui é Matheus, da Pilar.", telefone: "14998112233" },
    ...parcial,
  };
}

describe("fase 1: ações gravadas pelos agentes", () => {
  it("ação de WhatsApp vira item com rascunho editável e link pronto", () => {
    const d = acaoParaDecisao(acao({}));
    expect(d.acao).toEqual({
      id: "a1",
      texto: "Oi Carla, aqui é Matheus, da Pilar.",
      telefone: "14998112233",
      canal: "whatsapp",
    });
    expect(d.whatsapp).toContain("https://wa.me/5514998112233?text=");
    expect(d.link).toBe("/ultra-admin/empresas/e1");
  });

  it("alerta de feedback leva para a triagem e não tem WhatsApp", () => {
    const d = acaoParaDecisao(
      acao({
        tipo: "alerta",
        prioridade: 2,
        rascunho: { canal: "alerta", texto: "Responder na triagem.", link: "/ultra-admin/feedback" },
      })
    );
    expect(d.whatsapp).toBeNull();
    expect(d.link).toBe("/ultra-admin/feedback");
    expect(d.prioridade).toBe(2);
  });

  it("sem telefone, o item avisa em vez de abrir conversa vazia", () => {
    const d = acaoParaDecisao(acao({ rascunho: { canal: "whatsapp", texto: "Oi", telefone: null } }));
    expect(d.whatsapp).toBeNull();
    expect(d.detalhe).toBe("Sem telefone no cadastro.");
  });

  it("ordena hoje antes de esta semana e prazo mais perto primeiro", () => {
    const a = acaoParaDecisao(acao({ id: "x", prioridade: 2, prazo: null, titulo: "B" }));
    const b = acaoParaDecisao(acao({ id: "y", prioridade: 1, prazo: "2026-10-18T00:00:00Z" }));
    const c = acaoParaDecisao(acao({ id: "z", prioridade: 1, prazo: "2026-10-16T00:00:00Z" }));
    expect(ordenarDecisoes([a, b, c]).map((d) => d.acao?.id)).toEqual(["z", "y", "x"]);
  });

  it("agente que já rodou e foi desligado aparece como pausado", () => {
    expect(statusDoAgente({ id: "receita", ativo: false }, { status: "ok" }, 0)).toBe("pausado");
  });

  it("horário do cron em Brasília e quem a Edge Function executa", () => {
    expect(cadenciaLegivel("0 10,22 * * *")).toBe("todo dia às 7h e às 19h");
    expect(cadenciaLegivel("7 10 * * 1")).toBe("toda segunda às 7h07");
    expect(cadenciaLegivel(null)).toBeNull();
    expect(ehExecutavel("chefe")).toBe(true);
    expect(ehExecutavel("marketing")).toBe(false);
  });
});

describe("filaDoTime", () => {
  const vencendo = receita({
    testes_vencendo: [
      {
        empresa_id: "m1",
        empresa_nome: "Moraes",
        vence_em: new Date(2026, 9, 17, 8, 0).toISOString(),
        projetos: 0,
        contato_nome: "Rui",
        contato_telefone: "11987774455",
      },
    ],
  });

  it("agente que nunca rodou: fila pela regra", () => {
    const fila = filaDoTime({
      agentesQueJaRodaram: new Set(),
      pendentes: [],
      receita: vencendo,
      saude: [],
      remetente: "Matheus",
    });
    expect(fila.map((d) => d.id)).toEqual(["teste-m1"]);
  });

  it("agente que já rodou (mesmo pausado): só as ações dele, a regra não recria o descartado", () => {
    const fila = filaDoTime({
      agentesQueJaRodaram: new Set(["receita"]),
      pendentes: [acao({ id: "a9", titulo: "Lopes: pagamento em atraso" })],
      receita: vencendo,
      saude: [],
      remetente: "Matheus",
    });
    expect(fila.map((d) => d.id)).toEqual(["acao-a9"]);
  });
});

describe("SPEC 129: tendência e resultado", () => {
  it("tendência da nota só aparece com retrato antigo e variação de 5 ou mais", () => {
    expect(tendenciaNota(50, 75)).toEqual({ texto: "caiu 25 em 7 dias", caiu: true });
    expect(tendenciaNota(80, 68)).toEqual({ texto: "subiu 12 em 7 dias", caiu: false });
    expect(tendenciaNota(70, 72)).toBeNull();
    expect(tendenciaNota(70, null)).toBeNull();
  });

  it("resultado dos contatos", () => {
    expect(textoEfeito([])).toBeNull();
    expect(textoEfeito(["funcionou"])).toBe("1 de 1 contato funcionou");
    expect(textoEfeito(["funcionou", "nao_funcionou", "funcionou"])).toBe("2 de 3 contatos funcionaram");
  });
});

describe("Produto (SPEC 130)", () => {
  it("roda pelo executor e a tarefa abre o destino certo", () => {
    expect(ehExecutavel("produto")).toBe(true);
    expect(rotuloDoLink("/ultra-admin/atividade")).toBe("Ver atividade");
    expect(rotuloDoLink("/ultra-admin/feedback")).toBe("Ver feedback");
    expect(rotuloDoLink("/ultra-admin/empresas/e1")).toBe("Ver empresa");
    expect(rotuloDoLink("/ultra-admin/time")).toBe("Abrir");
  });

  it("tarefa sem empresa leva ao link gravado pelo agente", () => {
    const acao = {
      id: "a1",
      agente_id: "produto",
      tipo: "alerta",
      empresa_id: null,
      titulo: "Financeiro: de 6 para 3 escritórios usando em 28 dias",
      prioridade: 1,
      prazo: null,
      rascunho: { canal: "alerta", texto: "Veja na Atividade quem parou.", link: "/ultra-admin/atividade" },
    } as unknown as OpsAcao;
    const d = acaoParaDecisao(acao);
    expect(d.link).toBe("/ultra-admin/atividade");
    expect(d.whatsapp).toBeNull();
    expect(d.detalhe).toBe("Veja na Atividade quem parou.");
  });
});
