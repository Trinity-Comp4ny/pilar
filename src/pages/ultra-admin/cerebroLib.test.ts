import { describe, expect, it } from "vitest";
import { agruparTemas, filtrar, percentualRedeProxima, proporcaoPorOrigem, type LinhaInsight } from "./cerebroLib";

function linha(over: Partial<LinhaInsight>): LinhaInsight {
  return {
    id: "i",
    reuniao_id: "r1",
    categoria: "dor",
    texto: "t",
    citacao: "c",
    modulo_pilar: "Financeiro",
    removido: false,
    reuniao: { origem_nome: "Escritório A", origem_contato: "frio" },
    ...over,
  };
}

describe("agruparTemas", () => {
  it("conta reuniões e escritórios distintos e ordena por escritórios", () => {
    const temas = agruparTemas([
      linha({ id: "1", reuniao_id: "r1" }),
      linha({ id: "2", reuniao_id: "r1" }),
      linha({ id: "3", reuniao_id: "r2", reuniao: { origem_nome: "Escritório B", origem_contato: "frio" } }),
      linha({ id: "4", reuniao_id: "r3", categoria: "ideia", modulo_pilar: null }),
    ]);
    expect(temas[0]).toMatchObject({ categoria: "dor", reunioes: 2, escritorios: 2 });
    expect(temas[1]).toMatchObject({ categoria: "ideia", reunioes: 1, escritorios: 1 });
  });

  it("ignora insight removido e mesmo escritório em reuniões diferentes conta uma vez", () => {
    const temas = agruparTemas([
      linha({ id: "1", reuniao_id: "r1" }),
      linha({ id: "2", reuniao_id: "r2", reuniao: { origem_nome: " escritório a ", origem_contato: "frio" } }),
      linha({ id: "3", reuniao_id: "r3", removido: true }),
    ]);
    expect(temas).toHaveLength(1);
    expect(temas[0]).toMatchObject({ reunioes: 2, escritorios: 1 });
  });
});

describe("filtrar", () => {
  it("filtra por categoria, módulo e escritório", () => {
    const l = [linha({ id: "1" }), linha({ id: "2", categoria: "ideia" }), linha({ id: "3", modulo_pilar: "Obras" })];
    expect(filtrar(l, { categoria: "dor", modulo: null, escritorio: null }).map((x) => x.id)).toEqual(["1", "3"]);
    expect(filtrar(l, { categoria: null, modulo: "Obras", escritorio: null }).map((x) => x.id)).toEqual(["3"]);
    expect(filtrar(l, { categoria: null, modulo: null, escritorio: "Outro" })).toEqual([]);
  });
});

describe("proporção por origem", () => {
  it("calcula a proporção e o percentual da rede próxima", () => {
    const r = [
      { origem_contato: "parente" },
      { origem_contato: "indicacao" },
      { origem_contato: "frio" },
      { origem_contato: null },
    ];
    expect(proporcaoPorOrigem(r).find((x) => x.origem === "frio")?.percentual).toBe(25);
    expect(percentualRedeProxima(r)).toBe(50);
    expect(percentualRedeProxima([])).toBe(0);
  });
});
