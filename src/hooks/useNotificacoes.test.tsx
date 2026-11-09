import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { supabaseFake } from "@/hooks/testing/supabaseFake";

const canal = { on: vi.fn(), subscribe: vi.fn() };
const channel = vi.fn(() => canal);
const removeChannel = vi.fn();

vi.mock("@/integrations/supabase/client", async () => {
  const { supabaseFake: fake } = await import("@/hooks/testing/supabaseFake");
  return {
    supabase: {
      ...fake.client,
      channel: (...a: unknown[]) => channel(...(a as [])),
      removeChannel: (...a: unknown[]) => removeChannel(...a),
    },
  };
});

let mockUser: { id: string } | null = { id: "u1" };
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: mockUser }) }));

import {
  useNotificacoes,
  useNotificacoesNaoLidas,
  useNotificacoesRealtime,
  useMarcarLida,
  useMarcarTodasLidas,
  useArquivar,
  useArquivarTodas,
} from "./useNotificacoes";

type MutacaoGenerica = { mutateAsync: (a: unknown) => Promise<unknown> };

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);
const ERRO = { message: "permission denied", code: "42501" };

beforeEach(() => {
  vi.clearAllMocks();
  canal.on.mockReturnValue(canal);
  canal.subscribe.mockReturnValue(canal);
  supabaseFake.reset();
  mockUser = { id: "u1" };
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
});

describe("useNotificacoes", () => {
  it("inbox: só não arquivadas, sem filtro de categoria", async () => {
    supabaseFake.respond("notificacoes", "select", { data: [{ id: "n1" }] });
    const { result } = renderHook(() => useNotificacoes(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([{ id: "n1" }]);
    const chain = supabaseFake.calls[0].chain;
    expect(chain).toContainEqual(["is", ["arquivada_em", null]]);
    expect(chain).toContainEqual(["limit", [50]]);
    expect(chain.some(([m]) => m === "eq")).toBe(false);
  });

  it("arquivadas com categoria comum: filtra no banco", async () => {
    const { result } = renderHook(() => useNotificacoes("archive", 10, { categoria: "financeiro", tipo: null }), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const chain = supabaseFake.calls[0].chain;
    expect(chain).toContainEqual(["not", ["arquivada_em", "is", null]]);
    expect(chain).toContainEqual(["eq", ["categoria", "financeiro"]]);
    expect(chain.some(([m]) => m === "filter")).toBe(false);
  });

  it("categoria sistema com tipo aplica as condições do tipo", async () => {
    const { result } = renderHook(() => useNotificacoes("inbox", 50, { categoria: "sistema", tipo: "problema" }), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const chain = supabaseFake.calls[0].chain;
    expect(chain).toContainEqual(["filter", ["tipo", "eq", "feedback_recebido"]]);
  });

  it("data nula vira lista vazia", async () => {
    supabaseFake.respond("notificacoes", "select", { data: null });
    const { result } = renderHook(() => useNotificacoes(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });

  it("propaga erro", async () => {
    supabaseFake.respond("notificacoes", "select", { error: ERRO });
    const { result } = renderHook(() => useNotificacoes(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useNotificacoesNaoLidas", () => {
  it("conta por categoria e por tipo do portal", async () => {
    supabaseFake.respond("notificacoes", "select", {
      data: [
        { categoria: "tarefa", tipo: "x", titulo: "a" },
        { categoria: "tarefa", tipo: "x", titulo: "b" },
        { categoria: "sistema", tipo: "outro", titulo: "c" },
        { categoria: "sistema", tipo: "outro", titulo: "d" },
      ],
    });
    const { result } = renderHook(() => useNotificacoesNaoLidas(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.total).toBe(4);
    expect(result.current.data?.porCategoria).toMatchObject({ tarefa: 2, sistema: 2 });
    const tipos = Object.values(result.current.data?.porTipoPortal ?? {});
    expect(tipos.reduce((a, b) => a + (b ?? 0), 0)).toBe(2);
  });

  it("sem dados: tudo zero", async () => {
    supabaseFake.respond("notificacoes", "select", { data: null });
    const { result } = renderHook(() => useNotificacoesNaoLidas(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ total: 0, porCategoria: {}, porTipoPortal: {} });
  });

  it("propaga erro", async () => {
    supabaseFake.respond("notificacoes", "select", { error: ERRO });
    const { result } = renderHook(() => useNotificacoesNaoLidas(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useNotificacoesRealtime", () => {
  it("sem usuário não assina", () => {
    mockUser = null;
    renderHook(() => useNotificacoesRealtime(), { wrapper });
    expect(channel).not.toHaveBeenCalled();
  });

  it("assina pelo destinatário, invalida no evento e remove o canal ao desmontar", () => {
    const spy = vi.spyOn(client, "invalidateQueries");
    const { unmount } = renderHook(() => useNotificacoesRealtime(), { wrapper });
    expect(channel).toHaveBeenCalledWith("notificacoes-feed");
    const [evento, opts, handler] = canal.on.mock.calls[0];
    expect(evento).toBe("postgres_changes");
    expect(opts).toMatchObject({ table: "notificacoes", filter: "destinatario_id=eq.u1" });
    handler();
    expect(spy).toHaveBeenCalledWith({ queryKey: ["notificacoes"] });
    expect(spy).toHaveBeenCalledWith({ queryKey: ["notificacoes-nao-lidas"] });
    unmount();
    expect(removeChannel).toHaveBeenCalledWith(canal);
  });
});

describe("mutações", () => {
  it("marcar lida: só a não lida, por id", async () => {
    const spy = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useMarcarLida(), { wrapper });
    await act(() => result.current.mutateAsync("n1"));
    const call = supabaseFake.callsTo("notificacoes", "update")[0];
    expect(call.payload).toHaveProperty("lido_em");
    expect(call.chain).toContainEqual(["eq", ["id", "n1"]]);
    expect(call.chain).toContainEqual(["is", ["lido_em", null]]);
    expect(spy).toHaveBeenCalledWith({ queryKey: ["notificacoes-nao-lidas"] });
  });

  it("marcar todas lidas: sem filtro e com filtro", async () => {
    const { result } = renderHook(() => useMarcarTodasLidas(), { wrapper });
    await act(() => result.current.mutateAsync(undefined as never));
    await act(() => result.current.mutateAsync({ categoria: "obra", tipo: null }));
    const [semFiltro, comFiltro] = supabaseFake.callsTo("notificacoes", "update");
    expect(semFiltro.chain.some(([m]) => m === "eq")).toBe(false);
    expect(comFiltro.chain).toContainEqual(["eq", ["categoria", "obra"]]);
  });

  it("arquivar: só a não arquivada", async () => {
    const { result } = renderHook(() => useArquivar(), { wrapper });
    await act(() => result.current.mutateAsync("n2"));
    const call = supabaseFake.callsTo("notificacoes", "update")[0];
    expect(call.payload).toHaveProperty("arquivada_em");
    expect(call.chain).toContainEqual(["is", ["arquivada_em", null]]);
  });

  it("arquivar todas com filtro de sistema", async () => {
    const { result } = renderHook(() => useArquivarTodas(), { wrapper });
    await act(() => result.current.mutateAsync({ categoria: "sistema", tipo: "sugestao" }));
    await act(() => result.current.mutateAsync(undefined as never));
    const call = supabaseFake.callsTo("notificacoes", "update")[0];
    expect(call.chain).toContainEqual(["eq", ["categoria", "sistema"]]);
    expect(call.chain.some(([m]) => m === "filter")).toBe(true);
  });

  it.each([
    ["useMarcarLida", () => useMarcarLida(), "n1"],
    ["useMarcarTodasLidas", () => useMarcarTodasLidas(), undefined],
    ["useArquivar", () => useArquivar(), "n1"],
    ["useArquivarTodas", () => useArquivarTodas(), undefined],
  ] as const)("%s propaga erro sem invalidar", async (_nome, hook, arg) => {
    supabaseFake.respond("notificacoes", "update", { error: ERRO });
    const spy = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => hook() as unknown as MutacaoGenerica, { wrapper });
    await expect(result.current.mutateAsync(arg)).rejects.toEqual(ERRO);
    expect(spy).not.toHaveBeenCalled();
  });
});
