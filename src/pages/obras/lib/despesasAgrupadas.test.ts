import { describe, expect, it } from "vitest";
import { agruparDespesas, classificarAbc } from "./despesasAgrupadas";

const nomes = new Map([["f1", "Balarotti"]]);

describe("agruparDespesas", () => {
  it("soma por fornecedor, ignora aporte e separa quem não tem fornecedor", () => {
    const g = agruparDespesas(
      [
        { tipo: "despesa", descricao: "Parafuso", valor: 340, fornecedor_id: "f1" },
        { tipo: "despesa", descricao: "Prego", valor: 60, fornecedor_id: "f1" },
        { tipo: "despesa", descricao: "Cimento", valor: 100 },
        { tipo: "aporte", descricao: "Aporte", valor: 9999 },
      ],
      "fornecedor",
      nomes
    );
    expect(g.map((x) => [x.rotulo, x.total])).toEqual([
      ["Balarotti", 400],
      ["Sem fornecedor", 100],
    ]);
  });

  it("agrupa por item sem diferenciar maiúscula e acento, somando quantidade de mesma unidade", () => {
    const g = agruparDespesas(
      [
        { tipo: "despesa", descricao: "Parafuso", valor: 100, quantidade: 100, unidade: "un" },
        { tipo: "despesa", descricao: "parafuso ", valor: 240, quantidade: 200, unidade: "UN" },
      ],
      "item",
      nomes
    );
    expect(g).toHaveLength(1);
    expect(g[0]).toMatchObject({ total: 340, quantidade: 300, unidade: "un", lancamentos: 2 });
  });

  it("não soma quantidade de unidades diferentes", () => {
    const g = agruparDespesas(
      [
        { tipo: "despesa", descricao: "Areia", valor: 10, quantidade: 1, unidade: "m³" },
        { tipo: "despesa", descricao: "Areia", valor: 10, quantidade: 5, unidade: "saco" },
      ],
      "item",
      nomes
    );
    expect(g[0].quantidade).toBeNull();
  });
});

describe("classificarAbc", () => {
  const g = (rotulo: string, total: number) => ({
    chave: rotulo,
    rotulo,
    total,
    lancamentos: 1,
    quantidade: null,
    unidade: null,
  });

  it("A até 80% do gasto, B até 95%, C o resto", () => {
    const r = classificarAbc([g("a", 600), g("b", 250), g("c", 100), g("d", 50)]);
    expect(r.map((x) => x.classe)).toEqual(["A", "A", "B", "C"]);
    expect(r.map((x) => x.acumuladoPct)).toEqual([60, 85, 95, 100]);
  });

  it("item que sozinho passa de 80% é A", () => {
    expect(classificarAbc([g("a", 900), g("b", 100)]).map((x) => x.classe)).toEqual(["A", "B"]);
  });

  it("sem gasto não classifica", () => {
    expect(classificarAbc([])).toEqual([]);
  });
});
