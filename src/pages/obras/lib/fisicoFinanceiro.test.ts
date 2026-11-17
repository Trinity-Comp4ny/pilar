import { describe, expect, it } from "vitest";
import {
  colunasDaEscala,
  curvaPlanejadoRealizado,
  diferencaPlanejado,
  distribuirLinear,
  lerPercentual,
  LIMITE_MESES,
  mesesEntre,
  montarFisicoFinanceiro,
  percentualDe,
  percentuaisAposEdicao,
  percentuaisDoNo,
  periodosPorNo,
  rotuloMes,
  rotuloTrimestre,
  somarPorTrimestre,
  trimestreDe,
  valorDaColuna,
} from "./fisicoFinanceiro";
import { montarOrcadoRealizado, type NoFinanceiro } from "@/lib/orcadoRealizado";
import type { Periodo } from "./obraArvore";

const no = (id: string, parent_id: string | null, nivel: string, ordem = 0): NoFinanceiro => ({
  id,
  parent_id,
  nivel,
  nome: id.toUpperCase(),
  ordem,
  created_at: "2026-01-01",
});

const soma = (r: Record<string, number>) => Math.round(Object.values(r).reduce((a, v) => a + v, 0) * 100) / 100;

describe("mesesEntre", () => {
  it("lista os meses incluindo o do fim", () => {
    expect(mesesEntre("2026-11-15", "2027-02-01")).toEqual(["2026-11", "2026-12", "2027-01", "2027-02"]);
  });

  it("devolve um mês só quando início e fim caem no mesmo mês", () => {
    expect(mesesEntre("2026-11-03", "2026-11-28")).toEqual(["2026-11"]);
  });

  it("devolve vazio para data inválida ou fim antes do início", () => {
    expect(mesesEntre("2026-12-10", "2026-11-10")).toEqual([]);
    expect(mesesEntre("2026-02-30", "2026-03-10")).toEqual([]);
    expect(mesesEntre("", "2026-03-10")).toEqual([]);
  });
});

describe("distribuirLinear", () => {
  it("reparte por dia corrido e fecha no previsto (15/11 a 15/12: 16 de 31 dias em novembro)", () => {
    const r = distribuirLinear(30000, "2026-11-15", "2026-12-15");
    expect(r["2026-11"]).toBe(15483.87);
    expect(r["2026-12"]).toBe(14516.13);
    expect(soma(r)).toBe(30000);
  });

  it("põe tudo no mês quando o período cabe num mês só, inclusive um dia", () => {
    expect(distribuirLinear(1000, "2026-11-10", "2026-11-10")).toEqual({ "2026-11": 1000 });
  });

  it("cruza a virada de ano na ordem certa", () => {
    const r = distribuirLinear(4000, "2026-11-01", "2027-02-28");
    expect(Object.keys(r)).toEqual(["2026-11", "2026-12", "2027-01", "2027-02"]);
    expect(soma(r)).toBe(4000);
  });

  it("joga o resíduo de arredondamento no último mês", () => {
    const r = distribuirLinear(100, "2026-11-01", "2027-01-31");
    expect(soma(r)).toBe(100);
  });

  it("devolve vazio para período inválido ou previsto zero", () => {
    expect(distribuirLinear(500, "2026-12-10", "2026-11-10")).toEqual({});
    expect(distribuirLinear(0, "2026-11-10", "2026-12-10")).toEqual({});
  });

  it("não depende de fuso: fevereiro bissexto tem 29 dias", () => {
    const r = distribuirLinear(2900, "2028-02-01", "2028-03-31");
    // 29 dias em fevereiro + 31 em março = 60 dias: 2900 × 29 ÷ 60.
    expect(r["2028-02"]).toBe(1401.67);
    expect(soma(r)).toBe(2900);
  });
});

describe("montarFisicoFinanceiro", () => {
  const nos = [
    no("f1", null, "fase"),
    no("e1", "f1", "etapa"),
    no("s1", "e1", "servico", 1),
    no("s2", "e1", "servico", 2),
  ];
  const periodos = new Map<string, Periodo | null>([
    ["f1", { inicio: "2026-11-01", fim: "2026-12-31" }],
    ["e1", { inicio: "2026-11-01", fim: "2026-12-31" }],
    ["s1", { inicio: "2026-11-01", fim: "2026-11-30" }],
    ["s2", { inicio: "2026-12-01", fim: "2026-12-31" }],
  ]);

  it("soma os meses dos filhos quando o pai não tem valor próprio", () => {
    const orc = montarOrcadoRealizado(
      nos,
      new Map([
        ["s1", 10000],
        ["s2", 20000],
      ]),
      {}
    );
    const ff = montarFisicoFinanceiro(orc.raizes, periodos);
    const e1 = ff.linhas.find((l) => l.id === "e1")!;
    expect(e1.previsto).toBe(30000);
    expect(e1.porMes).toEqual({ "2026-11": 10000, "2026-12": 20000 });
    expect(ff.meses).toEqual(["2026-11", "2026-12"]);
    expect(ff.totalPorMes).toEqual({ "2026-11": 10000, "2026-12": 20000 });
    expect(ff.acumuladoPorMes["2026-12"]).toBe(30000);
    expect(ff.totalPrevisto).toBe(30000);
    expect(ff.diferencaManual).toBe(0);
  });

  it("mantém a ordem de leitura (pai antes dos filhos) com profundidade", () => {
    const orc = montarOrcadoRealizado(nos, new Map([["s1", 1]]), {});
    const ff = montarFisicoFinanceiro(orc.raizes, periodos);
    expect(ff.linhas.map((l) => [l.id, l.profundidade])).toEqual([
      ["f1", 0],
      ["e1", 1],
      ["s1", 2],
      ["s2", 2],
    ]);
  });

  it("com previsto próprio no pai, o total conta só o pai e os filhos viram detalhe", () => {
    const orc = montarOrcadoRealizado(
      nos,
      new Map([
        ["e1", 100000],
        ["s1", 40000],
        ["s2", 50000],
      ]),
      {}
    );
    const ff = montarFisicoFinanceiro(orc.raizes, periodos);
    expect(ff.totalPrevisto).toBe(100000);
    expect(soma(ff.totalPorMes)).toBe(100000);
    const s1 = ff.linhas.find((l) => l.id === "s1")!;
    expect(s1.contaNoTotal).toBe(false);
    expect(s1.porMes["2026-11"]).toBe(40000);
    expect(ff.linhas.find((l) => l.id === "e1")!.contaNoTotal).toBe(true);
  });

  it("nó com previsto e sem datas vai para 'sem data' e fica fora dos meses", () => {
    const orc = montarOrcadoRealizado(nos, new Map([["s1", 7000]]), {});
    const ff = montarFisicoFinanceiro(orc.raizes, new Map([["s1", null]]));
    expect(ff.meses).toEqual([]);
    expect(ff.semData).toEqual({ valor: 7000, itens: 1 });
    expect(ff.linhas.find((l) => l.id === "s1")!.semData).toBe(7000);
    expect(ff.totalPrevisto).toBe(7000);
    expect(ff.diferencaManual).toBe(0);
  });

  it("início depois do fim é tratado como sem data", () => {
    const orc = montarOrcadoRealizado(nos, new Map([["s1", 500]]), {});
    const ff = montarFisicoFinanceiro(orc.raizes, new Map([["s1", { inicio: "2026-12-10", fim: "2026-11-10" }]]));
    expect(ff.semData).toEqual({ valor: 500, itens: 1 });
  });

  it("previsto zero em todos os nós devolve grade vazia", () => {
    const orc = montarOrcadoRealizado(nos, new Map(), {});
    const ff = montarFisicoFinanceiro(orc.raizes, periodos);
    expect(ff.meses).toEqual([]);
    expect(ff.totalPrevisto).toBe(0);
    expect(ff.semData).toEqual({ valor: 0, itens: 0 });
  });

  it("nó manual usa os percentuais gravados e mostra quanto falta ou passou", () => {
    const orc = montarOrcadoRealizado(nos, new Map([["s1", 30000]]), {});
    const manual = new Map([["s1", { "2026-11": 51.6, "2026-12": 70 }]]);
    const ff = montarFisicoFinanceiro(orc.raizes, periodos, manual);
    const s1 = ff.linhas.find((l) => l.id === "s1")!;
    expect(s1.manual).toBe(true);
    expect(s1.faltaPct).toBe(-21.6);
    expect(s1.porMes).toEqual({ "2026-11": 15480, "2026-12": 21000 });
    expect(ff.diferencaManual).toBe(-6480);
  });

  it("nó manual fechando 100% não tem falta", () => {
    const orc = montarOrcadoRealizado(nos, new Map([["s1", 1000]]), {});
    const ff = montarFisicoFinanceiro(orc.raizes, periodos, new Map([["s1", { "2026-11": 25, "2026-12": 75 }]]));
    expect(ff.linhas.find((l) => l.id === "s1")!.faltaPct).toBe(0);
    expect(ff.diferencaManual).toBe(0);
  });

  it("mudar o período de um nó manual não muda a grade", () => {
    const orc = montarOrcadoRealizado(nos, new Map([["s1", 1000]]), {});
    const manual = new Map([["s1", { "2026-11": 100 }]]);
    const a = montarFisicoFinanceiro(orc.raizes, periodos, manual);
    const b = montarFisicoFinanceiro(
      orc.raizes,
      new Map([["s1", { inicio: "2027-03-01", fim: "2027-04-01" }]]),
      manual
    );
    expect(b.linhas.find((l) => l.id === "s1")!.porMes).toEqual(a.linhas.find((l) => l.id === "s1")!.porMes);
  });

  it("o acumulado do último mês é o total previsto", () => {
    const orc = montarOrcadoRealizado(
      nos,
      new Map([
        ["s1", 12345.67],
        ["s2", 7654.33],
      ]),
      {}
    );
    const ff = montarFisicoFinanceiro(orc.raizes, periodos);
    expect(ff.acumuladoPorMes[ff.meses[ff.meses.length - 1]]).toBe(20000);
  });

  it("preenche meses do meio sem valor, para o eixo ficar contínuo", () => {
    const orc = montarOrcadoRealizado(
      nos,
      new Map([
        ["s1", 100],
        ["s2", 100],
      ]),
      {}
    );
    const ff = montarFisicoFinanceiro(
      orc.raizes,
      new Map<string, Periodo | null>([
        ["s1", { inicio: "2026-11-01", fim: "2026-11-30" }],
        ["s2", { inicio: "2027-02-01", fim: "2027-02-28" }],
      ])
    );
    expect(ff.meses).toEqual(["2026-11", "2026-12", "2027-01", "2027-02"]);
    expect(ff.acumuladoPorMes["2027-01"]).toBe(100);
  });

  it("avisa quando passa do limite de meses", () => {
    const orc = montarOrcadoRealizado(nos, new Map([["s1", 1000]]), {});
    const ff = montarFisicoFinanceiro(orc.raizes, new Map([["s1", { inicio: "2026-01-01", fim: "2031-12-31" }]]));
    expect(ff.meses.length).toBeGreaterThan(LIMITE_MESES);
    expect(ff.excedeLimite).toBe(true);
  });
});

describe("percentualDe e percentuaisDoNo", () => {
  it("calcula o percentual com uma casa e protege contra previsto zero", () => {
    expect(percentualDe(15483.87, 30000)).toBe(51.6);
    expect(percentualDe(10, 0)).toBe(0);
  });

  it("converte valores em percentuais gravaveis", () => {
    expect(percentuaisDoNo({ "2026-11": 15483.87, "2026-12": 14516.13 }, 30000)).toEqual({
      "2026-11": 51.6129,
      "2026-12": 48.3871,
    });
    expect(percentuaisDoNo({ "2026-11": 10 }, 0)).toEqual({});
  });
});

describe("trimestres", () => {
  it("agrupa o mês no trimestre", () => {
    expect(trimestreDe("2026-11")).toBe("2026-T4");
    expect(trimestreDe("2027-01")).toBe("2027-T1");
  });

  it("soma por trimestre sem mudar o total", () => {
    const r = somarPorTrimestre({ "2026-10": 10, "2026-11": 20, "2026-12": 30, "2027-01": 5 });
    expect(r).toEqual({ "2026-T4": 60, "2027-T1": 5 });
  });
});

describe("curvaPlanejadoRealizado", () => {
  const ff = {
    meses: ["2026-10", "2026-11", "2026-12"],
    acumuladoPorMes: { "2026-10": 100, "2026-11": 250, "2026-12": 300 },
  };

  it("cruza planejado e realizado e deixa o realizado vazio depois do mês atual", () => {
    const pontos = curvaPlanejadoRealizado(
      ff,
      [
        { mes: "2026-10", acumuladoRealizado: 80 },
        { mes: "2026-11", acumuladoRealizado: 200 },
      ],
      "2026-11"
    );
    expect(pontos).toEqual([
      { mes: "2026-10", planejadoAcumulado: 100, realizadoAcumulado: 80 },
      { mes: "2026-11", planejadoAcumulado: 250, realizadoAcumulado: 200 },
      { mes: "2026-12", planejadoAcumulado: 300, realizadoAcumulado: null },
    ]);
  });

  it("estende o eixo quando há despesa antes do primeiro mês planejado", () => {
    const pontos = curvaPlanejadoRealizado(ff, [{ mes: "2026-09", acumuladoRealizado: 50 }], "2026-12");
    expect(pontos[0]).toEqual({ mes: "2026-09", planejadoAcumulado: 0, realizadoAcumulado: 50 });
    expect(pontos.map((p) => p.mes)).toEqual(["2026-09", "2026-10", "2026-11", "2026-12"]);
  });

  it("sem planejado e sem realizado devolve vazio", () => {
    expect(curvaPlanejadoRealizado({ meses: [], acumuladoPorMes: {} }, [], "2026-11")).toEqual([]);
  });
});

describe("colunas da escala", () => {
  const meses = ["2026-10", "2026-11", "2026-12", "2027-01"];

  it("rotula mês e trimestre", () => {
    expect(rotuloMes("2026-11")).toBe("nov/26");
    expect(rotuloTrimestre("2026-T4")).toBe("T4/26");
  });

  it("na escala mensal, uma coluna por mês", () => {
    expect(colunasDaEscala(meses, "mensal").map((c) => c.rotulo)).toEqual(["out/26", "nov/26", "dez/26", "jan/27"]);
  });

  it("na escala trimestral, agrupa na ordem e guarda os meses de cada coluna", () => {
    const cols = colunasDaEscala(meses, "trimestral");
    expect(cols.map((c) => [c.rotulo, c.meses])).toEqual([
      ["T4/26", ["2026-10", "2026-11", "2026-12"]],
      ["T1/27", ["2027-01"]],
    ]);
  });

  it("soma o valor da linha nos meses da coluna", () => {
    const [t4] = colunasDaEscala(meses, "trimestral");
    expect(valorDaColuna({ "2026-10": 10.1, "2026-11": 20.2, "2027-01": 99 }, t4)).toBe(30.3);
    expect(valorDaColuna({}, t4)).toBe(0);
  });

  it("sem meses não há colunas", () => {
    expect(colunasDaEscala([], "trimestral")).toEqual([]);
  });
});

describe("diferencaPlanejado", () => {
  it("positivo quando gastou mais do que o planejado, com percentual sobre o planejado", () => {
    expect(diferencaPlanejado({ mes: "2026-11", planejadoAcumulado: 250, realizadoAcumulado: 300 })).toEqual({
      valor: 50,
      pct: 20,
    });
  });

  it("negativo quando gastou menos", () => {
    expect(diferencaPlanejado({ mes: "2026-11", planejadoAcumulado: 400, realizadoAcumulado: 300 })).toEqual({
      valor: -100,
      pct: -25,
    });
  });

  it("sem percentual quando o planejado é zero", () => {
    expect(diferencaPlanejado({ mes: "2026-09", planejadoAcumulado: 0, realizadoAcumulado: 50 })).toEqual({
      valor: 50,
      pct: null,
    });
  });

  it("nulo nos meses sem realizado", () => {
    expect(diferencaPlanejado({ mes: "2026-12", planejadoAcumulado: 300, realizadoAcumulado: null })).toBeNull();
  });
});

describe("lerPercentual", () => {
  it("aceita vírgula, ponto, espaço e o sinal de %", () => {
    expect(lerPercentual("12,5")).toBe(12.5);
    expect(lerPercentual("12.5")).toBe(12.5);
    expect(lerPercentual(" 40 %")).toBe(40);
    expect(lerPercentual("0")).toBe(0);
    expect(lerPercentual("100")).toBe(100);
  });

  it("recusa vazio, texto, negativo e acima de 100", () => {
    for (const ruim of ["", "  ", "abc", "-5", "100,01", "1e2", "12,5,3"]) expect(lerPercentual(ruim)).toBeNull();
  });

  it("limita a 4 casas, como a coluna do banco", () => {
    expect(lerPercentual("33,333333")).toBe(33.3333);
  });
});

describe("percentuaisAposEdicao", () => {
  it("parte dos valores de hoje, completa os meses vazios com zero e troca o mês editado", () => {
    const r = percentuaisAposEdicao(
      { porMes: { "2026-11": 15483.87, "2026-12": 14516.13 }, previsto: 30000 },
      ["2026-11", "2026-12", "2027-01"],
      "2026-12",
      70
    );
    expect(r).toEqual({ "2026-11": 51.6129, "2026-12": 70, "2027-01": 0 });
  });

  it("edita um mês que o nó ainda não tinha", () => {
    const r = percentuaisAposEdicao(
      { porMes: { "2026-11": 100 }, previsto: 100 },
      ["2026-11", "2026-12"],
      "2026-12",
      25
    );
    expect(r).toEqual({ "2026-11": 100, "2026-12": 25 });
  });
});

describe("periodosPorNo", () => {
  it("percorre a árvore inteira por id", () => {
    const p = { inicio: "2026-11-01", fim: "2026-11-30" };
    const mapa = periodosPorNo([
      {
        no: { id: "f" },
        periodo: p,
        filhos: [{ no: { id: "e" }, periodo: null, filhos: [{ no: { id: "s" }, periodo: p, filhos: [] }] }],
      },
    ]);
    expect([...mapa.keys()]).toEqual(["f", "e", "s"]);
    expect(mapa.get("e")).toBeNull();
    expect(mapa.get("s")).toEqual(p);
  });
});

describe("distribuivel e datasMudaram", () => {
  const nos = [
    no("f1", null, "fase"),
    no("e1", "f1", "etapa"),
    no("s1", "e1", "servico", 1),
    no("s2", "e1", "servico", 2),
  ];
  const periodos = new Map<string, Periodo | null>([
    ["s1", { inicio: "2026-11-01", fim: "2026-11-30" }],
    ["s2", { inicio: "2026-12-01", fim: "2026-12-31" }],
  ]);

  it("folha com valor é distribuível; agregado de filhos e detalhe de pai com valor próprio não são", () => {
    const filhos = montarFisicoFinanceiro(
      montarOrcadoRealizado(
        nos,
        new Map([
          ["s1", 100],
          ["s2", 100],
        ]),
        {}
      ).raizes,
      periodos
    );
    expect(filhos.linhas.map((l) => [l.id, l.distribuivel])).toEqual([
      ["f1", false],
      ["e1", false],
      ["s1", true],
      ["s2", true],
    ]);

    const pai = montarFisicoFinanceiro(
      montarOrcadoRealizado(
        nos,
        new Map([
          ["e1", 300],
          ["s1", 100],
        ]),
        {}
      ).raizes,
      new Map([["e1", { inicio: "2026-11-01", fim: "2026-12-31" }]])
    );
    expect(pai.linhas.find((l) => l.id === "e1")!.distribuivel).toBe(true);
    expect(pai.linhas.find((l) => l.id === "s1")!.distribuivel).toBe(false);
  });

  it("nó sem previsto não é distribuível", () => {
    const r = montarFisicoFinanceiro(montarOrcadoRealizado(nos, new Map(), {}).raizes, periodos);
    expect(r.linhas.every((l) => !l.distribuivel)).toBe(true);
  });

  it("nó manual com valor fora do período atual marca datasMudaram", () => {
    const orc = montarOrcadoRealizado(nos, new Map([["s1", 1000]]), {});
    const dentro = montarFisicoFinanceiro(orc.raizes, periodos, new Map([["s1", { "2026-11": 100 }]]));
    expect(dentro.linhas.find((l) => l.id === "s1")!.datasMudaram).toBe(false);
    const fora = montarFisicoFinanceiro(orc.raizes, periodos, new Map([["s1", { "2026-11": 50, "2027-02": 50 }]]));
    expect(fora.linhas.find((l) => l.id === "s1")!.datasMudaram).toBe(true);
  });

  it("nó automático nunca marca datasMudaram", () => {
    const r = montarFisicoFinanceiro(montarOrcadoRealizado(nos, new Map([["s1", 10]]), {}).raizes, periodos);
    expect(r.linhas.every((l) => !l.datasMudaram)).toBe(true);
  });
});
