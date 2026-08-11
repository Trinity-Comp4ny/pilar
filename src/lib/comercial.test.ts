import { describe, it, expect } from "vitest";
import {
  propostaPrimaria,
  statusExibido,
  valorNoFunil,
  taxaFechamentoPropostas,
  propostasPorLead,
} from "./comercial";
import type { Proposta } from "@/hooks/usePropostas";
import type { Lead } from "@/hooks/useLeads";

// Fábrica enxuta: só os campos que as funções de funil leem.
function prop(over: Partial<Proposta>): Proposta {
  return {
    id: over.id ?? "p1",
    empresa_id: "e1",
    lead_id: over.lead_id ?? null,
    cliente_id: null,
    codigo: null,
    titulo: "t",
    area_m2: null,
    localizacao: null,
    valor_proposto: over.valor_proposto ?? null,
    custo_estimado: null,
    margem_estimada_pct: over.margem_estimada_pct ?? null,
    prazo_estimado_dias: null,
    status: over.status ?? "rascunho",
    validade: over.validade ?? null,
    projeto_id: over.projeto_id ?? null,
    dados_simulacao: null,
    observacao: null,
    contrato_enviado: false,
    contrato_assinado: false,
    contrato_recusado: false,
    created_at: over.created_at ?? "2026-01-01T00:00:00Z",
    ...over,
  } as Proposta;
}

function lead(over: Partial<Lead>): Lead {
  return { id: over.id ?? "l1", nome: "Fulano", status: over.status ?? "Novo", ...over } as Lead;
}

const HOJE = new Date("2026-08-11T12:00:00Z");

describe("propostaPrimaria", () => {
  it("pega a mais recente não-recusada quando há várias", () => {
    const antiga = prop({ id: "a", status: "rascunho", created_at: "2026-01-01T00:00:00Z" });
    const nova = prop({ id: "b", status: "enviada", created_at: "2026-03-01T00:00:00Z" });
    expect(propostaPrimaria([antiga, nova])?.id).toBe("b");
  });

  it("ignora recusadas mesmo que sejam as mais recentes", () => {
    const viva = prop({ id: "a", status: "rascunho", created_at: "2026-01-01T00:00:00Z" });
    const recusadaRecente = prop({ id: "b", status: "recusada", created_at: "2026-05-01T00:00:00Z" });
    expect(propostaPrimaria([viva, recusadaRecente])?.id).toBe("a");
  });

  it("retorna null quando só há recusadas", () => {
    expect(propostaPrimaria([prop({ status: "recusada" })])).toBeNull();
  });

  it("retorna null para lista vazia", () => {
    expect(propostaPrimaria([])).toBeNull();
  });
});

describe("statusExibido", () => {
  it("deriva 'expirada' de uma enviada com validade vencida", () => {
    expect(statusExibido(prop({ status: "enviada", validade: "2026-08-01" }), HOJE)).toBe("expirada");
  });

  it("mantém 'enviada' quando a validade ainda não venceu", () => {
    expect(statusExibido(prop({ status: "enviada", validade: "2026-12-31" }), HOJE)).toBe("enviada");
  });

  it("não expira quem não está enviada", () => {
    expect(statusExibido(prop({ status: "aceita", validade: "2026-08-01" }), HOJE)).toBe("aceita");
  });

  it("mantém 'enviada' sem validade", () => {
    expect(statusExibido(prop({ status: "enviada", validade: null }), HOJE)).toBe("enviada");
  });
});

describe("valorNoFunil", () => {
  it("usa o valor proposto quando há proposta primária", () => {
    expect(valorNoFunil(lead({ valor_estimado: 10000 }), prop({ valor_proposto: 40000 }))).toBe(40000);
  });

  it("cai para o estimado quando não há proposta", () => {
    expect(valorNoFunil(lead({ valor_estimado: 10000 }), null)).toBe(10000);
  });

  it("cai para o estimado quando a proposta não tem valor", () => {
    expect(valorNoFunil(lead({ valor_estimado: 10000 }), prop({ valor_proposto: null }))).toBe(10000);
  });

  it("é 0 quando não há nem proposta nem estimado", () => {
    expect(valorNoFunil(lead({}), null)).toBe(0);
  });

  it("não conta duas propostas do mesmo lead (usa só a primária)", () => {
    const propostas = [
      prop({ id: "a", status: "recusada", valor_proposto: 99999, created_at: "2026-05-01T00:00:00Z" }),
      prop({ id: "b", status: "enviada", valor_proposto: 40000, created_at: "2026-03-01T00:00:00Z" }),
    ];
    expect(valorNoFunil(lead({}), propostaPrimaria(propostas))).toBe(40000);
  });
});

describe("taxaFechamentoPropostas", () => {
  it("conta aceita sobre as que saíram do rascunho", () => {
    const propostas = [
      prop({ status: "aceita" }),
      prop({ status: "recusada" }),
      prop({ status: "enviada", validade: "2026-12-31" }),
      prop({ status: "rascunho" }), // ignorada no denominador
    ];
    expect(taxaFechamentoPropostas(propostas, HOJE)).toBe(33); // 1 aceita / 3 decididas
  });

  it("conta a expirada derivada no denominador", () => {
    const propostas = [
      prop({ status: "aceita" }),
      prop({ status: "enviada", validade: "2026-08-01" }), // expirada
    ];
    expect(taxaFechamentoPropostas(propostas, HOJE)).toBe(50);
  });

  it("retorna null quando nada saiu do rascunho", () => {
    expect(taxaFechamentoPropostas([prop({ status: "rascunho" })], HOJE)).toBeNull();
  });

  it("retorna null para lista vazia", () => {
    expect(taxaFechamentoPropostas([], HOJE)).toBeNull();
  });
});

describe("propostasPorLead", () => {
  it("agrupa por lead_id e ignora propostas sem lead", () => {
    const map = propostasPorLead([
      prop({ id: "a", lead_id: "l1" }),
      prop({ id: "b", lead_id: "l1" }),
      prop({ id: "c", lead_id: "l2" }),
      prop({ id: "d", lead_id: null }), // recompra sem lead: fora do board
    ]);
    expect(map.get("l1")?.length).toBe(2);
    expect(map.get("l2")?.length).toBe(1);
    expect(map.has("d")).toBe(false);
    expect(map.size).toBe(2);
  });
});
