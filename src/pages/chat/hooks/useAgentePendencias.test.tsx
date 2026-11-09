import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ChainQuery, ChainResult } from "@/test/supabaseChain";

// Pendências do agente (SPEC 146/148): a fila é atualizada antes de ler, cobrança só sai pela
// função de envio (erro dela vira mensagem legível), orçamento guiado exige empresa, e o plano
// de prazo aplica cada ação de forma independente, adiando a pendência só se algo deu certo.

const h = vi.hoisted(() => ({
  rpc: vi.fn(),
  invoke: vi.fn(),
  resolve: (() => ({ data: null })) as (q: ChainQuery) => ChainResult,
  calls: [] as ChainQuery[],
}));
vi.mock("@/integrations/supabase/client", async () => {
  const { createSupabaseFrom } = await import("@/test/supabaseChain");
  const chain = createSupabaseFrom((q) => h.resolve(q));
  h.calls = chain.calls;
  return { supabase: { from: chain.from, rpc: h.rpc, functions: { invoke: h.invoke } } };
});

import {
  useAdiarPendencia,
  useAgentePendencias,
  useAplicarPlanoPrazo,
  useCobranca,
  useDecidirCobranca,
  useDispensarPendencia,
  useEnviarCobranca,
  useOrcamentoGuiado,
  usePlanoPrazo,
  useSalvarOrcamentoGuiado,
} from "./useAgentePendencias";

function setup() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const inval = vi.spyOn(qc, "invalidateQueries");
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return { wrapper, inval };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.rpc.mockResolvedValue({ data: null, error: null });
  h.invoke.mockResolvedValue({ data: {}, error: null });
  h.resolve = () => ({ data: null });
  h.calls.length = 0;
});

describe("fila de pendências", () => {
  it("atualiza a fila e lê só as abertas", async () => {
    h.resolve = () => ({ data: [{ id: "p1" }] });
    const { wrapper } = setup();
    const { result } = renderHook(() => useAgentePendencias(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(h.rpc).toHaveBeenCalledWith("agente_pendencias_atualizar");
    expect(result.current.data).toEqual([{ id: "p1" }]);
    expect(h.calls[0].filters).toContainEqual(["eq", "status", "aberta"]);
  });

  it("falha ao atualizar não lê a fila", async () => {
    h.rpc.mockResolvedValue({ error: new Error("rls") });
    const { wrapper } = setup();
    const { result } = renderHook(() => useAgentePendencias(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(h.calls).toHaveLength(0);
  });

  it("erro na leitura e lista nula", async () => {
    h.resolve = () => ({ error: new Error("x") });
    const { wrapper } = setup();
    const a = renderHook(() => useAgentePendencias(), { wrapper });
    await waitFor(() => expect(a.result.current.isError).toBe(true));
    h.resolve = () => ({ data: null });
    const b = renderHook(() => useAgentePendencias(), { wrapper: setup().wrapper });
    await waitFor(() => expect(b.result.current.data).toEqual([]));
  });

  it("adiar, dispensar e decidir cobrança chamam a RPC e recarregam", async () => {
    const { wrapper, inval } = setup();
    const adiar = renderHook(() => useAdiarPendencia(), { wrapper });
    const dispensar = renderHook(() => useDispensarPendencia(), { wrapper });
    const decidir = renderHook(() => useDecidirCobranca(), { wrapper });
    await act(() => adiar.result.current.mutateAsync({ id: "p1", dias: 7 }));
    await act(() => dispensar.result.current.mutateAsync("p1"));
    await act(() => decidir.result.current.mutateAsync({ cobrancaId: "c1", status: "externa" }));
    expect(h.rpc).toHaveBeenCalledWith("agente_pendencia_adiar", { p_id: "p1", p_dias: 7 });
    expect(h.rpc).toHaveBeenCalledWith("agente_pendencia_dispensar", { p_id: "p1" });
    expect(h.rpc).toHaveBeenCalledWith("cobranca_decidir", { p_id: "c1", p_status: "externa" });
    expect(inval).toHaveBeenCalledWith({ queryKey: ["agente_pendencias"] });
  });

  it("erros das RPCs propagam", async () => {
    h.rpc.mockResolvedValue({ error: new Error("negado") });
    const { wrapper } = setup();
    for (const [hook, arg] of [
      [useAdiarPendencia, { id: "p", dias: 1 }],
      [useDispensarPendencia, "p"],
      [useDecidirCobranca, { cobrancaId: "c", status: "recusada" }],
    ] as const) {
      const { result } = renderHook(() => (hook as () => { mutateAsync: (a: unknown) => Promise<unknown> })(), {
        wrapper,
      });
      await act(async () => {
        await expect(result.current.mutateAsync(arg)).rejects.toThrow("negado");
      });
    }
  });
});

describe("cobrança", () => {
  it("sem id não busca; com id lê o rascunho", async () => {
    const { wrapper } = setup();
    const vazio = renderHook(() => useCobranca(null), { wrapper });
    expect(vazio.result.current.fetchStatus).toBe("idle");
    h.resolve = () => ({ data: { id: "c1", etapa: 1 } });
    const { result } = renderHook(() => useCobranca("c1"), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual({ id: "c1", etapa: 1 }));
    h.resolve = () => ({ error: new Error("x") });
    const erro = renderHook(() => useCobranca("c2"), { wrapper });
    await waitFor(() => expect(erro.result.current.isError).toBe(true));
  });

  it("enviar manda a abertura só quando editada", async () => {
    h.invoke.mockResolvedValue({ data: { email: "c@x.co", etapa: 2 }, error: null });
    const { wrapper } = setup();
    const { result } = renderHook(() => useEnviarCobranca(), { wrapper });
    await act(() => result.current.mutateAsync({ cobrancaId: "c1" }));
    expect(h.invoke).toHaveBeenLastCalledWith("cobranca-enviar", { body: { cobranca_id: "c1" } });
    await act(() => result.current.mutateAsync({ cobrancaId: "c1", abertura: "Olá" }));
    expect(h.invoke).toHaveBeenLastCalledWith("cobranca-enviar", { body: { cobranca_id: "c1", abertura: "Olá" } });
  });

  it.each([
    [
      { data: null, error: { message: "HTTP 400", context: { json: async () => ({ error: "Cliente sem e-mail" }) } } },
      "Cliente sem e-mail",
    ],
    [
      { data: null, error: { message: "HTTP 500", context: { json: async () => Promise.reject(new Error("x")) } } },
      "HTTP 500",
    ],
    [{ data: null, error: { message: "" } }, "Erro desconhecido"],
    [{ data: { error: "Etapa já enviada" }, error: null }, "Etapa já enviada"],
  ])("erro do envio vira mensagem legível %#", async (resposta, msg) => {
    h.invoke.mockResolvedValue(resposta);
    const { wrapper } = setup();
    const { result } = renderHook(() => useEnviarCobranca(), { wrapper });
    await act(async () => {
      await expect(result.current.mutateAsync({ cobrancaId: "c1" })).rejects.toThrow(msg);
    });
  });
});

describe("orçamento guiado", () => {
  it("quem vê dinheiro recebe o contrato; disciplinas sem repetição", async () => {
    h.resolve = (q) =>
      q.table === "projetos_safe"
        ? { data: { nome: "Casa", valor_contrato: "12000.5", pode_ver_valor: true } }
        : { data: [{ nome: "Arq" }, { nome: "Arq" }, { nome: "Est" }] };
    const { wrapper } = setup();
    const { result } = renderHook(() => useOrcamentoGuiado("p1"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({
      nome: "Casa",
      contrato: 12000.5,
      podeVerValor: true,
      disciplinas: ["Arq", "Est"],
    });
  });

  it("sem permissão de valor esconde o contrato; nome nulo vira 'Projeto'", async () => {
    h.resolve = (q) =>
      q.table === "projetos_safe"
        ? { data: { nome: null, valor_contrato: 999, pode_ver_valor: false } }
        : { data: null };
    const { wrapper } = setup();
    const { result } = renderHook(() => useOrcamentoGuiado("p1"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ nome: "Projeto", contrato: null, podeVerValor: false, disciplinas: [] });
  });

  it("erros do projeto ou das disciplinas falham; sem id fica parado", async () => {
    const { wrapper } = setup();
    expect(renderHook(() => useOrcamentoGuiado(null), { wrapper }).result.current.fetchStatus).toBe("idle");
    h.resolve = (q) => (q.table === "projetos_safe" ? { error: new Error("p") } : { data: [] });
    const a = renderHook(() => useOrcamentoGuiado("p1"), { wrapper });
    await waitFor(() => expect(a.result.current.isError).toBe(true));
    h.resolve = (q) => (q.table === "projetos_safe" ? { data: { nome: "x" } } : { error: new Error("d") });
    const b = renderHook(() => useOrcamentoGuiado("p2"), { wrapper });
    await waitFor(() => expect(b.result.current.isError).toBe(true));
  });

  it("salvar exige empresa, faz upsert por disciplina e força a fila", async () => {
    h.rpc.mockImplementation(async (nome: string) =>
      nome === "get_user_empresa_id" ? { data: "emp-1", error: null } : { error: null }
    );
    const { wrapper, inval } = setup();
    const { result } = renderHook(() => useSalvarOrcamentoGuiado(), { wrapper });
    await act(() =>
      result.current.mutateAsync({
        projetoId: "p1",
        linhas: [{ disciplina: "Arq", horasEstimadas: 40, custoHora: 120 }],
      })
    );
    expect(h.calls[0]).toMatchObject({
      table: "projeto_orcamento_fases",
      op: "upsert",
      payload: [{ empresa_id: "emp-1", projeto_id: "p1", disciplina: "Arq", horas_estimadas: 40, custo_hora: 120 }],
    });
    expect(h.rpc).toHaveBeenCalledWith("agente_pendencias_atualizar", { p_forcar: true });
    expect(inval).toHaveBeenCalledWith({ queryKey: ["projeto_orcamento_fases", "p1"] });
  });

  it("salvar sem empresa ou com erro não grava", async () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => useSalvarOrcamentoGuiado(), { wrapper });
    h.rpc.mockResolvedValue({ data: null, error: null });
    await act(async () => {
      await expect(result.current.mutateAsync({ projetoId: "p1", linhas: [] })).rejects.toThrow(
        "Usuário não vinculado a uma empresa"
      );
    });
    h.rpc.mockResolvedValue({ data: null, error: new Error("jwt") });
    await act(async () => {
      await expect(result.current.mutateAsync({ projetoId: "p1", linhas: [] })).rejects.toThrow("jwt");
    });
    expect(h.calls).toHaveLength(0);
    h.rpc.mockResolvedValue({ data: "emp-1", error: null });
    h.resolve = () => ({ error: new Error("unique") });
    await act(async () => {
      await expect(result.current.mutateAsync({ projetoId: "p1", linhas: [] })).rejects.toThrow("unique");
    });
  });
});

describe("plano de prazo", () => {
  it("lê projeto, disciplinas e cliente quando existe", async () => {
    h.resolve = (q) => {
      if (q.table === "projetos_safe") return { data: { nome: "Casa", data_previsao: "2026-12-01", cliente_id: "c1" } };
      if (q.table === "clientes") return { data: { id: "c1", nome: "Ana", email: null } };
      return { data: [{ nome: "Arq", status: "Em Andamento", data_fim: "2026-11-20" }] };
    };
    const { wrapper } = setup();
    const { result } = renderHook(() => usePlanoPrazo("p1"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({
      nome: "Casa",
      entrega: "2026-12-01",
      cliente: { id: "c1", nome: "Ana", email: null },
      disciplinas: [{ nome: "Arq", status: "Em Andamento", data_fim: "2026-11-20" }],
    });
  });

  it("sem cliente não consulta clientes; erros falham", async () => {
    h.resolve = (q) =>
      q.table === "projetos_safe" ? { data: { nome: null, data_previsao: null, cliente_id: null } } : { data: null };
    const { wrapper } = setup();
    const { result } = renderHook(() => usePlanoPrazo("p1"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ nome: "Projeto", entrega: null, cliente: null, disciplinas: [] });
    expect(h.calls.some((c) => c.table === "clientes")).toBe(false);

    h.resolve = (q) => (q.table === "projetos_safe" ? { error: new Error("p") } : { data: [] });
    const a = renderHook(() => usePlanoPrazo("p2"), { wrapper });
    await waitFor(() => expect(a.result.current.isError).toBe(true));
    h.resolve = (q) => (q.table === "projetos_safe" ? { data: {} } : { error: new Error("d") });
    const b = renderHook(() => usePlanoPrazo("p3"), { wrapper });
    await waitFor(() => expect(b.result.current.isError).toBe(true));
  });

  const acoes = {
    projetoId: "p1",
    pendenciaId: "pend-1",
    avisar: true,
    comunicado: { clienteId: "c1", assunto: "Prazo", mensagem: "Atraso de 5 dias" },
    aditivo: { dias: 5, justificativa: "Chuva" },
  };

  it("aplica todas as ações e adia a pendência por 3 dias", async () => {
    const { wrapper, inval } = setup();
    const { result } = renderHook(() => useAplicarPlanoPrazo(), { wrapper });
    let r: unknown;
    await act(async () => {
      r = await result.current.mutateAsync(acoes);
    });
    expect(r).toEqual([
      { acao: "avisar", ok: true, erro: undefined },
      { acao: "comunicado", ok: true, erro: undefined },
      { acao: "aditivo", ok: true, erro: undefined },
    ]);
    expect(h.invoke).toHaveBeenCalledWith("send-manual-client-email", {
      body: { cliente_id: "c1", subject: "Prazo", message: "Atraso de 5 dias" },
    });
    expect(h.rpc).toHaveBeenCalledWith("projeto_aditivo_prazo_criar", {
      p_projeto: "p1",
      p_dias: 5,
      p_justificativa: "Chuva",
    });
    expect(h.rpc).toHaveBeenCalledWith("agente_pendencia_adiar", { p_id: "pend-1", p_dias: 3 });
    expect(inval).toHaveBeenCalledWith({ queryKey: ["escopos"] });
  });

  it("uma falha não impede as outras; o erro da função vem do corpo", async () => {
    h.rpc.mockImplementation(async (nome: string) =>
      nome === "projeto_prazo_avisar" ? { error: { message: "sem equipe" } } : { error: null }
    );
    h.invoke.mockResolvedValue({
      data: null,
      error: { message: "HTTP 400", context: { json: async () => ({ error: "Cliente sem e-mail" }) } },
    });
    const { wrapper } = setup();
    const { result } = renderHook(() => useAplicarPlanoPrazo(), { wrapper });
    let r: Array<{ acao: string; ok: boolean; erro?: string }> = [];
    await act(async () => {
      r = await result.current.mutateAsync(acoes);
    });
    expect(r).toEqual([
      { acao: "avisar", ok: false, erro: "sem equipe" },
      { acao: "comunicado", ok: false, erro: "Cliente sem e-mail" },
      { acao: "aditivo", ok: true, erro: undefined },
    ]);
    expect(h.rpc).toHaveBeenCalledWith("agente_pendencia_adiar", expect.anything());
  });

  it("nada deu certo: não adia a pendência", async () => {
    h.invoke.mockResolvedValue({ data: { error: "Limite diário de e-mails" }, error: null });
    const { wrapper } = setup();
    const { result } = renderHook(() => useAplicarPlanoPrazo(), { wrapper });
    let r: Array<{ ok: boolean; erro?: string }> = [];
    await act(async () => {
      r = await result.current.mutateAsync({ ...acoes, avisar: false, aditivo: null });
    });
    expect(r).toEqual([{ acao: "comunicado", ok: false, erro: "Limite diário de e-mails" }]);
    expect(h.rpc).not.toHaveBeenCalledWith("agente_pendencia_adiar", expect.anything());
  });

  it("erro da função sem corpo usa a mensagem; sem mensagem, texto padrão", async () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => useAplicarPlanoPrazo(), { wrapper });
    h.invoke.mockResolvedValue({ data: null, error: { message: "timeout" } });
    let r: Array<{ erro?: string }> = [];
    await act(async () => {
      r = await result.current.mutateAsync({ ...acoes, avisar: false, aditivo: null });
    });
    expect(r[0].erro).toBe("timeout");
    h.invoke.mockResolvedValue({
      data: null,
      error: { message: "", context: { json: async () => Promise.reject(new Error()) } },
    });
    await act(async () => {
      r = await result.current.mutateAsync({ ...acoes, avisar: false, aditivo: null });
    });
    expect(r[0].erro).toBe("Erro desconhecido");
  });

  it("falha ao forçar a fila depois de aplicar propaga", async () => {
    h.rpc.mockImplementation(async (nome: string, args?: { p_forcar?: boolean }) =>
      nome === "agente_pendencias_atualizar" && args?.p_forcar ? { error: new Error("fila") } : { error: null }
    );
    const { wrapper } = setup();
    const { result } = renderHook(() => useAplicarPlanoPrazo(), { wrapper });
    await act(async () => {
      await expect(result.current.mutateAsync({ ...acoes, comunicado: null, aditivo: null })).rejects.toThrow("fila");
    });
  });
});
