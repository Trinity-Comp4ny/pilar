import { describe, expect, it } from "vitest";
import { calcularNps, DIA_MS, podeMostrarNps, podePerguntarEsforco } from "./pesquisas";

const AGORA = new Date("2026-11-10T12:00:00Z").getTime();
const ha = (dias: number) => new Date(AGORA - dias * DIA_MS).toISOString();

describe("pesquisas (SPEC 156)", () => {
  it("NPS só depois de 14 dias de conta e no máximo a cada 90 dias", () => {
    expect(podeMostrarNps(ha(10), [], AGORA)).toBe(false);
    expect(podeMostrarNps(ha(20), [], AGORA)).toBe(true);
    expect(podeMostrarNps(ha(200), [{ tipo: "nps", fluxo: null, created_at: ha(30) }], AGORA)).toBe(false);
    expect(podeMostrarNps(ha(200), [{ tipo: "nps", fluxo: null, created_at: ha(100) }], AGORA)).toBe(true);
    expect(podeMostrarNps(ha(200), [{ tipo: "ces", fluxo: "lead", created_at: ha(1) }], AGORA)).toBe(true);
    expect(podeMostrarNps(null, [], AGORA)).toBe(false);
  });

  it("CES por amostra e no máximo uma vez a cada 30 dias por fluxo", () => {
    expect(podePerguntarEsforco("lead", [], AGORA, 0.5)).toBe(false);
    expect(podePerguntarEsforco("lead", [], AGORA, 0.1)).toBe(true);
    const recente = [{ tipo: "ces" as const, fluxo: "lead", created_at: ha(5) }];
    expect(podePerguntarEsforco("lead", recente, AGORA, 0.1)).toBe(false);
    expect(podePerguntarEsforco("proposta", recente, AGORA, 0.1)).toBe(true);
  });

  it("calcula o NPS", () => {
    expect(calcularNps([10, 9, 8, 6, 0])).toEqual({ respostas: 5, promotores: 2, neutros: 1, detratores: 2, nps: 0 });
    expect(calcularNps([10, 10])).toMatchObject({ nps: 100 });
    expect(calcularNps([]).nps).toBeNull();
  });
});
