import { describe, expect, it } from "vitest";
import { INCLUSO_EM_TODOS, PLANOS } from "./planos";

/**
 * Os números da tabela de preço são decisão do CEO (DECISOES.md, 2026-11-06):
 * R$ 299/499/899, 100/400/1.600 créditos de IA e capacidade por módulo
 * (projetos 10/30/ilimitado, obras 2/5/15, leads 50/200/ilimitado). Mudar
 * qualquer um deles aqui sem mudar a decisão é regressão, e este teste pega.
 */
describe("PLANOS", () => {
  it("tem exatamente três planos, na ordem Essencial, Profissional, Escala", () => {
    expect(PLANOS.map((p) => p.nome)).toEqual(["Essencial", "Profissional", "Escala"]);
    expect(PLANOS.map((p) => p.slug)).toEqual(["starter", "pro", "enterprise"]);
  });

  it("cobra os preços decididos, em ordem crescente", () => {
    expect(PLANOS.map((p) => p.preco)).toEqual([299, 499, 899]);
  });

  it("limita projetos, obras e leads ativos conforme a decisão de capacidade por módulo", () => {
    const [essencial, profissional, escala] = PLANOS;

    expect(essencial.projetos).toBe("Até 10 projetos ativos");
    expect(essencial.obras).toBe("Até 2 obras ativas");
    expect(essencial.leads).toBe("Até 50 leads ativos no funil");

    expect(profissional.projetos).toBe("Até 30 projetos ativos");
    expect(profissional.obras).toBe("Até 5 obras ativas");
    expect(profissional.leads).toBe("Até 200 leads ativos no funil");

    expect(escala.projetos).toBe("Projetos ativos ilimitados");
    expect(escala.obras).toBe("Até 15 obras ativas");
    expect(escala.leads).toBe("Leads ilimitados no funil");
  });

  it("comunica a cota de IA em créditos (100/400/1.600), nunca em tokens", () => {
    expect(PLANOS.map((p) => p.creditosMes)).toEqual([
      "100 créditos de IA por mês",
      "400 créditos de IA por mês",
      "1.600 créditos de IA por mês",
    ]);
    for (const p of PLANOS) {
      expect(p.creditosMes).not.toMatch(/token/i);
    }
  });

  it("destaca só o Profissional", () => {
    const destacados = PLANOS.filter((p) => p.destaque);
    expect(destacados).toHaveLength(1);
    expect(destacados[0].nome).toBe("Profissional");
  });

  it("tem slug e nome únicos e todos os campos de texto preenchidos", () => {
    expect(new Set(PLANOS.map((p) => p.slug)).size).toBe(PLANOS.length);
    expect(new Set(PLANOS.map((p) => p.nome)).size).toBe(PLANOS.length);
    for (const p of PLANOS) {
      for (const campo of [p.publico, p.projetos, p.obras, p.leads, p.creditosMes, p.atendimento]) {
        expect(campo.trim().length).toBeGreaterThan(0);
      }
      expect(Number.isInteger(p.preco)).toBe(true);
    }
  });
});

describe("INCLUSO_EM_TODOS", () => {
  it("promete usuários ilimitados e a plataforma inteira em todo plano (ADR 0026)", () => {
    expect(INCLUSO_EM_TODOS).toContain("Usuários ilimitados, sem cobrar por cabeça");
    expect(INCLUSO_EM_TODOS.some((item) => /plataforma inteira/.test(item))).toBe(true);
    expect(new Set(INCLUSO_EM_TODOS).size).toBe(INCLUSO_EM_TODOS.length);
  });
});
