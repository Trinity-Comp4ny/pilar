import { describe, expect, it } from "vitest";
import { rotaCasa } from "./OnboardingTourController";

describe("rotaCasa", () => {
  it("rota simples compara só o caminho", () => {
    expect(rotaCasa("/admin", "/admin", "?tab=plano")).toBe(true);
    expect(rotaCasa("/admin", "/inicio", "")).toBe(false);
  });
  it("rota com ?tab exige a mesma aba", () => {
    expect(rotaCasa("/gestao/financeiro?tab=carteira", "/gestao/financeiro", "?tab=carteira")).toBe(true);
    expect(rotaCasa("/gestao/financeiro?tab=carteira", "/gestao/financeiro", "?tab=lancamentos")).toBe(false);
    expect(rotaCasa("/gestao/financeiro?tab=carteira", "/gestao/financeiro", "")).toBe(false);
  });
});
