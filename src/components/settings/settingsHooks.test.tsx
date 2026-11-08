import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createSupabaseFrom, findCall, type ChainQuery, type ChainResult } from "@/test/supabaseChain";
import { useUsoEquipe } from "./useUsoEquipe";
import { useUsoEmpresa } from "./useUsoEmpresa";
import { useSolicitarTokens } from "./useSolicitarTokens";
import { agentKeyLabel, useExtratoTokens } from "./useExtratoTokens";
import { useMeuUsoTokens } from "./useMeuUsoTokens";

const h = vi.hoisted(() => ({
  resolver: (() => ({})) as (q: ChainQuery) => ChainResult,
  rpc: vi.fn(),
  profile: { id: "u1", empresa_id: "e1" } as { id: string; empresa_id: string | null } | null,
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  reportInvokeError: vi.fn(),
  subscription: undefined as unknown,
  limites: undefined as unknown,
  sb: null as unknown as ReturnType<typeof createSupabaseFrom>,
}));

vi.mock("@/integrations/supabase/client", async () => {
  const { createSupabaseFrom: criar } = await import("@/test/supabaseChain");
  h.sb = criar((q) => h.resolver(q));
  return { supabase: { from: h.sb.from, rpc: h.rpc } };
});
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ profile: h.profile }) }));
vi.mock("sonner", () => ({ toast: { success: h.toastSuccess, error: h.toastError } }));
vi.mock("@/lib/monitoring", () => ({ reportInvokeError: h.reportInvokeError }));
vi.mock("@/pages/billing/hooks/useMySubscription", () => ({ useMySubscription: () => ({ data: h.subscription }) }));
vi.mock("@/hooks/useNivelConfianca", () => ({ useNivelConfianca: () => ({ limites: h.limites }) }));

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
  h.sb.calls.length = 0;
  h.profile = { id: "u1", empresa_id: "e1" };
  h.resolver = () => ({});
  h.rpc.mockResolvedValue({ error: null });
  h.subscription = undefined;
  h.limites = undefined;
});

describe("useUsoEquipe", () => {
  it("mapeia membros e solicitações com nomes dos perfis", async () => {
    h.resolver = (q) => {
      if (q.table === "v_uso_tokens_usuario_ciclo")
        return {
          data: [
            {
              user_id: "a",
              user_nome: "Ana",
              role: "admin",
              tokens_ciclo: 100,
              limite_mensal: 5000,
              solicitacao_pendente: true,
            },
            { user_id: "b", user_nome: null, role: null, tokens_ciclo: null, limite_mensal: null },
            { user_id: null, user_nome: "fantasma" },
          ],
        };
      if (q.table === "ai_token_solicitacao")
        return {
          data: [
            { id: "s1", user_id: "a", mensagem: "mais", limite_sugerido: 10000, created_at: "2026-11-01" },
            { id: "s2", user_id: "z", mensagem: null, limite_sugerido: null, created_at: "2026-11-02" },
          ],
        };
      if (q.table === "profiles") return { data: [{ id: "a", first_name: "Ana", last_name: "Seed" }] };
      return {};
    };
    const { result } = renderHook(() => useUsoEquipe(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.membros).toHaveLength(2));
    expect(result.current.membros[1]).toEqual({
      userId: "b",
      nome: "(sem nome)",
      role: null,
      tokensCiclo: 0,
      limiteMensal: null,
      solicitacaoPendente: false,
    });
    await waitFor(() => expect(result.current.solicitacoes).toHaveLength(2));
    expect(result.current.solicitacoes.map((s) => s.nome)).toEqual(["Ana Seed", "(sem nome)"]);
    expect(findCall(h.sb.calls, "profiles")?.filters).toContainEqual(["in", "id", ["a", "z"]]);
  });

  it("sem solicitações não busca perfis; dados nulos viram listas vazias", async () => {
    h.resolver = () => ({ data: null });
    const { result } = renderHook(() => useUsoEquipe(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isLoadingSolicitacoes).toBe(false));
    expect(result.current.membros).toEqual([]);
    expect(result.current.solicitacoes).toEqual([]);
    expect(findCall(h.sb.calls, "profiles")).toBeUndefined();
  });

  it("erros das consultas são expostos", async () => {
    h.resolver = (q) =>
      q.table === "profiles"
        ? { error: new Error("perfis") }
        : q.table === "ai_token_solicitacao"
          ? { data: [{ id: "s", user_id: "a" }] }
          : { error: new Error("membros") };
    const { result } = renderHook(() => useUsoEquipe(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.errorMembros?.message).toBe("membros"));
    await waitFor(() => expect(result.current.isLoadingSolicitacoes).toBe(false));
    expect(result.current.solicitacoes).toEqual([]);
  });

  it("erro em ai_token_solicitacao também é exposto como lista vazia", async () => {
    h.resolver = (q) => (q.table === "ai_token_solicitacao" ? { error: new Error("x") } : { data: [] });
    const { result } = renderHook(() => useUsoEquipe(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isLoadingSolicitacoes).toBe(false));
    expect(result.current.solicitacoes).toEqual([]);
  });

  it("sem empresa não consulta", () => {
    h.profile = null;
    renderHook(() => useUsoEquipe(), { wrapper: wrapper() });
    expect(h.sb.from).not.toHaveBeenCalled();
  });

  it("definir limite faz upsert; remover apaga a linha", async () => {
    const { result } = renderHook(() => useUsoEquipe(), { wrapper: wrapper() });
    await act(() => result.current.definirLimite.mutateAsync({ userId: "a", limiteMensal: 9000 }));
    const up = findCall(h.sb.calls, "ai_token_limite_usuario", "upsert");
    expect(up?.payload).toEqual({ empresa_id: "e1", user_id: "a", limite_mensal: 9000, criado_por: "u1" });
    expect(h.toastSuccess).toHaveBeenCalledWith("Limite de créditos atualizado");

    await act(() => result.current.definirLimite.mutateAsync({ userId: "a", limiteMensal: null }));
    const del = findCall(h.sb.calls, "ai_token_limite_usuario", "delete");
    expect(del?.filters).toEqual([
      ["eq", "empresa_id", "e1"],
      ["eq", "user_id", "a"],
    ]);
    expect(h.toastSuccess).toHaveBeenCalledWith("Limite removido");
  });

  it("erro ao salvar/remover limite reporta e avisa", async () => {
    h.resolver = (q) => (q.table === "ai_token_limite_usuario" ? { error: new Error("rls") } : {});
    const { result } = renderHook(() => useUsoEquipe(), { wrapper: wrapper() });
    await act(async () => {
      await result.current.definirLimite.mutateAsync({ userId: "a", limiteMensal: 1 }).catch(() => {});
      await result.current.definirLimite.mutateAsync({ userId: "a", limiteMensal: null }).catch(() => {});
    });
    expect(h.reportInvokeError).toHaveBeenCalledWith(expect.any(Error), "ai_token_limite_usuario:upsert");
    expect(h.toastError).toHaveBeenCalledTimes(2);
  });

  it("resolver solicitação chama a RPC e trata erro", async () => {
    const { result } = renderHook(() => useUsoEquipe(), { wrapper: wrapper() });
    await act(() => result.current.resolverSolicitacao.mutateAsync({ solicitacaoId: "s1", aprovar: true }));
    expect(h.rpc).toHaveBeenCalledWith("resolver_solicitacao_tokens", {
      p_solicitacao_id: "s1",
      p_aprovar: true,
      p_novo_limite: undefined,
    });
    expect(h.toastSuccess).toHaveBeenCalledWith("Pedido aprovado");
    await act(() =>
      result.current.resolverSolicitacao.mutateAsync({ solicitacaoId: "s1", aprovar: false, novoLimite: 5 })
    );
    expect(h.toastSuccess).toHaveBeenCalledWith("Pedido recusado");

    h.rpc.mockResolvedValue({ error: new Error("já resolvido") });
    await act(() =>
      result.current.resolverSolicitacao.mutateAsync({ solicitacaoId: "s1", aprovar: true }).catch(() => {})
    );
    expect(h.reportInvokeError).toHaveBeenCalledWith(expect.any(Error), "resolver_solicitacao_tokens");
    expect(h.toastError).toHaveBeenCalledWith("Não foi possível responder o pedido", expect.any(Object));
  });
});

describe("useUsoEmpresa", () => {
  it("conta recursos ativos e junta tetos do plano", async () => {
    h.subscription = { plan: { max_usuarios: 10, nome: "Escritório" } };
    h.limites = { maxProjetos: 20, maxObras: 5, maxLeads: 50 };
    h.resolver = (q) => {
      if (q.table === "ai_token_saldo") return { data: { saldo_plano: 1000, saldo_comprado: 200 } };
      const counts: Record<string, number> = { projetos_safe: 3, obras: 1, leads: 7, profiles: 4 };
      return { count: counts[q.table] };
    };
    const { result } = renderHook(() => useUsoEmpresa(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.uso).toEqual({
      projetosAtivos: 3,
      obrasAtivas: 1,
      leadsAtivos: 7,
      usuarios: 4,
      maxProjetos: 20,
      maxObras: 5,
      maxLeads: 50,
      maxUsuarios: 10,
      planoNome: "Escritório",
      tokensPlano: 1000,
      tokensComprado: 200,
    });
    expect(findCall(h.sb.calls, "projetos_safe")?.filters).toContainEqual([
      "not",
      "status",
      "in",
      '("Concluído","Cancelado")',
    ]);
  });

  it("sem dados nem plano cai em zeros e nulos", async () => {
    h.resolver = () => ({ count: null, data: null });
    const { result } = renderHook(() => useUsoEmpresa(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.uso).toMatchObject({
      projetosAtivos: 0,
      usuarios: 0,
      maxProjetos: null,
      maxUsuarios: null,
      planoNome: null,
      tokensPlano: 0,
      tokensComprado: 0,
    });
  });
});

describe("useSolicitarTokens", () => {
  it("envia o pedido e avisa", async () => {
    const { result } = renderHook(() => useSolicitarTokens(), { wrapper: wrapper() });
    await act(() => result.current.mutateAsync({ mensagem: "preciso", limiteSugerido: 100 }));
    expect(h.rpc).toHaveBeenCalledWith("solicitar_mais_tokens", { p_mensagem: "preciso", p_limite_sugerido: 100 });
    expect(h.toastSuccess).toHaveBeenCalledWith("Pedido enviado", expect.any(Object));
  });

  it("pedido duplicado reporta e avisa", async () => {
    h.rpc.mockResolvedValue({ error: new Error("duplicate") });
    const { result } = renderHook(() => useSolicitarTokens(), { wrapper: wrapper() });
    await act(() => result.current.mutateAsync({}).catch(() => {}));
    expect(h.reportInvokeError).toHaveBeenCalledWith(expect.any(Error), "solicitar_mais_tokens");
    expect(h.toastError).toHaveBeenCalledWith("Não foi possível enviar o pedido", expect.any(Object));
  });
});

describe("useExtratoTokens", () => {
  it("rótulos conhecidos e fallback", () => {
    expect(agentKeyLabel("ai_chat")).toBe("Chat de Agentes");
    expect(agentKeyLabel("novo_agente")).toBe("novo_agente");
  });

  it("mapeia eventos sem pedir custo", async () => {
    h.resolver = () => ({
      data: [{ id: "1", created_at: "2026-11-01", agent_key: "ai_chat", tokens_total: 500, user_nome: "Ana" }],
    });
    const { result } = renderHook(() => useExtratoTokens(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.eventos).toHaveLength(1));
    expect(result.current.eventos[0]).toEqual({
      id: "1",
      createdAt: "2026-11-01",
      agentKey: "ai_chat",
      tokensTotal: 500,
      userNome: "Ana",
    });
    expect(findCall(h.sb.calls, "v_extrato_tokens")?.columns).not.toContain("custo");
  });

  it("erro e dado nulo", async () => {
    h.resolver = () => ({ error: new Error("falhou") });
    const { result } = renderHook(() => useExtratoTokens(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.error?.message).toBe("falhou"));
    expect(result.current.eventos).toEqual([]);

    h.resolver = () => ({ data: null });
    const r2 = renderHook(() => useExtratoTokens(), { wrapper: wrapper() });
    await waitFor(() => expect(r2.result.current.isLoading).toBe(false));
    expect(r2.result.current.eventos).toEqual([]);
  });
});

describe("useMeuUsoTokens", () => {
  it("lê o próprio consumo e limite", async () => {
    h.resolver = () => ({ data: { tokens_ciclo: 42, limite_mensal: 100 } });
    const { result } = renderHook(() => useMeuUsoTokens(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.meuUso).toEqual({ tokensCiclo: 42, limiteMensal: 100 }));
    expect(findCall(h.sb.calls, "v_uso_tokens_usuario_ciclo")?.filters).toContainEqual(["eq", "user_id", "u1"]);
  });

  it("sem linha: zero e sem limite; erro mantém o padrão", async () => {
    h.resolver = () => ({ data: null });
    const { result } = renderHook(() => useMeuUsoTokens(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.meuUso).toEqual({ tokensCiclo: 0, limiteMensal: null });

    h.resolver = () => ({ error: new Error("x") });
    const r2 = renderHook(() => useMeuUsoTokens(), { wrapper: wrapper() });
    await waitFor(() => expect(r2.result.current.isLoading).toBe(false));
    expect(r2.result.current.meuUso).toEqual({ tokensCiclo: 0, limiteMensal: null });
  });
});
