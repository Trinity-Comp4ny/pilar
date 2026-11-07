import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { sb } from "@/pages/financeiro/testing/supabaseMock";

// Dados do relatório financeiro: normalização das linhas, filtro de período por
// uma única data de referência, paginação e o fluxo de geração (vazio/erro).

vi.mock("@/integrations/supabase/client", async () => ({
  supabase: (await import("@/pages/financeiro/testing/supabaseMock")).sb.client,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/monitoring", () => ({ monitoring: { captureMessage: vi.fn() } }));

import { toast } from "sonner";
import { monitoring } from "@/lib/monitoring";
import {
  fetchFinancialData,
  parseDDMMYYYY,
  processData,
  useRelatorioData,
  type FinancialRecord,
} from "./useRelatorioData";

function rec(p: Partial<FinancialRecord>): FinancialRecord {
  return {
    descricao: "x",
    valor: 100,
    data_vencimento: "2026-10-10",
    status: "Pendente",
    nota_fiscal: null,
    observacao: null,
    parcela_numero: null,
    parcela_total: null,
    projetos: null,
    categorias_financeiras: null,
    contas: null,
    ...p,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  sb.reset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("parseDDMMYYYY", () => {
  it("converte dd/MM/yyyy e recusa traço/lixo", () => {
    expect(parseDDMMYYYY("05/10/2026")).toEqual(new Date(2026, 9, 5));
    expect(parseDDMMYYYY("-")).toBeNull();
    expect(parseDDMMYYYY("abc")).toBeNull();
  });
});

describe("processData", () => {
  it("receita recebida: data efetiva, cliente, parcela e nomes relacionados", () => {
    const [r] = processData(
      [
        rec({
          descricao: "Honorários",
          valor: 1500.5,
          status: "Recebido",
          data_vencimento: "2026-10-10",
          data_recebimento: "2026-10-08",
          parcela_numero: 2,
          parcela_total: 5,
          projetos: { nome: "Aurora" },
          clientes: { nome: "Alfa" },
          fornecedores: { nome: "não usar" },
          categorias_financeiras: { nome: "Honorários" },
          contas: { nome: "Itaú" },
          forma_pagamento: "PIX",
          nota_fiscal: "Sim",
        }),
      ],
      "receitas"
    );
    expect(r).toEqual({
      Tipo: "Receita",
      Descrição: "Honorários",
      Valor: 1500.5,
      "Dt. Vencimento": "10/10/2026",
      "Dt. Efetiva": "08/10/2026",
      Status: "Recebido",
      Projeto: "Aurora",
      "Cliente / Fornecedor": "Alfa",
      Categoria: "Honorários",
      Conta: "Itaú",
      "Forma Pgto": "PIX",
      "Nota Fiscal": "Sim",
      Parcela: "2/5",
    });
  });

  it("despesa usa fornecedor e data de pagamento; nulos viram traço e valor nulo vira 0", () => {
    const [d] = processData(
      [
        rec({
          descricao: null,
          valor: null,
          status: "Pago",
          data_pagamento: "2026-10-03",
          fornecedores: { nome: "Imob" },
        }),
      ],
      "despesas"
    );
    expect(d).toMatchObject({
      Tipo: "Despesa",
      Descrição: "-",
      Valor: 0,
      "Dt. Efetiva": "03/10/2026",
      "Cliente / Fornecedor": "Imob",
      Projeto: "-",
      Parcela: "-",
      "Forma Pgto": "-",
    });
  });

  it("pendente mostra o vencimento como data de referência", () => {
    const [d] = processData([rec({ status: "Pendente", data_vencimento: "2026-12-01" })], "despesas");
    expect(d["Dt. Efetiva"]).toBe("01/12/2026");
  });

  it("lista vazia ou nula dá vazio", () => {
    expect(processData([], "receitas")).toEqual([]);
    expect(processData(null as unknown as FinancialRecord[], "receitas")).toEqual([]);
  });
});

describe("fetchFinancialData", () => {
  it("receitas: exclui deletadas e filtra o período numa única data de referência", async () => {
    sb.resultado("receitas.select", { data: [rec({})], error: null });
    const r = await fetchFinancialData("receitas", new Date(2026, 9, 1), new Date(2026, 9, 31));
    expect(r).toHaveLength(1);
    expect(sb.de("receitas", "is")[0].args).toEqual(["deleted_at", null]);
    const [filtro] = sb.de("receitas", "or")[0].args as [string];
    // Os dois limites recaem na mesma coluna em cada ramo do OR.
    expect(filtro).toMatch(
      /^and\(data_recebimento\.gte\.[^,]+,data_recebimento\.lte\.[^)]+\),and\(data_recebimento\.is\.null,data_vencimento\.gte\.[^,]+,data_vencimento\.lte\.[^)]+\)$/
    );
    expect(sb.de("receitas", "range")[0].args).toEqual([0, 999]);
  });

  it("despesas: ignora pagamento de fatura (não conta o gasto duas vezes)", async () => {
    sb.resultado("despesas.select", { data: [], error: null });
    await fetchFinancialData("despesas");
    expect(sb.de("despesas", "eq")[0].args).toEqual(["is_fatura_payment", false]);
    expect(sb.de("despesas", "or")).toHaveLength(0);
  });

  it("o período usa o dia local, sem invadir o dia seguinte nem o anterior", async () => {
    sb.resultado("receitas.select", { data: [], error: null });
    await fetchFinancialData("receitas", new Date(2026, 9, 1), new Date(2026, 9, 31, 23, 59));
    const [filtro] = sb.de("receitas", "or")[0].args as [string];
    expect(filtro).toBe(
      "and(data_recebimento.gte.2026-10-01,data_recebimento.lte.2026-10-31)," +
        "and(data_recebimento.is.null,data_vencimento.gte.2026-10-01,data_vencimento.lte.2026-10-31)"
    );
  });

  it("só data inicial: aplica só o limite inferior", async () => {
    sb.resultado("despesas.select", { data: [], error: null });
    await fetchFinancialData("despesas", new Date(2026, 9, 1));
    const [filtro] = sb.de("despesas", "or")[0].args as [string];
    expect(filtro).toContain("data_pagamento.gte.");
    expect(filtro).not.toContain(".lte.");
  });

  it("pagina de 1000 em 1000 até a última página incompleta", async () => {
    const cheia = Array.from({ length: 1000 }, () => rec({}));
    sb.resultado("receitas.select", [
      { data: cheia, error: null },
      { data: cheia, error: null },
      { data: [rec({})], error: null },
    ]);
    const r = await fetchFinancialData("receitas");
    expect(r).toHaveLength(2001);
    expect(sb.de("receitas", "range").map((c) => c.args)).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
    expect(monitoring.captureMessage).not.toHaveBeenCalled();
  });

  it("para no teto de 50 páginas e registra o truncamento", async () => {
    const cheia = Array.from({ length: 1000 }, () => rec({}));
    sb.resultado("receitas.select", { data: cheia, error: null });
    const r = await fetchFinancialData("receitas");
    expect(r).toHaveLength(50000);
    expect(monitoring.captureMessage).toHaveBeenCalledWith(expect.stringContaining("teto de 50k"), "warning");
  });

  it("erro do banco propaga", async () => {
    sb.resultado("receitas.select", { data: null, error: { message: "boom" } });
    await expect(fetchFinancialData("receitas")).rejects.toEqual({ message: "boom" });
  });
});

describe("useRelatorioData", () => {
  it("relatório financeiro junta receitas e despesas ordenadas da data mais recente", async () => {
    sb.resultado("receitas.select", {
      data: [rec({ descricao: "R antiga", status: "Recebido", data_recebimento: "2026-10-01" })],
      error: null,
    });
    sb.resultado("despesas.select", {
      data: [rec({ descricao: "D nova", status: "Pago", data_pagamento: "2026-10-20" })],
      error: null,
    });
    const { result } = renderHook(() => useRelatorioData());
    await act(() => result.current.generateReport({ tipoRelatorio: "financeiro", title: "Financeiro" }));
    expect(result.current.reportData.map((r) => r.Descrição)).toEqual(["D nova", "R antiga"]);
    expect(result.current.reportTitle).toBe("Financeiro");
    expect(result.current.isLoading).toBe(false);
    expect(toast.success).toHaveBeenCalledWith("Relatório gerado", {
      description: "2 registros carregados. Exporte em CSV ou PDF.",
    });
  });

  it("relatório só de despesas não busca receitas", async () => {
    sb.resultado("despesas.select", { data: [rec({})], error: null });
    const { result } = renderHook(() => useRelatorioData());
    await act(() => result.current.generateReport({ tipoRelatorio: "despesas", title: "Despesas" }));
    expect(sb.client.from).not.toHaveBeenCalledWith("receitas");
    expect(result.current.reportData).toHaveLength(1);
    expect(result.current.reportData[0].Tipo).toBe("Despesa");
  });

  it("período sem dados avisa e limpa o relatório anterior", async () => {
    sb.resultado("receitas.select", [
      { data: [rec({})], error: null },
      { data: [], error: null },
    ]);
    const { result } = renderHook(() => useRelatorioData());
    await act(() => result.current.generateReport({ tipoRelatorio: "receitas", title: "R" }));
    expect(result.current.reportData).toHaveLength(1);
    await act(() => result.current.generateReport({ tipoRelatorio: "receitas", title: "R" }));
    expect(result.current.reportData).toEqual([]);
    expect(result.current.reportTitle).toBe("");
    expect(toast.error).toHaveBeenCalledWith("Sem dados", {
      description: "Não foram encontrados dados para os filtros selecionados.",
    });
  });

  it("erro do banco avisa e sai do carregamento", async () => {
    sb.resultado("receitas.select", { data: null, error: new Error("timeout") });
    const { result } = renderHook(() => useRelatorioData());
    await act(() => result.current.generateReport({ tipoRelatorio: "receitas", title: "R" }));
    expect(toast.error).toHaveBeenCalledWith("Erro ao gerar", { description: "timeout" });
    expect(result.current.isLoading).toBe(false);
  });

  it("clearReport zera dados e título", async () => {
    sb.resultado("receitas.select", { data: [rec({})], error: null });
    const { result } = renderHook(() => useRelatorioData());
    await act(() => result.current.generateReport({ tipoRelatorio: "receitas", title: "R" }));
    act(() => result.current.clearReport());
    expect(result.current.reportData).toEqual([]);
    expect(result.current.reportTitle).toBe("");
  });
});
