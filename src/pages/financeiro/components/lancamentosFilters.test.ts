import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyQuick,
  clearFilterParams,
  datesToFilterPatch,
  defaultFilters,
  filtersToDates,
  filtersToRpcArgs,
  matchQuick,
  periodoRange,
  readFiltersFromParams,
  writeFiltersToParams,
  type LancamentosFilters,
} from "./lancamentosFilters";

// Data fixa para os presets relativos serem determinísticos: 15/03/2026, meio-dia.
const NOW = new Date(2026, 2, 15, 12, 0, 0);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

function makeFilters(over: Partial<LancamentosFilters> = {}): LancamentosFilters {
  return { ...defaultFilters, ...over };
}

describe("writeFiltersToParams / readFiltersFromParams", () => {
  it("faz round-trip preservando os filtros não-default", () => {
    const f = makeFilters({
      search: "cimento",
      tipo: "despesa",
      status: "pendentes",
      periodo: "ano",
      categorias: ["c1", "c2"],
      projetos: ["p1"],
      valorMin: "R$ 100,00",
      valorMax: "R$ 500,00",
    });
    const params = new URLSearchParams();
    writeFiltersToParams(params, f);
    const back = readFiltersFromParams(params);
    expect(back).toEqual(f);
  });

  it("não grava valores iguais ao default (URL limpa)", () => {
    const params = new URLSearchParams();
    writeFiltersToParams(params, defaultFilters);
    expect(params.toString()).toBe("");
  });

  it("readFiltersFromParams devolve os defaults quando não há params", () => {
    expect(readFiltersFromParams(new URLSearchParams())).toEqual(defaultFilters);
  });

  it("sanea tipo/status/período inválidos vindos da URL", () => {
    const params = new URLSearchParams("ft=hack&fs=xyz&fp=inexistente");
    const back = readFiltersFromParams(params);
    expect(back.tipo).toBe("todos");
    expect(back.status).toBe("todos");
    expect(back.periodo).toBe(defaultFilters.periodo);
  });

  it("aceita período custom explícito", () => {
    const params = new URLSearchParams("fp=custom&fcf=2026-01-01&fct=2026-01-31");
    const back = readFiltersFromParams(params);
    expect(back.periodo).toBe("custom");
    expect(back.customFrom).toBe("2026-01-01");
    expect(back.customTo).toBe("2026-01-31");
  });

  it("multiselect vazio na URL vira array vazio (sem entradas fantasma)", () => {
    const params = new URLSearchParams("fcat=");
    expect(readFiltersFromParams(params).categorias).toEqual([]);
  });
});

describe("clearFilterParams", () => {
  it("remove só as chaves de filtro de Lançamentos, preserva as demais", () => {
    const params = new URLSearchParams("fq=x&fcat=a&tab=lancamentos&from=2026-01-01");
    clearFilterParams(params);
    expect(params.get("fq")).toBeNull();
    expect(params.get("fcat")).toBeNull();
    expect(params.get("tab")).toBe("lancamentos");
    expect(params.get("from")).toBe("2026-01-01");
  });
});

describe("periodoRange", () => {
  it("'tudo' não restringe (from/to null)", () => {
    expect(periodoRange(makeFilters({ periodo: "tudo" }))).toEqual({ from: null, to: null });
  });

  it("'custom' usa as datas custom cruas", () => {
    const r = periodoRange(makeFilters({ periodo: "custom", customFrom: "2026-02-01", customTo: "2026-02-10" }));
    expect(r).toEqual({ from: "2026-02-01", to: "2026-02-10" });
  });

  it("'mes-atual' vira intervalo yyyy-MM-dd do mês corrente", () => {
    const r = periodoRange(makeFilters({ periodo: "mes-atual" }));
    expect(r.from).toBe("2026-03-01");
    expect(r.to).toBe("2026-03-31");
  });

  it("'ano' mapeia para o preset 'este-ano'", () => {
    const r = periodoRange(makeFilters({ periodo: "ano" }));
    expect(r.from).toBe("2026-01-01");
    expect(r.to).toBe("2026-12-31");
  });
});

describe("filtersToRpcArgs", () => {
  it("'todos' e listas vazias viram undefined (sem restrição no banco)", () => {
    const args = filtersToRpcArgs(defaultFilters);
    expect(args.p_tipo).toBeUndefined();
    expect(args.p_status).toBeUndefined();
    expect(args.p_categorias).toBeUndefined();
    expect(args.p_valor_min).toBeUndefined();
    expect(args.p_valor_max).toBeUndefined();
    expect(args.p_search).toBeUndefined();
  });

  it("converte valorMin/valorMax de moeda BR para número", () => {
    const args = filtersToRpcArgs(makeFilters({ valorMin: "R$ 100,50", valorMax: "R$ 1.000,00" }));
    expect(args.p_valor_min).toBe(100.5);
    expect(args.p_valor_max).toBe(1000);
  });

  it("faz trim do search e ignora busca só de espaços", () => {
    expect(filtersToRpcArgs(makeFilters({ search: "  nota  " })).p_search).toBe("nota");
    expect(filtersToRpcArgs(makeFilters({ search: "   " })).p_search).toBeUndefined();
  });

  it("propaga tipo/status/listas quando definidos", () => {
    const args = filtersToRpcArgs(
      makeFilters({ tipo: "receita", status: "pagos", categorias: ["a"], projetos: ["p"] })
    );
    expect(args.p_tipo).toBe("receita");
    expect(args.p_status).toBe("pagos");
    expect(args.p_categorias).toEqual(["a"]);
    expect(args.p_projetos).toEqual(["p"]);
  });
});

describe("applyQuick", () => {
  it("'atrasados' fura o período (status atrasados + período tudo)", () => {
    expect(applyQuick("atrasados")).toEqual({
      status: "atrasados",
      periodo: "tudo",
      customFrom: null,
      customTo: null,
    });
  });

  it("'em-aberto' e 'pagos' também abrem o período", () => {
    expect(applyQuick("em-aberto").periodo).toBe("tudo");
    expect(applyQuick("pagos").status).toBe("pagos");
  });

  it("'vence-semana' monta janela custom de hoje até +7 dias", () => {
    expect(applyQuick("vence-semana")).toEqual({
      status: "pendentes",
      periodo: "custom",
      customFrom: "2026-03-15",
      customTo: "2026-03-22",
    });
  });
});

describe("matchQuick", () => {
  it("reconhece o quick que gerou o filtro (round-trip via applyQuick)", () => {
    expect(matchQuick(makeFilters(applyQuick("atrasados")))).toBe("atrasados");
    expect(matchQuick(makeFilters(applyQuick("pagos")))).toBe("pagos");
    expect(matchQuick(makeFilters(applyQuick("em-aberto")))).toBe("em-aberto");
    expect(matchQuick(makeFilters(applyQuick("vence-semana")))).toBe("vence-semana");
  });

  it("filtro que não corresponde a nenhum quick devolve null", () => {
    expect(matchQuick(defaultFilters)).toBeNull();
    expect(matchQuick(makeFilters({ status: "pendentes", periodo: "mes-atual" }))).toBeNull();
  });
});

describe("datesToFilterPatch", () => {
  it("sem datas = período 'tudo'", () => {
    expect(datesToFilterPatch(undefined, undefined)).toEqual({
      periodo: "tudo",
      customFrom: null,
      customTo: null,
    });
  });

  it("intervalo que casa com preset relativo devolve o período nomeado", () => {
    const patch = datesToFilterPatch(new Date(2026, 2, 1, 0, 0, 0), new Date(2026, 2, 31, 23, 59, 59, 999));
    expect(patch.periodo).toBe("mes-atual");
    expect(patch.customFrom).toBeNull();
  });

  it("intervalo arbitrário vira custom com as datas em yyyy-MM-dd", () => {
    const patch = datesToFilterPatch(new Date(2026, 3, 10), new Date(2026, 4, 20));
    expect(patch.periodo).toBe("custom");
    expect(patch.customFrom).toBe("2026-04-10");
    expect(patch.customTo).toBe("2026-05-20");
  });
});

describe("filtersToDates", () => {
  it("'tudo' não tem intervalo", () => {
    expect(filtersToDates(makeFilters({ periodo: "tudo" }))).toEqual({ from: undefined, to: undefined });
  });

  it("'custom' faz parse ISO das datas custom", () => {
    const r = filtersToDates(makeFilters({ periodo: "custom", customFrom: "2026-02-01", customTo: "2026-02-10" }));
    expect(r.from?.getFullYear()).toBe(2026);
    expect(r.from?.getMonth()).toBe(1);
    expect(r.from?.getDate()).toBe(1);
    expect(r.to?.getDate()).toBe(10);
  });
});
