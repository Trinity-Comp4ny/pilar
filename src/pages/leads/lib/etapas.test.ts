import { describe, it, expect } from "vitest";
import {
  acaoDoDrop,
  agruparPorEtapa,
  corDaEtapaLead,
  etapaDoLead,
  motivoNaoExcluir,
  primeiraEtapaDoBucket,
  proximaOrdem,
  trocarOrdem,
} from "./etapas";
import type { Lead } from "@/hooks/useLeads";
import type { LeadBucket, LeadEtapa } from "@/pages/leads/hooks/useLeadEtapas";

const etapa = (id: string, ordem: number, bucket: LeadBucket, nome = id): LeadEtapa => ({
  id,
  nome,
  ordem,
  cor: null,
  bucket,
});

const lead = (over: Partial<Lead> & { id: string }): Lead => ({ nome: "L", status: "Novo", ...over });

const PADRAO: LeadEtapa[] = [
  etapa("novo", 0, "Novo"),
  etapa("contato", 1, "Em contato"),
  etapa("proposta", 2, "Proposta"),
  etapa("negociacao", 3, "Negociação"),
  etapa("ganho", 4, "Ganho"),
  etapa("perdido", 5, "Perdido"),
];

describe("etapaDoLead", () => {
  it("usa a coluna do lead quando existe", () => {
    const l = lead({ id: "1", status: "Em contato", etapa_id: "visita" });
    const etapas = [...PADRAO, etapa("visita", 10, "Em contato", "Visita técnica")];
    expect(etapaDoLead(l, etapas)?.id).toBe("visita");
  });

  it("sem etapa_id cai na primeira coluna do bucket do status", () => {
    expect(etapaDoLead(lead({ id: "1", status: "Proposta" }), PADRAO)?.id).toBe("proposta");
  });

  it("etapa_id que não está na lista cai no bucket do status", () => {
    expect(etapaDoLead(lead({ id: "1", status: "Ganho", etapa_id: "sumiu" }), PADRAO)?.id).toBe("ganho");
  });

  it("sem coluna do bucket aberto, usa a primeira coluna aberta", () => {
    const etapas = PADRAO.filter((e) => e.bucket !== "Novo");
    expect(etapaDoLead(lead({ id: "1", status: "Novo" }), etapas)?.id).toBe("contato");
  });

  it("Ganho sem nenhuma coluna de Ganho não vai parar em outra coluna", () => {
    const etapas = PADRAO.filter((e) => e.bucket !== "Ganho");
    expect(etapaDoLead(lead({ id: "1", status: "Ganho" }), etapas)).toBeNull();
  });
});

describe("agruparPorEtapa", () => {
  it("agrupa por coluna e mantém colunas vazias", () => {
    const leads = [
      lead({ id: "a", status: "Novo", etapa_id: "novo" }),
      lead({ id: "b", status: "Novo", etapa_id: "novo" }),
      lead({ id: "c", status: "Ganho", etapa_id: "ganho" }),
    ];
    const g = agruparPorEtapa(leads, PADRAO);
    expect(g.get("novo")?.map((l) => l.id)).toEqual(["a", "b"]);
    expect(g.get("ganho")?.map((l) => l.id)).toEqual(["c"]);
    expect(g.get("perdido")).toEqual([]);
  });

  it("lead legado sem coluna aparece na coluna do status, nunca some", () => {
    const g = agruparPorEtapa([lead({ id: "x", status: "Negociação" })], PADRAO);
    expect(g.get("negociacao")?.map((l) => l.id)).toEqual(["x"]);
  });
});

describe("acaoDoDrop", () => {
  it("coluna de Perdido pede o motivo, qualquer que seja o nome", () => {
    expect(acaoDoDrop(etapa("x", 9, "Perdido", "Descartado"), { cliente_id: undefined })).toBe("motivo-perda");
  });

  it("coluna de Ganho converte quando o lead ainda não é cliente", () => {
    expect(acaoDoDrop(etapa("x", 9, "Ganho", "Contrato assinado"), { cliente_id: undefined })).toBe("converter");
  });

  it("coluna de Ganho só move quando o lead já é cliente", () => {
    expect(acaoDoDrop(etapa("x", 9, "Ganho"), { cliente_id: "c1" })).toBe("mover");
  });

  it("coluna aberta só move", () => {
    expect(acaoDoDrop(etapa("x", 9, "Em contato", "Visita técnica"), { cliente_id: undefined })).toBe("mover");
  });
});

describe("motivoNaoExcluir", () => {
  it("recusa coluna com leads e diz quantos", () => {
    expect(motivoNaoExcluir(PADRAO[1], PADRAO, 3)).toContain("3 leads");
    expect(motivoNaoExcluir(PADRAO[1], PADRAO, 1)).toContain("1 lead.");
  });

  it("recusa a última coluna de Ganho e a de Perdido", () => {
    expect(motivoNaoExcluir(PADRAO[4], PADRAO, 0)).toContain("Ganho");
    expect(motivoNaoExcluir(PADRAO[5], PADRAO, 0)).toContain("Perdido");
  });

  it("permite excluir Ganho quando existe outra", () => {
    const etapas = [...PADRAO, etapa("g2", 10, "Ganho")];
    expect(motivoNaoExcluir(PADRAO[4], etapas, 0)).toBeNull();
  });

  it("permite excluir coluna aberta vazia, mesmo a única do bucket", () => {
    expect(motivoNaoExcluir(PADRAO[0], PADRAO, 0)).toBeNull();
  });
});

describe("ordem", () => {
  it("proximaOrdem vai para o fim", () => {
    expect(proximaOrdem(PADRAO)).toBe(6);
    expect(proximaOrdem([])).toBe(0);
  });

  it("trocarOrdem troca com o vizinho", () => {
    expect(trocarOrdem(PADRAO, "contato", -1)).toEqual([
      { id: "contato", ordem: 0 },
      { id: "novo", ordem: 1 },
    ]);
    expect(trocarOrdem(PADRAO, "contato", 1)).toEqual([
      { id: "contato", ordem: 2 },
      { id: "proposta", ordem: 1 },
    ]);
  });

  it("trocarOrdem nas pontas não faz nada", () => {
    expect(trocarOrdem(PADRAO, "novo", -1)).toBeNull();
    expect(trocarOrdem(PADRAO, "perdido", 1)).toBeNull();
    expect(trocarOrdem(PADRAO, "inexistente", 1)).toBeNull();
  });
});

describe("cores e bucket", () => {
  it("cor da coluna vence a do bucket", () => {
    expect(corDaEtapaLead("#123456", "Ganho")).toBe("#123456");
    expect(corDaEtapaLead(null, "Ganho")).toBe("#22c55e");
  });

  it("primeiraEtapaDoBucket pega a de menor ordem", () => {
    const etapas = [etapa("g2", 10, "Ganho"), ...PADRAO];
    expect(primeiraEtapaDoBucket(etapas, "Ganho")?.id).toBe("ganho");
    expect(
      primeiraEtapaDoBucket(
        PADRAO.filter((e) => e.bucket !== "Perdido"),
        "Perdido"
      )
    ).toBeNull();
  });
});
