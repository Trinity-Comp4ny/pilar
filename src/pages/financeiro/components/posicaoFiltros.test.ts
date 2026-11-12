import { describe, expect, it } from "vitest";
import { defaultFilters } from "./lancamentosFilters";
import { baldeAtivo, filtroDoBalde } from "./posicaoFiltros";

// Cada chip aplica o mesmo recorte que o balde conta em get_titulos_posicao: o número
// do chip tem que bater com a lista que aparece ao clicar.
const HOJE = "2026-11-10";
const base = { ...defaultFilters, tipo: "despesa" as const, search: "aluguel", projetos: ["p1"] };

describe("filtroDoBalde", () => {
  it("vencidos: atrasados em todo o período", () => {
    expect(filtroDoBalde("vencidos", HOJE, base)).toMatchObject({ status: "atrasados", periodo: "tudo" });
  });

  it("vencem hoje: em aberto, de hoje a hoje", () => {
    expect(filtroDoBalde("hoje", HOJE, base)).toMatchObject({
      status: "pendentes",
      periodo: "custom",
      customFrom: "2026-11-10",
      customTo: "2026-11-10",
    });
  });

  it("próximos 7 dias: de amanhã a hoje+7", () => {
    expect(filtroDoBalde("semana", HOJE, base)).toMatchObject({ customFrom: "2026-11-11", customTo: "2026-11-17" });
  });

  it("a vencer: de hoje+8 em diante, sem fim", () => {
    expect(filtroDoBalde("futuro", HOJE, base)).toMatchObject({ customFrom: "2026-11-18", customTo: null });
  });

  it("pagos no mês: pagos com vencimento no mês atual", () => {
    expect(filtroDoBalde("pagos_mes", HOJE, base)).toMatchObject({ status: "pagos", periodo: "mes-atual" });
  });

  it("mantém tipo, busca e demais filtros do usuário", () => {
    expect(filtroDoBalde("semana", HOJE, base)).toMatchObject({ tipo: "despesa", search: "aluguel", projetos: ["p1"] });
  });
});

describe("baldeAtivo", () => {
  it("reconhece o chip aplicado", () => {
    expect(baldeAtivo(filtroDoBalde("semana", HOJE, base), HOJE)).toBe("semana");
    expect(baldeAtivo(filtroDoBalde("vencidos", HOJE, base), HOJE)).toBe("vencidos");
  });

  it("filtro manual que não casa com nenhum chip deixa todos apagados", () => {
    expect(baldeAtivo({ ...base, status: "pendentes", periodo: "mes-anterior" }, HOJE)).toBeNull();
  });

  it("sem a data do servidor nenhum chip fica ativo", () => {
    expect(baldeAtivo(filtroDoBalde("hoje", HOJE, base), "")).toBeNull();
  });
});
