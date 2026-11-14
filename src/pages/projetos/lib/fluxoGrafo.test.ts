import { describe, expect, it } from "vitest";
import { diasUteisEntre, projetarFluxo, resolverDependencias, resolverDependentes, type NoFluxo } from "./fluxoGrafo";

// Semana de referência sem feriado nacional: seg 2026-03-02 a sex 2026-03-13.
const HOJE = "2026-03-11"; // quarta

function no(over: Partial<NoFluxo> & Pick<NoFluxo, "key" | "coluna">): NoFluxo {
  return { status: "nao_iniciado", ...over };
}

describe("diasUteisEntre", () => {
  it("conta dias úteis no intervalo (de, ate], pulando fim de semana", () => {
    expect(diasUteisEntre("2026-03-06", "2026-03-09")).toBe(1); // sex → seg
    expect(diasUteisEntre("2026-03-02", "2026-03-06")).toBe(4);
    expect(diasUteisEntre("2026-03-06", "2026-03-06")).toBe(0);
    expect(diasUteisEntre("2026-03-09", "2026-03-06")).toBe(0);
  });
});

describe("resolverDependencias", () => {
  it("sem explícitas, depende da coluna anterior inteira (mesmo com buraco na numeração)", () => {
    const deps = resolverDependencias([
      no({ key: "a", coluna: 1 }),
      no({ key: "b", coluna: 1 }),
      no({ key: "c", coluna: 3 }),
    ]);
    expect(deps).toEqual({ a: [], b: [], c: ["a", "b"] });
  });

  it("explícitas substituem a coluna anterior e ignoram keys inexistentes e a própria", () => {
    const deps = resolverDependencias([
      no({ key: "a", coluna: 1 }),
      no({ key: "b", coluna: 1 }),
      no({ key: "c", coluna: 2, dependeDe: ["a", "x", "c"] }),
    ]);
    expect(deps.c).toEqual(["a"]);
    expect(resolverDependentes(deps)).toEqual({ a: ["c"], b: [], c: [] });
  });
});

describe("projetarFluxo", () => {
  it("atraso na coluna 1 empurra a coluna 2 pelo mesmo número de dias úteis", () => {
    const r = projetarFluxo(
      [
        no({ key: "a", coluna: 1, status: "atrasado", dataInicio: "2026-03-02", dataPrevisao: "2026-03-09" }),
        no({ key: "b", coluna: 2, dataInicio: "2026-03-10", dataPrevisao: "2026-03-12" }),
      ],
      HOJE
    );
    // a deveria ter terminado seg 09; atrasada, fim estimado = hoje (qua 11), 2 dias úteis.
    expect(r.porNo.a.fimEstimado).toBe(HOJE);
    expect(r.porNo.a.atrasoDiasUteis).toBe(2);
    // b começa no dia útil seguinte (qui 12) e mantém 2 dias úteis de duração: termina seg 16.
    expect(r.porNo.b.inicioEstimado).toBe("2026-03-12");
    expect(r.porNo.b.fimEstimado).toBe("2026-03-16");
    expect(r.porNo.b.atrasoDiasUteis).toBe(2);
    expect(r.conclusaoEstimada).toBe("2026-03-16");
  });

  it("em paralelo, o caminho crítico passa pela que termina por último", () => {
    const r = projetarFluxo(
      [
        no({
          key: "rapida",
          coluna: 1,
          status: "concluido",
          dataInicio: "2026-03-02",
          dataPrevisao: "2026-03-12",
          dataFinal: "2026-03-12",
        }),
        no({ key: "lenta", coluna: 1, status: "atrasado", dataInicio: "2026-03-02", dataPrevisao: "2026-03-10" }),
        no({ key: "fim", coluna: 2, dataInicio: "2026-03-16", dataPrevisao: "2026-03-20" }),
      ],
      "2026-03-13"
    );
    // lenta atrasou até hoje (sex 13) e passa a rápida, que fechou na qui 12.
    expect(r.caminhoCritico).toEqual(["lenta", "fim"]);
    expect(r.porNo.lenta.critico).toBe(true);
    expect(r.porNo.rapida.critico).toBe(false);
  });

  it("concluída usa a data_final, antes ou depois da previsão", () => {
    const r = projetarFluxo(
      [
        no({
          key: "a",
          coluna: 1,
          status: "concluido",
          dataInicio: "2026-03-02",
          dataPrevisao: "2026-03-04",
          dataFinal: "2026-03-06",
        }),
        no({ key: "b", coluna: 2, dataInicio: "2026-03-05", dataPrevisao: "2026-03-06" }),
      ],
      HOJE
    );
    expect(r.porNo.a.fimEstimado).toBe("2026-03-06");
    expect(r.porNo.a.atrasoDiasUteis).toBe(0);
    // b não começou e a dependência só fechou na sex 06: começa seg 09, dura 1 dia útil, mas
    // como está no passado o mínimo é hoje.
    expect(r.porNo.b.inicioEstimado).toBe("2026-03-09");
    expect(r.porNo.b.fimEstimado).toBe(HOJE);
  });

  it("disciplina em andamento não é empurrada pela dependência (já começou de fato)", () => {
    const r = projetarFluxo(
      [
        no({ key: "a", coluna: 1, status: "atrasado", dataInicio: "2026-03-02", dataPrevisao: "2026-03-09" }),
        no({ key: "b", coluna: 2, status: "em_andamento", dataInicio: "2026-03-10", dataPrevisao: "2026-03-13" }),
      ],
      HOJE
    );
    expect(r.porNo.b.fimEstimado).toBe("2026-03-13");
    expect(r.porNo.b.atrasoDiasUteis).toBe(0);
  });

  it("pausada segue a previsão gravada, mesmo vencida", () => {
    const r = projetarFluxo(
      [no({ key: "a", coluna: 1, status: "pausado", dataInicio: "2026-03-02", dataPrevisao: "2026-03-05" })],
      HOJE
    );
    expect(r.porNo.a.fimEstimado).toBe("2026-03-05");
    expect(r.porNo.a.atrasoDiasUteis).toBe(0);
  });

  it("disciplina sem previsão fica fora da projeção e é contada", () => {
    const r = projetarFluxo(
      [
        no({ key: "a", coluna: 1, dataInicio: "2026-03-12", dataPrevisao: "2026-03-13" }),
        no({ key: "b", coluna: 1 }),
        no({ key: "c", coluna: 2 }),
      ],
      HOJE
    );
    expect(r.semData).toBe(2);
    expect(r.porNo.b.fimEstimado).toBeUndefined();
    expect(r.conclusaoEstimada).toBe("2026-03-13");
    expect(r.caminhoCritico).toEqual(["a"]);
  });

  it("dependência explícita em ciclo não trava a projeção", () => {
    const r = projetarFluxo(
      [
        no({ key: "a", coluna: 1, dependeDe: ["b"], dataInicio: "2026-03-12", dataPrevisao: "2026-03-13" }),
        no({ key: "b", coluna: 2, dependeDe: ["a"], dataInicio: "2026-03-12", dataPrevisao: "2026-03-13" }),
      ],
      HOJE
    );
    expect(r.conclusaoEstimada).toBeDefined();
    expect(r.caminhoCritico.length).toBeGreaterThan(0);
  });

  it("fluxo vazio não quebra", () => {
    expect(projetarFluxo([], HOJE)).toEqual({
      porNo: {},
      conclusaoEstimada: undefined,
      caminhoCritico: [],
      semData: 0,
    });
  });
});
