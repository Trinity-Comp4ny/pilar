import { describe, expect, it } from "vitest";
import { calculateYearlySavingPct, capacidadeDoPlano, type Plan } from "./usePlans";

// Planos v4 (DECISOES.md 2026-11-06): R$ 299/499/899, anual = 10x o mensal.
const base: Plan = {
  id: "p1",
  slug: "starter",
  nome: "Essencial",
  descricao: null,
  preco_mensal: 299,
  preco_anual: 2990,
  max_usuarios: null,
  max_projetos: 10,
  max_obras: 2,
  max_leads: 50,
  tokens_mensais: 500_000,
  features: [],
  destaque: false,
  ordem: 1,
};

describe("capacidadeDoPlano", () => {
  it("Essencial: faixas de projetos, obras, leads e créditos de IA", () => {
    expect(capacidadeDoPlano(base)).toEqual([
      "Até 10 projetos ativos",
      "Até 2 obras ativas",
      "Até 50 leads ativos",
      "100 créditos de IA por mês",
    ]);
  });

  it("Escala: sem limite vira 'ilimitado' e a cota grande é formatada com milhar", () => {
    expect(
      capacidadeDoPlano({ ...base, max_projetos: null, max_obras: 15, max_leads: null, tokens_mensais: 8_000_000 })
    ).toEqual(["Projetos ilimitados", "Até 15 obras ativas", "Leads ilimitados", "1.600 créditos de IA por mês"]);
  });

  it("limite 1 usa o singular", () => {
    expect(capacidadeDoPlano({ ...base, max_projetos: 1, max_obras: 1, max_leads: 1 }).slice(0, 3)).toEqual([
      "Até 1 projeto ativo",
      "Até 1 obra ativa",
      "Até 1 lead ativo",
    ]);
  });

  it("limite zero não vira 'ilimitado'", () => {
    expect(capacidadeDoPlano({ ...base, max_obras: 0 })[1]).toBe("Até 0 obras ativas");
  });

  it("plano sem cota de IA não mostra linha de créditos", () => {
    expect(capacidadeDoPlano({ ...base, tokens_mensais: null })).toHaveLength(3);
  });
});

describe("calculateYearlySavingPct", () => {
  it("anual = 10x o mensal dá 17% de desconto", () => {
    expect(calculateYearlySavingPct(base)).toBe(17);
    expect(calculateYearlySavingPct({ ...base, preco_mensal: 899, preco_anual: 8990 })).toBe(17);
  });

  it("sem preço anual, anual igual ou mais caro que 12x, ou mensal zerado: sem desconto", () => {
    expect(calculateYearlySavingPct({ ...base, preco_anual: null })).toBeNull();
    expect(calculateYearlySavingPct({ ...base, preco_anual: 299 * 12 })).toBeNull();
    expect(calculateYearlySavingPct({ ...base, preco_anual: 5000 })).toBeNull();
    expect(calculateYearlySavingPct({ ...base, preco_mensal: 0 })).toBeNull();
  });
});
