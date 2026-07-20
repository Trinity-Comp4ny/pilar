import { describe, it, expect, vi } from "vitest";

// Mock supabase antes de importar o módulo (evita throw de env no jsdom)
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { buildClienteEnrichmentUpdate, statusSideEffects } from "./useLeads";

describe("statusSideEffects", () => {
  it("limpa motivo_perda ao sair de Perdido para qualquer estágio ativo", () => {
    expect(statusSideEffects("Novo")).toEqual({ motivo_perda: null });
    expect(statusSideEffects("Em contato")).toEqual({ motivo_perda: null });
  });

  it("não limpa motivo_perda quando o destino é Perdido", () => {
    expect(statusSideEffects("Perdido")).toEqual({});
  });

  it("carimba convertido_em ao entrar em Ganho e limpa motivo_perda", () => {
    const fields = statusSideEffects("Ganho");
    expect(fields.motivo_perda).toBeNull();
    expect(typeof fields.convertido_em).toBe("string");
    expect(Number.isNaN(Date.parse(fields.convertido_em as string))).toBe(false);
  });
});

describe("buildClienteEnrichmentUpdate", () => {
  it("retorna objeto vazio quando não há enriquecimento", () => {
    expect(buildClienteEnrichmentUpdate(null)).toEqual({});
    expect(buildClienteEnrichmentUpdate(undefined)).toEqual({});
  });

  it("grava o CNPJ em cpf_cnpj só com dígitos", () => {
    const updates = buildClienteEnrichmentUpdate({
      cnpj: "12.345.678/0001-90",
      razao_social: null,
      endereco: null,
    });
    expect(updates).toEqual({ cpf_cnpj: "12345678000190", tipo_pessoa: "juridica" });
    expect(updates).not.toHaveProperty("cnpj");
  });

  it("ignora CNPJ sem nenhum dígito", () => {
    const updates = buildClienteEnrichmentUpdate({
      cnpj: "//--..",
      razao_social: null,
      endereco: null,
    });
    expect(updates).not.toHaveProperty("cpf_cnpj");
  });

  it("mapeia razão social para nome e mantém endereço", () => {
    const updates = buildClienteEnrichmentUpdate({
      cnpj: "12345678000190",
      razao_social: "Construtora Alfa LTDA",
      endereco: "Rua X, 100",
    });
    expect(updates).toEqual({
      cpf_cnpj: "12345678000190",
      tipo_pessoa: "juridica",
      nome: "Construtora Alfa LTDA",
      endereco: "Rua X, 100",
    });
  });
});
