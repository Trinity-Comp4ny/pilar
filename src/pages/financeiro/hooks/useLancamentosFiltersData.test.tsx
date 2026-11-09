import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { sb } from "../testing/supabaseMock";

// Opções dos filtros de Lançamentos: categorias, projetos ativos, clientes e
// fornecedores, carregados uma vez. Tabela com erro vira lista vazia.

vi.mock("@/integrations/supabase/client", async () => ({
  supabase: (await import("../testing/supabaseMock")).sb.client,
}));

import { FORMAS_PAGAMENTO, useLancamentosFiltersData } from "./useLancamentosFiltersData";

beforeEach(() => {
  sb.reset();
});

describe("useLancamentosFiltersData", () => {
  it("carrega as quatro listas, só com id/nome (e tipo da categoria)", async () => {
    sb.resultado("categorias_financeiras.select", {
      data: [{ id: "c1", nome: "Material", tipo: "Despesa", extra: 1 }],
      error: null,
    });
    sb.resultado("projetos.select", { data: [{ id: "p1", nome: "Casa Verde", cliente_id: "x" }], error: null });
    sb.resultado("clientes.select", { data: [{ id: "cl1", nome: "Alfa" }], error: null });
    sb.resultado("fornecedores.select", { data: [{ id: "f1", nome: "Votoran" }], error: null });

    const { result } = renderHook(() => useLancamentosFiltersData());
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.categorias).toEqual([{ id: "c1", nome: "Material", tipo: "Despesa" }]);
    expect(result.current.projetos).toEqual([{ id: "p1", nome: "Casa Verde" }]);
    expect(result.current.clientes).toEqual([{ id: "cl1", nome: "Alfa" }]);
    expect(result.current.fornecedores).toEqual([{ id: "f1", nome: "Votoran" }]);
    expect(sb.de("projetos", "is")[0].args).toEqual(["deleted_at", null]);
  });

  it("tabela com erro (sem permissão) fica vazia sem derrubar as outras", async () => {
    sb.resultado("categorias_financeiras.select", {
      data: [{ id: "c1", nome: "Material", tipo: "Despesa" }],
      error: null,
    });
    sb.resultado("fornecedores.select", { data: null, error: { message: "permission denied" } });
    const { result } = renderHook(() => useLancamentosFiltersData());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.fornecedores).toEqual([]);
    expect(result.current.categorias).toHaveLength(1);
  });

  it("desmontar antes da resposta não atualiza estado", async () => {
    sb.resultado("clientes.select", { data: [{ id: "cl1", nome: "Alfa" }], error: null });
    const { result, unmount } = renderHook(() => useLancamentosFiltersData());
    unmount();
    await new Promise((r) => setTimeout(r, 0));
    expect(result.current.clientes).toEqual([]);
  });

  it("formas de pagamento fixas incluem PIX e cartões", () => {
    expect(FORMAS_PAGAMENTO).toContain("PIX");
    expect(FORMAS_PAGAMENTO).toContain("Cartão de Crédito");
  });
});
