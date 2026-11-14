import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { ChainQuery, ChainResult } from "@/test/supabaseChain";

// Acessos ao portal (SPEC 164): vários por cliente, revogar um só.

const h = vi.hoisted(() => ({
  resolve: vi.fn<(q: ChainQuery) => ChainResult>(),
  calls: [] as ChainQuery[],
}));

vi.mock("@/integrations/supabase/client", async () => {
  const { createSupabaseFrom } = await import("@/test/supabaseChain");
  const chain = createSupabaseFrom((q) => h.resolve(q));
  h.calls = chain.calls;
  return { supabase: { from: chain.from } };
});

import { chaveAcessosPortal, linkDoPortal, revogarAcessoPortal, useAcessosPortal } from "./useAcessoPortal";

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

beforeEach(() => {
  vi.clearAllMocks();
  h.calls.length = 0;
});

describe("useAcessosPortal", () => {
  it("lista os acessos ativos do cliente: com senha é ativo, sem senha é convite pendente", async () => {
    h.resolve.mockReturnValue({
      data: [
        { id: "a1", email: "ana@x.com", nome: "Ana", senha_hash: "h", ultimo_acesso: "2026-11-10T10:00:00Z" },
        { id: "a2", email: "maria@x.com", nome: null, senha_hash: null, ultimo_acesso: null },
      ],
    });
    const { result } = renderHook(() => useAcessosPortal("c1"), { wrapper });
    await waitFor(() => expect(result.current.data).toHaveLength(2));
    expect(result.current.data).toEqual([
      { id: "a1", email: "ana@x.com", nome: "Ana", status: "ativo", ultimoAcesso: "2026-11-10T10:00:00Z" },
      { id: "a2", email: "maria@x.com", nome: null, status: "convite_pendente", ultimoAcesso: null },
    ]);
    const q = h.calls[0];
    expect(q.table).toBe("cliente_portal_accounts");
    expect(q.filters).toContainEqual(["eq", "cliente_id", "c1"]);
    expect(q.filters).toContainEqual(["eq", "ativo", true]);
  });

  it("sem cliente ou fechado não consulta; erro vira erro", async () => {
    renderHook(() => useAcessosPortal(undefined), { wrapper });
    renderHook(() => useAcessosPortal("c1", false), { wrapper });
    expect(h.calls).toHaveLength(0);
    h.resolve.mockReturnValue({ data: null, error: new Error("negado") });
    const { result } = renderHook(() => useAcessosPortal("c1"), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("revogarAcessoPortal", () => {
  it("desativa só o acesso escolhido", async () => {
    h.resolve.mockReturnValue({ error: null });
    await revogarAcessoPortal("a2");
    expect(h.calls[0]).toMatchObject({ table: "cliente_portal_accounts", op: "update", payload: { ativo: false } });
    expect(h.calls[0].filters).toContainEqual(["eq", "id", "a2"]);
  });

  it("propaga o erro", async () => {
    h.resolve.mockReturnValue({ error: new Error("negado") });
    await expect(revogarAcessoPortal("a2")).rejects.toThrow("negado");
  });
});

describe("utilitários", () => {
  it("link do portal e chave da consulta", () => {
    expect(linkDoPortal()).toBe(`${window.location.origin}/cliente/login`);
    expect(chaveAcessosPortal("c1")).toEqual(["portal-acesso", "c1"]);
  });
});
