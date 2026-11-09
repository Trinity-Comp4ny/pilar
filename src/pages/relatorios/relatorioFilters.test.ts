import { describe, expect, it } from "vitest";
import { applyFilters, computeFilterOptions, EMPTY_FILTERS } from "./relatorioFilters";
import type { ReportRow } from "./useRelatorioData";

function row(p: Partial<ReportRow>): ReportRow {
  return {
    Tipo: "Receita",
    Descrição: "x",
    Valor: 0,
    "Dt. Vencimento": "-",
    "Dt. Efetiva": "-",
    Status: "-",
    Projeto: "-",
    "Cliente / Fornecedor": "-",
    Categoria: "-",
    Conta: "-",
    "Forma Pgto": "-",
    "Nota Fiscal": "-",
    Parcela: "-",
    ...p,
  };
}

const dados = [
  row({
    Descrição: "a",
    Categoria: "Honorários",
    "Cliente / Fornecedor": "Alfa",
    Status: "Recebido",
    Projeto: "P1",
    Conta: "Itaú",
  }),
  row({
    Descrição: "b",
    Categoria: "Honorários",
    "Cliente / Fornecedor": "Beta",
    Status: "Pendente",
    Projeto: "P2",
    Conta: "Itaú",
  }),
  row({
    Tipo: "Despesa",
    Descrição: "c",
    Categoria: "Aluguel",
    "Cliente / Fornecedor": "Imob",
    Status: "Pago",
    Conta: "Nubank",
  }),
];

describe("applyFilters", () => {
  it("sem filtro devolve tudo", () => {
    expect(applyFilters(dados, EMPTY_FILTERS)).toHaveLength(3);
  });

  it("combina filtros com E", () => {
    const r = applyFilters(dados, { ...EMPTY_FILTERS, categoria: "Honorários", status: "Pendente" });
    expect(r.map((x) => x.Descrição)).toEqual(["b"]);
  });

  it("filtra por cliente, projeto e conta", () => {
    expect(applyFilters(dados, { ...EMPTY_FILTERS, cliente: "Alfa" }).map((x) => x.Descrição)).toEqual(["a"]);
    expect(applyFilters(dados, { ...EMPTY_FILTERS, projeto: "P2" }).map((x) => x.Descrição)).toEqual(["b"]);
    expect(applyFilters(dados, { ...EMPTY_FILTERS, conta: "Nubank" }).map((x) => x.Descrição)).toEqual(["c"]);
  });

  it("ignora o filtro excluído", () => {
    const f = { ...EMPTY_FILTERS, categoria: "Aluguel", conta: "Itaú" };
    expect(applyFilters(dados, f)).toHaveLength(0);
    expect(applyFilters(dados, f, "categoria").map((x) => x.Descrição)).toEqual(["a", "b"]);
  });

  it("filtro sem correspondência dá vazio", () => {
    expect(applyFilters(dados, { ...EMPTY_FILTERS, status: "Cancelado" })).toEqual([]);
  });
});

describe("computeFilterOptions", () => {
  it("lista valores únicos ordenados e sem traço", () => {
    const o = computeFilterOptions(dados, EMPTY_FILTERS);
    expect(o.categorias).toEqual(["Aluguel", "Honorários"]);
    expect(o.projetos).toEqual(["P1", "P2"]);
    expect(o.contas).toEqual(["Itaú", "Nubank"]);
    expect(o.status).toEqual(["Pago", "Pendente", "Recebido"]);
  });

  it("cada lista respeita os outros filtros, não o próprio", () => {
    const o = computeFilterOptions(dados, { ...EMPTY_FILTERS, categoria: "Honorários" });
    expect(o.categorias).toEqual(["Aluguel", "Honorários"]);
    expect(o.clientes).toEqual(["Alfa", "Beta"]);
    expect(o.contas).toEqual(["Itaú"]);
  });

  it("dados vazios dão listas vazias", () => {
    const o = computeFilterOptions([], EMPTY_FILTERS);
    expect(Object.values(o).every((l) => l.length === 0)).toBe(true);
  });
});
