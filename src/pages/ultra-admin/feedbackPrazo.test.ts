import { describe, expect, it } from "vitest";
import { bugVencido, diasAtePrazoDoBug } from "./feedbackPrazo";

const AGORA = new Date("2026-11-10T12:00:00Z").getTime();
const ha = (dias: number) => new Date(AGORA - dias * 24 * 60 * 60 * 1000).toISOString();

describe("prazo de bug (SPEC 160)", () => {
  it("bug aberto tem 7 dias; resolvido e sugestão não têm prazo", () => {
    expect(diasAtePrazoDoBug({ tipo: "bug", status: "novo", createdAt: ha(2) }, AGORA)).toBe(5);
    expect(diasAtePrazoDoBug({ tipo: "bug", status: "resolvido", createdAt: ha(2) }, AGORA)).toBeNull();
    expect(diasAtePrazoDoBug({ tipo: "sugestao", status: "novo", createdAt: ha(2) }, AGORA)).toBeNull();
  });

  it("passou de 7 dias, vencido", () => {
    expect(bugVencido({ tipo: "bug", status: "em_analise", createdAt: ha(9) }, AGORA)).toBe(true);
    expect(bugVencido({ tipo: "bug", status: "em_analise", createdAt: ha(6) }, AGORA)).toBe(false);
  });
});
