import { describe, expect, it } from "vitest";
import {
  agruparPorObra,
  calcularResumo,
  normalizarNome,
  scoreSemelhanca,
  statusProposta,
  sugerirFornecedor,
  type CompraInsight,
  type PropostaInsight,
} from "./fornecedorInsights";

function proposta(over: Partial<PropostaInsight> = {}): PropostaInsight {
  return {
    propostaId: "p1",
    cotacaoId: "c1",
    obraId: "o1",
    obraNome: "Obra 1",
    descricao: "Concreto",
    valor: 1000,
    status: "perdeu",
    ...over,
  };
}

describe("statusProposta", () => {
  it("marca 'venceu' quando é a proposta vencedora", () => {
    expect(statusProposta("decidida", "p1", "p1")).toBe("venceu");
  });
  it("marca 'aberta' quando a cotação segue aberta e não venceu", () => {
    expect(statusProposta("aberta", "p1", null)).toBe("aberta");
  });
  it("marca 'perdeu' quando a cotação foi decidida em outra proposta", () => {
    expect(statusProposta("decidida", "p1", "p2")).toBe("perdeu");
  });
});

describe("calcularResumo", () => {
  it("taxa de vitória = vencedoras / enviadas (2 de 5 = 40%)", () => {
    const propostas = [
      proposta({ propostaId: "a", status: "venceu" }),
      proposta({ propostaId: "b", status: "venceu" }),
      proposta({ propostaId: "c", status: "perdeu" }),
      proposta({ propostaId: "d", status: "perdeu" }),
      proposta({ propostaId: "e", status: "aberta" }),
    ];
    const resumo = calcularResumo(propostas, []);
    expect(resumo.cotacoesParticipadas).toBe(5);
    expect(resumo.vitorias).toBe(2);
    expect(resumo.taxaVitoria).toBeCloseTo(0.4);
  });

  it("conta obras distintas de cotações e compras juntas", () => {
    const propostas = [proposta({ obraId: "o1" })];
    const compras: CompraInsight[] = [
      { lancamentoId: "l1", obraId: "o1", obraNome: "Obra 1", data: "2026-08-01", descricao: "x", valor: 500 },
      { lancamentoId: "l2", obraId: "o2", obraNome: "Obra 2", data: "2026-08-05", descricao: "y", valor: 300 },
    ];
    const resumo = calcularResumo(propostas, compras);
    expect(resumo.obras).toBe(2);
    expect(resumo.totalComprado).toBe(800);
    expect(resumo.ticketMedio).toBe(400);
    expect(resumo.ultimaCompra).toBe("2026-08-05");
  });

  it("fornecedor sem histórico zera tudo sem quebrar", () => {
    const resumo = calcularResumo([], []);
    expect(resumo).toMatchObject({ obras: 0, totalComprado: 0, taxaVitoria: 0, ticketMedio: 0, ultimaCompra: null });
  });
});

describe("agruparPorObra", () => {
  it("uma linha por obra com totais e vitórias", () => {
    const propostas = [
      proposta({ obraId: "o1", obraNome: "Obra 1", valor: 1000, status: "venceu" }),
      proposta({ obraId: "o1", obraNome: "Obra 1", valor: 500, status: "perdeu" }),
    ];
    const compras: CompraInsight[] = [
      { lancamentoId: "l1", obraId: "o1", obraNome: "Obra 1", data: "2026-08-01", descricao: "x", valor: 1000 },
    ];
    const linhas = agruparPorObra(propostas, compras);
    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toMatchObject({ obraId: "o1", totalCotado: 1500, totalComprado: 1000, cotacoes: 2, vitorias: 1 });
  });
});

describe("reconciliação por nome", () => {
  it("normaliza acento, pontuação e sufixo de razão social", () => {
    expect(normalizarNome("Concreteira X Ltda.")).toBe("concreteira x");
    expect(normalizarNome("Construção EIRELI")).toBe("construcao");
  });

  it("dá score alto para nome equivalente e sugere o cadastro", () => {
    expect(scoreSemelhanca("Concreteira X", "Concreteira X Ltda")).toBeGreaterThanOrEqual(0.85);
    const sugestao = sugerirFornecedor("Concreteira X", [
      { id: "f1", nome: "Aço Forte" },
      { id: "f2", nome: "Concreteira X Ltda" },
    ]);
    expect(sugestao?.id).toBe("f2");
  });

  it("não sugere nada quando nenhum cadastro é parecido", () => {
    const sugestao = sugerirFornecedor("Fornecedor Totalmente Novo", [{ id: "f1", nome: "Aço Forte" }]);
    expect(sugestao).toBeNull();
  });
});
