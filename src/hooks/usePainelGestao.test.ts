import { describe, expect, it, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...args: unknown[]) => rpc(...args) } }));

import { usePainelGestao } from "./usePainelGestao";

/** Retorno mínimo válido da RPC, no shape que o SQL produz. */
function retornoValido(overrides: Record<string, unknown> = {}) {
  return {
    ancoras: {
      conversao: { valor: 41, anterior: 35, decididas: 22 },
      prazo: { valor: 71, anterior: 78 },
      concluidasSemana: { valor: 34, media: 40 },
      desvioHoras: { valor: 14 },
      aguardandoCliente: { valor: 11, parados: 4 },
    },
    comercial: {
      funil: [{ etapa: "aceita", n: 9 }],
      conversaoMensal: [{ mes: "2026-09-01", ganhas: 9, perdidas: 13 }],
      motivosPerda: [{ motivo: "Preço", n: 14 }],
      esperaProposta: [{ faixa: "Até 7 dias", n: 3 }],
      origemGanho: [{ origem: "Indicação", leads: 22, ganhoPct: 58 }],
    },
    entrega: {
      semaforo: { noPrazo: 12, risco: 3, estourado: 2, semPrazo: 1 },
      statusAtivos: [{ status: "Em andamento", n: 9 }],
      pontualidadeMensal: [{ mes: "2026-09-01", pct: 68, total: 3 }],
      atrasoPorDisciplina: [{ disciplina: "Elétrica", diasMedio: 14, entregas: 6 }],
      prazos15Dias: [],
    },
    produtividade: {
      throughputSemanal: [{ semana: "2026-08-31", n: 34 }],
      horasPorProjeto: [
        { projetoId: "p1", projeto: "Vila Rica", estimadas: "420", realizadas: "580", desvioPct: 38 },
      ],
      cargaEquipe: [{ pessoaId: "u1", nome: "Marcos A.", iniciais: "MA", emDia: 7, atrasada: 2 }],
      filaAprovacao: [],
    },
    cobertura: { desde: "2025-07-01", projetosSemPrazo: 3, propostasSemHistorico: 22, leadsSemMotivoPadrao: 8 },
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
    rpc.mockResolvedValue({ data: retornoValido(), error: null });

    const { result } = renderHook(() => usePainelGestao(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(rpc).toHaveBeenCalledWith("get_painel_gestao");
    expect(result.current.data?.ancoras.conversao.valor).toBe(41);
    // numeric do Postgres chega como string: o schema precisa coagir, senão a
    // subtração de horas na tela viraria concatenação.
    expect(result.current.data?.produtividade.horasPorProjeto[0].estimadas).toBe(420);
    expect(typeof result.current.data?.produtividade.horasPorProjeto[0].realizadas).toBe("number");
  });

  it("aceita nulo onde a empresa ainda não tem histórico", async () => {
    rpc.mockResolvedValue({
      data: retornoValido({
        ancoras: {
          conversao: { valor: null, anterior: null, decididas: 0 },
          prazo: { valor: null, anterior: null },
          concluidasSemana: { valor: 0, media: null },
          desvioHoras: { valor: null },
          aguardandoCliente: { valor: 0, parados: 0 },
        },
      }),
      error: null,
    });

    const { result } = renderHook(() => usePainelGestao(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.ancoras.prazo.valor).toBeNull();
  });

  it("falha claro quando o shape do SQL divergir, em vez de renderizar undefined", async () => {
    const quebrado = retornoValido();
    // @ts-expect-error simula o SQL renomeando um bloco
    delete quebrado.entrega.semaforo;
    rpc.mockResolvedValue({ data: quebrado, error: null });

    const { result } = renderHook(() => usePainelGestao(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toContain("formato inesperado");
  });

  it("propaga erro da RPC", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "permission denied" } });

    const { result } = renderHook(() => usePainelGestao(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("não chama a RPC quando a empresa não tem nenhum módulo do painel", () => {
    renderHook(() => usePainelGestao(false), { wrapper });
    expect(rpc).not.toHaveBeenCalled();
  });
});
