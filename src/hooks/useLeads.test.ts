import { describe, it, expect, vi } from "vitest";

// Mock supabase antes de importar o módulo (evita throw de env no jsdom)
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { buildClienteEnrichmentUpdate } from "./useLeads";

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
    expect(updates).toEqual({ cpf_cnpj: "12345678000190" });
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
      nome: "Construtora Alfa LTDA",
      endereco: "Rua X, 100",
    });
  });
});
