import { describe, expect, it } from "vitest";
import { ReceitaSchema, type Receita, type SaudeEmpresa } from "./api";
import {
  decisoesDoDia,
  linkWhatsApp,
  mensagemTesteVencendo,
  quandoVence,
  rotaDoAgente,
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
    expect(statusDoAgente({ id: "marketing", ativo: false }, null, 0)).toBe("planejado");
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
