import { describe, expect, it } from "vitest";
import { montarPlano } from "@/lib/onboarding/plano";
import { ONBOARDING_STEPS } from "@/lib/onboarding/steps";

const chaves = (p: ReturnType<typeof montarPlano>) => p.passos.map((x) => x.key);

describe("montarPlano (SPEC 165)", () => {
  it("lucro por projeto: cliente antes de equipe, equipe antes de projeto, projeto antes do lançamento", () => {
    const plano = montarPlano({ dores: ["lucro_projeto"], dorPrincipal: "lucro_projeto" });
    expect(chaves(plano)).toEqual(["cliente", "equipe", "projeto", "financeiro"]);
    expect(plano.objetivo).toBe("gestao");
  });

  it("junta as dores sem repetir passo e mantém a ordem de dependência", () => {
    const plano = montarPlano({ dores: ["obra", "propostas"], dorPrincipal: "obra" });
    expect(chaves(plano)).toEqual(["cliente", "proposta", "projeto", "obra", "fornecedor"]);
    expect(new Set(chaves(plano)).size).toBe(chaves(plano).length);
    // O objetivo (ordem do checklist) é o da dor principal.
    expect(plano.objetivo).toBe("obras");
  });

  it("cada passo diz qual dor o puxou", () => {
    const plano = montarPlano({ dores: ["obra", "propostas"], dorPrincipal: "obra" });
    expect(plano.passos.find((p) => p.key === "proposta")?.motivo).toBe("propostas");
    expect(plano.passos.find((p) => p.key === "obra")?.motivo).toBe("obra");
  });

  it("sem dor (pulou) devolve o plano padrão", () => {
    const plano = montarPlano({ dores: [], dorPrincipal: null });
    expect(chaves(plano)).toEqual(["cliente", "equipe", "projeto"]);
    expect(plano.objetivo).toBe("gestao");
  });

  it("escritório de 16+ pessoas sempre inclui equipe e colegas", () => {
    const plano = montarPlano({ dores: ["propostas"], dorPrincipal: "propostas", porte: "16-40" });
    expect(chaves(plano)).toEqual(["cliente", "equipe", "colega", "proposta", "projeto"]);
  });

  it("muitos projetos ativos pedem o fluxo de disciplinas", () => {
    const plano = montarPlano({ dores: ["propostas"], dorPrincipal: "propostas", projetosAtivos: "30+" });
    expect(chaves(plano)).toContain("fluxo");
  });

  it("soma os minutos e só usa passos que existem no checklist", () => {
    const plano = montarPlano({ dores: ["lucro_projeto"], dorPrincipal: "lucro_projeto" });
    expect(plano.minutosTotal).toBe(plano.passos.reduce((s, p) => s + p.minutos, 0));
    const existentes = new Set(ONBOARDING_STEPS.map((s) => s.key));
    for (const p of plano.passos) expect(existentes.has(p.key)).toBe(true);
  });
});
