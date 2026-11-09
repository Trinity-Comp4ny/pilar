import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { sb } from "../testing/supabaseMock";

// Dados auxiliares do formulário de lançamento: receita traz clientes (com
// chaves PIX); despesa traz fornecedores e cartões. Categorias filtradas pelo tipo.

vi.mock("@/integrations/supabase/client", async () => ({
  supabase: (await import("../testing/supabaseMock")).sb.client,
}));

import { useFinanceAuxData } from "./useFinanceAuxData";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  sb.reset();
  sb.resultado("categorias_financeiras.select", { data: [{ id: "cat", nome: "Honorários" }], error: null });
  sb.resultado("projetos.select", { data: [{ id: "p1", nome: "Casa", cliente_id: "cl1" }], error: null });
  sb.resultado("contas.select", { data: [{ id: "ct", nome: "Itaú" }], error: null });
  sb.resultado("centros_custo.select", { data: [{ id: "cc", nome: "ADM", codigo: null }], error: null });
  sb.resultado("clientes.select", {
    data: [
      { id: "cl1", nome: "Alfa", chaves_pix: [{ chave: "a@b.com", tipo: "email" }] },
      { id: "cl2", nome: "Beta", chaves_pix: null },
    ],
    error: null,
  });
  sb.resultado("fornecedores.select", { data: [{ id: "f1", nome: "Votoran" }], error: null });
  sb.resultado("cartoes.select", { data: [{ id: "k1", nome: "Visa", tipo: "credito" }], error: null });
});

describe("useFinanceAuxData", () => {
  it("receita: categorias de receita e clientes com chaves PIX; sem fornecedores/cartões", async () => {
    const { result } = renderHook(() => useFinanceAuxData("receita"), { wrapper });
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(sb.de("categorias_financeiras", "eq")[0].args).toEqual(["tipo", "Receita"]);
    expect(result.current.clientes).toEqual([
      { id: "cl1", nome: "Alfa", chaves_pix: [{ chave: "a@b.com", tipo: "email" }] },
      { id: "cl2", nome: "Beta", chaves_pix: [] },
    ]);
    expect(result.current.projetos).toEqual([{ id: "p1", nome: "Casa", cliente_id: "cl1" }]);
    expect(result.current.centrosCusto).toEqual([{ id: "cc", nome: "ADM", codigo: null }]);
    expect(result.current.fornecedores).toEqual([]);
    expect(result.current.cartoes).toEqual([]);
    expect(sb.client.from).not.toHaveBeenCalledWith("fornecedores");
  });

  it("despesa: fornecedores e cartões; sem clientes; centros de custo só ativos", async () => {
    const { result } = renderHook(() => useFinanceAuxData("despesa"), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(sb.de("categorias_financeiras", "eq")[0].args).toEqual(["tipo", "Despesa"]);
    expect(sb.de("centros_custo", "eq")[0].args).toEqual(["ativo", true]);
    expect(result.current.fornecedores).toEqual([{ id: "f1", nome: "Votoran" }]);
    expect(result.current.cartoes).toEqual([{ id: "k1", nome: "Visa", tipo: "credito" }]);
    expect(result.current.contas).toEqual([{ id: "ct", nome: "Itaú" }]);
    expect(result.current.clientes).toEqual([]);
  });

  it("tabelas com erro viram listas vazias", async () => {
    sb.resultado("cartoes.select", { data: null, error: { message: "permission denied" } });
    sb.resultado("contas.select", { data: null, error: { message: "permission denied" } });
    const { result } = renderHook(() => useFinanceAuxData("despesa"), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.cartoes).toEqual([]);
    expect(result.current.contas).toEqual([]);
    expect(result.current.fornecedores).toHaveLength(1);
  });
});
