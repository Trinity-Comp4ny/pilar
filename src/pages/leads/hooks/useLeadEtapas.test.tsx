import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const order = vi.fn();
const insert = vi.fn();
const eq = vi.fn();
const update = vi.fn(() => ({ eq }));
const del = vi.fn(() => ({ eq }));
const select = vi.fn(() => ({ order }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: vi.fn(() => ({ select, insert, update, delete: del })) },
}));

let empresaId: string | null = "emp-1";
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ profile: empresaId ? { empresa_id: empresaId } : null }),
}));

import { useLeadEtapaMutations, useLeadEtapas } from "./useLeadEtapas";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useLeadEtapas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    empresaId = "emp-1";
    eq.mockResolvedValue({ error: null });
    insert.mockResolvedValue({ error: null });
  });

  it("lista as colunas da empresa em ordem", async () => {
    order.mockResolvedValue({
      data: [{ id: "a", nome: "Novo", ordem: 0, cor: "#3b82f6", bucket: "Novo" }],
      error: null,
    });
    const { result } = renderHook(() => useLeadEtapas(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(order).toHaveBeenCalledWith("ordem", { ascending: true });
    expect(result.current.data).toEqual([{ id: "a", nome: "Novo", ordem: 0, cor: "#3b82f6", bucket: "Novo" }]);
  });

  it("propaga o erro da consulta", async () => {
    order.mockResolvedValue({ data: null, error: new Error("falhou") });
    const { result } = renderHook(() => useLeadEtapas(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useLeadEtapaMutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    empresaId = "emp-1";
    eq.mockResolvedValue({ error: null });
    insert.mockResolvedValue({ error: null });
  });

  it("cria a coluna na empresa do perfil", async () => {
    const { result } = renderHook(() => useLeadEtapaMutations(), { wrapper });
    await result.current.criar.mutateAsync({ nome: "Visita", ordem: 6, cor: "#14b8a6", bucket: "Em contato" });
    expect(insert).toHaveBeenCalledWith({
      empresa_id: "emp-1",
      nome: "Visita",
      ordem: 6,
      cor: "#14b8a6",
      bucket: "Em contato",
    });
  });

  it("não cria sem empresa no perfil", async () => {
    empresaId = null;
    const { result } = renderHook(() => useLeadEtapaMutations(), { wrapper });
    await expect(result.current.criar.mutateAsync({ nome: "X", ordem: 0, bucket: "Novo" })).rejects.toThrow(
      "Sem empresa no perfil"
    );
    expect(insert).not.toHaveBeenCalled();
  });

  it("edita só nome e cor", async () => {
    const { result } = renderHook(() => useLeadEtapaMutations(), { wrapper });
    await result.current.editar.mutateAsync({ id: "a", nome: "Novo nome", cor: "#fff" });
    expect(update).toHaveBeenCalledWith({ nome: "Novo nome", cor: "#fff" });
    expect(eq).toHaveBeenCalledWith("id", "a");
  });

  it("reordena gravando a ordem de cada coluna", async () => {
    const { result } = renderHook(() => useLeadEtapaMutations(), { wrapper });
    await result.current.reordenar.mutateAsync([
      { id: "a", ordem: 1 },
      { id: "b", ordem: 0 },
    ]);
    expect(update).toHaveBeenNthCalledWith(1, { ordem: 1 });
    expect(update).toHaveBeenNthCalledWith(2, { ordem: 0 });
  });

  it("exclui pelo id e propaga o erro do banco", async () => {
    const { result } = renderHook(() => useLeadEtapaMutations(), { wrapper });
    await result.current.excluir.mutateAsync("a");
    expect(del).toHaveBeenCalled();

    eq.mockResolvedValue({ error: { code: "23503", message: "Mova os leads desta coluna." } });
    await expect(result.current.excluir.mutateAsync("a")).rejects.toMatchObject({ code: "23503" });
  });
});
