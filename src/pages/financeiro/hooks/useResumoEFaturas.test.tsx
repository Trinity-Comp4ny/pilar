import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { sb } from "../testing/supabaseMock";

// KPIs da lista de lançamentos (get_lancamentos_resumo) e leitura de faturas de
// cartão: status "Fechada" derivado do fim do ciclo, faturas vazias escondidas e
// geração de faturas tolerando a que já existe.

vi.mock("@/integrations/supabase/client", async () => ({
  supabase: (await import("../testing/supabaseMock")).sb.client,
}));

import { useLancamentosResumo } from "./useLancamentosResumo";
import { gerarFaturasCartao, useFaturas, useFaturasPendentes } from "./useFaturas";
import { defaultFilters } from "../components/lancamentosFilters";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
  sb.reset();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 10, 10, 12, 0));
});
afterEach(() => vi.useRealTimers());

describe("useLancamentosResumo", () => {
  it("converte o resumo do banco e calcula o saldo", async () => {
    sb.rpcResultado("get_lancamentos_resumo", {
      data: {
        total_count: "12",
        recebido: "8000.50",
        a_receber: 1500,
        pago: 3000,
        a_pagar: "999.99",
        receitas: "9500.50",
        despesas: "3999.99",
        atrasados_count: 2,
      },
      error: null,
    });
    const { result } = renderHook(() => useLancamentosResumo(defaultFilters), { wrapper });
    await waitFor(() => expect(result.current.resumo.totalCount).toBe(12));
    expect(result.current.resumo).toMatchObject({
      recebido: 8000.5,
      aReceber: 1500,
      pago: 3000,
      aPagar: 999.99,
      receitas: 9500.5,
      despesas: 3999.99,
      atrasadosCount: 2,
    });
    expect(result.current.resumo.saldo).toBeCloseTo(5500.51, 10);
  });

  it("só despesas: saldo negativo", async () => {
    sb.rpcResultado("get_lancamentos_resumo", { data: { total_count: 1, despesas: 250 }, error: null });
    const { result } = renderHook(() => useLancamentosResumo(defaultFilters), { wrapper });
    await waitFor(() => expect(result.current.resumo.totalCount).toBe(1));
    expect(result.current.resumo.saldo).toBe(-250);
    expect(result.current.resumo.receitas).toBe(0);
  });

  it("resposta vazia vira zeros", async () => {
    sb.rpcResultado("get_lancamentos_resumo", { data: null, error: null });
    const { result } = renderHook(() => useLancamentosResumo(defaultFilters), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.resumo).toMatchObject({ totalCount: 0, saldo: 0, atrasadosCount: 0 });
  });
});

const fatura = (p: Record<string, unknown>) => ({
  id: "f",
  cartao_id: "k1",
  status: "Aberta",
  data_fim: "2026-11-05",
  valor_total: 100,
  valor_pago: 0,
  ...p,
});

describe("useFaturas", () => {
  it("fatura aberta com ciclo encerrado aparece como Fechada; vazia e aberta é escondida", async () => {
    sb.resultado("view_fatura_resumo.select", {
      data: [
        fatura({ id: "ciclo-fechado", data_fim: "2026-11-05" }),
        fatura({ id: "em-aberto", data_fim: "2026-12-05" }),
        fatura({ id: "vazia", data_fim: "2026-12-05", valor_total: 0 }),
        fatura({ id: "paga-zerada", status: "Paga", valor_total: 0 }),
      ],
      error: null,
    });
    const { result } = renderHook(() => useFaturas("k1"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.map((f) => [f.id, f.status])).toEqual([
      ["ciclo-fechado", "Fechada"],
      ["em-aberto", "Aberta"],
      ["paga-zerada", "Paga"],
    ]);
    expect(sb.de("view_fatura_resumo", "eq")[0].args).toEqual(["cartao_id", "k1"]);
  });

  it("sem cartão não consulta", () => {
    renderHook(() => useFaturas(null), { wrapper });
    expect(sb.client.from).not.toHaveBeenCalled();
  });

  it("pendentes: só não pagas com valor, e derivam Fechada", async () => {
    sb.resultado("view_fatura_resumo.select", { data: [fatura({ id: "a" })], error: null });
    const { result } = renderHook(() => useFaturasPendentes(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data![0].status).toBe("Fechada");
    expect(sb.de("view_fatura_resumo", "neq")[0].args).toEqual(["status", "Paga"]);
    expect(sb.de("view_fatura_resumo", "gt")[0].args).toEqual(["valor_total", 0]);
  });

  it("erro do banco vira erro da query", async () => {
    sb.resultado("view_fatura_resumo.select", { data: null, error: { message: "x" } });
    const { result } = renderHook(() => useFaturasPendentes(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("gerarFaturasCartao", () => {
  it("gera do mês −2 ao +1, cruzando a virada de ano", async () => {
    vi.setSystemTime(new Date(2027, 0, 15));
    sb.rpcResultado("gerar_fatura", { data: null, error: null });
    await gerarFaturasCartao("k1");
    const meses = sb.client.rpc.mock.calls.map((c) => {
      const a = c[1] as { p_mes: number; p_ano: number };
      return `${a.p_mes}/${a.p_ano}`;
    });
    expect(meses).toEqual(["11/2026", "12/2026", "1/2027", "2/2027"]);
  });

  it("fatura já existente (23505) não é erro", async () => {
    sb.rpcResultado("gerar_fatura", { data: null, error: { code: "23505", message: "dup" } });
    await expect(gerarFaturasCartao("k1")).resolves.toBeUndefined();
  });

  it("outro erro propaga", async () => {
    sb.rpcResultado("gerar_fatura", { data: null, error: { code: "42501", message: "sem permissão" } });
    await expect(gerarFaturasCartao("k1")).rejects.toThrow("sem permissão");
  });
});
