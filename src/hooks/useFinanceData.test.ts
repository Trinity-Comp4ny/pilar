import { describe, it, expect, vi } from "vitest";

// Mock supabase antes de importar o módulo (evita localStorage no jsdom)
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { processChartData, processDailyChartData, processCategoryData } from "./useFinanceData";
import type { Tables } from "@/integrations/supabase/types";

type ReceitaRow = Tables<"receitas">;
type DespesaRow = Tables<"despesas">;

// Helpers — usa datas mid-month para evitar shift de timezone (UTC vs UTC-3)
const receita = (
  valor: number,
  opts: { data_vencimento?: string | null; data_recebimento?: string | null; status?: ReceitaRow["status"] } = {}
): Pick<ReceitaRow, "valor" | "data_recebimento" | "data_vencimento" | "status"> => ({
  valor: valor as unknown as ReceitaRow["valor"],
  data_vencimento: "data_vencimento" in opts ? opts.data_vencimento! : "2026-05-15",
  data_recebimento: opts.data_recebimento ?? null,
  status: opts.status ?? "Pendente",
});

const despesa = (
  valor: number,
  opts: { data_pagamento?: string | null; data_vencimento?: string; status?: DespesaRow["status"] } = {}
): Pick<DespesaRow, "valor" | "data_pagamento" | "data_vencimento" | "status"> => ({
  valor: valor as unknown as DespesaRow["valor"],
  data_pagamento: opts.data_pagamento ?? null,
  data_vencimento: opts.data_vencimento ?? "2026-05-15",
  status: opts.status ?? "Pendente",
});

// ────────────────────────────────────────────────────────────────
// processChartData
// ────────────────────────────────────────────────────────────────
describe("processChartData", () => {
  it("retorna array vazio quando não há dados", () => {
    expect(processChartData([], [])).toEqual([]);
  });

  it("agrupa receitas pendentes por mês via data_vencimento", () => {
    const receitas = [
      receita(1000, { data_vencimento: "2026-05-10", status: "Pendente" }),
      receita(500, { data_vencimento: "2026-05-20", status: "Pendente" }),
    ];
    const result = processChartData(receitas, []);
    expect(result).toHaveLength(1);
    expect(result[0].receitas).toBe(1500);
    expect(result[0].despesas).toBe(0);
  });

  it("agrupa despesas usando data_pagamento passada como 2º argumento", () => {
    const despesas = [
      despesa(300, { data_pagamento: "2026-05-10", status: "Pago" }),
      despesa(200, { data_pagamento: "2026-05-20", status: "Pago" }),
    ];
    const result = processChartData([], despesas);
    expect(result).toHaveLength(1);
    expect(result[0].despesas).toBe(500);
    expect(result[0].receitas).toBe(0);
  });

  it("combina receitas e despesas do mesmo mês", () => {
    const receitas = [receita(1000, { data_vencimento: "2026-05-10", status: "Pendente" })];
    const despesas = [despesa(400, { data_pagamento: "2026-05-15", status: "Pago" })];
    const result = processChartData(receitas, despesas);
    expect(result).toHaveLength(1);
    expect(result[0].receitas).toBe(1000);
    expect(result[0].despesas).toBe(400);
  });

  it("separa meses distintos e ordena cronologicamente", () => {
    const receitas = [
      receita(1000, { data_vencimento: "2026-03-15", status: "Pendente" }),
      receita(2000, { data_vencimento: "2026-05-15", status: "Pendente" }),
    ];
    const result = processChartData(receitas, []);
    expect(result).toHaveLength(2);
    expect(result[0].receitas).toBe(1000); // março antes de maio
    expect(result[1].receitas).toBe(2000);
  });

  it("usa data_recebimento para receita Recebida", () => {
    const receitas = [
      receita(800, {
        data_vencimento: "2026-04-20",
        data_recebimento: "2026-05-15",
        status: "Recebido",
      }),
    ];
    const result = processChartData(receitas, []);
    expect(result).toHaveLength(1);
    // deve cair em maio (data_recebimento), não abril (data_vencimento)
    expect(result[0].mes).toMatch(/[Mm]ai/);
  });

  it("ignora itens sem data válida", () => {
    const items: ReturnType<typeof receita>[] = [
      { valor: 500 as unknown as ReceitaRow["valor"], data_vencimento: null, data_recebimento: null, status: "Pendente" },
    ];
    const result = processChartData(items, []);
    expect(result).toHaveLength(0);
  });
});

// ────────────────────────────────────────────────────────────────
// processDailyChartData
// ────────────────────────────────────────────────────────────────
describe("processDailyChartData", () => {
  it("granularidade diária para intervalo ≤45 dias — pré-preenche todos os dias", () => {
    const start = new Date("2026-05-10T12:00:00");
    const end = new Date("2026-05-16T12:00:00"); // 7 dias
    const result = processDailyChartData([], [], start, end);
    expect(result).toHaveLength(7);
    result.forEach((r) => {
      expect(r.receitas).toBe(0);
      expect(r.despesas).toBe(0);
    });
  });

  it("granularidade diária — distribui valores no bucket correto", () => {
    const start = new Date("2026-05-10T12:00:00");
    const end = new Date("2026-05-16T12:00:00");
    const receitaItem = {
      valor: 500 as unknown as ReceitaRow["valor"],
      data_vencimento: "2026-05-13",
      data_recebimento: null,
      status: "Pendente",
      categorias_financeiras: undefined,
    } as unknown as Parameters<typeof processDailyChartData>[0][number];
    const result = processDailyChartData([receitaItem], [], start, end);
    const dia13 = result.find((r) => r.dia === "13");
    expect(dia13?.receitas).toBe(500);
    const outros = result.filter((r) => r.dia !== "13");
    outros.forEach((r) => expect(r.receitas).toBe(0));
  });

  it("granularidade mensal para intervalo >365 dias", () => {
    const start = new Date("2025-01-15T12:00:00");
    const end = new Date("2026-07-15T12:00:00"); // ~18 meses
    const result = processDailyChartData([], [], start, end);
    expect(result.length).toBeGreaterThanOrEqual(18);
  });

  it("itens fora do intervalo não são contabilizados", () => {
    const start = new Date("2026-05-10T12:00:00");
    const end = new Date("2026-05-16T12:00:00");
    const fora = {
      valor: 999 as unknown as ReceitaRow["valor"],
      data_vencimento: "2026-04-20",
      data_recebimento: null,
      status: "Pendente",
      categorias_financeiras: undefined,
    } as unknown as Parameters<typeof processDailyChartData>[0][number];
    const result = processDailyChartData([fora], [], start, end);
    result.forEach((r) => expect(r.receitas).toBe(0));
  });
});

// ────────────────────────────────────────────────────────────────
// processCategoryData
// ────────────────────────────────────────────────────────────────
describe("processCategoryData", () => {
  it("retorna array vazio sem itens", () => {
    expect(processCategoryData([], "receitas")).toEqual([]);
  });

  it("agrupa itens sem categoria em 'Outros'", () => {
    const items = [
      { valor: 100, categorias_financeiras: undefined },
      { valor: 200, categorias_financeiras: undefined },
    ] as unknown as Parameters<typeof processCategoryData>[0];
    const result = processCategoryData(items, "receitas");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Outros");
    expect(result[0].value).toBe(300);
  });

  it("agrupa por nome de categoria e soma valores", () => {
    const items = [
      { valor: 500, categorias_financeiras: { nome: "Serviços", id: "1", tipo: "receita" } },
      { valor: 300, categorias_financeiras: { nome: "Serviços", id: "1", tipo: "receita" } },
      { valor: 100, categorias_financeiras: { nome: "Produtos", id: "2", tipo: "receita" } },
    ] as unknown as Parameters<typeof processCategoryData>[0];
    const result = processCategoryData(items, "receitas");
    const servicos = result.find((r) => r.name === "Serviços");
    const produtos = result.find((r) => r.name === "Produtos");
    expect(servicos?.value).toBe(800);
    expect(produtos?.value).toBe(100);
  });

  it("atribui cores diferentes para categorias distintas", () => {
    const items = [
      { valor: 100, categorias_financeiras: { nome: "A", id: "1", tipo: "receita" } },
      { valor: 100, categorias_financeiras: { nome: "B", id: "2", tipo: "receita" } },
      { valor: 100, categorias_financeiras: { nome: "C", id: "3", tipo: "receita" } },
    ] as unknown as Parameters<typeof processCategoryData>[0];
    const result = processCategoryData(items, "receitas");
    const colors = result.map((r) => r.color);
    colors.forEach((c) => expect(c).toMatch(/hsl/));
    expect(new Set(colors).size).toBe(3);
  });

  it("tipo despesas usa tons de vermelho; receitas usa tons de verde", () => {
    const items = [
      { valor: 100, categorias_financeiras: { nome: "X", id: "1", tipo: "despesa" } },
    ] as unknown as Parameters<typeof processCategoryData>[0];
    const resultReceitas = processCategoryData(items, "receitas");
    const resultDespesas = processCategoryData(items, "despesas");
    expect(resultReceitas[0].color).toMatch(/green/);
    expect(resultDespesas[0].color).toMatch(/red/);
  });

  it("mistura de itens com e sem categoria", () => {
    const items = [
      { valor: 200, categorias_financeiras: { nome: "Aluguel", id: "1", tipo: "despesa" } },
      { valor: 50, categorias_financeiras: undefined },
    ] as unknown as Parameters<typeof processCategoryData>[0];
    const result = processCategoryData(items, "despesas");
    expect(result).toHaveLength(2);
    expect(result.find((r) => r.name === "Aluguel")?.value).toBe(200);
    expect(result.find((r) => r.name === "Outros")?.value).toBe(50);
  });
});
