import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  empresa: { data: { modulos_ocultos: ["obras", "xpto"] } as unknown, error: null as unknown },
  pessoas: { data: [] as unknown[], error: null as unknown },
  rpc: vi.fn(),
  refreshProfile: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (tabela: string) => {
      const res = tabela === "empresas" ? h.empresa : h.pessoas;
      const chain: Record<string, unknown> = {};
      for (const m of ["select", "eq", "is", "order"]) chain[m] = () => chain;
      chain.single = () => Promise.resolve(res);
      chain.then = (ok: (v: unknown) => unknown) => Promise.resolve(res).then(ok);
      return chain;
    },
    rpc: (...args: unknown[]) => h.rpc(...args),
  },
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ refreshProfile: h.refreshProfile }) }));

import { useModulosOcultos, useSetModulosOcultos } from "./useModulosOcultos";

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe("useModulosOcultos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.empresa = { data: { modulos_ocultos: ["obras", "xpto"] }, error: null };
    h.pessoas = {
      data: [
        {
          id: "u1",
          first_name: "João",
          last_name: "Silva",
          email: "j@x.com",
          role: "user",
          modulos_ocultos: ["gestao"],
        },
        { id: "u2", first_name: null, last_name: null, email: "s@x.com", role: "coordenador", modulos_ocultos: null },
      ],
      error: null,
    };
    h.rpc.mockResolvedValue({ error: null });
  });

  it("não busca sem empresa", () => {
    const { result } = renderHook(() => useModulosOcultos(null), { wrapper: wrapper() });
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("normaliza a lista da empresa e monta o nome das pessoas", async () => {
    const { result } = renderHook(() => useModulosOcultos("emp1"), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.empresa).toEqual(["obras"]);
    expect(result.current.data?.pessoas.map((p) => p.nome)).toEqual(["João Silva", "s@x.com"]);
    expect(result.current.data?.pessoas[0].ocultos).toEqual(["gestao"]);
    expect(result.current.data?.pessoas[1].ocultos).toEqual([]);
  });

  it("propaga erro da consulta", async () => {
    h.empresa = { data: null, error: new Error("falhou") };
    const { result } = renderHook(() => useModulosOcultos("emp1"), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("propaga erro da consulta de pessoas", async () => {
    h.pessoas = { data: [], error: new Error("falhou") };
    const { result } = renderHook(() => useModulosOcultos("emp1"), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useSetModulosOcultos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.rpc.mockResolvedValue({ error: null });
  });

  it("grava para um usuário e atualiza o perfil", async () => {
    const { result } = renderHook(() => useSetModulosOcultos("emp1"), { wrapper: wrapper() });
    await act(async () => {
      await result.current.mutateAsync({ alvo: { alvo: "usuario", usuarioId: "u1" }, modulos: ["obras"] });
    });
    expect(h.rpc).toHaveBeenCalledWith("set_modulos_ocultos", {
      p_alvo: "usuario",
      p_usuario_id: "u1",
      p_modulos: ["obras"],
    });
    expect(h.refreshProfile).toHaveBeenCalled();
  });

  it("grava para a empresa com o uuid nulo", async () => {
    const { result } = renderHook(() => useSetModulosOcultos("emp1"), { wrapper: wrapper() });
    await act(async () => {
      await result.current.mutateAsync({ alvo: { alvo: "empresa" }, modulos: [] });
    });
    expect(h.rpc).toHaveBeenCalledWith("set_modulos_ocultos", {
      p_alvo: "empresa",
      p_usuario_id: "00000000-0000-0000-0000-000000000000",
      p_modulos: [],
    });
  });

  it("repassa o erro da RPC", async () => {
    h.rpc.mockResolvedValue({ error: new Error("negado") });
    const { result } = renderHook(() => useSetModulosOcultos("emp1"), { wrapper: wrapper() });
    await expect(act(() => result.current.mutateAsync({ alvo: { alvo: "empresa" }, modulos: [] }))).rejects.toThrow(
      "negado"
    );
    expect(h.refreshProfile).not.toHaveBeenCalled();
  });
});
