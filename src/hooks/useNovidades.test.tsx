import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { supabaseFake } from "@/hooks/testing/supabaseFake";

vi.mock("@/integrations/supabase/client", async () => ({
  supabase: (await import("@/hooks/testing/supabaseFake")).supabaseFake.client,
}));
const h = vi.hoisted(() => ({ user: { id: "u1" } as { id: string } | null, veFinanceiro: true }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: h.user }) }));
const can = (modulo: string) => modulo !== "financeiro" || h.veFinanceiro;
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ can }) }));

import { buscarNovidades, useMarcarNovidadesVistas, useNovidades } from "./useNovidades";

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

const item = (id: string, impacto: string, modulo: string | null = null) => ({
  id,
  texto: `item ${id}`,
  impacto,
  modulo,
  voce_pediu: false,
});

const NOVIDADES = {
  visto_ate: null,
  releases: [
    {
      id: "r1",
      sha: "abc",
      titulo: "Semana 46",
      versao: null,
      publicada_em: "2026-11-11T12:00:00Z",
      nova: true,
      itens: [item("a", "fluxo", "financeiro"), item("b", "melhoria", "leads")],
    },
  ],
};

beforeEach(() => {
  supabaseFake.reset();
  h.user = { id: "u1" };
  h.veFinanceiro = true;
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
});

describe("buscarNovidades (SPEC 152)", () => {
  it("lê a resposta da RPC", async () => {
    supabaseFake.respondRpc("novidades_publicadas", { data: NOVIDADES });
    const r = await buscarNovidades();
    expect(r.releases).toHaveLength(1);
    expect(r.releases[0].itens.map((i) => i.id)).toEqual(["a", "b"]);
  });

  it("repassa o erro da RPC", async () => {
    supabaseFake.respondRpc("novidades_publicadas", { error: { message: "falhou" } });
    await expect(buscarNovidades()).rejects.toEqual({ message: "falhou" });
  });
});

describe("useNovidades", () => {
  it("não busca sem sessão", () => {
    h.user = null;
    const { result } = renderHook(() => useNovidades(), { wrapper });
    expect(result.current.releases).toEqual([]);
    expect(supabaseFake.rpcCalls).toHaveLength(0);
  });

  it("devolve as releases e só conta como pendente o que a pessoa pode ver", async () => {
    supabaseFake.respondRpc("novidades_publicadas", { data: NOVIDADES });
    const { result } = renderHook(() => useNovidades(), { wrapper });
    await waitFor(() => expect(result.current.releases).toHaveLength(1));
    expect(result.current.pendentes.comFluxo).toHaveLength(1);

    h.veFinanceiro = false;
    const sem = renderHook(() => useNovidades(), { wrapper });
    await waitFor(() => expect(sem.result.current.releases).toHaveLength(1));
    // O item de fluxo é do financeiro: sem permissão, nada abre o modal, mas a melhoria de leads acende o ponto.
    expect(sem.result.current.pendentes).toEqual({ comFluxo: [], temDestaque: true });
  });
});

describe("useMarcarNovidadesVistas", () => {
  it("chama a RPC e invalida as novidades", async () => {
    const invalidar = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useMarcarNovidadesVistas(), { wrapper });
    await result.current.mutateAsync();
    expect(supabaseFake.rpcCalls.map((c) => c.fn)).toContain("marcar_novidades_vistas");
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ["novidades"] });
  });

  it("propaga o erro", async () => {
    supabaseFake.respondRpc("marcar_novidades_vistas", { error: { message: "x" } });
    const { result } = renderHook(() => useMarcarNovidadesVistas(), { wrapper });
    await expect(result.current.mutateAsync()).rejects.toEqual({ message: "x" });
  });
});
