import { describe, expect, it, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...args: unknown[]) => rpc(...args) } }));

/** A tela faz duas chamadas: a principal e a dos blocos extra. */
function responder(principal: unknown, extra: unknown = { efetivoObra: [], projetosPorCliente: [] }) {
  rpc.mockImplementation((nome: string) =>
    nome === "get_painel_extra"
      ? Promise.resolve({ data: extra, error: null })
      : Promise.resolve({ data: principal, error: null })
  );
}

import { usePainelGestao } from "./usePainelGestao";

/** Retorno mínimo válido da RPC, no shape que o SQL produz. */
function retorno(overrides: Record<string, unknown> = {}) {
  return {
    gestao: {
      propostasTotais: { enviadas: 9, ganhas: 2, perdidas: 4, aguardando: 9, conversaoPct: 33 },
      funil: [{ etapa: "aceita", n: 2 }],
      conversaoMensal: [{ mes: "2026-09-01", ganhas: 2, perdidas: 4 }],
      motivosPerda: [{ motivo: "Preço", n: 5 }],
      esperaProposta: [{ faixa: "Até 7 dias", n: 3 }],
      origemGanho: [{ origem: "Indicação", leads: 8, ganhoPct: 50 }],
      throughputSemanal: [{ semana: "2026-08-31", n: 9 }],
      cargaEquipe: [{ pessoaId: "u1", nome: "Marcos A.", emDia: 4, atrasada: 1 }],
      filaAprovacao: [{ escopoId: "e1", tipo: "aditivo", projetoId: "p1", projeto: "Vila Rica", dias: 22 }],
    },
    projetos: {
      totais: {
        ativos: 6,
        emAndamento: 3,
        planejamento: 1,
        paralisado: 1,
        atrasados: 1,
        risco: 1,
        semPrazo: 0,
        concluidosAno: 10,
      },
      statusAtivos: [{ status: "Em andamento", n: 3 }],
      pontualidadeMensal: [{ mes: "2026-09-01", pct: 67, total: 3 }],
      atrasoPorDisciplina: [{ disciplina: "Eletrica", diasMedio: 8, entregas: 4 }],
      prazos15Dias: [
        {
          disciplinaId: "d1",
          disciplina: "Eletrica",
          projetoId: "p1",
          projeto: "Vila Rica",
          dias: 2,
          responsavel: "Fernando",
        },
      ],
      horasPorProjeto: [
        { projetoId: "p1", projeto: "Vila Rica", estimadas: "420", realizadas: "580", desvioPct: 38 },
      ],
    },
    obras: {
      totais: { emAndamento: 2, planejadas: 1, paralisadas: 0, atrasadas: 1 },
      rdoPorObra: [{ obraId: "o1", obra: "Galpão", ultimoRdo: "2026-09-01", diasSemRdo: 3 }],
      avancoPorObra: [{ obraId: "o1", obra: "Galpão", concluidas: 4, total: 10, pct: 40 }],
    },
    financeiro: null,
    cobertura: { desde: "2025-09-01", projetosSemPrazo: 0, leadsSemMotivoPadrao: 2 },
    ...overrides,
  };
}

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(QueryClientProvider, { client }, children);
}

describe("usePainelGestao", () => {
  beforeEach(() => rpc.mockReset());

  it("aceita o retorno da RPC e converte horas de string numérica para número", async () => {
    responder(retorno());

    const { result } = renderHook(() => usePainelGestao(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(rpc).toHaveBeenCalledWith("get_painel_gestao");
    expect(rpc).toHaveBeenCalledWith("get_painel_extra");
    expect(result.current.data?.projetos.totais.atrasados).toBe(1);
    // numeric do Postgres chega como string: sem coerção, a subtração de horas
    // na tela viraria concatenação.
    expect(result.current.data?.projetos.horasPorProjeto[0].estimadas).toBe(420);
    expect(typeof result.current.data?.projetos.horasPorProjeto[0].realizadas).toBe("number");
  });

  it("aceita financeiro nulo, que é como a RPC responde a quem não pode ver dinheiro", async () => {
    responder(retorno());

    const { result } = renderHook(() => usePainelGestao(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.financeiro).toBeNull();
  });

  it("aceita o bloco financeiro preenchido quando ele vem", async () => {
    responder(retorno({
        financeiro: {
          mes: { recebido: 1000, aReceber: 2000, receberVencido: 300 },
          despesaMes: { pago: 500, aPagar: 700, pagarVencido: 0 },
          faturamento: [{ mes: "2026-09-01", previsto: 5000, faturado: 4000 }],
          margemPorProjeto: [{ projetoId: "p1", projeto: "Vila Rica", pct: -7 }],
        },
      }));

    const { result } = renderHook(() => usePainelGestao(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.financeiro?.margemPorProjeto[0].pct).toBe(-7);
  });

  it("aceita nulo onde a empresa ainda não tem histórico", async () => {
    // A RPC devolve null nessas chaves quando não há base de comparação, e o
    // schema tem que aceitar em vez de derrubar a tela inteira.
    const vazio = retorno({
      gestao: { ...retorno().gestao, propostasTotais: { ...retorno().gestao.propostasTotais, conversaoPct: null } },
      projetos: { ...retorno().projetos, pontualidadeMensal: [{ mes: "2026-09-01", pct: null, total: 0 }] },
    });
    responder(vazio);

    const { result } = renderHook(() => usePainelGestao(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.gestao.propostasTotais.conversaoPct).toBeNull();
  });

  it("falha claro quando o shape do SQL divergir, em vez de renderizar undefined", async () => {
    const quebrado = retorno();
    // @ts-expect-error simula o SQL renomeando um bloco
    delete quebrado.projetos.totais;
    responder(quebrado);

    const { result } = renderHook(() => usePainelGestao(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toContain("formato inesperado");
  });

  it("propaga erro da RPC", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "permission denied" } });

    const { result } = renderHook(() => usePainelGestao(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("não chama a RPC quando desabilitado", () => {
    renderHook(() => usePainelGestao(false), { wrapper });
    expect(rpc).not.toHaveBeenCalled();
  });
});
