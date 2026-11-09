import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { sb } from "../testing/supabaseMock";

// KPIs da Visão Geral: saldo, a receber/a pagar, crescimento contra o período
// anterior e séries dos gráficos. O banco agrega; aqui conferimos a conta que o
// hook faz em cima do retorno (inclusive números vindos como string do numeric).

vi.mock("@/integrations/supabase/client", async () => ({
  supabase: (await import("../testing/supabaseMock")).sb.client,
}));

import { useFinanceData } from "./useFinanceData";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const statsBase = {
  receitas_total: 10000,
  despesas_total: 4000,
  receitas_total_geral: 50000,
  despesas_total_geral: 30000,
  receitas_prev_total: 8000,
  despesas_prev_total: 5000,
  a_receber_total: 2500,
  a_receber_count: 3,
  a_pagar_total: 1200,
  a_pagar_count: 2,
  top_receitas: null,
  top_despesas: null,
};

function respostas(stats: Record<string, unknown> = statsBase) {
  sb.rpcResultado("get_finance_stats", { data: stats, error: null });
  sb.rpcResultado("get_finance_chart_mensal", { data: [], error: null });
  sb.rpcResultado("get_finance_chart_periodo", { data: [], error: null });
  sb.rpcResultado("get_finance_categorias", { data: [], error: null });
}

async function carregar(from?: Date, to?: Date) {
  const { result } = renderHook(() => useFinanceData(from, to), { wrapper });
  await waitFor(() => expect(result.current.isSuccess || result.current.isError).toBe(true));
  return result.current;
}

const out = new Date(2026, 9, 1);
const fimOut = new Date(2026, 9, 31);

beforeEach(() => {
  vi.clearAllMocks();
  sb.reset();
});

describe("useFinanceData", () => {
  it("envia o período em yyyy-MM-dd para todas as agregações", async () => {
    respostas();
    await carregar(out, fimOut);
    const periodo = { p_data_inicio: "2026-10-01", p_data_fim: "2026-10-31" };
    expect(sb.argsRpc("get_finance_stats")).toEqual(periodo);
    expect(sb.argsRpc("get_finance_chart_mensal")).toEqual(periodo);
    expect(sb.argsRpc("get_finance_categorias", 0)).toEqual({ p_tipo: "receitas", ...periodo });
    expect(sb.argsRpc("get_finance_categorias", 1)).toEqual({ p_tipo: "despesas", ...periodo });
  });

  it("saldo, totais gerais, a receber e a pagar", async () => {
    respostas();
    const { data } = await carregar(out, fimOut);
    expect(data!.stats).toEqual({
      receitasTotal: 10000,
      despesasTotal: 4000,
      receitasTotalGeral: 50000,
      despesasTotalGeral: 30000,
      receitasMes: "25.0",
      despesasMes: "-20.0",
      saldo: 6000,
      saldoGeral: 20000,
      aReceber: { total: 2500, count: 3 },
      aPagar: { total: 1200, count: 2 },
    });
  });

  it("aceita numeric vindo como string do Postgres", async () => {
    respostas({ ...statsBase, receitas_total: "1234.56", despesas_total: "234.56", a_pagar_count: "7" });
    const { data } = await carregar(out, fimOut);
    expect(data!.stats.saldo).toBeCloseTo(1000, 10);
    expect(data!.stats.aPagar.count).toBe(7);
  });

  it("mês só com despesas dá saldo negativo e crescimento de receita 0 sem base anterior", async () => {
    respostas({ ...statsBase, receitas_total: 0, despesas_total: 3500.75, receitas_prev_total: 0 });
    const { data } = await carregar(out, fimOut);
    expect(data!.stats.saldo).toBe(-3500.75);
    expect(data!.stats.receitasMes).toBe("0.0");
  });

  it("mês vazio dá tudo zero", async () => {
    respostas({
      ...statsBase,
      receitas_total: 0,
      despesas_total: 0,
      receitas_prev_total: 0,
      despesas_prev_total: 0,
      a_receber_total: 0,
      a_receber_count: 0,
      a_pagar_total: 0,
      a_pagar_count: 0,
    });
    const { data } = await carregar(out, fimOut);
    expect(data!.stats).toMatchObject({ saldo: 0, receitasMes: "0.0", despesasMes: "0.0" });
    expect(data!.chartData).toEqual([]);
    expect(data!.topReceitas).toEqual([]);
  });

  it("todo o período não manda datas nem calcula crescimento", async () => {
    respostas();
    const { data } = await carregar();
    expect(sb.argsRpc("get_finance_stats")).toEqual({ p_data_inicio: undefined, p_data_fim: undefined });
    expect(data!.stats.receitasMes).toBe("0.0");
    expect(data!.stats.despesasMes).toBe("0.0");
  });

  it("monta séries, categorias com cor e tops", async () => {
    respostas({
      ...statsBase,
      top_receitas: [{ id: "r1", descricao: "A", valor: "900", data: "2026-10-02", status: "Recebido" }],
    });
    sb.rpcResultado("get_finance_chart_mensal", {
      data: [{ mes: "out/26", receitas: "10000", despesas: 4000 }],
      error: null,
    });
    sb.rpcResultado("get_finance_chart_periodo", {
      data: [{ bucket_label: "01", receitas: 1, despesas: "2" }],
      error: null,
    });
    sb.rpcResultado("get_finance_categorias", [
      { data: [{ categoria_nome: "Honorários", valor: "8000", count: "4" }], error: null },
      { data: [{ categoria_nome: "Aluguel", valor: 3000, count: 1 }], error: null },
    ]);
    const { data } = await carregar(out, fimOut);
    expect(data!.chartData).toEqual([{ mes: "out/26", receitas: 10000, despesas: 4000 }]);
    expect(data!.chartDataDiario).toEqual([{ dia: "01", receitas: 1, despesas: 2 }]);
    expect(data!.categoriaData).toEqual([{ name: "Honorários", value: 8000, count: 4, color: expect.any(String) }]);
    expect(data!.despesasCategoriaData[0]).toMatchObject({ name: "Aluguel", value: 3000 });
    expect(data!.topReceitas).toEqual([
      { id: "r1", descricao: "A", valor: 900, data: "2026-10-02", status: "Recebido" },
    ]);
  });

  it("erro em qualquer agregação vira erro da query (não mostra número parcial)", async () => {
    respostas();
    sb.rpcResultado("get_finance_chart_periodo", { data: null, error: { message: "timeout" } });
    const r = await carregar(out, fimOut);
    expect(r.isError).toBe(true);
    expect(r.data).toBeUndefined();
  });
});
