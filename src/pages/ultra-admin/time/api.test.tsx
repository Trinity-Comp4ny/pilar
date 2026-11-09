import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createSupabaseFrom, type ChainQuery, type ChainResult } from "@/test/supabaseChain";

// Time de agentes (SPEC 126): jsonb validado na entrada (briefing/rascunho fora do schema
// viram null, receita fora do schema falha), última execução por agente, efeitos medidos e
// as mutações (decidir, pausar, rodar) com aviso e recarga.

const h = vi.hoisted(() => ({
  resolve: (() => ({ data: [] })) as (q: ChainQuery) => ChainResult,
  rpc: vi.fn(),
  invoke: vi.fn(),
}));
const chain = vi.hoisted(() => ({ from: null as unknown as ReturnType<typeof createSupabaseFrom> }));

vi.mock("@/integrations/supabase/client", async () => {
  const { createSupabaseFrom } = await import("@/test/supabaseChain");
  chain.from = createSupabaseFrom((q) => h.resolve(q));
  return { supabase: { from: chain.from.from, rpc: h.rpc, functions: { invoke: h.invoke } } };
});
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

import {
  buscarReceita,
  buscarSaude,
  decidirAcao,
  definirAgenteAtivo,
  listarAcoesPendentes,
  listarAgentes,
  listarEfeitosDoAgente,
  listarExecucoesDoAgente,
  listarUltimasExecucoes,
  rodarAgente,
} from "./api";
import {
  useAcoesPendentes,
  useAgentes,
  useDecidirAcao,
  useDefinirAgenteAtivo,
  useEfeitosDoAgente,
  useExecucoesDoAgente,
  useReceita,
  useRodarAgente,
  useSaudeEmpresas,
  useUltimasExecucoes,
} from "./hooks";

const RECEITA_OK = {
  dias: "30",
  gerado_em: "2026-11-01T00:00:00Z",
  cadastros: 5,
  cadastros_anterior: 3,
  ativados: 2,
  ativados_anterior: 1,
  novos_pagantes: 1,
  novos_pagantes_anterior: 0,
  pagantes: 4,
  mrr: "1600.50",
  em_teste: 3,
  checkout_pendente: 0,
  testes_vencendo: [
    {
      empresa_id: "e1",
      empresa_nome: "Alfa",
      vence_em: "2026-11-10",
      projetos: 2,
      contato_nome: null,
      contato_telefone: "11999990000",
    },
  ],
  em_atraso: [{ empresa_id: "e2", empresa_nome: "Beta", desde: null, contato_nome: "Bia", contato_telefone: null }],
  por_origem: [{ fonte: "google", campanha: "lp", cadastros: 3, ativados: 1, pagantes: 1 }],
};

const exec = (id: string, agente: string, briefing: unknown = null) => ({
  id,
  agente_id: agente,
  gatilho: "cron",
  inicio: "i",
  fim: null,
  status: "ok",
  custo_usd: 0.01,
  erro: null,
  briefing,
});

function setup() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return { qc, wrapper };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.resolve = () => ({ data: [] });
  h.rpc.mockResolvedValue({ data: null, error: null });
  h.invoke.mockResolvedValue({ data: null, error: null });
  chain.from.calls.length = 0;
});

describe("api do Time", () => {
  it("buscarReceita converte números em texto e valida o shape", async () => {
    h.rpc.mockResolvedValue({ data: RECEITA_OK, error: null });
    const r = await buscarReceita(30);
    expect(h.rpc).toHaveBeenCalledWith("ops_receita", { p_dias: 30 });
    expect(r.dias).toBe(30);
    expect(r.mrr).toBe(1600.5);
    expect(r.testes_vencendo[0].contato_telefone).toBe("11999990000");
  });

  it("buscarReceita falha quando a RPC muda de shape ou dá erro", async () => {
    h.rpc.mockResolvedValue({ data: { ...RECEITA_OK, em_atraso: undefined }, error: null });
    await expect(buscarReceita(7)).rejects.toThrow();
    h.rpc.mockResolvedValue({ data: null, error: new Error("mfa") });
    await expect(buscarReceita(7)).rejects.toThrow("mfa");
  });

  it("buscarSaude devolve lista (vazia quando null) e propaga erro", async () => {
    h.rpc.mockResolvedValue({ data: null, error: null });
    await expect(buscarSaude()).resolves.toEqual([]);
    h.rpc.mockResolvedValue({ data: [{ empresa_id: "e1" }], error: null });
    await expect(buscarSaude()).resolves.toHaveLength(1);
    h.rpc.mockResolvedValue({ data: null, error: new Error("x") });
    await expect(buscarSaude()).rejects.toThrow("x");
  });

  it("listarAgentes ordena por ordem e propaga erro", async () => {
    h.resolve = () => ({ data: [{ id: "a1" }] });
    await expect(listarAgentes()).resolves.toEqual([{ id: "a1" }]);
    expect(chain.from.calls[0].filters).toContainEqual(["order", "ordem"]);
    h.resolve = () => ({ data: null });
    await expect(listarAgentes()).resolves.toEqual([]);
    h.resolve = () => ({ error: new Error("rls") });
    await expect(listarAgentes()).rejects.toThrow("rls");
  });

  it("listarAcoesPendentes valida o rascunho: inválido vira null", async () => {
    h.resolve = () => ({
      data: [
        { id: "x1", agente_id: "a1", rascunho: { canal: "whatsapp", texto: "Oi", telefone: null } },
        { id: "x2", agente_id: "a1", rascunho: { canal: "email", texto: "?" } },
        { id: "x3", agente_id: "a2", rascunho: null },
      ],
    });
    const acoes = await listarAcoesPendentes();
    expect(acoes[0].rascunho).toEqual({ canal: "whatsapp", texto: "Oi", telefone: null });
    expect(acoes[1].rascunho).toBeNull();
    expect(acoes[2].rascunho).toBeNull();
    expect(chain.from.calls[0].filters).toContainEqual(["eq", "status", "pendente"]);
    h.resolve = () => ({ error: new Error("x") });
    await expect(listarAcoesPendentes()).rejects.toThrow("x");
  });

  it("listarUltimasExecucoes guarda só a mais recente de cada agente e valida o briefing", async () => {
    h.resolve = () => ({
      data: [
        exec("e3", "a1", { fonte: "modelo", resumo: "Tudo certo" }),
        exec("e2", "a2", { fonte: "outra", resumo: 1 }),
        exec("e1", "a1", { fonte: "regra", resumo: "Velho", destaques: [] }),
      ],
    });
    const m = await listarUltimasExecucoes();
    expect([...m.keys()]).toEqual(["a1", "a2"]);
    expect(m.get("a1")!.id).toBe("e3");
    expect(m.get("a1")!.briefing).toEqual({ fonte: "modelo", resumo: "Tudo certo", destaques: [] });
    expect(m.get("a2")!.briefing).toBeNull();
    h.resolve = () => ({ data: null });
    expect((await listarUltimasExecucoes()).size).toBe(0);
    h.resolve = () => ({ error: new Error("x") });
    await expect(listarUltimasExecucoes()).rejects.toThrow("x");
  });

  it("listarExecucoesDoAgente filtra pelo agente e pelos últimos 30 dias", async () => {
    h.resolve = () => ({ data: [exec("e1", "a1")] });
    const lista = await listarExecucoesDoAgente("a1");
    expect(lista).toHaveLength(1);
    const f = chain.from.calls[0].filters;
    expect(f).toContainEqual(["eq", "agente_id", "a1"]);
    const desde = f.find((x) => x[0] === "gte")![2] as string;
    const dias = (Date.now() - new Date(desde).getTime()) / 86_400_000;
    expect(Math.round(dias)).toBe(30);
    h.resolve = () => ({ data: null });
    await expect(listarExecucoesDoAgente("a1")).resolves.toEqual([]);
    h.resolve = () => ({ error: new Error("x") });
    await expect(listarExecucoesDoAgente("a1")).rejects.toThrow("x");
  });

  it("listarEfeitosDoAgente só devolve efeitos em texto", async () => {
    h.resolve = () => ({
      data: [{ resultado: { efeito: "Pagou" } }, { resultado: { efeito: 3 } }, { resultado: null }, { resultado: {} }],
    });
    await expect(listarEfeitosDoAgente("a1")).resolves.toEqual(["Pagou"]);
    expect(chain.from.calls[0].filters).toContainEqual(["eq", "status", "executada"]);
    h.resolve = () => ({ data: null });
    await expect(listarEfeitosDoAgente("a1")).resolves.toEqual([]);
    h.resolve = () => ({ error: new Error("x") });
    await expect(listarEfeitosDoAgente("a1")).rejects.toThrow("x");
  });

  it("decidirAcao manda texto e motivo só quando existem", async () => {
    await decidirAcao({ acaoId: "x1", decisao: "descartada", texto: null, motivo: "Duplicada" });
    expect(h.rpc).toHaveBeenCalledWith("ops_decidir_acao", {
      p_acao_id: "x1",
      p_decisao: "descartada",
      p_texto: undefined,
      p_motivo: "Duplicada",
    });
    h.rpc.mockResolvedValue({ error: new Error("já decidida") });
    await expect(decidirAcao({ acaoId: "x1", decisao: "enviada" })).rejects.toThrow("já decidida");
  });

  it("definirAgenteAtivo e rodarAgente propagam erro", async () => {
    await definirAgenteAtivo("a1", false);
    expect(h.rpc).toHaveBeenCalledWith("ops_definir_agente_ativo", { p_agente_id: "a1", p_ativo: false });
    h.rpc.mockResolvedValue({ error: new Error("negado") });
    await expect(definirAgenteAtivo("a1", true)).rejects.toThrow("negado");

    await rodarAgente("a1");
    expect(h.invoke).toHaveBeenCalledWith("ops-agente-run", { body: { agente_id: "a1" } });
    h.invoke.mockResolvedValue({ error: new Error("timeout") });
    await expect(rodarAgente("a1")).rejects.toThrow("timeout");
  });
});

describe("hooks do Time", () => {
  it("as queries chamam a api certa", async () => {
    h.resolve = (q) => (q.table === "ops_acoes" ? { data: [{ resultado: { efeito: "ok" } }] } : { data: [] });
    h.rpc.mockImplementation(async (nome: string) =>
      nome === "ops_receita" ? { data: RECEITA_OK, error: null } : { data: [], error: null }
    );
    const { wrapper } = setup();
    const hooks = [
      renderHook(() => useAgentes(), { wrapper }),
      renderHook(() => useUltimasExecucoes(), { wrapper }),
      renderHook(() => useExecucoesDoAgente("a1"), { wrapper }),
      renderHook(() => useEfeitosDoAgente("a1"), { wrapper }),
      renderHook(() => useAcoesPendentes(), { wrapper }),
      renderHook(() => useReceita(7), { wrapper }),
      renderHook(() => useSaudeEmpresas(), { wrapper }),
    ];
    for (const r of hooks) await waitFor(() => expect(r.result.current.isSuccess).toBe(true));
    expect(h.rpc).toHaveBeenCalledWith("ops_receita", { p_dias: 7 });
  });

  it("decidir: aviso conforme a decisão e recarga das pendentes", async () => {
    const { qc, wrapper } = setup();
    const inval = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useDecidirAcao(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ acaoId: "x1", decisao: "enviada" });
    });
    expect(toast.success).toHaveBeenCalledWith("Marcada como enviada");
    await act(async () => {
      await result.current.mutateAsync({ acaoId: "x1", decisao: "descartada" });
    });
    expect(toast.success).toHaveBeenCalledWith("Ação descartada");
    expect(inval).toHaveBeenCalledWith({ queryKey: ["ultra-admin", "time", "pendentes"] });
  });

  it("decidir com erro avisa", async () => {
    h.rpc.mockResolvedValue({ error: new Error("x") });
    const { wrapper } = setup();
    const { result } = renderHook(() => useDecidirAcao(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ acaoId: "x1", decisao: "enviada" }).catch(() => {});
    });
    expect(toast.error).toHaveBeenCalledWith("Não deu para registrar a decisão", expect.anything());
  });

  it("pausar e retomar agente avisam diferente; erro avisa", async () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => useDefinirAgenteAtivo(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ agenteId: "a1", ativo: false });
    });
    expect(toast.success).toHaveBeenCalledWith("Agente pausado", expect.anything());
    await act(async () => {
      await result.current.mutateAsync({ agenteId: "a1", ativo: true });
    });
    expect(toast.success).toHaveBeenCalledWith("Agente retomado", expect.anything());
    h.rpc.mockResolvedValue({ error: new Error("x") });
    await act(async () => {
      await result.current.mutateAsync({ agenteId: "a1", ativo: true }).catch(() => {});
    });
    expect(toast.error).toHaveBeenCalledWith("Não deu para mudar o agente", expect.anything());
  });

  it("rodar agente: sucesso recarrega o Time inteiro; erro orienta a ver a ficha", async () => {
    const { qc, wrapper } = setup();
    const inval = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useRodarAgente(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync("a1");
    });
    expect(toast.success).toHaveBeenCalledWith("Agente rodou", expect.anything());
    expect(inval).toHaveBeenCalledWith({ queryKey: ["ultra-admin", "time"] });

    h.invoke.mockResolvedValue({ error: new Error("timeout") });
    await act(async () => {
      await result.current.mutateAsync("a1").catch(() => {});
    });
    expect(toast.error).toHaveBeenCalledWith("O agente não terminou", {
      description: expect.stringContaining("Veja a execução na ficha"),
    });
  });
});
